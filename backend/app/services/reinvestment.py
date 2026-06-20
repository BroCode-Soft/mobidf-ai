"""
Reinvestimento Automático.

Calcula economia gerada pelos cortes de sobreposição e aloca:
  60% → Wi-Fi nos ônibus
  30% → Ar-condicionado
  10% → Reserva operacional
"""

import logging
from datetime import date, timedelta

import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

CUSTO_LINHA_MES = 8_500.0


def _conn():
    return psycopg2.connect(settings.database_url_sync)


async def calc_reinvestment(period_start: date | None = None, period_end: date | None = None) -> dict:
    if period_end is None:
        period_end = date.today()
    if period_start is None:
        period_start = period_end.replace(day=1)

    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            "SELECT calc_reinvestment(%s, %s, %s) AS ledger_id",
            (period_start, period_end, CUSTO_LINHA_MES)
        )
        ledger_id = cur.fetchone()["ledger_id"]
        conn.commit()

        cur.execute("SELECT * FROM reinvestment_ledger WHERE id = %s", (ledger_id,))
        return dict(cur.fetchone() or {})
    finally:
        cur.close()
        conn.close()


async def get_reinvestment_history(months: int = 6) -> list[dict]:
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT
                TO_CHAR(period_start, 'Mon/YY') AS periodo,
                economia_bruta,
                alocacao_wifi,
                alocacao_ac,
                alocacao_reserva,
                overlap_routes_corrigidas
            FROM reinvestment_ledger
            ORDER BY period_start DESC
            LIMIT %s
        """, (months,))
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


async def get_reinvestment_current() -> dict:
    """Resumo do mês corrente + acumulado anual."""
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        today = date.today()
        month_start = today.replace(day=1)
        year_start = today.replace(month=1, day=1)

        cur.execute("""
            SELECT
                COALESCE(SUM(economia_bruta) FILTER (WHERE period_start >= %s), 0) AS economia_mes,
                COALESCE(SUM(alocacao_wifi) FILTER (WHERE period_start >= %s), 0) AS wifi_mes,
                COALESCE(SUM(alocacao_ac) FILTER (WHERE period_start >= %s), 0) AS ac_mes,
                COALESCE(SUM(economia_bruta) FILTER (WHERE period_start >= %s), 0) AS economia_ano,
                COALESCE(SUM(overlap_routes_corrigidas) FILTER (WHERE period_start >= %s), 0) AS rotas_cortadas_ano
            FROM reinvestment_ledger
        """, (month_start, month_start, month_start, year_start, year_start))
        return dict(cur.fetchone() or {})
    finally:
        cur.close()
        conn.close()
