# Briefklar

Upload a photo or PDF of an official German letter and get a plain English action card: who sent it, what it
means, what to do and by when. The first letter per device is free; more letters come in prepaid packs.

keep. `docs/data-flows.md` lists what data goes where.

## Stack

Next.js 16 (App Router), TypeScript, Tailwind CSS, Anthropic API, Zod, Stripe Checkout, Supabase Postgres, Vitest.

## Local setup

```bash
npm install
cp .env.example .env.local   # then fill in the values you have
npm run dev
```

Without Supabase variables, development keeps free letter counters and credits in memory, so they reset on restart.
Without `ANTHROPIC_API_KEY`, the upload flow returns "not set up yet".

| Variable | Needed for |
| --- | --- |
| `ANTHROPIC_API_KEY`, `LLM_MODEL` | explaining letters (`LLM_MODEL` defaults to `claude-sonnet-5-5`) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PACK5`, `STRIPE_PRICE_PACK15` | letter packs |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | credits and usage counters (required in production) |
| `IP_HASH_SALT` | hashing IP addresses for the daily free limit (required in production, long and random) |
| `NEXT_PUBLIC_APP_URL` | Stripe return URLs, e.g. `https://briefklar.example` |

## Commands

```bash
npm run dev          # development server
npm run build        # production build
npm run lint
npm run typecheck
npm test             # unit tests
npm run eval         # real model calls on fixtures/, prints field accuracy (costs API credits)
npm run fixtures     # regenerate the synthetic fixture PDFs
```

## Database

Create a Supabase project in an EU region (for example Frankfurt), then run the migrations in
`supabase/migrations/` in order, with the Supabase CLI or the SQL editor. `0003_schedule_cleanup.sql` schedules
the nightly cleanup of usage counters with `pg_cron`.

## Payments

Create two one-time EUR prices in Stripe and set their ids as `STRIPE_PRICE_PACK5` and `STRIPE_PRICE_PACK15`.
Add a webhook endpoint for `https://<your-domain>/api/stripe/webhook` with the events
`checkout.session.completed` and `checkout.session.async_payment_succeeded`, and set its signing secret as

## Deploy

**Vercel.** `vercel.json` pins functions to `fra1` (Frankfurt). Set all variables above in the project settings
and deploy.

**Docker (for example on Hetzner).** The image runs the standalone Next.js server on port 3000.

```bash
docker build --build-arg NEXT_PUBLIC_APP_URL=https://briefklar.example -t briefklar .
docker run -d --restart unless-stopped --env-file .env.production -p 127.0.0.1:3000:3000 briefklar
```

Put a reverse proxy such as Caddy in front for HTTPS, and do not expose port 3000 directly. The free tier limit
reads the client IP from `X-Forwarded-For`, so the proxy must overwrite that header rather than pass on what the
client sent (Caddy does this by default).

## Before launch

`/datenschutz` (`grep -rn "TODO(owner)" app components` must return nothing), sign data processing agreements,
switch Stripe to live keys, and reach 100% on deadlines and amounts in `npm run eval` across at least 15 real,
redacted letters in `fixtures/private/`.
