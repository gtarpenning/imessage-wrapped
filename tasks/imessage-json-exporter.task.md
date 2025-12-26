# Task: iMessage SQLite to JSON Exporter

## Objective
Create a Python module that reads the macOS iMessage SQLite database (`chat.db`) and exports messages to a structured JSON format. This replaces the need for external tools like `imessage-exporter`.

**Reference implementation:** [ReagentX/imessage-exporter txt.rs](https://github.com/ReagentX/imessage-exporter/blob/develop/imessage-exporter/src/exporters/txt.rs)

## Database Location
```
~/Library/Messages/chat.db
```
**Requires Full Disk Access permission** - the script should detect permission errors and provide helpful guidance.

---

## Database Schema (Key Tables)

### `message` table
| Column | Type | Description |
|--------|------|-------------|
| `ROWID` | INTEGER | Primary key |
| `guid` | TEXT | Unique message identifier (used for tapback references) |
| `text` | TEXT | Message content (can be NULL - see attributed_body) |
| `attributed_body` | BLOB | Rich text as NSAttributedString (use when text is NULL) |
| `date` | INTEGER | Timestamp in Apple format (nanoseconds since 2001-01-01) |
| `date_read` | INTEGER | When message was read (same format, 0 if unread) |
| `date_delivered` | INTEGER | When message was delivered |
| `date_edited` | INTEGER | When message was last edited (if edited) |
| `is_from_me` | INTEGER | 1 = sent by user, 0 = received |
| `handle_id` | INTEGER | FK to handle.ROWID (NULL for sent messages) |
| `chat_id` | INTEGER | FK to chat.ROWID |
| `cache_has_attachments` | INTEGER | 1 if has attachments |
| `associated_message_guid` | TEXT | For tapbacks, references parent message's guid |
| `associated_message_type` | INTEGER | Type of reaction (2000-2005 for tapbacks) |
| `destination_caller_id` | TEXT | For sent messages, who it was sent to |
| `is_deleted` | INTEGER | 1 if message was deleted |

### `handle` table
| Column | Type | Description |
|--------|------|-------------|
| `ROWID` | INTEGER | Primary key |
| `id` | TEXT | Phone number (+1234567890) or email |
| `service` | TEXT | "iMessage" or "SMS" |

### `chat` table
| Column | Type | Description |
|--------|------|-------------|
| `ROWID` | INTEGER | Primary key |
| `chat_identifier` | TEXT | Unique chat ID (phone number or group identifier) |
| `display_name` | TEXT | Group chat name (if user set one) |
| `group_id` | TEXT | Group identifier |

### `chat_message_join` table
| Column | Type | Description |
|--------|------|-------------|
| `chat_id` | INTEGER | FK to chat.ROWID |
| `message_id` | INTEGER | FK to message.ROWID |

### `chat_handle_join` table
| Column | Type | Description |
|--------|------|-------------|
| `chat_id` | INTEGER | FK to chat.ROWID |
| `handle_id` | INTEGER | FK to handle.ROWID |

---

## Timestamp Conversion

Apple uses **nanoseconds since 2001-01-01 00:00:00 UTC**. From the Rust source test cases:
- `date = 674526582885055488` → "May 17, 2022 5:29:42 PM"
- The `TIMESTAMP_FACTOR` is `1_000_000_000` (1 billion)

```python
from datetime import datetime, timedelta, timezone

APPLE_EPOCH = datetime(2001, 1, 1, tzinfo=timezone.utc)
TIMESTAMP_FACTOR = 1_000_000_000  # nanoseconds to seconds

def apple_timestamp_to_datetime(ns: int) -> datetime | None:
    """Convert Apple nanosecond timestamp to datetime."""
    if ns is None or ns == 0:
        return None
    seconds = ns / TIMESTAMP_FACTOR
    return APPLE_EPOCH + timedelta(seconds=seconds)

def format_timestamp(dt: datetime) -> str:
    """Format datetime like the txt exporter: 'May 17, 2022  5:29:42 PM'"""
    return dt.strftime("%b %d, %Y %l:%M:%S %p").replace("  ", " ").strip()
```

**Verification:** `674526582885055488 / 1e9 = 674526582.885` seconds since 2001-01-01 → May 17, 2022

---

## Read Receipt Formatting

The txt exporter shows read receipts like: `(Read by you after 48 minutes, 21 seconds)`

From the Rust source, `readable_diff` converts the time difference into human-readable format:

```python
def readable_diff(seconds: float) -> str:
    """Convert seconds to human-readable duration like '48 minutes, 21 seconds'"""
    if seconds < 60:
        s = int(seconds)
        return f"{s} second{'s' if s != 1 else ''}"
    
    parts = []
    hours, remainder = divmod(int(seconds), 3600)
    minutes, secs = divmod(remainder, 60)
    
    if hours > 0:
        parts.append(f"{hours} hour{'s' if hours != 1 else ''}")
    if minutes > 0:
        parts.append(f"{minutes} minute{'s' if minutes != 1 else ''}")
    if secs > 0 and hours == 0:  # Only show seconds if < 1 hour
        parts.append(f"{secs} second{'s' if secs != 1 else ''}")
    
    return ", ".join(parts)

def get_read_after_duration(date: int, date_read: int) -> float | None:
    """Calculate seconds between message sent and read. Returns None if not read."""
    if date_read and date_read > date:
        diff_ns = date_read - date
        return diff_ns / TIMESTAMP_FACTOR
    return None
```

---

## Extracting Text from attributed_body

When `message.text` is NULL, the content is in `attributed_body` as a binary blob containing NSAttributedString. 

```python
def extract_text_from_attributed_body(blob: bytes) -> str | None:
    """Extract plain text from NSAttributedString blob."""
    if not blob:
        return None
    try:
        # The blob has a binary header, then readable text
        # Look for the text content after the header
        decoded = blob.decode('utf-8', errors='replace')
        
        # Remove control characters but keep readable text
        import re
        # Find substantial text runs (10+ readable chars)
        matches = re.findall(r'[\w\s.,!?\'"()-]{10,}', decoded)
        if matches:
            # Usually the longest match is the actual message
            return max(matches, key=len).strip()
        return None
    except Exception:
        return None
```

**Note:** For our stats purposes, we can skip messages where we can't extract text - they're likely attachments or special message types anyway.

---

## Tapback/Reaction Handling

From the Rust source, tapbacks are stored as separate messages with:
- `associated_message_guid` pointing to the parent message's `guid`
- `associated_message_type` indicating the reaction type

**Tapback types (from imessage-exporter):**
| Type | Emoji | Action |
|------|-------|--------|
| 2000 | ❤️ | Love |
| 2001 | 👍 | Like |
| 2002 | 👎 | Dislike |
| 2003 | 😂 | Laugh |
| 2004 | ‼️ | Emphasize |
| 2005 | ❓ | Question |
| 3000-3005 | - | Remove respective reaction |

**Identifying tapback messages:**
```python
TAPBACK_MAP = {
    2000: "love", 2001: "like", 2002: "dislike",
    2003: "laugh", 2004: "emphasize", 2005: "question",
}

def is_tapback(associated_message_type: int) -> bool:
    return 2000 <= associated_message_type <= 2005 or 3000 <= associated_message_type <= 3005

def get_tapback_type(associated_message_type: int) -> str | None:
    """Returns tapback type or None if it's a removal (3000+)"""
    return TAPBACK_MAP.get(associated_message_type)
```

---

## Main Query

```sql
SELECT 
    m.ROWID as message_id,
    m.guid as message_guid,
    m.text,
    m.attributed_body,
    m.date,
    m.date_read,
    m.date_delivered,
    m.is_from_me,
    m.cache_has_attachments,
    m.associated_message_guid,
    m.associated_message_type,
    h.id as sender_id,
    h.service,
    c.ROWID as chat_id,
    c.chat_identifier,
    c.display_name as chat_display_name
FROM message m
LEFT JOIN handle h ON m.handle_id = h.ROWID
LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
LEFT JOIN chat c ON cmj.chat_id = c.ROWID
ORDER BY m.date ASC
```

**Filter for 2025 only:**
```python
# Jan 1, 2025 00:00:00 UTC in Apple nanoseconds
JAN_1_2025_NS = int((datetime(2025, 1, 1, tzinfo=timezone.utc) - APPLE_EPOCH).total_seconds() * TIMESTAMP_FACTOR)
# Dec 31, 2025 23:59:59 UTC
DEC_31_2025_NS = int((datetime(2025, 12, 31, 23, 59, 59, tzinfo=timezone.utc) - APPLE_EPOCH).total_seconds() * TIMESTAMP_FACTOR)

# Add to WHERE clause:
# WHERE m.date >= {JAN_1_2025_NS} AND m.date <= {DEC_31_2025_NS}
```

---

## Output JSON Schema

```json
{
  "export_date": "2025-12-25T10:30:00Z",
  "year": 2025,
  "total_messages": 45678,
  "conversations": {
    "chat_abc123": {
      "chat_identifier": "+14155551234",
      "display_name": null,
      "is_group_chat": false,
      "participants": ["+14155551234"],
      "messages": [
        {
          "id": 12345,
          "guid": "ABC123-DEF456",
          "timestamp": "2025-03-15T14:30:00Z",
          "timestamp_unix": 1710513000,
          "date_read_after_seconds": 135.5,
          "is_from_me": false,
          "sender": "+14155551234",
          "text": "Hey, are you free tonight?",
          "service": "iMessage",
          "has_attachment": false,
          "tapbacks": [
            {"type": "love", "by": "Me"}
          ]
        }
      ]
    }
  }
}
```

---

## Implementation Requirements

### Core Module: `db_reader.py`

```python
import sqlite3
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

APPLE_EPOCH = datetime(2001, 1, 1, tzinfo=timezone.utc)
TIMESTAMP_FACTOR = 1_000_000_000

class iMessageReader:
    def __init__(self, db_path: str | None = None):
        self.db_path = db_path or os.path.expanduser("~/Library/Messages/chat.db")
        self.conn = None
        
    def connect(self) -> bool:
        """Connect to database. Returns False if permission denied."""
        try:
            self.conn = sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True)
            self.conn.row_factory = sqlite3.Row
            # Test query to verify access
            self.conn.execute("SELECT 1 FROM message LIMIT 1")
            return True
        except sqlite3.OperationalError as e:
            if "unable to open" in str(e).lower():
                return False
            raise
    
    def get_messages(self, year: int = 2025) -> list[dict]:
        """Fetch all messages for the given year."""
        # Calculate year boundaries in Apple nanoseconds
        start = datetime(year, 1, 1, tzinfo=timezone.utc)
        end = datetime(year, 12, 31, 23, 59, 59, tzinfo=timezone.utc)
        start_ns = int((start - APPLE_EPOCH).total_seconds() * TIMESTAMP_FACTOR)
        end_ns = int((end - APPLE_EPOCH).total_seconds() * TIMESTAMP_FACTOR)
        
        query = """
        SELECT 
            m.ROWID, m.guid, m.text, m.attributed_body,
            m.date, m.date_read, m.is_from_me,
            m.cache_has_attachments, m.associated_message_guid,
            m.associated_message_type,
            h.id as sender_id, h.service,
            c.ROWID as chat_id, c.chat_identifier, c.display_name
        FROM message m
        LEFT JOIN handle h ON m.handle_id = h.ROWID
        LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
        LEFT JOIN chat c ON cmj.chat_id = c.ROWID
        WHERE m.date >= ? AND m.date <= ?
        ORDER BY m.date ASC
        """
        
        cursor = self.conn.execute(query, (start_ns, end_ns))
        return [dict(row) for row in cursor.fetchall()]
    
    def close(self):
        if self.conn:
            self.conn.close()
```

### Permission Detection

```python
def check_full_disk_access() -> bool:
    """Check if we have Full Disk Access permission."""
    db_path = os.path.expanduser("~/Library/Messages/chat.db")
    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        conn.execute("SELECT 1 FROM message LIMIT 1")
        conn.close()
        return True
    except sqlite3.OperationalError:
        return False

def show_permission_error():
    """Display helpful error message for missing permissions."""
    from rich.console import Console
    from rich.panel import Panel
    
    console = Console()
    console.print(Panel(
        "[bold red]Full Disk Access Required[/]\n\n"
        "This app needs permission to read your iMessage database.\n\n"
        "[bold]To grant access:[/]\n"
        "1. Open [cyan]System Settings[/]\n"
        "2. Go to [cyan]Privacy & Security → Full Disk Access[/]\n"
        "3. Click [cyan]+[/] and add this application\n"
        "4. Restart the application",
        title="⚠️ Permission Error"
    ))
```

---

## Group Chat Detection

A chat is a group chat if:
1. `chat.display_name` is not NULL, OR
2. Multiple handles are associated via `chat_handle_join`

```python
def get_chat_participant_counts(conn) -> dict[int, int]:
    """Get participant count for each chat."""
    query = """
    SELECT chat_id, COUNT(DISTINCT handle_id) as participant_count
    FROM chat_handle_join
    GROUP BY chat_id
    """
    cursor = conn.execute(query)
    return {row[0]: row[1] for row in cursor.fetchall()}
```

---

## Sender Identification

From the Rust source (`config.who()`):
- If `is_from_me == 1`: sender is "Me"
- If `is_from_me == 0`: sender is `handle.id` (phone/email)
- For group chats, each message has the actual sender in `handle.id`

Constants from the Rust source:
```python
ME = "Me"
YOU = "You"  # Used when displaying to the user
FITNESS_RECEIVER = "workout-receiver"  # Special case
```

---

## Performance Considerations

- Database can have 100k+ messages. Use cursors and generators.
- The Rust exporter processes messages in streaming fashion
- Use `fetchmany(1000)` instead of `fetchall()` for large result sets
- Open database in read-only mode to prevent locks

---

## Dependencies

**Zero external dependencies for core functionality!**
- `sqlite3` (built-in)
- `json` (built-in)
- `datetime` (built-in)

Only `rich` is needed for pretty terminal output (optional).

---

## File Structure

```
src/imessage_wrapped/
├── __init__.py
├── db_reader.py      # This module
├── models.py         # Dataclasses for Message, Conversation
└── permissions.py    # macOS permission utilities
```
