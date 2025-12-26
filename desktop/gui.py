"""
iMessage Wrapped - macOS Menu Bar App

A simple, elegant menu bar app that analyzes your iMessage history
and creates a beautiful shareable wrapped.
"""
import rumps
import threading
import webbrowser
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from imessage_wrapped import (
    MessageService,
    ExportLoader,
    RawStatisticsAnalyzer,
)
from imessage_wrapped.uploader import StatsUploader


class iMessageWrappedApp(rumps.App):
    def __init__(self):
        super().__init__(
            "💌",
            quit_button=None
        )
        
        self.menu = [
            rumps.MenuItem("Analyze My Messages", callback=self.analyze_messages),
            rumps.separator,
            rumps.MenuItem("About", callback=self.show_about),
            rumps.MenuItem("Quit", callback=rumps.quit_application)
        ]
        
        self.running = False
    
    @rumps.clicked("Analyze My Messages")
    def analyze_messages(self, _):
        if self.running:
            rumps.alert("Already running", "Please wait for the current analysis to complete")
            return
        
        # Check permissions first
        if not self.check_permissions():
            return
        
        self.running = True
        self.title = "⏳"
        
        # Run in background thread
        thread = threading.Thread(target=self._run_analysis, daemon=True)
        thread.start()
    
    def _reset_icon(self):
        """Reset icon back to heart"""
        self.title = "💌"
    
    def check_permissions(self):
        """Check if we have Full Disk Access"""
        db_path = Path.home() / "Library" / "Messages" / "chat.db"
        
        try:
            with open(db_path, 'rb') as f:
                f.read(1)
            return True
        except (FileNotFoundError, PermissionError):
            rumps.alert(
                title="Permission Required",
                message="iMessage Wrapped needs Full Disk Access to read your messages.\n\n"
                       "1. Open System Settings\n"
                       "2. Go to Privacy & Security → Full Disk Access\n"
                       "3. Add this app and toggle it ON\n"
                       "4. Restart the app",
                ok="Open System Settings",
                cancel="Cancel"
            )
            # Open System Settings
            import subprocess
            subprocess.run([
                "open",
                "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"
            ])
            return False
    
    def _run_analysis(self):
        """Run the analysis in background thread"""
        try:
            year = datetime.now().year
            exports_dir = Path("exports")
            exports_dir.mkdir(exist_ok=True)
            
            export_path = exports_dir / f"imessage_export_{year}.jsonl"
            
            # Export or load
            if not export_path.exists():
                rumps.notification(
                    title="Exporting Messages",
                    subtitle="Reading iMessage database...",
                    message="This may take a minute"
                )
                
                service = MessageService()
                data = service.export_year(year)
                
                from imessage_wrapped.exporter import Exporter, JSONLSerializer
                exporter = Exporter(serializer=JSONLSerializer())
                exporter.export_to_file(data, str(export_path))
            
            # Analyze
            rumps.notification(
                title="Analyzing",
                subtitle="Computing statistics...",
                message="Almost done!"
            )
            
            data = ExportLoader.load(export_path)
            analyzer = RawStatisticsAnalyzer()
            statistics = {"raw": analyzer.analyze(data)}
            
            # Upload
            rumps.notification(
                title="Uploading",
                subtitle="Creating shareable link...",
                message="Final step"
            )
            
            uploader = StatsUploader(
                base_url="https://imessage-wrapped.fly.dev"
            )
            share_url = uploader.upload(year, statistics)
            
            if share_url:
                # Success!
                rumps.notification(
                    title="Success! 🎉",
                    subtitle="Your wrapped is ready",
                    message="Opening in browser..."
                )
                
                webbrowser.open(share_url)
                self.title = "✅"
            else:
                rumps.alert(
                    "Upload Failed",
                    "Could not create shareable link. Check your internet connection."
                )
                self.title = "❌"
        
        except PermissionError:
            rumps.alert(
                "Permission Denied",
                "Please grant Full Disk Access in System Settings"
            )
            self.title = "❌"
        
        except Exception as e:
            rumps.alert(
                "Error",
                f"An error occurred: {str(e)}"
            )
            self.title = "❌"
        
        finally:
            self.running = False
            threading.Timer(2.0, self._reset_icon).start()
    
    @rumps.clicked("About")
    def show_about(self, _):
        rumps.alert(
            title="iMessage Wrapped",
            message="Version 1.0.0\n\n"
                   "Your year in messages, beautifully visualized.\n\n"
                   "All data stays on your Mac.\n"
                   "Only anonymized statistics are uploaded.\n\n"
                   "https://imessage-wrapped.fly.dev"
        )


def main():
    app = iMessageWrappedApp()
    app.run()


if __name__ == "__main__":
    main()

