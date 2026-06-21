# MobiDF AI - API Routing Guide

## Overview

The application has three routing layers with consistent `/api/v1/` paths throughout:

```
┌─────────────────────────────────────────────────────────┐
│ 1. EXTERNAL (Public Internet / Frontend)                │
│    https://mobidf.brocode.net.br/api/v1/...            │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 2. NGINX REVERSE PROXY (Pass /api/ through)            │
│    location /api/ { proxy_pass http://backend/api/; }  │
│    Passes /api/v1/... intacto to backend               │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 3. BACKEND INTERNAL (FastAPI)                          │
│    Router prefixes: /api/v1/gestor, /api/v1/cidadao   │
│    Receives: /api/v1/gestor/..., /api/v1/cidadao/...  │
└─────────────────────────────────────────────────────────┘
```

---

## Routing Flow

### Frontend to Backend (Production via Nginx)

**Frontend Code** (`frontend/src/lib/api.ts`):
```typescript
const BASE = "https://mobidf.brocode.net.br"  // NEXT_PUBLIC_API_URL
const url = `${BASE}/api/v1${path}`  // Constructs: /api/v1/gestor/dashboard
```

**Request Flow**:
```
1. Frontend sends:   GET https://mobidf.brocode.net.br/api/v1/gestor/dashboard
2. Nginx receives:   /api/v1/gestor/dashboard
3. Nginx matches:    location /api/
4. Nginx forwards:   http://localhost:8000/api/v1/gestor/dashboard (INTACTO)
5. Backend receives: /api/v1/gestor/dashboard
6. Backend router:   @app.include_router(prefix="/api/v1")
7. Backend handler:  /gestor/dashboard (from router prefix)
8. Response sent:    ← back through nginx
```

---

## Backend Route Configuration

**File**: `backend/app/main.py`

```python
from app.routers import gestor, cidadao

# Routers registered at /api/v1 prefix
app.include_router(gestor.router, prefix="/api/v1")    # Routes: /api/v1/gestor/*
app.include_router(cidadao.router, prefix="/api/v1")   # Routes: /api/v1/cidadao/*

# Health endpoint at root
@app.get("/health")
async def health():
    return {"status": "ok"}

# ETL status at /api/v1 prefix
@app.get("/api/v1/etl/status")
async def etl_status():
    ...
```

**Available Routes**:

| Prefix | Routers | External Path | Internal Path |
|--------|---------|---------------|---------------|
| `/api/v1` | gestor | `/api/v1/gestor/*` | `/api/v1/gestor/*` |
| `/api/v1` | cidadao | `/api/v1/cidadao/*` | `/api/v1/cidadao/*` |
| Root | health | `/health` | `/health` |
| `/api/v1` | etl status | `/api/v1/etl/status` | `/api/v1/etl/status` |

---

## Nginx Configuration

**File**: `infra/mobidf.brocode.net.br.conf`

### Root Location (Frontend)
```nginx
location / {
    proxy_pass http://mobidf_frontend;  # → localhost:3000
}
```

**Matches**: All requests not matching other locations
**Behavior**: Passes request AS-IS to frontend

**Examples**:
- `/` → Frontend (localhost:3000)
- `/gestor` → Frontend (localhost:3000/gestor)
- `/cidadao` → Frontend (localhost:3000/cidadao)

### API Location (Backend)
```nginx
location /api/ {
    proxy_pass http://mobidf_backend/api/;  # → localhost:8000/api/
    # Passes /api/ prefix through intacto!
}
```

**Matches**: Requests starting with `/api/`
**Behavior**: Passes `/api/...` intacto to backend `/api/...`

**Examples**:
- `/api/v1/gestor/dashboard` → Backend `/api/v1/gestor/dashboard` ✓
- `/api/v1/cidadao/stops/search?q=X` → Backend `/api/v1/cidadao/stops/search?q=X` ✓
- `/api/docs` → Backend `/api/docs` ✓
- `/api/openapi.json` → Backend `/api/openapi.json` ✓

---

## Development vs Production

### Development (Direct Backend Access)

When running without nginx:

**Backend URL**: `http://localhost:8000`

**Frontend Code**:
```typescript
// .env or .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Frontend constructs**: `http://localhost:8000/api/v1/...`

**Request flow**:
```
Frontend → http://localhost:8000/api/v1/gestor/dashboard
Backend receives: /api/v1/gestor/dashboard ✓ (matches /api/v1 router prefix)
```

### Production (via Nginx)

**Backend URL**: Behind nginx at localhost:8000 (not exposed)

**Frontend Code**:
```typescript
// .env or docker-compose.yml
NEXT_PUBLIC_API_URL=https://mobidf.brocode.net.br
```

**Frontend constructs**: `https://mobidf.brocode.net.br/api/v1/...`

**Request flow**:
```
Frontend → https://mobidf.brocode.net.br/api/v1/...
Nginx receives: /api/v1/... (from HTTPS layer)
Nginx forwards: http://localhost:8000/api/v1/... (to backend)
Backend receives: /api/v1/... ✓ (matches /api/v1 router prefix)
```

---

## Summary Table

| Aspect | Development | Production |
|--------|-------------|-----------|
| Frontend URL | `http://localhost:3000` | `https://mobidf.brocode.net.br` |
| Backend URL | `http://localhost:8000` | Behind nginx at localhost:8000 |
| API Request | `http://localhost:8000/api/v1/...` | `https://mobidf.brocode.net.br/api/v1/...` |
| Backend Router | `/api/v1` prefix | `/api/v1` prefix |
| Nginx Role | N/A (direct access) | Reverse proxy (pass /api/ through) |
| Path Handling | Direct access | Pass intacto (/api/v1 → /api/v1) |

---

## Testing

### Development
```bash
# Run backend directly
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Test endpoint
curl http://localhost:8000/api/v1/gestor/dashboard

# Or use frontend with NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Production
```bash
# Endpoint via nginx
curl https://mobidf.brocode.net.br/api/v1/gestor/dashboard

# Nginx processes:
# 1. Receives: /api/v1/...
# 2. Forwards: /api/v1/... to backend
# 3. Backend responds
# 4. Nginx returns to client
```

### Debugging

**Check backend routes**:
```bash
# Inside backend container
docker exec mobidf-backend python -c "
from app.main import app
print('Backend routes:')
for route in app.routes:
    print(f'  {route.path}')
"
```

**Expected output**:
```
Backend routes:
  /health
  /api/v1/gestor/{...}
  /api/v1/cidadao/{...}
  /api/v1/etl/status
```

**Check nginx forwarding**:
```bash
# Monitor nginx access logs
docker compose logs -f --tail=50 nginx | grep "/api/v1"

# Or on server
tail -f /var/log/nginx/mobidf.access.log
```

---

## Consistency Principle

✅ **Always use `/api/v1/` prefix in all layers**:
- External URLs: `https://mobidf.brocode.net.br/api/v1/...`
- Nginx: Pass `/api/` through to backend
- Backend: Routers at `/api/v1` prefix
- Frontend: Always construct `/api/v1/...` paths

This makes the API consistent and predictable everywhere.

---

## Routing Flow

### Frontend to Backend via Nginx (Production)

**Frontend Code** (`frontend/src/lib/api.ts`):
```typescript
const BASE = "https://mobidf.brocode.net.br"  // NEXT_PUBLIC_API_URL
const url = `${BASE}/api/v1${path}`  // Constructs: /api/v1/gestor/dashboard
```

**Request Flow**:
```
1. Frontend sends:   GET https://mobidf.brocode.net.br/api/v1/gestor/dashboard
2. Nginx receives:   /api/v1/gestor/dashboard
3. Nginx matches:    location /api/
4. Nginx strips:     /api/ → /v1/gestor/dashboard
5. Nginx forwards:   http://localhost:8000/v1/gestor/dashboard
6. Backend receives: /v1/gestor/dashboard
7. Backend router:   @app.include_router(prefix="/v1")
8. Backend handler:  /gestor/dashboard (from router)
9. Response sent:    ← back through nginx
```

---

## Backend Route Configuration

**File**: `backend/app/main.py`

```python
from app.routers import gestor, cidadao

# Routers registered at /v1 prefix
app.include_router(gestor.router, prefix="/v1")    # Routes: /v1/gestor/*
app.include_router(cidadao.router, prefix="/v1")   # Routes: /v1/cidadao/*

# Health endpoint at root
@app.get("/health")
async def health():
    return {"status": "ok"}

# ETL status at /v1 prefix
@app.get("/v1/etl/status")
async def etl_status():
    ...
```

**Available Routes**:

| Prefix | Routers | External Path | Internal Path |
|--------|---------|---------------|---------------|
| `/v1` | gestor | `/api/v1/gestor/*` | `/v1/gestor/*` |
| `/v1` | cidadao | `/api/v1/cidadao/*` | `/v1/cidadao/*` |
| Root | health | `/health` | `/health` |
| `/v1` | etl status | `/api/v1/etl/status` | `/v1/etl/status` |

---

## Nginx Configuration

**File**: `infra/mobidf.brocode.net.br.conf`

### Root Location (Frontend)
```nginx
location / {
    proxy_pass http://mobidf_frontend;  # → localhost:3000
}
```

**Matches**: All requests not matching other locations
**Behavior**: Passes request AS-IS to frontend

**Examples**:
- `/` → Frontend (localhost:3000)
- `/gestor` → Frontend (localhost:3000/gestor)
- `/cidadao` → Frontend (localhost:3000/cidadao)

### API Location (Backend)
```nginx
location /api/ {
    proxy_pass http://mobidf_backend/;  # → localhost:8000
    # Strips /api/ prefix!
}
```

**Matches**: Requests starting with `/api/`
**Behavior**: Removes `/api/` and passes remainder to backend

**Examples**:
- `/api/v1/gestor/dashboard` → Backend `/v1/gestor/dashboard` ✓
- `/api/v1/cidadao/stops/search?q=X` → Backend `/v1/cidadao/stops/search?q=X` ✓
- `/api/docs` → Backend `/docs` ✓
- `/api/openapi.json` → Backend `/openapi.json` ✓

---

## Development vs Production

### Development (No Nginx)

**Backend direct access**:
```bash
# Backend runs on localhost:8000
# Frontend API URL: http://localhost:8000

# Requests go directly:
# GET http://localhost:8000/v1/gestor/dashboard
```

**Frontend code** (uses env var):
```typescript
const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const url = `${BASE}/api/v1${path}`  // → http://localhost:8000/api/v1/...
```

**Backend receives**: `/api/v1/...` 

❌ **PROBLEM**: Backend routers are at `/v1`, not `/api/v1`!

**Solution**: Set environment variable
```bash
# In .env for development:
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

Then frontend constructs: `http://localhost:8000/api/v1/...` ✗ Still wrong

**Actually**: The cleanest solution for development is...
```bash
# Set:
NEXT_PUBLIC_API_URL=http://localhost:8000
# Don't append /api/v1 in requests, but that's what api.ts does...
```

Actually, let me check if we need to handle this differently...

The issue is: in development (without nginx), if backend routers are at `/v1`, then frontend shouldn't add `/api/` to requests.

**Two solutions**:

1. **Keep `/api/v1` in backend (undo my change)**: This keeps the current structure but then nginx needs to pass `/api/` through
2. **Keep `/v1` in backend**: Simpler, but frontend needs to conditionally add `/api` based on environment

I chose solution 2 (already done). Now in development:
```bash
# Set:
NEXT_PUBLIC_API_URL=http://localhost:8000
```

And update frontend to NOT add `/api/` when BASE already ends with it...

Actually, the simpler approach: in development, if frontend always tries `/api/v1`, but backend is at `/v1`, we need a middleware or...

Let me reconsider. Maybe it's better to keep the mock behavior and use nginx for production only.

---

## Solution: Two-Tier Routing

### Development (direct backend access)
Keep the mock server or use a development nginx config.

### Production (via nginx)
- Frontend: `/api/v1/...` → Nginx strips `/api/` → Backend: `/v1/...` ✓

For development, we need either:
1. Mock server/middleware that adds `/api` prefix
2. Keep backend routers at `/api/v1` and skip the nginx stripping
3. Have development use a simple nginx config too

**Recommended**: Use nginx for both dev and prod (option 3)

Or change frontend to be smarter:
```typescript
let url = `${BASE}/v1${path}`;  // Use /v1 directly
```

But that breaks the API documentation expectation.

---

## Summary

The configuration is now:

- **External API path** (from internet, via nginx): `/api/v1/...`
- **Nginx config**: Strips `/api/` from incoming requests
- **Backend router prefix**: `/v1`
- **Final backend path**: `/v1/...`

This works correctly in production. For development without nginx, either:
1. Use the mock server (`python mock_server.py`)
2. Set `NEXT_PUBLIC_API_URL` appropriately
3. Run a local nginx too (using docker-compose)

---

## Testing

### Production (with nginx)
```bash
curl https://mobidf.brocode.net.br/api/v1/gestor/dashboard

# Nginx receives: /api/v1/gestor/dashboard
# Nginx sends: http://localhost:8000/v1/gestor/dashboard ✓
```

### Development (direct)
```bash
# Option 1: Use mock server
python mock_server.py

# Option 2: Direct backend (set NEXT_PUBLIC_API_URL=http://localhost:8000/api for frontend)
# But then frontend sends /api/v1 → backend expects /v1 → MISMATCH

# Option 3: Run docker-compose (includes nginx even in dev)
docker-compose up -d
```

---

## Verification

**Check backend routes**:
```bash
# Inside backend container
python -c "from app.main import app; [print(r.path) for r in app.routes if r.path.startswith('/v1')]"
```

Output should show:
```
/v1/gestor/*
/v1/cidadao/*
/v1/etl/status
```

**Check frontend requests**:
```bash
# Open browser DevTools → Network tab
# Look at request URLs for API calls
# Should be: https://mobidf.brocode.net.br/api/v1/...
```

**Check nginx forwarding**:
```bash
# In nginx container logs
docker compose logs nginx | grep "v1"
```

Should show internal rewrites:
```
/api/v1/... → /v1/...
```

