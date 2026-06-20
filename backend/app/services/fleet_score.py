"""
Índice de Eficiência de Frota.
Score 0–100 = (Lotação + Sustentabilidade) - Ociosidade
"""

import logging
from datetime import date

import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def _conn():
    return psycopg2.connect(settings.database_url_sync)


async def refresh_all_fleet_scores(calc_date: date | None = None) -> int:
    if calc_date is None:
        calc_date = date.today()

    conn = _conn()
    cur = conn.cursor()
    try:
        cur.execute("SELECT route_id FROM routes")
        routes = [r[0] for r in cur.fetchall()]

        for route_id in routes:
            cur.execute("SELECT calc_fleet_score(%s, %s)", (route_id, calc_date))

        conn.commit()
        logger.info(f"Fleet scores calculados: {len(routes)} rotas")
        return len(routes)
    finally:
        cur.close()
        conn.close()


async def get_fleet_scores(limit: int = 50) -> list[dict]:
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT
                fs.route_id,
                r.route_short_name AS nome,
                r.route_long_name AS descricao,
                fs.calc_date,
                fs.lotacao_score,
                fs.sustentabilidade_score,
                fs.ociosidade_penalty,
                (fs.lotacao_score + fs.sustentabilidade_score - fs.ociosidade_penalty) AS total_score,
                fs.reservations_count,
                fs.overlap_count
            FROM fleet_scores fs
            JOIN routes r ON r.route_id = fs.route_id
            WHERE fs.calc_date = CURRENT_DATE
            ORDER BY (fs.lotacao_score + fs.sustentabilidade_score - fs.ociosidade_penalty) DESC
            LIMIT %s
        """, (limit,))
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


async def get_fleet_score_summary() -> dict:
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT
                COUNT(*) AS total_rotas,
                AVG(lotacao_score + sustentabilidade_score - ociosidade_penalty) AS score_medio,
                COUNT(*) FILTER (WHERE (lotacao_score + sustentabilidade_score - ociosidade_penalty) >= 70) AS rotas_eficientes,
                COUNT(*) FILTER (WHERE (lotacao_score + sustentabilidade_score - ociosidade_penalty) < 40) AS rotas_criticas
            FROM fleet_scores
            WHERE calc_date = CURRENT_DATE
        """)
        return dict(cur.fetchone() or {})
    finally:
        cur.close()
        conn.close()
