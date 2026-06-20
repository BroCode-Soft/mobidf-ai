from sqlalchemy import Column, Text, Integer, Double, Boolean, DateTime, Date, Interval, ARRAY, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from geoalchemy2 import Geography, Geometry
from sqlalchemy.sql import func
import uuid

from app.database import Base


class Agency(Base):
    __tablename__ = "agencies"
    agency_id = Column(Text, primary_key=True)
    agency_name = Column(Text, nullable=False)
    agency_url = Column(Text)
    agency_timezone = Column(Text, default="America/Sao_Paulo")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Route(Base):
    __tablename__ = "routes"
    route_id = Column(Text, primary_key=True)
    agency_id = Column(Text)
    route_short_name = Column(Text)
    route_long_name = Column(Text)
    route_type = Column(Integer)
    route_color = Column(Text, default="FFFFFF")
    route_text_color = Column(Text, default="000000")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Stop(Base):
    __tablename__ = "stops"
    stop_id = Column(Text, primary_key=True)
    stop_code = Column(Text)
    stop_name = Column(Text, nullable=False)
    stop_desc = Column(Text)
    geom = Column(Geography("POINT", srid=4326), nullable=False)
    stop_lat = Column(Double)
    stop_lon = Column(Double)
    location_type = Column(Integer, default=0)
    parent_station = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Trip(Base):
    __tablename__ = "trips"
    trip_id = Column(Text, primary_key=True)
    route_id = Column(Text)
    service_id = Column(Text, nullable=False)
    trip_headsign = Column(Text)
    direction_id = Column(Integer)
    shape_id = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class StopTime(Base):
    __tablename__ = "stop_times"
    trip_id = Column(Text, primary_key=True)
    stop_sequence = Column(Integer, primary_key=True)
    arrival_time = Column(Interval, nullable=False)
    departure_time = Column(Interval, nullable=False)
    stop_id = Column(Text)
    pickup_type = Column(Integer, default=0)
    drop_off_type = Column(Integer, default=0)


class Shape(Base):
    __tablename__ = "shapes"
    shape_id = Column(Text, primary_key=True)
    shape_pt_sequence = Column(Integer, primary_key=True)
    shape_pt_lat = Column(Double, nullable=False)
    shape_pt_lon = Column(Double, nullable=False)
    shape_dist_traveled = Column(Double)


class ShapeGeom(Base):
    __tablename__ = "shape_geoms"
    shape_id = Column(Text, primary_key=True)
    geom = Column(Geometry("LINESTRING", srid=4326), nullable=False)


class OverlapAnalysis(Base):
    __tablename__ = "overlap_analysis"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_id_a = Column(Text)
    route_id_b = Column(Text)
    overlap_pct = Column(Double)
    overlap_km = Column(Double)
    horarios_conflito = Column(JSONB)
    passageiros_estimados = Column(Integer, default=0)
    economia_estimada_mensal = Column(Numeric(12, 2), default=0)
    status = Column(Text, default="ativo")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class VirtualTerminal(Base):
    __tablename__ = "virtual_terminals"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stop_id = Column(Text)
    feeder_route_id = Column(Text)
    trunk_route_id = Column(Text)
    feeder_trip_id = Column(Text)
    trunk_trip_id = Column(Text)
    feeder_arrival = Column(Interval, nullable=False)
    trunk_departure = Column(Interval, nullable=False)
    sync_score = Column(Double)
    is_synchronized = Column(Boolean, default=False)
    valid_on = Column(ARRAY(Text))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ODMatrix(Base):
    __tablename__ = "od_matrix"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    origin_ra_id = Column(Integer)
    dest_ra_id = Column(Integer)
    trips_daily = Column(Integer, default=0)
    peak_hour = Column(Integer)
    avg_duration_min = Column(Double)
    current_route_ids = Column(ARRAY(Text))
    has_direct_route = Column(Boolean, default=False)
    diametral_suggested = Column(Boolean, default=False)
    time_saved_min = Column(Double, default=0)
    updated_at = Column(DateTime(timezone=True), server_default=func.now())


class FlowReservation(Base):
    __tablename__ = "flow_reservations"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_token = Column(Text, nullable=False)
    trip_id = Column(Text)
    origin_stop_id = Column(Text)
    dest_stop_id = Column(Text)
    travel_date = Column(Date, nullable=False)
    departure_time = Column(Interval, nullable=False)
    status = Column(Text, default="confirmado")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class FleetScore(Base):
    __tablename__ = "fleet_scores"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_id = Column(Text)
    calc_date = Column(Date, nullable=False)
    lotacao_score = Column(Double)
    sustentabilidade_score = Column(Double)
    ociosidade_penalty = Column(Double)
    reservations_count = Column(Integer, default=0)
    overlap_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ReinvestmentLedger(Base):
    __tablename__ = "reinvestment_ledger"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)
    economia_bruta = Column(Numeric(14, 2), nullable=False, default=0)
    alocacao_wifi = Column(Numeric(14, 2), nullable=False, default=0)
    alocacao_ac = Column(Numeric(14, 2), nullable=False, default=0)
    alocacao_reserva = Column(Numeric(14, 2), nullable=False, default=0)
    overlap_routes_corrigidas = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class RegiaAdministrativa(Base):
    __tablename__ = "regioes_administrativas"
    ra_id = Column(Integer, primary_key=True)
    ra_codigo = Column(Text, unique=True, nullable=False)
    ra_nome = Column(Text, nullable=False)
    populacao = Column(Integer)
    area_km2 = Column(Double)
    geom = Column(Geometry("MULTIPOLYGON", srid=4326))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class VehiclePosition(Base):
    __tablename__ = "vehicle_positions_current"
    vehicle_id = Column(Text, primary_key=True)
    captured_at = Column(DateTime(timezone=True), primary_key=True, server_default=func.now())
    trip_id = Column(Text)
    route_id = Column(Text)
    geom = Column(Geography("POINT", srid=4326))
    bearing = Column(Double)
    speed_kmh = Column(Double)
    occupancy = Column(Integer, default=0)
