"""HTTP integration tests with an isolated synthetic store."""
from fastapi.testclient import TestClient
import server
from creditwatch.repository import Store


def test_api_demo_auth_and_protected_changes(tmp_path,monkeypatch):
    local=Store(tmp_path/'test.json')
    monkeypatch.setattr(server,'store',local)
    with TestClient(server.app) as client:
        state=client.get('/api/state')
        assert state.status_code==200
        assert state.json()['authenticated'] is False
        assert client.post('/api/action',json={'kind':'login','role':'Analyst'}).status_code==200
        state=client.get('/api/state').json()
        assert state['role']=='Analyst'
        assert state['overview']['metrics']['borrowers']==30
        assert client.post('/api/action',json={'kind':'new_borrower','company':'Not allowed'}).status_code==403
        f=next(x['data'] for x in local.load()['baseline_financials'] if x['borrower_id']=='CW-0001' and x['fy']==2025)
        invalid={**f,'revenue':f['revenue']+2}
        res=client.post('/api/action',json={'kind':'save_financial','borrower_id':'CW-0001',
             'fy':2025,'baseline':True,'values':invalid,'reason':'Unauthorized financial correction'})
        assert res.status_code==403
        ai=client.post('/api/action',json={'kind':'ask','question':'Tell me credit commentry since sanction'})
        assert ai.status_code==200
        response=client.get('/api/state').json()
        assert response['last_ai']['mode']=='LOCAL_EVIDENCE_ASSISTANT'
        assert 'since sanction' in response['last_ai']['answer'].lower()


def test_api_synthetic_scenario_changes_actual_ews(tmp_path,monkeypatch):
    monkeypatch.setattr(server,'store',Store(tmp_path/'test.json'))
    with TestClient(server.app) as client:
        client.get('/api/state')
        client.post('/api/action',json={'kind':'login','role':'VP/CRO'})
        before=client.get('/api/state').json()
        assert before['detail']['borrower']['borrower_id']=='CW-0001'
        assert before['detail']['assess']['classification']=='LOW'
        sim=client.post('/api/action',json={'kind':'simulate','scenario':'repayment_miss','borrower_id':'CW-0001'})
        assert sim.status_code==200
        after=client.get('/api/state').json()
        assert next(s for s in after['detail']['assess']['signals'] if s['id']=='CW-07')['level']=='HIGH'
        assert after['overview']['metrics']['triggered_borrowers']>=before['overview']['metrics']['triggered_borrowers']


def test_external_ai_requires_explicit_consent(tmp_path,monkeypatch):
    monkeypatch.setattr(server,'store',Store(tmp_path/'test.json'))
    with TestClient(server.app) as client:
        client.get('/api/state')
        client.post('/api/action',json={'kind':'login','role':'VP/CRO'})
        response=client.post('/api/action',json={'kind':'ask','question':'Summarize post sanction financial risk',
                         'use_groq':True,'ai_consent':False})
        assert response.status_code==400
        assert 'consent' in response.json()['detail'].lower()
