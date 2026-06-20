# MobiDF AI

> **Mobilidade urbana inteligente para o Distrito Federal — 0% de obras, 100% de dados.**

SaaS B2G que resolve o gargalo logístico do DF via análise geoespacial, sincronização GTFS em tempo real e predição de fluxo — superando a eficiência de sistemas BRT físicos, por software.

---

## Sumário

- [Visão Geral](#visão-geral)
- [Algoritmos Centrais](#algoritmos-centrais)
- [Como Rodar](#como-rodar)
- [Arquitetura](#arquitetura)
- [Stack Técnica](#stack-técnica)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [API Reference](#api-reference)
- [Cenário Maria](#cenário-de-validação--maria)
- [ODS ONU](#ods-onu-impactados)

---

## Visão Geral

O DF concentra **4,6 milhões de habitantes** em 33 Regiões Administrativas com transporte centralizador: tudo passa pela Rodoviária do Plano Piloto, criando gargalos sistêmicos.

O MobiDF AI resolve isso com três algoritmos sobre dados públicos já existentes (GTFS-SEMOB, IBGE, OSM) — sem nenhuma obra ou hardware adicional.

---

## Algoritmos Centrais

| Algoritmo | Problema | Solução |
|---|---|---|
| **Terminal Virtual** | Passageiros perdem conexões por falta de sincronização entre linhas | Matchmaking feeder→troncal com tolerância ≤ 3 min via GTFS-RT |
| **Roteamento Diametral** | Ceilândia → SIA exige 2 baldeações no Plano Piloto | Matriz O/D detecta pares com ≥ 500 viagens/dia sem linha direta |
| **Corte Fantasma** | Ônibus vazios disputam o mesmo trajeto e horário | PostGIS detecta ≥ 30% de sobreposição geográfica + conflito de schedule |

**Reinvestimento automático:** cada linha cortada gera economia reinvestida em 60% Wi-Fi, 30% AC e 10% reserva operacional.

---

## Como Rodar

**Pré-requisitos:** Python 3.9+ e Node.js 18+. Nada mais.

```bash
git clone https://github.com/FelipeJesusMartins/mobidf-ai.git
cd mobidf-ai
./run.sh
```

O script faz tudo automaticamente:
- Cria o virtualenv Python (`.venv/`) se não existir
- Instala `fastapi` e `uvicorn` se necessário
- Instala dependências npm se `node_modules/` não existir
- Sobe API mock + frontend em paralelo com logs coloridos

```bash
./run.sh                      # iniciar tudo
./run.sh --install            # forçar reinstalação de deps
./run.sh --port-api 9000      # mudar porta da API
./run.sh --port-web 4000      # mudar porta do frontend
```

#### URLs

| Serviço | URL |
|---|---|
| Landing | http://localhost:3000 |
| Dashboard Gestor | http://localhost:3000/gestor |
| App Cidadão (PWA) | http://localhost:3000/cidadao |
| Swagger / Docs | http://localhost:8000/docs |

> O mock inclui dados pré-carregados: 4 sobreposições, 6 terminais virtuais, 7 scores de frota, 5 rotas diametrais e o cenário completo da Maria. Sem banco de dados, sem Docker, sem configuração.

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                          MobiDF AI                              │
├────────────────┬───────────────────┬────────────────────────────┤
│   Frontend     │     Backend       │      Banco de Dados        │
│  Next.js 14    │   FastAPI         │  PostgreSQL 15 + PostGIS   │
│  Tailwind CSS  │   APScheduler     │  Geometrias GIST-indexed   │
│  Framer Motion │   SQLAlchemy      │  GTFS completo + partições │
│  Radix UI      │   Async ETL       │                            │
└────────────────┴───────────────────┴────────────────────────────┘
         ↑                  ↑
         │        Fontes de dados públicos
         │   GTFS/GTFS-RT — SEMOB-DF (horários, posições)
         │   API IBGE v3  — Malha censitária das 33 RAs
         │   OpenStreetMap — Validação geográfica
```

**Pipeline ETL (agendado via APScheduler):**

| Horário | Job |
|---|---|
| `00:30` | GTFS estático — routes, trips, stops, stop_times, shapes |
| `a cada 30s` | GTFS-RT — posições em tempo real dos veículos |
| `domingo 01:00` | IBGE — malha censitária das Regiões Administrativas |
| `02:00` | Recálculo — sobreposições, scores de frota e matriz O/D |

---

## Stack Técnica

| Camada | Tecnologia |
|---|---|
| **Frontend** | Next.js 14, React 18, Tailwind CSS, Framer Motion, Radix UI, Recharts |
| **Backend** | Python 3.11, FastAPI, SQLAlchemy (async), APScheduler |
| **Banco** | PostgreSQL 15 + PostGIS 3.3, particionamento por data |
| **ETL** | Pandas, psycopg2, protobuf (GTFS-RT), httpx |
| **Demo** | mock_server.py — FastAPI in-memory, zero configuração |
| **Infra** | run.sh — orquestra venv + npm nativamente (sem Docker) |
| **Dados** | GTFS SEMOB-DF, API IBGE v3, OpenStreetMap |

---

## Estrutura do Projeto

```
mobidf-ai/
│
├── mock_server.py              ← Backend demo (FastAPI in-memory)
├── run.sh                      ← Inicia API + frontend com um comando
├── .env.example
│
├── database/
│   ├── 01_extensions.sql       ← PostGIS, UUID, pg_trgm
│   ├── 02_tables.sql           ← 14 tabelas (GTFS + negócio)
│   ├── 03_indexes.sql          ← Índices GIST espaciais + B-tree
│   └── 04_functions.sql        ← Funções PostGIS core
│                                  detect_route_overlaps(min_overlap_pct)
│                                  calc_fleet_score(route_id, date)
│                                  calc_reinvestment(start, end, cost)
│
├── backend/
│   └── app/
│       ├── main.py             ← FastAPI + lifespan (scheduler init)
│       ├── etl/
│       │   ├── gtfs_ingestion.py    ← Download ZIP + parse + bulk insert
│       │   ├── ibge_ingestion.py    ← Malha censitária 33 RAs
│       │   └── scheduler.py         ← APScheduler jobs
│       ├── services/
│       │   ├── terminal_virtual.py  ← Matchmaking feeder/troncal ≤ 3min
│       │   ├── overlap_detection.py ← Corte fantasma via PostGIS
│       │   ├── fleet_score.py       ← Score 0-100 por rota
│       │   ├── diametral_routing.py ← Matriz O/D + sugestões
│       │   └── reinvestment.py      ← Alocação de economia
│       └── routers/
│           ├── gestor.py       ← /api/v1/gestor/*
│           └── cidadao.py      ← /api/v1/cidadao/*
│
└── frontend/
    └── src/
        ├── app/
        │   ├── page.tsx            ← Landing (hero animado)
        │   ├── gestor/page.tsx     ← Mission Control (sidebar + 5 painéis)
        │   └── cidadao/page.tsx    ← Transit Pulse (PWA mobile-first)
        └── lib/
            ├── api.ts              ← HTTP client tipado (todos os endpoints)
            └── utils.ts            ← cn() helper (clsx + tailwind-merge)
```

---

## API Reference

Documentação interativa completa em **http://localhost:8000/docs**.

### Gestor

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/v1/gestor/dashboard` | Todos os KPIs em uma requisição |
| `GET` | `/api/v1/gestor/overlaps` | Lista sobreposições (filtro por status) |
| `PATCH` | `/api/v1/gestor/overlaps/{id}/resolve` | Corta linha sobreposta |
| `GET` | `/api/v1/gestor/terminal-virtual` | Pares sincronizados |
| `GET` | `/api/v1/gestor/terminal-virtual/kpi` | KPI tempo salvo |
| `GET` | `/api/v1/gestor/fleet-scores` | Score de eficiência por rota |
| `GET` | `/api/v1/gestor/fleet-scores/summary` | Resumo frota (médio, críticos) |
| `GET` | `/api/v1/gestor/diametral/suggestions` | Sugestões de rotas diametrais |
| `GET` | `/api/v1/gestor/diametral/od-heatmap` | Heatmap da matriz O/D |
| `GET` | `/api/v1/gestor/reinvestment/current` | Reinvestimento do mês atual |
| `GET` | `/api/v1/gestor/reinvestment/history` | Histórico mensal |
| `POST` | `/api/v1/gestor/etl/gtfs` | Dispara ETL manualmente |

### Cidadão

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/v1/cidadao/stops/search?q=` | Busca paradas por nome |
| `GET` | `/api/v1/cidadao/stops/nearby?lat=&lon=` | Paradas próximas por GPS |
| `GET` | `/api/v1/cidadao/trips/next?origin_stop_id=` | Próximas viagens + ocupação |
| `GET` | `/api/v1/cidadao/occupancy/{trip_id}` | Ocupação em tempo real |
| `POST` | `/api/v1/cidadao/reservations` | Reserva de fluxo (Expressa) |
| `GET` | `/api/v1/cidadao/reservations?user_identifier=` | Lista reservas do usuário |
| `DELETE` | `/api/v1/cidadao/reservations/{id}` | Cancela reserva |
| `GET` | `/api/v1/cidadao/demo/maria` | Cenário de teste completo |

---

## Cenário de Validação — Maria

> *"Mora em Ceilândia Norte, trabalha no SIA. Gasta 4h por dia em ônibus com 2 baldeações obrigatórias no Plano Piloto."*

| | Situação Atual | Com Rota Diametral | Com Terminal Virtual |
|---|---|---|---|
| **Tempo total** | ~120 min | **85 min** | 95 min |
| **Baldeações** | 2 | 0 | 1 (≤ 3 min espera) |
| **Tempo salvo/dia** | — | **35 min** | 25 min |
| **Horas devolvidas/mês** | — | **+12,8h** | +9,2h |
| **Economia mensal** | — | **R$ 90** | R$ 60 |

Teste o cenário completo:

```bash
curl http://localhost:8000/api/v1/cidadao/demo/maria
```

---

## ODS ONU Impactados

| ODS | Impacto |
|---|---|
| **11** Cidades Sustentáveis | Reduz congestionamento e tempo de deslocamento, sem obras |
| **9** Indústria e Inovação | Eficiência BRT por software — zero infraestrutura física |
| **10** Menos Desigualdades | Devolve horas de vida ao morador de periferia |
| **13** Ação Climática | Torna o ônibus previsível, reduzindo uso do carro particular |

---

## Licença

MIT — Felipe Jesus Martins © 2026
