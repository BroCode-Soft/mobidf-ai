# Serviços Independentes

## Configuração

A partir desta versão, o backend inicia **independente** do PostgreSQL estar pronto. Isso significa:

✅ **Backend inicia imediatamente** - não bloqueia esperando o banco  
✅ **PostgreSQL inicia em paralelo** - sem deps de saúde  
✅ **Reconexão automática** - backend reconecta quando DB fica disponível

## Ordem de Inicialização (Compose)

```
postgres ─┐
          ├─→ backend → frontend
          │
          (paralelo, sem bloqueio)
```

## Benefícios

1. **Mais rápido**: Serviços iniciam em paralelo
2. **Mais resiliente**: Backend não trava se DB reinicia
3. **Produção-ready**: Melhor para ambientes de produção
4. **CI/CD amigável**: Reduz timeout em pipelines

## Comportamento

| Cenário | Antes | Depois |
|---------|-------|--------|
| Backend inicia antes DB | ❌ Bloqueia | ✅ Inicia |
| DB reinicia | ❌ Backend cai | ✅ Backend reconecta |
| Timeout no health check | ❌ Falha | ✅ Inicia mesmo assim |

## Docker Compose

```yaml
backend:
  depends_on:
    - postgres  # Sem condition: service_healthy

frontend:
  depends_on:
    - backend   # Sem condition
```

## Configuração no Backend

O FastAPI está configurado com retry automático em `app/database.py`:

```python
# Reconexão automática ao PostgreSQL
# Se DB não está pronto, aplicação tenta reconectar periodicamente
```

## Testando

```bash
# Inicia backend e DB em paralelo
docker compose up -d

# Backend fica pronto em ~2s (sem esperar DB)
curl http://localhost:8000/health

# DB fica pronto em ~5-10s
# Backend se conecta automaticamente quando DB está ready
```
