# HabitRefactor 🎙️🔥

> **Refactor your habits, reforge your identity.**

**HabitRefactor** is a next-generation habit tracking and psychological transformation platform. Unlike traditional checklists, it leverages **Gemini 2.0 AI** to analyze the emotional undercurrents of your journey through multimodal journaling (voice, video, and text), mapping your progress not just in streaks, but in identity shifts.

---

## ✨ Key Features

- **🎙️ Multimodal AI Journaling**  
  Record audio or video journals directly in the browser. Our AI-driven pipeline (powered by Gemini 2.0 Flash) provides verbatim transcription, emotion detection (radar charts), and key theme extraction.
  
- **🦾 Identity-Based Tracking**  
  Define your *Warrior Identity*. The app focuses on becoming the person who doesn't have the habit, rather than just avoiding the behavior.

- **📊 Emotional Intelligence Radar**  
  Visual representation of your emotional state over time. Understand the "why" behind your relapses and high-performance days.

- **🔥 Pain & Pleasure Projections**  
  AI-generated insights that project the cost of inaction vs. the reward of consistency, using your own journal entries as context.

- **🚨 Relapse Interceptor (Web Push)**  
  A background AI Oracle that monitors your check-ins and stress levels. If you enter the "Danger Zone", it intercepts you with a proactive push notification warning before a relapse occurs.

- **📱 Secure, Private & PWA Ready**  
  Powered by Supabase for enterprise-grade authentication. Installable on mobile devices as a Progressive Web App (PWA) with background sync.

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js (TypeScript)
- **State Management:** Zustand & TanStack Query (v5)
- **Styling:** CSS Modules & Radix UI (Premium Dark Mode)
- **Charts:** Recharts (Animated Emotional Radar)
- **PWA/Notifications:** Next-PWA & Service Workers
- **Auth/DB:** Supabase SSR

### Backend
- **Framework:** FastAPI (Python)
- **AI Engine:** Google Gemini 2.0 Flash (Multimodal)
- **Storage:** Supabase Storage (S3-compatible)
- **Database:** Supabase (PostgreSQL with RLS)
- **Background Tasks:** APScheduler (for Relapse Interceptor)
- **Push Notifications:** PyWebPush

---

## 🚀 Getting Started

### Prerequisites
- [Node.js 18+](https://nodejs.org/)
- [Python 3.10+](https://www.python.org/)
- [Supabase Account](https://supabase.com/)
- [Google AI Studio Key](https://aistudio.google.com/) (for Gemini)

---

### 1. Backend Setup

1. **Clone and navigate to backend:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment:**
   Copy template and fill secrets locally (do not commit):
   ```bash
   cp .env.example .env
   ```
   Then edit `backend/.env`:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   GEMINI_API_KEY=your_google_ai_key
   GEMINI_MODEL=gemini-2.0-flash
   ENABLE_RELAPSE_INTERCEPTOR=true
   VAPID_PUBLIC_KEY=your_vapid_public_key
   VAPID_PRIVATE_KEY=your_vapid_private_key
   VAPID_CONTACT_EMAIL=mailto:your_email@example.com
   ```

4. **Run the server:**
   ```bash
   python -m uvicorn app.main:app --reload
   ```
   *The API will be available at [http://127.0.0.1:8000/api/v1/docs](http://127.0.0.1:8000/api/v1/docs)*

---

### 2. Frontend Setup

1. **Navigate to frontend:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Copy template and fill values locally:
   ```bash
   cp .env.local.example .env.local
   ```
   Then edit `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   *The app will be available at [http://localhost:3000](http://localhost:3000)*

---

## 🏗️ Database Setup

Ensure your Supabase database has the required schema. You can run the SQL scripts found in `/database/` sequentially:
1. `001_tables.sql` — Core tables.
2. `002_rls.sql` — Row Level Security policies.
3. `003...` to `007_relapse_interceptor_upgrade.sql` — Feature migrations and upgrades (run all files in order).
4. `seed_knowledge_base.sql` — Initial patterns for AI analysis.

---

## 🔐 Security Before Public Git

- Never commit `backend/.env` or `frontend/.env.local`.
- Use only `.env.example` and `.env.local.example` with placeholder values.
- If any real keys were ever stored in git history, rotate them in providers (Supabase/Gemini/Groq) before publishing.
- After cloning on another PC, recreate local env files from examples and run the app normally.

---

## 📜 License

Project developed for Bachelours University Work. All rights reserved. 2026.
