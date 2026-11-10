# CreditWatch V1 — Evidence, formulas and demo threshold catalogue

All proposed thresholds in this file are **synthetic demonstration policy**, **not RBI instructions**, not calibrated default probabilities, and not production-specific lender risk appetite.

CreditWatch's `credit_platform/finance.py` and `constants.py` are **unchanged copies** from the uploaded CreditLens project. The financial formulas below consume the same `compute_ratios()` outputs. If a future improvement is desired (e.g. average receivables for DSO), it should be versioned and applied consistently in **both** products.

| Signal | Source evidence and measurement | Medium | High | Critical | Special controls |
| --- | --- | --- | --- | --- | --- |
| CW-01 persistent utilisation | Verified facility-level daily CC/OD O/S / effective limit; last 30 days | >=85% for >=15 of 30 days | >=90% for >=20 of 30 days | No automatic critical | 27+ complete observations; exclude term loans; multiple CC/OD use aggregate funded balance / limits |
| CW-02 utilisation deterioration | Change between latest 30-day average CC/OD utilisation and prior 30-day average, in **percentage points** | >=10 pp and latest >=70% | >=20 pp and latest >=70% | No automatic critical | >=27 verified days in both windows; terms loans excluded; correlated with CW-01 |
| CW-04 declining account credits | 100 × (eligible operating credits in current 30 days / comparable preceding 30 days - 1) | <=-15% | <=-25% | No automatic critical | >=27 verified days in each window; excluded internal transfers, new loan proceeds and reversals; seasonality requires review |
| CW-07 payment overdue | Oldest currently unpaid contractual payment's days past due and total unpaid amount | 1–7 days | 8–30 days | 31+ days **internal watch severity** | Due-and-paid events needed; **not** full RBI SMA/NPA classification; product-appropriate rules remain separate |
| CW-11 revenue deterioration | CreditLens `compute_ratios()['revenue']` FY actual vs FY actual | -5% or worse | -15% or worse | No automatic critical | Comparable fiscal periods; actual vs sanctioned projection is a **separate comparison** |
| CW-13 OCF deterioration | CreditLens `compute_ratios()['ocf']` monitoring vs sanction-reference actual | >=20% decline from positive baseline | >=40% decline from positive baseline or OCF turns negative | No automatic critical | No undefined percentages for zero/negative baseline; consider liquidity and seasonality |
| CW-14 DSCR deterioration | CreditLens `compute_ratios()['dscr']` = CFADS / (interest expense + principal due) | latest <1.50x or drop >=0.20x | latest <1.20x or drop >=0.40x with latest <1.50x | No automatic critical | Requires reliable relevant principal, interest and CFADS; compare with covenant **separately** |
| CW-16 receivable days | CreditLens `compute_ratios()['dso']` = closing receivables × 365 / revenue | >=10-day increase **and** >=15% increase | >=20-day increase **and** >=25% increase | No automatic critical | Explicit **closing-balance proxy**, not average-receivable DSO; period comparison must be consistent |
| CW-20 covenant breach | Actual CreditLens ratio vs contractual sanctioned covenant, test FY and any waiver/cure | Within 10% positive headroom, or breach with documented active waiver/cure | Confirmed numerical failure without documented active waiver/cure | Not automatically critical in V1 | Requires sanction document, exact covenant definition and contractual validation; financial deterioration alone is not a covenant breach |
| CW-24 rating migration | Changes in sequential dated internal ratings on the same declared scale; higher numeric code means worse | One-notch worsening | >=2-notch worsening | Verified transition to internal `D` on worsening | Synthetic internal scale is not a bureau rating; same rating methodology required |

## How EWS becomes an overall watch classification

- **Critical** when any verified critical trigger is active.
- **High** for a High repayment/covenant trigger, a DSCR below 1.00x with adequate inputs, or a High signal reinforced by a triggered signal in an **independent risk dimension**.
- **Medium** when at least one trigger is active but neither High nor Critical overall criteria are met.
- **Low** when no triggers are active **and** sufficient applicable indicators are evaluated.
- **Unassessed** where evidence coverage is insufficient to issue a reliable overall conclusion.

CW-01 and CW-02 have the same source/dimension and are not considered independent corroborating risks. Exposure-at-risk totals are borrower-unique: no multiplying the same O/S by multiple active EWS.

## Standardization and documentation

- Amounts are INR **crore**; financial years retain an explicit fiscal year value.
- Original FY2023–FY2025 sanctioned baseline remains separate from FY2026+ monitoring financials.
- Financial statement structural validity uses the **unchanged** `validate_financials()`.
- Ratios and EWS are recomputed after authorized input changes.
- Final report financial/evidence versions are captured separately from live EWS.
- Every triggered EWS contains a visible source, as-of period, observed metric, reference metric, threshold level and explanation.
- **Not Evaluated** (missing/insufficient) and **Not Applicable** (wrong facility type) are distinct from Clear.
- Alerts have an independent case lifecycle from periodic report approvals.

## Acceptance scenarios

Test borrower fixtures cover: a stable borrower, high CC/OD usage, utilisation deterioration, declining eligible credit turnover, overdue instalment, falling sales, lower OCF, falling DSCR, longer receivable days, covenant failure, rating downgrade, missing credit turnover history, term-only borrowing and several overlapping triggers.

This catalogue should be reviewed with institution-specific policy, legal and compliance stakeholders before any non-synthetic use.
