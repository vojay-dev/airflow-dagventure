from __future__ import annotations

import asyncio
import logging
import os
import threading
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

import requests
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

import airflow_client.client
from airflow_client.client.api import DAGApi, DagRunApi, TaskInstanceApi
from airflow_client.client.exceptions import ApiException

from airflow.plugins_manager import AirflowPlugin

log = logging.getLogger(__name__)

PLUGIN_DIR = Path(__file__).parent
STATIC_DIR = PLUGIN_DIR / "static"
ASSETS_DIR = PLUGIN_DIR / "assets"

# Stamped at plugin load — forces browsers to re-fetch JS/CSS after a restart.
_BUILD_TS = str(int(time.time()))

AIRFLOW_HOST     = os.environ.get("DAGVENTURE_HOST",     "http://localhost:8080")
AIRFLOW_USERNAME = os.environ.get("DAGVENTURE_USERNAME", "admin")
AIRFLOW_PASSWORD = os.environ.get("DAGVENTURE_PASSWORD", "admin")

_token_lock: threading.Lock = threading.Lock()
_cached_token: str | None   = None
_token_expires_at: float    = 0.0


def _fetch_fresh_token() -> str:
    """Exchange username/password for a JWT access token from Airflow."""
    response = requests.post(
        f"{AIRFLOW_HOST}/auth/token",
        json={"username": AIRFLOW_USERNAME, "password": AIRFLOW_PASSWORD},
        timeout=10,
    )
    if response.status_code != 201:
        raise RuntimeError(f"Airflow auth failed ({response.status_code}): {response.text}")
    return response.json()["access_token"]


def _get_token() -> str:
    """Return a valid JWT, refreshing if expired (thread-safe, double-checked locking)."""
    global _cached_token, _token_expires_at

    now = time.monotonic()
    if _cached_token and now < _token_expires_at:
        return _cached_token

    with _token_lock:
        if _cached_token and now < _token_expires_at:
            return _cached_token
        _cached_token = _fetch_fresh_token()
        _token_expires_at = now + 55 * 60  # refresh 5 min before the 1-hour expiry
        return _cached_token


def _make_configuration() -> airflow_client.client.Configuration:
    config = airflow_client.client.Configuration(host=AIRFLOW_HOST)
    config.access_token = _get_token()
    return config


@contextmanager
def _api_client() -> Generator[airflow_client.client.ApiClient, None, None]:
    with airflow_client.client.ApiClient(_make_configuration()) as client:
        yield client


def _state_str(value) -> str | None:
    """Normalize a potentially-enum state value to a plain string."""
    if value is None:
        return None
    return value.value if hasattr(value, "value") else str(value)


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(title="Dagventure")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

if ASSETS_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")


@app.get("/game", response_class=HTMLResponse)
async def serve_game():
    html = (STATIC_DIR / "game.html").read_text()
    html = html.replace("__BUILD_TS__", _BUILD_TS)
    return HTMLResponse(content=html)


# ---------------------------------------------------------------------------
# Read endpoints
# ---------------------------------------------------------------------------

@app.get("/api/dags")
async def api_get_dags(limit: int = 100):
    def _call():
        with _api_client() as client:
            return DAGApi(client).get_dags(limit=limit)

    try:
        result = await asyncio.to_thread(_call)
    except ApiException as exc:
        raise HTTPException(status_code=int(exc.status or 502), detail=str(exc.reason))
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    dags = [
        {
            "dag_id":    dag.dag_id,
            "is_paused": dag.is_paused,
            "is_active": getattr(dag, "is_active", True),
            "description": dag.description or "",
            "tags": [{"name": tag.name if hasattr(tag, "name") else str(tag)} for tag in (dag.tags or [])],
        }
        for dag in (result.dags or [])
    ]
    return {"dags": dags, "total_entries": result.total_entries}


@app.get("/api/dags/{dag_id}/runs")
async def api_get_dag_runs(dag_id: str, limit: int = 1, order_by: str = "-start_date"):
    def _call():
        with _api_client() as client:
            return DagRunApi(client).get_dag_runs(dag_id=dag_id, limit=limit, order_by=[order_by])

    try:
        result = await asyncio.to_thread(_call)
    except ApiException as exc:
        log.warning("get_dag_runs failed for %s: %s", dag_id, exc.reason)
        return {"dag_runs": []}
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    runs = [
        {
            "dag_run_id": run.dag_run_id,
            "state":      _state_str(run.state),
            "start_date": run.start_date.isoformat() if run.start_date else None,
        }
        for run in (result.dag_runs or [])
    ]
    return {"dag_runs": runs}


@app.get("/api/dags/{dag_id}/runs/{run_id}/tasks")
async def api_get_task_instances(dag_id: str, run_id: str):
    def _call():
        with _api_client() as client:
            return TaskInstanceApi(client).get_task_instances(dag_id=dag_id, dag_run_id=run_id)

    try:
        result = await asyncio.to_thread(_call)
    except ApiException as exc:
        raise HTTPException(status_code=int(exc.status or 502), detail=str(exc.reason))
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    tasks = [
        {
            "task_id":    ti.task_id,
            "state":      _state_str(ti.state),
            "try_number": ti.try_number or 1,
            "map_index":  getattr(ti, "map_index", -1),
        }
        for ti in (result.task_instances or [])
    ]
    return {"task_instances": tasks}


@app.get(
    "/api/dags/{dag_id}/runs/{run_id}/tasks/{task_id}/logs/{try_number}",
    response_class=PlainTextResponse,
)
async def api_get_task_log(dag_id: str, run_id: str, task_id: str, try_number: int, map_index: int = -1):
    url = (
        f"{AIRFLOW_HOST}/api/v2/dags/{dag_id}"
        f"/dagRuns/{run_id}"
        f"/taskInstances/{task_id}"
        f"/logs/{try_number}"
        f"?map_index={map_index}"
    )

    def _call():
        resp = requests.get(
            url,
            headers={"Authorization": f"Bearer {_get_token()}", "Accept": "application/json"},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()

    try:
        data = await asyncio.to_thread(_call)
    except requests.HTTPError as exc:
        raise HTTPException(status_code=exc.response.status_code, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    # Airflow 3 returns {"content": [{"event": "...", "timestamp": "..."}, ...]}
    messages = data if isinstance(data, list) else data.get("content", data)
    if not isinstance(messages, list):
        return str(messages)

    lines = []
    for msg in messages:
        event = msg.get("event", "") if isinstance(msg, dict) else str(msg)
        if not event:
            continue
        ts = msg.get("timestamp") if isinstance(msg, dict) else None
        lines.append(f"[{ts}] {event}" if ts else event)

    return "\n".join(lines) if lines else "(no log output)"


# ---------------------------------------------------------------------------
# Mutation endpoints
# ---------------------------------------------------------------------------

@app.post("/api/dags/{dag_id}/trigger")
async def api_trigger_dag(dag_id: str):
    from airflow_client.client.models import TriggerDAGRunPostBody

    def _call():
        with _api_client() as client:
            run = DagRunApi(client).trigger_dag_run(dag_id, TriggerDAGRunPostBody())
            return run.dag_run_id

    try:
        run_id = await asyncio.to_thread(_call)
    except ApiException as exc:
        raise HTTPException(status_code=int(exc.status or 502), detail=str(exc.reason))
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return {"dag_run_id": run_id}


@app.patch("/api/dags/{dag_id}/pause")
async def api_patch_dag_paused(dag_id: str, is_paused: bool = True):
    from airflow_client.client.models import DAGPatchBody

    def _call():
        with _api_client() as client:
            return DAGApi(client).patch_dag(dag_id=dag_id, dag_patch_body=DAGPatchBody(is_paused=is_paused))

    try:
        await asyncio.to_thread(_call)
    except ApiException as exc:
        raise HTTPException(status_code=int(exc.status or 502), detail=str(exc.reason))
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return {"dag_id": dag_id, "is_paused": is_paused}


@app.delete("/api/dags/{dag_id}", status_code=204)
async def api_delete_dag(dag_id: str):
    def _call():
        with _api_client() as client:
            DAGApi(client).delete_dag(dag_id=dag_id)

    try:
        await asyncio.to_thread(_call)
    except ApiException as exc:
        raise HTTPException(status_code=int(exc.status or 502), detail=str(exc.reason))
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


# ---------------------------------------------------------------------------
# Plugin registration
# ---------------------------------------------------------------------------

class DagventurePlugin(AirflowPlugin):
    name = "dagventure"
    fastapi_apps = [{"app": app, "url_prefix": "/dagventure", "name": "Dagventure"}]
    external_views = [{
        "name":        "Dagventure",
        "href":        "dagventure/game",
        "destination": "nav",
        "url_route":   "dagventure",
        "icon":        "/dagventure/static/dagventure_icon.svg",
    }]
