<div align="center">

# 📡 DevCast

### Прямая трансляция разработки — человеческим языком

DevCast следит за коммитами в GitHub, прогоняет диффы через ИИ и превращает их
в понятные **нетехническому человеку** сводки — а затем зеркалит их в Notion
как живой роадмап проекта.

<br/>

![React](https://img.shields.io/badge/React-Vite_·_TS-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-async-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis_+_ARQ-queue-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)

</div>

---

## 🌊 Как это работает

```text
   ┌──────────────┐   webhook(push)   ┌─────────────┐   enqueue    ┌───────────────────┐
   │  GitHub App  │ ────────────────▶ │   FastAPI   │ ───────────▶ │  Redis · ARQ воркер │
   └──────────────┘                   └─────────────┘              └─────────┬─────────┘
                                                                             │
                                            diff → LLM → «человеческое» описание
                                            запись / дайджест в Notion
                                                                             │
   ┌──────────────┐      SSE (live)                                          ▼
   │  React SPA   │ ◀────────────────  лента изменений · модалка · календарь активности
   └──────────────┘
```

---

## ✨ Возможности

| | Что умеет |
|:---:|:---|
| 🔐 | **Аккаунты.** Регистрация и вход по JWT, полноценный мультипользовательский режим. |
| 🐙 | **GitHub App + webhooks.** Мгновенные события push, а поллинг — как fallback через кнопку «Sync now». |
| 🧠 | **Вкладка «Оператор».** Выбор провайдера ИИ — DeepSeek · GPT · Claude · YandexGPT · GigaChat — и версии модели. API-ключ **write-only**: задаётся один раз, потом виден только замаскированный хвост, скопировать нельзя — лишь перезаписать. |
| 📝 | **Notion.** Привязка каждого репозитория к своей странице/базе, частота синка `realtime` / `daily` / `weekly`. Matcher сопоставляет коммит с задачей (явный тег `[KEY-12]` или нечёткое совпадение) и меняет статус **только выше порога уверенности** — чтобы не ломать чужой роадмап. |
| 🗓️ | **Календарь активности** по датам и времени коммитов + опциональный пуш в Google Calendar. |
| ⚡ | **Живая лента.** Обновления прилетают в UI через Server-Sent Events. |

---

## 🧰 Стек

<div align="center">

**React** (Vite + TS + Tailwind v4) · **FastAPI** · **PostgreSQL** · **Redis + ARQ** · **Docker Compose**

</div>

---

## 🚀 Быстрый старт (Docker)

```bash
cp .env.example .env

# Сгенерируйте ключи:
python -c "from cryptography.fernet import Fernet;print('APP_ENCRYPTION_KEY=',Fernet.generate_key().decode())"
python -c "import secrets;print('JWT_SECRET=',secrets.token_urlsafe(48))"

# впишите их в .env, затем:
docker compose up --build
```

> **Frontend** → http://localhost:5173
> **API** → http://localhost:8000 · Swagger: `/docs`

---

## 🛠️ Локальная разработка (без Docker)

```bash
# 1 · инфраструктура
docker compose up -d postgres redis        # pg на :5433, redis на :6380

# 2 · backend
cd backend && python3.12 -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload              # API :8000
arq app.workers.queue.WorkerSettings       # воркер (в отдельном терминале)

# 3 · frontend
cd frontend && npm install && npm run dev  # :5173
```

---

## 🔌 Настройка интеграций

<details open>
<summary><b>🐙 GitHub App</b></summary>

<br/>

1. Создайте App → https://github.com/settings/apps
   - **Webhook URL:** `${PUBLIC_BASE_URL}/api/webhooks/github`, задайте Webhook secret.
   - **Permissions:** Repository → Contents (read), Metadata (read). **Events:** Push.
   - **Callback URL:** `${PUBLIC_BASE_URL}/api/integrations/github/callback`.
2. Впишите `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, client id/secret, webhook secret и приватный
   ключ (`GITHUB_APP_PRIVATE_KEY` одной строкой с `\n`, либо `..._PATH`) в `.env`.

**Webhooks локально** требуют публичного URL. Поднимите туннель и пропишите его в `PUBLIC_BASE_URL`:

```bash
cloudflared tunnel --url http://localhost:8000     # без аккаунта
# или: ngrok http 8000
```

> Без туннеля можно работать через кнопку **«Sync now»** (поллинг) в разделе «Репозитории».

</details>

<details>
<summary><b>📝 Notion (OAuth, мультиюзер)</b></summary>

<br/>

Создайте **public OAuth integration** → https://www.notion.so/profile/integrations → New
connection → Authentication method **OAuth**, Installable in **Any workspace**, Redirect URI
`${PUBLIC_BASE_URL}/api/integrations/notion/callback` (+ localhost-вариант для dev).
Capabilities: Read / Insert / Update content. Скопируйте client id/secret в
`NOTION_CLIENT_ID` / `NOTION_CLIENT_SECRET`.

Пользователь подключает Notion кнопкой **«Подключить Notion»** на вкладке «Интеграции» —
каждый авторизует свой workspace, токены не вводятся. Internal token остаётся опциональным
fallback для локальной разработки (`NOTION_DEFAULT_TOKEN` или поле в UI).

</details>

<details>
<summary><b>🗓️ Google Calendar (опционально)</b></summary>

<br/>

Заполните `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, redirect URI:
`${PUBLIC_BASE_URL}/api/calendar/oauth/callback`.

</details>

---

## 🧪 Тесты

```bash
cd backend && . .venv/bin/activate && pytest -q
```

---

## 🗂️ Структура

```text
backend/   FastAPI, SQLAlchemy, ARQ-воркер, Alembic
  app/api        REST + webhooks + SSE
  app/services   github_app, notion, matcher, google_calendar, llm/*
  app/workers    process_commit, profile_repo, poll_repos, дайджесты
frontend/  React SPA (Лента, Репозитории, Интеграции, Оператор, Календарь)
```

<div align="center">
<br/>

**DevCast** — превращает `git log` в историю, которую понимают все.

</div>
