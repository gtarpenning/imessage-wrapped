import json
import threading
import time
from typing import Optional

import requests
from rich.console import Console
from rich.panel import Panel
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn

from .metadata import collect_metadata
from .utils import extract_hydrated_contact_data

API_BASE_URL = "https://imessage-wrapped.fly.dev"


class StatsUploader:
    def __init__(self, base_url: str = API_BASE_URL):
        self.base_url = base_url.rstrip("/")
        self.console = Console()

    def upload(
        self,
        year: int,
        statistics: dict,
        user_name: Optional[str] = None,
        original_statistics: Optional[dict] = None,
        with_contacts: bool = False,
    ) -> Optional[str]:
        """
        Upload statistics to web server.

        Args:
            year: The year of the statistics
            statistics: The sanitized statistics (PII removed)
            user_name: Optional user name
            original_statistics: Optional original unsanitized statistics for hydration
            with_contacts: If True, include contact names for unlocking

        Returns:
            shareable URL or None if failed.
        """
        try:
            # Collect system metadata (include user_name for fingerprinting)
            # Only generate unlock_code if with_contacts is True
            metadata = {}
            try:
                metadata = collect_metadata(user_name, with_contacts=with_contacts)
            except Exception:
                # Never fail on metadata collection
                pass

            # Extract hydrated contact data from original statistics if with_contacts is enabled
            hydrated_data = None
            if with_contacts and original_statistics:
                try:
                    hydrated_data = extract_hydrated_contact_data(original_statistics)
                except Exception as e:
                    self.console.print(
                        f"[yellow]⚠️  Warning: Could not extract hydrated data: {e}[/]"
                    )

            payload = {"year": year, "statistics": statistics, "metadata": metadata}
            if user_name:
                payload["user_name"] = user_name
            if hydrated_data:
                payload["hydrated_data"] = hydrated_data
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
                unlock_code = metadata.get("unlock_code")
                message = (
                    f"[bold green]View the full analysis at this link[/]\n\n"
                    f"[cyan]🔗 {share_url}[/]\n\n"
                    f"Copy and share your imessage wrapped with friends!"
                )
                if unlock_code:
                    message += (
                        f"\n\n[bold yellow]🔐 Unlock Code: {unlock_code}[/]\n"
                        f"[dim]Use this code to view contact names in your wrapped[/]"
                    )

                self.console.print(
                    Panel.fit(
                        message,
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


class ComparisonUploader:
    def __init__(self, base_url: str = API_BASE_URL):
        self.base_url = base_url.rstrip("/")
        self.console = Console()

    def upload_comparison(
        self,
        year1: int,
        year2: int,
        statistics1: dict,
        statistics2: dict,
        user_name: Optional[str] = None,
        original_statistics1: Optional[dict] = None,
        original_statistics2: Optional[dict] = None,
        with_contacts: bool = False,
    ) -> Optional[str]:
        """
        Upload comparison statistics to web server.

        Args:
            year1: First year
            year2: Second year
            statistics1: Sanitized statistics for year1
            statistics2: Sanitized statistics for year2
            user_name: Optional user name
            original_statistics1: Optional original unsanitized statistics for year1
            original_statistics2: Optional original unsanitized statistics for year2
            with_contacts: If True, include contact names for unlocking

        Returns:
            shareable comparison URL or None if failed.
        """
        try:
            # Collect system metadata (include user_name for fingerprinting)
            # Only generate unlock_code if with_contacts is True
            metadata = {}
            try:
                metadata = collect_metadata(user_name, with_contacts=with_contacts)
            except Exception:
                # Never fail on metadata collection
                pass

            # Extract hydrated contact data from original statistics if with_contacts is enabled
            hydrated_data1 = None
            hydrated_data2 = None
            if with_contacts and original_statistics1:
                try:
                    hydrated_data1 = extract_hydrated_contact_data(original_statistics1)
                except Exception:
                    pass
            if with_contacts and original_statistics2:
                try:
                    hydrated_data2 = extract_hydrated_contact_data(original_statistics2)
                except Exception:
                    pass

            payload = {
                "type": "comparison",
                "year1": year1,
                "year2": year2,
                "statistics1": statistics1,
                "statistics2": statistics2,
                "metadata": metadata,
            }
            if user_name:
                payload["user_name"] = user_name
            if hydrated_data1:
                payload["hydrated_data1"] = hydrated_data1
            if hydrated_data2:
                payload["hydrated_data2"] = hydrated_data2

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
                    "[cyan]📤 Uploading comparison...",
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
                        timeout=60,  # Longer timeout for comparisons
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
                unlock_code = metadata.get("unlock_code")
                message = (
                    f"[bold green]View your year-over-year comparison![/]\n\n"
                    f"[cyan]🔗 {share_url}[/]\n\n"
                    f"See how your messaging evolved from {year1} to {year2}!"
                )
                if unlock_code:
                    message += (
                        f"\n\n[bold yellow]🔐 Unlock Code: {unlock_code}[/]\n"
                        f"[dim]Use this code to view contact names in your comparison[/]"
                    )

                self.console.print(
                    Panel.fit(
                        message,
                        title=f"{year1} vs {year2} Comparison",
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
