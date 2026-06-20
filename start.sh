#!/usr/bin/env bash
# MobiDF AI — start.sh
# Sobe DB + Backend + Frontend simultaneamente com logs coloridos em tempo real.
# Uso: ./start.sh [--build] [--down]

set -euo pipefail

# ── Cores por serviço ──────────────────────────────────────────
RESET='\033[0m'
BOLD='\033[1m'
C_DB='\033[36m'       # ciano   → banco
C_BACK='\033[33m'     # amarelo → backend
C_FRONT='\033[35m'    # magenta → frontend
C_SYS='\033[32m'      # verde   → sistema

log()  { echo -e "${C_SYS}${BOLD}[mobidf]${RESET} $*"; }
err()  { echo -e "\033[31m${BOLD}[erro]${RESET}   $*" >&2; }

# ── Argumentos ────────────────────────────────────────────────
BUILD_FLAG=""
for arg in "$@"; do
  case $arg in
    --build) BUILD_FLAG="--build" ;;
    --down)
      log "Parando todos os contêineres..."
      docker compose down
      log "Encerrado."
      exit 0
      ;;
  esac
done

# ── Pré-requisitos ────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  err "Docker não encontrado. Instale em https://docs.docker.com/get-docker/"
  exit 1
fi
if ! docker compose version &>/dev/null; then
  err "Docker Compose v2 não encontrado."
  exit 1
fi

# ── .env ──────────────────────────────────────────────────────
if [ ! -f .env ]; then
  cp .env.example .env
  log ".env criado a partir de .env.example"
fi

# ── Limpeza ao sair (Ctrl+C ou erro) ─────────────────────────
cleanup() {
  echo ""
  log "Encerrando serviços..."
  docker compose stop 2>/dev/null || true
  kill "$PID_DB" "$PID_BACK" "$PID_FRONT" 2>/dev/null || true
  log "Tudo parado. Até logo!"
  exit 0
}
trap cleanup INT TERM

# ── Função: prefixo colorido nos logs ────────────────────────
stream_logs() {
  local service=$1
  local color=$2
  docker compose logs --follow --no-log-prefix "$service" 2>/dev/null \
    | while IFS= read -r line; do
        echo -e "${color}${BOLD}[${service}]${RESET} ${line}"
      done
}

# ── Sobe todos os serviços de uma vez ────────────────────────
log "Iniciando MobiDF AI..."
log "DB + Backend + Frontend subindo em paralelo..."
echo ""

docker compose up -d $BUILD_FLAG

# ── Aguarda o banco estar saudável antes de liberar o log ────
log "Aguardando PostgreSQL + PostGIS..."
TRIES=0
until docker compose exec db pg_isready -U mobidf > /dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [ $TRIES -ge 60 ]; then
    err "Banco não ficou saudável em 60s. Verifique: docker compose logs db"
    exit 1
  fi
  sleep 1
done
log "Banco pronto (${TRIES}s)."

# ── Mostra URLs ───────────────────────────────────────────────
echo ""
echo -e "${C_SYS}${BOLD}┌─────────────────────────────────────────────┐${RESET}"
echo -e "${C_SYS}${BOLD}│       MobiDF AI — Rodando!                  │${RESET}"
echo -e "${C_SYS}${BOLD}├─────────────────────────────────────────────┤${RESET}"
echo -e "${C_SYS}│${RESET}  ${C_DB}Banco${RESET}          localhost:5432 (mobidf)       "
echo -e "${C_SYS}│${RESET}  ${C_BACK}Backend API${RESET}    http://localhost:8000/docs    "
echo -e "${C_SYS}│${RESET}  ${C_FRONT}Gestor SEMOB${RESET}   http://localhost:3000/gestor  "
echo -e "${C_SYS}│${RESET}  ${C_FRONT}App Cidadão${RESET}    http://localhost:3000/cidadao "
echo -e "${C_SYS}${BOLD}└─────────────────────────────────────────────┘${RESET}"
echo ""
echo -e "  Pressione ${BOLD}Ctrl+C${RESET} para parar tudo."
echo ""

# ── Stream de logs em paralelo (cada serviço com sua cor) ────
stream_logs db       "$C_DB"    &  PID_DB=$!
stream_logs backend  "$C_BACK"  &  PID_BACK=$!
stream_logs frontend "$C_FRONT" &  PID_FRONT=$!

# ── Mantém o script ativo ────────────────────────────────────
wait
