"""CreditWatch server-authoritative workflow, permissions and dashboard payloads.

Standalone demonstration with controlled sanctioned-borrower onboarding.
"""
from __future__ import annotations

import copy
import math
from collections import Counter,defaultdict
from datetime import date,datetime
from credit_platform.constants import FINANCIAL_FIELDS,FINANCIAL_GROUPS,RATIO_LABELS
from credit_platform.finance import compute_ratios,validate_financials
from .commentary import generate_report,ask_local
from .ai import ask as ask_ai, configured_api_key
from .ai_intelligence import investigate_risk, analyze_portfolio
from .ews import IDS,CATALOG,SEVERITY_ORDER,evaluate
from .repository import audit,new_id,utcnow

ROLES=("Analyst","AVP","VP/CRO")
# Official role-to-workspace mapping for the frontend; no analyst overview, approval or data tabs.
ROLE_PAGES={
    "Analyst":("onboard","guide","borrower","ews"),
    "AVP":("onboard","guide","borrower","ews","reviews","data"),
    "VP/CRO":("onboard","guide","overview","borrower","ews","reviews","data"),
}
NAMES={"Analyst":"Monitoring Analyst","AVP":"Monitoring AVP","VP/CRO":"VP/CRO"}
STATUS_LABELS={"DRAFT":"Draft","PENDING_AVP":"Pending AVP","PENDING_CRO":"Pending VP/CRO",
               "RETURNED":"Returned","FINALIZED":"Finalized","NOT_STARTED":"Not started"}
IN_REVIEW={"PENDING_AVP","PENDING_CRO","RETURNED","DRAFT"}


def authorized(role):
    if role not in ROLES: raise PermissionError("Select an authorized demonstration role.")


def _borrower(data,bid):
    record=next((b for b in data["borrowers"] if b["borrower_id"]==bid and b["approval_status"]=="APPROVED"),None)
    if not record:raise LookupError("Approved borrower not found in the borrower master.")
    return record


def _report(data,bid,fy=None):
    found=sorted((r for r in data["reports"] if r["borrower_id"]==bid and (fy is None or int(r["fy"])==fy)),key=lambda r:int(r["fy"]),reverse=True)
    return found[0] if found else None


def _financial_rows(data,bid):
    return sorted([r for r in data["baseline_financials"]+data["monitor_financials"] if r["borrower_id"]==bid],key=lambda r:int(r["fy"]))


def _current_monitor_fin(data,bid,fy=None):
    rows=sorted((r for r in data["monitor_financials"] if r["borrower_id"]==bid and (fy is None or int(r["fy"])==int(fy))),key=lambda r:int(r["fy"]),reverse=True)
    return rows[0] if rows else None


def _exposure(data,bid):
    facility_rows=[r for r in data["facilities"] if r["borrower_id"]==bid]
    per=[];funded=0;limit=0;nonfund=0
    for fac in facility_rows:
        relevant=[b for b in data["balances"] if b["facility_id"]==fac["facility_id"]]
        last=max(relevant,key=lambda r:r["date"]) if relevant else None
        os=round(float(last["outstanding_cr"]),3) if last else None
        ftype=fac["facility_type"]
        limit+=float(fac["sanctioned_limit"])
        if ftype=="BG":nonfund+=float(fac["sanctioned_limit"])
        else:funded+=os or 0
        per.append({**fac,"latest_os_cr":os,"latest_date":last["date"] if last else None,
                    "facility_utilisation":round(100*os/float(fac["sanctioned_limit"]),1)
                    if os is not None and ftype in ("CC","OD") and fac["sanctioned_limit"] else None})
    return {"facilities":per,"funded_os_cr":round(funded,3),"sanctioned_total_cr":round(limit,3),
            "nonfund_limit_cr":round(nonfund,3)}


def sync_cases(data,bid,before=None,actor="system"):
    a=evaluate(data,bid)
    old_levels={s["id"]:s["level"] for s in (before or {}).get("signals",[])}
    for s in a["signals"]:
        if s["level"] not in ("MEDIUM","HIGH","CRITICAL"):
            continue
        cases=[c for c in data["cases"] if c["borrower_id"]==bid and c["signal_id"]==s["id"] and c["status"]!="RESOLVED"]
        case=cases[-1] if cases else None
        if case is None:
            case={"case_id":new_id("CASE"),"borrower_id":bid,"signal_id":s["id"],
                  "severity":s["level"],"status":"OPEN","owner":"Monitoring team",
                  "opened_at":utcnow(),"updated_at":utcnow(),"notes":[],"reviewed":False}
            data["cases"].append(case)
        old=case["severity"]
        case["severity"]=s["level"]
        if old != s["level"] or old_levels.get(s["id"])!=s["level"]:
            event_type=("NEW" if old_levels.get(s["id"]) in (None,"CLEAR","NOT_EVALUATED") else
                    "WORSENING" if SEVERITY_ORDER[s["level"]]>SEVERITY_ORDER.get(old_levels.get(s["id"]),0) else "PERSISTENT")
            data["signal_events"].append({"borrower_id":bid,"signal_id":s["id"],"at":utcnow(),
                                           "event":event_type,"severity":s["level"],"actor":actor})
            case["updated_at"]=utcnow()


def return_info(report):
    """Resolve role-based routing for current and previously persisted RETURNED reports.

    Legacy reports may have no destination or review history. They are shown in
    the Analyst correction queue as historical/unattributed rather than lost.
    No individual assignee or responsible-person field is introduced.
    """
    if not report or report.get("status")!="RETURNED":
        return {"to":None,"at":None,"reason":None,"unknown_origin":False}
    history=report.get("review_history") or []
    latest=next((h for h in reversed(history)
                 if str(h.get("action","")).startswith("RETURNED")),None)
    destination=report.get("returned_to")
    if destination not in ("Analyst","AVP"):
        if latest:
            operation=str(latest.get("action", ""))
            actor=str(latest.get("actor", ""))
            if operation=="RETURNED_TO_AVP" or "VP/CRO" in actor:
                destination="AVP"
            elif operation=="RETURNED_TO_ANALYST" or "AVP" in actor:
                destination="Analyst"
    unknown_origin=destination not in ("Analyst","AVP")
    if unknown_origin:
        destination="Analyst"
    return {"to":destination,"at":latest.get("at") if latest else report.get("updated_at"),
            "reason":latest.get("reason") if latest else None,
            "unknown_origin":unknown_origin}


# CW_ASSIGNMENT_PATCH_V1
# Role-level ownership for the synthetic three-designation demonstration.
# No individual employee identifiers or additional authentication are created.
def _assignment_role(data, bid):
    value = data.get("borrower_assignments", {}).get(bid, "Unassigned")
    return value if value in ("Analyst", "AVP") else "Unassigned"


# CW_EXPLICIT_CRO_ACTIVATION_V2: a historical report never automatically
# enrolls an approved borrower. Only a saved VP/CRO activation grants membership.
# Existing monitoring history is retained unchanged and can be viewed in the master.
def _monitoring_active(data, bid):
    marker = data.get("monitoring_activations", {}).get(bid)
    return (bool(marker.get("active")) if isinstance(marker, dict)
            else bool(marker) if marker is not None else False)


def _activation_events(data):
    return [e for e in data.get("audit", []) if e.get("action") == "monitoring_activated"]


def _assignment_events(data):
    return [
        {"borrower_id": entry.get("borrower_id"), "at": entry.get("at"),
         "actor": entry.get("actor"), **entry.get("details", {})}
        for entry in data.get("audit", [])
        if entry.get("action") == "borrower_assignment_changed"
    ]


# CW_SUBMITTED_AND_DELETE_DRAFT_V1: real Analyst submissions and safe draft-year deletion.
def _analyst_submission_at(report):
    """Latest genuine Analyst-to-AVP submission for the CURRENT monitoring report.

    Seeded reports without Analyst submission actions do not inflate this count.
    AVP-owner submissions are not Analyst submissions.
    """
    if not report:
        return None
    events = [event.get("at") for event in (report.get("review_history") or [])
              if event.get("action") in ("SUBMITTED_TO_AVP", "RESUBMITTED_TO_AVP_BY_ANALYST")
              and str(event.get("actor") or "").startswith("Monitoring Analyst")
              and event.get("at")]
    return max(events) if events else None


def _can_delete_draft_year(data, bid, fy):
    """Only an unsubmitted monitoring-year pair created through CreditWatch Add FY."""
    if fy < 2026:
        return False
    financials = [row for row in data.get("monitor_financials", [])
                  if row["borrower_id"] == bid and int(row["fy"]) == fy]
    reports = [rep for rep in data.get("reports", [])
               if rep["borrower_id"] == bid and int(rep["fy"]) == fy]
    if len(financials) != 1 or len(reports) != 1:
        return False
    financial = financials[0]
    report = reports[0]
    return (financial.get("source") == "Synthetic monitoring-year entry"
            and report.get("status") == "DRAFT"
            and int(report.get("version", 1)) == 1
            and not report.get("review_history")
            and not report.get("finalized_snapshot")
            and not report.get("superseded_snapshots"))


def _overview(data,role):
    borrowers=[];outcomes={};sectors=defaultdict(lambda:{"borrowers":0,"high":0,"funded_os_cr":0.0})
    counts=Counter();signal_hits=defaultdict(list);latest_due=date.fromisoformat(data["metadata"]["generated_as_of"])
    funded_sum=0;funded_high=0;nonfund_sum=0;unassessed=0;trigger_ids=set()
    for b in data["borrowers"]:
        bid=b["borrower_id"];a=evaluate(data,bid);ex=_exposure(data,bid);rep=_report(data,bid)
        rstatus=rep["status"] if rep else "NOT_STARTED"
        routing=return_info(rep)
        counts[rstatus]+=1
        funded_sum+=ex["funded_os_cr"];nonfund_sum+=ex["nonfund_limit_cr"]
        if a["classification"] in ("HIGH","CRITICAL"):funded_high+=ex["funded_os_cr"]
        if a["classification"]=="UNASSESSED":unassessed+=1
        if a["triggered"]:trigger_ids.add(bid)
        for s in a["signals"]:
            if s["level"] in ("MEDIUM","HIGH","CRITICAL"):
                signal_hits[s["id"]].append({"borrower_id":bid,"name":b["company_name"],
                        "level":s["level"],"observed":s["observed"],"reference":s["reference"],
                        "funded_os_cr":ex["funded_os_cr"]})
        key=b["sector"];sectors[key]["borrowers"]+=1;sectors[key]["funded_os_cr"]+=ex["funded_os_cr"]
        if a["classification"] in ("HIGH","CRITICAL"):sectors[key]["high"]+=1
        borrowers.append({"id":bid,"name":b["company_name"],"sector":b["sector"],"segment":b["segment"],
            "sanction_date":b["sanction_date"],"risk":a["classification"],"triggered":a["triggered"],
            "coverage":a["coverage_percent"],"fin_year":a["monitoring_year"],"status":rstatus,
            "returned_to":routing["to"],"returned_at":routing["at"],
            "return_reason":routing["reason"],"legacy_return_unknown":routing["unknown_origin"],
            "assignment_role":_assignment_role(data,bid),"monitoring_active":_monitoring_active(data,bid),"analyst_submission_at":_analyst_submission_at(rep),"due_date":b["monitoring_due_date"],"overdue":rstatus!="FINALIZED" and date.fromisoformat(b["monitoring_due_date"])<latest_due,
            "funded_os_cr":ex["funded_os_cr"],"nonfund_limit_cr":ex["nonfund_limit_cr"],
            "signal_levels":{s["id"]:s["level"] for s in a["signals"]}})
    cases=[{**c,"company":next((b["company_name"] for b in data["borrowers"] if b["borrower_id"]==c["borrower_id"]),""),
            "signal_name":CATALOG[c["signal_id"]][0]} for c in data["cases"]]
    queue=sorted([r for r in borrowers if r["status"] not in ("FINALIZED",)],
                 key=lambda r:(0 if r["status"]=="PENDING_CRO" else 1 if r["status"]=="PENDING_AVP" else 2,r["due_date"]))
    return {"assignment_events":_assignment_events(data)[-250:] if role=="VP/CRO" else [],"activation_events":_activation_events(data)[-250:] if role=="VP/CRO" else [],"borrowers":borrowers,"counts":dict(counts),
        "metrics":{"borrowers":len(borrowers),"active_monitoring":sum(r["monitoring_active"] for r in borrowers),"triggered_borrowers":len(trigger_ids),
                   "high_critical":sum(r["risk"] in ("HIGH","CRITICAL") for r in borrowers),
                   "unassessed":unassessed,"total_funded_os_cr":round(funded_sum,2),
                   "high_critical_funded_cr":round(funded_high,2),"nonfund_limits_cr":round(nonfund_sum,2),
                   "overdue_reports":sum(x["overdue"] for x in borrowers),
                   "unresolved_cases":sum(c["status"]!="RESOLVED" for c in cases)},
        "signal_counts":[{"id":sid,"name":CATALOG[sid][0],"count":len(signal_hits[sid]),
                         "borrowers":signal_hits[sid]} for sid in IDS],
        "sectors":[{"sector":sec,**v,"funded_os_cr":round(v["funded_os_cr"],2)} for sec,v in sectors.items()],
        "risk_distribution":dict(Counter(x["risk"] for x in borrowers)),
        "queue":queue,"cases":cases,
        "signal_catalog":[{"id":sid,"name":CATALOG[sid][0],"group":CATALOG[sid][1]} for sid in IDS],
        "signal_events":data["signal_events"][-180:]}


def _borrower_detail(data,bid):
    b=_borrower(data,bid);financials=[
        {**row, "can_delete_draft":_can_delete_draft_year(data,bid,int(row["fy"]))}
        for row in _financial_rows(data,bid)]
    assessments=evaluate(data,bid);narrative=generate_report(data,bid,assessments)
    y2r={str(y["fy"]):compute_ratios(y["data"]) if y.get("valid",True) else {} for y in financials}
    ratio_rows=[{"key":key,"label":label,"values":{str(x["fy"]):y2r[str(x["fy"])].get(key) for x in financials}}
                for key,label in RATIO_LABELS.items()]
    reports=[]
    for x in data["reports"]:
        if x["borrower_id"]!=bid:continue
        if x.get("status")=="RETURNED":
            reports.append({**x,"returned_to":return_info(x)["to"]})
        else:reports.append(x)
    active=max(reports,key=lambda x:int(x["fy"])) if reports else None
    cases=[c for c in data["cases"] if c["borrower_id"]==bid]
    cash=[x for x in data["account_credits"] if x["borrower_id"]==bid]
    latest_month=sum(float(x["eligible_credit_cr"]) for x in cash[-30:])
    return {"monitoring_active":_monitoring_active(data,bid),"assignment_role":_assignment_role(data,bid),
            "assignment_history":[row for row in _assignment_events(data) if row["borrower_id"]==bid][-40:],
            "borrower":b,"financials":financials,"financial_groups":FINANCIAL_GROUPS,
            "ratio_rows":ratio_rows,"ratios_by_year":y2r,"assess":assessments,
            "narrative":narrative,"exposure":_exposure(data,bid),
            "reports":reports,"current_report":active,"cases":cases,
            "audit":[x for x in data["audit"] if x["borrower_id"]==bid][-60:],
            "projections":[x for x in data.get("projections",[]) if x["borrower_id"]==bid],
            "baseline_versions":[x for x in data.get("baseline_versions",[]) if x["borrower_id"]==bid][-15:],
            "ratings":[x for x in data["ratings"] if x["borrower_id"]==bid],
            "covenants":[x for x in data["covenants"] if x["borrower_id"]==bid],
            "repayments":[x for x in data["repayments"] if x["borrower_id"]==bid],
            "account_credits_recent_cr":round(latest_month,3),
            "observation_date":data["metadata"]["generated_as_of"]}


def get_state(data,session):
    role=session.get("role")
    if not role:
        return {"authenticated":False,"roles":list(ROLES),"metadata":data["metadata"]}
    authorized(role)
    overview=_overview(data,role)
    bid=session.get("selected_borrower") or data["borrowers"][0]["borrower_id"]
    try:detail=_borrower_detail(data,bid)
    except LookupError:
        bid=data["borrowers"][0]["borrower_id"];detail=_borrower_detail(data,bid)
    from .onboarding import onboarding_options
    return {"authenticated":True,"role":role,"actor":NAMES[role],"metadata":data["metadata"],
            "onboarding":onboarding_options(data,session.get("onboarding_result")),
            "selected_borrower":bid,"overview":overview,"detail":detail,
            "available_pages":list(ROLE_PAGES[role]),
            "permissions":{"edit_baseline":role=="VP/CRO","edit_submissions":role in ("AVP","VP/CRO"),
                           "approve_avp":role in ("AVP","VP/CRO"),"finalize":role=="VP/CRO",
                           "full_portfolio":role=="VP/CRO","case_close":role in ("AVP","VP/CRO")},
            "last_ai":session.get("last_ai"),
            "ai_risk_result":session.get("ai_risk_result"),
            "ai_portfolio_result":session.get("ai_portfolio_result") if role=="VP/CRO" else None,
            "groq_configured":bool(configured_api_key()),"notice":session.pop("notice",None)}


def _reason(v,required=False):
    text=str(v or "").strip()
    if len(text)>1200:raise ValueError("Explanation must be less than 1,200 characters.")
    if required and len(text)<10:raise ValueError("Provide a reason of at least 10 characters for this controlled change.")
    return text


def _after_financial_revision(data,report,actor,reason):
    if report and report["status"]=="FINALIZED":
        # Preserve approval evidence before reopening for a formal amendment.
        report.setdefault("superseded_snapshots",[]).append(copy.deepcopy(report.get("finalized_snapshot")))
        report["finalized_snapshot"]=None
        report["status"]="PENDING_CRO"
        report["version"]+=1
        report.setdefault("review_history",[]).append({"actor":actor,"action":"REOPENED_FOR_AMENDMENT","at":utcnow(),"reason":reason})


def apply_action(data,session,action):
    if not isinstance(action,dict):raise ValueError("Invalid request.")
    kind=action.get("kind")
    if kind=="login":
        role=action.get("role")
        authorized(role)
        session.clear();session.update({"role":role,"selected_borrower":data["borrowers"][0]["borrower_id"]})
        return
    if kind=="logout":session.clear();return
    role=session.get("role");authorized(role)
    bid=action.get("borrower_id") or session.get("selected_borrower")
    if kind=="select_borrower":
        _borrower(data,bid)
        session["selected_borrower"]=bid
        return
    # CW_GROQ_INTELLIGENCE_V1: both actions are strictly read-only.
    # Neither the database nor borrower workflow is updated on an AI request.
    if kind=="ai_risk_investigate":
        # CREDITWATCH_RISK_JSON_400_SCOPE_V1: VP/CRO may investigate any approved
        # master borrower read-only. This NEVER activates a monitoring membership.
        _borrower(data,bid)
        scope=str(action.get("scope") or "active")
        if scope not in ("active", "master"):
            raise ValueError("Invalid borrower investigation scope.")
        if scope == "master" and role != "VP/CRO":
            raise PermissionError("Only VP/CRO may investigate inactive master borrowers.")
        is_active=_monitoring_active(data,bid)
        if scope == "active" and not is_active:
            raise PermissionError("VP/CRO must activate the borrower for active monitoring investigation.")
        if not bool(action.get("ai_consent")):
            raise ValueError("Consent to send synthetic monitoring evidence to Groq is required.")
        result=investigate_risk(data,bid,_exposure(data,bid)["funded_os_cr"])
        session["ai_risk_result"]={**result, "scope":scope, "monitoring_active":is_active}
        return
    if kind=="ai_portfolio_intelligence":
        if role!="VP/CRO":
            raise PermissionError("AI Portfolio Intelligence is exclusively available to VP/CRO.")
        if not bool(action.get("ai_consent")):
            raise ValueError("Consent to send synthetic portfolio evidence to Groq is required.")
        session["ai_portfolio_result"]=analyze_portfolio(
            data,_overview(data,role),str(action.get("question") or ""),
            str(action.get("scope") or "active"))
        return
    if kind=="ask":
        _borrower(data,bid)
        result=ask_ai(data,bid,str(action.get("question", "")),
            use_groq=bool(action.get("use_groq")),consent=bool(action.get("ai_consent")))
        session["last_ai"]={**result,"borrower_id":bid,"question":str(action.get("question"))}
        return
    # CW_ONBOARD_BORROWER_V1: create a master record only. No automatic activation.
    if kind == "onboard_borrower":
        from .onboarding import register_borrower
        new_bid = register_borrower(data, action.get("payload"), NAMES[role])
        session["selected_borrower"] = new_bid
        session["onboarding_result"] = {
            "request_id":str(action.get("request_id") or "")[:100],
            "borrower_id":new_bid,
        }
        session["notice"] = {
            "type":"success",
            "text":f"{new_bid} has been added to Existing Borrowers. VP/CRO activation is still required."
        }
        return
    actor=NAMES[role]
    _borrower(data,bid)
    # A borrower may be approved in the master but not activated for monitoring.
    # Enforce this server-side for every monitoring mutation, regardless of UI.
    if not _monitoring_active(data, bid) and kind not in ("activate_monitoring",):
        raise PermissionError("This approved borrower is not active for monitoring. VP/CRO must activate it first.")
    if kind == "activate_monitoring":
        if role != "VP/CRO":
            raise PermissionError("Only VP/CRO can activate existing borrowers for monitoring.")
        if _monitoring_active(data, bid):
            raise ValueError("This borrower is already active for monitoring.")
        # A legacy report is historical evidence, not proof of active membership.
        # Preserve every report and its approval stage when CRO activates the borrower.
        data.setdefault("monitoring_activations", {})[bid] = {
            "active": True, "activated_at": utcnow(), "activated_by": role
        }
        previous = _assignment_role(data, bid)
        data.setdefault("borrower_assignments", {})[bid] = "Analyst"
        audit(data, actor, "monitoring_activated", bid, {
            "previous_role": previous, "new_role": "Analyst", "initiated_by": role
        })
        if previous != "Analyst":
            audit(data, actor, "borrower_assignment_changed", bid, {
                "previous_role": previous, "new_role": "Analyst", "initiated_by": role,
                "reason": "VP/CRO activation of existing approved borrower"
            })
        session["selected_borrower"] = bid
        session["notice"] = f"{bid} activated and assigned to Analyst monitoring."
        return
    # CW_ANALYST_WORKLIST_V1: AVP-owned monitoring is read-only to Analyst.
    if role == 'Analyst' and _assignment_role(data, bid) == 'AVP' and kind in (
        'create_period', 'delete_period', 'save_financial', 'save_notes', 'submit', 'case_update'
    ):
        raise PermissionError(
            'This borrower is assigned to AVP. Analyst may view but cannot change its monitoring record.'
        )
    prev=evaluate(data,bid)
    rep=_report(data,bid)
    # CW_ASSIGNMENT_PATCH_V1: maintain ownership without altering financial evidence.
    if kind == "assign_monitoring":
        if role not in ("AVP", "VP/CRO"):
            raise PermissionError("Only AVP or VP/CRO can change borrower assignments.")
        target = str(action.get("owner_role") or "")
        if target not in ("Analyst", "AVP"):
            raise ValueError("Monitoring responsibility can only be Analyst or AVP.")
        previous = _assignment_role(data, bid)
        if previous == target:
            raise ValueError("This borrower is already assigned to the selected designation.")
        reason = _reason(action.get("reason"), required=previous != "Unassigned")
        data.setdefault("borrower_assignments", {})[bid] = target
        # A previously returned report should follow the new responsible role.
        if rep and rep.get("status") == "RETURNED":
            rep["returned_to"] = target
            rep.setdefault("review_history", []).append({
                "actor": actor, "action": "RETURN_DESTINATION_UPDATED_ON_ASSIGNMENT",
                "at": utcnow(), "reason": reason})
            rep["updated_at"] = utcnow()
        audit(data, actor, "borrower_assignment_changed", bid, {
            "previous_role": previous, "new_role": target,
            "initiated_by": role, "reason": reason})
        session["notice"] = f"Monitoring responsibility changed: {previous} to {target}."
        return

    # An AVP who owns preparation routes a validated report to VP/CRO.
    # This is a submission, never an AVP approval of their own work.
    if kind == "avp_owner_submit":
        if role != "AVP" or _assignment_role(data, bid) != "AVP":
            raise PermissionError("Only an assigned AVP can submit directly to VP/CRO.")
        fy = int(action.get("fy", 0))
        report = _report(data, bid, fy)
        if not report or report["status"] not in ("DRAFT", "PENDING_AVP", "RETURNED"):
            raise PermissionError("This report is not in an AVP-owned preparation or correction stage.")
        fin = _current_monitor_fin(data, bid, fy)
        if not fin or not fin.get("valid", True):
            raise ValueError("Validate monitoring financials before sending the report to VP/CRO.")
        reason = _reason(action.get("reason"), required=report["status"] == "RETURNED")
        report["avp_notes"] = str(action.get("notes") or report.get("avp_notes", ""))[:7000]
        report["status"] = "PENDING_CRO"
        report.pop("returned_to", None)
        report["updated_at"] = utcnow()
        report.setdefault("review_history", []).append({
            "actor": actor, "action": "SUBMITTED_TO_CRO_BY_AVP_OWNER",
            "at": utcnow(), "reason": reason})
        audit(data, actor, "submitted_to_cro_by_avp_owner", bid, {
            "fy": fy, "reason": reason, "version": report["version"]})
        session["notice"] = "AVP-owned monitoring report submitted for independent VP/CRO review."
        return
    if kind == "avp_approve" and role == "AVP" and _assignment_role(data, bid) == "AVP":
        raise PermissionError("AVP-owned reports cannot be self-approved. Use Send to VP/CRO.")
    if kind=="create_period":
        # CW_ANALYST_FINANCIAL_OWNERSHIP_V1: preparation belongs to Analyst, except AVP-owned borrowers.
        if role=="AVP" and _assignment_role(data,bid)!="AVP":
            raise PermissionError("Only Analyst can add a monitoring FY for Analyst-stage cases. AVP can add an FY only for AVP-owned borrowers.")
        year=int(action.get("fy",0))
        if year<2026 or year>date.today().year+2:raise ValueError("Enter a valid new post-sanction financial year.")
        if any(r["borrower_id"]==bid and int(r["fy"])==year for r in _financial_rows(data,bid)):
            raise ValueError("This financial year already exists. Open it for authorized editing.")
        # CW_FINANCIAL_DATA_CASHFLOW_TABS_V1: a draft FY can coexist with another new draft; pending reviews cannot.
        if role!="VP/CRO" and any(r["borrower_id"]==bid and r["status"] in (IN_REVIEW - {"DRAFT"}) for r in data["reports"]):
            raise ValueError("Finish the pending review or returned report before creating another financial year.")
        data["monitor_financials"].append({"borrower_id":bid,"fy":year,"data":{f:0 for f in FINANCIAL_FIELDS},
             "valid":False,"validation_errors":["Enter the financial statements before submitting."],
             "statement_type":"Provisional","updated_by":actor,"updated_at":utcnow(),"source":"Synthetic monitoring-year entry"})
        data["reports"].append({"report_id":new_id("CMR"),"borrower_id":bid,"fy":year,
             "status":"DRAFT","version":1,"created_at":utcnow(),"updated_at":utcnow(),
             "analyst_notes":"","avp_notes":"","cro_notes":"","review_history":[],
             "classification_override":None,"finalized_snapshot":None})
        audit(data,actor,"create_monitoring_year",bid,{"fy":year})
        session["notice"]=f"FY{year} monitoring record created; enter and validate all statements."
        return
    # CW_SUBMITTED_AND_DELETE_DRAFT_V1: delete an Add FY draft and its draft report as one transaction.
    if kind == "delete_period":
        # CW_ANALYST_FINANCIAL_OWNERSHIP_V1: a draft can be deleted by its preparing role or VP/CRO.
        if role=="AVP" and _assignment_role(data,bid)!="AVP":
            raise PermissionError("Only Analyst may delete an Analyst-stage draft FY. AVP may delete only AVP-owned unsubmitted draft years.")
        year = int(action.get("fy", 0))
        if not _can_delete_draft_year(data, bid, year):
            raise PermissionError(
                "Only a monitoring year added through Add FY that has never been submitted can be deleted. "
                "Baseline, historical, returned, submitted and approved years remain protected."
            )
        reason = _reason(action.get("reason"), required=True)
        fin = _current_monitor_fin(data, bid, year)
        report = _report(data, bid, year)
        # Retain full before-state in the audit trail, without altering financial methods.
        deleted_financial = copy.deepcopy(fin)
        deleted_report = copy.deepcopy(report)
        data["monitor_financials"].remove(fin)
        data["reports"].remove(report)
        audit(data, actor, "monitoring_draft_year_deleted", bid, {
            "fy": year, "reason": reason,
            "deleted_financial": deleted_financial,
            "deleted_report": deleted_report,
        })
        # A deleted draft may have contributed validated EWS inputs. Recalculate;
        # do not silently delete or close existing investigation cases.
        sync_cases(data, bid, prev, actor)
        if (session.get("last_ai") or {}).get("borrower_id") == bid:
            session.pop("last_ai", None)
        session["notice"] = f"FY{year} unsubmitted draft and associated report deleted. Audit history retained."
        return
    if kind=="save_financial":
        fy=int(action.get("fy",0));baseline=bool(action.get("baseline"))
        reason=_reason(action.get("reason"),baseline or role in ("AVP","VP/CRO"))
        current_rows=data["baseline_financials"] if baseline else data["monitor_financials"]
        row=next((r for r in current_rows if r["borrower_id"]==bid and int(r["fy"])==fy),None)
        if row is None:raise LookupError("Select an existing financial year first.")
        if baseline and role!="VP/CRO":raise PermissionError("Only VP/CRO may correct original baseline financials.")
        monitor_report=_report(data,bid,fy)
        routing=return_info(monitor_report)
        if not baseline and role=="Analyst" and (monitor_report is None or not
            (monitor_report["status"]=="DRAFT" or
             (monitor_report["status"]=="RETURNED" and routing["to"]=="Analyst"))):
            raise PermissionError("Analysts may edit drafts or reports returned to Analyst only.")
        if not baseline and role=="AVP" and (monitor_report is None or not
            ((monitor_report["status"]=="DRAFT" and _assignment_role(data,bid)=="AVP") or
             monitor_report["status"]=="PENDING_AVP" or
             (monitor_report["status"]=="RETURNED" and routing["to"]=="AVP"))):
            raise PermissionError("AVP can edit its own drafts, or correct reports pending/returned to AVP.")
        body=action.get("values")
        if not isinstance(body,dict):raise ValueError("Missing financial fields.")
        proposed={}
        for field in FINANCIAL_FIELDS:
            raw=body.get(field)
            if raw is None or (isinstance(raw,str) and not raw.strip()):v=0.0
            else:
                try:v=float(raw)
                except (TypeError,ValueError) as e:raise ValueError(f"Invalid number in {field}.") from e
            if not math.isfinite(v) or abs(v)>1e9:raise ValueError(f"Invalid value for {field}.")
            proposed[field]=round(v,4)
        errors,warnings=validate_financials(proposed,fy)
        old=copy.deepcopy(row["data"])
        changed={key:{"before":old.get(key),"after":proposed[key]} for key in FINANCIAL_FIELDS
                 if old.get(key)!=proposed[key]}
        if not changed:raise ValueError("No financial values changed.")
        if baseline:
            if errors:raise ValueError("Baseline correction must be structurally valid: "+"; ".join(errors))
            data["baseline_versions"].append({"id":new_id("BASE"),"borrower_id":bid,"fy":fy,
                "before":old,"after":copy.deepcopy(proposed),"actor":actor,"reason":reason,"at":utcnow(),"changes":changed})
        row["data"]=proposed;row["valid"]=not bool(errors);row["validation_errors"]=errors;row["validation_warnings"]=warnings
        row["updated_at"]=utcnow();row["updated_by"]=actor
        if not baseline:
            row["statement_type"]=str(action.get("statement_type") or row.get("statement_type","Provisional"))
            if row["statement_type"] not in ("Audited","Provisional"):raise ValueError("Invalid financial statement type")
            r=_report(data,bid,fy)
            _after_financial_revision(data,r,actor,reason)
        audit(data,actor,"baseline_revised" if baseline else "monitor_financials_revised",bid,
              {"fy":fy,"reason":reason,"changed_fields":changed,"errors":errors,"warnings":warnings})
        sync_cases(data,bid,prev,actor)
        session["notice"]=("Financial values saved and dependent measures recalculated. "
                           +(f"Draft has {len(errors)} validation issue(s) and cannot be submitted." if errors else "Validation passed."))
        return
    if kind=="save_notes":
        r=_report(data,bid,int(action.get("fy",0)))
        if not r:raise LookupError("Monitoring report not found")
        field={"Analyst":"analyst_notes","AVP":"avp_notes","VP/CRO":"cro_notes"}[role]
        routing=return_info(r)
        if role=="Analyst" and not (r["status"]=="DRAFT" or
              (r["status"]=="RETURNED" and routing["to"]=="Analyst")):
            raise PermissionError("Analyst can amend notes only in drafts or reports returned to Analyst")
        if role=="AVP" and not (r["status"] in ("PENDING_AVP","DRAFT") or
              (r["status"]=="RETURNED" and routing["to"]=="AVP")):
            raise PermissionError("AVP can amend notes only on reports pending AVP or returned to AVP")
        content=str(action.get("notes", "")).strip()
        if len(content)>7000:raise ValueError("Limit report notes to 7,000 characters")
        _after_financial_revision(data,r,actor,"VP/CRO note amendment")
        r[field]=content;r["updated_at"]=utcnow()
        audit(data,actor,"report_notes_saved",bid,{"fy":r["fy"],"field":field})
        session["notice"]="Monitoring observations saved."
        return
    if kind in ("submit","avp_approve","finalize","return"):
        fy=int(action.get("fy",0))
        report=_report(data,bid,fy)
        if not report:raise LookupError("Monitoring report not found")
        fin=_current_monitor_fin(data,bid,fy)
        routing=return_info(report)
        was_returned=report["status"]=="RETURNED"
        reason=_reason(action.get("reason"),kind in ("finalize","return") or
                       (kind=="avp_approve" and was_returned))
        if kind=="submit":
            if role!="Analyst":raise PermissionError("Monitoring Analyst submission required")
            if not (report["status"]=="DRAFT" or
                    (was_returned and routing["to"]=="Analyst")):
                raise PermissionError("Only drafts or reports returned to Analyst may be submitted to AVP")
            if not fin or not fin.get("valid",True):raise ValueError("Complete and validate monitoring-year financials before submission.")
            report["status"]="PENDING_AVP"
            report["analyst_notes"]=str(action.get("notes") or report.get("analyst_notes", ""))[:7000]
            operation="RESUBMITTED_TO_AVP_BY_ANALYST" if was_returned else "SUBMITTED_TO_AVP"
        elif kind=="avp_approve":
            if role not in ("AVP","VP/CRO"):raise PermissionError("AVP or VP/CRO review permission required")
            if not (report["status"]=="PENDING_AVP" or
                    (role=="AVP" and was_returned and routing["to"]=="AVP")):
                raise PermissionError("Report is not awaiting AVP review or correction")
            if not fin or not fin.get("valid",True):raise ValueError("Cannot approve unvalidated monitoring financials")
            report["status"]="PENDING_CRO"
            operation=("RESUBMITTED_TO_CRO_BY_AVP" if was_returned else
                       "APPROVED_BY_AVP" if role=="AVP" else "APPROVED_BY_CRO_OVERRIDE")
            if role=="AVP":report["avp_notes"]=str(action.get("notes") or report.get("avp_notes", ""))[:7000]
        elif kind=="return":
            if role=="Analyst":raise PermissionError("Only review officers can return reports")
            if role=="AVP":
                if not (report["status"]=="PENDING_AVP" or
                        (was_returned and routing["to"]=="AVP")):
                    raise PermissionError("AVP can return reports pending AVP or returned by VP/CRO")
                destination="Analyst";operation="RETURNED_TO_ANALYST"
                report["avp_notes"]=str(action.get("notes") or report.get("avp_notes", ""))[:7000]
            else:
                if report["status"] not in ("PENDING_CRO","PENDING_AVP"):
                    raise PermissionError("VP/CRO may return reports only while pending review")
                destination="AVP";operation="RETURNED_TO_AVP"
                report["cro_notes"]=str(action.get("notes") or report.get("cro_notes", ""))[:7000]
            report["status"]="RETURNED"
            report["returned_to"]=destination
        else:
            if role!="VP/CRO":raise PermissionError("Finalization requires VP/CRO authority")
            if report["status"] not in ("PENDING_CRO","PENDING_AVP","DRAFT"):
                raise PermissionError("Correct and resubmit returned reports before finalization")
            if not fin or not fin.get("valid",True):raise ValueError("Cannot finalize unvalidated monitoring financials")
            report["status"]="FINALIZED";operation="FINALIZED_BY_CRO"
            assessment=evaluate(data,bid)
            narrative=generate_report(data,bid,assessment)
            baselines=[x for x in data["baseline_financials"] if x["borrower_id"]==bid]
            report["finalized_snapshot"]={"captured_at":utcnow(),"financials":copy.deepcopy(fin["data"]),
                "baseline_records":copy.deepcopy(baselines),"assessment":assessment,
                "narrative":narrative,"approved_by":actor,"reason":reason}
        if report["status"]!="RETURNED":
            report.pop("returned_to",None)
        report["review_history"].append({"actor":actor,"action":operation,"at":utcnow(),"reason":reason})
        report["updated_at"]=utcnow()
        audit(data,actor,operation.lower(),bid,{"fy":fy,"reason":reason,"version":report["version"]})
        session["notice"]=("Monitoring report returned to "+report["returned_to"]+" for correction."
                           if report["status"]=="RETURNED" else
                           "Monitoring report: "+STATUS_LABELS[report["status"]]+".")
        return
    if kind=="case_update":
        caseid=str(action.get("case_id", ""))
        case=next((c for c in data["cases"] if c["case_id"]==caseid and c["borrower_id"]==bid),None)
        if not case:raise LookupError("Risk case not found")
        state=str(action.get("status", ""))
        if state not in ("OPEN","INVESTIGATING","ESCALATED","RESOLVED"):raise ValueError("Invalid investigation status")
        if role=="Analyst" and state in ("RESOLVED","ESCALATED"):
            raise PermissionError("AVP/VP-CRO authorization is required for escalation or closure.")
        reason=_reason(action.get("reason"),True)
        case["status"]=state;case["updated_at"]=utcnow();case["reviewed"]=True
        case.setdefault("notes",[]).append({"at":utcnow(),"actor":actor,"status":state,"reason":reason})
        audit(data,actor,"ews_case_updated",bid,{"case_id":caseid,"status":state,"reason":reason})
        session["notice"]="Risk investigation status updated."
        return
    if kind=="simulate":
        # Hide the Monitoring Data tab AND protect the underlying mutation endpoint.
        if role not in ("AVP","VP/CRO"):
            raise PermissionError("Only Monitoring AVP and VP/CRO can run Monitoring Data scenarios.")
        sim=str(action.get("scenario", ""))
        if sim not in ("utilisation_spike","credit_decline","repayment_miss","rating_downgrade"):
            raise ValueError("Unknown synthetic stress event")
        observation=date.fromisoformat(data["metadata"]["generated_as_of"])
        if sim=="utilisation_spike":
            revolving=[f for f in data["facilities"] if f["borrower_id"]==bid and f["facility_type"] in ("CC","OD")]
            if not revolving:raise ValueError("This borrower has no revolving facility")
            ids={f["facility_id"] for f in revolving}
            for balance in data["balances"]:
                if balance["borrower_id"]==bid and balance["facility_id"] in ids and balance["date"]>=(observation.replace(day=observation.day)-__import__('datetime').timedelta(days=29)).isoformat():
                    balance["outstanding_cr"]=round(balance["sanctioned_limit_cr"]*.97,3)
        elif sim=="credit_decline":
            for credit in data["account_credits"]:
                if credit["borrower_id"]==bid and credit["date"]>=(observation-__import__('datetime').timedelta(days=29)).isoformat():
                    credit["eligible_credit_cr"]=round(float(credit["eligible_credit_cr"])*.35,4)
        elif sim=="repayment_miss":
            fac=next((f for f in data["facilities"] if f["borrower_id"]==bid and f["facility_type"] in ("TERM","CC","OD")),None)
            if not fac:raise ValueError("Borrower has no funded facility")
            due=(observation-__import__('datetime').timedelta(days=18)).isoformat()
            data["repayments"].append({"borrower_id":bid,"facility_id":fac["facility_id"],
                "obligation_id":new_id("OBL"),"due_date":due,"amount_due_cr":round(fac["sanctioned_limit"]*.015,3),
                "paid_cr":0.0,"paid_date":None,"source":"Synthetic missed-payment simulation"})
        else:
            items=sorted((r for r in data["ratings"] if r["borrower_id"]==bid),key=lambda r:r["date"])
            if not items:raise ValueError("Borrower has no rating baseline")
            old=items[-1];new=min(9,int(old["rating"])+2)
            from .seed import GRADE_LABELS
            data["ratings"].append({"borrower_id":bid,"date":observation.isoformat(),"rating":new,
                "grade":GRADE_LABELS[new],"scale":old["scale"],"source":"Synthetic rating stress simulation"})
        audit(data,actor,"synthetic_stress_simulated",bid,{"scenario":sim})
        sync_cases(data,bid,prev,actor)
        session["notice"]="Synthetic monitoring scenario applied; EWS results recalculated."
        return
    raise PermissionError("Unsupported workflow action. New borrower registration is intentionally unavailable.")
