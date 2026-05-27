# Deployment — Vercel (frontend) + Render (backend)

Безплатний production-деплой. Все що треба — GitHub репо (вже є) і безплатні акаунти на Vercel + Render. База даних Supabase вже хоститься окремо.

---

## 🗺️ Архітектура

```
Користувач → Vercel (Next.js)  →  Render (FastAPI)  →  Supabase (Postgres)
            habitrefactor.vercel.app   habitrefactor-backend.onrender.com   *.supabase.co
```

Браузер ходить **тільки** на Vercel. Vercel робить проксі через `/api/backend/*` → Render. Завдяки цьому не потрібно жодних CORS-налаштувань.

---

## ✅ Перед деплоєм — підготуй ключі

Тримай під рукою (потім будемо вставляти у Vercel/Render UI):

| Ключ | Звідки взяти |
|------|--------------|
| `SUPABASE_URL` | Supabase dashboard → Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API → service_role (секрет!) |
| `GEMINI_API_KEY` | https://aistudio.google.com/ → Get API key |
| `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` (один раз) |
| `VAPID_EMAIL` | `mailto:твоя_пошта@example.com` |

Згенеруй VAPID-ключі заздалегідь (один раз):
```bash
npx web-push generate-vapid-keys
```

---

## 1️⃣ Деплой backend на Render

### Крок 1. Створити акаунт
1. Зайди на https://render.com
2. **Sign in with GitHub** → авторизуй доступ до репо `ostap-girniak/HabitRefactor`

### Крок 2. Створити Web Service
1. Dashboard → **New +** → **Web Service**
2. Connect repo → обери `HabitRefactor`
3. Render побачить файл `render.yaml` у корені й автоматично запропонує налаштування. Якщо ні — заповни вручну:

| Поле | Значення |
|------|----------|
| Name | `habitrefactor-backend` |
| Region | `Frankfurt (EU Central)` |
| Branch | `main` |
| Root Directory | `backend` |
| Runtime | `Python 3` |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Instance Type | `Free` |
| Health Check Path | `/health` |

### Крок 3. Додати Environment Variables

У секції **Environment** натисни **Add Environment Variable** і додай по черзі:

```
PYTHON_VERSION              = 3.11.9
APP_ENV                     = production
SUPABASE_URL                = https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY           = (з Supabase)
SUPABASE_SERVICE_ROLE_KEY   = (з Supabase, секрет)
GEMINI_API_KEY              = (з aistudio.google.com)
VAPID_PUBLIC_KEY            = (з web-push generate-vapid-keys)
VAPID_PRIVATE_KEY           = (з web-push generate-vapid-keys)
VAPID_EMAIL                 = mailto:your_email@example.com
ENABLE_PATTERN_INTERCEPTOR  = true
ENABLE_RELAPSE_INTERCEPTOR  = false
ENABLE_SCHEDULED_REMINDERS  = false
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` має admin-доступ до БД — **ніколи** не клади його у фронт.

### Крок 4. Створити сервіс
**Create Web Service**. Перший деплой займе 5–10 хв (Python ставить багато залежностей, особливо `faster-whisper`).

Коли побачиш зелену **Live** позначку — копіюй URL сервісу, напр.:
```
https://habitrefactor-backend.onrender.com
```

Перевір що backend живий:
```bash
curl https://habitrefactor-backend.onrender.com/health
# → {"status":"alive","app":"HabitRefactor",...}
```

### Крок 5. Згенерувати embeddings для knowledge base
Один раз, після першого деплою (якщо SQL-скрипти вже в Supabase):

```bash
curl -X POST https://habitrefactor-backend.onrender.com/api/v1/ai/embed-knowledge-base
# → {"embedded": 85, "failed": 0, "total": 85}
```

---

## 2️⃣ Деплой frontend на Vercel

### Крок 1. Створити акаунт
1. https://vercel.com → **Sign Up** → **Continue with GitHub**
2. Авторизуй доступ до репо

### Крок 2. Import проекту
1. Dashboard → **Add New...** → **Project**
2. Обери `HabitRefactor` → **Import**
3. Налаштуй:

| Поле | Значення |
|------|----------|
| Framework Preset | `Next.js` (визначиться автоматично) |
| Root Directory | **`frontend`** ⚠️ обов'язково зміни — Vercel за замовч. бачить корінь |
| Build Command | (залиш порожнім — `next build`) |
| Output Directory | (залиш порожнім) |
| Install Command | (залиш порожнім — `npm install`) |

### Крок 3. Додати Environment Variables
Розгорни **Environment Variables** і додай:

```
NEXT_PUBLIC_SUPABASE_URL         = https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY    = (з Supabase, той самий anon)
NEXT_PUBLIC_API_URL              = https://habitrefactor-backend.onrender.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY     = (той самий VAPID_PUBLIC_KEY з Render)
```

> ⚠️ `NEXT_PUBLIC_API_URL` — URL твого Render-сервісу, **без** трейлінг-слешу і **без** `/api/v1` на кінці. Прокcі Next.js додає `/api/v1/` сам ([route.ts:12](frontend/src/app/api/backend/%5B...path%5D/route.ts#L12)).

> ⚠️ `NEXT_PUBLIC_VAPID_PUBLIC_KEY` має **точно збігатись** з `VAPID_PUBLIC_KEY` на Render — інакше push-сповіщення не працюватимуть.

### Крок 4. Deploy
**Deploy**. Білд 2–4 хв. Отримаєш URL виду `https://habitrefactor.vercel.app`.

---

## 3️⃣ Додати Vercel URL у Supabase Auth

Без цього кроку реєстрація/логін через посилання на пошту не працюватиме.

1. Supabase dashboard → **Authentication** → **URL Configuration**
2. **Site URL:** `https://habitrefactor.vercel.app`
3. **Redirect URLs** (додай обидва):
   - `https://habitrefactor.vercel.app/**`
   - `http://localhost:3000/**` (щоб dev теж працював)
4. **Save**

---

## 4️⃣ Запобігти "засинанню" Render (free tier)

Render free план **усипляє** сервіс через 15 хв без HTTP-запитів. Це ламає APScheduler-воркери (pattern interceptor, milestone tracker, relapse interceptor). Cold-start після цього ~30–50 секунд.

**Рішення: UptimeRobot пінгує `/health` кожні 5 хвилин.**

1. Реєстрація: https://uptimerobot.com (безплатно до 50 моніторів)
2. **+ New Monitor:**
   - Monitor Type: `HTTP(s)`
   - Friendly Name: `HabitRefactor Backend`
   - URL: `https://habitrefactor-backend.onrender.com/health`
   - Monitoring Interval: `5 minutes`
3. **Create Monitor**

Тепер бек живий 24/7 і шедулери стабільно запускаються.

---

## 🔍 Перевірка що все працює

1. Відкрий `https://habitrefactor.vercel.app`
2. Зареєструйся → пройди `/onboarding`
3. Додай звичку → зроби check-in
4. **Settings → Notifications → Enable push** → дозволь у браузері
5. **Send Test Push** → має прийти пуш протягом 1–3 секунд

Якщо щось не працює:
- **Render logs:** Dashboard → твій сервіс → **Logs**
- **Vercel logs:** Dashboard → проект → **Deployments** → останній → **Functions** / **Build Logs**
- **Browser console** (F12) — для помилок проксі

---

## 🔄 Як деплоїться нові коміти

Обидва сервіси налаштовані на **auto-deploy on git push**:
```bash
git push origin main
# → Vercel автоматично білдить і деплоїть фронт
# → Render автоматично білдить і деплоїть бек
```

Хочеш зупинити авто-деплой — у налаштуваннях сервісу вимкни **Auto-Deploy**.

---

## ⚠️ Відомі обмеження free tier

| Лімит | Render free | Vercel Hobby |
|-------|-------------|--------------|
| RAM | 512 MB | — |
| CPU | 0.1 vCPU | — |
| Bandwidth | 100 GB/міс | 100 GB/міс |
| Bandwidth (hours) | 750 год/міс (одного сервісу вистачає) | — |
| Cold start | ~30–50 сек (вирішується UptimeRobot) | — |
| Build time | до 15 хв | до 45 хв |

`faster-whisper` (для голосових журналів) важко поміщається у 512 MB — якщо при транскрипції бек падає з OOM, варіанти:
1. Прибрати `faster-whisper` з `requirements.txt` (голосові журнали вимкнуться, текстові працюють)
2. Перейти на Render Starter $7/міс (2 GB RAM)
3. Винести транскрипцію на Gemini API замість локального Whisper

---

## 📋 Шпаргалка URL-ів (заповни своїми)

```
Frontend:           https://_________________.vercel.app
Backend:            https://_________________.onrender.com
Supabase:           https://_________________.supabase.co
Knowledge embed:    POST <backend>/api/v1/ai/embed-knowledge-base
Health:             GET  <backend>/health
API docs:           GET  <backend>/api/v1/docs
UptimeRobot ping:   <backend>/health  (5 min interval)
```
