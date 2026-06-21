# MobiDF AI

**Inteligência de mobilidade para o Distrito Federal — sem obras, sem Docker, sem complicação.**

Mock backend + Next.js 14. Roda com um comando.

---

## Início rápido

**Pré-requisitos:** Python 3.9+ e Node.js 18+

```bash
git clone https://github.com/FelipeJesusMartins/mobidf-ai.git
cd mobidf-ai
./run.sh
```

Pronto. O script cria o virtualenv, instala as dependências e sobe os dois serviços em paralelo.

| | URL |
|---|---|
| Landing | http://localhost:3000 |
| Dashboard Gestor | http://localhost:3000/gestor |
| App Cidadão | http://localhost:3000/cidadao |
| API / Swagger | http://localhost:8000/docs |

```bash
./run.sh --install        # reinstalar dependências
./run.sh --port-api 9000  # trocar porta da API
./run.sh --port-web 4000  # trocar porta do frontend
```

---

## Docker Compose (Desenvolvimento & Produção)

### Desenvolvimento Local

Para rodar o stack completo com **PostgreSQL + PostGIS + Backend + Frontend**:

```bash
# Copiar arquivo de exemplo e editar se necessário
cp .env.example .env

# Subir todos os serviços
docker-compose up -d

# Verificar status
docker-compose ps
docker-compose logs -f

# Acessar
# - Frontend: http://localhost:3000
# - API Swagger: http://localhost:8000/docs
# - PostgreSQL: localhost:5432

# Parar
docker-compose down

# Limpar tudo (banco + volumes)
docker-compose down -v
```

**Variáveis de Ambiente (.env)**

```bash
# PostgreSQL
POSTGRES_USER=mobidf
POSTGRES_PASSWORD=mobidf_secret
POSTGRES_DB=mobidf

# Backend
SECRET_KEY=sua-chave-secreta
CORS_ORIGINS=http://localhost:3000
DEBUG=false

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000

# Portas
POSTGRES_PORT=5432
BACKEND_PORT=8000
FRONTEND_PORT=3000
```

### Produção com Nginx Reverse Proxy

Para expor a aplicação em `mobidf.brocode.net.br` com nginx:

```bash
# 1. Configurar nginx (automático)
cd infra
sudo ./setup-nginx.sh

# 2. Atualizar .env para produção
cp .env.example .env

# Editar .env com:
# CORS_ORIGINS=https://mobidf.brocode.net.br
# NEXT_PUBLIC_API_URL=https://mobidf.brocode.net.br/api

# 3. Subir com compose de produção
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 4. Verificar
docker-compose ps
curl https://mobidf.brocode.net.br/health

# Acessar
# - Frontend: https://mobidf.brocode.net.br
# - Backend API: https://mobidf.brocode.net.br/api
# - API Docs: https://mobidf.brocode.net.br/api/docs
```

**Arquitetura em Produção**

```
Internet
    ↓
Nginx Reverse Proxy (mobidf.brocode.net.br)
    ├─ / → Frontend (localhost:3000)
    └─ /api/ → Backend API (localhost:8000)
    ↓
Docker Services
    ├─ PostgreSQL + PostGIS
    ├─ FastAPI Backend
    └─ Next.js Frontend
```

**Volumes Persistentes**

- `postgres_data` — Banco de dados PostgreSQL
- `backend_data` — Dados de aplicação (cache ETL, uploads)
- `frontend_cache` — Cache de build Next.js

Ver mais em: [infra/README.md](infra/README.md)

---

## GitHub Actions + Container Registry

Deploy automático a cada `git push main`:

### 1. Configurar GitHub Container Registry (ghcr.io)

O `GITHUB_TOKEN` já vem automático; nenhuma configuração extra necessária.

### 2. Configurar Self-Hosted Runner

No servidor local onde quer fazer deploy:

```bash
# 1. Criar pasta
mkdir -p ~/actions-runner
cd ~/actions-runner

# 2. Baixar runner (substitua TOKEN e REPO)
curl -o actions-runner-linux-x64-2.x.x.tar.gz -L https://github.com/actions/runner/releases/download/v2.x.x/actions-runner-linux-x64-2.x.x.tar.gz
tar xzf ./actions-runner-linux-x64-2.x.x.tar.gz

# 3. Configurar (obter token em https://github.com/BroCode-Soft/mobidf-ai/settings/actions/runners/new)
./config.sh --url https://github.com/BroCode-Soft/mobidf-ai --token SEU_TOKEN

# 4. Testar
./run.sh

# 5. (Opcional) Instalar como serviço systemd
sudo ./svc.sh install
sudo ./svc.sh start
```

### 3. Garantir Docker no Runner

```bash
# No servidor, confirmar que o docker está acessível
docker ps
docker-compose version

# Se não tiver, instalar:
sudo apt-get install -y docker.io docker-compose
sudo usermod -aG docker $USER
```

### 4. Deploy Flow

```
git push main
  ↓
GitHub Actions Workflow dispara
  ├─ Build backend image → ghcr.io/BroCode-Soft/mobidf-backend:main-<sha>
  ├─ Build frontend image → ghcr.io/BroCode-Soft/mobidf-frontend:main-<sha>
  ├─ Push para ghcr.io
  └─ Self-hosted runner:
     ├─ docker login ghcr.io
     ├─ docker-compose pull
     ├─ docker-compose down
     └─ docker-compose up -d
```

Ver logs do workflow: https://github.com/BroCode-Soft/mobidf-ai/actions

---

## O que é

O DF tem 4,6 milhões de habitantes e um problema: tudo passa pela Rodoviária do Plano Piloto. Quem mora em Ceilândia e trabalha no SIA gasta 4h/dia em ônibus com 2 baldeações obrigatórias.

O MobiDF AI resolve isso por software, usando dados públicos já existentes.

### Três algoritmos

**Terminal Virtual** — sincroniza linhas alimentadoras com troncais com tolerância de ≤ 3 minutos. Sem construir nenhum terminal físico.

**Roteamento Diametral** — analisa a matriz O/D e detecta pares de RAs com alto fluxo pendular sem linha direta. Ceilândia → SIA: 2.800 viagens/dia, nenhuma linha direta.

**Corte de Sobreposição Fantasma** — PostGIS compara geometrias de rotas e identifica linhas com ≥ 30% de trajeto coincidente rodando no mesmo horário. Cada corte gera economia reinvestida automaticamente: 60% Wi-Fi, 30% AC, 10% reserva.

---

## Interfaces

### Dashboard Gestor (Mission Control)

Painel desktop dark para a SEMOB com 5 seções:

- **Mission Control** — KPIs gerais, gráfico de reinvestimento, top rotas diametrais, cenário Maria
- **Sobreposições** — lista de linhas fantasma com botão de corte e economia estimada por linha
- **Score de Frota** — índice 0–100 por rota: `(Lotação + Sustentabilidade) − Ociosidade`, com ring chart animado
- **Rotas Diametrais** — sugestões ordenadas por horas salvas/dia
- **Terminal Virtual** — pares feeder/troncal sincronizados com tempo de espera real

### App Cidadão (Transit Pulse)

PWA mobile-first com fundo gradiente e three tabs:

- **Linhas** — busca paradas, seleciona, vê próximos ônibus com barra de ocupação em tempo real e botão de reserva
- **Reservas** — histórico de reservas do usuário
- **Maria** — cenário de impacto individual com números concretos

---

## Estrutura

```
mobidf-ai/
├── run.sh                  # único ponto de entrada
├── mock_server.py          # FastAPI com dados em memória (sem banco)
│
├── backend/                # backend de produção (FastAPI + PostgreSQL)
│   └── app/
│       ├── etl/            # GTFS, IBGE, scheduler
│       ├── services/       # algoritmos core
│       └── routers/        # gestor + cidadão
│
├── database/               # migrations SQL + funções PostGIS
│   ├── 01_extensions.sql
│   ├── 02_tables.sql
│   ├── 03_indexes.sql
│   └── 04_functions.sql
│
└── frontend/               # Next.js 14
    └── src/
        ├── app/
        │   ├── page.tsx            # landing
        │   ├── gestor/page.tsx     # mission control
        │   └── cidadao/page.tsx    # transit pulse
        └── lib/
            ├── api.ts              # client HTTP tipado
            └── utils.ts            # cn() utility
```

---

## Stack

| | |
|---|---|
| Frontend | Next.js 14, React 18, Tailwind CSS, Framer Motion, Radix UI, Recharts |
| Backend | Python 3.11, FastAPI, SQLAlchemy async, APScheduler |
| Banco (prod) | PostgreSQL 15 + PostGIS 3.3 |
| ETL | Pandas, psycopg2, protobuf (GTFS-RT) |
| Demo | mock_server.py — sem banco, sem Docker |

---

## API

Swagger completo em http://localhost:8000/docs

### Gestor

| Método | Rota | |
|---|---|---|
| `GET` | `/api/v1/gestor/dashboard` | todos os KPIs |
| `GET` | `/api/v1/gestor/overlaps` | sobreposições ativas |
| `PATCH` | `/api/v1/gestor/overlaps/{id}/resolve` | cortar linha |
| `GET` | `/api/v1/gestor/fleet-scores` | score por rota |
| `GET` | `/api/v1/gestor/diametral/suggestions` | rotas diametrais |
| `GET` | `/api/v1/gestor/terminal-virtual` | pares sincronizados |
| `GET` | `/api/v1/gestor/reinvestment/history` | histórico mensal |
| `POST` | `/api/v1/gestor/etl/gtfs` | disparar ETL |

### Cidadão

| Método | Rota | |
|---|---|---|
| `GET` | `/api/v1/cidadao/stops/search?q=` | buscar paradas |
| `GET` | `/api/v1/cidadao/stops/nearby?lat=&lon=` | paradas por GPS |
| `GET` | `/api/v1/cidadao/trips/next?origin_stop_id=` | próximas viagens |
| `POST` | `/api/v1/cidadao/reservations` | reservar assento |
| `GET` | `/api/v1/cidadao/reservations?user_identifier=` | minhas reservas |
| `DELETE` | `/api/v1/cidadao/reservations/{id}` | cancelar |
| `GET` | `/api/v1/cidadao/demo/maria` | cenário de teste |

---

## Cenário Maria

> Mora em Ceilândia Norte, trabalha no SIA. 4h/dia em ônibus, 2 baldeações.

| | Hoje | Com MobiDF AI |
|---|---|---|
| Tempo por trajeto | 120 min | **85 min** |
| Baldeações | 2 | **0** |
| Tempo salvo por dia | — | **35 min** |
| Horas devolvidas por mês | — | **+12,8 h** |

```bash
curl http://localhost:8000/api/v1/cidadao/demo/maria
```

---

## ODS

ODS 11 · ODS 9 · ODS 10 · ODS 13 — cidades sustentáveis, inovação, igualdade, clima.

---

MIT — Felipe Jesus Martins © 2026
