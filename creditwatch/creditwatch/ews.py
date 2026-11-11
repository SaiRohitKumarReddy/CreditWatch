"""CreditWatch's ten deterministic, evidence-based post-sanction EWS rules.

Screening thresholds are demonstration policy, NOT RBI SMA/NPA classification,
not verified default probabilities, and not lender-certified limits.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from credit_platform.finance import compute_ratios

IDS = ("CW-01", "CW-02", "CW-04", "CW-07", "CW-11", "CW-13", "CW-14", "CW-16", "CW-20", "CW-24")
CATALOG = {
    "CW-01":("Persistent utilisation","Account conduct"),
    "CW-02":("Utilisation deterioration","Account conduct"),
    "CW-04":("Declining account credits","Account inflows"),
    "CW-07":("Payment overdue","Repayment performance"),
    "CW-11":("Revenue deterioration","Financial performance"),
    "CW-13":("Operating cash-flow deterioration","Cash generation"),
    "CW-14":("DSCR deterioration","Debt service"),
    "CW-16":("Receivable days","Working capital"),
    "CW-20":("Covenant breach","Covenant compliance"),
    "CW-24":("Credit rating migration","Rating migration"),
}
SEVERITY_ORDER = {"NOT_APPLICABLE":-2,"NOT_EVALUATED":-1,"STALE":-1,
                  "CLEAR":0,"MEDIUM":1,"HIGH":2,"CRITICAL":3}


def _signal(sid, level="NOT_EVALUATED", observed=None, reference=None, detail="Required evidence is missing.",
            unit="", source="", date_at="", notes=""):
    name, category = CATALOG[sid]
    return {"id":sid, "name":name,"category":category,"level":level,"observed":observed,
            "reference":reference,"unit":unit,"detail":detail,"source":source,
            "as_of":date_at,"notes":notes}


def _financials(data,bid):
    rows=[x for x in data["baseline_financials"]+data["monitor_financials"] if x["borrower_id"]==bid and x.get("valid",True)]
    return {int(x["fy"]):x["data"] for x in sorted(rows,key=lambda r:r.get("updated_at",""))}


def _window(data, field, bid, start:date, end:date, *, fid=None):
    bydate=defaultdict(list)
    for item in data[field]:
        if item["borrower_id"] != bid: continue
        if fid is not None and item.get("facility_id") != fid: continue
        d=date.fromisoformat(item["date"])
        if start<=d<=end and item.get("complete",True):bydate[d].append(item)
    return bydate


def _cc_facilities(data,bid):
    return [f for f in data["facilities"] if f["borrower_id"]==bid and f["facility_type"] in ("CC","OD")]


def _calculation_values(data,bid,asof):
    cc=_cc_facilities(data,bid)
    by_key={(r["facility_id"],r["date"]):r for r in data["balances"]
            if r["borrower_id"]==bid and r.get("complete",True)}
    arr=[]
    for delta in range(59,-1,-1):
        dt=asof-timedelta(days=delta)
        vals=[]
        for fac in cc:
            row=by_key.get((fac["facility_id"],dt.isoformat()))
            if row is None or fac["sanctioned_limit"]<=0:
                vals=[];break
            vals.append((float(row["outstanding_cr"]),
                         float(row.get("sanctioned_limit_cr",fac["sanctioned_limit"]))))
        if vals:
            used=sum(v[0] for v in vals);limit=sum(v[1] for v in vals)
            arr.append((dt,100*used/limit if limit>0 else None))
    return arr


def evaluate(data:dict,bid:str,as_of:str|date|None=None) -> dict:
    asof = date.fromisoformat(as_of) if isinstance(as_of,str) else (as_of or date.fromisoformat(data["metadata"]["generated_as_of"]))
    stamp=asof.isoformat()
    fin=_financials(data,bid)
    # Resolve FYs from their actual data sections, not a hard-coded 2025/2026
    # cutoff. New sanctions can have a FY2026+ baseline while historic records
    # retain exactly their existing interpretation.
    baseline_year=max((int(r["fy"]) for r in data["baseline_financials"]
                       if r["borrower_id"]==bid and r.get("valid",True)), default=None)
    monitoring_year=max((int(r["fy"]) for r in data["monitor_financials"]
                         if r["borrower_id"]==bid and r.get("valid",True)), default=None)
    curr=fin.get(monitoring_year) if monitoring_year else None
    baseline=fin.get(baseline_year) if baseline_year else None
    base_r=compute_ratios(baseline) if baseline else {}
    cur_r=compute_ratios(curr) if curr else {}
    results={}

    # Revolving-credit utilisation. Does not apply to term-loan-only borrowers.
    revolving=_cc_facilities(data,bid)
    if not revolving:
        results["CW-01"]=_signal("CW-01","NOT_APPLICABLE",detail="No CC/OD facility on record.",source="Facility master",date_at=stamp)
        results["CW-02"]=_signal("CW-02","NOT_APPLICABLE",detail="No CC/OD facility on record.",source="Facility master",date_at=stamp)
    else:
        points=_calculation_values(data,bid,asof)
        latest=[u for d,u in points if d>=asof-timedelta(days=29)]
        prev=[u for d,u in points if asof-timedelta(days=59)<=d<asof-timedelta(days=29)]
        if len(latest)>=27:
            over85=sum(u>=85 for u in latest);over90=sum(u>=90 for u in latest)
            level="HIGH" if over90>=20 else "MEDIUM" if over85>=15 else "CLEAR"
            results["CW-01"]=_signal("CW-01",level,round(sum(latest)/len(latest),1),None,
                      f"{over90} of {len(latest)} verified days at or above 90%; {over85} days at or above 85%.",
                      "% 30-day average","Synthetic facility-level daily O/S",stamp)
        else:
            results["CW-01"]=_signal("CW-01",detail=f"Only {len(latest)} of 30 daily observations verified (minimum 27).",source="Daily O/S",date_at=stamp)
        if len(latest)>=27 and len(prev)>=27:
            curr_avg=sum(latest)/len(latest);old_avg=sum(prev)/len(prev)
            delta=curr_avg-old_avg
            level="HIGH" if (curr_avg>=70 and delta>=20) else "MEDIUM" if (curr_avg>=70 and delta>=10) else "CLEAR"
            results["CW-02"]=_signal("CW-02",level,round(curr_avg,1),round(old_avg,1),
                     f"Latest 30-day average {curr_avg:.1f}% vs previous 30-day average {old_avg:.1f}%; movement {delta:+.1f} percentage points.",
                     "% utilisation","Synthetic facility-level daily O/S",stamp)
        else:
            results["CW-02"]=_signal("CW-02",detail=f"Need 27+ verified days in both 30-day windows (available: {len(prev)}, {len(latest)}).",source="Daily O/S",date_at=stamp)

    # Credits are qualifying operating credits, excluding transfers and new debt drawdowns.
    old_window=_window(data,"account_credits",bid,asof-timedelta(days=59),asof-timedelta(days=30))
    new_window=_window(data,"account_credits",bid,asof-timedelta(days=29),asof)
    if len(old_window)>=27 and len(new_window)>=27:
        prior=sum(sum(float(x["eligible_credit_cr"]) for x in z) for z in old_window.values())
        latest=sum(sum(float(x["eligible_credit_cr"]) for x in z) for z in new_window.values())
        if prior>1e-8:
            change=100*(latest/prior-1)
            level="HIGH" if change<=-25 else "MEDIUM" if change<=-15 else "CLEAR"
            results["CW-04"]=_signal("CW-04",level,round(latest,3),round(prior,3),
                           f"Eligible operating credits changed {change:+.1f}% over two comparable 30-day periods; seasonal drivers require review.",
                           "INR Cr / 30 days","Synthetic bank-account credit totals",stamp)
        else:
            results["CW-04"]=_signal("CW-04",detail="Prior period operating credits are zero; percentage movement cannot be evaluated.",source="Account credit data",date_at=stamp)
    else:
        results["CW-04"]=_signal("CW-04",detail=f"Verified daily credit coverage {len(old_window)}/30 and {len(new_window)}/30; minimum is 27 in each window.",source="Account credit data",date_at=stamp)

    # Overdue based on unpaid contractual obligations, not synthetic SMA classification.
    all_dues=[r for r in data["repayments"] if r["borrower_id"]==bid and date.fromisoformat(r["due_date"])<=asof]
    if all_dues:
        pending=[r for r in all_dues if float(r["amount_due_cr"])-float(r.get("paid_cr",0))>1e-6]
        oldest=max((asof-date.fromisoformat(r["due_date"])).days for r in pending) if pending else 0
        unpaid=sum(float(r["amount_due_cr"])-float(r.get("paid_cr",0)) for r in pending)
        lev="CRITICAL" if oldest>=31 else "HIGH" if oldest>=8 else "MEDIUM" if oldest>=1 else "CLEAR"
        results["CW-07"]=_signal("CW-07",lev,oldest,round(unpaid,3),
                 f"{len(pending)} unpaid scheduled obligations; oldest unpaid due {oldest} days ago; unpaid total ₹{unpaid:.3f} Cr. Internal EWS bands only, not SMA/NPA.",
                 "days overdue","Synthetic loan repayment ledger",stamp)
    else:
        results["CW-07"]=_signal("CW-07",detail="No verified due-and-paid schedule available for an obligation already due.",source="Repayment ledger",date_at=stamp)

    # Financials inherit the EXACT unchanged CreditLens compute_ratios formulae.
    for sid,metric,unit in (("CW-11","revenue","INR Cr"),("CW-13","ocf","INR Cr"),
                            ("CW-14","dscr","x"),("CW-16","dso","days")):
        a=base_r.get(metric);b=cur_r.get(metric)
        if a is None or b is None:
            results[sid]=_signal(sid,detail=f"Missing comparable sanctioned actual FY{baseline_year or '—'} and monitoring FY{monitoring_year or '—'} for {metric}.",source="CreditLens-standard finance engine",date_at=stamp)
            continue
        if sid=="CW-11":
            delta=(b/a-1)*100 if a>0 else None
            level="HIGH" if delta is not None and delta<=-15 else "MEDIUM" if delta is not None and delta<=-5 else "CLEAR"
            detail=f"Revenue {delta:+.1f}% from FY{baseline_year} to FY{monitoring_year}." if delta is not None else "Invalid revenue baseline."
        elif sid=="CW-13":
            if a>0:
                delta=100*(b/a-1)
                level="HIGH" if b<0 or delta<=-40 else "MEDIUM" if delta<=-20 else "CLEAR"
                detail=f"Operating cash flow {delta:+.1f}% since sanction-reference FY{baseline_year}."
            else:
                level="HIGH" if b<0 and b<a else "MEDIUM" if b<0 else "CLEAR"
                detail=f"OCF moved from ₹{a:.2f} Cr to ₹{b:.2f} Cr; percentage not meaningful when baseline is nonpositive."
        elif sid=="CW-14":
            delta=b-a
            level="HIGH" if b<1.2 or (delta<=-.4 and b<1.5) else "MEDIUM" if b<1.5 or delta<=-.2 else "CLEAR"
            detail=f"DSCR {a:.2f}x → {b:.2f}x ({delta:+.2f}x); CreditLens CFADS / (interest expense + principal due)."
        else:
            if a<=0:
                level="NOT_EVALUATED";detail="Receivable-day baseline is nonpositive."
            else:
                delta=b-a;pct=100*delta/a
                level="HIGH" if delta>=20 and pct>=25 else "MEDIUM" if delta>=10 and pct>=15 else "CLEAR"
                detail=f"Year-end receivables/revenue × 365: {a:.1f} → {b:.1f} days ({delta:+.1f} days; {pct:+.1f}%). CreditLens proxy method."
        results[sid]=_signal(sid,level,round(b,2),round(a,2),detail,unit,
                   "CreditLens finance.py (identical definition)",f"FY{monitoring_year}")

    # Contractual conditions are distinct from financial deterioration.
    rules=[r for r in data["covenants"] if r["borrower_id"]==bid and r.get("test_fy")==monitoring_year]
    if not rules or curr is None:
        results["CW-20"]=_signal("CW-20",detail="No current covenant test or monitoring-year financials.",source="Synthetic sanction covenant register",date_at=stamp)
    else:
        issues=[];near=[];satisfied=[]
        for rule in rules:
            actual=cur_r.get(rule["metric"])
            thresh=float(rule["threshold"])
            if actual is None:continue
            if rule["operator"]==">=":
                breach=actual < thresh;headroom=(actual-thresh)/abs(thresh) if thresh else 0
            else:
                breach=actual > thresh;headroom=(thresh-actual)/abs(thresh) if thresh else 0
            text=f"{rule['metric'].upper()} {actual:.2f} vs {rule['operator']} {thresh:.2f}"
            if breach and not rule.get("waiver_active") and not rule.get("cure_pending"):
                issues.append(text)
            elif breach:
                near.append(text+" (documented waiver/cure; still requires follow-up)")
            elif headroom<=.10:
                near.append(text+" (headroom ≤10%)")
            else:satisfied.append(text)
        if issues:
            results["CW-20"]=_signal("CW-20","HIGH",len(issues),len(rules),"Confirmed numerical failures without active waiver/cure: "+"; ".join(issues)+". Requires contractual verification.","breaches","Synthetic sanction covenant register",stamp)
        elif near:
            results["CW-20"]=_signal("CW-20","MEDIUM",len(near),len(rules),"; ".join(near),"watch items","Synthetic sanction covenant register",stamp)
        elif satisfied:
            results["CW-20"]=_signal("CW-20","CLEAR",0,len(rules),"All evaluated contractual numerical tests met.","breaches","Synthetic sanction covenant register",stamp)
        else:results["CW-20"]=_signal("CW-20",detail="Covenant metrics unavailable.",source="Synthetic sanction covenant register",date_at=stamp)

    rr=sorted((r for r in data["ratings"] if r["borrower_id"]==bid and r["date"]<=stamp),key=lambda r:r["date"])
    if len(rr)>=2 and rr[-1].get("scale")==rr[-2].get("scale"):
        old,new=rr[-2],rr[-1];oldgrade=int(old["rating"]);newgrade=int(new["rating"]);movement=newgrade-oldgrade
        lvl="CRITICAL" if newgrade==9 and movement>0 else "HIGH" if movement>=2 else "MEDIUM" if movement==1 else "CLEAR"
        results["CW-24"]=_signal("CW-24",lvl,new["grade"],old["grade"],
                   f"Comparable synthetic internal rating {old['grade']} → {new['grade']} ({movement:+d} grades on {new['scale']}); not an external credit bureau score.",
                   "grade","Synthetic internal rating history",new["date"])
    else:
        results["CW-24"]=_signal("CW-24",detail="Two comparable dated ratings on the same internal scale are unavailable.",source="Internal rating history",date_at=stamp)

    signals=[results[sid] for sid in IDS]
    applicable=[s for s in signals if s["level"]!="NOT_APPLICABLE"]
    evaluated=[s for s in applicable if s["level"] in ("CLEAR","MEDIUM","HIGH","CRITICAL")]
    triggered=[s for s in signals if SEVERITY_ORDER[s["level"]]>0]
    domains={s["category"] for s in triggered}
    high=[s for s in triggered if s["level"]=="HIGH"]
    urgent=any(s["level"]=="CRITICAL" for s in signals)
    standalone_severe=any(s["id"] in ("CW-07","CW-20") and s["level"]=="HIGH" for s in signals)
    dscr_severe=cur_r.get("dscr") is not None and cur_r["dscr"] <1.0
    if urgent:level="CRITICAL"
    elif standalone_severe or dscr_severe or (high and len(domains)>=2):level="HIGH"
    elif triggered:level="MEDIUM"
    elif len(evaluated)>=min(6,len(applicable)) and applicable:level="LOW"
    else:level="UNASSESSED"
    coverage=round(100*len(evaluated)/len(applicable),1) if applicable else 0.0
    gaps=len(applicable)-len(evaluated)
    return {"borrower_id":bid,"as_of":stamp,"signals":signals,"classification":level,
            "coverage_percent":coverage,"evaluated":len(evaluated),"applicable":len(applicable),
            "triggered":len(triggered),"data_gaps":gaps,"baseline_year":baseline_year,
            "monitoring_year":monitoring_year,"ratios":{"baseline":base_r,"monitoring":cur_r},
            "reason":f"{len(triggered)} triggered signal(s) across {len(domains)} risk dimension(s); {gaps} of {len(applicable)} applicable signals not evaluated.",
            "caution":"Demonstration screening, not a PD estimate, regulatory classification or lending decision."}
