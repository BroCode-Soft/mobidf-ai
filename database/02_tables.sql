-- ============================================================
-- GTFS CORE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS agencies (
    agency_id     TEXT PRIMARY KEY,
    agency_name   TEXT NOT NULL,
    agency_url    TEXT,
    agency_timezone TEXT DEFAULT 'America/Sao_Paulo',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS routes (
    route_id      TEXT PRIMARY KEY,
    agency_id     TEXT REFERENCES agencies(agency_id),
    route_short_name TEXT,
    route_long_name  TEXT,
    route_type    INTEGER, -- 3 = ônibus
    route_color   TEXT DEFAULT 'FFFFFF',
    route_text_color TEXT DEFAULT '000000',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stops (
    stop_id       TEXT PRIMARY KEY,
    stop_code     TEXT,
    stop_name     TEXT NOT NULL,
    stop_desc     TEXT,
    -- PostGIS geography for accurate distance calculations
    geom          GEOGRAPHY(POINT, 4326) NOT NULL,
    stop_lat      DOUBLE PRECISION,
    stop_lon      DOUBLE PRECISION,
    location_type INTEGER DEFAULT 0,
    parent_station TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shapes (
    shape_id            TEXT NOT NULL,
    shape_pt_lat        DOUBLE PRECISION NOT NULL,
    shape_pt_lon        DOUBLE PRECISION NOT NULL,
    shape_pt_sequence   INTEGER NOT NULL,
    shape_dist_traveled DOUBLE PRECISION,
    PRIMARY KEY (shape_id, shape_pt_sequence)
);

CREATE TABLE IF NOT EXISTS shape_geoms (
    shape_id  TEXT PRIMARY KEY,
    geom      GEOMETRY(LINESTRING, 4326) NOT NULL
);

CREATE TABLE IF NOT EXISTS trips (
    trip_id       TEXT PRIMARY KEY,
    route_id      TEXT REFERENCES routes(route_id),
    service_id    TEXT NOT NULL,
    trip_headsign TEXT,
    direction_id  INTEGER, -- 0=ida, 1=volta
    shape_id      TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stop_times (
    trip_id        TEXT REFERENCES trips(trip_id),
    arrival_time   INTERVAL NOT NULL,
    departure_time INTERVAL NOT NULL,
    stop_id        TEXT REFERENCES stops(stop_id),
    stop_sequence  INTEGER NOT NULL,
    pickup_type    INTEGER DEFAULT 0,
    drop_off_type  INTEGER DEFAULT 0,
    PRIMARY KEY (trip_id, stop_sequence)
);

CREATE TABLE IF NOT EXISTS calendar (
    service_id  TEXT PRIMARY KEY,
    monday      BOOLEAN DEFAULT FALSE,
    tuesday     BOOLEAN DEFAULT FALSE,
    wednesday   BOOLEAN DEFAULT FALSE,
    thursday    BOOLEAN DEFAULT FALSE,
    friday      BOOLEAN DEFAULT FALSE,
    saturday    BOOLEAN DEFAULT FALSE,
    sunday      BOOLEAN DEFAULT FALSE,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL
);

-- ============================================================
-- REGIÕES ADMINISTRATIVAS DO DF (IBGE)
-- ============================================================

CREATE TABLE IF NOT EXISTS regioes_administrativas (
    ra_id         SERIAL PRIMARY KEY,
    ra_codigo     TEXT UNIQUE NOT NULL,
    ra_nome       TEXT NOT NULL,
    populacao     INTEGER,
    area_km2      DOUBLE PRECISION,
    densidade_pop DOUBLE PRECISION GENERATED ALWAYS AS (
        CASE WHEN area_km2 > 0 THEN populacao::DOUBLE PRECISION / area_km2 ELSE 0 END
    ) STORED,
    geom          GEOMETRY(MULTIPOLYGON, 4326),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ANÁLISE DE SOBREPOSIÇÃO (OVERLAP)
-- ============================================================

CREATE TABLE IF NOT EXISTS overlap_analysis (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id_a      TEXT REFERENCES routes(route_id),
    route_id_b      TEXT REFERENCES routes(route_id),
    overlap_pct     DOUBLE PRECISION, -- % do trajeto em comum
    overlap_km      DOUBLE PRECISION,
    horarios_conflito JSONB, -- [{departure_a, departure_b, delta_min}]
    passageiros_estimados INTEGER DEFAULT 0,
    economia_estimada_mensal NUMERIC(12,2) DEFAULT 0,
    status          TEXT DEFAULT 'ativo', -- ativo | arquivado | resolvido
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    CHECK (overlap_pct BETWEEN 0 AND 100)
);

-- ============================================================
-- TERMINAL VIRTUAL
-- ============================================================

CREATE TABLE IF NOT EXISTS virtual_terminals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stop_id         TEXT REFERENCES stops(stop_id),
    feeder_route_id TEXT REFERENCES routes(route_id),
    trunk_route_id  TEXT REFERENCES routes(route_id),
    feeder_trip_id  TEXT REFERENCES trips(trip_id),
    trunk_trip_id   TEXT REFERENCES trips(trip_id),
    feeder_arrival  INTERVAL NOT NULL,
    trunk_departure INTERVAL NOT NULL,
    wait_minutes    DOUBLE PRECISION GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (trunk_departure - feeder_arrival)) / 60
    ) STORED,
    sync_score      DOUBLE PRECISION, -- 0-100, 100 = perfeita sincronia
    is_synchronized BOOLEAN DEFAULT FALSE,
    valid_on        TEXT[], -- ['monday','tuesday',...]
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MATRIZ ORIGEM-DESTINO
-- ============================================================

CREATE TABLE IF NOT EXISTS od_matrix (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    origin_ra_id    INTEGER REFERENCES regioes_administrativas(ra_id),
    dest_ra_id      INTEGER REFERENCES regioes_administrativas(ra_id),
    trips_daily     INTEGER DEFAULT 0,
    peak_hour       INTEGER, -- hora pico (0-23)
    avg_duration_min DOUBLE PRECISION,
    current_route_ids TEXT[],
    has_direct_route BOOLEAN DEFAULT FALSE,
    diametral_suggested BOOLEAN DEFAULT FALSE,
    time_saved_min   DOUBLE PRECISION DEFAULT 0,
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RESERVA DE FLUXO (CIDADÃO)
-- ============================================================

CREATE TABLE IF NOT EXISTS flow_reservations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_token      TEXT NOT NULL, -- hash anônimo do usuário
    trip_id         TEXT REFERENCES trips(trip_id),
    origin_stop_id  TEXT REFERENCES stops(stop_id),
    dest_stop_id    TEXT REFERENCES stops(stop_id),
    travel_date     DATE NOT NULL,
    departure_time  INTERVAL NOT NULL,
    status          TEXT DEFAULT 'confirmado', -- confirmado | cancelado | embarcado
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCORE DE EFICIÊNCIA DE FROTA
-- ============================================================

CREATE TABLE IF NOT EXISTS fleet_scores (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id        TEXT REFERENCES routes(route_id),
    calc_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    lotacao_score   DOUBLE PRECISION, -- 0-40 pts
    sustentabilidade_score DOUBLE PRECISION, -- 0-30 pts
    ociosidade_penalty     DOUBLE PRECISION, -- 0-30 pts
    total_score     DOUBLE PRECISION GENERATED ALWAYS AS (
        LEAST(100, GREATEST(0, COALESCE(lotacao_score,0) + COALESCE(sustentabilidade_score,0) - COALESCE(ociosidade_penalty,0)))
    ) STORED,
    reservations_count INTEGER DEFAULT 0,
    overlap_count      INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (route_id, calc_date)
);

-- ============================================================
-- REINVESTIMENTO AUTOMÁTICO
-- ============================================================

CREATE TABLE IF NOT EXISTS reinvestment_ledger (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    economia_bruta  NUMERIC(14,2) NOT NULL DEFAULT 0,
    alocacao_wifi   NUMERIC(14,2) NOT NULL DEFAULT 0,
    alocacao_ac     NUMERIC(14,2) NOT NULL DEFAULT 0,
    alocacao_reserva NUMERIC(14,2) NOT NULL DEFAULT 0,
    overlap_routes_corrigidas INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GTFS-RT (POSIÇÕES EM TEMPO REAL)
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicle_positions (
    vehicle_id   TEXT NOT NULL,
    trip_id      TEXT,
    route_id     TEXT,
    geom         GEOGRAPHY(POINT, 4326),
    bearing      DOUBLE PRECISION,
    speed_kmh    DOUBLE PRECISION,
    occupancy    INTEGER DEFAULT 0, -- 0=vazio, 1=cheio, 2=lotado
    captured_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (vehicle_id, captured_at)
) PARTITION BY RANGE (captured_at);

CREATE TABLE vehicle_positions_current PARTITION OF vehicle_positions
    FOR VALUES FROM (NOW() - INTERVAL '1 day') TO (NOW() + INTERVAL '1 day');

-- ============================================================
-- ETL CONTROL
-- ============================================================

CREATE TABLE IF NOT EXISTS etl_runs (
    id          SERIAL PRIMARY KEY,
    source      TEXT NOT NULL, -- gtfs | gtfs_rt | ibge | osm
    status      TEXT NOT NULL DEFAULT 'running', -- running | success | failed
    records_in  INTEGER DEFAULT 0,
    records_out INTEGER DEFAULT 0,
    error_msg   TEXT,
    started_at  TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);
