"""
iMessage Wrapped - macOS Menu Bar App

A simple, elegant menu bar app that analyzes your iMessage history
and creates a beautiful shareable wrapped.
"""

import logging
import subprocess
import sys
import threading
import webbrowser
from datetime import datetime
from pathlib import Path

import rumps

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from imessage_wrapped import (
    ExportLoader,
    MessageService,
    RawStatisticsAnalyzer,
)
from imessage_wrapped.metadata import collect_metadata
from imessage_wrapped.uploader import StatsUploader
from imessage_wrapped.utils import sanitize_statistics_for_export


def setup_logging():
    """Setup logging to file"""
    logs_dir = Path.home() / ".imessage_wrapped" / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)

    log_file = logs_dir / f"app_{datetime.now().strftime('%Y%m%d')}.log"

    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s - %(levelname)s - %(message)s",
        handlers=[logging.FileHandler(log_file), logging.StreamHandler()],
    )

    return log_file


class IMessageWrappedApp(rumps.App):
    def __init__(self):
        super().__init__("💌", quit_button=None)

        self.log_file = setup_logging()
        self.logger = logging.getLogger(__name__)
        self.logger.info("iMessage Wrapped app started")

        self.copy_link_item = rumps.MenuItem("Copy link", callback=self.copy_link)
        self.copy_link_item.set_callback(self.copy_link)

        self.copy_unlock_code_item = rumps.MenuItem(
            "Copy unlock code", callback=self.copy_unlock_code
        )
        self.copy_unlock_code_item.set_callback(self.copy_unlock_code)

        self.view_logs_item = rumps.MenuItem("View logs", callback=self.view_logs)
        self.view_logs_item.set_callback(self.view_logs)

        self.menu = [
            rumps.MenuItem("Analyze my messages", callback=self.analyze_messages),
            rumps.MenuItem("Analyze with contacts", callback=self.analyze_with_contacts),
            rumps.separator,
            self.copy_link_item,
            self.copy_unlock_code_item,
            self.view_logs_item,
            rumps.separator,
            rumps.MenuItem("About", callback=self.show_about),
            rumps.MenuItem("Quit", callback=rumps.quit_application),
        ]

        self.running = False
        self.current_url = None
        self.unlock_code = None
        self.has_error = False

        self._update_menu_states()

    def _update_menu_states(self):
        """Update menu item enabled/disabled states"""
        if self.current_url:
            self.copy_link_item.title = "📋 Copy link"
            self.copy_link_item.set_callback(self.copy_link)
        else:
            self.copy_link_item.title = "📋 Copy link (not available)"
            self.copy_link_item.set_callback(None)

        if self.unlock_code:
            self.copy_unlock_code_item.title = f"🔐 Copy unlock code ({self.unlock_code})"
            self.copy_unlock_code_item.set_callback(self.copy_unlock_code)
        else:
            self.copy_unlock_code_item.title = "🔐 Copy unlock code (not available)"
            self.copy_unlock_code_item.set_callback(None)

        if self.has_error:
            self.view_logs_item.title = "📄 View logs"
            self.view_logs_item.set_callback(self.view_logs)
        else:
            self.view_logs_item.title = "📄 View logs (no errors)"
            self.view_logs_item.set_callback(None)

    @rumps.clicked("Copy unlock code")
    def copy_unlock_code(self, _):
        """Copy the unlock code to clipboard"""
        if self.unlock_code:
            subprocess.run("pbcopy", text=True, input=self.unlock_code)
            rumps.notification(
                title="Copied!",
                subtitle="Unlock code copied to clipboard",
                message=f"Code: {self.unlock_code}",
            )

    @rumps.clicked("Copy link")
    def copy_link(self, _):
        """Copy the generated URL to clipboard"""
        if not self.current_url:
            return

        subprocess.run(["pbcopy"], input=self.current_url.encode("utf-8"))
        rumps.notification(
            title="Link copied! 📋", subtitle="Link copied to clipboard", message=self.current_url
        )
        self.logger.info(f"Copied link to clipboard: {self.current_url}")

    @rumps.clicked("View logs")
    def view_logs(self, _):
        """Open the log file"""
        if not self.has_error:
            return

        subprocess.run(["open", "-a", "Console", str(self.log_file)])
        self.logger.info(f"Opened log file: {self.log_file}")

    @rumps.clicked("Analyze my messages")
    def analyze_messages(self, _):
        """Start the analysis process without contacts"""
        if self.running:
            rumps.alert("Already running", "Please wait for the current analysis to complete")
            return

        self.logger.info("Starting message analysis")

        if not self.check_permissions():
            self.logger.warning("Permission check failed")
            return

        self.running = True
        self.title = "⏳"

        thread = threading.Thread(target=self._run_analysis, args=(False,), daemon=True)
        thread.start()

    @rumps.clicked("Analyze with contacts")
    def analyze_with_contacts(self, _):
        """Start the analysis process with contact names"""
        if self.running:
            rumps.alert("Already running", "Please wait for the current analysis to complete")
            return

        self.logger.info("Starting message analysis with contacts")

        if not self.check_permissions():
            self.logger.warning("Permission check failed")
            return

        self.running = True
        self.title = "⏳"

        thread = threading.Thread(target=self._run_analysis, args=(True,), daemon=True)
        thread.start()

    def _reset_icon(self):
        """Reset icon back to heart"""
        self.title = "💌"

    def check_permissions(self):
        """Check if we have Full Disk Access"""
        db_path = Path.home() / "Library" / "Messages" / "chat.db"

        try:
            with open(db_path, "rb") as f:
                f.read(1)
            self.logger.info("Permission check passed")
            return True
        except (FileNotFoundError, PermissionError) as e:
            self.logger.error(f"Permission check failed: {str(e)}")
            self.has_error = True
            self._update_menu_states()

            rumps.alert(
                title="Permission Required",
                message="iMessage Wrapped needs Full Disk Access to read your messages.\n\n"
                "1. Open System Settings\n"
                "2. Go to Privacy & Security → Full Disk Access\n"
                "3. Add this app and toggle it ON\n"
                "4. Restart the app",
                ok="Open System Settings",
                cancel="Cancel",
            )
            subprocess.run(
                ["open", "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"]
            )
            return False

    def _run_analysis(self, with_contacts=False):
        """Run the analysis in background thread

        Args:
            with_contacts: If True, include contact names for unlocking
        """
        try:
            self.logger.info("Starting analysis process")
            year = 2025
            exports_dir = Path("exports")
            exports_dir.mkdir(exist_ok=True)

            export_path = exports_dir / f"imessage_export_{year}.jsonl"
            self.logger.info(f"Export path: {export_path}")

            if not export_path.exists():
                self.logger.info("Export doesn't exist, creating new export")
                notification_msg = "This may take a minute"
                if with_contacts:
                    notification_msg += " (including contacts)"

                rumps.notification(
                    title="Exporting messages",
                    subtitle="Reading iMessage database...",
                    message=notification_msg,
                )

                service = MessageService(with_contacts=with_contacts)
                data = service.export_year(year)
                self.logger.info(f"Exported {len(data.conversations)} conversations")

                from imessage_wrapped.exporter import Exporter, JSONLSerializer

                exporter = Exporter(serializer=JSONLSerializer())
                exporter.export_to_file(data, str(export_path))
                self.logger.info("Export saved to file")
            else:
                self.logger.info("Using existing export")

            rumps.notification(
                title="Analyzing", subtitle="Computing statistics...", message="Almost done!"
            )

            data = ExportLoader.load(export_path)
            self.logger.info("Export loaded successfully")

            analyzer = RawStatisticsAnalyzer()
            statistics = {"raw": analyzer.analyze(data)}
            original_statistics = statistics  # Keep original for hydration
            sanitized_statistics = sanitize_statistics_for_export(statistics)
            self.logger.info("Statistics computed")

            rumps.notification(
                title="Uploading", subtitle="Creating shareable link...", message="Final step"
            )

            # Collect metadata to get unlock code (only if with_contacts is enabled)
            user_name = data.user_name if hasattr(data, "user_name") else None
            metadata = collect_metadata(user_name, with_contacts=with_contacts)
            unlock_code = metadata.get("unlock_code")

            uploader = StatsUploader(base_url="https://imessage-wrapped.fly.dev")
            share_url = uploader.upload(
                year,
                sanitized_statistics,
                user_name=user_name,
                original_statistics=original_statistics,
                with_contacts=with_contacts,
            )

            if share_url:
                self.logger.info(f"Upload successful: {share_url}")
                self.current_url = share_url
                # Only set unlock code if with_contacts was enabled
                self.unlock_code = unlock_code if with_contacts else None
                self._update_menu_states()

                notification_message = "Click 'Copy Link' to share!"
                if with_contacts and unlock_code:
                    notification_message += f"\nUnlock code: {unlock_code}"

                rumps.notification(
                    title="Success! 🎉",
                    subtitle="Your wrapped is ready",
                    message=notification_message,
                )

                webbrowser.open(share_url)
                self.title = "✅"
            else:
                error_msg = "Upload failed - no URL returned"
                self.logger.error(error_msg)
                self.has_error = True
                self._update_menu_states()

                rumps.alert(
                    "Upload failed",
                    "Could not create shareable link. Check your internet connection.\n\nView logs for more details.",
                )
                self.title = "❌"

        except PermissionError as e:
            error_msg = f"Permission denied: {str(e)}"
            self.logger.error(error_msg, exc_info=True)
            self.has_error = True
            self._update_menu_states()

            rumps.alert(
                "Permission denied",
                "Please grant Full Disk Access in System Settings.\n\nView logs for more details.",
            )
            self.title = "❌"

        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            self.logger.error(error_msg, exc_info=True)
            self.has_error = True
            self._update_menu_states()

            rumps.alert("Error", f"An error occurred: {str(e)}\n\nView logs for more details.")
            self.title = "❌"

        finally:
            self.running = False
            self.logger.info("Analysis process completed")
            threading.Timer(2.0, self._reset_icon).start()

    @rumps.clicked("About")
    def show_about(self, _):
        rumps.alert(
            title="iMessage Wrapped",
            message="Version 1.1.5\n\n"
            "Your year in messages, visualized.\n\n"
            "Only anonymized statistics are uploaded.\n\n"
            "Created by Griffin and Zubin.\n\n"
            "https://imessage-wrapped.fly.dev\n"
            "https://github.com/gtarpenning/imessage-wrapped",
        )


def main():
    app = IMessageWrappedApp()
    app.run()


if __name__ == "__main__":
    main()
