"""CreditWatch — Streamlit 1.53+ HTML/CSS/JS host.

CreditLens-compatible financial calculations are in credit_platform.finance.
Run: python -m streamlit run app.py
"""
from __future__ import annotations
import os
from functools import lru_cache
from pathlib import Path

from creditwatch.storage import get_store
from creditwatch.service import apply_action,get_state

ROOT=Path(__file__).resolve().parent
DATA=Path(os.environ.get("CREDITWATCH_DATA_FILE",str(ROOT/".local_data"/"creditwatch_demo.json")))

@lru_cache(maxsize=1)
def component():
    import streamlit as st
    if not hasattr(st.components,"v2"):
        raise RuntimeError("CreditWatch requires Streamlit 1.53+ for custom HTML Components V2.")
    return st.components.v2.component(
        name="creditwatch_html_workspace",
        html='<div id="creditwatch-html-root"></div>',
        css=(ROOT/"frontend"/"app.css").read_text(encoding="utf-8"),
        js=(ROOT/"frontend"/"app.js").read_text(encoding="utf-8"),
        isolate_styles=True,
    )


def main():
    import streamlit as st
    st.set_page_config(page_title="CreditWatch | Monitoring & Early Warning System",layout="wide",initial_sidebar_state="collapsed")
    st.markdown('''<style>
      [data-testid="stSidebar"], [data-testid="collapsedControl"],
      [data-testid="stSidebarCollapsedControl"], header[data-testid="stHeader"] {display:none!important}
      [data-testid="stAppViewContainer"] .block-container {padding:0!important;max-width:100%!important}
      [data-testid="stAppViewContainer"] {background:#f5f8fa}
      .stApp {margin:0!important;padding:0!important}
    </style>''',unsafe_allow_html=True)
    if "cw_session" not in st.session_state:
        st.session_state["cw_session"]={}
    session=st.session_state["cw_session"]
    payload=get_state(get_store(DATA).load(),session)
    rendered=component()(data=payload,key="cw_main_workspace",width="stretch",height="content",on_action_change=lambda:None)
    a=getattr(rendered,"action",None)
    if isinstance(a,dict) and a.get("event_id")!=session.get("last_event_id"):
        try:
            if a.get("kind") in ("login","logout","select_borrower","ask","ai_risk_investigate","ai_portfolio_intelligence"):
                apply_action(get_store(DATA).load(),session,a)
            else:
                get_store(DATA).modify(lambda data: apply_action(data,session,a))
            session["last_event_id"]=a["event_id"]
        except (ValueError,LookupError,PermissionError) as e:
            session["last_event_id"]=a.get("event_id")
            session["notice"]={"type":"error","text":str(e)}
        st.rerun()

if __name__=="__main__":main()
