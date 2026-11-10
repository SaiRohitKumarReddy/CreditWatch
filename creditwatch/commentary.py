"""Transparent deterministic post-sanction monitoring narratives using CreditLens ratios.

No new numeric model: every financial ratio is imported from the unchanged
CreditLens computation module and all explanations are tied to actual periods.
"""
from __future__ import annotations

from difflib import SequenceMatcher
from credit_platform.finance import compute_ratios,compact
from .ews import evaluate


def _pct(curr,old):
    if old is None or curr is None or abs(old)<1e-10:return None
    return 100*(curr-old)/abs(old)


def _num(v,dec=2):return "unavailable" if v is None else f"{v:,.{dec}f}"


def _money(v):return "not available" if v is None else f"₹{v:,.2f} crore"


def _history(data,bid):
    source=data["baseline_financials"]+data["monitor_financials"]
    return {int(r["fy"]):r["data"] for r in source
            if r["borrower_id"]==bid and r.get("valid",True)}


def generate_report(data,bid,assessment=None):
    borrower=next((b for b in data["borrowers"] if b["borrower_id"]==bid),None)
    if borrower is None:raise ValueError("Unknown existing approved borrower")
    a=assessment or evaluate(data,bid)
    fin=_history(data,bid)
    fy0=a["baseline_year"];fy1=a["monitoring_year"]
    if not fy0 or not fy1:
        return {"title":"Post-sanction monitoring assessment",
                "executive":"No validated post-sanction monitoring financials are available yet. Original sanctioned financials remain available for reference.",
                "sections":[],"actions":["Obtain and validate the next monitoring period's financial statements."],
                "evidence":[],"method":"CreditLens compute_ratios; insufficient post-sanction financial evidence."}
    old=fin[fy0];cur=fin[fy1];r0=compute_ratios(old);r1=compute_ratios(cur)
    p=lambda metric:_pct(r1.get(metric),r0.get(metric))
    rev_pct=p("revenue");ocf_pct=p("ocf")
    rev_move="increased" if (rev_pct or 0)>0 else "decreased" if (rev_pct or 0)<0 else "remained unchanged"
    margin_delta=(r1.get("ebitda_margin") or 0)-(r0.get("ebitda_margin") or 0)
    pnl=(f"Revenue {rev_move} from {_money(old['revenue'])} in the FY{fy0} sanction-reference actuals "
         f"to {_money(cur['revenue'])} in FY{fy1} ({_num(rev_pct,1)}% movement). "
         f"EBITDA margin moved from {_num(r0.get('ebitda_margin'),1)}% to "
         f"{_num(r1.get('ebitda_margin'),1)}% ({margin_delta:+.1f} percentage points). "
         f"PAT changed from {_money(old['pat'])} to {_money(cur['pat'])}. "
         "The reasons for margin movement require cost-base and operating-volume evidence.")
    proj=next((x for x in data.get("projections",[]) if x["borrower_id"]==bid and x["fy"]==fy1),None)
    if proj and proj.get("revenue",0)>0:
        variance=100*(cur["revenue"]/proj["revenue"]-1)
        pnl+=(f" Compared with the separate synthetic sanction-approved FY{fy1} revenue projection "
              f"of {_money(proj['revenue'])}, the actual was {abs(variance):.1f}% "
              f"{'above' if variance>=0 else 'below'} projection. Actual-to-actual performance and projection variance are distinct.")
    balance=(f"Interest-bearing debt changed from {_money(old['total_debt'])} to {_money(cur['total_debt'])}, "
             f"while debt/equity moved from {_num(r0.get('debt_equity'))}x to {_num(r1.get('debt_equity'))}x. "
             f"The current ratio moved from {_num(r0.get('current_ratio'))}x to "
             f"{_num(r1.get('current_ratio'))}x. "
             "These company-level balances are not the same as the bank's facility-level loan outstanding, "
             "and should be interpreted alongside liquidity and total obligations.")
    cash=(f"Operating cash flow changed from {_money(old['ocf'])} to {_money(cur['ocf'])} "
          f"({_num(ocf_pct,1)}% movement when the percentage is meaningful). "
          f"Cash available for debt service (CFADS) moved from {_money(old['cfads'])} to "
          f"{_money(cur['cfads'])}. Changes could be linked to earnings, working capital or taxes; "
          "the underlying statement and debtor-ageing movements require verification before assigning causality.")
    wc=(f"Receivable days increased or decreased from {_num(r0.get('dso'),1)} to {_num(r1.get('dso'),1)} days. "
        f"Inventory days moved from {_num(r0.get('dio'),1)} to {_num(r1.get('dio'),1)}, "
        f"and the cash conversion cycle from {_num(r0.get('ccc'),1)} to {_num(r1.get('ccc'),1)} days. "
        "For standardization, CreditWatch uses the exact CreditLens year-end receivables/revenue × 365, "
        "inventory/COGS × 365 and payables/COGS × 365 proxy measures rather than a new methodology.")
    dscr=(f"Debt Service Coverage Ratio (DSCR) moved from {_num(r0.get('dscr'))}x at the sanction "
          f"reference to {_num(r1.get('dscr'))}x in FY{fy1}, using unchanged CreditLens "
          "CFADS / (interest expense + principal due). Verify the underlying consolidated debt-service "
          "schedule before a formal credit decision; this is a financial monitoring measurement.")
    active=[s for s in a["signals"] if s["level"] in ("MEDIUM","HIGH","CRITICAL")]
    risk=(f"The ten-signal CreditWatch engine classified the borrower as {a['classification']} "
          f"as of {a['as_of']}, with {len(active)} triggered indicator(s), "
          f"{a['evaluated']} of {a['applicable']} applicable indicators evaluated. "
          +( "Triggered signals: "+"; ".join(f"{s['id']} {s['name']} ({s['level']})" for s in active)+". "
             if active else "No evaluated indicators triggered an alert. ")
          +"Unavailable evidence is not a healthy outcome. Screening alerts are not proof of default, "
          "an RBI SMA/NPA category or a calibrated probability of default.")
    actions=[];codes={s['id'] for s in active}
    if codes.intersection({"CW-01","CW-02","CW-04"}):
        actions.append("Reconcile revolving utilisation and eligible business-credit turnover; verify seasonality, drawing power and collections.")
    if codes.intersection({"CW-11","CW-13","CW-14"}):
        actions.append("Obtain management explanation for post-sanction revenue, cash-flow and debt-service changes; validate a near-term cash forecast.")
    if "CW-16" in codes:actions.append("Verify customer-wise trade receivable ageing, material collection delays and overdue concentration.")
    if "CW-07" in codes:actions.append("Reconcile scheduled obligations and received amounts to the loan ledger, investigate overdue payments and escalate appropriately.")
    if "CW-20" in codes:actions.append("Review sanction covenant definitions, applicable testing dates and any documented waiver or cure before concluding a contractual breach.")
    if "CW-24" in codes:actions.append("Review the internal-rating history, the supporting rating assessment and relevant changes in the borrower's operating conditions.")
    if a["data_gaps"]:actions.append(f"Resolve {a['data_gaps']} missing applicable EWS data input(s), capturing evidence source and observation dates.")
    if not actions:actions.append("Maintain routine post-sanction monitoring and update future financial and account-conduct observations.")
    good=bad=0
    for key in ("revenue","ocf","ebitda_margin","current_ratio","dscr"):
        b=r0.get(key);v=r1.get(key)
        if v is not None and b is not None and abs(b)>1e-10:
            if v>b+abs(b)*.02:good+=1
            if v<b-abs(b)*.02:bad+=1
    overall="mixed" if good and bad else "deteriorating" if bad>good else "improving" if good>bad else "broadly stable"
    executive=(f"Since sanction of the credit facilities on {borrower['sanction_date']}, the available financial "
               f"evidence indicates a {overall} position when FY{fy0} sanctioned-reference historical actuals "
               f"are compared with FY{fy1} monitoring actuals. Revenue moved "
               f"{abs(rev_pct or 0):.1f}% {'up' if (rev_pct or 0)>=0 else 'down'}, "
               f"EBITDA margin changed {margin_delta:+.1f} percentage points, "
               f"and DSCR moved from {_num(r0.get('dscr'))}x to {_num(r1.get('dscr'))}x. "
               f"Current EWS watch category: {a['classification']}. The narrative states observable changes "
               "and identifies possible investigations without inventing causes.")
    if borrower["sanction_date"]>f"{fy1-1}-04-01":
        executive+=(" The FY monitoring period began before formal sanction; the full-year comparison "
                    "therefore includes some pre-sanction business activity and is not exclusively post-disbursement.")
    return {"title":f"FY{fy1} Post-Sanction Credit Monitoring Assessment", "executive":executive,
            "sections":[{"title":"Revenue & operating profitability","body":pnl},
                        {"title":"Balance sheet & financial leverage","body":balance},
                        {"title":"Operating cash flow & debt-service resources","body":cash},
                        {"title":"Working-capital movement","body":wc},
                        {"title":"Debt-servicing capacity","body":dscr},
                        {"title":"Early warning & credit implications","body":risk}],
            "actions":actions,
            "evidence":[{"field":key,"at_sanction":r0.get(key),"current":r1.get(key),
                         "display_baseline":compact(r0.get(key),key),"display_current":compact(r1.get(key),key)}
                        for key in ("revenue","ebitda_margin","current_ratio","debt_equity","dscr","dso","ocf")],
            "method":"Exact CreditLens compute_ratios. Historical actuals available at sanction vs latest monitoring actuals; approved projections are separate. Fully synthetic records."}


def ask_local(data,bid,question):
    """Question-tolerant local evidence assistant; does not claim to call a generative model."""
    if len(question.strip())<3 or len(question)>1000:
        raise ValueError("Ask a question between 3 and 1,000 characters.")
    a=evaluate(data,bid);report=generate_report(data,bid,a)
    q=question.casefold().strip()
    intent_terms={
      "risk":["risk","warning","ews","breach","flag","trigger","alert","why risky"],
      "working":["receivable","recievable","debtors","collection","working capital","wc"],
      "cash":["cash flow","cashflow","ocf","liquidity","operating cash"],
      "debt":["dscr","debt service","repay","interest","coverage"],
      "finance":["financial","finance","financials","commentary","commentry","appraisal","apprasial",
                 "assessment","since sanction","post sanction","improve","worse","deteriorat","summary","report"],
    }
    intent=None
    for name,terms in intent_terms.items():
        if any(term in q for term in terms) or any(SequenceMatcher(None,q,term).ratio()>.78 for term in terms):
            intent=name;break
    sections=report["sections"]
    if not sections:parts=[report["executive"]]
    elif intent=="risk":parts=[sections[-1]["body"]]+[s["detail"] for s in a["signals"] if s["level"] in ("HIGH","CRITICAL")]
    elif intent=="working":parts=[sections[3]["body"]]
    elif intent=="cash":parts=[sections[2]["body"]]
    elif intent=="debt":parts=[sections[4]["body"]]
    else:parts=[report["executive"]]+[f"{x['title']}: {x['body']}" for x in sections]
    return {"mode":"LOCAL_EVIDENCE_ASSISTANT",
            "answer":"\n\n".join(parts)+"\n\nRecommended checks: "+" ".join(report["actions"]),
            "notice":"Local deterministic evidence interpretation, not generative AI. Figures originate in unchanged CreditLens ratio calculations."}
