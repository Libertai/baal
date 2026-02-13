# DevOps

Write Dockerfiles, docker-compose configs, CI/CD pipelines, reverse proxy configs, and systemd services.

## Dockerfile (multi-stage)

```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Docker Compose

```yaml
services:
  app:
    build: .
    ports: ["8000:8000"]
    depends_on:
      db: { condition: service_healthy }
    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/app
  db:
    image: postgres:16
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 5s
volumes:
  pgdata:
```

## GitHub Actions

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: pip install -r requirements.txt
      - run: pytest --tb=short
```

## Caddy Reverse Proxy

```
example.com {
    reverse_proxy localhost:8000
    encode gzip
}
```

## Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name example.com;
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Systemd Service

```ini
[Unit]
Description=My App
After=network.target

[Service]
Type=simple
User=app
WorkingDirectory=/opt/app
ExecStart=/opt/app/.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=on-failure
RestartSec=5
EnvironmentFile=/opt/app/.env

[Install]
WantedBy=multi-user.target
```

## Tips
- Use specific image tags, never `latest`
- Put dependency layers before source code layers in Dockerfiles
- Use healthchecks in compose for proper startup ordering
- Validate configs: `docker compose config`, `nginx -t`
- Manage services: `systemctl daemon-reload && systemctl enable --now myapp`
