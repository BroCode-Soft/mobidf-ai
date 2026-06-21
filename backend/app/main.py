import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import gestor, cidadao
from app.etl.scheduler import start_scheduler, stop_scheduler

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("MobiDF AI backend iniciando...")
    start_scheduler()
    yield
    stop_scheduler()
    logger.info("MobiDF AI backend encerrado")


app = FastAPI(
    title="MobiDF AI",
    description="SaaS de mobilidade urbana inteligente para o Distrito Federal",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(gestor.router, prefix="/api/v1")
app.include_router(cidadao.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "MobiDF AI"}


@app.get("/api/v1/etl/status")
async def etl_status():
    import psycopg2
    from psycopg2.extras import RealDictCursor
    conn = psycopg2.connect(settings.database_url_sync)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT source, status, records_out, started_at, finished_at
            FROM etl_runs
            ORDER BY started_at DESC
            LIMIT 10
        """)
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()
