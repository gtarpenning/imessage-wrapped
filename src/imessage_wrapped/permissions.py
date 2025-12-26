import os
import sqlite3

from rich.console import Console
from rich.panel import Panel

DEFAULT_DB_PATH = "~/Library/Messages/chat.db"


class PermissionError(Exception):
    pass


def check_database_access(db_path: str | None = None) -> bool:
    path = db_path or os.path.expanduser(DEFAULT_DB_PATH)

    try:
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        conn.execute("SELECT 1 FROM message LIMIT 1")
        conn.close()
        return True
    except (sqlite3.OperationalError, sqlite3.DatabaseError):
        return False


def require_database_access(db_path: str | None = None) -> None:
    if not check_database_access(db_path):
        display_permission_error()
        raise PermissionError("Full Disk Access required to read iMessage database")


def display_permission_error() -> None:
    console = Console()
    console.print(
        Panel(
            "[bold red]Full Disk Access Required[/]\n\n"
            "This application needs permission to read your iMessage database.\n\n"
            "[bold]To grant access:[/]\n"
            "1. Open [cyan]System Settings[/]\n"
            "2. Go to [cyan]Privacy & Security → Full Disk Access[/]\n"
            "3. Click [cyan]+[/] and add this application or Terminal\n"
            "4. Restart the application",
            title="⚠️  Permission Error",
        )
    )
