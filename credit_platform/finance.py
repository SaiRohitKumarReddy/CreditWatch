"""Deterministic, auditable financial-ratio calculations. No LLM calculations."""
from __future__ import annotations
import math
from .constants import FINANCIAL_FIELDS, RATIO_LABELS, PERCENT_METRICS, DAYS_METRICS, CURRENCY_METRICS


def number(v, default=0.0):
    try:
        if v is None or str(v).strip() == "":
            return default
        result = float(v)
        return result if math.isfinite(result) else default
    except (ValueError, TypeError):
        return default


def div(numerator, denominator):
    numerator, denominator = number(numerator, None), number(denominator, None)
    if numerator is None or denominator is None or abs(denominator) < 1e-10:
        return None
    return numerator / denominator


def percent(numerator, denominator):
    x = div(numerator, denominator)
    return x * 100 if x is not None else None


def compute_ratios(fin):
    f = {k: number(fin.get(k), 0) for k in FINANCIAL_FIELDS}
    rev, cogs = f["revenue"], f["cogs"]
    debt, cash, equity = f["total_debt"], f["cash"], f["equity"]
    ebitda, ebit, interest = f["ebitda"], f["ebit"], f["interest_expense"]
    current_assets, current_liabilities = f["current_assets"], f["current_liabilities"]
    debt_service = interest + f["principal_due"]
    return {
        "revenue": rev,
        "ebitda": ebitda,
        "total_debt": debt,
        "ocf": f["ocf"],
        "gross_margin": percent(rev-cogs, rev),
        "ebitda_margin": percent(ebitda, rev),
        "net_margin": percent(f["pat"], rev),
        "roce": percent(ebit, f["total_assets"] - current_liabilities),
        "current_ratio": div(current_assets, current_liabilities),
        "quick_ratio": div(current_assets - f["inventory"], current_liabilities),
        "debt_equity": div(debt, equity),
        "net_debt_ebitda": div(debt - cash, ebitda) if ebitda > 0 else None,
        "interest_coverage": div(ebit, interest),
        "dscr": div(f["cfads"], debt_service) if debt_service > 0 and "cfads" in fin and str(fin["cfads"]).strip() else None,
        "dso": div(f["receivables"]*365, rev),
        "dio": div(f["inventory"]*365, cogs),
        "dpo": div(f["payables"]*365, cogs),
        "ccc": None,
        "ocf_debt": percent(f["ocf"], debt),
    } | _ccc(f)


def _ccc(f):
    dso = div(f["receivables"]*365, f["revenue"])
    dio = div(f["inventory"]*365, f["cogs"])
    dpo = div(f["payables"]*365, f["cogs"])
    return {"ccc": dso + dio - dpo if None not in (dso, dio, dpo) else None}


def validate_financials(fin, fy):
    """Hard stops for structural errors; soft warnings for unusual but valid cases."""
    x = {k: number(fin.get(k), 0) for k in FINANCIAL_FIELDS}
    errors, warnings = [], []
    if x["revenue"] <= 0:
        errors.append(f"FY{fy}: Revenue must be greater than zero.")
    if x["total_assets"] <= 0:
        errors.append(f"FY{fy}: Total assets must be greater than zero.")
    nonnegative = ["cogs", "interest_expense", "total_assets", "total_liabilities", "total_debt", "cash", "current_assets", "current_liabilities", "inventory", "receivables", "payables", "capex", "principal_due"]
    for k in nonnegative:
        if x[k] < 0:
            errors.append(f"FY{fy}: {k.replace('_', ' ').capitalize()} cannot be negative.")
    if x["current_assets"] > x["total_assets"] + .01:
        errors.append(f"FY{fy}: Current assets exceed total assets.")
    if x["current_liabilities"] > x["total_liabilities"] + .01:
        errors.append(f"FY{fy}: Current liabilities exceed total liabilities.")
    if x["cash"] + x["inventory"] + x["receivables"] > x["current_assets"] + max(.01, x["current_assets"]*.01):
        warnings.append(f"FY{fy}: Cash + inventories + receivables exceed reported current assets; check classifications.")
    balance_gap = abs(x["total_assets"] - x["total_liabilities"] - x["equity"])
    if balance_gap > max(.05, x["total_assets"]*.01):
        errors.append(f"FY{fy}: Balance sheet does not balance (difference: ₹{balance_gap:.2f} Cr).")
    if x["ebitda"] < x["ebit"] - .01:
        warnings.append(f"FY{fy}: EBIT exceeds EBITDA; confirm depreciation/amortisation adjustments.")
    if x["cfads"] == 0 and x["principal_due"] > 0:
        warnings.append(f"FY{fy}: No positive CFADS reported; DSCR cannot be interpreted unless CFADS is supplied.")
    return errors, warnings


def compact(v, metric, missing="—"):
    if v is None or not math.isfinite(number(v, float("nan"))):
        return missing
    if metric in PERCENT_METRICS:
        return f"{v:,.1f}%"
    if metric in DAYS_METRICS:
        return f"{v:,.0f} d"
    if metric in CURRENCY_METRICS:
        return f"₹{v:,.1f} Cr"
    return f"{v:,.2f}x"


def trend_text(fin_by_year, ratios_by_year):
    """Rule-based, evidenced observations (not an AI output)."""
    ys = sorted(fin_by_year)
    if len(ys) < 2:
        return ["Enter at least two financial years to evaluate a trend."]
    first, last = ratios_by_year[ys[0]], ratios_by_year[ys[-1]]
    messages = []
    def vals(k):
        return [ratios_by_year[y].get(k) for y in ys]
    def change(metric, wording, adverse_up=True, threshold=0.15):
        values = vals(metric)
        if all(v is not None for v in values) and abs(values[0]) > 1e-7:
            magnitude = (values[-1] - values[0]) / abs(values[0])
            if abs(magnitude) >= threshold:
                direction = "increased" if magnitude > 0 else "decreased"
                impact = "a pressure signal" if (magnitude > 0) == adverse_up else "a potentially favourable signal"
                messages.append(f"{wording} {direction} from {compact(values[0], metric)} to {compact(values[-1], metric)} over FY{ys[0]}–FY{ys[-1]};")
    change("revenue", "Revenue", adverse_up=False)
    change("ebitda_margin", "EBITDA margin", adverse_up=False)
    change("net_debt_ebitda", "Net debt / EBITDA", adverse_up=True)
    change("current_ratio", "Current ratio", adverse_up=False)
    change("interest_coverage", "Interest coverage", adverse_up=False)
    change("ccc", "Cash conversion cycle", adverse_up=True)
    if first.get("ocf") is not None and last.get("ocf") is not None and last["ocf"] < 0:
        messages.append("Latest-year operating cash flow is negative; review working capital absorption and non-cash earnings adjustments.")
    if not messages:
        messages.append("No material rule-based movements crossed the defined screening thresholds. Review the detailed ratios and borrower context before drawing conclusions.")
    return messages
