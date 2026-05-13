# HabitRefactor: Future Roadmap & High-Impact Features

Цей документ відстежує стан розробки "важких" фіч, а також фіксує виконані та заплановані кроки.

## ✅ Нещодавно завершено (Completed)
- **Notification History & PWA**: Створено повноцінний центр сповіщень (`NotificationBell`), RLS міграція `008`. Виправлено специфічні проблеми PWA на iOS Safari (показ банера "Add to Home Screen").
- **Auto Journal Danger Alerts**: Інтегровано автоматичний сканер в APScheduler (кожні 5 хв). Якщо запис містить тривожні слова або низький настрій, система автоматично відсилає Web Push сповіщення.
- **Relapse Interceptor & VAPID**: Успішно налаштовано VAPID ключі, Web Push Notifications та створено E2E тести (Journal alert test) для перевірки повної цепочки.
- **AI Insights 2.0**: Парсинг збільшених обсягів даних (до 15 абзаців). Вирішено проблеми з лімітом токенів (max_output_tokens=16384).
- **Check-in Engine**: Повністю реорганізовано потік збереження `Check-in` (фікси втрати тригерів, додано емоційний стан `mood_after`, виправлено подвійні чекіни).
- **Database Schema Updates**: Додані поля `tomorrow_action`, `motivational_close`, RLS-політики для видалення, а також міграція `007` для Push Subscriptions.
- **🗺️ Heatmap & Deep Stats**: Додано 365-day GitHub-style Heatmap, аналітику по днях тижня та годинах ризику безпосередньо в Dashboard (War Room).

---


## TODO




## 🧙‍♂️ Інтерактивний AI-чат (Oracle)
**Status**: [DONE ✅]
**Концепт**: Повноцінна сторінка "Чат з Оракулом", де користувач зможе вести діалог зі своїм ШІ-асистентом.
- **Доступ до RAG**: Чатбот відповідає, спираючись на історію записів журналу, чекінів та базу знань (книги, відео, наукові статті).
- **Можливості**: Питання типу "Проаналізуй мої записи за останній тиждень, що найчастіше викликає в мене тягу до куріння?".
- **Інтерфейс**: Чат з підказками, історією повідомлень, optimistic UI, suggested actions.
- **Реалізація**: Backend `/ai/oracle/chat` + `/ai/oracle/history`, Frontend `/oracle`, таблиця `oracle_chats` з RLS.

---

## 🚀 Підготовка до Релізу (Deploy)
**Status**: [BACKLOG]
**Концепт**: Розгортання проекту для реального використання користувачами у Production-середовищі.
- **Frontend**: Деплой Next.js додатку на Vercel.
- **Backend**: Розгортання FastAPI сервера на Render або Fly.io.
- **Database / Storage**: Налаштування окремого production-інстансу Supabase, безпечних середовищ та VAPID-ключів.
- **CI/CD**: Налаштування автоматичного білду і деплою при пуші в гілку `main`.


---

## 📚 AI Knowledge Base & Therapy (Smart Recommendations)
**Status**: [DONE ✅]
**Концепт**: Інтелектуальна система рекомендацій на основі вашого поточного стану та зривів.
- ✅ Заповнена таблиця `knowledge_base` з 33 записами: книги (Atomic Habits, Dopamine Nation, Easyway), наукові статті, YouTube-відео (Huberman, Kurzgesagt, HealthyGamerGG).
- ✅ Згенеровані vector embeddings для семантичного пошуку (RAG).
- ✅ AI аналізує журнали та чекіни і автоматично підтягує релевантні ресурси в Daily Analysis та Oracle Chat.
- ✅ Клікабельні посилання в рекомендаціях (парсер markdown-лінків на фронтенді).

