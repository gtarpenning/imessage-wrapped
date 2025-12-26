from abc import ABC, abstractmethod
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any
import re

from .models import ExportData, Message, Conversation


class StatisticsAnalyzer(ABC):
    
    @abstractmethod
    def analyze(self, data: ExportData) -> dict[str, Any]:
        pass
    
    @property
    @abstractmethod
    def name(self) -> str:
        pass


class RawStatisticsAnalyzer(StatisticsAnalyzer):
    
    @property
    def name(self) -> str:
        return "raw"
    
    def analyze(self, data: ExportData) -> dict[str, Any]:
        all_messages = self._flatten_messages(data)
        sent_messages = [m for m in all_messages if m.is_from_me]
        received_messages = [m for m in all_messages if not m.is_from_me]
        
        return {
            "volume": self._analyze_volume(all_messages, sent_messages, received_messages),
            "temporal": self._analyze_temporal_patterns(all_messages, sent_messages),
            "contacts": self._analyze_contacts(data, sent_messages, received_messages),
            "content": self._analyze_content(sent_messages, received_messages),
            "conversations": self._analyze_conversations(data),
            "response_times": self._analyze_response_times(data),
            "tapbacks": self._analyze_tapbacks(all_messages, sent_messages, received_messages),
            "streaks": self._analyze_streaks(data),
        }
    
    def _flatten_messages(self, data: ExportData) -> list[Message]:
        messages = []
        for conv in data.conversations.values():
            messages.extend(conv.messages)
        return sorted(messages, key=lambda m: m.timestamp)
    
    def _analyze_volume(
        self, 
        all_messages: list[Message],
        sent_messages: list[Message],
        received_messages: list[Message]
    ) -> dict[str, Any]:
        sent_by_date = defaultdict(int)
        received_by_date = defaultdict(int)
        
        for msg in sent_messages:
            sent_by_date[msg.timestamp.date()] += 1
        
        for msg in received_messages:
            received_by_date[msg.timestamp.date()] += 1
        
        busiest_day_total = max(
            ((date, sent_by_date[date] + received_by_date[date]) 
             for date in set(sent_by_date.keys()) | set(received_by_date.keys())),
            key=lambda x: x[1],
            default=(None, 0)
        )
        
        daily_activity = {}
        all_dates = set(sent_by_date.keys()) | set(received_by_date.keys())
        for date in all_dates:
            daily_activity[date.isoformat()] = {
                "sent": sent_by_date.get(date, 0),
                "received": received_by_date.get(date, 0),
                "total": sent_by_date.get(date, 0) + received_by_date.get(date, 0),
            }
        
        return {
            "total_messages": len(all_messages),
            "total_sent": len(sent_messages),
            "total_received": len(received_messages),
            "busiest_day": {
                "date": busiest_day_total[0].isoformat() if busiest_day_total[0] else None,
                "total": busiest_day_total[1],
                "sent": sent_by_date.get(busiest_day_total[0], 0) if busiest_day_total[0] else 0,
                "received": received_by_date.get(busiest_day_total[0], 0) if busiest_day_total[0] else 0,
            },
            "most_sent_in_day": max(sent_by_date.values()) if sent_by_date else 0,
            "most_received_in_day": max(received_by_date.values()) if received_by_date else 0,
            "active_days": len(set(sent_by_date.keys()) | set(received_by_date.keys())),
            "days_sent": len(sent_by_date),
            "days_received": len(received_by_date),
            "daily_activity": daily_activity,
        }
    
    def _analyze_temporal_patterns(
        self,
        all_messages: list[Message],
        sent_messages: list[Message]
    ) -> dict[str, Any]:
        hour_distribution = Counter(msg.timestamp.hour for msg in sent_messages)
        day_of_week_distribution = Counter(msg.timestamp.weekday() for msg in sent_messages)
        month_distribution = Counter(msg.timestamp.month for msg in sent_messages)
        
        return {
            "hour_distribution": dict(sorted(hour_distribution.items())),
            "day_of_week_distribution": dict(sorted(day_of_week_distribution.items())),
            "month_distribution": dict(sorted(month_distribution.items())),
            "busiest_hour": hour_distribution.most_common(1)[0] if hour_distribution else (None, 0),
            "busiest_day_of_week": day_of_week_distribution.most_common(1)[0] if day_of_week_distribution else (None, 0),
        }
    
    def _analyze_streaks(self, data: ExportData) -> dict[str, Any]:
        max_streak = 0
        max_streak_contact = None
        max_streak_contact_id = None
        
        for conv in data.conversations.values():
            messages = sorted(conv.messages, key=lambda m: m.timestamp)
            if not messages:
                continue
            
            dates = sorted(set(msg.timestamp.date() for msg in messages))
            
            current_streak = 1
            for i in range(1, len(dates)):
                if dates[i] - dates[i-1] == timedelta(days=1):
                    current_streak += 1
                    if current_streak > max_streak:
                        max_streak = current_streak
                        max_streak_contact = conv.display_name or conv.chat_identifier
                        max_streak_contact_id = conv.chat_identifier
                else:
                    current_streak = 1
        
        return {
            "longest_streak_days": max_streak,
            "longest_streak_contact": max_streak_contact,
            "longest_streak_contact_id": max_streak_contact_id,
        }
    
    def _analyze_contacts(
        self,
        data: ExportData,
        sent_messages: list[Message],
        received_messages: list[Message]
    ) -> dict[str, Any]:
        sent_by_contact = defaultdict(int)
        received_by_contact = defaultdict(int)
        contact_names = {}
        
        for conv in data.conversations.values():
            contact_id = conv.chat_identifier
            contact_name = conv.display_name or contact_id
            contact_names[contact_id] = contact_name
            
            for msg in conv.messages:
                if msg.is_from_me:
                    sent_by_contact[contact_id] += 1
                else:
                    received_by_contact[contact_id] += 1
        
        top_sent = sorted(
            ((contact_names[cid], count) for cid, count in sent_by_contact.items()),
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        top_received = sorted(
            ((contact_names[cid], count) for cid, count in received_by_contact.items()),
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        unique_contacts_sent = len([c for c, count in sent_by_contact.items() if count > 0])
        unique_contacts_received = len([c for c, count in received_by_contact.items() if count > 0])
        
        contacts_by_date_sent = defaultdict(set)
        contacts_by_date_received = defaultdict(set)
        
        for conv in data.conversations.values():
            contact_id = conv.chat_identifier
            for msg in conv.messages:
                if msg.is_from_me:
                    contacts_by_date_sent[msg.timestamp.date()].add(contact_id)
                else:
                    contacts_by_date_received[msg.timestamp.date()].add(contact_id)
        
        social_butterfly_day = max(
            contacts_by_date_sent.items(),
            key=lambda x: len(x[1]),
            default=(None, set())
        )
        
        fan_club_day = max(
            contacts_by_date_received.items(),
            key=lambda x: len(x[1]),
            default=(None, set())
        )
        
        return {
            "top_sent_to": [{"name": name, "count": count} for name, count in top_sent],
            "top_received_from": [{"name": name, "count": count} for name, count in top_received],
            "unique_contacts_messaged": unique_contacts_sent,
            "unique_contacts_received_from": unique_contacts_received,
            "social_butterfly_day": {
                "date": social_butterfly_day[0].isoformat() if social_butterfly_day[0] else None,
                "unique_contacts": len(social_butterfly_day[1]),
            },
            "fan_club_day": {
                "date": fan_club_day[0].isoformat() if fan_club_day[0] else None,
                "unique_contacts": len(fan_club_day[1]),
            },
        }
    
    def _analyze_content(
        self,
        sent_messages: list[Message],
        received_messages: list[Message]
    ) -> dict[str, Any]:
        sent_with_text = [m for m in sent_messages if m.text]
        received_with_text = [m for m in received_messages if m.text]
        
        emoji_pattern = re.compile(
            "["
            "\U0001F600-\U0001F64F"  # emoticons
            "\U0001F300-\U0001F5FF"  # symbols & pictographs
            "\U0001F680-\U0001F6FF"  # transport & map
            "\U0001F1E0-\U0001F1FF"  # flags
            "\U00002702-\U000027B0"
            "\U000024C2-\U0001F251"
            "]+",
            flags=re.UNICODE
        )
        
        punctuation_pattern = re.compile(r'[.!?,;:\-\'"()]')
        
        sent_emojis = []
        sent_lengths = []
        sent_punctuation_counts = []
        received_punctuation_counts = []
        question_count = 0
        exclamation_count = 0
        link_count = 0
        
        for msg in sent_with_text:
            text = msg.text or ""
            sent_lengths.append(len(text))
            found_emojis = emoji_pattern.findall(text)
            filtered_emojis = [
                e for e in found_emojis 
                if '\ufffc' not in e and e not in ['\u2642\ufe0f', '\u2640\ufe0f', '\u2642', '\u2640', '\ufe0f']
            ]
            sent_emojis.extend(filtered_emojis)
            sent_punctuation_counts.append(len(punctuation_pattern.findall(text)))
            if "?" in text:
                question_count += 1
            if "!" in text:
                exclamation_count += 1
            if re.search(r'https?://', text):
                link_count += 1
        
        for msg in received_with_text:
            text = msg.text or ""
            received_punctuation_counts.append(len(punctuation_pattern.findall(text)))
        
        emoji_counter = Counter(sent_emojis)
        
        avg_length_sent = sum(sent_lengths) / len(sent_lengths) if sent_lengths else 0
        avg_length_received = (
            sum(len(m.text or "") for m in received_with_text) / len(received_with_text)
            if received_with_text else 0
        )
        
        avg_punctuation_sent = (
            sum(sent_punctuation_counts) / len(sent_punctuation_counts)
            if sent_punctuation_counts else 0
        )
        avg_punctuation_received = (
            sum(received_punctuation_counts) / len(received_punctuation_counts)
            if received_punctuation_counts else 0
        )
        
        double_texts = self._count_double_texts(sent_messages)
        
        return {
            "avg_message_length_sent": round(avg_length_sent, 2),
            "avg_message_length_received": round(avg_length_received, 2),
            "avg_punctuation_sent": round(avg_punctuation_sent, 2),
            "avg_punctuation_received": round(avg_punctuation_received, 2),
            "most_used_emojis": [
                {"emoji": emoji, "count": count}
                for emoji, count in emoji_counter.most_common(10)
            ],
            "questions_asked": question_count,
            "exclamations_sent": exclamation_count,
            "enthusiasm_percentage": (
                round(exclamation_count / len(sent_with_text) * 100, 2)
                if sent_with_text else 0
            ),
            "links_shared": link_count,
            "attachments_sent": sum(1 for m in sent_messages if m.has_attachment),
            "attachments_received": sum(1 for m in received_messages if m.has_attachment),
            "double_text_count": double_texts["count"],
            "double_text_percentage": double_texts["percentage"],
        }
    
    def _count_double_texts(self, sent_messages: list[Message]) -> dict[str, Any]:
        if not sent_messages:
            return {"count": 0, "percentage": 0.0}
        
        sorted_msgs = sorted(sent_messages, key=lambda m: m.timestamp)
        
        double_text_count = 0
        i = 0
        while i < len(sorted_msgs) - 1:
            current = sorted_msgs[i]
            next_msg = sorted_msgs[i + 1]
            
            time_diff = (next_msg.timestamp - current.timestamp).total_seconds()
            
            if time_diff < 300:
                double_text_count += 1
                while i < len(sorted_msgs) - 1 and (sorted_msgs[i + 1].timestamp - current.timestamp).total_seconds() < 300:
                    i += 1
            i += 1
        
        percentage = round(double_text_count / len(sorted_msgs) * 100, 2) if sorted_msgs else 0
        
        return {
            "count": double_text_count,
            "percentage": percentage,
        }
    
    def _analyze_conversations(self, data: ExportData) -> dict[str, Any]:
        group_chats = [c for c in data.conversations.values() if c.is_group_chat]
        one_on_one = [c for c in data.conversations.values() if not c.is_group_chat]
        
        group_message_count = sum(c.message_count for c in group_chats)
        one_on_one_message_count = sum(c.message_count for c in one_on_one)
        total = group_message_count + one_on_one_message_count
        
        most_active = max(
            data.conversations.values(),
            key=lambda c: c.message_count,
            default=None
        )
        
        most_active_group = max(
            group_chats,
            key=lambda c: c.message_count,
            default=None
        ) if group_chats else None
        
        return {
            "total_conversations": len(data.conversations),
            "group_chats": len(group_chats),
            "one_on_one_chats": len(one_on_one),
            "group_vs_1on1_ratio": {
                "group_percentage": round(group_message_count / total * 100, 2) if total > 0 else 0,
                "one_on_one_percentage": round(one_on_one_message_count / total * 100, 2) if total > 0 else 0,
            },
            "most_active_thread": {
                "name": most_active.display_name or most_active.chat_identifier if most_active else None,
                "message_count": most_active.message_count if most_active else 0,
                "is_group": most_active.is_group_chat if most_active else False,
            },
            "most_active_group_chat": {
                "name": most_active_group.display_name or most_active_group.chat_identifier if most_active_group else None,
                "message_count": most_active_group.message_count if most_active_group else 0,
            } if most_active_group else None,
        }
    
    def _analyze_response_times(self, data: ExportData) -> dict[str, Any]:
        response_times_you = []
        response_times_them = []
        
        for conv in data.conversations.values():
            messages = sorted(conv.messages, key=lambda m: m.timestamp)
            
            for i in range(len(messages) - 1):
                current = messages[i]
                next_msg = messages[i + 1]
                
                time_diff_seconds = (next_msg.timestamp - current.timestamp).total_seconds()
                
                if current.is_from_me and not next_msg.is_from_me:
                    response_times_them.append(time_diff_seconds)
                elif not current.is_from_me and next_msg.is_from_me:
                    response_times_you.append(time_diff_seconds)
        
        def format_duration(seconds: float) -> str:
            if seconds < 60:
                return f"{int(seconds)}s"
            elif seconds < 3600:
                return f"{int(seconds // 60)}m {int(seconds % 60)}s"
            elif seconds < 86400:
                hours = int(seconds // 3600)
                minutes = int((seconds % 3600) // 60)
                return f"{hours}h {minutes}m"
            else:
                days = int(seconds // 86400)
                hours = int((seconds % 86400) // 3600)
                return f"{days}d {hours}h"
        
        def calculate_median(times: list[float]) -> float:
            if not times:
                return 0
            sorted_times = sorted(times)
            n = len(sorted_times)
            if n % 2 == 0:
                return (sorted_times[n//2 - 1] + sorted_times[n//2]) / 2
            return sorted_times[n//2]
        
        median_response_you = calculate_median(response_times_you)
        median_response_them = calculate_median(response_times_them)
        
        return {
            "median_response_time_you_seconds": round(median_response_you, 2),
            "median_response_time_you_formatted": format_duration(median_response_you),
            "median_response_time_them_seconds": round(median_response_them, 2),
            "median_response_time_them_formatted": format_duration(median_response_them),
            "total_responses_you": len(response_times_you),
            "total_responses_them": len(response_times_them),
        }
    
    def _analyze_tapbacks(
        self,
        all_messages: list[Message],
        sent_messages: list[Message],
        received_messages: list[Message]
    ) -> dict[str, Any]:
        tapbacks_given = []
        tapbacks_received = []
        
        for msg in all_messages:
            for tapback in msg.tapbacks:
                if tapback.by == "Me":
                    tapbacks_given.append(tapback.type)
                else:
                    tapbacks_received.append(tapback.type)
        
        tapback_counter_given = Counter(tapbacks_given)
        tapback_counter_received = Counter(tapbacks_received)
        
        return {
            "total_tapbacks_given": len(tapbacks_given),
            "total_tapbacks_received": len(tapbacks_received),
            "favorite_tapback": tapback_counter_given.most_common(1)[0] if tapback_counter_given else (None, 0),
            "most_received_tapback": tapback_counter_received.most_common(1)[0] if tapback_counter_received else (None, 0),
            "tapback_distribution_given": dict(tapback_counter_given.most_common()),
            "tapback_distribution_received": dict(tapback_counter_received.most_common()),
        }


class NLPStatisticsAnalyzer(StatisticsAnalyzer):
    
    @property
    def name(self) -> str:
        return "nlp"
    
    def analyze(self, data: ExportData) -> dict[str, Any]:
        return {
            "status": "not_implemented",
            "message": "NLP analysis requires additional dependencies (spaCy, NLTK)",
            "planned_features": [
                "sentiment_analysis",
                "topic_clustering",
                "word_frequency_analysis",
                "linguistic_patterns",
                "named_entity_extraction",
            ],
        }


class LLMStatisticsAnalyzer(StatisticsAnalyzer):
    
    @property
    def name(self) -> str:
        return "llm"
    
    def analyze(self, data: ExportData) -> dict[str, Any]:
        return {
            "status": "not_implemented",
            "message": "LLM analysis requires API configuration (OpenAI, Anthropic)",
            "planned_features": [
                "conversation_highlights",
                "relationship_insights",
                "thematic_analysis",
                "custom_narratives",
                "comparative_analysis",
            ],
        }

