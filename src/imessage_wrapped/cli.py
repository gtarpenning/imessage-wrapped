import argparse
import logging
import sys
from datetime import datetime
from pathlib import Path

import questionary
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from . import (
    Exporter,
    ExportLoader,
    MessageService,
    PermissionError,
    RawStatisticsAnalyzer,
    TerminalDisplay,
    require_database_access,
)

logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(
        prog="imexport",
        description="Export and analyze iMessage conversations from macOS",
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
        help="Output file path for statistics JSON (optional)",
    )

    parser.add_argument(
        "-d",
        "--database",
        type=str,
        help="Path to chat.db (default: ~/Library/Messages/chat.db)",
    )

    parser.add_argument(
        "--skip-permission-check",
        action="store_true",
        help="Skip permission check",
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
        help="Web server URL for sharing",
    )

    parser.add_argument(
        "--dev",
        action="store_true",
        help="Use local development server (http://localhost:3000)",
    )

    return parser.parse_args()


def export_messages(args):
    console = Console()

    if not args.skip_permission_check:
        try:
            require_database_access(args.database)
        except PermissionError:
            sys.exit(1)

    output_path = f"exports/imessage_export_{args.year}.jsonl"
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

        from .exporter import JSONLSerializer

        exporter = Exporter(serializer=JSONLSerializer())
        exporter.export_to_file(data, output_path)

    console.print(
        f"\n[green]✓[/] Exported {data.total_messages} messages to [cyan]{output_path}[/]"
    )
    return output_path


def main():
    args = parse_args()

    if args.debug:
        logging.basicConfig(
            level=logging.DEBUG, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
        )
        logger.debug("Debug logging enabled")

    console = Console()

    exports_dir = Path("exports")
    export_files = []

    if exports_dir.exists():
        export_files = sorted(
            [f for f in exports_dir.iterdir() if f.suffix in [".json", ".jsonl"]],
            key=lambda x: x.stat().st_mtime,
            reverse=True,
        )

    if not export_files or args.replace_cache:
        console.print("[yellow]ℹ[/] Exporting messages...\n")
        export_path = export_messages(args)
        if export_path:
            export_files = [Path(export_path)]
        elif exports_dir.exists():
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
            choices.append(questionary.Choice(title=f"{file.name} ({size_mb:.1f} MB)", value=file))

        selected = questionary.select("Select export file to analyze:", choices=choices).ask()

        if selected is None:
            sys.exit(0)

        input_path = selected

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task("Loading export data...", total=None)

        try:
            data = ExportLoader.load(input_path)
        except Exception as e:
            console.print(f"[red]✗[/] Failed to load export data: {e}")
            sys.exit(1)

        progress.update(task, description=f"Analyzing {data.total_messages:,} messages...")

        analyzer = RawStatisticsAnalyzer()
        statistics = {"raw": analyzer.analyze(data)}

    if args.output:
        import json

        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(statistics, f, indent=2, ensure_ascii=False)
        console.print(f"\n[green]✓[/] Statistics saved to [cyan]{args.output}[/]")

    display = TerminalDisplay()
    display.render(statistics, brief=args.share)

    if args.share:
        from .uploader import StatsUploader

        server_url = "http://localhost:3000" if args.dev else args.server_url
        uploader = StatsUploader(base_url=server_url)

        year = data.year if hasattr(data, "year") else datetime.now().year
        share_url = uploader.upload(year, statistics)

        if not share_url:
            console.print("\n[yellow]Tip: Make sure the web server is running:[/]")
            console.print("[dim]  cd web && npm install && npm run dev[/]")


if __name__ == "__main__":
    main()
