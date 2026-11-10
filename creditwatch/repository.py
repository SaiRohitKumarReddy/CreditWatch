"""Local demo JSON persistence, atomic writes and role-neutral audit records.

For synthetic, single-process demos only; not an institutional data store.
"""
from __future__ import annotations

import copy
import json
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from .seed import make_seed,SEED_VERSION

_LOCK=threading.RLock()


def utcnow():return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id(prefix):return f"{prefix}-{uuid.uuid4().hex[:10]}"


class Store:
    def __init__(self,path):
        self.path=Path(path)

    def load(self):
        with _LOCK:
            if not self.path.is_file():
                self.path.parent.mkdir(parents=True,exist_ok=True)
                self._write(make_seed())
            with self.path.open("r",encoding="utf-8") as f:
                return json.load(f)

    def _write(self,data):
        self.path.parent.mkdir(parents=True,exist_ok=True)
        temp=self.path.with_name(self.path.name+".new")
        with temp.open("w",encoding="utf-8") as f:
            json.dump(data,f,ensure_ascii=False,allow_nan=False,separators=(",",":"))
            f.flush();os.fsync(f.fileno())
        os.replace(temp,self.path)

    def modify(self,func,*args,**kwargs):
        with _LOCK:
            original=self.load()
            data=copy.deepcopy(original)
            result=func(data,*args,**kwargs)
            self._write(data)
            return result


def audit(data,actor,action,bid="",details=None):
    data["audit"].append({"id":new_id("EV"),"at":utcnow(),"actor":actor,
                          "action":action,"borrower_id":bid,"details":details or {}})
