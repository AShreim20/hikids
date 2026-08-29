# AGENTS.md

## Project Context

This is a Supabase-backed React/Vite app repository (migrated off the Base44 platform).
Treat it as user-owned application code, keep changes focused on the user's request, and
preserve existing project conventions.

Start with `CLAUDE.md` for stack conventions and `README.md` for local setup.

## Key Files

- `src/`: frontend application source.
- `src/api/supabaseClient.js`: frontend Supabase client.
- `src/api/entities/`: `db.<Entity>` wrappers over Supabase tables (mirrors the old
  `base44.entities.<Entity>` call shape — see `createEntity.js`).
- `src/lib/supabaseFunctions.js`: `invokeFunction(name, body)` — calls a Supabase Edge
  Function and throws on error (mirrors the old `base44.functions.invoke` behavior).
- `supabase/migrations/`: SQL migrations — schema, RLS policies, and `SECURITY DEFINER`
  Postgres functions (the backend "functions" layer; see CLAUDE.md's list of these).
- `supabase/functions/`: Deno Edge Functions, for backend logic that doesn't fit a plain
  Postgres RPC (calling an external API, admin-only auth actions, etc).
- `vite.config.js`: Vite config, including the `@` → `src/` path alias.
- `.env.local`: local-only environment values (`VITE_SUPABASE_URL`,
  `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`); never commit secrets.

## Working Notes

- `npm run dev` runs the frontend against the hosted Supabase project configured in
  `.env.local` — there is no local backend process to start separately.
- Database/RLS/function changes go in a new file under `supabase/migrations/`, applied via
  the Supabase MCP tools (or `supabase db push`) — never edit an already-applied migration
  file in place once it's landed.
- Edge Functions are deployed individually (Supabase MCP `deploy_edge_function`, or
  `supabase functions deploy <name>`); they aren't picked up by `npm run build`.
- Run the relevant checks from `package.json` (`npm run lint`, `npm run build`) before
  finishing code changes.
