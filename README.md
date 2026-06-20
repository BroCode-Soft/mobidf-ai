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
