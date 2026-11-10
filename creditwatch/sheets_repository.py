"""Google Sheets-backed CreditWatch Store, compatible with the local JSON Store API.

For a single-process synthetic demo. No transparent JSON fallback is performed.
All Google Sheets cell values use the JSON-encoded format from the verified
CreditWatch_JSON_to_Google_Sheets_Migration.py upload.
"""
from __future__ import annotations

import copy
import json
import threading
import time
import tomllib
from pathlib import Path
from typing import Any


SECTIONS = (
    "metadata", "borrowers", "baseline_financials", "monitor_financials",
    "facilities", "balances", "account_credits", "repayments", "covenants",
    "ratings", "reports", "cases", "audit", "signal_events",
    "projections", "baseline_versions", "borrower_assignments",
    "monitoring_activations",
)
MAP_SECTIONS = frozenset(("metadata", "borrower_assignments", "monitoring_activations"))
_MAX_CELL_CHARS = 49000
_LOCK = threading.RLock()
_CACHE_SECONDS = 3.0


def _encode(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False)


def _decode(cell: str, section: str, row: int, field: str) -> Any:
    try:
        return json.loads(cell)
    except (ValueError, TypeError) as exc:
        raise ValueError(
            f"Google Sheets contains invalid JSON in {section}, row {row}, {field}. "
            "Do not manually edit JSON-encoded database cells."
        ) from exc


def _parse_section(section: str, cells: list[list[str]]) -> tuple[list[str], Any]:
    if not cells:
        raise ValueError(f"Missing worksheet header for {section}")
    headers = cells[0]
    if not headers or len(headers) != len(set(headers)) or any(not x for x in headers):
        raise ValueError(f"Invalid worksheet header for {section}")
    if section in MAP_SECTIONS and headers != ["key", "value_json"]:
        raise ValueError(f"Unexpected dictionary worksheet headers in {section}")
    if section == "baseline_versions" and headers != ["record_json"]:
        # The migration created the empty baseline_versions worksheet with this header.
        raise ValueError("Unexpected baseline_versions header; expected record_json")

    result = {} if section in MAP_SECTIONS else []
    for row_index, raw in enumerate(cells[1:], start=2):
        padded = (list(raw) + [""] * len(headers))[:len(headers)]
        if not any(value != "" for value in padded):
            raise ValueError(f"Unexpected blank database row in {section}, row {row_index}")
        if section in MAP_SECTIONS:
            key, encoded = padded
            if not key or encoded == "" or key in result:
                raise ValueError(f"Missing/duplicate dictionary key or value: {section}, row {row_index}")
            result[key] = _decode(encoded, section, row_index, "value_json")
        elif headers == ["record_json"]:
            encoded = padded[0]
            if encoded == "":
                raise ValueError(f"Missing record_json: {section}, row {row_index}")
            item = _decode(encoded, section, row_index, "record_json")
            if not isinstance(item, dict):
                raise ValueError(f"Expected a JSON object: {section}, row {row_index}")
            result.append(item)
        else:
            item = {field: _decode(value, section, row_index, field)
                    for field, value in zip(headers, padded) if value != ""}
            result.append(item)
    return headers, result


def _rows(section: str, section_data: Any, headers: list[str]) -> list[list[str]]:
    if section in MAP_SECTIONS:
        if not isinstance(section_data, dict) or headers != ["key", "value_json"]:
            raise ValueError(f"Invalid dictionary data/headers for {section}")
        return [[str(key), _encode(value)] for key, value in section_data.items()]
    if not isinstance(section_data, list) or any(not isinstance(x, dict) for x in section_data):
        raise ValueError(f"Invalid list records for {section}")
    if headers == ["record_json"]:
        return [[_encode(item)] for item in section_data]
    return [[_encode(item[field]) if field in item else "" for field in headers]
            for item in section_data]


def _validate_cells(section: str, rows: list[list[str]]) -> None:
    for row in rows:
        for cell in row:
            if len(cell) > _MAX_CELL_CHARS:
                raise ValueError(
                    f"Record in {section} exceeds the 49,000-character safe cell limit. "
                    "No data was written."
                )


def _spans(changed: list[int]) -> list[tuple[int, int]]:
    if not changed:
        return []
    spans = []
    start = end = changed[0]
    for index in changed[1:]:
        if index == end + 1:
            end = index
        else:
            spans.append((start, end + 1))
            start = end = index
    spans.append((start, end + 1))
    return spans


class SheetsStore:
    """Minimal Store-compatible API: load() and modify(fn, *args, **kwargs)."""

    def __init__(self, root: Path | str):
        import gspread

        self.root = Path(root).resolve()
        secrets_path = self.root / ".streamlit" / "secrets.toml"
        credentials_path = self.root / ".streamlit" / "creditwatch_service_account.json"
        if not secrets_path.is_file() or not credentials_path.is_file():
            raise FileNotFoundError(
                "Google Sheets credentials missing from .streamlit. "
                "Keep secrets.toml and creditwatch_service_account.json local and private."
            )
        with secrets_path.open("rb") as fp:
            secrets = tomllib.load(fp)
        spreadsheet_id = str(secrets["creditwatch_sheets"]["spreadsheet_id"]).strip()
        if not spreadsheet_id:
            raise ValueError("Missing creditwatch_sheets.spreadsheet_id in secrets.toml")
        client = gspread.service_account(
            filename=str(credentials_path),
            scopes=["https://www.googleapis.com/auth/spreadsheets"],
        )
        self._spreadsheet = client.open_by_key(spreadsheet_id)
        self._worksheets = {ws.title: ws for ws in self._spreadsheet.worksheets()}
        missing = set(SECTIONS) - set(self._worksheets)
        if missing:
            raise ValueError("Missing Google Sheets database worksheets: " + ", ".join(sorted(missing)))
        self._cached: dict[str, Any] | None = None
        self._cache_until = 0.0

    def _remote(self) -> tuple[dict[str, list[str]], dict[str, Any]]:
        # One Google Sheets batch-read request for all 18 worksheets.
        response = self._spreadsheet.values_batch_get(
            ranges=[f"'{section}'" for section in SECTIONS],
            params={"valueRenderOption": "FORMATTED_VALUE"},
        )
        ranges = response.get("valueRanges", [])
        if len(ranges) != len(SECTIONS):
            raise ValueError("Incomplete Google Sheets database read. No changes were made.")
        headers: dict[str, list[str]] = {}
        content: dict[str, Any] = {}
        for section, result in zip(SECTIONS, ranges):
            headers[section], content[section] = _parse_section(section, result.get("values", []))
        return headers, content

    def load(self) -> dict[str, Any]:
        with _LOCK:
            now = time.monotonic()
            if self._cached is not None and now < self._cache_until:
                return copy.deepcopy(self._cached)
            _, data = self._remote()
            self._cached = data
            self._cache_until = time.monotonic() + _CACHE_SECONDS
            return copy.deepcopy(data)

    def modify(self, func, *args, **kwargs):
        with _LOCK:
            # Always refresh directly from Sheets before a modification.
            # Never mutate a cached copy or write changes to the local JSON file.
            self._cache_until = 0.0
            self._cached = None
            headers, original = self._remote()
            updated = copy.deepcopy(original)
            result = func(updated, *args, **kwargs)
            if set(updated) != set(SECTIONS):
                raise ValueError("A CreditWatch operation unexpectedly changed the database sections")

            batch = []
            clear = []
            touched = []
            for section in SECTIONS:
                if original[section] == updated[section]:
                    continue
                prior_headers = headers[section]
                next_headers = list(prior_headers)
                if section not in MAP_SECTIONS and prior_headers != ["record_json"]:
                    extras = sorted({key for rec in updated[section] for key in rec}
                                    - set(prior_headers))
                    next_headers.extend(extras)
                before = _rows(section, original[section], next_headers)
                after = _rows(section, updated[section], next_headers)
                _validate_cells(section, after)
                if len(set(next_headers)) != len(next_headers):
                    raise ValueError(f"Duplicate headers in section {section}")
                ws = self._worksheets[section]
                needed_rows = 1 + len(after)
                needed_cols = len(next_headers)
                if ws.row_count < needed_rows or ws.col_count < needed_cols:
                    ws.resize(
                        rows=max(ws.row_count, needed_rows),
                        cols=max(ws.col_count, needed_cols),
                    )
                if next_headers != prior_headers:
                    batch.append({"range": f"'{section}'!A1", "values": [next_headers]})
                changed = [i for i, row in enumerate(after)
                           if i >= len(before) or before[i] != row]
                for start, stop in _spans(changed):
                    # Split sizeable updates to keep individual requests bounded.
                    for begin in range(start, stop, 500):
                        end = min(stop, begin + 500)
                        batch.append({
                            "range": f"'{section}'!A{begin + 2}",
                            "values": after[begin:end],
                        })
                if len(after) < len(before):
                    # Clear cells left behind by a deleted report/monitor FY.
                    clear.append(
                        f"'{section}'!A{len(after) + 2}:"
                        f"{_col_label(needed_cols)}{len(before) + 1}"
                    )
                touched.append(section)

            if not touched:
                self._cached = updated
                self._cache_until = time.monotonic() + _CACHE_SECONDS
                return result

            # Sheet updates are NOT a multi-user transaction. This adapter is for
            # one demo app process; do not deploy multiple independent writers.
            if batch:
                _retry(lambda: self._spreadsheet.values_batch_update({
                    "valueInputOption": "RAW", "data": batch,
                }))
            if clear:
                _retry(lambda: self._spreadsheet.values_batch_clear({"ranges": clear}))

            _, verified = self._remote()
            if verified != updated:
                raise RuntimeError(
                    "Google Sheets write verification failed. Check sheet data; "
                    "do not automatically retry or fall back to JSON."
                )
            self._cached = updated
            self._cache_until = time.monotonic() + _CACHE_SECONDS
            return result


def _col_label(number: int) -> str:
    label = ""
    while number:
        number, remainder = divmod(number - 1, 26)
        label = chr(65 + remainder) + label
    return label


def _retry(action):
    import gspread

    for attempt in range(4):
        try:
            return action()
        except gspread.exceptions.APIError as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            if status not in (429, 500, 502, 503, 504) or attempt == 3:
                raise
            time.sleep(min(2 ** (attempt + 1), 10))
