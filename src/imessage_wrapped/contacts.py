"""
Contact information lookup module for iMessage Wrapped.

This module provides functionality to resolve phone numbers and email addresses
to contact names using the macOS Contacts database. It only runs when explicitly
enabled via the --with-contacts flag or the GUI menu option.
"""

import logging
import re
import sqlite3
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class ContactsReader:
    """
    Reader for macOS Contacts database (AddressBook.framework).

    The Contacts database is typically located at:
    ~/Library/Application Support/AddressBook/AddressBook-v22.abcddb

    This requires Full Disk Access permissions.
    """

    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize ContactsReader.

        Args:
            db_path: Optional path to AddressBook database. If None, uses default location.
        """
        if db_path:
            self.db_path = Path(db_path)
        else:
            # Default macOS Contacts database location
            home = Path.home()
            # Try newer versions first
            possible_paths = [
                home / "Library/Application Support/AddressBook/AddressBook-v22.abcddb",
                home / "Library/Application Support/AddressBook/AddressBook.sqlitedb",
            ]

            self.db_path = None
            for path in possible_paths:
                if path.exists():
                    self.db_path = path
                    break

            if not self.db_path:
                logger.warning(
                    f"Contacts database not found in standard locations: {possible_paths}"
                )

        self._conn: Optional[sqlite3.Connection] = None
        self._contact_cache: dict[str, str] = {}

    def connect(self) -> bool:
        """
        Connect to the Contacts database.

        Returns:
            bool: True if connection successful, False otherwise.
        """
        if not self.db_path or not self.db_path.exists():
            logger.error(f"Contacts database not found at: {self.db_path}")
            return False

        try:
            logger.debug(f"Connecting to Contacts database: {self.db_path}")
            self._conn = sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True)
            self._conn.row_factory = sqlite3.Row
            logger.info("Successfully connected to Contacts database")
            return True
        except (sqlite3.OperationalError, sqlite3.DatabaseError) as e:
            logger.error(f"Failed to connect to Contacts database: {e}")
            return False

    def close(self) -> None:
        """Close the database connection."""
        if self._conn:
            self._conn.close()
            self._conn = None
            logger.debug("Contacts database connection closed")

    def __enter__(self):
        """Context manager entry."""
        if self.connect():
            return self
        raise ConnectionError("Failed to connect to Contacts database")

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()

    def _normalize_phone_number(self, phone: str) -> str:
        """
        Normalize a phone number for comparison.
        Removes all non-digit characters and handles international formats.

        Args:
            phone: Raw phone number string

        Returns:
            Normalized phone number (digits only)
        """
        # Remove all non-digit characters
        digits = re.sub(r"\D", "", phone)

        # Remove leading country code if present
        if digits.startswith("1") and len(digits) == 11:
            digits = digits[1:]

        return digits

    def _normalize_email(self, email: str) -> str:
        """
        Normalize an email address for comparison.

        Args:
            email: Raw email string

        Returns:
            Normalized email (lowercase)
        """
        return email.lower().strip()

    def build_contact_map(self) -> dict[str, str]:
        """
        Build a map of phone numbers/emails to contact names.

        Returns:
            Dictionary mapping normalized identifiers to contact names.
        """
        if not self._conn:
            logger.error("Cannot build contact map: database not connected")
            return {}

        contact_map = {}

        try:
            # Query for phone numbers
            # The AddressBook schema has ZABCDPHONENUMBER table with phone numbers
            # and ZABCDRECORD table with contact names
            phone_query = """
                SELECT
                    p.ZFULLNUMBER as phone,
                    r.ZFIRSTNAME as first_name,
                    r.ZLASTNAME as last_name,
                    r.ZORGANIZATION as organization
                FROM ZABCDPHONENUMBER p
                JOIN ZABCDRECORD r ON p.ZOWNER = r.Z_PK
                WHERE p.ZFULLNUMBER IS NOT NULL
            """

            try:
                cursor = self._conn.execute(phone_query)
                for row in cursor:
                    phone = row["phone"]
                    if not phone:
                        continue

                    # Build contact name
                    first = row["first_name"] or ""
                    last = row["last_name"] or ""
                    org = row["organization"] or ""

                    if first or last:
                        name = f"{first} {last}".strip()
                    elif org:
                        name = org
                    else:
                        continue

                    # Normalize phone number
                    normalized = self._normalize_phone_number(phone)
                    if normalized:
                        contact_map[normalized] = name
                        # Also store with country code variations
                        contact_map[f"+1{normalized}"] = name
                        contact_map[f"1{normalized}"] = name

                logger.info(f"Loaded {len(contact_map)} phone number mappings from Contacts")
            except sqlite3.OperationalError as e:
                logger.warning(f"Failed to query phone numbers: {e}")

            # Query for email addresses
            email_query = """
                SELECT
                    e.ZADDRESSNORMALIZED as email,
                    r.ZFIRSTNAME as first_name,
                    r.ZLASTNAME as last_name,
                    r.ZORGANIZATION as organization
                FROM ZABCDEMAILADDRESS e
                JOIN ZABCDRECORD r ON e.ZOWNER = r.Z_PK
                WHERE e.ZADDRESSNORMALIZED IS NOT NULL
            """

            try:
                cursor = self._conn.execute(email_query)
                for row in cursor:
                    email = row["email"]
                    if not email:
                        continue

                    # Build contact name (same logic as above)
                    first = row["first_name"] or ""
                    last = row["last_name"] or ""
                    org = row["organization"] or ""

                    if first or last:
                        name = f"{first} {last}".strip()
                    elif org:
                        name = org
                    else:
                        continue

                    # Normalize email
                    normalized = self._normalize_email(email)
                    if normalized:
                        contact_map[normalized] = name

                logger.info(f"Total contact mappings: {len(contact_map)}")
            except sqlite3.OperationalError as e:
                logger.warning(f"Failed to query email addresses: {e}")

        except Exception as e:
            logger.error(f"Error building contact map: {e}")

        # Cache the result
        self._contact_cache = contact_map
        return contact_map

    def lookup_contact(self, identifier: str) -> Optional[str]:
        """
        Look up a contact name for a given phone number or email.

        Args:
            identifier: Phone number or email address

        Returns:
            Contact name if found, None otherwise
        """
        if not identifier:
            return None

        # Ensure contact map is built
        if not self._contact_cache:
            self.build_contact_map()

        # Try phone number lookup
        if re.search(r"\d", identifier):  # Contains digits, likely a phone
            normalized = self._normalize_phone_number(identifier)
            result = self._contact_cache.get(normalized)
            if result:
                return result

            # Try with variations
            for variant in [f"+1{normalized}", f"1{normalized}"]:
                result = self._contact_cache.get(variant)
                if result:
                    return result

        # Try email lookup
        if "@" in identifier:
            normalized = self._normalize_email(identifier)
            result = self._contact_cache.get(normalized)
            if result:
                return result

        # Try direct lookup (in case it's already normalized)
        return self._contact_cache.get(identifier)


def enrich_conversations_with_contacts(
    conversations: dict, contacts_reader: Optional[ContactsReader] = None
) -> dict:
    """
    Enrich conversation data with contact names from the Contacts database.

    This function updates the display_name field of conversations with real
    contact names when available.

    Args:
        conversations: Dictionary of conversation objects
        contacts_reader: Optional ContactsReader instance. If None, creates a new one.

    Returns:
        Updated conversations dictionary
    """
    if contacts_reader is None:
        contacts_reader = ContactsReader()
        try:
            if not contacts_reader.connect():
                logger.warning(
                    "Could not connect to Contacts database, skipping contact enrichment"
                )
                return conversations
        except Exception as e:
            logger.warning(f"Failed to initialize contacts reader: {e}")
            return conversations

    try:
        # Build the contact map once
        contact_map = contacts_reader.build_contact_map()
        if not contact_map:
            logger.warning("No contacts found in database")
            return conversations

        enriched_count = 0
        for conv in conversations.values():
            # Try to enrich the display name from chat_identifier
            if conv.chat_identifier and not conv.display_name:
                contact_name = contacts_reader.lookup_contact(conv.chat_identifier)
                if contact_name:
                    conv.display_name = contact_name
                    enriched_count += 1

            # Also try to enrich from participants
            if not conv.display_name and conv.participants:
                for participant in conv.participants:
                    contact_name = contacts_reader.lookup_contact(participant)
                    if contact_name:
                        conv.display_name = contact_name
                        enriched_count += 1
                        break

        logger.info(f"Enriched {enriched_count} conversations with contact names")

    except Exception as e:
        logger.error(f"Error enriching conversations with contacts: {e}")
    finally:
        if contacts_reader:
            contacts_reader.close()

    return conversations


def check_contacts_access() -> bool:
    """
    Check if we have access to the Contacts database.

    Returns:
        bool: True if access is available, False otherwise
    """
    try:
        reader = ContactsReader()
        if not reader.db_path:
            return False

        with reader:
            # Try a simple query to verify access
            reader.build_contact_map()
            return len(reader._contact_cache) > 0
    except Exception as e:
        logger.debug(f"Contacts access check failed: {e}")
        return False
