# MobiDF AI

> **Mobilidade urbana inteligente para o Distrito Federal — 0% de obras, 100% de dados.**

SaaS B2G que resolve o gargalo logístico do DF utilizando análise geoespacial, sincronização GTFS em tempo real e predição de fluxo — superando a eficiência de sistemas BRT físicos por software.

---

## Sumário

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Funcionalidades](#funcionalidades)
- [Stack Técnica](#stack-técnica)
- [Como Rodar](#como-rodar)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [API Reference](#api-reference)
- [Cenário de Validação — Maria](#cenário-de-validação--maria)
- [ODS ONU Impactados](#ods-onu-impactados)

---

## Visão Geral

O Distrito Federal concentra **4,6 milhões de habitantes** em 33 Regiões Administrativas com transporte público centralizador: tudo passa pela Rodoviária do Plano Piloto, criando gargalos sistêmicos.

O MobiDF AI resolve isso com três algoritmos principais:

| Algoritmo | O que faz |
|---|---|
| **Terminal Virtual** | Sincroniza horários de linhas alimentadoras com troncais (tolerância ≤ 3 min) sem construir terminais físicos |
| **Roteamento Diametral** | Detecta fluxo pendular massivo (ex: Ceilândia → SIA) e sugere linhas diretas inter-RAs ao gestor |
| **Corte de Sobreposição Fantasma** | Identifica via PostGIS ônibus vazios no mesmo trajeto e horário, gerando economia direta |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                        MobiDF AI                            │
├──────────────┬──────────────────┬───────────────────────────┤
│   Frontend   │     Backend      │        Banco de Dados      │
│  Next.js 14  │   FastAPI        │   PostgreSQL + PostGIS     │
│  Tailwind    │   APScheduler    │   Geometrias geoespaciais  │
│  PWA         │   Async ETL      │   GTFS completo            │
└──────────────┴──────────────────┴───────────────────────────┘
        ↑                ↑                      ↑
        │          APIs Públicas                │
        │   GTFS/GTFS-RT (SEMOB-DF)            │
        │   IBGE Malha Censitária               │
        │   OpenStreetMap                       │
        └───────────────────────────────────────┘
```

**Pipeline ETL (automático via CRON):**
- `00:30` — GTFS estático (routes, trips, stops, stop_times, shapes)
- `30s` — GTFS-RT posições em tempo real
- `domingo 01:00` — IBGE malha censitária por RA
- `02:00` — Recálculo de sobreposições, scores e matriz O/D

---

## Funcionalidades

### Dashboard Gestor (SEMOB / B2G)

- **Corte de Sobreposição Fantasma** — detecta rotas com ≥30% de trajeto coincidente e conflito de horário. Cada corte gera economia estimada reinvestida automaticamente.
- **Reinvestimento Automático** — 60% → Wi-Fi | 30% → Ar-condicionado | 10% → Reserva operacional
- **Índice de Eficiência de Frota** — Score 0–100: `(Lotação + Sustentabilidade) − Ociosidade`
- **KPI "Tempo Salvo em Integração Sincronizada"** — métrica exclusiva para validar o Terminal Virtual
- **Roteamento Diametral** — painel de sugestões ordenado por impacto (horas salvas/dia × viagens/dia)

### App Cidadão (PWA Mobile-first)

- **Busca de paradas** com geocodificação e paradas próximas por GPS
- **Próximas viagens** com tempo real de chegada e barra de ocupação ao vivo
- **Reserva de Fluxo (Categoria Expressa)** — check-in digital antes de sair de casa, garantindo assento e alimentando o painel preditivo do gestor
- **Gestão de reservas** — lista, confirmação e cancelamento

---

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 14, React 18, Tailwind CSS, Recharts, Leaflet |
| Backend | Python 3.11, FastAPI, SQLAlchemy (async), APScheduler |
| Banco | PostgreSQL 15 + PostGIS 3.3 |
| ETL | GTFS-Kit, Pandas, psycopg2, protobuf (GTFS-RT) |
| Infra | Docker Compose |
| Dados | GTFS SEMOB-DF, API IBGE, OpenStreetMap |

---

## Como Rodar

### Pré-requisitos

- [Docker Desktop](https://docs.docker.com/get-docker/) instalado e rodando
- Git

### 1. Clone e configure

```bash
git clone https://github.com/FelipeJesusMartins/mobidf-ai.git
cd mobidf-ai
cp .env.example .env   # edite se necessário
```

### 2. Suba tudo com um comando

```bash
./start.sh
```

O script sobe **DB + Backend + Frontend simultaneamente**, aguarda o banco ficar saudável e exibe logs coloridos por serviço em tempo real.

```
./start.sh           # sobe tudo (imagens já buildadas)
./start.sh --build   # força rebuild completo
./start.sh --down    # para e remove todos os contêineres
```

### 3. Acesse

| Serviço | URL |
|---|---|
| **Backend API (Swagger)** | http://localhost:8000/docs |
| **Dashboard Gestor** | http://localhost:3000/gestor |
| **App Cidadão** | http://localhost:3000/cidadao |
| **PostgreSQL** | localhost:5432 (user: `mobidf`) |

### 4. Popular dados reais

Após subir, dispare o ETL GTFS manualmente no Dashboard ou via API:

```bash
curl -X POST http://localhost:8000/api/v1/gestor/etl/gtfs
```

---

## Estrutura do Projeto

```
mobidf-ai/
├── start.sh                    # Script único para subir tudo
├── docker-compose.yml
├── .env.example
│
├── database/
│   ├── 01_extensions.sql       # PostGIS, UUID, pg_trgm
│   ├── 02_tables.sql           # 14 tabelas GTFS + negócio
│   ├── 03_indexes.sql          # Índices GIST espaciais + B-tree
│   └── 04_functions.sql        # Funções PostGIS (overlap, sync, score)
│
├── backend/
│   └── app/
│       ├── main.py             # FastAPI + lifespan (scheduler)
│       ├── config.py
│       ├── database.py         # SQLAlchemy async engine
│       ├── models/             # ORM models
│       ├── etl/
│       │   ├── gtfs_ingestion.py   # Download + parse + ingestão GTFS
│       │   ├── ibge_ingestion.py   # Malha censitária por RA
│       │   └── scheduler.py        # CRON jobs APScheduler
│       ├── services/
│       │   ├── terminal_virtual.py     # Matchmaking alimentadora/troncal
│       │   ├── overlap_detection.py    # Corte de sobreposição (PostGIS)
│       │   ├── fleet_score.py          # Índice de eficiência 0–100
│       │   ├── diametral_routing.py    # Matriz O/D + sugestões diametrais
│       │   └── reinvestment.py         # Alocação automática de economia
│       └── routers/
│           ├── gestor.py       # /api/v1/gestor/*
│           └── cidadao.py      # /api/v1/cidadao/*
│
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx            # Landing page
        │   ├── gestor/page.tsx     # Dashboard SEMOB (desktop)
        │   └── cidadao/page.tsx    # App cidadão (PWA mobile)
        ├── components/
        │   ├── gestor/             # KPICard, FleetScore, Overlap, Diametral...
        │   └── cidadao/            # OccupancyBar
        └── lib/api.ts              # Client HTTP tipado
```

---

## API Reference

Documentação interativa disponível em **http://localhost:8000/docs** (Swagger UI).

### Endpoints principais

#### Gestor
| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/v1/gestor/dashboard` | Todos os KPIs em uma requisição |
| `GET` | `/api/v1/gestor/overlaps` | Lista sobreposições ativas |
| `PATCH` | `/api/v1/gestor/overlaps/{id}/resolve` | Corta linha sobreposta |
| `GET` | `/api/v1/gestor/terminal-virtual/kpi` | KPI Tempo Salvo |
| `GET` | `/api/v1/gestor/fleet-scores` | Score de eficiência por rota |
| `GET` | `/api/v1/gestor/diametral/suggestions` | Sugestões de rotas diametrais |
| `GET` | `/api/v1/gestor/reinvestment/current` | Reinvestimento do mês |
| `POST` | `/api/v1/gestor/etl/gtfs` | Dispara ETL manualmente |

#### Cidadão
| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/v1/cidadao/stops/search?q=` | Busca paradas por nome |
| `GET` | `/api/v1/cidadao/stops/nearby?lat=&lon=` | Paradas próximas por GPS |
| `GET` | `/api/v1/cidadao/trips/next?origin_stop_id=` | Próximas viagens com ocupação |
| `POST` | `/api/v1/cidadao/reservations` | Reserva de fluxo (Expressa) |
| `GET` | `/api/v1/cidadao/demo/maria` | Cenário de teste completo |

---

## Cenário de Validação — Maria

> *"Mora em Ceilândia e trabalha no SIA. Gasta 4h por dia e é forçada a fazer baldeação ineficiente no Plano Piloto."*

| Situação | Tempo | Baldeações |
|---|---|---|
| **Atual** | 120 min | 2 (Rodoviária PP obrigatória) |
| **Com Rota Diametral** | 85 min | 0 (Ceilândia → SIA direto) |
| **Com Terminal Virtual** | 95 min | 1 (máx. 3 min de espera) |

**Resultado:** −35 min por trajeto · +12,8h de vida devolvidas por mês · assento garantido via Reserva de Fluxo.

Teste o cenário: `GET /api/v1/cidadao/demo/maria`

---

## ODS ONU Impactados

| ODS | Como |
|---|---|
| **ODS 11** — Cidades Sustentáveis | Reduz congestionamento e tempo de deslocamento sem obras |
| **ODS 9** — Inovação | Eficiência BRT por software, sem infraestrutura física |
| **ODS 10** — Menos Desigualdades | Devolve tempo de vida ao morador de periferia |
| **ODS 13** — Ação Climática | Reduz uso de carro particular ao tornar o ônibus previsível |

---

## Licença

MIT — Felipe Jesus Martins © 2026
