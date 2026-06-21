# Data Persistence Guide - MobiDF AI

## Overview

MobiDF AI uses Docker volumes to ensure data persists between container restarts and deployments. This guide explains how data is managed and how to back it up.

## Volumes

### 1. postgres_data
**Purpose**: PostgreSQL database persistent storage

- **Mount point**: `/var/lib/postgresql/data` (inside container)
- **Contents**: All GTFS data, user data, system tables, indexes
- **Size**: Depends on GTFS dataset (typically 500MB - 2GB)
- **Persistence**: ✅ Persistent across `docker-compose down/up` and deployments

**Backup:**
```bash
# Backup PostgreSQL data
docker run --rm --volumes-from mobidf-postgres \
  -v $(pwd)/backups:/backup \
  postgres:17 \
  tar czf /backup/postgres_data_$(date +%Y%m%d_%H%M%S).tar.gz \
  -C /var/lib/postgresql data

# Or use pg_dump
docker exec mobidf-postgres pg_dump -U mobidf -d mobidf > backups/mobidf_$(date +%Y%m%d_%H%M%S).sql
```

**Restore:**
```bash
# From backup file
docker exec -i mobidf-postgres psql -U mobidf -d mobidf < backups/mobidf_TIMESTAMP.sql

# Or restore full volume
docker run --rm --volumes-from mobidf-postgres \
  -v $(pwd)/backups:/backup \
  postgres:17 \
  tar xzf /backup/postgres_data_TIMESTAMP.tar.gz -C /var/lib/postgresql
```

---

### 2. backend_data
**Purpose**: Backend application data, ETL artifacts, and cache

- **Mount point**: `/app/data` (inside container)
- **Contents**: 
  - ETL downloads (GTFS, IBGE data)
  - Temporary processing files
  - Application cache
  - Uploaded files
- **Size**: Depends on ETL frequency (typically 1-5GB)
- **Persistence**: ✅ Persistent across deployments

**Backup:**
```bash
# Backup backend data
docker run --rm --volumes-from mobidf-backend \
  -v $(pwd)/backups:/backup \
  alpine \
  tar czf /backup/backend_data_$(date +%Y%m%d_%H%M%S).tar.gz \
  -C /app data
```

**Restore:**
```bash
docker run --rm --volumes-from mobidf-backend \
  -v $(pwd)/backups:/backup \
  alpine \
  tar xzf /backup/backend_data_TIMESTAMP.tar.gz -C /app
```

**Note**: If ETL fails, delete old data to force re-download:
```bash
docker exec mobidf-backend rm -rf /app/data/gtfs_*
docker exec mobidf-backend rm -rf /app/data/ibge_*
```

---

### 3. frontend_cache
**Purpose**: Next.js build cache for faster rebuilds

- **Mount point**: `/app/.next/cache` (inside container)
- **Contents**: Next.js build artifacts and cache
- **Size**: Typically 100-500MB
- **Persistence**: ✅ Improves build performance on rebuilds
- **Cleanup-safe**: Can be deleted without data loss (rebuilds automatically)

**Cleanup:**
```bash
# Remove cache (will rebuild on next start)
docker volume rm mobidf-ai_frontend_cache
```

---

## Data Consistency Across Deployments

### Automatic Persistence

Docker volumes are automatically persisted when using `docker-compose`:

```bash
# Stop containers (data persists)
docker-compose down

# Start again (data is restored automatically)
docker-compose up -d
```

### Verify Data Persistence

```bash
# List volumes
docker volume ls | grep mobidf

# Inspect volume
docker volume inspect mobidf-ai_postgres_data

# Check volume location
docker volume inspect mobidf-ai_postgres_data --format='{{.Mountpoint}}'

# Check disk usage
du -sh /var/lib/docker/volumes/mobidf-ai_*/_data/
```

---

## Disaster Recovery

### Full Backup Strategy

Automated daily backups:

```bash
#!/bin/bash
# backup-mobidf.sh
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup PostgreSQL
docker exec mobidf-postgres pg_dump -U mobidf -d mobidf | \
  gzip > "$BACKUP_DIR/postgres_$TIMESTAMP.sql.gz"

# Backup backend data
docker run --rm --volumes-from mobidf-backend \
  -v "$(pwd)/$BACKUP_DIR:/backup" \
  alpine \
  tar czf "/backup/backend_data_$TIMESTAMP.tar.gz" -C /app data

echo "✓ Backups completed: $BACKUP_DIR/"
```

Schedule with cron:
```bash
# Add to crontab (crontab -e)
0 2 * * * cd ~/mobidf-ai && ./backup-mobidf.sh
```

### Remote Backup (S3, Azure, etc.)

```bash
#!/bin/bash
# backup-to-s3.sh
BACKUP_DIR="./backups"
S3_BUCKET="s3://mobidf-backups"

# Backup to local first
./backup-mobidf.sh

# Sync to S3
aws s3 sync "$BACKUP_DIR" "$S3_BUCKET" --delete
```

---

## Volume Cleanup & Maintenance

### Remove Unused Volumes

```bash
# Remove only unused volumes
docker volume prune

# Remove all volumes (WARNING: DATA LOSS!)
docker volume prune -a
```

### Resize Volume (if running out of space)

**Note**: Cannot resize Docker volumes directly. Solution:

```bash
# 1. Backup the volume
docker run --rm --volumes-from mobidf-postgres \
  -v $(pwd)/backup:/backup \
  postgres:17 \
  tar czf /backup/postgres_full.tar.gz -C /var/lib/postgresql data

# 2. Remove old volume
docker volume rm mobidf-ai_postgres_data

# 3. Create new volume
docker volume create mobidf-ai_postgres_data

# 4. Restore from backup
docker run --rm --volumes-from mobidf-postgres \
  -v $(pwd)/backup:/backup \
  postgres:17 \
  tar xzf /backup/postgres_full.tar.gz -C /var/lib/postgresql
```

---

## Monitoring & Alerts

### Check Volume Usage

```bash
# Check PostgreSQL data size
docker exec mobidf-postgres du -sh /var/lib/postgresql/data

# Check backend data size
docker exec mobidf-backend du -sh /app/data

# Check total volumes usage
df -h /var/lib/docker/volumes/
```

### Alert if Usage High

```bash
#!/bin/bash
# Check if postgres_data is >80% of available space
USAGE=$(docker exec mobidf-postgres du -s /var/lib/postgresql/data | cut -f1)
THRESHOLD=$((2000000)) # 2GB in KB

if [ $USAGE -gt $THRESHOLD ]; then
  echo "⚠️  PostgreSQL data usage high: $(( USAGE / 1024 ))MB"
  # Send alert, cleanup old data, etc.
fi
```

---

## Production Checklist

- [ ] Volumes created and mounted correctly: `docker volume ls`
- [ ] Backup strategy defined and tested
- [ ] Backup location verified: `du -sh /var/lib/docker/volumes/mobidf-ai_*`
- [ ] PostgreSQL data persists: `docker-compose down && docker-compose up -d`
- [ ] Restore procedure tested: successfully restored from backup
- [ ] Monitoring in place for volume usage
- [ ] Automated daily backups running: `crontab -l`
- [ ] Off-site backup configured: S3, Azure, or similar

---

## Troubleshooting

### Volume appears empty after restart

```bash
# Check if volume has data
docker volume inspect mobidf-ai_postgres_data

# Check mount point
docker run --rm -v mobidf-ai_postgres_data:/data alpine ls -la /data

# If empty, restore from backup
# See "Restore" section above
```

### Can't delete volume in use

```bash
# Find containers using the volume
docker ps -a | grep mobidf

# Stop containers
docker-compose down

# Remove volume
docker volume rm mobidf-ai_postgres_data
```

### Slow database performance

Volume may be fragmented or slow disk:

```bash
# Check IOPS
fio --name=sequential-read --ioengine=libaio --iodepth=32 \
    --rw=read --bs=4k --direct=1 --size=1G \
    --filename=/var/lib/docker/volumes/mobidf-ai_postgres_data/_data/test
```

---

## References

- Docker Volumes: https://docs.docker.com/storage/volumes/
- PostgreSQL Backups: https://www.postgresql.org/docs/current/backup.html
- Docker Compose Volumes: https://docs.docker.com/compose/compose-file/compose-file-v3/#volumes
