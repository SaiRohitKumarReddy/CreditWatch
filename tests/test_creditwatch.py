"""Business-logic acceptance suite. All data is synthetic and no APIs are needed."""
import copy
import hashlib
from collections import Counter
from datetime import date
from pathlib import Path
import pytest

from credit_platform.finance import compute_ratios,validate_financials
from creditwatch.seed import make_seed,SEED_VERSION
from creditwatch.ews import IDS,evaluate
from creditwatch.commentary import generate_report,ask_local
from creditwatch.service import apply_action,get_state
from creditwatch.repository import Store

DATE=date(2026,10,21)

@pytest.fixture
def data():return make_seed(DATE)


def session(role,bid):return {"role":role,"selected_borrower":bid}


def financial(data,bid,fy=2026,baseline=False):
    table=data["baseline_financials"] if baseline else data["monitor_financials"]
    return next(r for r in table if r["borrower_id"]==bid and r["fy"]==fy)


def test_creditlens_canonical_modules_are_unchanged():
    base=Path(__file__).resolve().parents[1]/"credit_platform"
    expected={"finance.py":"aba0e4b97dd9877bc59a611e209f02917c629226d8190fefd784da53d758415a",
              "constants.py":"8d3641f1b0bbb728c0a21bd97dcb3e90eda26222c05217b4f1b514c9acd11f8e"}
    # Content fingerprints are pinned to the specific CreditLens ZIP supplied with this work.
    for name,h in expected.items():assert hashlib.sha256((base/name).read_bytes()).hexdigest()==h


def test_approved_existing_borrowers_only(data):
    assert len(data["borrowers"])==30
    assert all(x["approval_status"]=="APPROVED" for x in data["borrowers"])
    assert len({x["borrower_id"] for x in data["borrowers"]})==30
    assert not any('real' in x["description"].lower() and 'fabricated' not in x["description"].lower() for x in data["borrowers"])
    with pytest.raises(PermissionError,match="New borrower"):
        apply_action(data,session('VP/CRO','CW-0001'),{'kind':'new_borrower','company':'Unauthorized'})


def test_seed_balance_sheets_are_valid(data):
    assert len(data["baseline_financials"])==90
    assert len(data["balances"])>=4000
    assert len(data["account_credits"])>=2500
    for record in data["baseline_financials"]+data["monitor_financials"]:
        assert validate_financials(record["data"],record["fy"])[0]==[]
        f=record["data"]
        assert abs(f["total_assets"]-f["total_liabilities"]-f["equity"])<.03


def test_exact_creditlens_ratio_definitions(data):
    f=financial(data,'CW-0001')["data"]
    ratio=compute_ratios(f)
    assert ratio["dso"] == pytest.approx(f["receivables"]*365/f["revenue"])
    assert ratio["dscr"] == pytest.approx(f["cfads"]/(f["interest_expense"]+f["principal_due"]))
    assert ratio["ccc"] == pytest.approx(ratio["dso"]+ratio["dio"]-ratio["dpo"])
    assert ratio["debt_equity"] == pytest.approx(f["total_debt"]/f["equity"])


def test_all_ten_ews_available_and_graded(data):
    for borrower in data["borrowers"]:
        a=evaluate(data,borrower['borrower_id'])
        assert [s["id"] for s in a["signals"]]==list(IDS)
        assert len(a["signals"])==10
        assert a["classification"] in ('LOW','MEDIUM','HIGH','CRITICAL','UNASSESSED')
        assert 0<=a["coverage_percent"]<=100
        for s in a["signals"]:
            assert s['level'] in ('CLEAR','MEDIUM','HIGH','CRITICAL','NOT_EVALUATED','NOT_APPLICABLE','STALE')
            assert s['detail']
    risk=Counter(evaluate(data,b['borrower_id'])['classification'] for b in data['borrowers'])
    assert risk['LOW']>0 and risk['HIGH']>0 and risk['CRITICAL']>0 and risk['UNASSESSED']>0


def test_nondebt_cc_signals_are_not_applicable(data):
    a=evaluate(data,'CW-0011')
    assert a['signals'][0]['level']=='NOT_APPLICABLE'
    assert a['signals'][1]['level']=='NOT_APPLICABLE'


def test_missing_credit_observations_are_not_healthy(data):
    a=evaluate(data,'CW-0013')
    assert next(s for s in a['signals'] if s['id']=='CW-04')['level']=='NOT_EVALUATED'


def test_overdue_has_high_or_critical(data):
    a=evaluate(data,'CW-0003')
    assert next(s for s in a['signals'] if s['id']=='CW-07')['level']=='CRITICAL'
    assert a['classification']=='CRITICAL'


def test_post_sanction_commentary_is_evidence_based(data):
    x=generate_report(data,'CW-0003')
    assert 'FY2025' in x['executive'] and 'FY2026' in x['executive']
    assert 'since sanction' in x['executive'].lower()
    assert any('DSCR' in s['body'] for s in x['sections'])
    assert 'CreditLens' in x['method']
    response=ask_local(data,'CW-0003','give credit apprasial commentry')
    assert response['mode']=='LOCAL_EVIDENCE_ASSISTANT'
    assert 'DSCR' in response['answer']


def test_analyst_and_avp_cannot_edit_baseline(data):
    original=financial(data,'CW-0002',2025,True)['data']
    revised={**original,'revenue':original['revenue']+3}
    for role in ('Analyst','AVP'):
        with pytest.raises(PermissionError,match='Only VP/CRO'):
            apply_action(data,session(role,'CW-0002'),{'kind':'save_financial','baseline':True,'fy':2025,
              'values':revised,'reason':'Revised audited borrower revenue'})
    assert financial(data,'CW-0002',2025,True)['data']==original


def test_analyst_can_edit_draft_but_not_pending(data):
    draft=financial(data,'CW-0005')['data']
    apply_action(data,session('Analyst','CW-0005'),{'kind':'save_financial','fy':2026,'values':{**draft,'revenue':draft['revenue']+1}})
    assert financial(data,'CW-0005')['data']['revenue']==draft['revenue']+1
    pending=financial(data,'CW-0002')['data']
    with pytest.raises(PermissionError,match='Analysts may edit'):
        apply_action(data,session('Analyst','CW-0002'),{'kind':'save_financial','fy':2026,
          'values':{**pending,'revenue':pending['revenue']+1}})


def test_avp_corrects_submission_with_audit(data):
    bid='CW-0002';old=financial(data,bid)['data'];new={**old,'revenue':old['revenue']+2}
    apply_action(data,session('AVP',bid),{'kind':'save_financial','fy':2026,'values':new,
                  'reason':'Verified revised management actual sales'})
    assert financial(data,bid)['data']['revenue']==new['revenue']
    log=[x for x in data['audit'] if x['action']=='monitor_financials_revised']
    assert log[-1]['details']['changed_fields']['revenue']=={'before':old['revenue'],'after':new['revenue']}
    assert evaluate(data,bid)['monitoring_year']==2026


def test_vpcro_baseline_edit_is_versioned_and_approved_report_immutable(data):
    bid='CW-0001';r=next(x for x in data['reports'] if x['borrower_id']==bid)
    assert r['status']=='FINALIZED'
    prev_snapshot=copy.deepcopy(r['finalized_snapshot'])
    old=financial(data,bid,2025,True)['data'];new={**old,'revenue':old['revenue']+3}
    apply_action(data,session('VP/CRO',bid),{'kind':'save_financial','baseline':True,'fy':2025,
                  'values':new,'reason':'VP/CRO confirmed sanctioned actual revision'})
    assert financial(data,bid,2025,True)['data']['revenue']==new['revenue']
    assert len(data['baseline_versions'])==1
    assert data['baseline_versions'][0]['before']==old
    assert r['finalized_snapshot']==prev_snapshot
    assert r['status']=='FINALIZED'


def test_full_sequential_report_approval(data):
    bid='CW-0005'
    sa=session('Analyst',bid)
    apply_action(data,sa,{'kind':'submit','fy':2026,'notes':'All financials reviewed and trends discussed'})
    r=next(x for x in data['reports'] if x['borrower_id']==bid)
    assert r['status']=='PENDING_AVP'
    with pytest.raises(PermissionError):apply_action(data,sa,{'kind':'avp_approve','fy':2026})
    apply_action(data,session('AVP',bid),{'kind':'avp_approve','fy':2026})
    assert r['status']=='PENDING_CRO'
    with pytest.raises(PermissionError):apply_action(data,session('AVP',bid),{'kind':'finalize','fy':2026,'reason':'Reviewed all monitoring parameters'})
    apply_action(data,session('VP/CRO',bid),{'kind':'finalize','fy':2026,'reason':'Final CRO monitoring review completed'})
    assert r['status']=='FINALIZED'
    assert r['finalized_snapshot']['financials']==financial(data,bid)['data']
    assert [z['action'] for z in r['review_history']][-3:]==['SUBMITTED_TO_AVP','APPROVED_BY_AVP','FINALIZED_BY_CRO']


def test_cro_reopening_monitor_financial_does_not_overwrite_approved_snapshot(data):
    bid='CW-0001';r=next(x for x in data['reports'] if x['borrower_id']==bid)
    snapshot=copy.deepcopy(r['finalized_snapshot'])
    old=financial(data,bid)['data']
    apply_action(data,session('VP/CRO',bid),{'kind':'save_financial','fy':2026,'values':{**old,'pat':old['pat']+.3},
                         'reason':'VP/CRO approved later monitoring correction'})
    assert r['status']=='PENDING_CRO'
    assert r['finalized_snapshot'] is None
    assert r['superseded_snapshots'][0]==snapshot
    assert r['version']==2


def test_new_monitoring_fy_is_separate_and_requires_validation(data):
    bid='CW-0001';a=session('Analyst',bid)
    apply_action(data,a,{'kind':'create_period','fy':2027})
    row=financial(data,bid,2027)
    assert row['valid'] is False
    assert evaluate(data,bid)['monitoring_year']==2026
    with pytest.raises(ValueError,match='Complete and validate'):
        apply_action(data,a,{'kind':'submit','fy':2027})
    old=financial(data,bid,2026)['data']
    apply_action(data,a,{'kind':'save_financial','fy':2027,'values':old})
    assert row['valid']
    assert evaluate(data,bid)['monitoring_year']==2027
    apply_action(data,a,{'kind':'submit','fy':2027})
    assert next(r for r in data['reports'] if r['borrower_id']==bid and r['fy']==2027)['status']=='PENDING_AVP'


def test_demo_scenarios_recalculate_ews_and_cases(data):
    bid='CW-0001';a=session('Analyst',bid)
    assert evaluate(data,bid)['classification']=='LOW'
    apply_action(data,a,{'kind':'simulate','scenario':'repayment_miss'})
    signal=next(s for s in evaluate(data,bid)['signals'] if s['id']=='CW-07')
    assert signal['level']=='HIGH'
    assert any(c['borrower_id']==bid and c['signal_id']=='CW-07' for c in data['cases'])
    apply_action(data,a,{'kind':'simulate','scenario':'credit_decline'})
    signal=next(s for s in evaluate(data,bid)['signals'] if s['id']=='CW-04')
    assert signal['level']=='HIGH'


def test_analyst_cannot_close_alert(data):
    case=next(c for c in data['cases'] if c['borrower_id']=='CW-0003')
    with pytest.raises(PermissionError):
        apply_action(data,session('Analyst','CW-0003'),{'kind':'case_update','case_id':case['case_id'],
                      'status':'RESOLVED','reason':'The investigation has been completed'})
    apply_action(data,session('AVP','CW-0003'),{'kind':'case_update','case_id':case['case_id'],
                      'status':'INVESTIGATING','reason':'Borrower cash-flow review requested'})
    assert case['status']=='INVESTIGATING'


def test_dashboard_unique_borrower_exposure(data):
    st=get_state(data,session('VP/CRO','CW-0003'))
    o=st['overview'];borrowers=o['borrowers'];m=o['metrics']
    assert m['borrowers']==30
    assert m['triggered_borrowers']==sum(x['triggered']>0 for x in borrowers)
    assert m['high_critical_funded_cr']==pytest.approx(round(sum(x['funded_os_cr'] for x in borrowers if x['risk'] in ('HIGH','CRITICAL')),2))
    assert set(s['id'] for s in o['signal_counts'])==set(IDS)
    assert len(o['queue'])+o['counts']['FINALIZED']==30


def test_store_roundtrip_atomic(tmp_path):
    store=Store(tmp_path/'nested'/'demo.json');before=store.load()
    assert len(before['borrowers'])==30
    store.modify(lambda d:d['metadata'].update({'test_marker':'present'}))
    assert store.load()['metadata']['test_marker']=='present'
    assert not (tmp_path/'nested'/'demo.json.new').exists()


def test_ai_synthesizer_guard_rejects_unsupported_numeric_claims(data,monkeypatch):
    from creditwatch.ai import _has_unsupported_numbers,ask
    assert _has_unsupported_numbers('Revenue increased to 99999 crore', {10.0,20.0})
    assert not _has_unsupported_numbers('Revenue was 20 crore', {10.0,20.0})
    with pytest.raises(ValueError, match='consent'):
        ask(data,'CW-0001','Explain post sanction risk',use_groq=True,consent=False)


def test_cro_has_every_workspace_function(data):
    role='VP/CRO'
    state=get_state(data,session(role,'CW-0001'))
    assert all(state['permissions'][k] for k in ('edit_baseline','edit_submissions','approve_avp','finalize','full_portfolio','case_close'))
