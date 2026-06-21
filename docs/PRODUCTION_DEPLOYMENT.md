# Configuração de Produção

## Resumo

A produção está completamente configurada com:

✅ **Frontend** aponta para `https://mobidf.brocode.net.br/api`  
✅ **Backend** exposto apenas internamente (via nginx)  
✅ **PostgreSQL** acessível apenas na rede interna  
✅ **Resource limits** configurados para cada serviço  
✅ **CORS** restrito ao domínio de produção  

---

## Arquivos de Configuração

| Arquivo | Propósito |
|---------|----------|
| `.env` | Desenvolvimento local |
| `.env.production` | Produção (variáveis de ambiente) |
| `docker-compose.yml` | Configuração base |
| `docker-compose.prod.yml` | Overrides para produção |
| `infra/mobidf.brocode.net.br.conf` | Nginx reverse proxy |

---

## Como Iniciar em Produção

### 1. No Servidor de Produção

```bash
cd /home/deployer/mobidf-ai

# Usar .env.production (copiar para .env se necessário)
cp .env.production .env

# Editar .env com valores seguros
nano .env
# - POSTGRES_PASSWORD_PROD: senha segura
# - SECRET_KEY_PROD: chave segura gerada (ex: openssl rand -hex 32)
# - GOOGLE_MAPS_API_KEY_PROD: chave da API se necessário

# Iniciar com compose
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verificar saúde
docker-compose ps
docker-compose logs -f
```

### 2. Configurar Nginx

```bash
# Nginx já está configurado em infra/
# Copiar para /etc/nginx/conf.d/
sudo cp infra/mobidf.brocode.net.br.conf /etc/nginx/conf.d/

# Validar configuração
sudo nginx -t

# Recarregar nginx
sudo nginx -s reload
```

### 3. Solicitar Certificado Let's Encrypt

```bash
# Se usando certbot
sudo certbot certonly --standalone -d mobidf.brocode.net.br -d www.mobidf.brocode.net.br

# Ou usar setup-nginx.sh
cd infra
sudo ./setup-nginx.sh
```

---

## Fluxo de Requisições em Produção

### Frontend → Backend

```
Cliente Browser
      ↓
   HTTPS
      ↓
nginx (mobidf.brocode.net.br:443)
      ↓
location /api/
      ↓
proxy_pass http://localhost:8000/api/
      ↓
Backend FastAPI (porta 8000 - interna)
```

### URL na Prática

```
Cliente acessa:    https://mobidf.brocode.net.br/api/v1/gestor/dashboard
Nginx recebe:      /api/v1/gestor/dashboard
Nginx envia:       http://localhost:8000/api/v1/gestor/dashboard  ← sem remover /api
Backend recebe:    /api/v1/gestor/dashboard  ✓
Router prefix:     /api/v1
Handler final:     /gestor/dashboard  ✓
```

---

## Variáveis de Produção

### Backend

```env
CORS_ORIGINS=https://mobidf.brocode.net.br,https://www.mobidf.brocode.net.br
DEBUG=false
SECRET_KEY=<gerar com: openssl rand -hex 32>
```

### Frontend

```env
NEXT_PUBLIC_API_URL=https://mobidf.brocode.net.br/api
NODE_ENV=production
```

### Database

```env
POSTGRES_PASSWORD=<senha_segura>
POSTGRES_USER=mobidf
```

---

## Resource Limits (Produção)

| Serviço | CPU Limit | CPU Reservation | Memory Limit | Memory Reservation |
|---------|-----------|-----------------|--------------|-------------------|
| PostgreSQL | 2 CPUs | 1 CPU | 2 GB | 1 GB |
| Backend | 2 CPUs | 1 CPU | 1 GB | 512 MB |
| Frontend | 2 CPUs | 1 CPU | 512 MB | 256 MB |

Ajuste conforme necessidade da infraestrutura.

---

## Monitoramento em Produção

```bash
# Ver status dos containers
docker-compose ps

# Ver logs em tempo real
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# Verificar health checks
docker compose ps  # Coluna STATUS mostra health

# Usar curl para testar endpoints
curl https://mobidf.brocode.net.br/api/v1/etl/status
curl https://mobidf.brocode.net.br/health  # Backend health
```

---

## Backup em Produção

Ver [DATA_PERSISTENCE.md](DATA_PERSISTENCE.md) para estratégia de backup do PostgreSQL.

---

## Troubleshooting

### Backend não conecta ao PostgreSQL

```bash
# Verificar se PostgreSQL está healthy
docker-compose ps postgres

# Ver logs do backend
docker-compose logs backend

# Backend reconecta automaticamente quando DB fica pronto
```

### Nginx retorna 502 Bad Gateway

```bash
# Verificar se backend está rodando
docker-compose ps backend

# Ver logs do nginx
sudo journalctl -u nginx -f

# Ver configuração do nginx
sudo nginx -t
```

### CORS Error

```bash
# Verificar CORS_ORIGINS está correto em .env
grep CORS_ORIGINS .env

# Frontend pode precisar de reload
# Nginx cache pode estar interferindo
```

---

## Deployment via GitHub Actions

Quando você faz push para `main`:

1. ✅ GitHub Actions constrói as imagens
2. ✅ Publica para `ghcr.io`
3. ✅ Triggered self-hosted runner
4. ✅ Runner faz `docker-compose pull`
5. ✅ Atualiza containers com nova imagem

Ver `.github/workflows/build-and-deploy.yml` para detalhes.

---

## Checklist de Deploy

- [ ] `.env.production` configurado com senhas seguras
- [ ] PostgreSQL backup strategy em lugar
- [ ] Nginx SSL certificate válido
- [ ] DNS apontando para servidor
- [ ] Firewall permite portas 80/443
- [ ] GitHub self-hosted runner está registrado
- [ ] GitHub Actions secrets estão configurados
- [ ] Monitoramento/alertas configurados
- [ ] Logs centralizados (opcional)
