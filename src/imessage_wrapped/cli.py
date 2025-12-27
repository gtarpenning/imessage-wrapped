import argparse
import logging
import sys
from datetime import datetime
from pathlib import Path

import questionary
from rich.console import Console
from rich.progress import (
    BarColumn,
    MofNCompleteColumn,
    Progress,
    SpinnerColumn,
    TaskID,
    TextColumn,
    TimeElapsedColumn,
    TimeRemainingColumn,
)

from . import (
    Exporter,
    ExportLoader,
    MessageService,
    NLPStatisticsAnalyzer,
    PermissionError,
    RawStatisticsAnalyzer,
    TerminalDisplay,
    require_database_access,
)
from .utils import sanitize_statistics_for_export

logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(
        prog="imexport",
        description="Export and analyze iMessage conversations from macOS",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "-y",
        "--year",
        type=int,
        default=datetime.now().year,
        help="Year to export (default: current year)",
    )

    parser.add_argument(
        "-o",
        "--output",
        type=str,
        help="Output file path (default: exports/imessage_export_YEAR.jsonl)",
    )

    parser.add_argument(
        "-d",
        "--database",
        type=str,
        help="Path to chat.db (default: ~/Library/Messages/chat.db)",
    )

    parser.add_argument(
        "--format",
        type=str,
        choices=["jsonl", "json"],
        default="jsonl",
        help="Export format (default: jsonl)",
    )

    parser.add_argument(
        "--indent",
        type=int,
        default=2,
        help="JSON indentation spaces for json format (default: 2, use 0 for compact)",
    )

    parser.add_argument(
        "--skip-permission-check",
        action="store_true",
        help="Skip permission check (use with caution)",
    )

    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging",
    )

    parser.add_argument(
        "--replace-cache",
        action="store_true",
        help="Replace existing cached export file if it exists",
    )

    parser.add_argument(
        "--no-analyze",
        action="store_true",
        help="Skip analysis after export",
    )

    parser.add_argument(
        "input",
        type=str,
        nargs="?",
        help="Path to exported JSON/JSONL file (for analyze-only mode)",
    )

    parser.add_argument(
        "--analyzers",
        type=str,
        default="raw",
        help="Comma-separated list of analyzers to run (raw,nlp) (default: raw)",
    )

    parser.add_argument(
        "--stats-output",
        type=str,
        dest="stats_output",
        help="Output file path for statistics JSON (optional)",
    )

    parser.add_argument(
        "--no-share",
        action="store_false",
        dest="share",
        help="Don't upload statistics (show full terminal output instead)",
    )

    parser.add_argument(
        "--share",
        action="store_true",
        dest="share",
        default=True,
        help="Upload statistics to web and get shareable link (default)",
    )

    parser.add_argument(
        "--server-url",
        type=str,
        default="https://imessage-wrapped.fly.dev",
        help="Web server URL for sharing (default: https://imessage-wrapped.fly.dev)",
    )

    parser.add_argument(
        "--dev",
        action="store_true",
        help="Use local development server (http://localhost:3000)",
    )

    parser.add_argument(
        "--ghost-timeline",
        type=int,
        default=7,
        help="Days without a reply before someone counts as a ghost (default: 7)",
    )

    args = parser.parse_args()

    if args.dev:
        args.replace_cache = True

    return args


def export_command(args):
    console = Console()

    if not args.skip_permission_check:
        try:
            require_database_access(args.database)
        except PermissionError:
            sys.exit(1)

    if args.output:
        output_path = args.output
    else:
        ext = "jsonl" if args.format == "jsonl" else "json"
        output_path = f"exports/imessage_export_{args.year}.{ext}"

    output_file = Path(output_path)

    if output_file.exists() and not args.replace_cache:
        console.print(f"\n[yellow]ℹ[/] Export file already exists: [cyan]{output_path}[/]")
        console.print("[dim]Use --replace-cache to regenerate[/]")
        return output_path

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task(f"Exporting messages from {args.year}...", total=None)

        service = MessageService(db_path=args.database)
        data = service.export_year(args.year)

        progress.update(task, description=f"Writing {data.total_messages} messages to file...")

        from .exporter import JSONLSerializer, JSONSerializer

        if args.format == "json":
            serializer = JSONSerializer(indent=args.indent if args.indent > 0 else None)
        else:
            serializer = JSONLSerializer()
        exporter = Exporter(serializer=serializer)
        exporter.export_to_file(data, output_path)

    console.print(
        f"\n[green]✓[/] Exported {data.total_messages} messages to [cyan]{output_path}[/]"
    )
    console.print(f"[dim]Conversations: {len(data.conversations)}[/]")

    return output_path


def analyze_command(args, input_path=None):
    console = Console()

    if args.ghost_timeline <= 0:
        console.print("[red]✗[/] --ghost-timeline must be greater than zero")
        sys.exit(1)

    if input_path:
        input_path = Path(input_path)
        if not input_path.exists():
            console.print(f"[red]✗[/] Input file not found: {input_path}")
            sys.exit(1)
    elif args.input:
        input_path = Path(args.input)
        if not input_path.exists():
            console.print(f"[red]✗[/] Input file not found: {args.input}")
            sys.exit(1)
    else:
        exports_dir = Path("exports")
        export_files = []

        if exports_dir.exists():
            export_files = sorted(
                [f for f in exports_dir.iterdir() if f.suffix in [".json", ".jsonl"]],
                key=lambda x: x.stat().st_mtime,
                reverse=True,
            )

        if not export_files:
            console.print("[yellow]ℹ[/] No export found. Exporting messages first...\n")

            export_args = argparse.Namespace(
                year=args.year,
                output=None,
                database=args.database,
                format="jsonl",
                indent=2,
                skip_permission_check=args.skip_permission_check,
                debug=args.debug,
                replace_cache=args.replace_cache,
            )
            export_command(export_args)

            if not exports_dir.exists():
                console.print("[red]✗[/] Export failed.")
                sys.exit(1)

            export_files = sorted(
                [f for f in exports_dir.iterdir() if f.suffix in [".json", ".jsonl"]],
                key=lambda x: x.stat().st_mtime,
                reverse=True,
            )

        if not export_files:
            console.print("[red]✗[/] Export failed.")
            sys.exit(1)

        if args.share or len(export_files) == 1:
            input_path = export_files[0]
        else:
            choices = []
            for file in export_files:
                size_mb = file.stat().st_size / (1024 * 1024)
                choices.append(
                    questionary.Choice(title=f"{file.name} ({size_mb:.1f} MB)", value=file)
                )

            selected = questionary.select("Select export file to analyze:", choices=choices).ask()

            if selected is None:
                sys.exit(0)

            input_path = selected

    analyzer_names = [name.strip() for name in args.analyzers.split(",")]

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(bar_width=None, complete_style="green"),
        MofNCompleteColumn(),
        TimeElapsedColumn(),
        TimeRemainingColumn(elapsed_when_finished=True),
        console=console,
        transient=True,
    ) as progress:
        load_task = progress.add_task("Loading export data...", total=1)

        try:
            data = ExportLoader.load(input_path)
        except Exception as e:
            console.print(f"[red]✗[/] Failed to load export data: {e}")
            sys.exit(1)

        progress.update(load_task, advance=1, description="Export loaded")

        sentiment_tasks: dict[str, TaskID] = {}

        def sentiment_progress(stage: str, completed: int, total: int) -> None:
            if total == 0:
                return
            label = "Sentiment (You)" if stage == "sent" else "Sentiment (Them)"
            task_id = sentiment_tasks.get(stage)
            if task_id is None:
                task_id = progress.add_task(label, total=total)
                sentiment_tasks[stage] = task_id
            progress.update(task_id, completed=completed, total=total)

        analyzers = []

        def _print_sentiment_info(info: dict[str, str | int | None] | None) -> None:
            if not info:
                return
            params = info.get("parameters_display")
            name = info.get("name") or "Sentiment"
            details: list[str] = []
            if params:
                details.append(f"{params} parameters")
            detail_text = f" ({', '.join(details)})" if details else ""
            progress.console.print(f"[dim]Using sentiment backend: {name}{detail_text}[/]")

        if "raw" in analyzer_names:
            analyzers.append(
                RawStatisticsAnalyzer(
                    sentiment_progress=sentiment_progress,
                    ghost_timeline_days=args.ghost_timeline,
                )
            )
            _print_sentiment_info(analyzers[-1].sentiment_model_info)
        if "nlp" in analyzer_names:
            analyzers.append(NLPStatisticsAnalyzer())
        analyzer_task = progress.add_task(
            f"Running {len(analyzers)} analyzer(s)...", total=max(len(analyzers), 1)
        )

        statistics = {}
        for analyzer in analyzers:
            progress.update(analyzer_task, description=f"Running {analyzer.name} analyzer...")
            statistics[analyzer.name] = analyzer.analyze(data)
            progress.advance(analyzer_task)

    sanitized_statistics = sanitize_statistics_for_export(statistics)

    if args.stats_output:
        import json

        output_path = Path(args.stats_output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(sanitized_statistics, f, indent=2, ensure_ascii=False)
        console.print(f"\n[green]✓[/] Statistics saved to [cyan]{args.stats_output}[/]")

    display = TerminalDisplay()
    display.render(statistics, brief=args.share)

    if args.share:
        from .uploader import StatsUploader

        server_url = "http://localhost:3000" if args.dev else args.server_url
        uploader = StatsUploader(base_url=server_url)

        year = data.year if hasattr(data, "year") else datetime.now().year
        share_url = uploader.upload(year, sanitized_statistics)

        if not share_url:
            console.print("\n[yellow]Tip: Make sure the web server is running:[/]")
            console.print("[dim]  cd web && npm install && npm run dev[/]")


def main():
    args = parse_args()

    if args.debug:
        logging.basicConfig(
            level=logging.DEBUG, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        logger.debug("Debug logging enabled")

    if args.input:
        analyze_command(args)
    else:
        export_path = export_command(args)
        if export_path and not args.no_analyze:
            analyze_command(args, input_path=export_path)


if __name__ == "__main__":
    main()
