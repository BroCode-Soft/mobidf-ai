#!/bin/bash
# Database initialization script for PostgreSQL with PostGIS
# This script is automatically executed when the PostgreSQL container starts
# via the docker-entrypoint-initdb.d mechanism

set -e

echo "=== MobiDF Database Initialization ==="

# All SQL files are applied in alphabetical order by docker-entrypoint-initdb.d:
# 1. 01_extensions.sql     - Enable PostGIS and other extensions
# 2. 02_tables.sql         - Create main tables (agencies, routes, stops, etc.)
# 3. 03_indexes.sql        - Create indexes for performance
# 4. 04_functions.sql      - Create stored procedures (overlaps, virtual terminals, etc.)

# The Docker PostgreSQL image will automatically:
# - Load *.sql files from /docker-entrypoint-initdb.d/
# - Execute them in lexicographic order
# - As the user specified in POSTGRES_INITDB_ARGS or default

echo "✓ Extensions, tables, indexes, and functions will be initialized automatically"
echo "✓ Database name: $POSTGRES_DB"
echo "✓ Database user: $POSTGRES_USER"
