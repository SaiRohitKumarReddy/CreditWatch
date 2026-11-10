"""CreditWatch Store factory. JSON remains default until explicitly switched."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from .repository import Store


@lru_cache(maxsize=4)
def get_store(json_path):
    data_path = Path(json_path).resolve()
    choice = os.environ.get("CREDITWATCH_STORAGE")
    if not choice:
        # Read Streamlit Cloud Secrets explicitly when an environment variable
        # has not been made available to this Python process.
        try:
            import streamlit as st
            choice = st.secrets.get("CREDITWATCH_STORAGE", "json")
        except Exception:
            choice = "json"
    choice = str(choice).strip().lower()
    if choice == "json":
        return Store(data_path)
    if choice == "sheets":
        from .sheets_repository import SheetsStore

        return SheetsStore(data_path.parent.parent)
    raise ValueError("CREDITWATCH_STORAGE must be 'json' or 'sheets'")
