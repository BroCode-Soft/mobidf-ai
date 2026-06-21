# Routing Correction - Final Documentation

## Date: 2026-06-21
## Status: ✅ COMPLETE

---

## Problem Statement

The routing between frontend, nginx, and backend needed to be consistent:
- All `/api/*` requests should route to the backend
- All root `/` requests should route to the frontend  
- Path prefixes should be consistent throughout

## Solution Implemented

### 1. Backend Routes (Consistent `/api/v1`)

**File**: [backend/app/main.py](backend/app/main.py)

```python
# Routers registered at /api/v1 prefix
app.include_router(gestor.router, prefix="/api/v1")     # /api/v1/gestor/*
app.include_router(cidadao.router, prefix="/api/v1")    # /api/v1/cidadao/*

# Health check at root
@app.get("/health")
async def health():
    return {"status": "ok"}

# ETL status at /api/v1
@app.get("/api/v1/etl/status")
async def etl_status():
    ...
```

**Result**: Backend receives all routes with `/api/v1` prefix

### 2. Nginx Routing (Pass `/api/` Through)

**File**: [infra/mobidf.brocode.net.br.conf](infra/mobidf.brocode.net.br.conf)

```nginx
# Frontend - Root location
location / {
    proxy_pass http://mobidf_frontend;  # → localhost:3000
}

# Backend - API location
location /api/ {
    proxy_pass http://mobidf_backend/api/;  # Passes /api/ THROUGH intacto
}
```

**Result**: 
- `/` → frontend:3000
- `/api/*` → backend:8000/api/*

### 3. Request Path Consistency

**Frontend** constructs URLs as:
```typescript
const url = `${BASE}/api/v1${path}`
// Example: https://mobidf.brocode.net.br/api/v1/gestor/dashboard
```

**End-to-End Flow**:
```
Frontend:  /api/v1/gestor/dashboard
    ↓ (HTTPS to nginx)
Nginx:     /api/v1/gestor/dashboard (matches /api/ location)
    ↓ (proxy_pass http://mobidf_backend/api/)
Backend:   /api/v1/gestor/dashboard (received)
    ↓ (router prefix="/api/v1" matches)
Handler:   /gestor/dashboard (within router)
    ↓ (response)
Success:   HTTP 200 ✓
```

---

## Changes Made

| File | Change | Reason |
|------|--------|--------|
| [backend/app/main.py](backend/app/main.py) | Confirmed routers at `/api/v1` | Consistent path throughout |
| [infra/mobidf.brocode.net.br.conf](infra/mobidf.brocode.net.br.conf) | Changed `proxy_pass` from `/` to `/api/` | Pass `/api/v1` prefix through |
| [run.sh](run.sh) | Updated health check path | Use `/api/v1/gestor/dashboard` |
| [docs/API_ROUTING.md](docs/API_ROUTING.md) | Created comprehensive guide | Document routing behavior |

---

## Routing Matrix

| Layer | Path | Example |
|-------|------|---------|
| **External** | `/api/v1/...` | `https://mobidf.brocode.net.br/api/v1/gestor/dashboard` |
| **Nginx** | `/api/v1/...` → `/api/v1/...` | Passes through intacto |
| **Backend** | `/api/v1/...` | FastAPI router matches and handles |

---

## Request Examples

### Development (Direct Backend)
```bash
# No nginx, direct backend access
curl http://localhost:8000/api/v1/gestor/dashboard

# Backend receives: /api/v1/gestor/dashboard ✓
```

### Production (Via Nginx)
```bash
# Via nginx reverse proxy
curl https://mobidf.brocode.net.br/api/v1/gestor/dashboard

# Flow:
# 1. Nginx receives: /api/v1/gestor/dashboard
# 2. Nginx forwards: http://localhost:8000/api/v1/gestor/dashboard
# 3. Backend receives: /api/v1/gestor/dashboard ✓
```

---

## Testing Checklist

- [x] Nginx configuration valid: `sudo nginx -t`
- [x] Backend routers registered at `/api/v1`
- [x] Frontend API requests use `/api/v1` prefix
- [x] Nginx routes `/` to frontend
- [x] Nginx routes `/api/` to backend
- [x] Path prefix `/api/v1` is consistent throughout
- [x] Health check path correct: `/api/v1/etl/status`
- [x] Documentation complete and accurate

---

## Deployment Impact

**No breaking changes**:
- ✅ Existing frontend code works as-is
- ✅ Existing backend routes work as-is
- ✅ Nginx configuration is standard reverse proxy pattern
- ✅ Development and production routing are consistent

---

## Documentation

Complete routing guide: [docs/API_ROUTING.md](docs/API_ROUTING.md)

Includes:
- 3-layer routing architecture
- Frontend to backend flow
- Development vs production setups
- Testing and debugging procedures
- Troubleshooting guide

---

## Summary

✨ **Routing is now consistent and unified**:
- Frontend always uses `/api/v1/...` paths
- Nginx correctly routes `/api/` to backend and `/` to frontend
- Backend receives consistent `/api/v1/...` paths
- Both development and production work correctly

**Status**: Ready for deployment ✓
