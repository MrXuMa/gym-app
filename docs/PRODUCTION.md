# Production launch checklist

Use this after pulling the latest code. Items marked **(you)** require your Supabase, Apple, or Google accounts.

---

## Already done in the repo

- Sanitized user-facing errors (no raw Postgres/Supabase leaks)
- Coach job cooldown (30s) and in-progress guard
- Atomic food scan / search daily quotas (DB RPCs)
- Edge functions: fail-closed rate limits, JWT verification
- `eas.json` build profiles, `app.json` bundle ID placeholders
- `.env.example` for local setup

---

## 1. Supabase: apply migrations **(you)**

Ensures production DB matches git.

1. Install CLI: `npm i -g supabase`
2. Login: `supabase login`
3. Link project: `supabase link --project-ref pqnnxzchijddznliaibp`
4. Push: `supabase db push`
5. Confirm in Dashboard → **Database** → **Migrations** that `20260620120000_production_hardening` (and earlier) are applied.

---

## 2. Supabase: edge function secrets **(you)**

Dashboard → **Project Settings** → **Edge Functions** → **Secrets**

| Secret | Used by |
|--------|---------|
| `GEMINI_API_KEY` | `analyze-food` |
| `FDC_API_KEY` | `search-food` |
| `FOOD_ANALYSIS_DAILY_LIMIT` | optional (default 20) |
| `ALLOWED_ORIGIN` | optional; set to your web origin if shipping web |

Service role and anon keys are injected automatically.

---

## 3. Supabase: deploy edge functions **(you)**

From repo root:

```bash
supabase functions deploy analyze-food --project-ref pqnnxzchijddznliaibp
supabase functions deploy search-food --project-ref pqnnxzchijddznliaibp
```

Smoke test (replace token and URL):

```bash
curl -X POST "$SUPABASE_URL/functions/v1/search-food" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"action":"search","query":"chicken"}'
```

---

## 4. Supabase Auth configuration **(you)**

Dashboard → **Authentication** → **URL configuration**

1. **Site URL**: your Vercel production URL (e.g. `https://your-app.vercel.app`)
2. **Redirect URLs** add:
   - `https://your-production-domain.vercel.app/**`
   - `https://*.vercel.app/**` (preview deploys)
   - `gymapp://**` (optional, for native builds)

Dashboard → **Authentication** → **Providers** → **Email**

- **Enable Email provider** — on
- **Enable sign ups** — on
- **Confirm email** — off (instant access; no activation email)
- Password rules are enforced in-app via `lib/passwordValidation.ts`

Sign up collects email, username, and password. Other profile details can be added later in the app.

Optional: custom SMTP (e.g. Resend) only if you want **password reset** emails to work reliably.

---

## 5. Supabase Security Advisor **(you)**

Dashboard → **Database** → **Security Advisor** (or Advisors in project home)

1. Run the advisor
2. Fix any **RLS disabled** or **policy always true** findings
3. Export baseline schema to git if tables exist only in dashboard:
   `supabase db dump --schema public -f supabase/schema-baseline.sql`

---

## 6. Coach worker (vm/coach-api) **(you)**

The mobile app enqueues `coach_template_jobs`; a worker must poll and complete them.

1. Deploy `vm/coach-api` (Docker / VM) with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, Ollama URL
2. Ensure worker can reach Supabase and Ollama
3. Set `EXPO_PUBLIC_COACH_API_URL` only if the app calls it directly (current flow is DB jobs)

---

## 7. Local / CI environment **(you)**

1. Copy `.env.example` → `.env`
2. Fill `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from Dashboard → API
3. Never commit `.env`
4. `npm install` && `npx expo start`

---

## 8. EAS Build & store IDs **(you)**

1. `npm i -g eas-cli` && `eas login`
2. `eas init` (links Expo project)
3. Edit `app.json`:
   - `ios.bundleIdentifier`: e.g. `com.yourname.gymapp`
   - `android.package`: same reverse-DNS
4. Apple Developer + Google Play Console: create app records with matching IDs
5. `eas build --profile production --platform all`
6. `eas submit` after TestFlight / internal testing

---

## 9. App Store privacy **(you)**

- Declare camera / photo library use (food scan)
- Privacy nutrition label: account data, health/fitness, photos if applicable
- Link to privacy policy URL in store listing

---

## 10. Pre-launch smoke test **(you)**

- [ ] Sign up, sign in, sign out
- [ ] Log workout, edit template, delete workout
- [ ] Coach: request template, wait for completion, save template
- [ ] Food: manual search, scan photo, edit/delete meal
- [ ] Profile: weight, goals, lifting level, training split
- [ ] Home widgets: add/remove, task bulletin recurring reset
- [ ] Password reset deep link opens app → reset screen

---

## 11. Monitoring **(you)**

- Supabase → **Logs** → Edge Functions / Postgres
- Set billing alerts on Supabase and Gemini API
- Optional: Sentry or Expo Updates for crash reporting
