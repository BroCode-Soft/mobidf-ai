from fastapi import APIRouter, Query, HTTPException
from datetime import date

from app.services.overlap_detection import (
    get_overlaps, get_overlap_summary, resolve_overlap
)
from app.services.terminal_virtual import get_virtual_terminals, get_terminal_kpi
from app.services.fleet_score import get_fleet_scores, get_fleet_score_summary
from app.services.diametral_routing import get_diametral_suggestions, get_od_heatmap
from app.services.reinvestment import calc_reinvestment, get_reinvestment_history, get_reinvestment_current
from app.etl.gtfs_ingestion import run_gtfs_static_etl

router = APIRouter(prefix="/gestor", tags=["Gestor B2G"])


# ---- ETL ----

@router.post("/etl/gtfs")
async def trigger_gtfs_etl():
    """Dispara ETL GTFS manualmente."""
    try:
        stats = run_gtfs_static_etl()
        return {"status": "ok", "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---- Sobreposição ----

@router.get("/overlaps")
async def list_overlaps(status: str = Query("ativo", enum=["ativo", "resolvido", "arquivado"])):
    return await get_overlaps(status)


@router.get("/overlaps/summary")
async def overlap_summary():
    return await get_overlap_summary()


@router.patch("/overlaps/{overlap_id}/resolve")
async def resolve(overlap_id: str):
    result = await resolve_overlap(overlap_id)
    if not result:
        raise HTTPException(status_code=404, detail="Sobreposição não encontrada")
    return result


# ---- Terminal Virtual ----

@router.get("/terminal-virtual")
async def list_terminals(stop_id: str | None = Query(None)):
    return await get_virtual_terminals(stop_id)


@router.get("/terminal-virtual/kpi")
async def terminal_kpi():
    return await get_terminal_kpi()


# ---- Score de Frota ----

@router.get("/fleet-scores")
async def fleet_scores(limit: int = Query(50, ge=1, le=200)):
    return await get_fleet_scores(limit)


@router.get("/fleet-scores/summary")
async def fleet_summary():
    return await get_fleet_score_summary()


# ---- Roteamento Diametral ----

@router.get("/diametral/suggestions")
async def diametral_suggestions():
    return await get_diametral_suggestions()


@router.get("/diametral/od-heatmap")
async def od_heatmap():
    return await get_od_heatmap()


# ---- Reinvestimento ----

@router.post("/reinvestment/calc")
async def trigger_reinvestment(
    period_start: date | None = Query(None),
    period_end: date | None = Query(None)
):
    return await calc_reinvestment(period_start, period_end)


@router.get("/reinvestment/history")
async def reinvestment_history(months: int = Query(6, ge=1, le=24)):
    return await get_reinvestment_history(months)


@router.get("/reinvestment/current")
async def reinvestment_current():
    return await get_reinvestment_current()


# ---- Dashboard summary (all KPIs num request) ----

@router.get("/dashboard")
async def dashboard_summary():
    overlap = await get_overlap_summary()
    fleet = await get_fleet_score_summary()
    terminal = await get_terminal_kpi()
    reinvestment = await get_reinvestment_current()
    diametral = await get_diametral_suggestions()

    return {
        "overlap": overlap,
        "fleet": fleet,
        "terminal_virtual": terminal,
        "reinvestment": reinvestment,
        "diametral_count": len(diametral),
        "top_diametral": diametral[:3],
    }
