"""Deterministic, realistic-shaped but wholly invented post-sanction portfolio.

No real names, account identifiers or personally identifying information.
Only existing APPROVED corporate / MSME borrowers are provisioned.
"""
from __future__ import annotations

import copy
import random
from datetime import date, datetime, timedelta, timezone
from credit_platform.constants import FINANCIAL_FIELDS
from credit_platform.finance import compute_ratios, validate_financials

SEED_VERSION = "creditwatch-synthetic-2026.1"
BUSINESSES = [
    ("Aster Precision Components Private Limited", "Manufacturing", "Auto Components", "MSME"),
    ("Nirva Flexible Packaging Limited", "Manufacturing", "Flexible Packaging", "Corporate"),
    ("Coral Textiles Private Limited", "Manufacturing", "Textiles", "MSME"),
    ("Veda Industrial Equipment Limited", "Manufacturing", "Industrial Equipment", "Corporate"),
    ("Kestral Food Processing Private Limited", "Manufacturing", "Food Processing", "MSME"),
    ("Triveni Industrial Supply Private Limited", "Trading", "Industrial Distribution", "MSME"),
    ("Saffron Medical Devices Limited", "Healthcare", "Medical Devices", "Corporate"),
    ("Lumen Agri Commodities Private Limited", "Agriculture", "Agri Trading", "MSME"),
    ("Cascade Logistics Services Limited", "Logistics", "Road Transport", "Corporate"),
    ("Meridian Technology Services Private Limited", "Services", "IT Services", "MSME"),
    ("Bluebay Specialty Chemicals Limited", "Manufacturing", "Specialty Chemicals", "Corporate"),
    ("Pinecrest Diagnostic Services Private Limited", "Healthcare", "Diagnostics", "MSME"),
    ("Silverline Building Products Limited", "Trading", "Building Materials", "Corporate"),
    ("Eastwind Warehousing Private Limited", "Logistics", "Warehousing", "MSME"),
    ("Orchid Consumer Distribution Limited", "Trading", "FMCG Distribution", "Corporate"),
    ("Banyan Export Textiles Private Limited", "Manufacturing", "Garments & Exports", "MSME"),
    ("Summit Engineering Works Limited", "Manufacturing", "Heavy Engineering", "Corporate"),
    ("Novus Renewable Components Private Limited", "Manufacturing", "Electrical Components", "MSME"),
    ("Hillcrest Pharma Supply Limited", "Trading", "Pharma Distribution", "Corporate"),
    ("Prism Business Solutions Private Limited", "Services", "Business Services", "MSME"),
    ("Sierra Industrial Metals Limited", "Manufacturing", "Metal Fabrication", "Corporate"),
    ("Greenfield Agricultural Inputs Private Limited", "Agriculture", "Farm Inputs", "MSME"),
    ("Cobalt Transit Equipment Limited", "Manufacturing", "Transportation Equipment", "Corporate"),
    ("Harbor Freight Logistics Private Limited", "Logistics", "Freight Forwarding", "MSME"),
    ("Amaya Nutraceutical Packaging Limited", "Manufacturing", "Food Packaging", "Corporate"),
    ("Maple Hospitality Services Private Limited", "Services", "Hospitality", "MSME"),
    ("Sunridge Rubber Products Limited", "Manufacturing", "Rubber Products", "Corporate"),
    ("Delta Farm Machinery Private Limited", "Manufacturing", "Agri Equipment", "MSME"),
    ("Vertex Homeware Distribution Limited", "Trading", "Wholesale Distribution", "Corporate"),
    ("Aquila Diagnostics Equipment Private Limited", "Healthcare", "Diagnostic Equipment", "MSME"),
]
LOCATIONS = ["Pune", "Mumbai", "Hyderabad", "Chennai", "Ahmedabad", "Bengaluru", "Nagpur", "Coimbatore", "Indore", "Nashik"]
PROFILES = ["stable", "watch", "stress", "recovery", "seasonal"]
GRADE_LABELS = {1:"A1", 2:"A2", 3:"A3", 4:"B1", 5:"B2", 6:"B3", 7:"C1", 8:"C2", 9:"D"}


def _financial(revenue, margin, dso, debt_ratio, cash_intensity, rng):
    r = lambda v: round(float(v), 3)
    cogs = revenue * rng.uniform(.66, .81)
    ebitda = revenue * margin
    ebit = ebitda - revenue * rng.uniform(.019, .031)
    interest = max(.08, revenue * rng.uniform(.012, .028))
    pat = (ebit - interest) * .75
    assets = revenue * rng.uniform(.91, 1.21)
    equity = assets * (1 - debt_ratio)
    liab = assets - equity
    debt = liab * rng.uniform(.53, .74)
    receivables = revenue * dso / 365
    inventory = revenue * rng.uniform(.10, .17)
    cash = revenue * rng.uniform(.018, .052)
    current_assets = max(assets * rng.uniform(.48,.61), (receivables+inventory+cash)*1.13)
    if current_assets > assets:
        assets = current_assets*1.13
        equity = assets*(1-debt_ratio); liab = assets - equity; debt = liab*.63
    current_liab = liab*rng.uniform(.48,.64)
    payables = min(liab*.38, cogs*rng.uniform(.085,.13))
    capex = revenue * rng.uniform(.018,.048)
    principal = max(.15, revenue*rng.uniform(.017,.032))
    ocf = ebitda * cash_intensity
    cfads = ocf + interest - capex*.45
    return {"revenue":r(revenue), "cogs":r(cogs), "ebitda":r(ebitda), "ebit":r(ebit),
            "interest_expense":r(interest), "pat":r(pat), "total_assets":r(assets),
            "total_liabilities":r(liab),"equity":r(equity),"total_debt":r(debt),
            "cash":r(cash),"current_assets":r(current_assets),"current_liabilities":r(current_liab),
            "inventory":r(inventory),"receivables":r(receivables),"payables":r(payables),
            "ocf":r(ocf),"capex":r(capex),"principal_due":r(principal),"cfads":r(cfads)}


def make_seed(as_of: date | None = None) -> dict:
    today = as_of or date.today()
    rng = random.Random(20261021)
    data = {k:[] for k in ("borrowers", "baseline_financials", "monitor_financials", "facilities",
          "balances", "account_credits", "repayments", "covenants", "ratings", "reports", "cases", "audit", "signal_events", "projections", "baseline_versions")}
    for i, (company, sector, sub, segment) in enumerate(BUSINESSES, start=1):
        bid = f"CW-{i:04d}"
        profile = PROFILES[(i-1)%5]
        base_rev = rng.uniform(12,68) if segment == "MSME" else rng.uniform(78,350)
        base_margin = rng.uniform(.12,.22)
        base_dso = rng.uniform(38,62)
        debt_ratio = rng.uniform(.50,.73)
        prior = None
        periods = {}
        for y in (2023,2024,2025,2026):
            if y == 2023:
                rev = base_rev*.82
                margin = base_margin
                dso = base_dso
                ocf_intensity = rng.uniform(.80,1.0)
            elif y in (2024,2025):
                rev = prior["revenue"] * rng.uniform(1.04,1.15)
                margin = base_margin+rng.uniform(-.014,.010)
                dso = base_dso + rng.uniform(-4,5)
                ocf_intensity = rng.uniform(.75,.99)
            else:
                growth = {"stable":rng.uniform(.06,.15), "watch":rng.uniform(-.085,-.015),
                          "stress":rng.uniform(-.27,-.13),"recovery":rng.uniform(.04,.12),
                          "seasonal":rng.uniform(.01,.09)}[profile]
                rev = prior["revenue"]*(1+growth)
                margin = base_margin + ({"stable":.005,"watch":-.022,"stress":-.047,
                                          "recovery":.018,"seasonal":-.008}[profile])
                dso = base_dso + {"stable":-2,"watch":15,"stress":34,"recovery":-7,"seasonal":9}[profile]
                ocf_intensity = {"stable":.94,"watch":.58,"stress":.08,"recovery":1.04,"seasonal":.72}[profile]
            item = _financial(rev, max(.045, margin), max(12,dso),debt_ratio,ocf_intensity,rng)
            if y == 2026 and profile == "stress" and i%2 == 0:
                item["ocf"] = round(-item["revenue"]*.015,3)
                item["cfads"] = round(item["ocf"] + item["interest_expense"] - item["capex"]*.45,3)
            errors,_ = validate_financials(item,y)
            if errors:
                raise AssertionError(f"Bad fixture {bid} FY{y}: {errors}")
            periods[y] = item
            prior=item
            target = "baseline_financials" if y<=2025 else "monitor_financials"
            if y <= 2025 or i%9 != 0:
                data[target].append({"borrower_id":bid,"fy":y,"data":item,"statement_type":"Audited" if y<=2025 else ("Audited" if i%3 else "Provisional"),
                                     "source":"Synthetic approved master" if y<=2025 else "Synthetic monitoring submission",
                                     "updated_at":today.isoformat(),"updated_by":"seed"})
        if i%3!=0:
            b0=compute_ratios(periods[2025])
            data["projections"].append({"borrower_id":bid,"fy":2026,
                "revenue":round(periods[2025]["revenue"]*1.12,3),
                "ebitda_margin":round((b0.get("ebitda_margin") or 0)+.8,3),
                "ocf":round(periods[2025]["ocf"]*1.10,3),
                "dscr":round((b0.get("dscr") or 1.4)*1.05,3),
                "source":"Synthetic sanction-approved projections"})
        sanction_date = date(2025,4,1) + timedelta(days= (i*9)%145)
        borrower={"borrower_id":bid,"company_name":company,"sector":sector,"sub_industry":sub,
                  "segment":segment,"location":LOCATIONS[(i-1)%len(LOCATIONS)],"sanction_date":sanction_date.isoformat(),
                  "sanction_fy":2025,"baseline_locked":True,"approval_status":"APPROVED", "risk_profile_fixture":profile,
                  "monitoring_due_date":(today+timedelta(days= (i%7-4)*9)).isoformat(),
                  "description":f"Synthetic {segment.lower()} borrower operating in {sub.lower()}. All records and events are fabricated for product testing."}
        data["borrowers"].append(borrower)
        facilities=[]
        # Some term-loan-only borrowers test not-applicable handling for utilisation rules.
        cc_type = None if i%11==0 else ("OD" if i%6==0 else "CC")
        if cc_type:
            facilities.append({"facility_id":f"{bid}-WC","borrower_id":bid,"facility_type":cc_type,
                               "sanctioned_limit":round(base_rev*(.055 if segment=="MSME" else .042),3),
                               "interest_rate":round(rng.uniform(9.1,12.9),2),
                               "sanction_date":sanction_date.isoformat(),"maturity_date":"2027-03-31"})
        if i%5!=0:
            facilities.append({"facility_id":f"{bid}-TL","borrower_id":bid,"facility_type":"TERM",
                               "sanctioned_limit":round(base_rev*rng.uniform(.025,.062),3),
                               "interest_rate":round(rng.uniform(9.0,13.3),2),
                               "sanction_date":sanction_date.isoformat(),"maturity_date":"2029-06-30"})
        if i%6==0:
            facilities.append({"facility_id":f"{bid}-BG","borrower_id":bid,"facility_type":"BG",
                               "sanctioned_limit":round(base_rev*.020,3),"interest_rate":0.0,
                               "sanction_date":sanction_date.isoformat(),"maturity_date":"2027-12-31"})
        data["facilities"].extend(facilities)
        for fac in facilities:
            if fac["facility_type"] == "BG":
                continue
            for d in range(90):
                dt=today-timedelta(days=89-d)
                t=d/89
                if fac["facility_type"] in ("CC","OD"):
                    start,end={"stable":(.48,.57),"watch":(.60,.89),"stress":(.70,.97),
                               "recovery":(.93,.56),"seasonal":(.70,.92)}[profile]
                    u=max(.08,min(1.03,start+(end-start)*t + rng.gauss(0,.024)))
                else:
                    u=.79-(t*.06)
                data["balances"].append({"borrower_id":bid,"facility_id":fac["facility_id"],
                                         "date":dt.isoformat(),"outstanding_cr":round(fac["sanctioned_limit"]*u,3),
                                         "sanctioned_limit_cr":fac["sanctioned_limit"],"complete":True,
                                         "source":"Synthetic daily CBS extract"})
        monthly_factor={"stable":1.07,"watch":.78,"stress":.55,"recovery":1.16,"seasonal":.85}[profile]
        for d in range(90):
            dt=today-timedelta(days=89-d)
            lastmonth = d>=60
            factor = monthly_factor if lastmonth else (1.0 if d>=30 else 1.04)
            # Day-end zero credits on weekends are explicit observed zeroes, not absent dates.
            weekday_multiplier=0 if dt.weekday()>=5 else rng.uniform(.65,1.43)
            value=base_rev/365*factor*weekday_multiplier*1.45
            if i%13==0 and d in range(66,73):
                continue  # Missing records make data quality visible, not healthy.
            data["account_credits"].append({"borrower_id":bid,"date":dt.isoformat(),
                                             "eligible_credit_cr":round(value,4),"complete":True,
                                             "source":"Synthetic bank-account turnover"})
        for fac in facilities:
            if fac["facility_type"] not in ("TERM","CC","OD"):
                continue
            for months_back in (2,1,0):
                due=today-timedelta(days=65-months_back*27)
                obligation=round(fac["sanctioned_limit"]*(.007 if fac["facility_type"] in ("CC","OD") else .026),4)
                stress_arrears = profile=="stress" and months_back==1 and fac["facility_type"]=="TERM"
                watch_arrears = profile=="watch" and months_back==2 and fac["facility_type"]=="TERM"
                paid = 0 if (stress_arrears or watch_arrears) else obligation
                paid_day = None if not paid else (due+timedelta(days=2 if profile=="watch" else 0)).isoformat()
                data["repayments"].append({"borrower_id":bid,"facility_id":fac["facility_id"],
                    "obligation_id":f"{fac['facility_id']}-{due.isoformat()}","due_date":due.isoformat(),
                    "amount_due_cr":obligation,"paid_cr":paid,"paid_date":paid_day,"source":"Synthetic loan servicing"})
        data["covenants"].append({"borrower_id":bid,"covenant_id":f"{bid}-DSCR","metric":"dscr",
                                  "operator":">=","threshold":1.20 if i%4 else 1.35,
                                  "test_fy":2026,"waiver_active":i%17==0,"cure_pending":False,
                                  "source":"Synthetic sanction agreement"})
        if i%10!=0:
            old_grade=2+(i%3)
            grade=min(9,max(1,old_grade+{"stable":0,"watch":1,"stress":3,"recovery":-1,"seasonal":0}[profile]))
            data["ratings"].extend([{"borrower_id":bid,"date":"2025-07-01","rating":old_grade,
                "grade":GRADE_LABELS[old_grade],"scale":"CW-INTERNAL-1","source":"Synthetic internal rating"},
                {"borrower_id":bid,"date":today.isoformat(),"rating":grade,
                "grade":GRADE_LABELS[grade],"scale":"CW-INTERNAL-1","source":"Synthetic internal rating"}])
        if i%9!=0:
            status = ["FINALIZED","PENDING_AVP","PENDING_CRO","RETURNED","DRAFT"][(i-1)%5]
            report={"report_id":f"CMR-{bid}-2026","borrower_id":bid,"fy":2026,"status":status,
                "version":1,"analyst_notes":"Post-sanction financial movement and account conduct require routine surveillance.",
                "avp_notes":"", "cro_notes":"", "classification_override":None,
                "created_at":(today-timedelta(days=19+i%12)).isoformat(),
                "updated_at":(today-timedelta(days=i%6)).isoformat(),
                "review_history":[], "finalized_snapshot":None}
            if status=="RETURNED":
                report["returned_to"]="Analyst"
                report["review_history"].append({"actor":"Monitoring AVP (demo)","action":"RETURNED_TO_ANALYST",
                    "at":(today-timedelta(days=4)).isoformat(),
                    "reason":"Recheck receivables and explain monitoring-year cash flow assumptions."})
            if status in ("PENDING_CRO","FINALIZED"):
                report["review_history"].append({"actor":"Monitoring AVP (demo)","action":"APPROVED_BY_AVP","at":(today-timedelta(days=7)).isoformat(),"reason":"Financial monitoring reviewed"})
            if status=="FINALIZED":
                report["review_history"].append({"actor":"VP/CRO (demo)","action":"FINALIZED","at":(today-timedelta(days=3)).isoformat(),"reason":"Monitoring observations accepted"})
            data["reports"].append(report)
    result = {"metadata":{"seed_version":SEED_VERSION,"synthetic":True,"generated_as_of":today.isoformat(),
                         "units":"INR crore","disclaimer":"100% synthetic and non-regulatory demonstration data"}, **data}
    from .ews import evaluate
    from .commentary import generate_report
    for borrower in result["borrowers"]:
        bid=borrower["borrower_id"]
        a=evaluate(result,bid,as_of=today)
        for signal in a["signals"]:
            if signal["level"] in ("MEDIUM","HIGH","CRITICAL"):
                result["cases"].append({"case_id":f"CASE-{bid}-{signal['id']}",
                    "borrower_id":bid,"signal_id":signal["id"],"severity":signal["level"],
                    "status":"OPEN","owner":"Monitoring team","opened_at":today.isoformat(),
                    "updated_at":today.isoformat(),"notes":[],"reviewed":False})
                result["signal_events"].append({"borrower_id":bid,"signal_id":signal["id"],
                     "at":today.isoformat(),"event":"NEW","severity":signal["level"]})
    for rep in result["reports"]:
        if rep["status"]=="FINALIZED":
            bid=rep["borrower_id"]
            a=evaluate(result,bid,as_of=today)
            rep["finalized_snapshot"]={"captured_at":today.isoformat(),
                 "financials":copy.deepcopy(next(r["data"] for r in result["monitor_financials"] if r["borrower_id"]==bid and r["fy"]==2026)),
                 "baseline_records":copy.deepcopy([r for r in result["baseline_financials"] if r["borrower_id"]==bid]),
                 "assessment":a,"narrative":generate_report(result,bid,a),
                 "approved_by":"VP/CRO (demo)","reason":"Synthetic demonstration finalization"}
    return result
