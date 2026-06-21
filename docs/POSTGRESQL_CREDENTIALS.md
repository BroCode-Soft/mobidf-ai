# PostgreSQL Credentials Configuration

## 🔐 Como as credenciais do PostgreSQL são configuradas

### Fluxo Completo

```
GitHub Secrets (POSTGRES_PASSWORD_PROD)
            ↓
GitHub Actions Workflow
  ├─ Cria .env com POSTGRES_PASSWORD do secret
  └─ Faz push para servidor
            ↓
docker-compose.yml lê .env
  ├─ Lê: POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-mobidf_secret}
  └─ Passa para container
            ↓
PostgreSQL container (postgis/postgis:17-3.4)
  ├─ Recebe variáveis de ambiente
  ├─ docker-entrypoint.sh executa
  ├─ Cria usuário: ${POSTGRES_USER} (mobidf)
  ├─ Define senha: ${POSTGRES_PASSWORD} (do secret)
  └─ Cria banco: ${POSTGRES_DB} (mobidf)
            ↓
Resultado: PostgreSQL rodando com credenciais seguras ✅
```

---

## ✅ Credenciais Padrão

| Componente | Valor | Origem |
|-----------|-------|--------|
| **Usuário** | `mobidf` | Fixo em `.env` |
| **Senha** | `$POSTGRES_PASSWORD_PROD` | GitHub Secret |
| **Banco** | `mobidf` | Fixo em `.env` |
| **Host** | `postgres` | Nome do serviço docker-compose |
| **Porta** | `5432` | Padrão PostgreSQL |

---

## 🔧 Como Configurar em Produção

### 1. Criar GitHub Secret

1. Vá para: **Configurações do Repositório → Secrets and variables → Actions**
2. Clique em **New repository secret**
3. Configure:
   - **Name:** `POSTGRES_PASSWORD_PROD`
   - **Value:** (gere uma senha forte)

```bash
# Gerar senha segura
openssl rand -hex 32
# Exemplo: a3f8e9b2c1d4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3y4z5a6b7c8d9
```

### 2. O Workflow Faz o Resto

Quando o workflow é acionado, ele:

```yaml
- name: Configure production environment
  run: |
    cat > .env << 'ENVEOF'
    POSTGRES_PASSWORD=${{ secrets.POSTGRES_PASSWORD_PROD }}
    # ... outras variáveis
    ENVEOF
```

### 3. Docker Compose Usa Automaticamente

```yaml
services:
  postgres:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-mobidf_secret}
    # ... resto da configuração
```

---

## ✔️ Como Validar em Produção

### No servidor, após o deploy:

```bash
# Ver as variáveis de ambiente do container
docker exec mobidf-postgres env | grep POSTGRES

# Conectar ao banco e verificar
docker exec -it mobidf-postgres psql -U mobidf -d mobidf -c "SELECT current_user;"

# Testar a conexão (deve retornar o usuário)
# Saída esperada: mobidf
```

### Resultado esperado:

```
POSTGRES_DB=mobidf
POSTGRES_USER=mobidf
POSTGRES_PASSWORD=sua_senha_do_secret_aqui
```

---

## 📋 Checklist de Configuração

- [ ] GitHub Secret `POSTGRES_PASSWORD_PROD` criado
- [ ] GitHub Secret `SECRET_KEY_PROD` criado
- [ ] GitHub Secret `GOOGLE_MAPS_API_KEY` criado (opcional)
- [ ] Workflow `.github/workflows/build-and-deploy.yml` atualizado
- [ ] Self-hosted runner registrado no GitHub
- [ ] Servidor de produção tem `docker compose` instalado
- [ ] Nginx configurado em `/etc/nginx/conf.d/`
- [ ] SSL/TLS ativado com Let's Encrypt

---

## 🔍 Troubleshooting

### PostgreSQL não conecta

```bash
# Verificar se o container está saudável
docker compose ps
# Deve mostrar: mobidf-postgres ... (healthy)

# Ver os logs
docker compose logs postgres | tail -20

# Testar conexão manual
PGPASSWORD=senha_aqui psql -h localhost -U mobidf -d mobidf -c "\l"
```

### Backend não consegue conectar ao banco

```bash
# Verificar a connection string do backend
docker exec mobidf-backend env | grep DATABASE_URL

# Testar a conexão
docker exec mobidf-backend python -c "
import sqlalchemy
engine = sqlalchemy.create_engine('postgresql://mobidf:senha@postgres:5432/mobidf')
connection = engine.connect()
print('Conectou com sucesso!')
connection.close()
"
```

### Senha não está sendo lida corretamente

```bash
# Verificar o .env no servidor
cat /home/deployer/mobidf-ai/.env | grep POSTGRES_PASSWORD

# Se estiver vazio, significa que o secret não foi configurado no GitHub
# Configure o secret e execute o workflow novamente
```

---

## 📝 Notas de Segurança

✅ **O que funciona bem:**
- Passwords sensíveis armazenadas em GitHub Secrets
- Não expõe a senha em logs do repositório
- Container recebe senha apenas em tempo de execução
- Poderia adicionar secrets automáticos no servidor

⚠️ **Melhorias futuras:**
- Usar Docker Secrets (se usar Docker Swarm)
- Implementar rotação automática de senhas
- Backup automático do banco com credenciais seguras
- Monitoramento de accesso ao banco

---

## 🚀 Próximo Passo

Após configurar o GitHub Secret, faça um push para `main`:

```bash
git add .github/workflows/build-and-deploy.yml
git commit -m "feat: configure PostgreSQL credentials via GitHub Secrets"
git push origin main
```

O workflow será acionado automaticamente e fará o deploy completo com as credenciais seguras!
