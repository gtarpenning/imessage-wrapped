from typing import Any

from rich.columns import Columns
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from .base import Display


class TerminalDisplay(Display):
    def __init__(self):
        self.console = Console()

    def render(self, statistics: dict[str, Any], brief: bool = False) -> None:
        if brief:
            self.render_brief(statistics)
        else:
            self.console.print()
            self._render_header(statistics)

            if "raw" in statistics:
                self._render_raw_statistics(statistics["raw"])

            if "nlp" in statistics:
                self._render_stub_section("NLP Analysis", statistics["nlp"])

            if "llm" in statistics:
                self._render_stub_section("LLM Analysis", statistics["llm"])

            self.console.print()

    def render_brief(self, statistics: dict[str, Any]) -> None:
        self.console.print()

        if "raw" not in statistics:
            return

        stats = statistics["raw"]
        volume = stats.get("volume", {})
        contacts = stats.get("contacts", {})
        content = stats.get("content", {})

        title = Text("Your iMessage Year in Review (Summary)", style="bold magenta")
        self.console.print(Panel(title, border_style="magenta"))

        table = Table(show_header=False, box=None, padding=(0, 2))
        table.add_column("", style="dim", width=25)
        table.add_column("", style="bold cyan")

        table.add_row("📊 Total Messages", f"{volume.get('total_messages', 0):,}")
        table.add_row("💬 Messages Sent", f"{volume.get('total_sent', 0):,}")
        table.add_row("📥 Messages Received", f"{volume.get('total_received', 0):,}")

        top_contacts = contacts.get("top_sent_to", [])
        if top_contacts:
            top_contact = top_contacts[0]
            table.add_row(
                "👤 Top Contact", f"{top_contact['name']} ({top_contact['count']:,} msgs)"
            )

        emojis = content.get("most_used_emojis", [])
        if emojis:
            top_emoji = emojis[0]
            table.add_row(
                "😊 Favorite Emoji", f"{top_emoji['emoji']} ({top_emoji['count']:,} times)"
            )

        self.console.print(table)
        self.console.print()

    def _render_header(self, statistics: dict[str, Any]) -> None:
        title = Text("iMessage Year in Review 2025", style="bold magenta")
        self.console.print(Panel(title, border_style="magenta"))

    def _render_raw_statistics(self, stats: dict[str, Any]) -> None:
        self._render_volume_section(stats.get("volume", {}))
        self._render_temporal_section(stats.get("temporal", {}))
        self._render_streaks_section(stats.get("streaks", {}))
        self._render_contacts_section(stats.get("contacts", {}))
        self._render_content_section(stats.get("content", {}))
        self._render_conversations_section(stats.get("conversations", {}))
        self._render_response_times_section(stats.get("response_times", {}))
        self._render_tapbacks_section(stats.get("tapbacks", {}))

    def _render_volume_section(self, volume: dict[str, Any]) -> None:
        self.console.print("\n[bold cyan]📊 Volume & Activity[/]")

        table = Table(show_header=False, box=None, padding=(0, 2))
        table.add_column("Metric", style="dim")
        table.add_column("Value", style="green")

        table.add_row("Total Messages", f"{volume.get('total_messages', 0):,}")
        table.add_row("Messages Sent", f"{volume.get('total_sent', 0):,}")
        table.add_row("Messages Received", f"{volume.get('total_received', 0):,}")
        table.add_row("Active Days", f"{volume.get('active_days', 0):,}")

        busiest = volume.get("busiest_day", {})
        if busiest.get("date"):
            table.add_row("Busiest Day", f"{busiest['date']} ({busiest['total']:,} messages)")

        table.add_row("Most Sent in One Day", f"{volume.get('most_sent_in_day', 0):,}")
        table.add_row("Most Received in One Day", f"{volume.get('most_received_in_day', 0):,}")

        self.console.print(table)

    def _render_temporal_section(self, temporal: dict[str, Any]) -> None:
        self.console.print("\n[bold cyan]⏰ Temporal Patterns[/]")

        table = Table(show_header=False, box=None, padding=(0, 2))
        table.add_column("Metric", style="dim")
        table.add_column("Value", style="yellow")

        busiest_hour = temporal.get("busiest_hour", (None, 0))
        if busiest_hour[0] is not None:
            hour_12 = busiest_hour[0] % 12 or 12
            am_pm = "AM" if busiest_hour[0] < 12 else "PM"
            table.add_row("Busiest Hour", f"{hour_12}:00 {am_pm} ({busiest_hour[1]:,} messages)")

        day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        busiest_day = temporal.get("busiest_day_of_week", (None, 0))
        if busiest_day[0] is not None:
            table.add_row(
                "Busiest Day of Week", f"{day_names[busiest_day[0]]} ({busiest_day[1]:,} messages)"
            )

        self.console.print(table)

    def _render_streaks_section(self, streaks: dict[str, Any]) -> None:
        if streaks.get("longest_streak_days", 0) == 0:
            return

        self.console.print("\n[bold cyan]🔥 Streaks[/]")

        table = Table(show_header=False, box=None, padding=(0, 2))
        table.add_column("Metric", style="dim")
        table.add_column("Value", style="yellow")

        streak_days = streaks.get("longest_streak_days", 0)
        streak_contact = streaks.get("longest_streak_contact", "Unknown")
        table.add_row("Longest Streak", f"{streak_days} days with {streak_contact}")

        self.console.print(table)

    def _render_contacts_section(self, contacts: dict[str, Any]) -> None:
        self.console.print("\n[bold cyan]👥 Top Contacts[/]")

        top_sent = contacts.get("top_sent_to", [])[:5]
        top_received = contacts.get("top_received_from", [])[:5]

        if top_sent:
            self.console.print("\n[bold]Most Messaged:[/]")
            table = Table(show_header=False, box=None, padding=(0, 2))
            table.add_column("Rank", style="dim", width=4)
            table.add_column("Contact", style="cyan")
            table.add_column("Count", style="green", justify="right")

            for i, contact in enumerate(top_sent, 1):
                table.add_row(f"{i}.", contact["name"], f"{contact['count']:,}")

            self.console.print(table)

        if top_received:
            self.console.print("\n[bold]Most Received From:[/]")
            table = Table(show_header=False, box=None, padding=(0, 2))
            table.add_column("Rank", style="dim", width=4)
            table.add_column("Contact", style="cyan")
            table.add_column("Count", style="green", justify="right")

            for i, contact in enumerate(top_received, 1):
                table.add_row(f"{i}.", contact["name"], f"{contact['count']:,}")

            self.console.print(table)

        table = Table(show_header=False, box=None, padding=(0, 2))
        table.add_column("Metric", style="dim")
        table.add_column("Value", style="magenta")

        table.add_row("Unique Contacts Messaged", f"{contacts.get('unique_contacts_messaged', 0)}")
        table.add_row(
            "Unique Contacts Received From", f"{contacts.get('unique_contacts_received_from', 0)}"
        )

        butterfly = contacts.get("social_butterfly_day", {})
        if butterfly.get("date"):
            table.add_row(
                "Social Butterfly Day",
                f"{butterfly['date']} ({butterfly['unique_contacts']} people)",
            )

        fan_club = contacts.get("fan_club_day", {})
        if fan_club.get("date"):
            table.add_row(
                "Fan Club Day", f"{fan_club['date']} ({fan_club['unique_contacts']} people)"
            )

        self.console.print()
        self.console.print(table)

    def _render_content_section(self, content: dict[str, Any]) -> None:
        self.console.print("\n[bold cyan]💬 Message Content[/]")

        table = Table(show_header=False, box=None, padding=(0, 2))
        table.add_column("Metric", style="dim")
        table.add_column("Value", style="blue")

        table.add_row(
            "Avg Message Length (Sent)", f"{content.get('avg_message_length_sent', 0)} chars"
        )
        table.add_row(
            "Avg Message Length (Received)",
            f"{content.get('avg_message_length_received', 0)} chars",
        )
        table.add_row("Questions Asked", f"{content.get('questions_percentage', 0)}%")
        table.add_row("Enthusiasm Level", f"{content.get('enthusiasm_percentage', 0)}%")
        table.add_row("Attachments Sent", f"{content.get('attachments_sent', 0):,}")
        table.add_row("Attachments Received", f"{content.get('attachments_received', 0):,}")
        table.add_row(
            "Double Text Count",
            f"{content.get('double_text_count', 0):,} ({content.get('double_text_percentage', 0)}%)",
        )

        self.console.print(table)

        emojis = content.get("most_used_emojis", [])[:5]
        if emojis:
            self.console.print("\n[bold]Most Used Emojis:[/]")
            emoji_texts = [Text(f"{e['emoji']} {e['count']:,}", style="yellow") for e in emojis]
            self.console.print(Columns(emoji_texts, padding=(0, 3)))

    def _render_conversations_section(self, conversations: dict[str, Any]) -> None:
        self.console.print("\n[bold cyan]💭 Conversations[/]")

        table = Table(show_header=False, box=None, padding=(0, 2))
        table.add_column("Metric", style="dim")
        table.add_column("Value", style="cyan")

        table.add_row("Total Conversations", f"{conversations.get('total_conversations', 0):,}")
        table.add_row("Group Chats", f"{conversations.get('group_chats', 0):,}")
        table.add_row("1-on-1 Chats", f"{conversations.get('one_on_one_chats', 0):,}")

        ratio = conversations.get("group_vs_1on1_ratio", {})
        table.add_row(
            "Group vs 1:1",
            f"{ratio.get('group_percentage', 0)}% / {ratio.get('one_on_one_percentage', 0)}%",
        )

        most_active = conversations.get("most_active_thread", {})
        if most_active.get("name"):
            chat_type = "Group" if most_active.get("is_group") else "1:1"
            table.add_row(
                "Most Active Thread",
                f"{most_active['name']} ({most_active['message_count']:,} msgs, {chat_type})",
            )

        most_active_group = conversations.get("most_active_group_chat")
        if most_active_group and most_active_group.get("name"):
            table.add_row(
                "Most Active Group",
                f"{most_active_group['name']} ({most_active_group['message_count']:,} msgs)",
            )

        self.console.print(table)

    def _render_response_times_section(self, response_times: dict[str, Any]) -> None:
        if (
            response_times.get("total_responses_you", 0) == 0
            and response_times.get("total_responses_them", 0) == 0
        ):
            return

        self.console.print("\n[bold cyan]⚡ Response Times[/]")

        table = Table(show_header=False, box=None, padding=(0, 2))
        table.add_column("Metric", style="dim")
        table.add_column("Value", style="green")

        if response_times.get("total_responses_you", 0) > 0:
            table.add_row(
                "Your Median Response Time",
                response_times.get("median_response_time_you_formatted", "N/A"),
            )

        if response_times.get("total_responses_them", 0) > 0:
            table.add_row(
                "Their Median Response Time",
                response_times.get("median_response_time_them_formatted", "N/A"),
            )

        self.console.print(table)

    def _render_tapbacks_section(self, tapbacks: dict[str, Any]) -> None:
        if (
            tapbacks.get("total_tapbacks_given", 0) == 0
            and tapbacks.get("total_tapbacks_received", 0) == 0
        ):
            return

        self.console.print("\n[bold cyan]❤️ Reactions & Tapbacks[/]")

        table = Table(show_header=False, box=None, padding=(0, 2))
        table.add_column("Metric", style="dim")
        table.add_column("Value", style="red")

        table.add_row("Total Tapbacks Given", f"{tapbacks.get('total_tapbacks_given', 0):,}")
        table.add_row("Total Tapbacks Received", f"{tapbacks.get('total_tapbacks_received', 0):,}")

        fav = tapbacks.get("favorite_tapback", (None, 0))
        if fav[0]:
            table.add_row("Your Favorite Reaction", f"{fav[0]} ({fav[1]:,} times)")

        most_received = tapbacks.get("most_received_tapback", (None, 0))
        if most_received[0]:
            table.add_row(
                "Most Received Reaction", f"{most_received[0]} ({most_received[1]:,} times)"
            )

        self.console.print(table)

    def _render_stub_section(self, title: str, stub_data: dict[str, Any]) -> None:
        self.console.print(f"\n[bold cyan]{title}[/]")

        if stub_data.get("status") == "not_implemented":
            self.console.print(f"[dim]{stub_data.get('message', 'Not yet implemented')}[/]")
