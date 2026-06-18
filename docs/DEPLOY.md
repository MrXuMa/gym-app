# Deploying the web app

Production URL: **https://gym-app-azure-one.vercel.app**

## Fastest workflow (recommended)

1. Connect the GitHub repo in [Vercel](https://vercel.com) → **gym-app** → **Settings** → **Git** (if not already linked).
2. Set **Production Branch** to `master` (or your main branch).
3. Ensure Vercel env vars are set once:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. After that, every push to the production branch auto-deploys. You only run:

```bash
git push origin master
```

Vercel builds in the cloud (~2 minutes). You do **not** need `npx vercel --prod` on your machine unless you want a manual deploy.

## Manual deploy from your laptop

```bash
npm run deploy:web
```

Same result as `npx vercel --prod`. First deploy or cold cache can take ~2–3 minutes; later deploys are usually ~1–2 minutes because Vercel caches dependencies.

## Preview deploys

Push any branch — Vercel creates a preview URL automatically when Git integration is on.

## Supabase changes

Database migrations and edge functions are **not** deployed by Vercel. After schema/function changes:

```bash
supabase db push          # migrations
supabase functions deploy # edge functions
```

## Local web build check

```bash
npm run build:web
```

Requires `.env` with the two `EXPO_PUBLIC_SUPABASE_*` variables.
