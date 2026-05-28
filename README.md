# HabitRefactor 🔥

🇺🇦 [Українська версія](README.uk.md) · 🤖 [AI architecture](docs/AI.md) · 🗺️ [Roadmap](docs/ROADMAP.md)

> **Refactor your habits, reforge your identity.**

**HabitRefactor** is a next-generation habit tracking and psychological transformation platform. Unlike traditional checklists, it leverages **Gemini 2.0 AI** to analyze the emotional undercurrents of your journey through multimodal journaling (voice, video, and text), mapping your progress not just in streaks, but in identity shifts.

## 🌐 Live Demo

- **App:** [habit-refactor.vercel.app](https://habit-refactor.vercel.app)
- **API:** [habitrefactor.onrender.com](https://habitrefactor.onrender.com)
- **API docs (Swagger):** [habitrefactor.onrender.com/api/v1/docs](https://habitrefactor.onrender.com/api/v1/docs)

> First request to the API may take ~30 seconds — Render free tier sleeps the container after 15 minutes of inactivity.

---

## ✨ Key Features

- **🎙️ Multimodal AI Journaling**  
  Record audio or video journals directly in the browser. Powered by Gemini 2.0 Flash — verbatim transcription, emotion detection (radar charts), and key theme extraction.

- **🦾 Identity-Based Tracking**  
  Define your *Warrior Identity*. The app focuses on becoming the person who doesn't have the habit, rather than just avoiding the behavior.

- **🧙 Oracle AI Chat**  
  Conversational AI assistant with full RAG context — answers based on your journals, check-ins, streaks, and a curated knowledge base of books, science, and videos. Recommends books, YouTube channels, articles, and professional help. Responds in your language (Ukrainian/English).

- **📊 Emotional Intelligence & Deep Analytics**  
  GitHub-style 365-day heatmap, hourly and weekday risk analysis, streak breakdowns, and trigger pattern visualization.

- **🚨 Smart Notification System**  
  4 types of behavioral pattern alerts (high-risk hour, dangerous weekday, consecutive relapses, streak break point) + journal danger detection + scheduled reminders + streak milestone celebrations. All timezone-aware with cooldown protection. Bilingual (UK/EN).

- **🔥 Pain & Pleasure Projections**  
  AI-generated cost-of-inaction projections using your own journal entries as context.

- **📚 Knowledge Base RAG**  
  59 curated entries (33 English + 26 Ukrainian) covering books, YouTube, CBT strategies, addiction science. pgvector semantic search. Oracle pulls the most relevant wisdom for your exact situation.

- **🌍 Ukrainian & English UI**  
  Full interface localization with an EN/UK switcher in Settings.

- **📱 PWA Ready**  
  Installable on mobile devices as a Progressive Web App. Offline mode with cached UI shell. iOS Safari support (16.4+ for Web Push).

- **🎓 First-Visit Guided Tour**  
  An 8-slide modal walks new visitors through every major feature (identity lab, AI journal, Oracle, smart push). Shows once, stored in localStorage.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 16 (TypeScript)
- **State Management:** Zustand & TanStack Query v5
- **Styling:** Custom CSS (dark-only design system)
- **Charts:** Recharts
- **PWA/Notifications:** Service Workers + Web Push API
- **Auth/DB:** Supabase SSR

### Backend
- **Framework:** FastAPI (Python)
- **Primary AI:** Google Gemini 2.0 Flash (multimodal, RAG, embeddings)
- **Fallback AI:** OpenAI-compatible providers (Groq/DeepSeek)
- **Vector Search:** pgvector (768-dim embeddings via Gemini)
- **Database:** Supabase (PostgreSQL + RLS)
- **Background Workers:** APScheduler (pattern interceptor, relapse alerts, journal scanner, milestone tracker)
- **Push Notifications:** PyWebPush (VAPID)

---

## 📁 Project Structure

```
HabitRefactor/
├── backend/          ← FastAPI, requirements.txt, .env
├── frontend/         ← Next.js, .env.local
└── database/         ← SQL migrations & seeds (run in Supabase)
```

There is **no** `requirements.txt` or `.env` in the repo root — always look inside `backend/` and `frontend/`.

---

## 🚀 Getting Started

### Prerequisites
- [Node.js 18+](https://nodejs.org/)
- [Python 3.10+](https://www.python.org/)
- [Supabase Account](https://supabase.com/) — free tier is enough
- [Google AI Studio Key](https://aistudio.google.com/) (Gemini)

---

### 1. Backend Setup

> **Note:** `requirements.txt` and `.env.example` are in the **`backend/`** folder, not the repo root. Run the commands below from inside `backend/` (after `cd backend`). If you stay in the project root, use `pip install -r backend/requirements.txt` instead.

```bash
cd backend          # required — dependencies live in backend/
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements-local.txt   # local: includes voice/video transcription
# For production / Render free tier use the lighter file instead:
# pip install -r requirements.txt
cp .env.example .env                    # file: backend/.env.example
# Windows (PowerShell) instead of cp:
# copy .env.example .env
```

> ℹ️ `requirements-local.txt` додає `faster-whisper` + `imageio-ffmpeg` (~400 MB RAM) для голосових/відео-журналів. `requirements.txt` — мінімальний, текстові журнали працюють і там.

Edit `backend/.env` with your values (see comments in the file). The minimum required fields are:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_google_ai_key
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_EMAIL=mailto:your_email@example.com
```

**Key roles (do not mix them up):**

| Key | Where | Purpose |
|-----|-------|---------|
| `SUPABASE_ANON_KEY` | Backend + Frontend | User-scoped requests, RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Backend only** | Admin ops: media upload, embeddings, workers — **never** put in frontend |
| `GEMINI_API_KEY` | Backend only | AI analysis, Oracle, embeddings |
| `VAPID_PUBLIC_KEY` | Backend + Frontend (`NEXT_PUBLIC_…`) | Must be **identical** on both sides |
| `VAPID_PRIVATE_KEY` | Backend only | Signs push messages |

Optional toggles in `backend/.env` (see `.env.example` for defaults):

| Variable | Default | Effect |
|----------|---------|--------|
| `ENABLE_PATTERN_INTERCEPTOR` | `true` | Runs pattern analysis every 15 min — uses Gemini quota |
| `ENABLE_RELAPSE_INTERCEPTOR` | `false` | Danger-zone push loop |
| `ENABLE_SCHEDULED_REMINDERS` | `false` | Time-based reminder pushes |

After any `.env` change, **restart** the backend (`Ctrl+C` → run uvicorn again).

Generate VAPID keys (required for push notifications):
```bash
npx web-push generate-vapid-keys
```

Start the server (still from **`backend/`**):
```bash
python -m uvicorn app.main:app --reload
```

API docs: [http://127.0.0.1:8000/api/v1/docs](http://127.0.0.1:8000/api/v1/docs)

---

### 2. Frontend Setup

> **Note:** `.env.local.example` is in the **`frontend/`** folder. Run these commands from inside `frontend/` (after `cd frontend`).

```bash
cd frontend         # required — config lives in frontend/
npm install
cp .env.local.example .env.local   # file: frontend/.env.local.example
# Windows (PowerShell):
# copy .env.local.example .env.local
```

Edit `frontend/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
```

```bash
npm run dev
```
App: [http://localhost:3000](http://localhost:3000)

**How the frontend talks to the backend:** the browser does **not** call `:8000` directly. All API traffic goes through the Next.js proxy at `/api/backend/*` → `NEXT_PUBLIC_API_URL`. This avoids CORS issues. Keep `NEXT_PUBLIC_API_URL` pointed at your running backend (both `http://127.0.0.1:8000` and `http://localhost:8000` work; pick one and stay consistent).

Restart the frontend after changing `.env.local` (`Ctrl+C` → `npm run dev`).

### Recommended startup order

1. Supabase project + SQL migrations (below)
2. `backend` — uvicorn
3. `embed-knowledge-base` curl (after seeds)
4. `frontend` — `npm run dev`
5. Register a user → complete `/onboarding`

---

## ☁️ Supabase Setup (first time)

1. Create a project at [supabase.com](https://supabase.com/).
2. **Settings → API** — copy `Project URL`, `anon` key, and `service_role` key into `backend/.env` and `frontend/.env.local`.
3. **Authentication → URL Configuration** — add redirect URLs for local dev:
   - `http://localhost:3000/callback`
   - `http://127.0.0.1:3000/callback`
4. **Authentication → Providers → Email** — for local testing, you may disable **Confirm email** so registration works instantly without inbox verification.
5. **Storage → New bucket** — create a bucket named exactly **`journal-media`** (public bucket is simplest for dev). Required for audio/video journal uploads and AI transcription. This step is **not** in the SQL scripts — if you skip it, media uploads fail with storage errors.

Test the DB connection from `backend/`:

```bash
python test_supabase.py
```

---

## 🏗️ Database Setup

Run SQL scripts from `/database/` in the **Supabase SQL Editor** in this order:

| File | Description |
|------|-------------|
| `migration.sql` | Full schema — run this first on a fresh DB |
| `007_relapse_interceptor_upgrade.sql` | Relapse interceptor tables |
| `008_notification_history.sql` | Notification history |
| `009_oracle_chat.sql` | Oracle chat tables |
| `010_oracle_sessions.sql` | Oracle session management |
| `seed_knowledge_base.sql` | English knowledge base (33 entries) |
| `011_ukrainian_knowledge_base.sql` | Ukrainian knowledge base (26 entries) |

**Do NOT also run** `001_extensions.sql` … `006_functions.sql` if you already ran `migration.sql` — those files are the same schema split into parts. Running both causes duplicate-type / duplicate-table errors.

**Fresh DB vs existing DB:**
- **New project:** run `migration.sql` once, then `007` → `010`, then both seed files.
- **Already ran an older `migration.sql`:** still run `007`–`010` (they use `IF NOT EXISTS` / safe alters). Re-running `migration.sql` on a populated DB may error on types that already exist.

**Oracle / chat will not work** without `009_oracle_chat.sql` and `010_oracle_sessions.sql` — they are not inside `migration.sql`.

After running the seed scripts, generate embeddings so the Oracle RAG works:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/ai/embed-knowledge-base
```

This is safe to call multiple times — it skips rows that already have embeddings.

**Requirements for this endpoint:** backend must be running; `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must be valid. Response `{"embedded": 0}` means either seeds were not run or embeddings already exist.

On Windows PowerShell (if `curl` is an alias):

```powershell
Invoke-WebRequest -Method POST -Uri "http://127.0.0.1:8000/api/v1/ai/embed-knowledge-base"
```

---

## 🩺 Troubleshooting & Common Pitfalls

### Setup & paths

| Problem | Likely cause | Fix |
|---------|----------------|-----|
| `requirements.txt` not found | Running pip from repo root | `cd backend` first |
| `ModuleNotFoundError: app` | uvicorn started outside `backend/` | Run uvicorn from `backend/` |
| `venv\Scripts\activate` blocked (Windows) | PowerShell execution policy | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` or use `venv\Scripts\Activate.ps1` |
| `.env` changes ignored | Server not restarted | Restart backend and frontend |

### Supabase & auth

| Problem | Likely cause | Fix |
|---------|----------------|-----|
| Login works but API returns 401 | Wrong anon key or expired session | Match keys in both `.env` files; log out and in again |
| `Profile not found` after register | Migrations not applied | Run `migration.sql`; trigger `handle_new_user` creates `profiles` on signup |
| Email link never arrives | Confirm email enabled | Disable confirm email in Supabase Auth (dev) or check spam |
| OAuth/callback errors | Missing redirect URL | Add `http://localhost:3000/callback` in Supabase URL config |

### Database & Oracle RAG

| Problem | Likely cause | Fix |
|---------|----------------|-----|
| Oracle gives generic answers, no book links | No embeddings | Run seeds + `POST /api/v1/ai/embed-knowledge-base` |
| `extension "vector" does not exist` | pgvector not enabled | `migration.sql` creates it; on hosted Supabase it should work — re-run extensions block |
| SQL errors on re-run | Duplicate migration | Don't re-run `migration.sql` on existing DB; use only `007`–`011` |
| Duplicate enum/type errors | Ran `001`–`006` after `migration.sql` | Use only `migration.sql` + `007`–`011` |

### AI (Gemini)

| Problem | Likely cause | Fix |
|---------|----------------|-----|
| Journal analysis fails | Invalid/missing `GEMINI_API_KEY` | Create key at [Google AI Studio](https://aistudio.google.com/); check quotas |
| Slow or rate-limited | Free tier limits | Wait and retry; set `ENABLE_PATTERN_INTERCEPTOR=false` to reduce background calls |
| Want non-Gemini LLM | Optional fallback | Uncomment `AI_PROVIDER=openai_compat` + Groq/DeepSeek vars in `backend/.env` |

### Media journal (audio/video)

| Problem | Likely cause | Fix |
|---------|----------------|-----|
| Upload fails / storage error | No `journal-media` bucket | Create bucket in Supabase Storage (see above) |
| Transcription fails | Missing key or bad media URL | Check `GEMINI_API_KEY`; ensure upload succeeded |
| Forge: "missing from local storage" | Browser cleared IndexedDB | Re-record; local draft is separate from cloud upload |

### Push notifications (PWA)

| Problem | Likely cause | Fix |
|---------|----------------|-----|
| Enable push button errors | Missing VAPID public key | Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = same value as `VAPID_PUBLIC_KEY` in backend |
| Push never arrives | Workers disabled or no subscription | Enable push in Settings; `ENABLE_PATTERN_INTERCEPTOR` / reminders as needed |
| Works on desktop, not iOS | Safari limitations | Add to Home Screen; iOS 16.4+ for Web Push; HTTPS required in production |
| Push only in dev with HTTP | Browser policy | `localhost` is allowed; production needs HTTPS |

### API & networking

| Problem | Likely cause | Fix |
|---------|----------------|-----|
| Network error in UI, backend up | Wrong `NEXT_PUBLIC_API_URL` or frontend not restarted | Point to `http://127.0.0.1:8000`; restart `npm run dev` |
| CORS error (rare) | Calling `:8000` directly from browser | Use `/api/backend` proxy — already default in `frontend/src/lib/api.ts` |
| 307 / empty response on POST | Trailing slash mismatch | Proxy handles this; don't add trailing slashes to API paths manually |

### Background workers

With the backend running, APScheduler starts automatically. By default **pattern interceptor** runs every 15 minutes and calls Gemini for users with enough check-in history. For a quiet dev machine:

```env
ENABLE_PATTERN_INTERCEPTOR=false
ENABLE_SCHEDULED_REMINDERS=false
ENABLE_RELAPSE_INTERCEPTOR=false
```

---

## ✅ Quick Verification Checklist

- [ ] `GET http://127.0.0.1:8000/health` → `{"status":"alive",...}`
- [ ] `python test_supabase.py` → successful connection
- [ ] Frontend opens at `http://localhost:3000`
- [ ] Register → land on `/onboarding` → finish → `/dashboard`
- [ ] `POST .../embed-knowledge-base` → `"embedded"` > 0 (first time)
- [ ] Oracle chat returns resource recommendations (books/videos)
- [ ] (Optional) Push enabled in Settings after VAPID keys set

---

## 🔐 Security

- Never commit `backend/.env` or `frontend/.env.local`
- Use only `.env.example` / `.env.local.example` with placeholder values
- If real keys were ever stored in git history, rotate them before publishing
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — backend only, never expose to the client
- `POST /api/v1/ai/embed-knowledge-base` has no auth guard (dev convenience) — restrict or protect before public deployment

---

## 📜 License

Project developed for Bachelor's University Work. All rights reserved. 2026.
