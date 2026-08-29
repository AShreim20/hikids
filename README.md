# HiKids

A bilingual (Arabic/English, RTL-first) online toy store — React + Vite frontend, Supabase
(Postgres + Auth + Storage + Edge Functions) backend.

## Prerequisites

1. Clone the repository.
2. Navigate to the project directory.
3. Install dependencies: `npm install`.

## Run Locally

```bash
npm run dev
```

Open the local URL printed by Vite. The frontend talks directly to the hosted Supabase
project configured in `.env.local` — there's no separate local backend process to start.

## Environment

Create `.env.local` in the project root:

```bash
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_or_publishable_key

# Server-side only — never prefix with VITE_ (that would ship it to the browser).
# Used by scripts/tools that need to bypass RLS with the service role.
SUPABASE_SECRET_KEY=your_service_role_key
```

## Other commands

```bash
npm run build     # production build
npm run lint      # eslint
npm run typecheck # tsc via jsconfig
```

## Backend

Database schema, RLS policies, and Postgres RPC functions live in `supabase/migrations/`.
Deno Edge Functions (for logic that needs more than a plain RPC — external API calls,
admin-only auth actions) live in `supabase/functions/`. See [CLAUDE.md](./CLAUDE.md) for
the full list of backend functions and project conventions.
