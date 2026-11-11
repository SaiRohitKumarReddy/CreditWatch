"""Controlled onboarding of newly sanctioned borrowers into the CreditWatch master.

Creation does NOT activate monitoring or assign an Analyst. Never synthesise transaction
history, EWS alerts, ratings, repayment obligations, or monitoring reports on registration.
All inputs and permissions are checked again on the server.
"""
from __future__ import annotations

import math
import re
from datetime import date, timedelta

from credit_platform.constants import FINANCIAL_FIELDS, FINANCIAL_GROUPS, SECTORS
from credit_platform.finance import validate_financials
from .repository import audit, utcnow

FACILITY_TYPES = ("CC", "OD", "TERM", "BG")
LEGAL_CONSTITUTIONS = (
    "Private Limited", "Public Limited", "LLP", "Partnership",
    "Proprietorship", "Other",
)


def next_borrower_id(data: dict) -> str:
    """Do not reuse IDs after deletion or assume the list has contiguous IDs."""
    numbers = [int(m.group(1)) for b in data.get("borrowers", [])
               if (m := re.fullmatch(r"CW-(\d+)", str(b.get("borrower_id", ""))))]
    return f"CW-{max(numbers, default=0) + 1:04d}"


def onboarding_options(data: dict, result=None) -> dict:
    sectors = {name: list(values) for name, values in SECTORS.items()}
    # Existing approved portfolio may contain sub-industries outside the static catalog.
    for b in data.get("borrowers", []):
        sector = str(b.get("sector", "")).strip()
        sub = str(b.get("sub_industry", "")).strip()
        if sector and sub:
            sectors.setdefault(sector, [])
            if sub not in sectors[sector]:
                sectors[sector].append(sub)
    return {
        "next_id": next_borrower_id(data),
        "sectors": sectors,
        "financial_groups": FINANCIAL_GROUPS,
        "facility_types": list(FACILITY_TYPES),
        "legal_constitutions": list(LEGAL_CONSTITUTIONS),
        "result": result,
    }


def _text(value, label: str, min_length=1, max_length=160) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{label} must be text.")
    value = " ".join(value.strip().split())
    if not min_length <= len(value) <= max_length:
        raise ValueError(f"{label} must be {min_length}-{max_length} characters.")
    return value


def _date(value, label: str) -> date:
    try:
        if not isinstance(value, str):
            raise ValueError
        return date.fromisoformat(value)
    except (ValueError, TypeError) as exc:
        raise ValueError(f"Enter a valid {label} (YYYY-MM-DD).") from exc


def _amount(value, label: str, *, allow_empty=False, low=0.0, high=1e8):
    if allow_empty and (value is None or value == ""):
        return None
    if isinstance(value, bool) or value is None or (isinstance(value, str) and not value.strip()):
        raise ValueError(f"Enter a numeric {label}.")
    try:
        num = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Enter a numeric {label}.") from exc
    if not math.isfinite(num) or not low <= num <= high:
        raise ValueError(f"{label} must be between {low:g} and {high:g}.")
    return round(num, 6)


def register_borrower(data: dict, payload: dict, actor: str) -> str:
    """Validate the complete submission before changing any in-memory data."""
    if not isinstance(payload, dict):
        raise ValueError("Invalid onboarding submission.")
    if len(str(payload)) > 850000:
        raise ValueError("Onboarding payload is too large.")

    company = _text(payload.get("company_name"), "Borrower name", 3, 180)
    legal = _text(payload.get("legal_constitution"), "Legal constitution")
    if legal not in LEGAL_CONSTITUTIONS:
        raise ValueError("Select an available legal constitution.")
    sector = _text(payload.get("sector"), "Industry sector")
    if sector not in onboarding_options(data)["sectors"]:
        raise ValueError("Select an existing industry sector.")
    subsector = _text(payload.get("sub_industry"), "Sub-sector", 2, 120)
    location = _text(payload.get("location"), "Registered office location", 3, 150)
    reg_no = _text(payload.get("registration_no"), "CIN / registration number", 5, 40).upper()
    gstin = _text(payload.get("gstin"), "GSTIN", 15, 15).upper()
    if not re.fullmatch(r"[A-Z0-9/-]{5,40}", reg_no):
        raise ValueError("CIN / registration number contains unsupported characters.")
    if not re.fullmatch(r"[0-9]{2}[A-Z0-9]{13}", gstin):
        raise ValueError("GSTIN must be a 15-character alphanumeric Indian GST identifier.")
    segment = _text(payload.get("segment"), "Borrower segment")
    if segment not in ("MSME", "Corporate"):
        raise ValueError("Choose MSME or Corporate as the borrower segment.")
    description = _text(payload.get("description") or "", "Business description", 0, 750)
    sanction_date = _date(payload.get("sanction_date"), "sanction date")
    if sanction_date > date.today():
        raise ValueError("Sanction date cannot be in the future.")
    due_date = _date(payload.get("monitoring_due_date"), "first monitoring due date")
    if due_date < sanction_date:
        raise ValueError("First monitoring due date cannot precede sanction date.")

    norm = lambda value: re.sub(r"\s+", " ", str(value or "").strip()).casefold()
    for existing in data["borrowers"]:
        if norm(existing.get("company_name")) == norm(company):
            raise ValueError("This borrower name already exists in CreditWatch. Open the existing record.")
        if norm(existing.get("registration_no")) == norm(reg_no):
            raise ValueError("This CIN / registration number is already registered.")
        if norm(existing.get("gstin")) == norm(gstin):
            raise ValueError("This GSTIN is already registered.")

    raw_facilities = payload.get("facilities")
    if not isinstance(raw_facilities, list) or not 1 <= len(raw_facilities) <= 8:
        raise ValueError("Add between 1 and 8 sanctioned facilities.")
    clean_facilities = []
    for i, f in enumerate(raw_facilities, start=1):
        if not isinstance(f, dict):
            raise ValueError(f"Facility {i} has an invalid structure.")
        ftype = str(f.get("facility_type", "")).strip().upper()
        if ftype not in FACILITY_TYPES:
            raise ValueError(f"Facility {i}: choose CC, OD, TERM or BG.")
        limit = _amount(f.get("sanctioned_limit"), f"facility {i} sanctioned limit", low=0.000001)
        rate = _amount(f.get("interest_rate"), f"facility {i} annual interest rate", high=40)
        maturity = _date(f.get("maturity_date"), f"facility {i} maturity date")
        if maturity < sanction_date:
            raise ValueError(f"Facility {i}: maturity date cannot precede sanction date.")
        outstanding = _amount(f.get("outstanding_cr"), f"facility {i} opening outstanding", allow_empty=True)
        if ftype == "BG" and outstanding is not None:
            raise ValueError(f"Facility {i}: bank guarantees do not use funded outstanding. Leave it blank.")
        if outstanding is not None and outstanding > limit + 1e-6:
            raise ValueError(f"Facility {i}: opening outstanding exceeds the sanctioned limit.")
        clean_facilities.append({
            "facility_type": ftype, "sanctioned_limit": limit,
            "interest_rate": rate, "sanction_date": sanction_date.isoformat(),
            "maturity_date": maturity.isoformat(), "opening_outstanding": outstanding,
        })

    raw_baselines = payload.get("baselines")
    if not isinstance(raw_baselines, list) or not 1 <= len(raw_baselines) <= 3:
        raise ValueError("Enter 1 to 3 baseline financial years.")
    clean_baselines = []
    seen_years = set()
    for entry in raw_baselines:
        if not isinstance(entry, dict):
            raise ValueError("Invalid baseline financial entry.")
        try:
            fy = int(entry.get("fy"))
        except (TypeError, ValueError) as exc:
            raise ValueError("Select a valid baseline financial year.") from exc
        if fy < 2015 or fy > sanction_date.year or fy > date.today().year:
            raise ValueError(f"FY{fy} cannot be used as a sanction-reference financial year.")
        if fy in seen_years:
            raise ValueError(f"FY{fy} is entered more than once.")
        seen_years.add(fy)
        statement_type = str(entry.get("statement_type", "Audited"))
        if statement_type not in ("Audited", "Provisional"):
            raise ValueError(f"FY{fy}: choose Audited or Provisional.")
        raw_values = entry.get("data")
        if not isinstance(raw_values, dict):
            raise ValueError(f"FY{fy}: financial statements are required.")
        values = {field: _amount(raw_values.get(field), f"FY{fy} {field}", low=-1e8)
                  for field in FINANCIAL_FIELDS}
        errors, warnings = validate_financials(values, fy)
        if errors:
            raise ValueError(" ".join(errors[:4]))
        clean_baselines.append({"fy": fy, "statement_type": statement_type,
                                "data": values, "validation_warnings": warnings})

    bid = next_borrower_id(data)
    stamp = utcnow()
    borrower = {
        "borrower_id": bid, "company_name": company,
        "legal_constitution": legal, "registration_no": reg_no, "gstin": gstin,
        "sector": sector, "sub_industry": subsector, "segment": segment,
        "location": location, "description": description,
        "sanction_date": sanction_date.isoformat(),
        "sanction_fy": sanction_date.year,
        "baseline_locked": True, "approval_status": "APPROVED",
        "monitoring_due_date": due_date.isoformat(),
        "created_at": stamp, "created_by": actor,
        "source": "Manual sanctioned borrower onboarding",
    }
    facilities = []
    balances = []
    for idx, f in enumerate(clean_facilities, start=1):
        fid = f"{bid}-F{idx:02d}"
        opening = f.pop("opening_outstanding")
        facilities.append({**f, "facility_id": fid, "borrower_id": bid,
                           "source": "Manual sanctioned borrower onboarding"})
        if opening is not None:
            balances.append({
                "borrower_id": bid, "facility_id": fid,
                "date": date.today().isoformat(), "outstanding_cr": opening,
                "sanctioned_limit_cr": f["sanctioned_limit"],
                "complete": True, "source": "Onboarding opening snapshot (one observation only)",
            })
    baselines = [{"borrower_id": bid, "fy": row["fy"], "data": row["data"],
                  "statement_type": row["statement_type"], "valid": True,
                  "validation_warnings": row["validation_warnings"],
                  "source": "Manual sanction-reference financials",
                  "updated_at": stamp, "updated_by": actor}
                 for row in sorted(clean_baselines, key=lambda x: x["fy"])]

    data["borrowers"].append(borrower)
    data["facilities"].extend(facilities)
    data["baseline_financials"].extend(baselines)
    data["balances"].extend(balances)
    # Do NOT create monitoring_activations, reports, synthetic balances, or EWS cases.
    audit(data, actor, "borrower_onboarded", bid, {
        "company_name": company, "baseline_years": [x["fy"] for x in baselines],
        "facility_count": len(facilities), "snapshot_count": len(balances),
        "monitoring_active": False,
    })
    return bid
