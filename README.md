# Дримус

Мобильное PWA-приложение для учёта учеников и ежемесячной оплаты.

## Локальный запуск

```bash
npm install
npm run dev
```

Без настроек Supabase приложение использует локальный демонстрационный профиль браузера. Эти данные не синхронизируются с другими устройствами.

## Подключение Supabase

Можно использовать тот же проект Supabase, что и для папки `Dashboard`: таблицы приложения Дримус отдельные. Перед запуском проверьте адрес проекта и публичный `anon` key. Ключ `service_role` не добавляйте во фронтенд и не публикуйте.

1. В Supabase откройте SQL Editor и выполните `supabase/migrations/001_initial.sql`. Для базы, где миграция 001 уже была применена, выполните также `supabase/migrations/002_allow_installment_payments.sql`.
2. В Supabase → Authentication → Users создайте пользователя с email и паролем. Вход в приложение выполняется этим пользователем; таблицы закрыты RLS и показывают данные только вошедшего пользователя.
3. Скопируйте `.env.example` в `.env` и добавьте URL проекта и `anon` key. Перезапустите `npm run dev`.

```env
VITE_SUPABASE_URL=https://ваш-проект.supabase.co
VITE_SUPABASE_ANON_KEY=ваш-публичный-anon-key
```

## Деплой на Vercel

Импортируйте GitHub-репозиторий в Vercel. Для этого репозитория Root Directory оставьте `./`; Build Command — `npm run build`, Output Directory — `dist`. В настройках Vercel добавьте `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY` для Production и Preview, затем выполните повторный деплой.

После публикации откройте HTTPS-ссылку в Safari на iPhone → «Поделиться» → «На экран Домой».
