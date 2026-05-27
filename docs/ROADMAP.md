# HabitRefactor: Future Roadmap & High-Impact Features

Цей документ відстежує стан розробки "важких" фіч, а також фіксує виконані та заплановані кроки.

## ✅ Нещодавно завершено (Completed)

- **Pattern-Based Notifications**: Система патернів у APScheduler (кожні 15 хв). 4 типи попереджень: небезпечна година дня, небезпечний день тижня, кілька зривів за 24 год, наближення до історичної точки зриву стріку. Cooldown 6 год, timezone-aware.
- **Oracle AI 2.0 — Ресурси та Мова**: Oracle тепер рекомендує книги, відео, статті та похід до спеціаліста з клікабельними посиланнями. Відповідає мовою користувача (українська/англійська). RAG повертає URL та метадані джерел.
- **Ukrainian Knowledge Base**: 26 Ukrainian-мовних записів у `knowledge_base` з embeddings — книги (Атомні звички, Нація дофаміну), YouTube (Вадим Демченко, Наталія Холоденко), CBT-стратегії, гаряча лінія.
- **Українська мова інтерфейсу (i18n)**: Перемикач EN/UK у Settings. `useT()` hook застосовано на всіх сторінках включно з `pain`, `reminders`, `settings`, `oracle`, `onboarding`.
- **Onboarding Flow**: Нова сторінка `/onboarding` (3 кроки: ім'я + timezone, категорія звички, підтвердження). Без sidebar, окремий layout.
- **Settings — Save Profile**: Кнопка "Save Changes" підключена до `PUT /auth/me`, оновлює `display_name` в реальному часі.
- **Notification History & PWA**: Створено повноцінний центр сповіщень (`NotificationBell`), RLS міграція `008`. Виправлено специфічні проблеми PWA на iOS Safari.
- **Auto Journal Danger Alerts**: Інтегровано автоматичний сканер в APScheduler (кожні 5 хв). Якщо запис містить тривожні слова або низький настрій — відсилає Web Push.
- **Relapse Interceptor & VAPID**: Налаштовано VAPID ключі, Web Push Notifications, E2E тести для перевірки повної цепочки.
- **AI Insights 2.0**: Парсинг збільшених обсягів даних (до 15 абзаців). Вирішено проблеми з лімітом токенів (max_output_tokens=16384).
- **Check-in Engine**: Повністю реорганізовано потік збереження Check-in (фікси втрати тригерів, додано `mood_after`, виправлено подвійні чекіни).
- **Database Schema Updates**: Додані поля `tomorrow_action`, `motivational_close`, RLS-політики для видалення, міграція `007` для Push Subscriptions.
- **Heatmap & Deep Stats**: Додано 365-day GitHub-style Heatmap, аналітику по днях тижня та годинах ризику в Dashboard.
- **Інтерактивний AI-чат (Oracle)**: Повноцінний чат з RAG, історія сесій, suggested actions, optimistic UI. Backend `/ai/oracle/chat` + sessions, таблиця `oracle_chats`.
- **AI Knowledge Base & RAG**: Таблиця `knowledge_base` з 59+ записами, vector embeddings (pgvector), семантичний пошук у Oracle та Daily Analysis.

---

## 📋 TODO (Backlog)

## 👥 Accountability Partner
**Status**: [BACKLOG]
**Концепт**: Поділитися своїм прогресом з другом — він отримує push-сповіщення при зриві та може підтримати.
- Користувач запрошує партнера через посилання або email
- Партнер бачить стрік і останній чекін (без деталей журналу — privacy)
- При зриві партнер отримує push: "Твій друг [ім'я] потребує підтримки сьогодні"
- При досягненні milestone (30 днів тощо) партнер отримує push з привітанням
- Налаштування: можна вимкнути сповіщення партнеру або обрати що саме він бачить
- **DB**: таблиця `accountability_partners` (user_id, partner_user_id, status, permissions)
- **Backend**: `/auth/partners` ендпоінти + тригер в scheduler при зриві
- **Frontend**: секція в Settings + публічна сторінка `/partner/:token`

---

## 🌐 Анонімна Спільнота (Community Feed)
**Status**: [BACKLOG]
**Концепт**: Анонімна стрічка де люди діляться перемогами, зривами і підтримують одне одного.
- Пости: стрік-досягнення (30 днів без куріння), подолання потягу, мотиваційна цитата
- Повна анонімність — ім'я не відображається, лише категорія звички та стрік
- Реакції: 🔥 "Stay hard" / 💪 "Warrior" (без коментарів — менше токсичності)
- Модерація: AI-фільтр на небезпечний контент перед публікацією
- Опційно: можна поділитись постом з Oracle (він додає до свого контексту)
- **DB**: таблиця `community_posts` (anonymous_id, habit_category, streak_days, content, reactions)
- **Backend**: `/community` ендпоінти з rate limiting
- **Frontend**: сторінка `/community` з infinite scroll

---

## 🚀 Підготовка до Релізу (Deploy)
**Status**: [BACKLOG]
**Концепт**: Розгортання проекту для реального використання користувачами у Production-середовищі.
- **Frontend**: Деплой Next.js додатку на Vercel.
- **Backend**: Розгортання FastAPI сервера на Render або Fly.io.
- **Database / Storage**: Налаштування окремого production-інстансу Supabase, безпечних середовищ та VAPID-ключів.
- **CI/CD**: Налаштування автоматичного білду і деплою при пуші в гілку `main`.
