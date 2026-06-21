#!/bin/bash
# Validation script for MobiDF AI Docker Compose setup
# Tests local docker-compose configuration before deployment

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== MobiDF AI - Docker Compose Validation ===${NC}\n"

# 1. Check Docker
echo -n "✓ Checking Docker... "
if ! command -v docker &> /dev/null; then
    echo -e "${RED}FAILED - Docker not installed${NC}"
    exit 1
fi
DOCKER_VERSION=$(docker --version | cut -d' ' -f3 | cut -d',' -f1)
echo -e "${GREEN}OK (v${DOCKER_VERSION})${NC}"

# 2. Check Docker Daemon
echo -n "✓ Checking Docker daemon... "
if ! docker ps &> /dev/null; then
    echo -e "${RED}FAILED - Docker daemon not running or permission denied${NC}"
    echo "  Try: sudo usermod -aG docker \$USER && newgrp docker"
    exit 1
fi
echo -e "${GREEN}OK${NC}"

# 3. Check Docker Compose
echo -n "✓ Checking Docker Compose... "
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}FAILED - Docker Compose not installed${NC}"
    exit 1
fi
if docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version | grep "Docker Compose" | cut -d' ' -f3)
    echo -e "${GREEN}OK (Docker Compose v${COMPOSE_VERSION})${NC}"
else
    COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)
    echo -e "${GREEN}OK (docker-compose v${COMPOSE_VERSION})${NC}"
fi

# 4. Check docker-compose.yml
echo -n "✓ Checking docker-compose.yml... "
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}FAILED - docker-compose.yml not found${NC}"
    exit 1
fi
echo -e "${GREEN}OK${NC}"

# 5. Check .env.example
echo -n "✓ Checking .env.example... "
if [ ! -f ".env.example" ]; then
    echo -e "${RED}FAILED - .env.example not found${NC}"
    exit 1
fi
echo -e "${GREEN}OK${NC}"

# 6. Check Dockerfiles
echo -n "✓ Checking backend/Dockerfile... "
if [ ! -f "backend/Dockerfile" ]; then
    echo -e "${RED}FAILED - backend/Dockerfile not found${NC}"
    exit 1
fi
echo -e "${GREEN}OK${NC}"

echo -n "✓ Checking frontend/Dockerfile... "
if [ ! -f "frontend/Dockerfile" ]; then
    echo -e "${RED}FAILED - frontend/Dockerfile not found${NC}"
    exit 1
fi
echo -e "${GREEN}OK${NC}"

# 7. Check database files
echo -n "✓ Checking database files... "
for sql_file in database/0{1..4}_*.sql; do
    if [ ! -f "$sql_file" ]; then
        echo -e "${RED}FAILED - $sql_file not found${NC}"
        exit 1
    fi
done
echo -e "${GREEN}OK (all SQL files present)${NC}"

# 8. Validate docker-compose.yml syntax
echo -n "✓ Validating docker-compose.yml syntax... "
if ! docker-compose config > /dev/null 2>&1 && ! docker compose config > /dev/null 2>&1; then
    echo -e "${RED}FAILED - Invalid syntax${NC}"
    exit 1
fi
echo -e "${GREEN}OK${NC}"

# 9. Check .env or create from .env.example
echo -n "✓ Checking .env... "
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}NOT FOUND - Creating from .env.example${NC}"
    cp .env.example .env
    echo "  ${GREEN}✓ Created .env (update credentials as needed)${NC}"
else
    echo -e "${GREEN}OK${NC}"
fi

# 10. Optional: Test docker image availability
echo -n "✓ Checking Docker image availability... "
if ! docker pull postgis/postgis:17-3.4 > /dev/null 2>&1; then
    echo -e "${YELLOW}WARNING - Could not pull postgis image (network issue?)${NC}"
else
    echo -e "${GREEN}OK${NC}"
fi

echo ""
echo -e "${GREEN}=== All Validations Passed! ===${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review and update .env file with your configuration"
echo "  2. Build images: docker-compose build"
echo "  3. Start services: docker-compose up -d"
echo "  4. Check status: docker-compose ps"
echo "  5. Access:"
echo "     - Frontend: http://localhost:3000"
echo "     - API: http://localhost:8000/docs"
echo ""
echo -e "For detailed setup instructions, see: .github/DEPLOYMENT.md"
