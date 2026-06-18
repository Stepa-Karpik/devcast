# DevCast

**Прямая трансляция разработки человеческим языком.** DevCast следит за коммитами в
GitHub, прогоняет диффы через ИИ и превращает их в понятные нетехническому человеку
сводки («Что сделано»), а затем зеркалит их в Notion как живой роадмап проекта.

```
GitHub App ──webhook(push)──▶ FastAPI ──enqueue──▶ Redis (ARQ worker)
                                                       │ diff → LLM → "человеческое" описание
                                                       │ запись/дайджест в Notion
                                                       ▼
React SPA ◀── SSE (live) ── лента изменений · модалка · календарь активности
```

## Возможности

- 🔐 Регистрация/вход (JWT), мультипользовательский режим.
- 🐙 **GitHub App + webhooks** — мгновенные события + поллинг как fallback («Sync now»).
- 🧠 **Вкладка «Оператор»** — выбор провайдера ИИ (DeepSeek / GPT / Claude / YandexGPT /
  GigaChat) и версии модели. API-ключ **write-only**: задаётся один раз, потом виден
  только замаскированный хвост, скопировать нельзя (можно лишь перезаписать).
- 📝 **Notion** — привязка каждого репозитория к своей странице/базе, частота синка
  на репозиторий: `realtime` / `daily` / `weekly`. Matcher сопоставляет коммит с задачей
  (явный тег `[KEY-12]` или нечёткое совпадение) и меняет статус только выше порога
  уверенности, чтобы не ломать чужой роадмап.
- 🗓️ Календарь активности по датам/времени коммитов + опциональный пуш в Google Calendar.
- ⚡ Живое обновление ленты через Server-Sent Events.

## Стек

React (Vite + TS + Tailwind v4) · FastAPI · PostgreSQL · Redis + ARQ · Docker Compose.

## Быстрый старт (Docker)

```bash
cp .env.example .env
# Сгенерируйте ключи:
python -c "from cryptography.fernet import Fernet;print('APP_ENCRYPTION_KEY=',Fernet.generate_key().decode())"
python -c "import secrets;print('JWT_SECRET=',secrets.token_urlsafe(48))"
# впишите их в .env, затем:
docker compose up --build
```

- Frontend: http://localhost:5173
- API: http://localhost:8000 (Swagger: `/docs`)

## Локальная разработка (без Docker)

```bash
# инфраструктура
docker compose up -d postgres redis     # pg на :5433, redis на :6380

# backend
cd backend && python3.12 -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload            # API :8000
arq app.workers.queue.WorkerSettings     # воркер (в отдельном терминале)

# frontend
cd frontend && npm install && npm run dev # :5173
```

## Настройка интеграций

### GitHub App
1. Создайте App: https://github.com/settings/apps
   - **Webhook URL:** `${PUBLIC_BASE_URL}/api/webhooks/github`, задайте Webhook secret.
   - **Permissions:** Repository → Contents (read), Metadata (read). **Events:** Push.
   - **Callback URL:** `${PUBLIC_BASE_URL}/api/integrations/github/callback`.
2. Впишите `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, client id/secret, webhook secret и приватный
   ключ (`GITHUB_APP_PRIVATE_KEY` одной строкой с `\n`, либо `..._PATH`) в `.env`.

**Webhooks локально** требуют публичного URL. Поднимите туннель и пропишите его в
`PUBLIC_BASE_URL`:

```bash
cloudflared tunnel --url http://localhost:8000     # без аккаунта
# или: ngrok http 8000
```

Без туннеля можно работать через кнопку **«Sync now»** (поллинг) в разделе «Репозитории».

### Notion
Создайте internal integration (https://www.notion.so/my-integrations), скопируйте токен
(`secret_…`) и **дайте интеграции доступ к нужным страницам** в Notion (Share → Connect).
Вставьте токен в приложении на вкладке «Интеграции».

### Google Calendar (опционально)
Заполните `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, redirect URI:
`${PUBLIC_BASE_URL}/api/calendar/oauth/callback`.

## Тесты

```bash
cd backend && . .venv/bin/activate && pytest -q
```

## Структура

```
backend/   FastAPI, SQLAlchemy, ARQ-воркер, Alembic
  app/api        REST + webhooks + SSE
  app/services   github_app, notion, matcher, google_calendar, llm/*
  app/workers    process_commit, profile_repo, poll_repos, дайджесты
frontend/  React SPA (Лента, Репозитории, Интеграции, Оператор, Календарь)
```
