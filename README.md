
# CreditWatch — Credit Monitoring & Early Warning System

**A Python-based Credit Risk Monitoring and Early Warning System for Corporate and MSME Lending**

CreditWatch is a post-sanction credit monitoring application built using **Python, Streamlit, HTML, CSS, JavaScript, Google Sheets, and Generative AI**.

The application is designed to demonstrate how financial institutions can monitor existing borrowers, assess changes in financial performance, identify early warning signals, investigate emerging risks, and manage monitoring reports through a role-based review and approval process.

CreditWatch uses synthetic borrower data and is intended for demonstration, learning, and application development purposes.

---

## 1. Project Overview

In commercial lending, approving a loan is only the beginning of the credit relationship.

Once a loan has been sanctioned, financial institutions must continue monitoring the borrower's financial performance, repayment behaviour, facility utilisation, contractual covenants, and overall creditworthiness.

A borrower who appeared financially healthy at the time of sanction may subsequently experience declining revenue, cash flow pressure, increasing receivables, repayment delays, or deterioration in debt-servicing capacity.

CreditWatch addresses this monitoring requirement through a centralized application that combines financial analysis, rule-based Early Warning Signals (EWS), investigation workflows, and AI-assisted risk interpretation.

The system focuses on **existing, previously approved borrowers** rather than new loan origination.

---

## 2. Key Features

### Borrower Monitoring

- Monitor existing Corporate and MSME borrowers.
- Review original sanction-period financial statements.
- Add and evaluate post-sanction monitoring financials.
- Compare financial performance across reporting periods.
- Examine outstanding credit facilities, utilisation, and repayment information.
- Track borrower monitoring status and report preparation.

### Financial Analysis

CreditWatch evaluates borrower financial performance using Python-based financial calculations.

Key areas include:

- Revenue and profitability movement
- EBITDA and EBITDA margin
- Operating cash flow
- Debt Service Coverage Ratio (DSCR)
- Liquidity and leverage
- Receivable, inventory, and payable days
- Working capital cycle
- Actual performance against available projections

Financial calculations follow the shared methodology used in the companion CreditLens project.

### Early Warning System (EWS)

CreditWatch includes **10 rule-based Early Warning Signals**.

| Signal | Description |
|---|---|
| CW-01 | Persistent Facility Utilisation |
| CW-02 | Utilisation Deterioration |
| CW-04 | Declining Account Credits |
| CW-07 | Payment Overdue |
| CW-11 | Revenue Deterioration |
| CW-13 | Operating Cash Flow Deterioration |
| CW-14 | DSCR Deterioration |
| CW-16 | Increasing Receivable Days |
| CW-20 | Covenant Breach |
| CW-24 | Credit Rating Migration |

Each signal is evaluated using Python-defined rules and available borrower evidence.

The application distinguishes between triggered signals, severity levels, missing information, and unresolved investigations.

**Note:** The thresholds are illustrative credit monitoring rules and should not be interpreted as RBI-prescribed regulatory classifications.

### Investigation Workflow

CreditWatch allows monitoring officers to investigate individual early warning signals.

Features include:

- Borrower-specific investigation cases
- Signal severity and investigation status
- Investigation findings and supporting observations
- Saved investigation history
- Officer and timestamp information
- Follow-up observations without overwriting earlier findings

Previously saved investigation findings remain accessible when a case is reopened.

### Monitoring Reports & Approvals

The application supports a structured credit monitoring workflow.

**Analyst → AVP → VP/CRO**

- Analysts prepare monitoring financials and reports.
- AVPs review submissions and make authorized corrections.
- VP/CRO users review, return, approve, and finalize monitoring reports.
- Review history and finalized report snapshots are retained.
- Changes are recorded through application audit mechanisms.

### VP/CRO Command Centre

A dedicated executive monitoring dashboard provides visibility into:

- Borrower monitoring status
- Pending review and approval queues
- Triggered Early Warning Signals
- Borrower risk classifications
- Outstanding credit exposure
- Open investigations
- Portfolio-level monitoring trends
- Borrower-level financial and EWS details

---

## 3. AI-Powered Risk Intelligence

CreditWatch includes two AI-assisted capabilities using the Groq API.

### AI Risk Investigation Engine

The AI Risk Investigation Engine interprets relationships between multiple Early Warning Signals affecting a borrower.

It helps explain:

- The borrower's current financial and credit risk situation
- How different warning signals may be connected
- Potential consequences if deterioration continues
- Alternative explanations and evidence gaps
- Recommended monitoring and investigation actions

The AI receives financial calculations, ratios, signal results, and other evidence already prepared by Python.

**The LLM does not independently calculate or change financial ratios, DSCR, facility exposure, or EWS severity.**

### AI Portfolio Intelligence

Available to VP/CRO users, this feature supports natural-language questions about the monitored portfolio.

It assists with interpreting portfolio-level information, including exposure, monitoring status, risk concentrations, and Early Warning Signals.

AI responses are intended as decision-support commentary rather than automated credit decisions.

Generative AI functionality requires a separately configured Groq API key.

---

## 4. User Roles & Permissions

| Role | Responsibilities |
|---|---|
| Monitoring Analyst | Borrower monitoring, financial preparation, EWS investigation and report submission |
| Monitoring AVP | Analyst functions, financial corrections, report review, approval or return, and authorized investigation actions |
| VP/CRO | Portfolio Command Centre, borrower monitoring activation and assignment, full monitoring oversight, final approvals and authorized baseline modifications |

VP/CRO users control the activation of existing borrowers into the monitoring workflow.

The application includes role-based demonstration access. It is not a production identity and access management system.

---

## 5. Technology Stack

| Component | Technology |
|---|---|
| Application Backend | Python |
| Application Hosting | Streamlit |
| Frontend | HTML, CSS, JavaScript |
| API Framework | FastAPI (optional) |
| Database | Google Sheets |
| Local Backup Storage | JSON |
| AI Integration | Groq API |
| Financial Analysis | Python-based calculations |
| Version Control | GitHub |

The custom frontend is integrated with Streamlit, while financial calculations, monitoring logic, database operations, and approval rules are handled by the Python backend.

---

## 6. Database Architecture

CreditWatch originally used a local JSON database.

The application has been updated to support **Google Sheets as its primary persistent storage backend**, with the existing JSON implementation retained for local development and rollback.

The Google Sheets database contains 18 data sections:

1. `metadata`
2. `borrowers`
3. `baseline_financials`
4. `monitor_financials`
5. `facilities`
6. `balances`
7. `account_credits`
8. `repayments`
9. `covenants`
10. `ratings`
11. `reports`
12. `cases`
13. `audit`
14. `signal_events`
15. `projections`
16. `baseline_versions`
17. `borrower_assignments`
18. `monitoring_activations`

The initial migration transferred and verified **8,125 records across all 18 sections**.

The database supports borrower financial history, monitoring activity, approval workflows, investigation records, and audit information.

Structured and nested data is preserved during storage and retrieval.

### Google Sheets Integration

CreditWatch uses a Google Cloud service account and the Google Sheets API to read and write data.

When Google Sheets storage is enabled:

- Application changes are written to Google Sheets.
- Existing borrower information can be retrieved from the shared database.
- Monitoring updates and investigation notes persist across application restarts.
- Local JSON storage remains available as a separate backup option.

The Google Sheets adapter is designed for this demonstration application. Production lending systems would require stronger concurrency management, authentication, audit controls, and transactional database guarantees.

---

## 7. Project Structure

```text
CreditWatch_HTML/
|
|-- app.py
|-- server.py
|-- requirements.txt
|-- README.md
|-- .gitignore
|
|-- frontend/
|   |-- index.html
|   |-- app.css
|   |-- app.js
|
|-- credit_platform/
|   |-- finance.py
|   |-- constants.py
|
|-- creditwatch/
|   |-- repository.py
|   |-- sheets_repository.py
|   |-- storage.py
|   |-- service.py
|   |-- seed.py
|   |-- ews.py
|   |-- commentary.py
|   |-- ai.py
|   |-- ai_intelligence.py
|   |-- ...
|
|-- docs/
|-- tests/
```

The `creditwatch` package contains application logic, financial monitoring functions, EWS evaluations, report workflows, AI integrations, and storage implementations.

Private credential files, generated JSON databases, and local backups are intentionally excluded from the public repository.

---

## 8. Installation & Local Setup

### Prerequisites

- Python 3.11 or later
- Internet access for Google Sheets integration
- Google Cloud service account with Google Sheets access
- Groq API key for optional Generative AI features

### Step 1 — Download the Repository

Download the repository ZIP from GitHub and extract it to your preferred location.

Open a terminal inside the extracted project directory.

### Step 2 — Install Dependencies

```bash
python -m pip install -r requirements.txt
```

### Step 3 — Configure Google Sheets

Create a `.streamlit` folder inside the project directory if it does not exist.

Store the service account JSON credential file privately as:

```text
.streamlit/creditwatch_service_account.json
```

Create a private `.streamlit/secrets.toml` file containing:

```toml
[creditwatch_sheets]
spreadsheet_id = "YOUR_GOOGLE_SPREADSHEET_ID"
```

The Google spreadsheet must be shared with the service account email address with appropriate editing permissions.

**Never commit service account credentials or API keys to GitHub.**

### Step 4 — Select the Database Backend

To use Google Sheets in Windows PowerShell:

```powershell
$env:CREDITWATCH_STORAGE = "sheets"
```

To use local JSON storage instead:

```powershell
$env:CREDITWATCH_STORAGE = "json"
```

If the environment variable is not configured, the application defaults to JSON storage.

For Google Sheets mode, the target spreadsheet must already contain the required worksheets and data. An empty spreadsheet is not automatically initialized by this setting.

### Step 5 — Start the Application

```bash
python -m streamlit run app.py
```

Open the local URL displayed in the terminal, normally:

```text
http://localhost:8501
```

The CreditWatch login interface should appear in your browser.

---

## 9. Groq AI Integration

CreditWatch integrates the **Groq API** to power two AI intelligence capabilities: the **AI Risk Investigation Engine** and **AI Portfolio Intelligence**.

The AI Risk Investigation Engine examines relationships across borrower-specific Early Warning Signals and financial evidence. It produces structured interpretations of current credit risk, connected warning indicators, potential consequences of continued deterioration, evidence gaps, and recommended monitoring actions.

AI Portfolio Intelligence provides VP/CRO users with a natural-language interface for analysing portfolio exposure, risk classifications, borrower monitoring status, and Early Warning Signals.

Both capabilities operate on financial information, ratios, EWS results, and portfolio aggregates calculated by the Python backend. The LLM is responsible for interpretation, not financial computation.

CreditWatch uses Groq's `openai/gpt-oss-20b` model for these intelligence features.

A valid Groq API key must be configured securely in the deployment environment to execute live AI requests. The API key is never included in the public GitHub repository.

---

## 10. Running with FastAPI

CreditWatch also includes an optional FastAPI host.

To run the application using FastAPI:

```bash
python -m uvicorn server:app --port 8501
```

Open:

```text
http://localhost:8501
```

Streamlit remains the primary demonstration hosting option.

---

## 11. Synthetic Demonstration Dataset

CreditWatch includes a synthetic Corporate and MSME borrower portfolio.

The original demonstration dataset contains:

| Data Category | Records |
|---|---:|
| Borrowers | 30 |
| Baseline Financials | 90 |
| Monitoring Financials | 27 |
| Facilities | 57 |
| Facility Balances | 4,680 |
| Account Credit Records | 2,686 |
| Repayments | 156 |
| Monitoring Reports | 27 |
| Investigation Cases | 111 |
| Signal Events | 111 |

The initial Google Sheets migration contained **8,125 records in total**, including additional metadata, ratings, covenants, projections, assignments, and audit information.

These counts describe the initial dataset and may change as users interact with the application.

All borrower identities, financial statements, repayments, monitoring outcomes, and credit events are synthetic.

---

## 12. Financial Calculation Principles

CreditWatch uses Python to calculate financial metrics and evaluate Early Warning Signals.

The AI layer is not permitted to replace these calculations with independently generated figures.

Key design principles include:

- Consistent financial calculations across the application
- Evidence-based EWS triggering
- Separation of monitoring actuals and sanction-reference financials
- Distinction between missing data and genuine warning signals
- Preservation of original financial information and authorized amendment history
- Retention of historical monitoring report snapshots
- Separation of deterministic risk calculations and AI interpretation

Certain financial indicators, including working capital days, use simplified closing-balance approximations suitable for the synthetic demonstration dataset.

---

## 13. Testing & Validation

The project includes Python tests covering aspects of financial calculations, EWS logic, borrower monitoring, permissions, and approval workflows.

Run tests using:

```bash
python -m pytest -q
```

The Google Sheets migration was also validated through:

- Comparison of original JSON records against Google Sheets records
- Read, write, and delete operations
- Application-level investigation updates
- Persistence verification after application restart
- Retrieval and display of previously saved investigation findings

These checks validate the implemented demonstration workflows and do not constitute production-system or regulatory validation.

---

## 14. Relationship with CreditLens

CreditWatch has been developed as a standalone companion application to CreditLens.

**CreditLens** focuses on borrower credit assessment, financial analysis, lending appraisal, and approval.

**CreditWatch** focuses on monitoring borrowers after sanction, identifying deterioration, investigating warning signals, and reviewing ongoing credit exposure.

Future integration may allow approved CreditLens borrowers to be transferred into CreditWatch for post-sanction monitoring.

The applications are currently separate, and the proposed integration is not yet implemented.

---

## 15. Deployment & Security Notes

This repository contains application source code only.

For deployment, configure Google Sheets and AI credentials securely in the hosting environment.

Do not upload:

- Google service account private keys
- Groq API keys
- `.streamlit/secrets.toml`
- Local JSON database files
- Backup folders
- Python cache files

Local Windows environment variables are not automatically transferred to cloud hosting environments.

CreditWatch uses demonstration-oriented role selection. It should not be exposed as a production lending application or connected to real borrower data without implementing appropriate identity verification, authorization, encryption, concurrency controls, and operational safeguards.

---

## 16. Disclaimer

CreditWatch is a **demonstration and educational application** developed using synthetic borrower and financial data.

It is not a production credit decision system, regulatory monitoring platform, or substitute for professional credit appraisal.

EWS severity levels, financial thresholds, portfolio classifications, and AI observations are illustrative.

The application is intended to demonstrate practical approaches to post-sanction credit monitoring, financial analysis, workflow management, persistent data storage, and AI-assisted credit risk interpretation.

---

**CreditWatch — Corporate & MSME Credit Monitoring and Early Warning Intelligence**
