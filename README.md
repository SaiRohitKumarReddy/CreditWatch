# CreditWatch — Corporate & MSME Credit Monitoring

**Standalone HTML + Python app | 10 early warning signals | Realistic, 100% synthetic borrower portfolio**

CreditWatch monitors **existing, previously approved borrowers only**, after sanction. There is **no borrower registration flow or onboarding endpoint**. It was designed as an independent companion to CreditLens, with integration deliberately deferred.

## What is included

- 30 completely fictitious, pre-approved corporate/MSME borrowers across manufacturing, trading, services, healthcare, agriculture and logistics.
- 3 years of original/sanction-reference historical financials (FY2023–FY2025), newer FY2026 monitoring statements for 27 borrowers, some sanction-approved projections, and support for additional monitoring years.
- Exact unchanged copies of **CreditLens `credit_platform/finance.py` and `credit_platform/constants.py`** — same fields, `compute_ratios()`, and `validate_financials()`. Calculation parity is verified by an included SHA-256/test.
- 4,680 synthetic **facility-level** daily outstanding entries; 2,686 synthetic account-credit observations; dated repayments, contractual covenants, internal credit rating histories and facility details.
- 10 deterministic EWS: CW-01, 02, 04, 07, 11, 13, 14, 16, 20, 24. Each exposes level, value, comparison period, evidence source and missing-data handling.
- Separate monitoring-report and ongoing signal/case states; individual investigation cases can remain open until reviewed.
- AVP edits of monitoring statements; VP/CRO edits of **original sanction baseline** with before/after audit history and recalculation.
- Analyst → AVP → VP/CRO review and approval; finalized reports preserve their reviewed financial and EWS snapshots.
- Dedicated CRO monitoring command centre with approval queue, heatmap, signal-breach counts, at-risk funded exposure, risk distribution and borrower-level drill-down.
- An **Ask CreditWatch AI** panel that defaults to accurate local evidence analysis, understands misspellings and can optionally use Groq after configuring a private key and obtaining explicit per-question consent.
- An interactive **synthetic stress-event lab**, where officers can apply a fake missed payment, rating downgrade, high utilisation or falling operating receipts and see the EWS results change.

## V1.1 styling correction (21 October 2026)

This release fixes a Streamlit Components V2 styling issue: JavaScript previously replaced the component's shadow-root contents, deleting the registered stylesheet. Screen updates now target only the dedicated `#creditwatch-html-root` element, preserving Streamlit's CSS and shadow-root variables. This correction does not change the EWS financial logic or borrower records.

For an existing installation, only `frontend/app.js` and `frontend/app.css` need replacement. Stop the running Streamlit process and restart it after copying those files; the component assets are cached for the process lifetime. Your `.local_data/creditwatch_demo.json` is unaffected.

## Quick start — Streamlit (same HTML hosting approach as CreditLens)

From the extracted `CreditWatch_HTML` directory:

```powershell
python -m pip install -r requirements.txt
python -m streamlit run app.py
```

The app opens in the browser at the URL printed by Streamlit (usually `http://localhost:8501`). It uses **Streamlit 1.53+ Components V2** to render the custom HTML/CSS/JavaScript frontend, with all actual computations and mutations on the Python side.

## Optional — standalone FastAPI host

The same front-end and Python service can also run without Streamlit:

```powershell
python -m pip install -r requirements.txt
python -m uvicorn server:app --port 8501
```

Open `http://localhost:8501`. This is useful for conventional web integration tests or a lightweight local prototype.

## Login and roles (demo only)

At startup, choose one of:

| Role | Rights |
| --- | --- |
| **Monitoring Analyst** | View existing borrowers and statements; prepare new-period financial entries; amend own drafts/returned reports; submit monitoring reports; investigate cases. |
| **Monitoring AVP** | Analyst access plus direct corrections of monitoring financials (with audit), AVP report approval/return, and authorized case closure. **No baseline financial editing.** |
| **VP/CRO** | Unrestricted application functions, including **original baseline financial corrections**, all new-period edits, approvals, direct interventions, portfolio monitoring and finalization. |

**This is a deliberately open demonstration role selector, not employee identity verification.** Keep the demo on controlled/local systems. Do not deploy this build with real customer data or pretend the roles are authenticated. Production deployment requires proper login, role grants, data protection and a transactional audited repository.

## Data storage

On the first run, the Python backend creates `.local_data/creditwatch_demo.json` using deterministic pseudorandom seed values. All company names, industries, ratios, payments, defaults and events are invented. The figures reflect plausible relative scales; **they are not real borrower accounts, observed defaults, verified risk thresholds or audited statements**.

To reset the demonstration, stop the server and remove `.local_data/creditwatch_demo.json`. It regenerates on next launch. Do not commit the generated data or include real bank credentials in the project.

The `CREDITWATCH_DATA_FILE` environment variable can override the local JSON path for tests or separate demo environments. JSON is intended for a **single-process prototype only**, not shared concurrent production workloads.

## Standardization with CreditLens

The following two files were copied byte-for-byte from the uploaded `CreditLens_HTML-main.zip`:

```text
CreditWatch_HTML/credit_platform/finance.py
CreditWatch_HTML/credit_platform/constants.py
```

Financial calculations are *not* reimplemented in the EWS or report modules. CW-11, CW-13, CW-14 and CW-16 call `compute_ratios()` directly. Reports use the same metric values. Both apps therefore use identical definitions of CFADS/interest-plus-principal DSCR, year-end receivables/revenue-based DSO, inventory/COGS DIO, payable/COGS DPO and CCC.

**Financial-methodology qualification:** CreditLens's DSO and working-capital days are simplified closing-balance approximations. They are visibly identified as **proxies** in CreditWatch and are not substituted with average-balance formulas without a future *joint* versioned calculation change in both apps.

CreditWatch's post-sanction narratives compare FY2025 sanction-reference actuals with available monitoring actuals, and show sanctioned projections separately when seeded. A monitoring year can contain some months before formal sanction, a limitation the narrative notes. Such year-level comparisons are not a post-disbursement transaction-level attribution.

## Critical policy notes

- EWS thresholds are **illustrative configurable screening policy candidates**, not RBI-mandated limits or calibrated risk thresholds. A generic EWS severity is not SMA/NPA classification, an internal credit grade, or a default probability.
- Facility utilisation indicators apply only to CC/OD, not term loans. CW-01 requires at least 27 of 30 days and CW-02 at least 27 observations in both 30-day windows. Account-credit declines use eligible business-credit totals, excluding simulated non-operating transactions.
- CW-07 overdue duration measures currently unpaid contractual obligations, not the full set of regulatory asset classification criteria. CW-20 evaluates documented synthetic numerical covenants and treats waivers as needing follow-up rather than an automatic confirmed breach.
- Missing, stale and non-applicable inputs are distinct from 'Clear'. CRO dashboards count **distinct borrowers** for affected-exposure measures rather than summing exposures per triggered signal.
- Financials are not silently modified by AI: the evidence assistant only reads verified Python calculations. Generative LLM access is optional and **not shipped with an API key**. Local mode is explicitly labeled deterministic; optional Groq calls require a private key and explicit per-question consent and are rejected if they introduce unsupported numerical claims.
- VP/CRO baseline edits are versioned and visible in the audit history. Already finalized monitoring report snapshots remain historical evidence.

## Project tree

```text
CreditWatch_HTML/
├── app.py                # Streamlit Components V2 host
├── server.py             # Optional FastAPI demo host
├── frontend/
│   ├── index.html
│   ├── app.css
│   └── app.js
├── credit_platform/
│   ├── finance.py        # UNCHANGED from CreditLens
│   └── constants.py      # UNCHANGED from CreditLens
├── creditwatch/
│   ├── seed.py            # Synthetic existing approved borrowers + source evidence
│   ├── ews.py             # Ten evidence-based EWS rules
│   ├── commentary.py      # Post-sanction narrative + local query answers
│   ├── service.py         # Role checks, approval, cases and dashboard payloads
│   └── repository.py      # Atomic single-process JSON demo repository
├── tests/
├── requirements.txt
└── .streamlit/config.toml
```

## Testing

```powershell
python -m pytest -q
```

The included tests cover financial parity, valid synthetic balances, EWS scenarios, rights for each role, AVP/CRO workflow, immutable baseline version history, and snapshot retention.

## Future CreditLens integration

Borrowers and facilities already use stable IDs, and CreditWatch keeps baseline, monitoring and audit data separate. A later sync layer should import **approved CreditLens borrowers**, source financial periods, facilities and outstanding data read-only. CreditWatch VP/CRO baseline amendments should never automatically overwrite CreditLens source entries. Resolve borrower-ID mapping and duplicate prevention explicitly before connecting real applications.

## Optional Groq AI assistant

The local evidence assistant requires **no API key**. To enable optional generative interpretation of synthetic borrower evidence, set environment variables `GROQ_API_KEY` and, if needed, `GROQ_MODEL`. Under Streamlit, you may instead create a **private, gitignored** `.streamlit/secrets.toml` containing `[groq]` and `api_key = "..."`. Do **not** copy credentials into GitHub.

The user must select **Use Groq AI** and explicitly consent for that question. The model only receives structured, synthetic evidence. The Python guard rejects numeric claims not already present in the verified material; if the request fails or output is rejected, the deterministic assistant responds instead. This conservative screening is not equivalent to a full regulated-model validation or human review.
