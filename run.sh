#!/usr/bin/env bash
# MobiDF AI — run.sh
# Inicia mock backend (FastAPI) + frontend (Next.js) sem Docker.
# Uso: ./run.sh [--install] [--port-api <N>] [--port-web <N>]
set -euo pipefail

# ── Cores ──────────────────────────────────────────────────────
R='\033[0m'; B='\033[1m'
CA='\033[33m'   # amarelo  → API
CF='\033[35m'   # magenta  → frontend
CS='\033[32m'   # verde    → sistema
CE='\033[31m'   # vermelho → erro

log()  { echo -e "${CS}${B}[mobidf]${R} $*"; }
err()  { echo -e "${CE}${B}[erro]${R}   $*" >&2; exit 1; }
info() { echo -e "${CS}$*${R}"; }

# ── Defaults ───────────────────────────────────────────────────
PORT_API=8000
PORT_WEB=3000
FORCE_INSTALL=0
USE_MOCK=0

for arg in "$@"; do
  case $arg in
    --install)         FORCE_INSTALL=1 ;;
    --mock)            USE_MOCK=1 ;;
    --port-api)  shift; PORT_API=$1 ;;
    --port-web)  shift; PORT_WEB=$1 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Pré-requisitos ────────────────────────────────────────────
command -v python3 &>/dev/null || err "python3 não encontrado."
command -v node    &>/dev/null || err "node não encontrado. Instale em https://nodejs.org"
command -v npm     &>/dev/null || err "npm não encontrado."

# ── Venv Python ───────────────────────────────────────────────
VENV="$ROOT/.venv"
if [ ! -d "$VENV" ] || [ "$FORCE_INSTALL" = "1" ]; then
  log "Criando virtualenv Python..."
  python3 -m venv "$VENV"
fi

PIP="$VENV/bin/pip"
UVICORN="$VENV/bin/uvicorn"

if [ ! -f "$UVICORN" ] || [ "$FORCE_INSTALL" = "1" ]; then
  log "Instalando dependências Python..."
  "$PIP" install --quiet --upgrade pip
  "$PIP" install --quiet fastapi "uvicorn[standard]" "httpx[http2]"
fi

# ── Node modules ──────────────────────────────────────────────
FRONT="$ROOT/frontend"
if [ ! -d "$FRONT/node_modules" ] || [ "$FORCE_INSTALL" = "1" ]; then
  log "Instalando dependências npm..."
  npm --prefix "$FRONT" install --silent
fi

# ── Cleanup ao sair ───────────────────────────────────────────
PID_API="" PID_WEB=""
cleanup() {
  echo ""
  log "Encerrando serviços..."
  [ -n "$PID_API" ] && kill "$PID_API" 2>/dev/null || true
  [ -n "$PID_WEB" ] && kill "$PID_WEB" 2>/dev/null || true
  log "Até logo!"
  exit 0
}
trap cleanup INT TERM EXIT

# ── Log prefixado por serviço ─────────────────────────────────
prefix_log() {
  local label=$1 color=$2
  while IFS= read -r line; do
    echo -e "${color}${B}[${label}]${R} ${line}"
  done
}

# ── Inicia API ────────────────────────────────────────────────
if [ "$USE_MOCK" = "1" ]; then
  SERVER_MODULE="mock_server:app"
  log "Iniciando mock server (offline) na porta ${PORT_API}..."
else
  SERVER_MODULE="real_server:app"
  log "Iniciando servidor com dados reais SEMOB/DF na porta ${PORT_API}..."
  log "  → Paradas:  geoserver.semob.df.gov.br (WFS)"
  log "  → Posições: GPS tempo real (WFS, atualiza a cada 30s)"
  log "  → Horários: GTFS DFTRANS (dfnoponto.semob.df.gov.br)"
fi
"$UVICORN" "$SERVER_MODULE" \
  --host 0.0.0.0 --port "$PORT_API" \
  --log-level warning \
  2>&1 | prefix_log "api" "$CA" &
PID_API=$!

# Aguarda API responder
TRIES=0
until curl -sf "http://localhost:${PORT_API}/api/v1/gestor/dashboard" >/dev/null 2>&1; do
  TRIES=$((TRIES+1))
  [ $TRIES -ge 20 ] && err "API não respondeu em 10s."
  sleep 0.5
done
log "API pronta (${TRIES} tentativas)."

# ── Inicia frontend Next.js ───────────────────────────────────
log "Iniciando frontend na porta ${PORT_WEB}..."
npm --prefix "$FRONT" run dev -- --port "$PORT_WEB" \
  2>&1 | prefix_log "web" "$CF" &
PID_WEB=$!

# ── Banner ────────────────────────────────────────────────────
sleep 2
echo ""
if [ "$USE_MOCK" = "1" ]; then
  MODE_LABEL="mock (offline)"
else
  MODE_LABEL="dados reais SEMOB/DF"
fi
echo -e "${CS}${B}┌───────────────────────────────────────────────┐${R}"
echo -e "${CS}${B}│            MobiDF AI — Rodando!               │${R}"
echo -e "${CS}${B}├───────────────────────────────────────────────┤${R}"
echo -e "${CS}│${R}  Modo:           ${CA}${MODE_LABEL}${R}"
echo -e "${CS}│${R}  ${CA}API / Swagger${R}   http://localhost:${PORT_API}/docs       "
echo -e "${CS}│${R}  ${CF}Landing${R}         http://localhost:${PORT_WEB}              "
echo -e "${CS}│${R}  ${CF}Gestor SEMOB${R}    http://localhost:${PORT_WEB}/gestor       "
echo -e "${CS}│${R}  ${CF}App Cidadão${R}     http://localhost:${PORT_WEB}/cidadao      "
echo -e "${CS}│${R}  ${CF}Controle Frota${R}  http://localhost:${PORT_WEB}/gestora      "
echo -e "${CS}│${R}  ${CF}Pitch 3 min${R}    http://localhost:${PORT_WEB}/pitch        "
echo -e "${CS}${B}├───────────────────────────────────────────────┤${R}"
echo -e "${CS}│${R}  Ctrl+C para parar tudo                        "
echo -e "${CS}│${R}  ${CA}./run.sh --mock${R}   para rodar offline        "
echo -e "${CS}${B}└───────────────────────────────────────────────┘${R}"
echo ""

wait
