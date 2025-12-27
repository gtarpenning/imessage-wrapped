import json
import threading
import time
from typing import Optional

import requests
from rich.console import Console
from rich.panel import Panel
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn

API_BASE_URL = "https://imessage-wrapped.fly.dev"


class StatsUploader:
    def __init__(self, base_url: str = API_BASE_URL):
        self.base_url = base_url.rstrip("/")
        self.console = Console()

    def upload(self, year: int, statistics: dict) -> Optional[str]:
        """
        Upload statistics to web server.
        Returns shareable URL or None if failed.
        """
        try:
            payload = {"year": year, "statistics": statistics}
            payload_size = len(json.dumps(payload).encode("utf-8"))

            progress_complete = threading.Event()
            response = None

            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                TextColumn("({task.completed}/{task.total} bytes)"),
                console=self.console,
            ) as progress:
                task = progress.add_task(
                    "[cyan]📤 Uploading to server...",
                    total=payload_size,
                )

                def update_progress():
                    while not progress_complete.is_set():
                        if progress_complete.wait(timeout=0.1):
                            break
                        current = progress.tasks[task].completed
                        if current < payload_size:
                            increment = max(1, payload_size // 100)
                            new_value = min(current + increment, payload_size)
                            progress.update(task, completed=new_value)
                        time.sleep(0.05)

                progress_thread = threading.Thread(target=update_progress, daemon=True)
                progress_thread.start()

                try:
                    response = requests.post(
                        f"{self.base_url}/api/upload",
                        json=payload,
                        timeout=30,
                        headers={"Content-Type": "application/json"},
                    )
                finally:
                    progress.update(task, completed=payload_size)
                    progress_complete.set()
                    progress_thread.join(timeout=0.5)

            if not response:
                return None

            if response.status_code == 429:
                self.console.print("[red]❌ Rate limit exceeded. Try again in an hour.[/]")
                return None

            response.raise_for_status()
            data = response.json()

            share_url = data.get("url")

            if share_url:
                self.console.print()
                self.console.print(
                    Panel.fit(
                        f"[bold green]View the full analysis at this link[/]\n\n"
                        f"[cyan]🔗 {share_url}[/]\n\n"
                        f"Copy and share your imessage wrapped with friends!",
                        title="Share Your Wrapped",
                        border_style="green",
                    )
                )
                self.console.print()

            return share_url

        except requests.Timeout:
            self.console.print("[red]❌ Upload timed out. Is the server running?[/]")
            return None
        except requests.ConnectionError:
            self.console.print(f"[red]❌ Could not connect to {self.base_url}[/]")
            self.console.print("[yellow]Make sure the web server is running.[/]")
            return None
        except requests.RequestException as e:
            self.console.print(f"[red]❌ Upload failed: {e}[/]")
            return None
        except Exception as e:
            self.console.print(f"[red]❌ Unexpected error: {e}[/]")
            return None
