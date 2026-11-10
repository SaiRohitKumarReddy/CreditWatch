"""Optional stand-alone local/demo web host for CreditWatch.

Runs the same HTML/JS + Python engine as Streamlit. Demo role selection is not
production login. Synthetic data ONLY. Run: uvicorn server:app --reload
"""
from __future__ import annotations

import os
import secrets
import threading
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from creditwatch.storage import get_store
from creditwatch.service import apply_action, get_state

ROOT=Path(__file__).resolve().parent
DATA_FILE=Path(os.environ.get("CREDITWATCH_DATA_FILE",str(ROOT/".local_data"/"creditwatch_demo.json")))
store=get_store(DATA_FILE)
app=FastAPI(title="CreditWatch — Synthetic Corporate & MSME Monitoring",docs_url=None,redoc_url=None)
app.mount("/static", StaticFiles(directory=ROOT/"frontend"),name="static")
SESSIONS:dict[str,dict]={}
SESSION_LOCK=threading.RLock()


def get_session(req:Request,res:Response):
    key=req.cookies.get("cw_demo")
    with SESSION_LOCK:
        if not key or key not in SESSIONS:
            key=secrets.token_urlsafe(26)
            SESSIONS[key]={}
            res.set_cookie("cw_demo",key,httponly=True,samesite="lax",secure=False,max_age=86400)
        return SESSIONS[key]


@app.get("/")
def index():
    return FileResponse(ROOT/"frontend"/"index.html")


@app.get("/api/state")
def state(req:Request,res:Response):
    session=get_session(req,res)
    return get_state(store.load(),session)


@app.post("/api/action")
async def action(req:Request,res:Response):
    session=get_session(req,res)
    raw=await req.body()
    if len(raw)>900000:raise HTTPException(413,"Action payload exceeds 900 KB")
    try:
        import json
        payload=json.loads(raw)
        if not isinstance(payload,dict):raise ValueError("Expected an action object")
        if payload.get("kind") in ("login","logout","select_borrower","ask","ai_risk_investigate","ai_portfolio_intelligence"):
            apply_action(store.load(),session,payload)
        else:
            store.modify(lambda data:apply_action(data,session,payload))
        return {"ok":True}
    except (ValueError,LookupError) as e:
        raise HTTPException(400,str(e)) from e
    except PermissionError as e:
        raise HTTPException(403,str(e)) from e


@app.get("/health")
def health():
    return {"status":"ok","synthetic":True,"borrowers":len(store.load()["borrowers"])}
