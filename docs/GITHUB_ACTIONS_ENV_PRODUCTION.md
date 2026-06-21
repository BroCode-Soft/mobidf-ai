# GitHub Actions Deploy com .env.production

## 🎯 Resumo

O GitHub Actions workflow agora **cria e carrega automaticamente** o arquivo `.env.production` durante o deploy em produção usando os **GitHub Secrets**.

---

## 🔄 Fluxo Completo

### 1. **GitHub Actions Workflow** (build-and-deploy.yml)

```yaml
deploy-to-self-hosted:
  - name: Configure production environment (.env.production)
    # Cria .env.production com secrets do GitHub
    # POSTGRES_PASSWORD=${{ secrets.POSTGRES_PASSWORD_PROD }}
    # SECRET_KEY=${{ secrets.SECRET_KEY_PROD }}
    # GOOGLE_MAPS_API_KEY=${{ secrets.GOOGLE_MAPS_API_KEY }}
    
  - name: Pull latest images
    # docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
    
  - name: Restart services
    # docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    # ↓
    # docker-compose.prod.yml carrega: .env.production ✓
```

### 2. **Docker Compose** (docker-compose.prod.yml)

```yaml
version: '3.8'

services:
  postgres:
    env_file:
      - .env.production  ← Carrega automaticamente
    
  backend:
    env_file:
      - .env.production  ← Carrega automaticamente
    
  frontend:
    env_file:
      - .env.production  ← Carrega automaticamente
```

### 3. **Resultado nos Containers**

```bash
✓ PostgreSQL: POSTGRES_PASSWORD (do secret)
✓ Backend: CORS_ORIGINS (de produção)
✓ Frontend: NEXT_PUBLIC_API_URL (de produção)
```

---

## 🔑 GitHub Secrets Necessários

Configure estes 3 secrets em **Settings > Secrets and variables > Actions**:

| Secret | Valor | Comando |
|--------|-------|---------|
| `POSTGRES_PASSWORD_PROD` | Senha forte | `openssl rand -hex 32` |
| `SECRET_KEY_PROD` | JWT secret | `openssl rand -hex 32` |
| `GOOGLE_MAPS_API_KEY` | Sua chave | (opcional) |

---

## 📋 O que acontece no Deploy

1. **Código é pushed para `main`**
   ```bash
   git push origin main
   ```

2. **GitHub Actions é acionado**
   - Build backend image
   - Build frontend image
   - Push para ghcr.io

3. **Self-hosted runner executa**
   ```bash
   # Step 1: Cria .env.production com secrets
   cat > .env.production << EOF
   POSTGRES_PASSWORD=${{ secrets.POSTGRES_PASSWORD_PROD }}
   SECRET_KEY=${{ secrets.SECRET_KEY_PROD }}
   GOOGLE_MAPS_API_KEY=${{ secrets.GOOGLE_MAPS_API_KEY }}
   # ... outras variáveis
   EOF
   
   # Step 2: Pull das imagens
   docker compose -f docker-compose.yml -f docker-compose.prod.yml pull
   
   # Step 3: Restart com .env.production
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

4. **Containers iniciam carregando .env.production automaticamente** ✅

---

## ✔️ Validação

### Local (testar o build)

```bash
# Simular o workflow localmente
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verificar que carregou .env.production
docker exec mobidf-backend env | grep CORS_ORIGINS
# Esperado: https://mobidf.brocode.net.br

docker exec mobidf-postgres env | grep POSTGRES_PASSWORD
# Esperado: seu_secret_aqui
```

### No Servidor (após deploy automático)

```bash
# Ver arquivo criado
cat /home/deployer/mobidf-ai/.env.production | head -10

# Verificar variáveis nos containers
docker exec mobidf-backend env | grep "CORS_ORIGINS\|DEBUG"

# Testar se backend está respondendo
curl https://mobidf.brocode.net.br/api/v1/etl/status
```

---

## 📊 Comparação: Dev vs Prod

| Variável | Desenvolvimento | Produção |
|----------|-----------------|----------|
| **CORS_ORIGINS** | http://localhost:3000 | https://mobidf.brocode.net.br |
| **NEXT_PUBLIC_API_URL** | http://localhost:8000 | https://mobidf.brocode.net.br/api |
| **NODE_ENV** | development | production |
| **DEBUG** | true | false |
| **POSTGRES_PASSWORD** | mobidf_secret | (do secret) |
| **SECRET_KEY** | default | (do secret) |

---

## 🚀 Próximas Etapas

### 1. **Configurar GitHub Secrets**

```bash
# Gerar senhas
openssl rand -hex 32
# Copiar saída e colar em GitHub Settings

# Settings > Secrets and variables > Actions
# New repository secret
# - Name: POSTGRES_PASSWORD_PROD
# - Value: [saída do comando acima]
```

### 2. **Registrar Self-Hosted Runner** (se ainda não fez)

```bash
# GitHub > Settings > Actions > Runners > New self-hosted runner
# Seguir instruções para registrar
```

### 3. **Fazer Push e Deploy**

```bash
# Qualquer commit em main acionará o workflow
git add .github/workflows/build-and-deploy.yml
git commit -m "feat: load .env.production in production deploy"
git push origin main

# Acompanhar o workflow em GitHub > Actions
```

---

## 🔐 Segurança

✅ **Pontos positivos:**
- Passwords sensíveis em GitHub Secrets (não no repositório)
- Arquivo `.env.production` criado apenas em tempo de deployment
- Secrets não são expostos em logs do GitHub

⚠️ **Considerações:**
- O `.env.production` fica no servidor após deploy
- Se precisar atualizar um secret, faça novo push para main
- O arquivo `.env.production` no repositório é um template (não contém valores reais)

---

## 📞 Troubleshooting

### Variáveis não estão sendo carregadas

```bash
# Verifique que o secret existe no GitHub
# Settings > Secrets and variables > Actions

# Verifique que o workflow está usando corretamente
grep "POSTGRES_PASSWORD_PROD" .github/workflows/build-and-deploy.yml
```

### Deploy falha

```bash
# Ver logs do GitHub Actions
# GitHub > Actions > [seu workflow]

# Se é problema no servidor, conecte e veja os logs
ssh deployer@seu-servidor
docker compose logs -f backend
```

### Arquivo .env.production não foi criado

```bash
# Verifique que o workflow chegou no step de "Configure production environment"
# GitHub > Actions > [seu workflow]

# Se não chegou, pode ser que:
# - Self-hosted runner não está registrado
# - Runner offline
# - Secret com nome errado
```

---

## 📝 Checklist Final

- [ ] GitHub Secrets configurados (POSTGRES_PASSWORD_PROD, SECRET_KEY_PROD)
- [ ] Self-hosted runner registrado e online
- [ ] Workflow `.github/workflows/build-and-deploy.yml` atualizado
- [ ] `.env.production` existe no repositório (como template)
- [ ] docker-compose.prod.yml tem `env_file: [.env.production]`
- [ ] Nginx configurado em `/etc/nginx/conf.d/`
- [ ] SSL/TLS ativado com Let's Encrypt
- [ ] Domínio aponta para servidor correto

---

## 🎉 Resultado

Quando você faz um push para `main`:

1. ✅ GitHub Actions builda as imagens
2. ✅ Push para ghcr.io
3. ✅ Self-hosted runner puxa as imagens
4. ✅ Cria `.env.production` com secrets
5. ✅ Inicia containers com `.env.production`
6. ✅ Tudo em produção com configuração correta!

**Sem necessidade de SSH, manual, ou erros de configuração!** 🚀
