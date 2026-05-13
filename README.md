# HabitRefactor 🔥

> **Refactor your habits, reforge your identity.**

**HabitRefactor** is a next-generation habit tracking and psychological transformation platform. Unlike traditional checklists, it leverages **Gemini 2.0 AI** to analyze the emotional undercurrents of your journey through multimodal journaling (voice, video, and text), mapping your progress not just in streaks, but in identity shifts.

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
  4 types of behavioral pattern alerts (high-risk hour, dangerous weekday, consecutive relapses, streak break point) + journal danger detection + scheduled reminders. All timezone-aware with cooldown protection.

- **🔥 Pain & Pleasure Projections**  
  AI-generated cost-of-inaction projections using your own journal entries as context.

- **📚 Knowledge Base RAG**  
  59+ curated entries (books, YouTube, CBT strategies, Ukrainian resources) with pgvector semantic search. Oracle pulls the most relevant wisdom for your exact situation.

- **🌍 Ukrainian & English UI**  
  Full interface localization with an EN/UK switcher in Settings.

- **📱 PWA Ready**  
  Installable on mobile devices as a Progressive Web App with background sync and iOS Safari support.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 15 (TypeScript)
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
- **Background Workers:** APScheduler (pattern interceptor, relapse alerts, journal scanner)
- **Push Notifications:** PyWebPush (VAPID)

---

## 🚀 Getting Started

### Prerequisites
- [Node.js 18+](https://nodejs.org/)
- [Python 3.10+](https://www.python.org/)
- [Supabase Account](https://supabase.com/)
- [Google AI Studio Key](https://aistudio.google.com/) (Gemini)

---

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env`:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_google_ai_key
GEMINI_MODEL=gemini-2.0-flash
GEMINI_EMBEDDING_MODEL=text-embedding-004
ENABLE_RELAPSE_INTERCEPTOR=true
ENABLE_PATTERN_INTERCEPTOR=true
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_CONTACT_EMAIL=mailto:your_email@example.com
```

```bash
python -m uvicorn app.main:app --reload
```
API docs: [http://127.0.0.1:8000/api/v1/docs](http://127.0.0.1:8000/api/v1/docs)

---

### 2. Frontend Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
```

Edit `frontend/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
```

```bash
npm run dev
```
App: [http://localhost:3000](http://localhost:3000)

---

## 🏗️ Database Setup

Run SQL scripts from `/database/` in Supabase SQL Editor in order:

| File | Description |
|------|-------------|
| `migration.sql` | Full schema (run this first on a fresh DB) |
| `007_relapse_interceptor_upgrade.sql` | Relapse interceptor tables |
| `008_notification_history.sql` | Notification history |
| `009_oracle_chat.sql` | Oracle chat tables |
| `010_oracle_sessions.sql` | Oracle session management |
| `seed_knowledge_base.sql` | English knowledge base (59+ entries) |
| `011_ukrainian_knowledge_base.sql` | Ukrainian knowledge base (26 entries) |

After inserting knowledge base data, generate embeddings via the backend (see API docs).

---

## 🔐 Security

- Never commit `backend/.env` or `frontend/.env.local`
- Use only `.env.example` / `.env.local.example` with placeholder values
- If real keys were ever stored in git history, rotate them before publishing

---

## 📜 License

Project developed for Bachelor's University Work. All rights reserved. 2026.
