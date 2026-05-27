# HabitRefactor 🔥

🇬🇧 [English version](README.md) · 🤖 [Архітектура AI](docs/AI.uk.md)

> **Перебудуй звички — переосмисли себе.**

**HabitRefactor** — платформа нового покоління для відстеження звичок і психологічної трансформації. На відміну від звичайних чеклістів, вона використовує **Gemini 2.0 AI** для аналізу емоційного підґрунтя вашої подорожі через мультимодальне ведення щоденника (голос, відео та текст), відображаючи прогрес не лише у вигляді серій (streaks), а й у змінах ідентичності.

---

## ✨ Ключові можливості

- **🎙️ Мультимодальний AI-щоденник**  
  Записуйте аудіо- або відеощоденники прямо в браузері. На базі Gemini 2.0 Flash — дослівна транскрипція, визначення емоцій (радарні діаграми) та витяг ключових тем.

- **🦾 Відстеження на основі ідентичності**  
  Визначте свою *ідентичність Воїна*. Застосунок зосереджений на тому, щоб стати людиною, у якої немає цієї звички, а не просто на уникненні поведінки.

- **🧙 Oracle AI Chat**  
  Розмовний AI-асистент із повним RAG-контекстом — відповідає на основі ваших щоденників, чек-інів, серій і кураторської бази знань (книги, наука, відео). Рекомендує книги, YouTube-канали, статті та професійну допомогу. Відповідає вашою мовою (українська/англійська).

- **📊 Емоційний інтелект і глибока аналітика**  
  Теплова карта на 365 днів у стилі GitHub, аналіз ризику за годинами та днями тижня, розбивка серій і візуалізація патернів тригерів.

- **🚨 Розумна система сповіщень**  
  4 типи сповіщень про поведінкові патерни (година високого ризику, небезпечний день тижня, послідовні зриви, критична точка серії) + виявлення небезпеки в щоденнику + заплановані нагадування + святкування віх серій. Усе з урахуванням часового поясу та захистом від повторних сповіщень (cooldown). Двомовність (UK/EN).

- **🔥 Проєкції болю та задоволення**  
  AI-генеровані проєкції «ціни бездіяльності» з використанням ваших записів у щоденнику як контексту.

- **📚 Knowledge Base RAG**  
  85+ кураторських записів (книги, YouTube, стратегії КПТ, українські ресурси) з семантичним пошуком pgvector. Oracle підбирає найрелевантнішу мудрість саме для вашої ситуації.

- **🌍 Український та англійський інтерфейс**  
  Повна локалізація інтерфейсу з перемикачем EN/UK у налаштуваннях.

- **📱 PWA Ready**  
  Можна встановити на мобільні пристрої як Progressive Web App з фоновою синхронізацією та підтримкою iOS Safari.

---

## 🛠️ Технологічний стек

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

## 📁 Структура проєкту

```
HabitRefactor/
├── backend/          ← FastAPI, requirements.txt, .env
├── frontend/         ← Next.js, .env.local
└── database/         ← SQL-міграції та seeds (запуск у Supabase)
```

У **корені** репозиторію немає `requirements.txt` і `.env` — шукайте їх у `backend/` та `frontend/`.

---

## 🚀 Початок роботи

### Вимоги
- [Node.js 18+](https://nodejs.org/)
- [Python 3.10+](https://www.python.org/)
- [Supabase Account](https://supabase.com/) — безкоштовного тарифу достатньо
- [Google AI Studio Key](https://aistudio.google.com/) (Gemini)

---

### 1. Налаштування Backend

> **Важливо:** `requirements.txt` і `.env.example` лежать у папці **`backend/`**, а не в корені репозиторію. Команди нижче виконуйте з каталогу `backend/` (після `cd backend`). Якщо залишаєтесь у корені проєкту — використайте `pip install -r backend/requirements.txt`.

```bash
cd backend          # обов'язково — залежності в backend/
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt   # файл: backend/requirements.txt
cp .env.example .env              # файл: backend/.env.example
# Windows (PowerShell) замість cp:
# copy .env.example .env
```

Відредагуйте `backend/.env` своїми значеннями (див. коментарі у файлі). Мінімально необхідні поля:

```env
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_google_ai_key
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_EMAIL=mailto:your_email@example.com
```

**Ролі ключів (не плутайте):**

| Ключ | Де | Навіщо |
|-----|-----|--------|
| `SUPABASE_ANON_KEY` | Backend + Frontend | Запити від імені користувача, RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Лише backend** | Адмін-операції: медіа, embeddings, workers — **ніколи** у frontend |
| `GEMINI_API_KEY` | Лише backend | AI-аналіз, Oracle, embeddings |
| `VAPID_PUBLIC_KEY` | Backend + Frontend (`NEXT_PUBLIC_…`) | Має **збігатися** на обох сторонах |
| `VAPID_PRIVATE_KEY` | Лише backend | Підпис push-повідомлень |

Опційні прапорці в `backend/.env` (дефолти — у `.env.example`):

| Змінна | За замовчуванням | Ефект |
|--------|------------------|-------|
| `ENABLE_PATTERN_INTERCEPTOR` | `true` | Аналіз патернів кожні 15 хв — витрачає квоту Gemini |
| `ENABLE_RELAPSE_INTERCEPTOR` | `false` | Push-цикл «небезпечної зони» |
| `ENABLE_SCHEDULED_REMINDERS` | `false` | Нагадування за розкладом |

Після зміни `.env` **перезапустіть** backend (`Ctrl+C` → знову uvicorn).

Згенеруйте VAPID-ключі (потрібні для push-сповіщень):
```bash
npx web-push generate-vapid-keys
```

Запустіть сервер (також із каталогу **`backend/`**):
```bash
python -m uvicorn app.main:app --reload
```

Документація API: [http://127.0.0.1:8000/api/v1/docs](http://127.0.0.1:8000/api/v1/docs)

---

### 2. Налаштування Frontend

> **Важливо:** `.env.local.example` лежить у папці **`frontend/`**. Команди нижче виконуйте з каталогу `frontend/` (після `cd frontend`).

```bash
cd frontend         # обов'язково — конфіг у frontend/
npm install
cp .env.local.example .env.local   # файл: frontend/.env.local.example
# Windows (PowerShell):
# copy .env.local.example .env.local
```

Відредагуйте `frontend/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_vapid_public_key
```

```bash
npm run dev
```
Застосунок: [http://localhost:3000](http://localhost:3000)

**Як frontend звертається до backend:** браузер **не** викликає `:8000` напряму. Усі API-запити йдуть через Next.js-проксі `/api/backend/*` → `NEXT_PUBLIC_API_URL`. Це обходить проблеми CORS. Тримайте `NEXT_PUBLIC_API_URL` на адресу запущеного backend (`http://127.0.0.1:8000` і `http://localhost:8000` обидва працюють — оберіть один варіант).

Після зміни `.env.local` **перезапустіть** frontend (`Ctrl+C` → `npm run dev`).

### Рекомендований порядок запуску

1. Проєкт Supabase + SQL-міграції (нижче)
2. `backend` — uvicorn
3. `embed-knowledge-base` (curl) після seeds
4. `frontend` — `npm run dev`
5. Реєстрація → `/onboarding`

---

## ☁️ Налаштування Supabase (перший раз)

1. Створіть проєкт на [supabase.com](https://supabase.com/).
2. **Settings → API** — скопіюйте `Project URL`, `anon` і `service_role` у `backend/.env` та `frontend/.env.local`.
3. **Authentication → URL Configuration** — додайте redirect для локальної розробки:
   - `http://localhost:3000/callback`
   - `http://127.0.0.1:3000/callback`
4. **Authentication → Providers → Email** — для локальних тестів можна вимкнути **Confirm email**, щоб реєстрація працювала без листа.
5. **Storage → New bucket** — створіть bucket з ім’ям **`journal-media`** (для dev найпростіше — public). Потрібно для аудіо/відео щоденника та AI-транскрипції. У SQL-скриптах цього **немає** — без bucket завантаження медіа падає з помилкою storage.

Перевірка підключення до БД з `backend/`:

```bash
python test_supabase.py
```

---

## 🏗️ Налаштування бази даних

Запустіть SQL-скрипти з `/database/` у **Supabase SQL Editor** у такому порядку:

| Файл | Опис |
|------|------|
| `migration.sql` | Повна схема — запускайте першим на чистій БД |
| `007_relapse_interceptor_upgrade.sql` | Таблиці relapse interceptor |
| `008_notification_history.sql` | Історія сповіщень |
| `009_oracle_chat.sql` | Таблиці Oracle chat |
| `010_oracle_sessions.sql` | Керування сесіями Oracle |
| `seed_knowledge_base.sql` | Англомовна база знань (59+ записів) |
| `011_ukrainian_knowledge_base.sql` | Українська база знань (26 записів) |

**НЕ запускайте** також `001_extensions.sql` … `006_functions.sql`, якщо уже виконали `migration.sql` — це та сама схема частинами. Подвійний запуск дає помилки duplicate type/table.

**Чиста БД vs існуюча:**
- **Новий проєкт:** один раз `migration.sql`, потім `007` → `010`, потім обидва seed-файли.
- **Стара версія `migration.sql` уже була:** все одно виконайте `007`–`010` (безпечні `IF NOT EXISTS`). Повторний `migration.sql` на заповненій БД може падати на типах.

**Oracle / чат не працюватимуть** без `009_oracle_chat.sql` і `010_oracle_sessions.sql` — їх немає всередині `migration.sql`.

Після seed-скриптів згенеруйте embeddings, щоб працював Oracle RAG:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/ai/embed-knowledge-base
```

Безпечно викликати кілька разів — рядки, у яких embeddings уже є, пропускаються.

**Що потрібно для цього endpoint:** запущений backend; валідні `GEMINI_API_KEY` і `SUPABASE_SERVICE_ROLE_KEY`. Відповідь `{"embedded": 0}` — або seeds не запускали, або embeddings уже є.

У Windows PowerShell (якщо `curl` — це alias):

```powershell
Invoke-WebRequest -Method POST -Uri "http://127.0.0.1:8000/api/v1/ai/embed-knowledge-base"
```

---

## 🩺 Типові проблеми та підводні камені

### Налаштування та шляхи

| Проблема | Ймовірна причина | Рішення |
|----------|------------------|---------|
| `requirements.txt` не знайдено | pip з кореня репо | Спочатку `cd backend` |
| `ModuleNotFoundError: app` | uvicorn не з `backend/` | Запускайте uvicorn з `backend/` |
| `venv\Scripts\activate` заблоковано (Windows) | Execution policy PowerShell | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` або `venv\Scripts\Activate.ps1` |
| Зміни `.env` не застосовуються | Сервер не перезапущено | Перезапустіть backend і frontend |

### Supabase та авторизація

| Проблема | Ймовірна причина | Рішення |
|----------|------------------|---------|
| Вхід є, API дає 401 | Невірний anon key або прострочена сесія | Однакові ключі в обох `.env`; вийти й увійти знову |
| `Profile not found` після реєстрації | Міграції не застосовані | Запустіть `migration.sql`; тригер `handle_new_user` створює `profiles` |
| Лист підтвердження не приходить | Увімкнено Confirm email | Вимкніть у Supabase Auth (dev) або перевірте спам |
| Помилки OAuth/callback | Немає redirect URL | Додайте `http://localhost:3000/callback` у Supabase |

### База даних та Oracle RAG

| Проблема | Ймовірна причина | Рішення |
|----------|------------------|---------|
| Oracle відповідає загально, без посилань на книги | Немає embeddings | Seeds + `POST /api/v1/ai/embed-knowledge-base` |
| `extension "vector" does not exist` | pgvector не ввімкнено | `migration.sql` створює extension; на Supabase зазвичай ок |
| SQL-помилки при повторному запуску | Дубль міграції | Не перезапускайте `migration.sql` на існуючій БД; лише `007`–`011` |
| Duplicate enum/type | Запускали `001`–`006` після `migration.sql` | Лише `migration.sql` + `007`–`011` |

### AI (Gemini)

| Проблема | Ймовірна причина | Рішення |
|----------|------------------|---------|
| Аналіз щоденника падає | Невірний/відсутній `GEMINI_API_KEY` | Ключ на [Google AI Studio](https://aistudio.google.com/); перевірте квоти |
| Повільно або rate limit | Ліміт безкоштовного тарифу | Зачекайте; `ENABLE_PATTERN_INTERCEPTOR=false` зменшує фонові виклики |
| Потрібен інший LLM | Опційний fallback | Розкоментуйте `AI_PROVIDER=openai_compat` + Groq/DeepSeek у `backend/.env` |

### Медіа-щоденник (аудіо/відео)

| Проблема | Ймовірна причина | Рішення |
|----------|------------------|---------|
| Помилка upload / storage | Немає bucket `journal-media` | Створіть у Supabase Storage |
| Транскрипція не працює | Ключ або битий URL медіа | Перевірте `GEMINI_API_KEY` і успішний upload |
| Forge: «missing from local storage» | Браузер очистив IndexedDB | Запишіть знову; локальний чернетка ≠ хмара |

### Push-сповіщення (PWA)

| Проблема | Ймовірна причина | Рішення |
|----------|------------------|---------|
| Помилка при ввімкненні push | Немає VAPID public key | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = той самий, що `VAPID_PUBLIC_KEY` у backend |
| Push не приходить | Workers вимкнені або немає підписки | Увімкніть у Settings; за потреби pattern/reminders |
| На desktop є, на iOS ні | Обмеження Safari | «На екран Додому»; Web Push з iOS 16.4+; у prod потрібен HTTPS |
| Push лише на localhost по HTTP | Політика браузера | У production — HTTPS |

### API та мережа

| Проблема | Ймовірна причина | Рішення |
|----------|------------------|---------|
| Network error у UI, backend працює | Невірний `NEXT_PUBLIC_API_URL` або frontend не перезапущено | `http://127.0.0.1:8000`; перезапуск `npm run dev` |
| CORS (рідко) | Прямий виклик `:8000` з браузера | Використовуйте проксі `/api/backend` — уже в `frontend/src/lib/api.ts` |
| 307 / порожня відповідь на POST | Trailing slash | Проксі це обробляє; не додавайте `/` в кінці шляхів API вручну |

### Фонові workers

Після старту backend автоматично запускається APScheduler. За замовчуванням **pattern interceptor** кожні 15 хв викликає Gemini для користувачів з достатньою історією check-in. Для «тихого» dev:

```env
ENABLE_PATTERN_INTERCEPTOR=false
ENABLE_SCHEDULED_REMINDERS=false
ENABLE_RELAPSE_INTERCEPTOR=false
```

---

## ✅ Швидкий чеклист перевірки

- [ ] `GET http://127.0.0.1:8000/health` → `{"status":"alive",...}`
- [ ] `python test_supabase.py` → успішне підключення
- [ ] Frontend відкривається на `http://localhost:3000`
- [ ] Реєстрація → `/onboarding` → завершення → `/dashboard`
- [ ] `POST .../embed-knowledge-base` → `"embedded"` > 0 (перший раз)
- [ ] Oracle рекомендує ресурси (книги/відео)
- [ ] (Опційно) Push увімкнено в Settings після налаштування VAPID

---

## 🔐 Безпека

- Ніколи не комітьте `backend/.env` або `frontend/.env.local`
- У репозиторії лише `.env.example` / `.env.local.example` з placeholder-значеннями
- Якщо справжні ключі колись потрапили в git history — обов’язково ротуйте їх перед публікацією
- `SUPABASE_SERVICE_ROLE_KEY` обходить RLS — лише backend, ніколи не потрапляйте в клієнт
- `POST /api/v1/ai/embed-knowledge-base` без авторизації (зручність для dev) — захистіть перед публічним деплоєм

---

## 📜 Ліцензія

Проєкт розроблено в рамках бакалаврської роботи в університеті. Усі права захищені. 2026.
