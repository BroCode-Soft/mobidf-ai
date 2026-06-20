import hashlib
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor

from app.config import get_settings

router = APIRouter(prefix="/cidadao", tags=["Cidadão"])
settings = get_settings()


def _conn():
    return psycopg2.connect(settings.database_url_sync)


def _user_token(identifier: str) -> str:
    """Gera token anônimo — sem armazenar dados pessoais."""
    return hashlib.sha256(identifier.encode()).hexdigest()[:32]


# ---- Schemas ----

class ReservationCreate(BaseModel):
    user_identifier: str  # email ou device_id — hasheado no backend
    trip_id: str
    origin_stop_id: str
    dest_stop_id: str
    travel_date: date
    departure_time: str  # "HH:MM:SS"


class ReservationCancel(BaseModel):
    user_identifier: str


# ---- Paradas e linhas ----

@router.get("/stops/search")
async def search_stops(q: str = Query(..., min_length=2), limit: int = Query(10, le=50)):
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT stop_id, stop_name, stop_lat, stop_lon,
                   ST_X(geom::geometry) AS lon, ST_Y(geom::geometry) AS lat
            FROM stops
            WHERE stop_name ILIKE %s
            LIMIT %s
        """, (f"%{q}%", limit))
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


@router.get("/stops/nearby")
async def stops_nearby(
    lat: float = Query(...), lon: float = Query(...),
    radius_m: int = Query(500, le=2000)
):
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT
                stop_id, stop_name, stop_lat, stop_lon,
                ST_Distance(geom, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography) AS dist_m
            FROM stops
            WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)
            ORDER BY dist_m
            LIMIT 20
        """, (lon, lat, lon, lat, radius_m))
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


@router.get("/trips/next")
async def next_trips(origin_stop_id: str, dest_stop_id: str | None = None, limit: int = Query(5)):
    """Próximas viagens a partir de uma parada."""
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        now_interval = f"{datetime.now().hour * 3600 + datetime.now().minute * 60 + datetime.now().second} seconds"

        cur.execute("""
            SELECT
                t.trip_id,
                t.route_id,
                r.route_short_name AS linha,
                r.route_long_name AS destino,
                st.departure_time,
                EXTRACT(EPOCH FROM (st.departure_time - %s::interval)) / 60 AS minutos_para_chegada,
                COALESCE(
                    (SELECT COUNT(*) FROM flow_reservations fr
                     WHERE fr.trip_id = t.trip_id AND fr.travel_date = CURRENT_DATE
                       AND fr.status = 'confirmado'),
                    0
                ) AS reservas_ativas
            FROM stop_times st
            JOIN trips t ON t.trip_id = st.trip_id
            JOIN routes r ON r.route_id = t.route_id
            WHERE st.stop_id = %s
              AND st.departure_time > %s::interval
            ORDER BY st.departure_time
            LIMIT %s
        """, (now_interval, origin_stop_id, now_interval, limit))

        rows = [dict(r) for r in cur.fetchall()]

        # Adiciona nível de ocupação estimado
        for row in rows:
            reservas = row["reservas_ativas"]
            row["ocupacao_pct"] = min(100, int(reservas / 40 * 100))  # 40 = capacidade média
            row["nivel_ocupacao"] = (
                "vazio" if row["ocupacao_pct"] < 30
                else "moderado" if row["ocupacao_pct"] < 70
                else "lotado"
            )

        return rows
    finally:
        cur.close()
        conn.close()


@router.get("/occupancy/{trip_id}")
async def trip_occupancy(trip_id: str, travel_date: date = Query(default=None)):
    if travel_date is None:
        travel_date = date.today()

    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT
                COUNT(*) AS reservas_confirmadas,
                COUNT(*) * 100 / 40 AS ocupacao_pct
            FROM flow_reservations
            WHERE trip_id = %s AND travel_date = %s AND status = 'confirmado'
        """, (trip_id, travel_date))
        row = dict(cur.fetchone())

        # Enriquece com posição em tempo real se disponível
        cur.execute("""
            SELECT
                ST_X(geom::geometry) AS lon,
                ST_Y(geom::geometry) AS lat,
                speed_kmh,
                bearing,
                occupancy AS rt_occupancy
            FROM vehicle_positions_current
            WHERE trip_id = %s
            ORDER BY captured_at DESC
            LIMIT 1
        """, (trip_id,))
        rt = cur.fetchone()
        if rt:
            row["realtime"] = dict(rt)

        return row
    finally:
        cur.close()
        conn.close()


# ---- Reserva de Fluxo ----

@router.post("/reservations", status_code=201)
async def create_reservation(body: ReservationCreate):
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        token = _user_token(body.user_identifier)

        # Verifica se já tem reserva para o mesmo trip/data
        cur.execute("""
            SELECT id FROM flow_reservations
            WHERE user_token = %s AND trip_id = %s AND travel_date = %s AND status = 'confirmado'
        """, (token, body.trip_id, body.travel_date))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="Reserva já existe para este horário")

        # Verifica lotação
        cur.execute("""
            SELECT COUNT(*) AS n FROM flow_reservations
            WHERE trip_id = %s AND travel_date = %s AND status = 'confirmado'
        """, (body.trip_id, body.travel_date))
        count = cur.fetchone()["n"]
        if count >= 40:
            raise HTTPException(status_code=409, detail="Ônibus lotado — escolha outro horário")

        dep_interval = body.departure_time

        cur.execute("""
            INSERT INTO flow_reservations
                (user_token, trip_id, origin_stop_id, dest_stop_id, travel_date, departure_time)
            VALUES (%s, %s, %s, %s, %s, %s::interval)
            RETURNING id, status, created_at
        """, (token, body.trip_id, body.origin_stop_id, body.dest_stop_id,
              body.travel_date, dep_interval))
        row = dict(cur.fetchone())
        conn.commit()
        return {"reservation_id": str(row["id"]), "status": row["status"]}
    finally:
        cur.close()
        conn.close()


@router.get("/reservations")
async def list_reservations(user_identifier: str = Query(...)):
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        token = _user_token(user_identifier)
        cur.execute("""
            SELECT
                fr.id, fr.trip_id, fr.travel_date, fr.departure_time, fr.status,
                r.route_short_name AS linha, r.route_long_name AS destino,
                s_o.stop_name AS origem_nome, s_d.stop_name AS destino_nome
            FROM flow_reservations fr
            JOIN trips t ON t.trip_id = fr.trip_id
            JOIN routes r ON r.route_id = t.route_id
            JOIN stops s_o ON s_o.stop_id = fr.origin_stop_id
            JOIN stops s_d ON s_d.stop_id = fr.dest_stop_id
            WHERE fr.user_token = %s AND fr.travel_date >= CURRENT_DATE
            ORDER BY fr.travel_date, fr.departure_time
        """, (token,))
        return [dict(r) for r in cur.fetchall()]
    finally:
        cur.close()
        conn.close()


@router.delete("/reservations/{reservation_id}")
async def cancel_reservation(reservation_id: str, body: ReservationCancel):
    conn = _conn()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        token = _user_token(body.user_identifier)
        cur.execute("""
            UPDATE flow_reservations
            SET status = 'cancelado'
            WHERE id = %s AND user_token = %s AND status = 'confirmado'
            RETURNING id
        """, (reservation_id, token))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Reserva não encontrada")
        conn.commit()
        return {"status": "cancelado"}
    finally:
        cur.close()
        conn.close()


# ---- Cenário Maria (demo hackathon) ----

@router.get("/demo/maria")
async def demo_maria():
    """Simula o cenário de Maria: Ceilândia → SIA com Terminal Virtual e Rota Diametral."""
    return {
        "persona": "Maria",
        "origem": "Ceilândia Norte",
        "destino": "SIA (Setor de Indústrias e Abastecimento)",
        "cenario_atual": {
            "tempo_total_min": 120,
            "baldeacoes": 2,
            "descricao": "Ceilândia → Rodoviária do PP → SIA. Espera média 18min na Rodoviária."
        },
        "cenario_mobidf": {
            "rota_diametral": {
                "descricao": "Linha Diametral Ceilândia–SIA (sugerida pelo Roteamento Diametral)",
                "tempo_total_min": 85,
                "baldeacoes": 0,
                "tempo_salvo_min": 35
            },
            "terminal_virtual": {
                "descricao": "Se linha diametral indisponível: alimentadora sincronizada com troncal",
                "parada_baldeacao": "Terminal Taguatinga",
                "espera_max_min": 3,
                "tempo_total_min": 95,
                "tempo_salvo_min": 25
            },
            "reserva_de_fluxo": {
                "assento_garantido": True,
                "categoria": "Expressa",
                "antecedencia_checkin": "30 minutos antes"
            }
        },
        "impacto_diario": {
            "tempo_recuperado_min": 35,
            "tempo_recuperado_horas_mes": round(35 * 22 / 60, 1),
            "ods_impactados": ["ODS 10", "ODS 11", "ODS 13"]
        }
    }
