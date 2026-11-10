"""Canonical loan and financial data fields; amounts are INR crore."""
from __future__ import annotations

YEARS = (2024, 2025, 2026)

FINANCIAL_GROUPS = {
    "Profit & loss": {
        "revenue": "Revenue / operating income",
        "cogs": "Cost of goods sold",
        "ebitda": "EBITDA",
        "ebit": "EBIT",
        "interest_expense": "Finance / interest expense",
        "pat": "Profit after tax (PAT)",
    },
    "Balance sheet": {
        "total_assets": "Total assets",
        "total_liabilities": "Total liabilities",
        "equity": "Shareholders' equity",
        "total_debt": "Interest-bearing debt",
        "cash": "Cash and cash equivalents",
        "current_assets": "Current assets",
        "current_liabilities": "Current liabilities",
        "inventory": "Inventories",
        "receivables": "Trade receivables",
        "payables": "Trade payables",
    },
    "Cash flow & debt service": {
        "ocf": "Operating cash flow (OCF)",
        "capex": "Capital expenditure (Capex)",
        "principal_due": "Principal due in financial year",
        "cfads": "Cash available for debt service (CFADS)",
    },
}
FINANCIAL_FIELDS = [f for group in FINANCIAL_GROUPS.values() for f in group]
RATIO_LABELS = {
    "ebitda_margin": "EBITDA margin",
    "net_margin": "PAT margin",
    "gross_margin": "Gross margin",
    "roce": "Return on capital employed",
    "current_ratio": "Current ratio",
    "quick_ratio": "Quick ratio",
    "debt_equity": "Debt / equity",
    "net_debt_ebitda": "Net debt / EBITDA",
    "interest_coverage": "EBIT / interest expense",
    "dscr": "CFADS / debt service",
    "dso": "Receivable days",
    "dio": "Inventory days",
    "dpo": "Payable days",
    "ccc": "Cash conversion cycle",
    "ocf_debt": "OCF / total debt",
    "revenue": "Revenue",
    "ebitda": "EBITDA",
    "total_debt": "Total debt",
    "ocf": "Operating cash flow",
}
PERCENT_METRICS = {"ebitda_margin", "net_margin", "gross_margin", "roce", "ocf_debt"}
DAYS_METRICS = {"dso", "dio", "dpo", "ccc"}
CURRENCY_METRICS = {"revenue", "ebitda", "total_debt", "ocf"}
LOWER_IS_BETTER = {"debt_equity", "net_debt_ebitda", "dso", "dio", "ccc"}

SHEET_COLUMNS = {
    "Borrowers": ["borrower_id", "company_name", "description", "sector", "sub_industry", "location", "created_at", "created_by", "proposed_amount"],
    "Financials": ["revision_id", "borrower_id", "fy", *FINANCIAL_FIELDS, "recorded_at", "recorded_by"],
    "Decisions": ["decision_id", "borrower_id", "status", "decision_at", "decided_by", "note", "sanctioned_amount"],
    "Facilities": ["facility_id", "borrower_id", "facility_type", "sanctioned_limit", "sanction_date", "maturity_date", "annual_interest_rate", "created_at", "created_by"],
    "Transactions": ["transaction_id", "facility_id", "borrower_id", "txn_date", "txn_type", "amount", "recorded_at", "recorded_by"],
    "Assessments": ["assessment_id", "borrower_id", "recorded_at", "recorded_by", "summary", "notes"],
    "AuditLog": ["event_id", "event_at", "actor", "action", "borrower_id", "details"],

    "OutstandingSnapshots": [
        "snapshot_id", "batch_id", "borrower_id",
        "as_of_date", "outstanding_cr", "sanctioned_cr",
        "source_row_count", "match_method",
        "recorded_at", "recorded_by"
    ],
    "OutstandingBatches": [
        "batch_id", "as_of_date", "source_filename",
        "file_sha256", "amount_unit", "imported_at",
        "imported_by", "source_row_count",
        "borrower_count", "outstanding_total_cr", "status"
    ],
}

SECTORS = {
    "Manufacturing": ["Flexible Packaging", "Textiles", "Auto Components", "Food Processing", "Industrial Equipment"],
    "Trading": ["Wholesale Distribution", "Consumer Electronics", "Building Materials"],
    "Services": ["IT Services", "Business Services", "Hospitality"],
    "Agriculture": ["Agri Processing", "Farm Inputs", "Agri Trading"],
    "Logistics": ["Road Transport", "Warehousing", "Freight Forwarding"],
    "Healthcare": ["Hospitals", "Diagnostics", "Medical Devices"],
    "Other / Unclassified": ["Other / Unclassified"],
}
ALL_SUB_INDUSTRIES = [(sec, sub) for sec, subs in SECTORS.items() for sub in subs if sec != "Other / Unclassified"]
