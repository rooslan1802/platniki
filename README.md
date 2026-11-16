# Дримус

Мобильное PWA-приложение для учёта учеников и ежемесячной оплаты.

## Локальный запуск

```bash
npm install
npm run dev
```

Без настроек Supabase приложение использует локальный демонстрационный профиль браузера. Эти данные не синхронизируются с другими устройствами.

## Supabase

Для Дримус создан отдельный проект Supabase `Drimus` (`shednvgyozvkdqqebukd`). Он не связан с базой `Dashboard`, поэтому таблицы и данные этих приложений не смешиваются. В проекте Drimus уже созданы таблицы `studios`, `clubs`, `students`, `payments`, `payment_schedules` и `pause_history`; для них включён RLS с доступом только к записям вошедшего пользователя.

В локальном `.env` уже настроены адрес этого проекта и переданный публичный publishable key. Файл `.env` исключён из Git. Для входа приложения ещё нужно создать пользователя: Supabase → Authentication → Users → Add user. Придумайте email и пароль, затем используйте их на экране входа.

Postgres URL с паролем в приложении не используется. Не добавляйте `service_role` key во фронтенд или в Vercel.

Если понадобится создать такую же схему в другом чистом проекте, выполните `supabase/migrations/001_initial.sql` в SQL Editor.

```env
VITE_SUPABASE_URL=https://ваш-проект.supabase.co
VITE_SUPABASE_ANON_KEY=ваш-публичный-anon-key
```

## Деплой на Vercel

Импортируйте GitHub-репозиторий в Vercel. Для этого репозитория Root Directory оставьте `./`; Build Command — `npm run build`, Output Directory — `dist`. В настройках Vercel добавьте `VITE_SUPABASE_URL` со значением `https://shednvgyozvkdqqebukd.supabase.co` и `VITE_SUPABASE_ANON_KEY` со значением ранее переданного `sb_publishable_...` ключа для Production и Preview, затем выполните повторный деплой. Не добавляйте PostgreSQL URL и пароль в переменные фронтенда.

После публикации откройте HTTPS-ссылку в Safari на iPhone → «Поделиться» → «На экран Домой».
