"""
Mock backend MobiDF AI — sem banco de dados.
Retorna dados demo realistas para rodar o frontend sem Docker/PostgreSQL.
"""
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import hashlib, uuid, random, unicodedata, math as _math
from datetime import date, datetime

app = FastAPI(title="MobiDF AI (Mock)", version="1.0.0-demo")

def _normalize(text: str) -> str:
    """Remove acentos e normaliza para minúsculas — 'Ceilândia' → 'ceilandia'."""
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── dados em memória ──────────────────────────────────────────
_reservations: dict[str, dict] = {}
_resolved_overlaps: set[str] = set()
_gestora_events: dict[str, dict] = {}

OVERLAPS = [
    {"id": "ov-001", "route_id_a": "0.110", "route_id_b": "0.109", "nome_a": "110 - Ceilândia/Rodoviária", "nome_b": "109 - Ceilândia/Asa Norte", "desc_a": "Ceilândia Norte → Plano Piloto", "desc_b": "Ceilândia Sul → Asa Norte", "overlap_pct": 78.4, "overlap_km": 14.2, "horarios_conflito": [{"dep_a": "06:30:00", "dep_b": "06:32:00", "delta_min": 2.0}], "economia_estimada_mensal": 3400.0, "status": "ativo"},
    {"id": "ov-002", "route_id_a": "0.210", "route_id_b": "0.215", "nome_a": "210 - Samambaia/Rodoviária", "nome_b": "215 - Samambaia/Asa Sul", "desc_a": "Samambaia → PP", "desc_b": "Samambaia Sul → PP", "overlap_pct": 61.2, "overlap_km": 9.7, "horarios_conflito": [{"dep_a": "07:00:00", "dep_b": "07:05:00", "delta_min": 5.0}], "economia_estimada_mensal": 2720.0, "status": "ativo"},
    {"id": "ov-003", "route_id_a": "0.401", "route_id_b": "0.402", "nome_a": "401 - Taguatinga/Centro", "nome_b": "402 - Taguatinga/Asa Norte", "desc_a": "Taguatinga → Plano Piloto", "desc_b": "Taguatinga Norte → PP", "overlap_pct": 55.0, "overlap_km": 8.1, "horarios_conflito": [], "economia_estimada_mensal": 1870.0, "status": "ativo"},
    {"id": "ov-004", "route_id_a": "0.301", "route_id_b": "0.305", "nome_a": "301 - Guará/Rodoviária", "nome_b": "305 - Guará/Asa Sul", "desc_a": "Guará → PP", "desc_b": "Guará II → PP", "overlap_pct": 42.3, "overlap_km": 5.9, "horarios_conflito": [], "economia_estimada_mensal": 1250.0, "status": "resolvido"},
]

VIRTUAL_TERMINALS = [
    {"id": "vt-001", "stop_id": "TERM_CEI", "stop_name": "Terminal Ceilândia", "feeder_nome": "902 - Setor P Norte", "trunk_nome": "110 - Ceilândia/Rodoviária", "feeder_arrival": "06:28:00", "trunk_departure": "06:30:00", "wait_min": 2.0, "sync_score": 93.3, "is_synchronized": True},
    {"id": "vt-002", "stop_id": "TERM_TAG", "stop_name": "Terminal Taguatinga", "feeder_nome": "550 - Vicente Pires", "trunk_nome": "401 - Taguatinga/Centro", "feeder_arrival": "07:12:00", "trunk_departure": "07:14:00", "wait_min": 2.0, "sync_score": 93.3, "is_synchronized": True},
    {"id": "vt-003", "stop_id": "TERM_SAM", "stop_name": "Terminal Samambaia", "feeder_nome": "863 - Recanto das Emas", "trunk_nome": "210 - Samambaia/Rodoviária", "feeder_arrival": "06:55:00", "trunk_departure": "06:57:00", "wait_min": 2.0, "sync_score": 93.3, "is_synchronized": True},
    {"id": "vt-004", "stop_id": "TERM_GUA", "stop_name": "Terminal Guará", "feeder_nome": "193 - Park Way", "trunk_nome": "301 - Guará/Rodoviária", "feeder_arrival": "07:45:00", "trunk_departure": "07:47:30", "wait_min": 2.5, "sync_score": 75.0, "is_synchronized": True},
    {"id": "vt-005", "stop_id": "RODO", "stop_name": "Rodoviária do Plano Piloto", "feeder_nome": "110 - Ceilândia/Rodoviária", "trunk_nome": "047 - L2 Sul/Norte", "feeder_arrival": "07:15:00", "trunk_departure": "07:18:00", "wait_min": 3.0, "sync_score": 70.0, "is_synchronized": True},
    {"id": "vt-006", "stop_id": "TERM_SOB", "stop_name": "Terminal Sobradinho", "feeder_nome": "705 - Itapoã", "trunk_nome": "620 - Sobradinho/Rodoviária", "feeder_arrival": "06:40:00", "trunk_departure": "06:44:00", "wait_min": 4.0, "sync_score": 46.7, "is_synchronized": False},
]

FLEET_SCORES = [
    {"route_id": "0.110", "nome": "110", "descricao": "Ceilândia Norte → Rodoviária", "total_score": 82.0, "lotacao_score": 38.0, "sustentabilidade_score": 24.0, "ociosidade_penalty": 0.0, "reservations_count": 76},
    {"route_id": "0.210", "nome": "210", "descricao": "Samambaia → Rodoviária", "total_score": 75.0, "lotacao_score": 35.0, "sustentabilidade_score": 25.0, "ociosidade_penalty": 0.0, "reservations_count": 58},
    {"route_id": "0.401", "nome": "401", "descricao": "Taguatinga → Plano Piloto", "total_score": 68.0, "lotacao_score": 28.0, "sustentabilidade_score": 25.0, "ociosidade_penalty": 0.0, "reservations_count": 44},
    {"route_id": "0.301", "nome": "301", "descricao": "Guará → Rodoviária", "total_score": 55.0, "lotacao_score": 22.0, "sustentabilidade_score": 30.0, "ociosidade_penalty": 7.0, "reservations_count": 31},
    {"route_id": "0.109", "nome": "109", "descricao": "Ceilândia Sul → Asa Norte", "total_score": 41.0, "lotacao_score": 14.0, "sustentabilidade_score": 12.0, "ociosidade_penalty": 15.0, "reservations_count": 12},
    {"route_id": "0.215", "nome": "215", "descricao": "Samambaia Sul → PP", "total_score": 32.0, "lotacao_score": 10.0, "sustentabilidade_score": 12.0, "ociosidade_penalty": 20.0, "reservations_count": 8},
    {"route_id": "0.863", "nome": "863", "descricao": "Recanto das Emas → PP", "total_score": 28.0, "lotacao_score": 8.0, "sustentabilidade_score": 10.0, "ociosidade_penalty": 30.0, "reservations_count": 4},
]

REGIOES_ADMINISTRATIVAS = [
    {"ra_id": "RA-I",    "nome": "Plano Piloto",        "populacao": 220393},
    {"ra_id": "RA-II",   "nome": "Gama",                "populacao": 135723},
    {"ra_id": "RA-III",  "nome": "Taguatinga",          "populacao": 222598},
    {"ra_id": "RA-IV",   "nome": "Brazlândia",          "populacao": 57542},
    {"ra_id": "RA-V",    "nome": "Sobradinho",          "populacao": 63715},
    {"ra_id": "RA-VI",   "nome": "Planaltina",          "populacao": 189615},
    {"ra_id": "RA-VII",  "nome": "Paranoá",             "populacao": 54539},
    {"ra_id": "RA-VIII", "nome": "Núcleo Bandeirante",  "populacao": 24676},
    {"ra_id": "RA-IX",   "nome": "Ceilândia",           "populacao": 479713},
    {"ra_id": "RA-X",    "nome": "Guará",               "populacao": 119923},
    {"ra_id": "RA-XI",   "nome": "Cruzeiro",            "populacao": 33507},
    {"ra_id": "RA-XII",  "nome": "Samambaia",           "populacao": 254439},
    {"ra_id": "RA-XIII", "nome": "Santa Maria",         "populacao": 125123},
    {"ra_id": "RA-XIV",  "nome": "São Sebastião",       "populacao": 105269},
    {"ra_id": "RA-XV",   "nome": "Recanto das Emas",    "populacao": 138833},
    {"ra_id": "RA-XVI",  "nome": "Lago Sul",            "populacao": 29537},
    {"ra_id": "RA-XVII", "nome": "Riacho Fundo",        "populacao": 40232},
    {"ra_id": "RA-XVIII","nome": "Lago Norte",          "populacao": 41386},
    {"ra_id": "RA-XIX",  "nome": "Candangolândia",      "populacao": 15924},
    {"ra_id": "RA-XX",   "nome": "Águas Claras",        "populacao": 137616},
    {"ra_id": "RA-XXI",  "nome": "Riacho Fundo II",     "populacao": 43656},
    {"ra_id": "RA-XXII", "nome": "Sudoeste/Octogonal",  "populacao": 56396},
    {"ra_id": "RA-XXIII","nome": "Varjão",              "populacao": 9792},
    {"ra_id": "RA-XXIV", "nome": "Park Way",            "populacao": 21180},
    {"ra_id": "RA-XXV",  "nome": "SCIA/Estrutural",     "populacao": 39015},
    {"ra_id": "RA-XXVI", "nome": "Sobradinho II",       "populacao": 100683},
    {"ra_id": "RA-XXVII","nome": "Jardim Botânico",     "populacao": 26040},
    {"ra_id": "RA-XXVIII","nome": "Itapoã",             "populacao": 70833},
    {"ra_id": "RA-XXIX", "nome": "SIA",                 "populacao": 2561},
    {"ra_id": "RA-XXX",  "nome": "Vicente Pires",       "populacao": 72432},
    {"ra_id": "RA-XXXI", "nome": "Fercal",              "populacao": 11189},
    {"ra_id": "RA-XXXII","nome": "Sol Nascente/Pôr do Sol","populacao": 105005},
    {"ra_id": "RA-XXXIII","nome": "Arniqueira",         "populacao": 50000},
]

DIAMETRAL = [
    {"id": "dm-001", "origem": "Ceilândia", "destino": "SIA", "trips_daily": 2800, "peak_hour": 7, "has_direct_route": False, "time_saved_min": 35.0, "horas_salvas_dia": 1633.3, "diametral_suggested": True},
    {"id": "dm-002", "origem": "Samambaia", "destino": "SIA", "trips_daily": 1900, "peak_hour": 7, "has_direct_route": False, "time_saved_min": 30.0, "horas_salvas_dia": 950.0, "diametral_suggested": True},
    {"id": "dm-003", "origem": "Recanto das Emas", "destino": "Asa Norte", "trips_daily": 1200, "peak_hour": 7, "has_direct_route": False, "time_saved_min": 28.0, "horas_salvas_dia": 560.0, "diametral_suggested": True},
    {"id": "dm-004", "origem": "Taguatinga", "destino": "SIA", "trips_daily": 1100, "peak_hour": 8, "has_direct_route": False, "time_saved_min": 20.0, "horas_salvas_dia": 366.7, "diametral_suggested": True},
    {"id": "dm-005", "origem": "Planaltina", "destino": "Taguatinga", "trips_daily": 800, "peak_hour": 7, "has_direct_route": False, "time_saved_min": 45.0, "horas_salvas_dia": 600.0, "diametral_suggested": True},
    {"id": "dm-006", "origem": "Santa Maria", "destino": "SIA", "trips_daily": 750, "peak_hour": 7, "has_direct_route": False, "time_saved_min": 25.0, "horas_salvas_dia": 312.5, "diametral_suggested": True},
    {"id": "dm-007", "origem": "São Sebastião", "destino": "Taguatinga", "trips_daily": 620, "peak_hour": 7, "has_direct_route": False, "time_saved_min": 50.0, "horas_salvas_dia": 516.7, "diametral_suggested": True},
    {"id": "dm-008", "origem": "Sobradinho", "destino": "Guará", "trips_daily": 480, "peak_hour": 8, "has_direct_route": False, "time_saved_min": 40.0, "horas_salvas_dia": 320.0, "diametral_suggested": True},
]

REINV_HISTORY = [
    {"periodo": "Jan/26", "economia_bruta": 9350, "alocacao_wifi": 5610, "alocacao_ac": 2805, "alocacao_reserva": 935, "overlap_routes_corrigidas": 1},
    {"periodo": "Fev/26", "economia_bruta": 12070, "alocacao_wifi": 7242, "alocacao_ac": 3621, "alocacao_reserva": 1207, "overlap_routes_corrigidas": 1},
    {"periodo": "Mar/26", "economia_bruta": 17680, "alocacao_wifi": 10608, "alocacao_ac": 5304, "alocacao_reserva": 1768, "overlap_routes_corrigidas": 2},
    {"periodo": "Abr/26", "economia_bruta": 8500, "alocacao_wifi": 5100, "alocacao_ac": 2550, "alocacao_reserva": 850, "overlap_routes_corrigidas": 1},
    {"periodo": "Mai/26", "economia_bruta": 21250, "alocacao_wifi": 12750, "alocacao_ac": 6375, "alocacao_reserva": 2125, "overlap_routes_corrigidas": 2},
    {"periodo": "Jun/26", "economia_bruta": 8500, "alocacao_wifi": 5100, "alocacao_ac": 2550, "alocacao_reserva": 850, "overlap_routes_corrigidas": 1},
]

# ── Todas as paradas do DF (45+ terminais e pontos principais) ────────────────
STOPS = [
    # Plano Piloto
    {"stop_id": "RODO",      "stop_name": "Rodoviária do Plano Piloto",            "stop_lat": -15.7942, "stop_lon": -47.8825},
    {"stop_id": "ASA-N-W3",  "stop_name": "Asa Norte - W3 Norte / 508",            "stop_lat": -15.7543, "stop_lon": -47.8924},
    {"stop_id": "ASA-S-W3",  "stop_name": "Asa Sul - W3 Sul / 508",                "stop_lat": -15.8224, "stop_lon": -47.9012},
    {"stop_id": "ASA-N-L2",  "stop_name": "Asa Norte - L2 Norte / SHN",            "stop_lat": -15.7608, "stop_lon": -47.8720},
    {"stop_id": "SUDOESTE",  "stop_name": "Sudoeste - CLSW 304",                   "stop_lat": -15.8001, "stop_lon": -47.9280},
    {"stop_id": "CRUZEIRO",  "stop_name": "Cruzeiro - SHCS EQ / Setor H Norte",    "stop_lat": -15.7889, "stop_lon": -47.9289},
    # Ceilândia (RA-IX)
    {"stop_id": "CEI-N",     "stop_name": "Terminal Ceilândia Norte",              "stop_lat": -15.8106, "stop_lon": -48.1134},
    {"stop_id": "CEI-S",     "stop_name": "Terminal Ceilândia Sul",                "stop_lat": -15.8271, "stop_lon": -48.1075},
    {"stop_id": "CEI-SETP",  "stop_name": "Ceilândia - QNN 13 / Setor P Sul",      "stop_lat": -15.8200, "stop_lon": -48.1000},
    {"stop_id": "SOL-NASC",  "stop_name": "Sol Nascente - Condomínio / Entrada",   "stop_lat": -15.8700, "stop_lon": -48.1340},
    # Taguatinga (RA-III)
    {"stop_id": "TAG-N",     "stop_name": "Terminal Taguatinga Norte",             "stop_lat": -15.8294, "stop_lon": -48.0465},
    {"stop_id": "TAG-S",     "stop_name": "Terminal Taguatinga Sul",               "stop_lat": -15.8450, "stop_lon": -48.0560},
    {"stop_id": "TAG-PRACA", "stop_name": "Taguatinga - Praça do Relógio",         "stop_lat": -15.8302, "stop_lon": -48.0432},
    # Samambaia (RA-XII)
    {"stop_id": "SAM-N",     "stop_name": "Terminal Samambaia Norte",              "stop_lat": -15.8762, "stop_lon": -48.0862},
    {"stop_id": "SAM-S",     "stop_name": "Terminal Samambaia Sul",                "stop_lat": -15.8900, "stop_lon": -48.0820},
    # Guará (RA-X)
    {"stop_id": "GUA",       "stop_name": "Terminal Guará",                        "stop_lat": -15.8193, "stop_lon": -47.9889},
    {"stop_id": "GUA-II",    "stop_name": "Guará II - QE 40",                      "stop_lat": -15.8350, "stop_lon": -47.9950},
    # SIA (RA-XXIX)
    {"stop_id": "SIA",       "stop_name": "SIA - Setor de Indústrias / Via W5 Sul","stop_lat": -15.8404, "stop_lon": -47.9634},
    # Núcleo Bandeirante (RA-VIII)
    {"stop_id": "NUC-BAND",  "stop_name": "Terminal Núcleo Bandeirante",           "stop_lat": -15.8676, "stop_lon": -47.9707},
    # Candangolândia (RA-XIX)
    {"stop_id": "CAND",      "stop_name": "Candangolândia - Administração Regional","stop_lat": -15.8709, "stop_lon": -47.9524},
    # Riacho Fundo (RA-XVII / XXI)
    {"stop_id": "RIA-F",     "stop_name": "Terminal Riacho Fundo",                 "stop_lat": -15.8783, "stop_lon": -48.0113},
    {"stop_id": "RIA-F-II",  "stop_name": "Riacho Fundo II - QC 01",              "stop_lat": -15.8960, "stop_lon": -48.0230},
    # Recanto das Emas (RA-XV)
    {"stop_id": "RECAN",     "stop_name": "Terminal Recanto das Emas",             "stop_lat": -15.9071, "stop_lon": -48.0643},
    # Vicente Pires (RA-XXX)
    {"stop_id": "VIC-P",     "stop_name": "Vicente Pires - Administração Regional","stop_lat": -15.8105, "stop_lon": -48.0430},
    # Águas Claras (RA-XX)
    {"stop_id": "AG-CL",     "stop_name": "Águas Claras - Estação / Av. das Castanheiras","stop_lat": -15.8383, "stop_lon": -48.0219},
    # Gama (RA-II)
    {"stop_id": "GAMA",      "stop_name": "Terminal Gama",                         "stop_lat": -16.0178, "stop_lon": -48.0552},
    {"stop_id": "GAMA-L",    "stop_name": "Gama Leste - QD 12",                    "stop_lat": -16.0050, "stop_lon": -48.0400},
    # Santa Maria (RA-XIII)
    {"stop_id": "SANTA-M",   "stop_name": "Terminal Santa Maria",                  "stop_lat": -16.0031, "stop_lon": -48.0308},
    # Sobradinho (RA-V / XXVI)
    {"stop_id": "SOB",       "stop_name": "Terminal Sobradinho",                   "stop_lat": -15.6507, "stop_lon": -47.7951},
    {"stop_id": "SOB-II",    "stop_name": "Sobradinho II - QD 20",                 "stop_lat": -15.6300, "stop_lon": -47.8050},
    # Planaltina (RA-VI)
    {"stop_id": "PLAN",      "stop_name": "Terminal Planaltina",                   "stop_lat": -15.6146, "stop_lon": -47.6516},
    {"stop_id": "PLAN-ARA",  "stop_name": "Planaltina - Arapoanga / Av. Independência","stop_lat": -15.5980, "stop_lon": -47.6730},
    # Paranoá (RA-VII)
    {"stop_id": "PARA",      "stop_name": "Terminal Paranoá",                      "stop_lat": -15.7811, "stop_lon": -47.7742},
    # Itapoã (RA-XXVIII)
    {"stop_id": "ITAP",      "stop_name": "Itapoã - Av. São Bartolomeu",           "stop_lat": -15.7130, "stop_lon": -47.7418},
    # Lago Norte (RA-XVIII)
    {"stop_id": "LAG-N",     "stop_name": "Lago Norte - SHIN QI 15",              "stop_lat": -15.7277, "stop_lon": -47.8500},
    # Lago Sul (RA-XVI)
    {"stop_id": "LAG-S",     "stop_name": "Lago Sul - SHIS QL 12",                "stop_lat": -15.8445, "stop_lon": -47.8503},
    # Varjão (RA-XXIII)
    {"stop_id": "VARJAO",    "stop_name": "Varjão - QNV 05",                       "stop_lat": -15.7300, "stop_lon": -47.8980},
    # Park Way (RA-XXIV)
    {"stop_id": "PARK-W",    "stop_name": "Park Way - Av. Park Way",               "stop_lat": -15.9045, "stop_lon": -47.9589},
    # Brazlândia (RA-IV)
    {"stop_id": "BRAZ",      "stop_name": "Terminal Brazlândia",                   "stop_lat": -15.6739, "stop_lon": -48.2024},
    # São Sebastião (RA-XIV)
    {"stop_id": "SAO-SEB",   "stop_name": "Terminal São Sebastião",                "stop_lat": -15.9026, "stop_lon": -47.7974},
    # Jardim Botânico (RA-XXVII)
    {"stop_id": "JARD-BOT",  "stop_name": "Jardim Botânico - Rua das Paineiras",   "stop_lat": -15.8731, "stop_lon": -47.8159},
    # Estrutural / SCIA (RA-XXV)
    {"stop_id": "ESTRUT",    "stop_name": "SCIA / Estrutural - Av. Comercial",     "stop_lat": -15.8001, "stop_lon": -48.0012},
    # Fercal (RA-XXXI)
    {"stop_id": "FERCAL",    "stop_name": "Fercal - Estrada Parque Ceilândia",     "stop_lat": -15.5833, "stop_lon": -47.9834},
    # UnB e pontos especiais
    {"stop_id": "UNB",       "stop_name": "UnB - Universidade de Brasília / ICC",  "stop_lat": -15.7635, "stop_lon": -47.8703},
    {"stop_id": "HOSP-BASE", "stop_name": "Hospital de Base do DF / SMHS",         "stop_lat": -15.7966, "stop_lon": -47.9145},
    {"stop_id": "ASA-N-SGAS","stop_name": "Asa Norte - SGAS / Setor Médico",       "stop_lat": -15.7740, "stop_lon": -47.8905},
]

# ── Todas as linhas do DF (70+ rotas representativas) ─────────────────────────
ALL_LINES: dict[str, dict] = {
    # ── Ceilândia ──
    "0.108": {"nome": "0.108",       "desc": "Ceilândia Centro → Rodoviária PP",          "tipo": "troncal"},
    "0.109": {"nome": "0.109",       "desc": "Ceilândia Sul → Asa Norte",                 "tipo": "troncal"},
    "0.110": {"nome": "0.110",       "desc": "Ceilândia Norte → Rodoviária PP",           "tipo": "troncal"},
    "110-E": {"nome": "110 Expressa","desc": "Ceilândia Norte → Rodoviária (Expressa)",   "tipo": "expressa"},
    "102":   {"nome": "102",         "desc": "Ceilândia Norte → Ceilândia Sul",           "tipo": "local"},
    "103":   {"nome": "103",         "desc": "Ceilândia - Setor O / QNN Circular",        "tipo": "local"},
    "185":   {"nome": "185",         "desc": "SCIA/Estrutural → Rodoviária PP",           "tipo": "troncal"},
    "187":   {"nome": "187",         "desc": "Sol Nascente → Terminal Ceilândia Norte",   "tipo": "alimentadora"},
    "188":   {"nome": "188",         "desc": "Ceilândia / SIA → Rodoviária PP",           "tipo": "troncal"},
    "902":   {"nome": "902",         "desc": "Setor P Norte → Terminal Ceilândia",        "tipo": "alimentadora"},
    "903":   {"nome": "903",         "desc": "Setor P Sul → Terminal Ceilândia",          "tipo": "alimentadora"},
    "906":   {"nome": "906",         "desc": "Sol Nascente / Pôr do Sol → Ceilândia Sul", "tipo": "alimentadora"},
    "CEI-SIA": {"nome": "★ CEI→SIA Diametral", "desc": "Ceilândia Norte → SIA (Direto)", "tipo": "diametral"},
    # ── Taguatinga / Vicente Pires / Águas Claras / Arniqueira ──
    "0.401": {"nome": "0.401",       "desc": "Taguatinga Norte → Rodoviária PP",          "tipo": "troncal"},
    "0.402": {"nome": "0.402",       "desc": "Taguatinga Sul → Asa Norte",                "tipo": "troncal"},
    "0.403": {"nome": "0.403",       "desc": "Taguatinga / Arniqueira → Rodoviária PP",   "tipo": "troncal"},
    "403":   {"nome": "403",         "desc": "Taguatinga - QNA / QSA Circular",           "tipo": "local"},
    "550":   {"nome": "550",         "desc": "Vicente Pires → Terminal Taguatinga Norte", "tipo": "alimentadora"},
    "554":   {"nome": "554",         "desc": "Águas Claras → Taguatinga Norte",           "tipo": "alimentadora"},
    "555":   {"nome": "555",         "desc": "Arniqueira → Taguatinga Sul",               "tipo": "alimentadora"},
    "TAG-SIA": {"nome": "★ TAG→SIA Diametral", "desc": "Taguatinga → SIA (Direto)",      "tipo": "diametral"},
    # ── Samambaia ──
    "0.210": {"nome": "0.210",       "desc": "Samambaia Norte → Rodoviária PP",           "tipo": "troncal"},
    "0.213": {"nome": "0.213",       "desc": "Samambaia / Ceilândia → Rodoviária PP",     "tipo": "troncal"},
    "0.215": {"nome": "0.215",       "desc": "Samambaia Sul → Rodoviária PP",             "tipo": "troncal"},
    "215-E": {"nome": "215 Expressa","desc": "Samambaia Sul → Rodoviária (Expressa)",     "tipo": "expressa"},
    "862":   {"nome": "862",         "desc": "Recanto das Emas → Terminal Samambaia",     "tipo": "alimentadora"},
    "863":   {"nome": "863",         "desc": "Recanto das Emas → Rodoviária PP",          "tipo": "troncal"},
    "864":   {"nome": "864",         "desc": "Riacho Fundo II → Samambaia Norte",         "tipo": "alimentadora"},
    "SAM-SIA": {"nome": "★ SAM→SIA Diametral","desc": "Samambaia → SIA (Direto)",        "tipo": "diametral"},
    # ── Gama / Santa Maria ──
    "0.504": {"nome": "0.504",       "desc": "Gama Leste → Rodoviária PP",                "tipo": "troncal"},
    "0.505": {"nome": "0.505",       "desc": "Gama Oeste → Rodoviária PP",                "tipo": "troncal"},
    "0.506": {"nome": "0.506",       "desc": "Santa Maria → Rodoviária PP via Gama",      "tipo": "troncal"},
    "0.512": {"nome": "0.512",       "desc": "Santa Maria → Rodoviária PP (Direto)",      "tipo": "troncal"},
    "500":   {"nome": "500",         "desc": "Gama - Circular Leste/Oeste",               "tipo": "local"},
    "501":   {"nome": "501",         "desc": "Santa Maria - Circular Interna",            "tipo": "local"},
    "SM-SIA": {"nome": "★ SM→SIA Diametral","desc": "Santa Maria → SIA (Direto)",        "tipo": "diametral"},
    # ── Sobradinho / Planaltina / Itapoã ──
    "0.618": {"nome": "0.618",       "desc": "Planaltina / Arapoanga → Rodoviária PP",    "tipo": "troncal"},
    "0.619": {"nome": "0.619",       "desc": "Planaltina → Rodoviária PP (Direto)",       "tipo": "troncal"},
    "0.620": {"nome": "0.620",       "desc": "Sobradinho → Rodoviária PP",                "tipo": "troncal"},
    "0.621": {"nome": "0.621",       "desc": "Sobradinho II → Rodoviária PP",             "tipo": "troncal"},
    "700":   {"nome": "700",         "desc": "Planaltina - Circular Interna",             "tipo": "local"},
    "705":   {"nome": "705",         "desc": "Itapoã → Terminal Sobradinho",              "tipo": "alimentadora"},
    "706":   {"nome": "706",         "desc": "Itapoã → Rodoviária PP via Paranoá",        "tipo": "troncal"},
    "708":   {"nome": "708",         "desc": "Paranoá → Rodoviária PP",                   "tipo": "troncal"},
    # ── Guará / SIA / Núcleo Bandeirante / Park Way ──
    "0.301": {"nome": "0.301",       "desc": "Guará → Rodoviária PP",                     "tipo": "troncal"},
    "0.305": {"nome": "0.305",       "desc": "Guará II → Rodoviária PP",                  "tipo": "troncal"},
    "193":   {"nome": "193",         "desc": "Park Way → Rodoviária PP",                  "tipo": "troncal"},
    "0.188": {"nome": "0.188",       "desc": "SIA / Núcleo Bandeirante → Rodoviária PP",  "tipo": "troncal"},
    "0.189": {"nome": "0.189",       "desc": "Candangolândia / NB → Rodoviária PP",       "tipo": "troncal"},
    "300":   {"nome": "300",         "desc": "Guará - QE Circular",                       "tipo": "local"},
    # ── São Sebastião / Jardim Botânico ──
    "0.130": {"nome": "0.130",       "desc": "São Sebastião → Rodoviária PP",             "tipo": "troncal"},
    "0.131": {"nome": "0.131",       "desc": "São Sebastião / Paranoá → Rodoviária PP",   "tipo": "troncal"},
    "0.132": {"nome": "0.132",       "desc": "Jardim Botânico → Rodoviária PP",           "tipo": "troncal"},
    "131":   {"nome": "131",         "desc": "São Sebastião - Circular QR/QS",            "tipo": "local"},
    # ── Brazlândia ──
    "0.070": {"nome": "0.070",       "desc": "Brazlândia → Rodoviária PP",                "tipo": "troncal"},
    "0.071": {"nome": "0.071",       "desc": "Brazlândia → Terminal Taguatinga Norte",    "tipo": "troncal"},
    # ── Recanto das Emas / Riacho Fundo ──
    "0.863": {"nome": "0.863",       "desc": "Recanto das Emas → Rodoviária PP (Direto)", "tipo": "troncal"},
    "865":   {"nome": "865",         "desc": "Riacho Fundo → Rodoviária PP",              "tipo": "troncal"},
    "866":   {"nome": "866",         "desc": "Riacho Fundo II → Rodoviária PP",           "tipo": "troncal"},
    # ── Linhas especiais / BRT / Intermodais ──
    "047":   {"nome": "047",         "desc": "Asa Sul / Asa Norte → L2 Norte/Sul",        "tipo": "local"},
    "BRT-S": {"nome": "BRT Sul",     "desc": "BRT Sul → Gama / Santa Maria",              "tipo": "brt"},
    "BRT-N": {"nome": "BRT Norte",   "desc": "BRT Norte → Sobradinho / Planaltina",       "tipo": "brt"},
    "FERCAL":{"nome": "FERCAL",      "desc": "Fercal → Rodoviária PP",                    "tipo": "troncal"},
    "VARJAO":{"nome": "Varjão",      "desc": "Varjão → Rodoviária PP",                    "tipo": "local"},
    "LAG-N": {"nome": "Lago Norte",  "desc": "Lago Norte → Rodoviária PP",                "tipo": "local"},
    "LAG-S": {"nome": "Lago Sul",    "desc": "Lago Sul → Rodoviária PP",                  "tipo": "local"},
}

# ── Mapeamento parada → linhas que passam ─────────────────────────────────────
STOP_LINES_MAP: dict[str, list[str]] = {
    "RODO":      ["0.110","0.109","0.108","0.210","0.215","0.213","0.401","0.402","0.403","0.301","0.305","0.504","0.505","0.512","0.618","0.619","0.620","0.621","0.130","0.131","0.132","0.070","0.863","0.188","0.189","047","185","193","BRT-S","BRT-N"],
    "ASA-N-W3":  ["0.109","0.402","047","LAG-N","VARJAO","0.131","0.708"],
    "ASA-S-W3":  ["0.108","0.215","0.305","047","LAG-S","0.132","SM-SIA"],
    "ASA-N-L2":  ["047","LAG-N","VARJAO","0.619","0.620"],
    "SUDOESTE":  ["0.301","0.305","0.189","193","LAG-S"],
    "CRUZEIRO":  ["0.108","0.301","193","047"],
    "UNB":       ["0.109","0.402","047","LAG-N","0.708"],
    "HOSP-BASE": ["0.108","0.301","0.188","047"],
    "ASA-N-SGAS":["047","LAG-N","0.109","0.619"],
    "CEI-N":     ["0.110","110-E","102","902","903","187","CEI-SIA"],
    "CEI-S":     ["0.108","0.109","102","103","906"],
    "CEI-SETP":  ["902","903","0.108","187"],
    "SOL-NASC":  ["906","187","102"],
    "TAG-N":     ["0.401","0.403","403","550","554","555","0.071","TAG-SIA"],
    "TAG-S":     ["0.402","403","550","554"],
    "TAG-PRACA": ["0.401","0.402","403","550"],
    "SAM-N":     ["0.210","0.213","862","863","864","SAM-SIA"],
    "SAM-S":     ["0.215","215-E","862"],
    "GUA":       ["0.301","0.305","300","0.189"],
    "GUA-II":    ["0.305","300"],
    "SIA":       ["0.188","CEI-SIA","TAG-SIA","SAM-SIA","SM-SIA","0.301"],
    "NUC-BAND":  ["0.188","0.189","193","0.863"],
    "CAND":      ["0.189","193"],
    "RIA-F":     ["865","864","0.863"],
    "RIA-F-II":  ["866","864"],
    "RECAN":     ["0.863","862","863","865"],
    "VIC-P":     ["550","554","555","0.401"],
    "AG-CL":     ["554","555","0.401","0.402"],
    "GAMA":      ["0.504","0.505","500","BRT-S"],
    "GAMA-L":    ["0.504","500"],
    "SANTA-M":   ["0.506","0.512","501","SM-SIA","BRT-S"],
    "SOB":       ["0.620","0.621","705","BRT-N"],
    "SOB-II":    ["0.621","705"],
    "PLAN":      ["0.618","0.619","700","BRT-N"],
    "PLAN-ARA":  ["0.618","700"],
    "PARA":      ["0.131","708","706"],
    "ITAP":      ["705","706"],
    "LAG-N":     ["LAG-N","0.619","0.621"],
    "LAG-S":     ["LAG-S","0.305","193"],
    "VARJAO":    ["VARJAO","0.620"],
    "PARK-W":    ["193","0.301"],
    "BRAZ":      ["0.070","0.071"],
    "SAO-SEB":   ["0.130","0.131","131"],
    "JARD-BOT":  ["0.132","131"],
    "ESTRUT":    ["185","0.110","0.210"],
    "FERCAL":    ["FERCAL","0.619"],
    "SOL-NASC":  ["906","187"],
}

# ── Estações do Metrô-DF — rota oficial ───────────────────────
# Linha Ceilândia (verde):  Terminal Asa Norte → Central → Asa Sul → Terminal Asa Sul
#                           → Guará → Taguatinga → Centro Metropolitano → Ceilândia Norte
# Linha Samambaia (laranja): bifurcação em Centro Metropolitano → Samambaia
_MC = "#22c55e"   # verde — Linha Ceilândia
_MS = "#f97316"   # laranja — Linha Samambaia

def _s(sid, name, lat, lon, linha="ceilandia", ta="Ceilândia Norte", tb="Terminal Asa Norte",
        fp=6, fn=10):
    cor = _MC if linha == "ceilandia" else _MS
    if "ceilandia,samambaia" in linha:
        cor = _MC
    return {"stop_id": sid, "stop_name": name, "stop_lat": lat, "stop_lon": lon,
            "type": "metro", "linha_metro": linha, "cor_metro": cor,
            "freq_pico": fp, "freq_normal": fn, "terminus_a": ta, "terminus_b": tb}

METRO_STATIONS: list[dict] = [
    # ── TRECHO ASA NORTE (Terminal Asa Norte → Central) ──────────
    _s("MTR-T-NORTE",   "Terminal Asa Norte (Metrô)", -15.7476, -47.8800),
    _s("MTR-115-N",     "Metrô 115 Norte",            -15.7553, -47.8852),
    _s("MTR-113-N",     "Metrô 113 Norte",            -15.7620, -47.8873),
    _s("MTR-111-N",     "Metrô 111 Norte",            -15.7688, -47.8889),
    _s("MTR-109-N",     "Metrô 109 Norte",            -15.7756, -47.8900),
    _s("MTR-107-N",     "Metrô 107 Norte",            -15.7824, -47.8908),
    _s("MTR-105-N",     "Metrô 105 Norte",            -15.7862, -47.8918),
    _s("MTR-103-N",     "Metrô 103 Norte",            -15.7880, -47.8928),
    # ── ÁREA CENTRAL ─────────────────────────────────────────────
    _s("MTR-C-NORTE",   "Metrô Cruzeiro Norte",       -15.7893, -47.8958),
    _s("MTR-CENTRAL",   "Metrô Central",              -15.7944, -47.8923),
    _s("MTR-GALERIA",   "Metrô Galeria",              -15.7988, -47.8924),
    # ── TRECHO ASA SUL (Central → Terminal Asa Sul) ───────────────
    _s("MTR-C-SUL",     "Metrô C. Sul / Sarah",       -15.8028, -47.8930),
    _s("MTR-ASA-SUL",   "Metrô Asa Sul",              -15.8078, -47.8935),
    _s("MTR-102-S",     "Metrô 102 Sul",              -15.8122, -47.8940),
    _s("MTR-104-S",     "Metrô 104 Sul",              -15.8166, -47.8945),
    _s("MTR-106-S",     "Metrô 106 Sul",              -15.8210, -47.8950),
    _s("MTR-108-S",     "Metrô 108 Sul",              -15.8254, -47.8957),
    _s("MTR-110-S",     "Metrô 110 Sul",              -15.8298, -47.8963),
    _s("MTR-112-S",     "Metrô 112 Sul",              -15.8342, -47.8968),
    _s("MTR-114-S",     "Metrô 114 Sul",              -15.8372, -47.9010),
    _s("MTR-116-S",     "Metrô 116 Sul",              -15.8390, -47.9110),
    _s("MTR-T-ASA-SUL", "Terminal Asa Sul (Metrô)",   -15.8400, -47.9220),
    # ── TRECHO GUARÁ (Terminal Asa Sul → Guará) ───────────────────
    _s("MTR-SHOPPING",  "Metrô Shopping",             -15.8313, -47.9315),
    _s("MTR-GUARA",     "Metrô Guará",                -15.8290, -47.9484),
    # ── TRECHO TAGUATINGA (Guará → Centro Metropolitano) ─────────
    _s("MTR-ARNIQ",     "Metrô Arniqueiras",          -15.8258, -47.9728),
    _s("MTR-CONCESS",   "Metrô Concessionárias",      -15.8218, -47.9886),
    _s("MTR-EST-PARQ",  "Metrô Estrada Parque",       -15.8196, -48.0005),
    _s("MTR-AG-CLARAS", "Metrô Águas Claras",         -15.8360, -48.0256),
    _s("MTR-ONYAMA",    "Metrô Onyama",               -15.8278, -48.0393),
    _s("MTR-PRACA-REL", "Metrô Praça do Relógio",     -15.8192, -48.0583),
    # ── BIFURCAÇÃO ───────────────────────────────────────────────
    _s("MTR-CENTRO-MET","Metrô Centro Metropolitano", -15.8140, -48.0438,
       linha="ceilandia,samambaia", ta="Ceilândia Norte", tb="Samambaia", fp=6, fn=10),
    # ── LINHA CEILÂNDIA — ramal noroeste ─────────────────────────
    _s("MTR-GUARIROBA", "Metrô Guariroba",            -15.8256, -48.0718),
    _s("MTR-CEI-SUL",   "Metrô Ceilândia Sul",        -15.8357, -48.1028),
    _s("MTR-CEI-CENTRO","Metrô Ceilândia Centro",     -15.8265, -48.1118),
    _s("MTR-CEI-NORTE", "Metrô Ceilândia Norte",      -15.8090, -48.1137),
    # ── LINHA SAMAMBAIA — ramal sul ───────────────────────────────
    _s("MTR-TAG-SUL",   "Metrô Taguatinga Sul",       -15.8248, -48.0495,
       linha="samambaia", ta="Samambaia", tb="Terminal Asa Norte", fp=8, fn=14),
    _s("MTR-FURNAS",    "Metrô Furnas",               -15.8430, -48.0594,
       linha="samambaia", ta="Samambaia", tb="Terminal Asa Norte", fp=8, fn=14),
    _s("MTR-SAMBA-SUL", "Metrô Samambaia Sul",        -15.8548, -48.0726,
       linha="samambaia", ta="Samambaia", tb="Terminal Asa Norte", fp=8, fn=14),
    _s("MTR-SAMAMBAIA", "Metrô Samambaia",            -15.8650, -48.0889,
       linha="samambaia", ta="Samambaia", tb="Terminal Asa Norte", fp=8, fn=14),
]


def _fmt_time(dep_min: int) -> str:
    h, m = divmod(dep_min, 60)
    return f"{h % 24:02d}:{m:02d}:00"


def _metro_trips(stop_id: str, limit: int = 12) -> list[dict]:
    """Gera horários do Metrô-DF com base na frequência oficial por período."""
    station = next((s for s in METRO_STATIONS if s["stop_id"] == stop_id), None)
    if not station:
        return []

    now     = datetime.now()
    now_min = now.hour * 60 + now.minute

    # Funcionamento: Seg-Sáb 6h-23h30 / Dom 7h-19h
    is_sunday   = now.weekday() == 6
    open_min    = 7 * 60 if is_sunday else 6 * 60
    close_min   = 19 * 60 if is_sunday else 23 * 60 + 30

    if now_min < open_min or now_min > close_min:
        return []

    is_peak = (6*60 <= now_min <= 9*60) or (17*60 <= now_min <= 21*60)
    freq    = station["freq_pico"] if is_peak else station["freq_normal"]
    cor     = station["cor_metro"]
    linha   = station["linha_metro"]
    ta      = station["terminus_a"]
    tb      = station["terminus_b"]

    trips: list[dict] = []
    for direction, destino in [(ta, ta), (tb, tb)]:
        eta_base = freq - (now_min % freq)
        if eta_base == 0:
            eta_base = freq
        for i in range(min(limit // 2 + 1, 8)):
            eta = eta_base + freq * i
            if eta > 90:
                break
            occ_pct = random.Random(f"{stop_id}{direction}{now.hour}{i}").randint(15, 75)
            trips.append({
                "trip_id":              f"MTR-{stop_id}-{direction.replace(' ','_')}-{i}",
                "route_id":             f"metro-{linha[:6]}",
                "linha":                "M1" if "ceilandia" in linha else "M2",
                "descricao":            f"Metrô DF — {destino}",
                "tipo":                 "metro",
                "destino":              destino,
                "departure_time":       _fmt_time(now_min + eta),
                "minutos_para_chegada": eta,
                "reservas_ativas":      0,
                "ocupacao_pct":         occ_pct,
                "nivel_ocupacao":       "vazio" if occ_pct < 40 else "moderado" if occ_pct < 80 else "lotado",
                "recomendado":          len(trips) == 0,
                "fonte":                "horario_oficial",
                "cor_metro":            cor,
                "linha_metro":          linha,
                "freq_min":             freq,
            })

    trips.sort(key=lambda t: t["minutos_para_chegada"])
    return trips[:limit]


def _now_trips(stop_id: str, limit: int = 12) -> list[dict]:
    line_ids = STOP_LINES_MAP.get(stop_id, list(ALL_LINES.keys())[:8])
    now = datetime.now()
    base_min = now.hour * 60 + now.minute
    rng = random.Random(stop_id + str(now.hour))  # seed by stop+hour → estável por hora

    trips = []
    seen_etas: set[int] = set()
    for i, lid in enumerate(line_ids[:limit]):
        line = ALL_LINES.get(lid)
        if not line:
            continue
        # ETA variado e realista, sem colisão de minutos
        eta = rng.randint(2, 40)
        while eta in seen_etas:
            eta += rng.randint(1, 5)
        seen_etas.add(eta)

        dep_min = base_min + eta
        h, m = divmod(dep_min, 60)

        occ_weights = ["vazio", "vazio", "moderado", "moderado", "moderado", "lotado"]
        occ = rng.choice(occ_weights)
        occ_pct = {"vazio": rng.randint(5, 35), "moderado": rng.randint(45, 80), "lotado": rng.randint(88, 100)}[occ]
        reservas = int(occ_pct * 0.5 * rng.uniform(0.6, 1.0))

        trips.append({
            "trip_id":              f"T-{lid}-{stop_id}-{i:02d}",
            "route_id":             lid,
            "linha":                line["nome"],
            "descricao":            line["desc"],
            "tipo":                 line["tipo"],
            "destino":              line["desc"].split("→")[-1].strip(),
            "departure_time":       f"{h % 24:02d}:{m:02d}:00",
            "minutos_para_chegada": eta,
            "reservas_ativas":      reservas,
            "ocupacao_pct":         occ_pct,
            "nivel_ocupacao":       occ,
            "recomendado":          False,
        })

    trips.sort(key=lambda t: t["minutos_para_chegada"])

    # Marca o melhor: menor ETA dentre os não-lotados
    disponiveis = [t for t in trips if t["nivel_ocupacao"] != "lotado"]
    if disponiveis:
        disponiveis[0]["recomendado"] = True

    return trips


# ── Gestor endpoints ──────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "MobiDF AI (demo)"}

@app.get("/api/v1/gestor/dashboard")
def dashboard():
    active_overlaps = [o for o in OVERLAPS if o["status"] == "ativo" and o["id"] not in _resolved_overlaps]
    resolved_count = len([o for o in OVERLAPS if o["status"] == "resolvido"]) + len(_resolved_overlaps)
    economia_potencial = sum(o["economia_estimada_mensal"] for o in active_overlaps)
    economia_total = sum(o["economia_estimada_mensal"] for o in OVERLAPS if o["id"] in _resolved_overlaps or o["status"] == "resolvido")
    return {
        "overlap": {"ativos": len(active_overlaps), "resolvidos": resolved_count, "economia_potencial": economia_potencial, "economia_total": economia_total},
        "fleet": {"total_rotas": len(FLEET_SCORES), "score_medio": 54.4, "rotas_eficientes": 3, "rotas_criticas": 2},
        "terminal_virtual": {"total_sincronizados": 5, "avg_espera_min": 2.5, "tempo_salvo_total_min": 27.5, "passageiros_beneficiados": 412, "tempo_salvo_por_pessoa_min": 1.5},
        "reinvestment": {"economia_mes": 8500, "wifi_mes": 5100, "ac_mes": 2550, "economia_ano": 77350, "rotas_cortadas_ano": 1},
        "diametral_count": len(DIAMETRAL),
        "top_diametral": DIAMETRAL[:3],
    }

@app.get("/api/v1/gestor/overlaps")
def overlaps(status: str = "ativo"):
    result = []
    for o in OVERLAPS:
        effective_status = "resolvido" if o["id"] in _resolved_overlaps else o["status"]
        if effective_status == status:
            result.append({**o, "status": effective_status})
    return result

@app.get("/api/v1/gestor/overlaps/summary")
def overlap_summary():
    active = [o for o in OVERLAPS if o["id"] not in _resolved_overlaps and o["status"] == "ativo"]
    return {
        "ativos": len(active),
        "resolvidos": len(_resolved_overlaps) + len([o for o in OVERLAPS if o["status"] == "resolvido"]),
        "economia_potencial": sum(o["economia_estimada_mensal"] for o in active),
        "economia_total": sum(o["economia_estimada_mensal"] for o in OVERLAPS if o["id"] in _resolved_overlaps),
    }

@app.patch("/api/v1/gestor/overlaps/{overlap_id}/resolve")
def resolve_overlap(overlap_id: str):
    _resolved_overlaps.add(overlap_id)
    target = next((o for o in OVERLAPS if o["id"] == overlap_id), None)
    if not target:
        from fastapi import HTTPException
        raise HTTPException(404, "Não encontrado")
    return {**target, "status": "resolvido"}

@app.get("/api/v1/gestor/terminal-virtual")
def terminal_virtual(stop_id: Optional[str] = None):
    return [t for t in VIRTUAL_TERMINALS if not stop_id or t["stop_id"] == stop_id]

@app.get("/api/v1/gestor/terminal-virtual/kpi")
def terminal_kpi():
    return {"total_sincronizados": 5, "avg_espera_min": 2.5, "tempo_salvo_total_min": 27.5, "passageiros_beneficiados": 412, "tempo_salvo_por_pessoa_min": 1.5}

@app.get("/api/v1/gestor/fleet-scores")
def fleet_scores(limit: int = 50):
    return FLEET_SCORES[:limit]

@app.get("/api/v1/gestor/fleet-scores/summary")
def fleet_summary():
    return {"total_rotas": len(FLEET_SCORES), "score_medio": 54.4, "rotas_eficientes": 3, "rotas_criticas": 2}

@app.get("/api/v1/gestor/regioes-administrativas")
def regioes_administrativas():
    return sorted(REGIOES_ADMINISTRATIVAS, key=lambda r: r["nome"])

@app.get("/api/v1/gestor/diametral/suggestions")
def diametral_suggestions():
    return DIAMETRAL

@app.get("/api/v1/gestor/diametral/od-heatmap")
def od_heatmap():
    return [{"origem": d["origem"], "destino": d["destino"], "trips_daily": d["trips_daily"], "has_direct_route": False, "diametral_suggested": True} for d in DIAMETRAL]

@app.get("/api/v1/gestor/reinvestment/current")
def reinvestment_current():
    return {"economia_mes": 8500, "wifi_mes": 5100, "ac_mes": 2550, "economia_ano": 77350, "rotas_cortadas_ano": len(_resolved_overlaps) + 1}

@app.get("/api/v1/gestor/reinvestment/history")
def reinvestment_history(months: int = 6):
    return REINV_HISTORY[:months]

@app.post("/api/v1/gestor/etl/gtfs")
def trigger_etl():
    return {"status": "ok", "stats": {"routes": 42, "stops": 1834, "trips": 8921, "stop_times": 219430, "shapes": 42}}

@app.get("/api/v1/etl/status")
def etl_status():
    return [{"source": "gtfs_static", "status": "success", "records_out": 229427, "started_at": "2026-06-20T00:30:00", "finished_at": "2026-06-20T00:34:12"}]

# ── Cidadão endpoints ─────────────────────────────────────────

@app.get("/api/v1/cidadao/stops/metro")
def metro_stations_endpoint():
    """Retorna todas as estações do Metrô-DF."""
    return METRO_STATIONS

@app.get("/api/v1/cidadao/stops/all-map")
def all_stops_map():
    """Retorna TODAS as paradas de ônibus + estações de metrô para exibição no mapa."""
    bus   = [{"type": "bus", **{k: v for k, v in s.items() if k not in ("type",)}} for s in STOPS]
    metro = list(METRO_STATIONS)
    return bus + metro

@app.get("/api/v1/cidadao/metro/lines")
def metro_lines_endpoint():
    """Mock retorna [] — frontend usa fallback hardcoded.
    Em modo real (real_server.py) retorna geometria WFS do GeoServer SEMOB.
    """
    return []

@app.get("/api/v1/cidadao/stops/search")
def search_stops(q: str = "", limit: int = 50):
    """Busca insensível a acentos em paradas de ônibus E estações de metrô."""
    if not q.strip():
        return []
    q_norm = _normalize(q)
    scored = []
    for s in list(STOPS) + list(METRO_STATIONS):
        name_norm = _normalize(s["stop_name"])
        if q_norm not in name_norm:
            continue
        if name_norm == q_norm:            priority = 0
        elif name_norm.startswith(q_norm): priority = 1
        else:                              priority = 2
        scored.append((priority, s["stop_name"], s))
    scored.sort(key=lambda x: (x[0], x[1]))
    return [s for _, _, s in scored][:limit]

@app.get("/api/v1/cidadao/stops/nearby")
def stops_nearby(lat: float = -15.7942, lon: float = -47.8825, radius_m: int = 500):
    import math
    def dist(s):
        dlat = (s["stop_lat"] - lat) * 111000
        dlon = (s["stop_lon"] - lon) * 111000 * math.cos(math.radians(lat))
        return math.sqrt(dlat**2 + dlon**2)
    all_stops = list(STOPS) + list(METRO_STATIONS)
    result = [{"dist_m": round(dist(s)), **{k: v for k, v in s.items()}} for s in all_stops]
    within = [r for r in result if r["dist_m"] <= radius_m]
    result_sorted = sorted(result, key=lambda x: x["dist_m"])
    return (within or result_sorted)[:15]

@app.get("/api/v1/cidadao/trips/next")
def next_trips(origin_stop_id: str = "", dest_stop_id: Optional[str] = None, limit: int = 12):
    if origin_stop_id.startswith("MTR-"):
        return _metro_trips(origin_stop_id, limit)
    return _now_trips(origin_stop_id, limit)

@app.get("/api/v1/cidadao/occupancy/{trip_id}")
def occupancy(trip_id: str):
    count = len([r for r in _reservations.values() if r["trip_id"] == trip_id])
    return {"reservas_confirmadas": count, "ocupacao_pct": min(100, count * 3 + 40)}

@app.get("/api/v1/cidadao/cartao/{numero}/saldo")
def cartao_saldo(numero: str):
    digits = "".join(c for c in numero if c.isdigit())
    if len(digits) < 4:
        from fastapi import HTTPException
        raise HTTPException(400, "Número inválido")
    seed = int(digits[-6:]) if len(digits) >= 6 else int(digits)
    rng = random.Random(seed)
    saldo = round(rng.uniform(2.50, 148.90), 2)
    hoje = datetime.now()
    linhas_recentes = [
        {"0.110": "Ceilândia → Rodoviária PP"},
        {"0.210": "Samambaia → Rodoviária PP"},
        {"BRT-S": "BRT Sul → Santa Maria"},
        {"0.401": "Taguatinga → Rodoviária PP"},
        {"047":   "Asa Norte → Asa Sul"},
    ]
    viagens = []
    for i in range(4):
        entry = rng.choice(linhas_recentes)
        lid, desc = next(iter(entry.items()))
        valor = rng.choice([-5.50, -5.50, -3.80, -5.50])
        dia = hoje.day - i - 1
        viagens.append({
            "data":      f"{max(1,dia):02d}/{hoje.month:02d}/{hoje.year}",
            "linha":     lid,
            "descricao": desc,
            "valor":     valor,
        })
    return {
        "numero":        f"****{digits[-4:]}",
        "nome_titular":  "TITULAR DO CARTÃO",
        "saldo":         saldo,
        "validade":      f"{rng.randint(1,12):02d}/{rng.randint(2026,2028)}",
        "status":        "ativo",
        "ultimas_viagens": viagens,
        "nota":          "Demonstração · Saldo real: cartaomobilidade.df.gov.br",
    }

class ReservationIn(BaseModel):
    user_identifier: str
    trip_id: str
    origin_stop_id: str
    dest_stop_id: str
    travel_date: str
    departure_time: str

@app.post("/api/v1/cidadao/reservations", status_code=201)
def create_reservation(body: ReservationIn):
    from fastapi import HTTPException
    token = hashlib.sha256(body.user_identifier.encode()).hexdigest()[:32]
    key = f"{token}:{body.trip_id}:{body.travel_date}"
    if key in _reservations:
        raise HTTPException(409, "Reserva já existe para este horário")
    rid = str(uuid.uuid4())
    # trip_id format: T-{line_id}-{stop_id}-{i}
    parts = body.trip_id.split("-", 2)
    line_id = parts[1] if len(parts) > 1 else ""
    line = ALL_LINES.get(line_id, {})
    linha = line.get("nome", line_id)
    destino = (line.get("desc", "")).split("→")[-1].strip() if "→" in line.get("desc","") else line.get("desc","")
    origin_stop = next((s for s in STOPS if s["stop_id"] == body.origin_stop_id), None)
    dest_stop = next((s for s in STOPS if s["stop_id"] == body.dest_stop_id), None)
    _reservations[key] = {
        "id": rid, "trip_id": body.trip_id, "travel_date": body.travel_date,
        "departure_time": body.departure_time, "status": "confirmado",
        "linha": linha, "destino": destino,
        "origem_nome": origin_stop["stop_name"] if origin_stop else body.origin_stop_id,
        "destino_nome": dest_stop["stop_name"] if dest_stop else body.dest_stop_id,
        "_token": token, "_key": key,
    }
    return {"reservation_id": rid, "status": "confirmado"}

@app.get("/api/v1/cidadao/reservations")
def list_reservations(user_identifier: str = ""):
    token = hashlib.sha256(user_identifier.encode()).hexdigest()[:32]
    return [r for r in _reservations.values() if r["_token"] == token and r["status"] != "cancelado"]

class CancelBody(BaseModel):
    user_identifier: str

@app.delete("/api/v1/cidadao/reservations/{reservation_id}")
def cancel_reservation(reservation_id: str, body: CancelBody):
    from fastapi import HTTPException
    token = hashlib.sha256(body.user_identifier.encode()).hexdigest()[:32]
    for r in _reservations.values():
        if r["id"] == reservation_id and r["_token"] == token:
            r["status"] = "cancelado"
            return {"status": "cancelado"}
    raise HTTPException(404, "Reserva não encontrada")

# ── Gestora — controle de frota ──────────────────────────────
def _mock_vehicle_positions():
    rng = random.Random(42)
    lines = ["0.110","109","0.132","136.7","0.203","0.217","0.501","0.312","0.408","0.155"]
    positions = []
    for i, s in enumerate(STOPS[:80]):
        positions.append({
            "bus_id": f"MOC-{i:04d}",
            "linha": rng.choice(lines),
            "lat": round(s["stop_lat"] + rng.uniform(-0.004, 0.004), 6),
            "lon": round(s["stop_lon"] + rng.uniform(-0.004, 0.004), 6),
            "velocidade": round(rng.uniform(0, 65), 1),
            "timestamp": datetime.now().isoformat()[:16],
        })
    return positions

@app.get("/api/v1/gestora/vehicles/live")
def vehicles_live():
    return _mock_vehicle_positions()

@app.get("/api/v1/gestora/fleet/density")
def fleet_density():
    grid: dict[tuple, int] = {}
    for p in _mock_vehicle_positions():
        cell = (round(p["lat"], 2), round(p["lon"], 2))
        grid[cell] = grid.get(cell, 0) + 1
    return [{"lat": lat, "lon": lon, "count": count} for (lat, lon), count in grid.items()]

class EventIn(BaseModel):
    nome: str
    lat: float
    lon: float
    audiencia_esperada: int = 5000
    raio_m: int = 800

@app.get("/api/v1/gestora/events")
def list_events():
    return list(_gestora_events.values())

@app.post("/api/v1/gestora/events", status_code=201)
def create_event(body: EventIn):
    eid = str(uuid.uuid4())[:8]
    _gestora_events[eid] = {
        "id": eid, "nome": body.nome,
        "lat": body.lat, "lon": body.lon,
        "audiencia_esperada": body.audiencia_esperada,
        "raio_m": body.raio_m,
        "created_at": datetime.now().isoformat()[:16],
    }
    return _gestora_events[eid]

@app.delete("/api/v1/gestora/events/{event_id}")
def delete_event(event_id: str):
    _gestora_events.pop(event_id, None)
    return {"status": "deleted"}

@app.get("/api/v1/gestora/fleet/suggest/{event_id}")
def suggest_reallocation(event_id: str):
    from fastapi import HTTPException
    event = _gestora_events.get(event_id)
    if not event:
        raise HTTPException(404, "Evento não encontrado")
    positions = _mock_vehicle_positions()

    def dist(p: dict) -> float:
        dlat = (p["lat"] - event["lat"]) * 111000
        dlon = (p["lon"] - event["lon"]) * 111000 * _math.cos(_math.radians(float(event["lat"])))
        return _math.sqrt(dlat**2 + dlon**2)

    already_close = [p for p in positions if dist(p) <= 1500]
    candidates = sorted([p for p in positions if dist(p) > 1500], key=dist)
    suggestions = [
        {
            "bus_id": p["bus_id"], "linha": p["linha"],
            "lat": p["lat"], "lon": p["lon"],
            "dist_event_km": round(dist(p) / 1000, 1),
            "tempo_chegada_min": max(3, round(dist(p) / 1000 / 28 * 60)),
            "acao": f"Redirecionar para {event['nome']}",
        }
        for p in candidates[:6]
    ]
    return {"event": event, "suggestions": suggestions, "total_nearby": len(already_close)}

@app.get("/")
def health():
    return {"status": "ok", "service": "MobiDF AI", "mode": "mock"}

@app.get("/api/v1/cidadao/demo/maria")
def demo_maria():
    return {
        "persona": "Maria",
        "origem": "Ceilândia Norte",
        "destino": "SIA (Setor de Indústrias e Abastecimento)",
        "cenario_atual": {"tempo_total_min": 120, "baldeacoes": 2, "descricao": "Ceilândia → Rodoviária do PP → SIA. Espera média 18min na Rodoviária."},
        "cenario_mobidf": {
            "rota_diametral": {"descricao": "Linha Diametral Ceilândia–SIA", "tempo_total_min": 85, "baldeacoes": 0, "tempo_salvo_min": 35},
            "terminal_virtual": {"descricao": "Alimentadora sincronizada com troncal", "parada_baldeacao": "Terminal Taguatinga", "espera_max_min": 3, "tempo_total_min": 95, "tempo_salvo_min": 25},
            "reserva_de_fluxo": {"assento_garantido": True, "categoria": "Expressa", "antecedencia_checkin": "30 minutos antes"},
        },
        "impacto_diario": {"tempo_recuperado_min": 35, "tempo_recuperado_horas_mes": 12.8, "ods_impactados": ["ODS 10", "ODS 11", "ODS 13"]},
    }
