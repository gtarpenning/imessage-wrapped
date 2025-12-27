from datetime import datetime
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
        self._render_ghosts_section(stats.get("ghosts", {}))
        self._render_cliffhangers_section(stats.get("cliffhangers"))

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

        self.console.print(table)

        self._render_weekday_weekend_breakdown(temporal)

    def _render_weekday_weekend_breakdown(self, temporal: dict[str, Any]) -> None:
        weekday_pct = temporal.get("weekday_percentage")
        weekend_pct = temporal.get("weekend_percentage")
        if weekday_pct is None or weekend_pct is None:
            return

        segments = 12
        filled_segments = int(round(segments * (weekday_pct / 100)))
        filled_segments = max(0, min(segments, filled_segments))
        characters = ["●" if i < filled_segments else "○" for i in range(segments)]
        characters = [
            f"[magenta]{char}[/]" if char == "●" else f"[dim]{char}[/]" for char in characters
        ]
        layout = [
            f"    {characters[0]} {characters[1]} {characters[2]} {characters[3]}    ",
            f"  {characters[11]}           {characters[4]}  ",
            f"  {characters[10]}           {characters[5]}  ",
            f"    {characters[9]} {characters[8]} {characters[7]} {characters[6]}    ",
        ]

        self.console.print("\n[bold]Weekday vs Weekend[/]")
        for line in layout:
            self.console.print(line)

        weekday_info = temporal.get("weekday_mvp") or {}
        weekend_info = temporal.get("weekend_mvp") or {}

        weekday_contact = weekday_info.get("contact") or "—"
        weekend_contact = weekend_info.get("contact") or "—"
        weekday_count = weekday_info.get("count")
        weekend_count = weekend_info.get("count")

        weekday_suffix = f" ({(weekday_count or 0):,} msgs)" if weekday_count is not None else ""
        weekend_suffix = f" ({(weekend_count or 0):,} msgs)" if weekend_count is not None else ""

        self.console.print(
            f"[bold magenta]Weekday Warrior:[/] {weekday_contact} — {weekday_pct:.1f}%{weekday_suffix}"
        )
        self.console.print(
            f"[bold cyan]Weekend MVP:[/] {weekend_contact} — {weekend_pct:.1f}%{weekend_suffix}"
        )

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

        distribution = contacts.get("message_distribution") or []
        if distribution:
            self.console.print("\n[bold]Chat Concentration[/]")
            max_rows = min(10, len(distribution))
            for entry in distribution[:max_rows]:
                share = entry.get("share", 0.0)
                bar = self._share_bar(share)
                self.console.print(f"{entry.get('rank', 0):>2}. {bar}")

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

        phrases = content.get("phrases")
        by_contact = content.get("_phrases_by_contact") or []
        if phrases:
            self._render_phrase_section(phrases, by_contact)

        sentiment = content.get("sentiment")
        if sentiment:
            self._render_sentiment_overview(sentiment)
            self._render_sentiment_periods(sentiment.get("periods"))

    def _render_phrase_section(
        self, phrases: dict[str, Any], by_contact: list[dict[str, Any]]
    ) -> None:
        overall = phrases.get("overall") or []
        if overall:
            self.console.print("\n[bold]Most Used Phrases:[/]")
            table = Table(show_header=True, header_style="bold green")
            table.add_column("Rank", style="dim", width=4)
            table.add_column("Phrase", style="white")
            table.add_column("Count", style="green", justify="right")

            for idx, phrase in enumerate(overall, start=1):
                label = phrase.get("phrase") or phrase.get("text") or "—"
                table.add_row(f"{idx}.", label, f"{phrase.get('occurrences', 0):,}")

        self.console.print(table)

        filtered = [entry for entry in by_contact if entry.get("top_phrases")]
        if filtered:
            self.console.print("\n[bold]Signature Lines by Contact:[/]")
            table = Table(show_header=True, header_style="bold blue")
            table.add_column("Contact", style="cyan")
            table.add_column("Phrase", style="white")
            table.add_column("Count", style="green", justify="right")

            for entry in filtered[:3]:
                top = entry["top_phrases"][0]
                label = top.get("phrase") or top.get("text") or "—"
                contact_name = entry.get("contact_name") or entry.get("contact_id")
                table.add_row(contact_name, label, f"{top.get('occurrences', 0):,}")

            self.console.print(table)

    def _render_sentiment_overview(self, sentiment: dict[str, Any]) -> None:
        self.console.print("\n[bold cyan]🧠 Sentiment Snapshot[/]")
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("Perspective", style="dim")
        table.add_column("Positive", justify="right")
        table.add_column("Neutral", justify="right")
        table.add_column("Negative", justify="right")
        table.add_column("Avg Score", justify="right")

        perspectives = [
            ("Overall", sentiment.get("overall")),
            ("You", sentiment.get("sent")),
            ("Them", sentiment.get("received")),
        ]

        has_data = False
        for label, data in perspectives:
            if not data or data.get("message_count", 0) == 0:
                continue
            has_data = True
            percentages = self._sentiment_percentages(data.get("distribution", {}))
            avg_score = data.get("avg_score", 0.0)
            table.add_row(
                label,
                percentages["positive"],
                percentages["neutral"],
                percentages["negative"],
                f"{avg_score:+.2f}",
            )

        if has_data:
            self.console.print(table)
        else:
            self.console.print("[dim]No sentiment-ready messages found.[/]")

    def _render_sentiment_periods(self, periods: dict[str, Any] | None) -> None:
        if not periods:
            return

        interval = periods.get("interval")
        if interval != "month":
            return

        sent = periods.get("sent", [])
        received = periods.get("received", [])
        rows = self._merge_period_rows(sent, received)
        if not rows:
            return

        self.console.print("\n[bold cyan]📅 Monthly Sentiment (You vs Them)[/]")
        table = Table(show_header=True, header_style="bold cyan")
        table.add_column("Month", style="dim")
        table.add_column("You (avg)", justify="right")
        table.add_column("Them (avg)", justify="right")

        for row in rows:
            table.add_row(
                self._format_period_label(row["period"], interval),
                self._format_sentiment_value(row["sent"]),
                self._format_sentiment_value(row["received"]),
            )

        self.console.print(table)

        overall = periods.get("overall") or []
        if overall:
            self._render_sentiment_bar_chart(overall, interval)

    def _share_bar(self, share: float) -> str:
        total_width = 30
        filled = max(1, min(total_width, int(round(share * total_width))))
        empty = total_width - filled
        return f"[magenta]{'█' * filled}[/][dim]{'·' * empty}[/]"

    def _render_sentiment_bar_chart(self, rows: list[dict[str, Any]], interval: str) -> None:
        if not rows:
            return

        self.console.print("\n[bold cyan]🌈 Mood Flow[/]")
        axis_label = "Month" if interval == "month" else interval.title()
        self.console.print(f"[dim]{axis_label} vs sentiment intensity[/]")

        for row in rows:
            score = row.get("avg_score", 0.0)
            label = self._format_period_label(row["period"], interval)
            magnitude = min(1.0, abs(score))
            width = max(1, int(magnitude * 20))
            color = "magenta" if score >= 0 else "cyan"
            bar = "█" * width
            self.console.print(f"{label:>7} [bold {color}]{bar}[/]")

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

    def _render_ghosts_section(self, ghosts: dict[str, Any]) -> None:
        if not ghosts:
            return

        total_you = ghosts.get("people_you_left_hanging", 0)
        total_them = ghosts.get("people_who_left_you_hanging", 0)
        if total_you == 0 and total_them == 0:
            return

        self.console.print("\n[bold cyan]👻 Ghost Mode[/]")

        table = Table(show_header=False, box=None, padding=(0, 2))
        table.add_column("Metric", style="dim")
        table.add_column("Value", style="magenta")

        timeline = ghosts.get("timeline_days")
        min_consecutive = ghosts.get("min_consecutive_messages")
        min_conversation = ghosts.get("min_conversation_messages")

        if timeline:
            table.add_row("Silence Threshold", f"{timeline} days without a reply")
        if min_consecutive:
            table.add_row("Minimum Texts in a Row", f"{min_consecutive} messages")
        if min_conversation:
            table.add_row("Minimum Messages per Chat", f"{min_conversation}")

        table.add_row("People You Left Hanging", f"{total_you:,}")
        table.add_row("People Who Left You Hanging", f"{total_them:,}")

        ratio = ghosts.get("ghost_ratio")
        if ratio is not None:
            table.add_row("Ghost Ratio (You/Them)", f"{ratio:.2f}")

        self.console.print(table)

    def _render_cliffhangers_section(self, cliffhangers: dict[str, Any] | None) -> None:
        if not cliffhangers:
            return

        count_you = cliffhangers.get("count", 0)
        count_them = cliffhangers.get("count_them", 0)
        if count_you <= 0 and count_them <= 0:
            return

        threshold = cliffhangers.get("threshold_hours", 12)
        longest_wait_you = cliffhangers.get("longest_wait_hours")
        longest_wait_them = cliffhangers.get("longest_wait_hours_them")
        self.console.print("\n[bold cyan]🧵 Cliffhangers[/]")
        if count_you > 0:
            self.console.print(
                f"You dangled future gossip [bold]{count_you}[/] times (took ≥{threshold}h to follow up)."
            )
            if isinstance(longest_wait_you, (int, float)) and longest_wait_you > 0:
                self.console.print(
                    f"[dim]Longest you made someone wait: {longest_wait_you:.1f}h[/]"
                )
        if count_them > 0:
            self.console.print(
                f"Your friends dangled it back [bold]{count_them}[/] times (you waited ≥{threshold}h)."
            )
            if isinstance(longest_wait_them, (int, float)) and longest_wait_them > 0:
                self.console.print(f"[dim]Longest they made you wait: {longest_wait_them:.1f}h[/]")

        examples_you = cliffhangers.get("examples") or []
        if examples_you:
            self.console.print("[dim]Your slowest follow-ups:[/]")
            for example in examples_you:
                contact = example.get("contact") or "Unknown"
                snippet = (example.get("snippet") or "").strip()
                when = example.get("timestamp") or "unknown date"
                wait_hours = example.get("hours_waited")
                preview = snippet if len(snippet) <= 60 else f"{snippet[:57]}..."
                details: list[str] = []
                if isinstance(wait_hours, (int, float)):
                    details.append(f"{wait_hours:.1f}h wait")
                if when and when != "unknown date":
                    details.append(when)
                meta = " • ".join(details) if details else "unknown date"
                self.console.print(f" • {contact}: “{preview}” ({meta})")

        examples_them = cliffhangers.get("examples_them") or []
        if examples_them:
            self.console.print("[dim]Times they left you hanging:[/]")
            for example in examples_them:
                contact = example.get("contact") or "Unknown"
                snippet = (example.get("snippet") or "").strip()
                when = example.get("timestamp") or "unknown date"
                wait_hours = example.get("hours_waited")
                preview = snippet if len(snippet) <= 60 else f"{snippet[:57]}..."
                details: list[str] = []
                if isinstance(wait_hours, (int, float)):
                    details.append(f"{wait_hours:.1f}h wait")
                if when and when != "unknown date":
                    details.append(when)
                meta = " • ".join(details) if details else "unknown date"
                self.console.print(f" • {contact}: “{preview}” ({meta})")

    def _render_stub_section(self, title: str, stub_data: dict[str, Any]) -> None:
        self.console.print(f"\n[bold cyan]{title}[/]")

        if stub_data.get("status") == "not_implemented":
            self.console.print(f"[dim]{stub_data.get('message', 'Not yet implemented')}[/]")

    def _sentiment_percentages(self, distribution: dict[str, int]) -> dict[str, str]:
        total = sum(distribution.values())
        if total == 0:
            return {"positive": "0%", "neutral": "0%", "negative": "0%"}

        def _format(value: int) -> str:
            percent = (value / total) * 100
            return f"{percent:.0f}%"

        return {
            "positive": _format(distribution.get("positive", 0)),
            "neutral": _format(distribution.get("neutral", 0)),
            "negative": _format(distribution.get("negative", 0)),
        }

    def _format_period_label(self, period: str, interval: str) -> str:
        if interval == "month":
            try:
                dt = datetime.strptime(period, "%Y-%m")
                return dt.strftime("%b %Y")
            except ValueError:
                return period
        if interval == "week":
            return period.replace("-", " ")
        return period

    def _format_sentiment_value(self, entry: dict[str, Any] | None) -> str:
        if not entry:
            return "—"
        avg = entry.get("avg_score")
        if avg is None:
            return "—"
        return f"{avg:+.2f}"

    def _merge_period_rows(
        self,
        sent: list[dict[str, Any]],
        received: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        sent_map = {entry["period"]: entry for entry in sent}
        received_map = {entry["period"]: entry for entry in received}
        periods = sorted(set(sent_map) | set(received_map))
        rows = []
        for period in periods:
            rows.append(
                {
                    "period": period,
                    "sent": sent_map.get(period),
                    "received": received_map.get(period),
                }
            )
        return rows
