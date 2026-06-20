# gym-app

A cross-platform fitness app (iOS, Android, and web) for planning workouts, tracking sessions, logging food, and getting AI-generated training plans. Built with Expo / React Native and Supabase.

**Live web app:** https://gym-app-azure-one.vercel.app

## Features

- **Workouts** — start blank or template-based sessions, log sets/reps/weight, reorder exercises, edit past workouts.
- **AI Coach** — request a workout and a self-hosted model generates a template you can review and save.
- **Food logging** — scan a meal photo (Gemini) or search the USDA FoodData Central database, then track macros.
- **Profile & goals** — weight tracking, personal goals, lifting level, and an optional weekly training split.
- **Home dashboard** — customizable widgets and a recurring task bulletin.

## Tech stack

- **Frontend:** Expo (React Native 0.81, React 19), Expo Router (file-based routing), TypeScript
- **Backend:** Supabase (Postgres, Auth, Row-Level Security, Edge Functions)
- **AI:** Self-hosted Ollama worker (`vm/coach-api`) for coaching; Gemini for food image analysis
- **Web hosting:** Vercel (static export via `expo export`)

## Project structure

```
app/                  Screens and routes (Expo Router)
components/           Reusable UI components
lib/                  Data access, Supabase clients, business logic
hooks/                Custom React hooks
constants/            Theme and shared constants
supabase/
  migrations/         SQL schema migrations
  functions/          Edge functions (analyze-food, search-food)
vm/                   Self-hosted AI coach API + worker
docs/                 PRODUCTION.md and DEPLOY.md
```

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root with your Supabase credentials (Dashboard → Project Settings → API):

   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. Start the app:

   ```bash
   npm run start
   ```

   Then open it in Expo Go, an iOS/Android simulator, or the web (press `w`).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start` | Start the Expo dev server |
| `npm run ios` / `npm run android` | Open in a simulator/emulator |
| `npm run web` | Run in the browser |
| `npm run build:web` | Static web export (requires `.env`) |
| `npm run deploy:web` | Deploy the web app to Vercel production |
| `npm run lint` | Lint the project |

## Deployment

- **Web:** push to the production branch to auto-deploy on Vercel, or run `npm run deploy:web` for a manual deploy. See [`docs/DEPLOY.md`](docs/DEPLOY.md).
- **Database / Edge Functions:** not deployed by Vercel — run `supabase db push` and `supabase functions deploy` after changes.
- **Full launch checklist:** see [`docs/PRODUCTION.md`](docs/PRODUCTION.md).
