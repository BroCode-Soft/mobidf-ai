"""
ETL: Regiões Administrativas do DF + dados populacionais do IBGE.

Usa a API de malha geográfica do IBGE para puxar os polígonos das RAs
e o censo para densidade populacional.
"""

import logging
import psycopg2
from psycopg2.extras import execute_values
import httpx
import json

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Código IBGE do Distrito Federal: 53
IBGE_COD_DF = "53"

# RAs do DF com populações estimadas (censo 2022)
RA_POPULACOES = {
    "Plano Piloto": 224042,
    "Gama": 135723,
    "Taguatinga": 222598,
    "Brazlândia": 57542,
    "Sobradinho": 81269,
    "Planaltina": 185375,
    "Paranoá": 54539,
    "Núcleo Bandeirante": 26017,
    "Ceilândia": 489351,
    "Guará": 133803,
    "Cruzeiro": 32853,
    "Samambaia": 254439,
    "Santa Maria": 131205,
    "São Sebastião": 117176,
    "Recanto das Emas": 154908,
    "Lago Sul": 30776,
    "Riacho Fundo": 45936,
    "Lago Norte": 33674,
    "Candangolândia": 16989,
    "Águas Claras": 159178,
    "Riacho Fundo II": 44498,
    "Sudoeste/Octogonal": 58165,
    "Varjão": 9371,
    "Park Way": 24200,
    "SCIA/Estrutural": 48593,
    "Sobradinho II": 100874,
    "Jardim Botânico": 27979,
    "Itapoã": 71296,
    "SIA": 2000,
    "Vicente Pires": 73081,
    "Fercal": 11770,
}


async def fetch_ibge_ra_geoms() -> list[dict]:
    """Baixa malha municipal do DF e retorna lista com código, nome e geom GeoJSON."""
    url = f"{settings.ibge_api_url}/malhas/estados/{IBGE_COD_DF}?formato=application/vnd.geo+json&resolucao=5"
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            r = await client.get(url)
            r.raise_for_status()
            geojson = r.json()
            return geojson.get("features", [])
        except Exception as e:
            logger.warning(f"Falha ao baixar malha IBGE: {e}")
            return []


async def run_ibge_etl() -> dict[str, int]:
    """Insere RAs do DF com geometria e população no PostGIS."""
    conn = psycopg2.connect(settings.database_url_sync)
    cur = conn.cursor()

    try:
        cur.execute("INSERT INTO etl_runs (source, status) VALUES (%s, %s) RETURNING id",
                    ("ibge_ra", "running"))
        run_id = cur.fetchone()[0]
        conn.commit()

        # Tenta baixar geometrias do IBGE
        features = await fetch_ibge_ra_geoms()

        if features:
            rows = []
            for feat in features:
                props = feat.get("properties", {})
                nome = props.get("nome", "")
                codigo = props.get("codarea", props.get("cd_mun", ""))
                geom_json = json.dumps(feat.get("geometry", {}))
                pop = RA_POPULACOES.get(nome, 0)

                rows.append((codigo, nome, pop, geom_json))

            execute_values(cur,
                "INSERT INTO regioes_administrativas (ra_codigo, ra_nome, populacao, geom) "
                "VALUES (%s, %s, %s, ST_SetSRID(ST_GeomFromGeoJSON(%s), 4326)) "
                "ON CONFLICT (ra_codigo) DO UPDATE SET "
                "ra_nome = EXCLUDED.ra_nome, populacao = EXCLUDED.populacao, geom = EXCLUDED.geom",
                rows)
        else:
            # Fallback: insere apenas dados tabulares sem geometria
            logger.warning("Sem geometria IBGE — inserindo RAs sem polígono")
            rows = [(f"RA{i:03d}", nome, pop, None)
                    for i, (nome, pop) in enumerate(RA_POPULACOES.items(), start=1)]
            execute_values(cur,
                "INSERT INTO regioes_administrativas (ra_codigo, ra_nome, populacao) "
                "VALUES %s ON CONFLICT (ra_codigo) DO UPDATE SET populacao = EXCLUDED.populacao",
                rows)

        conn.commit()
        count = len(rows)
        cur.execute("UPDATE etl_runs SET status='success', records_out=%s, finished_at=NOW() WHERE id=%s",
                    (count, run_id))
        conn.commit()
        logger.info(f"IBGE ETL: {count} RAs inseridas")
        return {"regioes_administrativas": count}

    except Exception as e:
        conn.rollback()
        cur.execute("UPDATE etl_runs SET status='failed', error_msg=%s, finished_at=NOW() WHERE id=%s",
                    (str(e), run_id))
        conn.commit()
        logger.error(f"Erro no IBGE ETL: {e}", exc_info=True)
        raise
    finally:
        cur.close()
        conn.close()
