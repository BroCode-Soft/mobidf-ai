# Infrastructure Configuration - MobiDF AI

## Nginx Reverse Proxy Setup

This directory contains configuration for running MobiDF AI behind an nginx reverse proxy, exposing the application at `mobidf.brocode.net.br` and `mobidf.brocode.net.br/api`.

### Files

- **mobidf.brocode.net.br.conf** — Nginx server configuration (reverse proxy + SSL)
- **setup-nginx.sh** — Automated setup script (installs nginx, certbot, configures SSL)
- **README.md** — This file

### Quick Start (Recommended - Automated)

```bash
cd infra
sudo chmod +x setup-nginx.sh
sudo ./setup-nginx.sh
```

This will:
1. ✅ Install nginx and certbot if not present
2. ✅ Copy configuration to `/etc/nginx/sites-available/`
3. ✅ Enable the site (symlink to `/etc/nginx/sites-enabled/`)
4. ✅ Request Let's Encrypt certificate for `mobidf.brocode.net.br`
5. ✅ Configure automatic SSL renewal
6. ✅ Reload nginx

### Manual Setup (If Automated Fails)

#### 1. Install nginx and certbot

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

#### 2. Copy configuration

```bash
sudo cp infra/mobidf.brocode.net.br.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/mobidf.brocode.net.br.conf /etc/nginx/sites-enabled/
```

#### 3. Request SSL certificate

```bash
sudo certbot --nginx -d mobidf.brocode.net.br -d www.mobidf.brocode.net.br
```

#### 4. Verify and reload

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Architecture

```
User Request
    ↓
Internet: mobidf.brocode.net.br:443 (HTTPS)
    ↓
Nginx Reverse Proxy (localhost:80/443)
    ├─ Location / → Frontend (localhost:3000)
    └─ Location /api/ → Backend (localhost:8000)
    ↓
Docker Containers (internal network)
    ├─ mobidf-frontend:3000 (Next.js)
    ├─ mobidf-backend:8000 (FastAPI)
    └─ mobidf-postgres:5432 (PostgreSQL)
```

### Accessing the Application

After setup, access at:

- **Frontend**: https://mobidf.brocode.net.br
- **Backend API**: https://mobidf.brocode.net.br/api
- **API Docs**: https://mobidf.brocode.net.br/api/docs
- **Health Check**: https://mobidf.brocode.net.br/health

### Nginx Configuration Features

#### Security
- ✅ TLS 1.2 + 1.3
- ✅ HSTS (HTTP Strict Transport Security)
- ✅ X-Frame-Options SAMEORIGIN
- ✅ X-Content-Type-Options nosniff
- ✅ X-XSS-Protection enabled
- ✅ Referrer-Policy configured

#### Performance
- ✅ HTTP/2
- ✅ Keep-alive connections
- ✅ Gzip compression
- ✅ SSL session caching
- ✅ Upstream keep-alive

#### Reliability
- ✅ WebSocket support
- ✅ Buffering disabled (streaming support)
- ✅ Upstream health checking ready
- ✅ 100M client body size limit

### SSL Certificate Management

#### Automatic Renewal (Let's Encrypt)

Certbot automatically creates a systemd timer for renewal:

```bash
# Check renewal status
sudo certbot renew --dry-run

# View timer
sudo systemctl list-timers certbot
```

#### Manual Certificate

If using a manually obtained certificate:

1. Place certificate files in a directory (e.g., `/etc/ssl/certs/mobidf/`)
2. Update paths in `mobidf.brocode.net.br.conf`:
   ```nginx
   ssl_certificate /path/to/fullchain.pem;
   ssl_certificate_key /path/to/privkey.pem;
   ```
3. Test and reload:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### Troubleshooting

#### Nginx won't start/reload

```bash
# Check syntax
sudo nginx -t

# View detailed error
sudo systemctl status nginx

# Check logs
sudo tail -f /var/log/nginx/mobidf.error.log
```

#### Certificate renewal fails

```bash
# Manual renewal
sudo certbot renew --verbose

# Check renewal logs
sudo cat /var/log/letsencrypt/letsencrypt.log

# Request new cert if needed
sudo certbot certonly --nginx -d mobidf.brocode.net.br -d www.mobidf.brocode.net.br
```

#### Backend/Frontend not accessible

```bash
# Check Docker services running
docker-compose ps

# Test connectivity to backends
curl http://localhost:3000
curl http://localhost:8000/health

# Check nginx logs
sudo tail -f /var/log/nginx/mobidf.access.log
sudo tail -f /var/log/nginx/mobidf.error.log

# Test reverse proxy
curl -H "Host: mobidf.brocode.net.br" http://localhost/health
```

#### CORS issues

The nginx config includes CORS headers by default. Ensure:

1. Backend `CORS_ORIGINS` includes `https://mobidf.brocode.net.br`:
   ```bash
   CORS_ORIGINS=https://mobidf.brocode.net.br
   ```

2. Or use the production compose override:
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

### Monitoring

#### Access logs
```bash
sudo tail -f /var/log/nginx/mobidf.access.log
```

#### Error logs
```bash
sudo tail -f /var/log/nginx/mobidf.error.log
```

#### Active connections
```bash
curl -s http://localhost:8080/nginx_status  # requires stub_status module
```

### High Availability / Load Balancing

To add multiple backend instances, update `mobidf.brocode.net.br.conf`:

```nginx
upstream mobidf_backend {
    server backend-1:8000;
    server backend-2:8000;
    server backend-3:8000;
    keepalive 32;
}
```

Then Docker Compose service scaling:
```bash
docker-compose up -d --scale backend=3
```

### DNS Configuration

Update your DNS provider (e.g., Route53, Namecheap) to point to your server:

```
mobidf.brocode.net.br    A       <your-server-ip>
www.mobidf.brocode.net.br  CNAME  mobidf.brocode.net.br
```

Verify:
```bash
nslookup mobidf.brocode.net.br
dig +short mobidf.brocode.net.br
```

### Production Deployment Checklist

- [ ] DNS configured and resolving
- [ ] Firewall allows ports 80 and 443
- [ ] Nginx installed and running
- [ ] SSL certificate installed (Let's Encrypt or manual)
- [ ] Docker services running with production config:
  ```bash
  docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
  ```
- [ ] Backend accessible at `/health`
- [ ] Frontend accessible at `/`
- [ ] SSL certificate valid: `openssl s_client -connect mobidf.brocode.net.br:443`
- [ ] Logs monitored and rotating
- [ ] Backup strategy for volumes (postgres_data, backend_data, frontend_cache)

### Support

For issues or questions:
1. Check logs: `/var/log/nginx/mobidf.{access,error}.log`
2. Test connectivity: `curl -v https://mobidf.brocode.net.br/health`
3. Validate config: `sudo nginx -t`
4. Review GitHub Issues: https://github.com/BroCode-Soft/mobidf-ai/issues
