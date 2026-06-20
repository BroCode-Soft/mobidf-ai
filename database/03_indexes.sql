-- Spatial indexes (GIST) para PostGIS
CREATE INDEX IF NOT EXISTS idx_stops_geom ON stops USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_shape_geoms_geom ON shape_geoms USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_ra_geom ON regioes_administrativas USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_vehicle_positions_geom ON vehicle_positions USING GIST (geom);

-- B-tree indexes para joins frequentes
CREATE INDEX IF NOT EXISTS idx_stop_times_trip ON stop_times (trip_id);
CREATE INDEX IF NOT EXISTS idx_stop_times_stop ON stop_times (stop_id);
CREATE INDEX IF NOT EXISTS idx_trips_route ON trips (route_id);
CREATE INDEX IF NOT EXISTS idx_trips_shape ON trips (shape_id);
CREATE INDEX IF NOT EXISTS idx_overlap_routes ON overlap_analysis (route_id_a, route_id_b);
CREATE INDEX IF NOT EXISTS idx_vt_stop ON virtual_terminals (stop_id);
CREATE INDEX IF NOT EXISTS idx_vt_sync ON virtual_terminals (is_synchronized);
CREATE INDEX IF NOT EXISTS idx_reservations_trip_date ON flow_reservations (trip_id, travel_date);
CREATE INDEX IF NOT EXISTS idx_fleet_scores_route_date ON fleet_scores (route_id, calc_date DESC);
CREATE INDEX IF NOT EXISTS idx_od_matrix_pair ON od_matrix (origin_ra_id, dest_ra_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_positions_time ON vehicle_positions (captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_positions_route ON vehicle_positions (route_id, captured_at DESC);
