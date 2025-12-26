import requests
from typing import Optional
from rich.console import Console
from rich.panel import Panel

API_BASE_URL = "https://imessage-wrapped.fly.dev"

class StatsUploader:
    def __init__(self, base_url: str = API_BASE_URL):
        self.base_url = base_url.rstrip('/')
        self.console = Console()
    
    def upload(self, year: int, statistics: dict) -> Optional[str]:
        """
        Upload statistics to web server.
        Returns shareable URL or None if failed.
        """
        try:
            self.console.print("[cyan]📤 Uploading to server...[/]")
            
            response = requests.post(
                f"{self.base_url}/api/upload",
                json={
                    "year": year,
                    "statistics": statistics
                },
                timeout=30,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 429:
                self.console.print("[red]❌ Rate limit exceeded. Try again in an hour.[/]")
                return None
            
            response.raise_for_status()
            data = response.json()
            
            share_url = data.get("url")
            
            if share_url:
                self.console.print()
                self.console.print(Panel.fit(
                    f"[bold green]✓ Shareable link created![/]\n\n"
                    f"[cyan]🔗 {share_url}[/]\n\n"
                    f"Copy this link to share your Wrapped with friends!",
                    title="Share Your Wrapped",
                    border_style="green"
                ))
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

