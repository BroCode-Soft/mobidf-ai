"""
APScheduler: CRON Jobs para ETL periódico.

- GTFS estático: toda madrugada (00:30)
- GTFS-RT posições: a cada 30 segundos
- IBGE: uma vez por semana (domingo 01:00)
- Análises de negócio: toda madrugada (02:00)
"""

import logging
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.etl.gtfs_ingestion import run_gtfs_static_etl, fetch_gtfs_rt_positions, store_vehicle_positions
from app.etl.ibge_ingestion import run_ibge_etl

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="America/Sao_Paulo")


async def job_gtfs_static():
    logger.info("CRON: iniciando ETL GTFS estático")
    try:
        stats = run_gtfs_static_etl()
        logger.info(f"CRON: GTFS ETL OK — {stats}")
    except Exception as e:
        logger.error(f"CRON: GTFS ETL falhou — {e}")


async def job_gtfs_rt():
    try:
        positions = await fetch_gtfs_rt_positions()
        count = store_vehicle_positions(positions)
        logger.debug(f"GTFS-RT: {count} posições atualizadas")
    except Exception as e:
        logger.warning(f"GTFS-RT falhou: {e}")


async def job_ibge():
    logger.info("CRON: ETL IBGE")
    try:
        stats = await run_ibge_etl()
        logger.info(f"CRON: IBGE OK — {stats}")
    except Exception as e:
        logger.error(f"CRON: IBGE falhou — {e}")


async def job_business_analysis():
    """Recalcula sobreposições, scores de frota e matriz O/D."""
    from app.services.overlap_detection import refresh_overlaps
    from app.services.fleet_score import refresh_all_fleet_scores
    from app.services.diametral_routing import refresh_od_matrix

    logger.info("CRON: análises de negócio")
    try:
        await refresh_overlaps()
        await refresh_all_fleet_scores()
        await refresh_od_matrix()
        logger.info("CRON: análises de negócio OK")
    except Exception as e:
        logger.error(f"CRON: análises de negócio falharam — {e}")


def start_scheduler():
    # GTFS estático: toda madrugada
    scheduler.add_job(job_gtfs_static, CronTrigger(hour=0, minute=30), id="gtfs_static", replace_existing=True)

    # GTFS-RT: a cada 30s
    scheduler.add_job(job_gtfs_rt, IntervalTrigger(seconds=30), id="gtfs_rt", replace_existing=True)

    # IBGE: domingo às 01h
    scheduler.add_job(job_ibge, CronTrigger(day_of_week="sun", hour=1), id="ibge", replace_existing=True)

    # Análises: toda madrugada às 02h
    scheduler.add_job(job_business_analysis, CronTrigger(hour=2), id="business_analysis", replace_existing=True)

    scheduler.start()
    logger.info("Scheduler iniciado")


def stop_scheduler():
    scheduler.shutdown(wait=False)
