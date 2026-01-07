import argparse
import logging
import sys
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
from .phrase_utils import compute_phrases_for_export
from .sentiment_utils import compute_sentiment_for_export
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
        default=2025,
        help="Year to export (default: 2025)",
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

    parser.add_argument(
        "--compare",
        nargs=2,
        type=int,
        metavar=("YEAR1", "YEAR2"),
        help="Compare two years (e.g., --compare 2024 2025). Creates both individual wraps and a comparison view.",
    )

    parser.add_argument(
        "--with-contacts",
        action="store_true",
        help="Include contact names from Contacts app (requires Full Disk Access)",
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

    with_contacts = getattr(args, "with_contacts", False)

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task(f"Exporting messages from {args.year}...", total=None)

        service = MessageService(db_path=args.database, with_contacts=with_contacts)
        data = service.export_year(args.year)

        # Precompute phrases while text is available; stored alongside export without raw text.
        phrases, phrases_by_contact = compute_phrases_for_export(data)
        data.phrases = phrases or None
        # Per-contact phrases are intentionally omitted from export for privacy.
        data.phrases_by_contact = None

        # Precompute sentiment (overall + monthly) while text is available.
        data.sentiment = compute_sentiment_for_export(data) or None

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

    # Keep original statistics for hydration, then sanitize for export
    original_statistics = statistics
    sanitized_statistics = sanitize_statistics_for_export(statistics)

    if args.stats_output:
        import json

        output_path = Path(args.stats_output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(sanitized_statistics, f, indent=2, ensure_ascii=False)
        console.print(f"\n[green]✓[/] Statistics saved to [cyan]{args.stats_output}[/]")

    display = TerminalDisplay()
    display.render(
        statistics,
        brief=args.share,
        metadata={
            "user_name": data.user_name if hasattr(data, "user_name") else None,
            "year": data.year if hasattr(data, "year") else None,
        },
    )

    if args.share:
        from .uploader import StatsUploader

        server_url = "http://localhost:3000" if args.dev else args.server_url
        uploader = StatsUploader(base_url=server_url)

        year = data.year if hasattr(data, "year") else 2025
        user_name = data.user_name if hasattr(data, "user_name") else None
        with_contacts = getattr(args, "with_contacts", False)
        share_url = uploader.upload(
            year,
            sanitized_statistics,
            user_name=user_name,
            original_statistics=original_statistics,
            with_contacts=with_contacts,
        )

        if not share_url:
            console.print("\n[yellow]Tip: Make sure the web server is running:[/]")
            console.print("[dim]  cd web && npm install && npm run dev[/]")


def compare_command(args):
    """Handle year-over-year comparison"""
    console = Console()

    year1, year2 = args.compare

    # Ensure year1 < year2 for consistency
    if year1 > year2:
        year1, year2 = year2, year1

    if year1 == year2:
        console.print("[red]✗[/] Cannot compare the same year")
        sys.exit(1)

    console.print(f"\n[bold cyan]Creating year-over-year comparison: {year1} vs {year2}[/]\n")

    # Export and analyze year 1
    console.print(f"[cyan]━━━ Analyzing {year1} ━━━[/]")
    args_year1 = argparse.Namespace(**vars(args))
    args_year1.year = year1
    args_year1.share = False  # Don't upload individual years yet
    export_path1 = export_command(args_year1)

    if not export_path1:
        console.print(f"[red]✗[/] Failed to export {year1}")
        sys.exit(1)

    # Temporarily suppress sharing for individual analysis
    stats1 = {}
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
        transient=True,
    ) as progress:
        load_task = progress.add_task(f"Loading {year1} export data...", total=1)
        data1 = ExportLoader.load(export_path1)
        progress.update(load_task, advance=1)

        analyzer = RawStatisticsAnalyzer(ghost_timeline_days=args.ghost_timeline)
        stats1 = analyzer.analyze(data1)

    console.print(f"[green]✓[/] {year1} analysis complete\n")

    # Export and analyze year 2
    console.print(f"[cyan]━━━ Analyzing {year2} ━━━[/]")
    args_year2 = argparse.Namespace(**vars(args))
    args_year2.year = year2
    args_year2.share = False
    export_path2 = export_command(args_year2)

    if not export_path2:
        console.print(f"[red]✗[/] Failed to export {year2}")
        sys.exit(1)

    stats2 = {}
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
        transient=True,
    ) as progress:
        load_task = progress.add_task(f"Loading {year2} export data...", total=1)
        data2 = ExportLoader.load(export_path2)
        progress.update(load_task, advance=1)

        analyzer = RawStatisticsAnalyzer(ghost_timeline_days=args.ghost_timeline)
        stats2 = analyzer.analyze(data2)

    console.print(f"[green]✓[/] {year2} analysis complete\n")

    # Sanitize statistics for both years
    from .utils import sanitize_statistics_for_export

    # Keep original statistics for hydration
    original_stats1 = {"raw": stats1}
    original_stats2 = {"raw": stats2}
    sanitized_stats1 = sanitize_statistics_for_export(original_stats1)
    sanitized_stats2 = sanitize_statistics_for_export(original_stats2)

    # Upload comparison
    console.print("[cyan]━━━ Creating comparison view ━━━[/]")
    from .uploader import ComparisonUploader

    server_url = "http://localhost:3000" if args.dev else args.server_url
    uploader = ComparisonUploader(base_url=server_url)

    user_name1 = data1.user_name if hasattr(data1, "user_name") else None
    user_name2 = data2.user_name if hasattr(data2, "user_name") else None
    user_name = user_name1 or user_name2  # Use whichever is available

    with_contacts = getattr(args, "with_contacts", False)

    comparison_url = uploader.upload_comparison(
        year1,
        year2,
        sanitized_stats1,
        sanitized_stats2,
        user_name=user_name,
        original_statistics1=original_stats1,
        original_statistics2=original_stats2,
        with_contacts=with_contacts,
    )

    if not comparison_url:
        console.print("\n[yellow]Tip: Make sure the web server is running:[/]")
        console.print("[dim]  cd web && npm install && npm run dev[/]")


def main():
    args = parse_args()

    if args.debug:
        logging.basicConfig(
            level=logging.DEBUG, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        logger.debug("Debug logging enabled")

    # Handle comparison mode
    if args.compare:
        compare_command(args)
        return

    if args.input:
        analyze_command(args)
    else:
        export_path = export_command(args)
        if export_path and not args.no_analyze:
            analyze_command(args, input_path=export_path)


if __name__ == "__main__":
    main()
