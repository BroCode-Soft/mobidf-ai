-- ============================================================
-- Materializa geometrias de shape a partir dos pontos GTFS
-- ============================================================
CREATE OR REPLACE FUNCTION build_shape_geoms() RETURNS void AS $$
BEGIN
    INSERT INTO shape_geoms (shape_id, geom)
    SELECT
        shape_id,
        ST_MakeLine(
            ST_SetSRID(ST_MakePoint(shape_pt_lon, shape_pt_lat), 4326)
            ORDER BY shape_pt_sequence
        ) AS geom
    FROM shapes
    GROUP BY shape_id
    ON CONFLICT (shape_id) DO UPDATE SET geom = EXCLUDED.geom;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Detecta sobreposição entre pares de rotas
-- Retorna pares com sobreposição >= min_overlap_pct
-- ============================================================
CREATE OR REPLACE FUNCTION detect_route_overlaps(min_overlap_pct DOUBLE PRECISION DEFAULT 30.0)
RETURNS TABLE (
    route_id_a TEXT,
    route_id_b TEXT,
    overlap_km DOUBLE PRECISION,
    overlap_pct DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    WITH route_shapes AS (
        SELECT DISTINCT ON (t.route_id)
            t.route_id,
            sg.geom
        FROM trips t
        JOIN shape_geoms sg ON sg.shape_id = t.shape_id
        WHERE sg.geom IS NOT NULL
        ORDER BY t.route_id, t.trip_id
    ),
    pairs AS (
        SELECT
            a.route_id AS rid_a,
            b.route_id AS rid_b,
            a.geom AS geom_a,
            b.geom AS geom_b,
            ST_Length(ST_Intersection(
                ST_Buffer(a.geom::geography, 50)::geometry,
                ST_Buffer(b.geom::geography, 50)::geometry
            )::geography) / 1000 AS inter_km,
            ST_Length(a.geom::geography) / 1000 AS len_a_km
        FROM route_shapes a
        JOIN route_shapes b ON a.route_id < b.route_id
        WHERE ST_DWithin(a.geom::geography, b.geom::geography, 500)
    )
    SELECT
        rid_a,
        rid_b,
        ROUND(inter_km::numeric, 2)::double precision,
        ROUND((inter_km / NULLIF(len_a_km, 0) * 100)::numeric, 2)::double precision
    FROM pairs
    WHERE (inter_km / NULLIF(len_a_km, 0) * 100) >= min_overlap_pct
    ORDER BY (inter_km / NULLIF(len_a_km, 0) * 100) DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Calcula sincronização do Terminal Virtual
-- Para cada parada de baldeação, encontra pares alimentadora/troncal
-- dentro de 3 min de tolerância
-- ============================================================
CREATE OR REPLACE FUNCTION calc_virtual_terminal_sync(tolerance_min INT DEFAULT 3)
RETURNS TABLE (
    stop_id TEXT,
    feeder_route TEXT,
    trunk_route TEXT,
    feeder_trip TEXT,
    trunk_trip TEXT,
    feeder_arr INTERVAL,
    trunk_dep INTERVAL,
    wait_min DOUBLE PRECISION,
    sync_score DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    WITH feeder_arrivals AS (
        SELECT
            st.stop_id,
            t.route_id,
            t.trip_id,
            st.arrival_time
        FROM stop_times st
        JOIN trips t ON t.trip_id = st.trip_id
        JOIN routes r ON r.route_id = t.route_id
        JOIN stops s ON s.stop_id = st.stop_id
        -- alimentadoras: rotas locais (distância > 10km do Plano Piloto)
        WHERE ST_Distance(
            s.geom::geography,
            ST_SetSRID(ST_MakePoint(-47.9297, -15.7801), 4326)::geography
        ) > 10000
    ),
    trunk_departures AS (
        SELECT
            st.stop_id,
            t.route_id,
            t.trip_id,
            st.departure_time
        FROM stop_times st
        JOIN trips t ON t.trip_id = st.trip_id
        JOIN stops s ON s.stop_id = st.stop_id
        -- troncais: rotas que passam próximas ao Plano Piloto (distância <= 10km)
        WHERE ST_Distance(
            s.geom::geography,
            ST_SetSRID(ST_MakePoint(-47.9297, -15.7801), 4326)::geography
        ) <= 10000
    )
    SELECT
        f.stop_id,
        f.route_id,
        tr.route_id,
        f.trip_id,
        tr.trip_id,
        f.arrival_time,
        tr.departure_time,
        EXTRACT(EPOCH FROM (tr.departure_time - f.arrival_time)) / 60,
        CASE
            WHEN EXTRACT(EPOCH FROM (tr.departure_time - f.arrival_time)) / 60 BETWEEN 0 AND tolerance_min
            THEN 100.0 - (EXTRACT(EPOCH FROM (tr.departure_time - f.arrival_time)) / 60 / tolerance_min * 30)
            ELSE 0
        END
    FROM feeder_arrivals f
    JOIN trunk_departures tr ON tr.stop_id = f.stop_id
    WHERE tr.departure_time > f.arrival_time
      AND EXTRACT(EPOCH FROM (tr.departure_time - f.arrival_time)) / 60 <= tolerance_min;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Score de eficiência de frota por rota
-- Score = (Lotação + Sustentabilidade) - Ociosidade
-- ============================================================
CREATE OR REPLACE FUNCTION calc_fleet_score(p_route_id TEXT, p_date DATE DEFAULT CURRENT_DATE)
RETURNS DOUBLE PRECISION AS $$
DECLARE
    v_reservations   INTEGER;
    v_overlap_count  INTEGER;
    v_lotacao        DOUBLE PRECISION;
    v_sustentabilidade DOUBLE PRECISION;
    v_ociosidade     DOUBLE PRECISION;
    v_score          DOUBLE PRECISION;
BEGIN
    -- Reservas como proxy de lotação (0-40pts)
    SELECT COUNT(*) INTO v_reservations
    FROM flow_reservations
    WHERE trip_id IN (SELECT trip_id FROM trips WHERE route_id = p_route_id)
      AND travel_date = p_date
      AND status = 'confirmado';

    v_lotacao := LEAST(40.0, v_reservations * 0.5);

    -- Sustentabilidade: penaliza sobreposições não resolvidas (0-30pts)
    SELECT COUNT(*) INTO v_overlap_count
    FROM overlap_analysis
    WHERE (route_id_a = p_route_id OR route_id_b = p_route_id)
      AND status = 'ativo';

    v_sustentabilidade := GREATEST(0, 30.0 - v_overlap_count * 10);

    -- Ociosidade: penalidade (0-30pts)
    v_ociosidade := CASE
        WHEN v_reservations < 5  THEN 30.0
        WHEN v_reservations < 15 THEN 15.0
        WHEN v_reservations < 30 THEN 5.0
        ELSE 0.0
    END;

    v_score := GREATEST(0, LEAST(100, v_lotacao + v_sustentabilidade - v_ociosidade));

    INSERT INTO fleet_scores (route_id, calc_date, lotacao_score, sustentabilidade_score, ociosidade_penalty, reservations_count, overlap_count)
    VALUES (p_route_id, p_date, v_lotacao, v_sustentabilidade, v_ociosidade, v_reservations, v_overlap_count)
    ON CONFLICT (route_id, calc_date) DO UPDATE
    SET lotacao_score = EXCLUDED.lotacao_score,
        sustentabilidade_score = EXCLUDED.sustentabilidade_score,
        ociosidade_penalty = EXCLUDED.ociosidade_penalty,
        reservations_count = EXCLUDED.reservations_count,
        overlap_count = EXCLUDED.overlap_count;

    RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Calcula reinvestimento automático do período
-- 60% Wi-Fi, 30% Ar-condicionado, 10% reserva
-- ============================================================
CREATE OR REPLACE FUNCTION calc_reinvestment(p_start DATE, p_end DATE, custo_por_rota_mes NUMERIC DEFAULT 8500)
RETURNS UUID AS $$
DECLARE
    v_rotas_cortadas INTEGER;
    v_economia       NUMERIC;
    v_id             UUID;
BEGIN
    SELECT COUNT(*) INTO v_rotas_cortadas
    FROM overlap_analysis
    WHERE status = 'resolvido'
      AND created_at::DATE BETWEEN p_start AND p_end;

    v_economia := v_rotas_cortadas * custo_por_rota_mes;

    INSERT INTO reinvestment_ledger (
        period_start, period_end,
        economia_bruta,
        alocacao_wifi,
        alocacao_ac,
        alocacao_reserva,
        overlap_routes_corrigidas
    ) VALUES (
        p_start, p_end,
        v_economia,
        v_economia * 0.60,
        v_economia * 0.30,
        v_economia * 0.10,
        v_rotas_cortadas
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;
