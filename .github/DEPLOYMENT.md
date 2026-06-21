# Deployment Guide - MobiDF AI

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│ GitHub Repository (BroCode-Soft/mobidf-ai)                  │
│                                                              │
│  main branch push                                            │
│     ↓                                                         │
│  GitHub Actions (.github/workflows/build-and-deploy.yml)    │
│     ├─ Build backend image                                  │
│     ├─ Build frontend image                                 │
│     ├─ Push to ghcr.io/BroCode-Soft/mobidf-*               │
│     └─ Trigger self-hosted runner                           │
│        (label: [self-hosted, linux])                        │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ Self-Hosted Runner Server                                    │
│ (Local Deployment Target)                                    │
│                                                              │
│  1. docker login ghcr.io                                    │
│  2. docker-compose pull                                     │
│  3. docker-compose down                                     │
│  4. docker-compose up -d                                    │
│  5. Health checks (curl /health)                            │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ Running Services                                             │
│                                                              │
│  ✓ PostgreSQL + PostGIS (port 5432)                         │
│  ✓ Backend FastAPI (port 8000)                              │
│  ✓ Frontend Next.js (port 3000)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Setup Inicial - Servidor Local

### Pré-requisitos

- Linux (Ubuntu 22.04+, Debian 12+, ou similar)
- Docker Engine 24.0+
- Docker Compose 2.20+
- Git
- ~2GB memória disponível

### 1. Instalar Docker & Docker Compose

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin

# Habilitar usuario para docker (sem sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verificar
docker --version
docker compose version
```

### 2. Clonar Repositório

```bash
cd ~
git clone https://github.com/BroCode-Soft/mobidf-ai.git
cd mobidf-ai
```

### 3. Configurar .env

```bash
cp .env.example .env

# Editar se necessário (usuário/senha do banco, chaves de API, etc.)
nano .env
```

### 4. Registrar Self-Hosted Runner

#### 4a. Gerar Token no GitHub

1. Ir para: https://github.com/BroCode-Soft/mobidf-ai/settings/actions/runners/new
2. Selecionar **Linux** e copiar o token de configuração

#### 4b. Instalar Runner Localmente

```bash
mkdir -p ~/actions-runner
cd ~/actions-runner

# Baixar (substitua VERSION com a versão mais recente)
VERSION="2.315.0"  # Verificar em https://github.com/actions/runner/releases
wget https://github.com/actions/runner/releases/download/v${VERSION}/actions-runner-linux-x64-${VERSION}.tar.gz
tar xzf actions-runner-linux-x64-${VERSION}.tar.gz

# Configurar (copiar comando completo da página GitHub)
./config.sh --url https://github.com/BroCode-Soft/mobidf-ai --token SEU_TOKEN_AQUI

# Testar
./run.sh

# (Opcional) Instalar como serviço systemd
sudo ./svc.sh install
sudo ./svc.sh start

# Verificar status
sudo systemctl status actions.runner.BroCode-Soft-mobidf-ai.*
```

### 5. Testar Docker Compose Local

```bash
cd ~/mobidf-ai

# Subir stack
docker compose up -d

# Aguardar ~60s para inicialização
sleep 60

# Verificar containers
docker compose ps

# Verificar logs
docker compose logs backend
docker compose logs frontend
docker compose logs postgres

# Testar endpoints
curl http://localhost:8000/health
curl http://localhost:3000

# Parar
docker compose down
```

---

## Triggerar Deploy

### Automático (recomendado)

```bash
cd ~/mobidf-ai
git checkout main
git pull origin main

# Fazer alteração, commitar e fazer push
echo "# teste" >> README.md
git add .
git commit -m "test deployment"
git push origin main

# GitHub Actions vai disparar automaticamente
# Ver progresso em: https://github.com/BroCode-Soft/mobidf-ai/actions
```

### Manual via GitHub Web

1. Ir para: https://github.com/BroCode-Soft/mobidf-ai/actions
2. Selecionar workflow "Build and Deploy to Registry"
3. Clicar "Run workflow"
4. Selecionar branch `main`
5. Clicar "Run workflow"

---

## Troubleshooting

### Problema: "docker-compose command not found"

**Solução:**
```bash
# Se usar versão nova (Docker Compose v2):
docker compose --version  # Usar 'docker compose' em vez de 'docker-compose'

# Se precisar da versão v1 legada:
sudo apt-get install -y docker-compose
```

### Problema: Self-Hosted Runner não aparece online

**Debug:**
```bash
cd ~/actions-runner

# Ver logs do runner
tail -f _diag/Runner_*.log

# Se usar systemd:
sudo journalctl -u actions.runner.* -n 50

# Reiniciar
sudo systemctl restart actions.runner.BroCode-Soft-mobidf-ai.*
```

### Problema: "permission denied while trying to connect to Docker daemon"

**Solução:**
```bash
# Adicionar usuario ao grupo docker
sudo usermod -aG docker $USER

# Logout e login
exit

# Verificar
groups $USER  # deve conter 'docker'
```

### Problema: Workflow falha em "Log in to Container Registry"

**Causa:** Runner não consegue fazer login em ghcr.io

**Solução:**
```bash
# No servidor, testar login manual
docker login ghcr.io -u seu_usuario --password "seu_github_token"

# Se falhar, verificar:
# 1. GitHub token tem permission 'packages:write'
# 2. Verificar em: https://github.com/settings/tokens

# Se usar GitHub Actions Runner, o GITHUB_TOKEN é automático
# Nenhuma configuração extra necessária
```

### Problema: Containers não iniciam após docker-compose pull

**Debug:**
```bash
# Ver logs detalhados
docker compose logs -f

# Verificar container específico
docker compose logs backend
docker compose logs postgres

# Recriar containers
docker compose down
docker compose up -d --force-recreate
```

### Problema: PostgreSQL não inicializa, erro "FATAL: database ... does not exist"

**Causa:** Primeira inicialização ainda não completou

**Solução:**
```bash
# Aguardar mais tempo
sleep 30
docker compose logs postgres

# Se persistir, limpar volumes e recriare
docker compose down -v
docker compose up -d
sleep 60
```

---

## Monitoramento

### Verificar Saúde

```bash
# Containers rodando
docker compose ps

# Logs em tempo real (todos)
docker compose logs -f

# Logs filtrados por serviço
docker compose logs -f backend
docker compose logs -f postgres

# Health status
docker compose ps --format "table {{.Service}}\t{{.Status}}"
```

### Acessar Serviços

```bash
# Frontend
open http://localhost:3000

# API Swagger
open http://localhost:8000/docs

# PostgreSQL (via psql)
docker exec -it mobidf-postgres psql -U mobidf -d mobidf

# Mostrar tabelas
SELECT * FROM information_schema.tables WHERE table_schema = 'public';
```

---

## Atualizar Deployado Manualmente

Se quiser puxar novas imagens sem fazer push no GitHub:

```bash
cd ~/mobidf-ai

# Atualizar .env com novas variáveis se necessário
nano .env

# Puxar imagens mais recentes do registry
docker compose pull

# Parar containers atuais
docker compose down

# Iniciar com imagens novas
docker compose up -d

# Verificar
docker compose ps
curl http://localhost:8000/health
```

---

## Rollback (volta para versão anterior)

```bash
# Verificar histórico de imagens
docker image ls | grep mobidf

# Especificar tag antiga no docker-compose.yml manualmente
# (ou usar docker compose pull com tag específica)

# Exemplo: voltar para tag anterior
docker pull ghcr.io/BroCode-Soft/mobidf-backend:main-abc123def
docker pull ghcr.io/BroCode-Soft/mobidf-frontend:main-abc123def

docker compose down
docker compose up -d
```

---

## Informações Úteis

- **GitHub Actions Docs:** https://docs.github.com/en/actions
- **Container Registry:** https://github.com/BroCode-Soft/mobidf-ai/pkgs/container/mobidf-backend
- **Docker Compose Docs:** https://docs.docker.com/compose/
- **PostgreSQL PostGIS:** https://postgis.net/

---

## Contato & Suporte

- Issues: https://github.com/BroCode-Soft/mobidf-ai/issues
- Maintainers: BroCode-Soft Team
