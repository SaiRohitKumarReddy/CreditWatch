"""Optional Groq AI synthesis above a deterministic, evidence-first credit report.

No LLM is required for finance calculations or EWS classification. A Groq call
occurs only on an explicit user request with external-processing consent.
"""
from __future__ import annotations

import json
import os
import re
import urllib.request
import urllib.error
from .commentary import ask_local,generate_report
from .ews import evaluate


def configured_api_key():
    key=os.environ.get("GROQ_API_KEY", "").strip()
    if key:return key
    try:
        import streamlit as st
        configured=st.secrets.get("groq",{})
        return str(configured.get("api_key","")).strip()
    except Exception:
        return ""


def _allowed_numeric_tokens(evidence, question):
    # Conservative: don't admit a new quantitative claim solely because an LLM wrote it.
    captures=re.findall(r"\d+(?:,\d{3})*(?:\.\d+)?",evidence+"\n"+question)
    ans=set()
    for item in captures:
        try: ans.add(round(float(item.replace(',','')),4))
        except ValueError: pass
    ans.update({0.,1.,2.,3.,4.,5.,10.,12.,30.,90.,100.,365.})
    return ans


def _has_unsupported_numbers(candidate, approved):
    for item in re.findall(r"(?<![A-Za-z])\d+(?:,\d{3})*(?:\.\d+)?",candidate):
        try:v=round(float(item.replace(',','')),4)
        except ValueError:continue
        if v not in approved:return True
    return False


def ask(data,bid,question,use_groq=False,consent=False):
    local=ask_local(data,bid,question)
    if not use_groq:return local
    if not consent:raise ValueError("Explicit external AI processing consent is required.")
    key=configured_api_key()
    if not key:raise ValueError("No Groq API key is configured. Uncheck external AI to use local evidence analysis.")
    assessment=evaluate(data,bid)
    evidence=generate_report(data,bid,assessment)
    compact={
        "subject":"Entirely fabricated Corporate/MSME borrower. Not a real bank customer.",
        "sanction_baseline_fy":assessment["baseline_year"],
        "monitoring_actual_fy":assessment["monitoring_year"],
        "executive_assessment":evidence["executive"],
        "sections":evidence["sections"],
        "early_warning_signals":[{k:s[k] for k in ("id","name","level","observed","reference","detail","source","as_of")}
                                 for s in assessment["signals"]],
        "recommended_investigations":evidence["actions"],
        "definitions":evidence["method"],
    }
    evidence_text=json.dumps(compact,ensure_ascii=False,sort_keys=True)
    prompt=("You are an experienced corporate/MSME credit monitoring assistant. Write a detailed but disciplined "
            "post-sanction financial-monitoring explanation answering the officer question. Use ONLY values already present "
            "in the attached VERIFIED EVIDENCE. Never invent financial figures, dates, causality, sources, companies, "
            "policy thresholds, legal status, credit ratings, or remedial decisions. Do not compute new figures. Distinguish "
            "financial deterioration from confirmed loan default or covenant breach. Clearly identify unavailable evidence. "
            "Do not call screening risk a PD estimate. Output plain prose with useful headings.\n\n"+evidence_text)
    payload={"model":os.environ.get("GROQ_MODEL","openai/gpt-oss-20b"),
             "temperature":0.0,"max_tokens":1450,
             "messages":[{"role":"system","content":prompt},{"role":"user","content":question}]}
    request=urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization":"Bearer "+key,"Content-Type":"application/json","User-Agent":"CreditWatchDemo/1.0 (Groq API integration; Python)"},method="POST")
    try:
        with urllib.request.urlopen(request,timeout=25) as response:
            obj=json.loads(response.read(200000))
        answer=str(obj["choices"][0]["message"]["content"] or "").strip()
        if not answer or len(answer)>16000 or _has_unsupported_numbers(answer,_allowed_numeric_tokens(evidence_text,question)):
            return local
        return {"mode":"GROQ_AI_WITH_GUARD","answer":answer,
                "notice":"External Groq AI output screened against the deterministic evidence. Human review is required; this is not a lending decision."}
    except (TimeoutError,urllib.error.URLError,KeyError,IndexError,ValueError,TypeError):
        return local
