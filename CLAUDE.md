# CLAUDE.md

Guidance for Claude (and other AI coding agents) working on this repository.

## What this app is

**HiKids** — a premium bilingual (Arabic/English, RTL-first) online toy store, backed by
Supabase (migrated off the Base44 platform). The store has a full storefront (shop,
product detail, cart, checkout, wishlist, reviews, bundles, challenges, a Mystery Unboxing
reward wheel, loyalty wallet) plus an admin dashboard (products, inventory, purchase
orders, suppliers, categories, discounts, orders, loyalty, reports, site content).

## First: read AGENTS.md

`AGENTS.md` has the general agent setup (key files, working notes). Follow it. This file
adds **project-specific** conventions on top.

## Tech stack & hard rules

- **Frontend:** React 18 + Vite (ESM only — **never** use `require()`/`module.exports`),
  Tailwind CSS, shadcn/ui (`@/components/ui/*`), lucide-react icons, react-router-dom v6.
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions), project
  `fcituvmbtqxpjgbyzpbf`. Data = **tables** under RLS, created via SQL migrations in
  `supabase/migrations/`. Access from the frontend via `db.<Entity>` wrappers:
  ```js
  import { db } from '@/api/entities';
  db.Product.list();
  db.Order.create({ ... });
  ```
  `createEntity.js` mirrors the old Base44 SDK's `list/get/filter/create/update/delete/
  bulkUpdate` shape closely enough that call sites read the same either way. Built-in
  columns on every table: `id`, `created_date`, `updated_date`. `sanitize()` in
  `createEntity.js` converts `''` → `null` on every write (Postgres rejects `''` for
  non-text columns).
- **Backend functions** (secure server logic — order totals, loyalty ledger, wheel spins,
  admin-only actions, etc.) are mostly `SECURITY DEFINER` Postgres RPCs defined in
  `supabase/migrations/`, called via small wrappers in `src/lib/*Functions.js`
  (`orderFunctions.js`, `loyaltyFunctions.js`, `wheelFunctions.js`, `challengeFunctions.js`).
  A few that need something Postgres can't do alone (calling an external API, admin auth
  actions) are Deno Edge Functions under `supabase/functions/<name>/index.ts`, called via
  `invokeFunction(name, body)` from `src/lib/supabaseFunctions.js`. Reuse existing ones
  before creating new ones — see the list below.
- **Auth** is Supabase Auth. Pages at `src/pages/{Login,Register,ForgotPassword,
  ResetPassword}.jsx` — do **not** recreate them. Routes for all four are registered in
  `src/App.jsx`. `ProtectedRoute` gates authed pages. `auth.uid()` / `auth.jwt()->>'email'`
  inside a `SECURITY DEFINER` function reflect the calling user, same role
  `createClientFromRequest(req)` played under Base44.

### Import rules that break the build if ignored
- Use the `@/` alias for all `src/` imports — **never** relative `src/` paths. (Defined in
  both `vite.config.js`'s `resolve.alias` and `jsconfig.json`'s `paths` — keep them in
  sync if either changes.)
- `cn` comes from `@/lib/utils`; `createPageUrl` from `@/utils`. Don't reimplement them.
- Each shadcn primitive is imported from its own file (`Label` from
  `@/components/ui/label`, etc.) — files don't re-export each other.
- A lucide icon sharing a page/component name must be aliased
  (`import { Home as HomeIcon } from 'lucide-react'`).
- Only import names a target file actually exports.
- JSX only in `.jsx`/`.tsx`, never `.js`.
- Tailwind class names must be literal strings (the purge step drops `bg-${color}-500`).

## Project conventions

- **Bilingual:** Arabic is primary, English secondary. Most entities have paired fields
  (`name`/`name_en`, `description`/`description_en`). UI strings live in
  `src/context/translations.js` as `en`/`ar` objects; access via the `useLanguage()` hook's
  `t('key')`. Add every new label to **both** languages. Use RTL layout when Arabic is
  active (`dir`/`lang` are managed on `<html>`).
- **Design tokens** are in `src/index.css` (`:root` + `.dark`), mapped in
  `tailwind.config.js`. Dark theme is the default. Use mapped token classes
  (`bg-primary`, `font-heading`), never hardcoded hex values. Brand palette derives from
  the logo — avoid generic purple as the primary UI color.
- **Components:** small focused files (~50 lines). Every new page/component gets its own
  file. Default-export a component named after its file.
- **Routing:** `src/App.jsx` is the router. Add a new page = one `import` near
  `"// Add page imports here"` + one `<Route>` inside `<Routes>`. Keep the auth/layout
  wrappers (`AuthProvider`, `QueryClientProvider`, `Router`, `Toaster`) intact. The main
  page is always `/` — don't add a duplicate route under the component name.
- **Images:** render content images (any `media.base44.com` / `static.wixstatic.com` URL —
  legacy asset hosts, still in use for existing product images) with `<Image />` from
  `@/components/ui/image`, never a plain `<img>`.
- **Cart/wishlist:** custom React context providers in `src/context/` using `localStorage`
  for persistence. Don't swap for an external store.
- **Errors:** let them bubble up unless it's a user-facing form/auth flow (those catch and
  show inline errors — that behavior is the feature).
- **Mobile:** fixed bottom nav (`MobileNav`), web footer hidden on mobile, content padded
  to start below the fixed header (`Navbar` reserves a measured spacer).

## Backend functions that already exist (reuse, don't duplicate)

Loyalty (Postgres RPCs, `src/lib/loyaltyFunctions.js`): `adjustLoyaltyPoints`,
`awardLoyaltyPoints`, `redeemLoyaltyPoints`, `releaseLoyaltyPoints`, `reverseOrderLoyalty`,
`getLoyaltyBalance`, `adminLoyaltyWallet`, `loyaltyDashboard`, `setWalletStatus`.
Wheel/rewards (Postgres RPCs, `src/lib/wheelFunctions.js`): `wheelSpin`, `wheelState`,
`wheelGrantFirstSpin`, `finalizeWheelRewards`, `reverseWheelRewards`.
Challenges (Postgres RPCs, `src/lib/challengeFunctions.js`): `challengesClaim`,
`challengesReview`, `challengesSubmitPhoto`.
Orders/stock (Postgres RPCs, `src/lib/orderFunctions.js`): `commitOrderStock`,
`secureOrder` (authoritative server-side price verification — **always** use this for
order totals, never trust client-side totals).
Discounts: `redeemDiscount` (Postgres RPC).
Purchase orders/suppliers (Edge Functions): `postPurchaseOrder`, `cancelPurchaseOrder`,
`recordSupplierPayment`.
Inventory (Edge Functions): `shopProducts` (server-side paginated product listing),
`validateBarcode` (barcode-uniqueness check).
Account/audit (Edge Functions): `deleteAccount`, `logAuditActivity`, `recordShareView`,
`inviteUser` (admin-only staff invite — sends a Supabase auth invite email),
`chatAssistant` (storefront shopping-assistant chat; needs an `ANTHROPIC_API_KEY` secret
on the project before it will actually answer — see its file header).
Reviews (Edge Functions): `submitPhotoReview`, `reviewPhoto`.

**Not yet connected** (need external credentials only the store owner can supply — flagged
clearly in-app rather than faked):
- `chatAssistant` needs an `ANTHROPIC_API_KEY` project secret.
- Transactional order-confirmation emails need an email provider + API key.
- `Analytics.jsx` (Insights page) needs a real Google Cloud OAuth client and the store
  owner re-authorizing a GA4 property — Base44's `gaInsights` relied on a
  platform-managed connector with no Supabase equivalent.

Shared backend logic lives directly in the relevant `supabase/migrations/*.sql` file (SQL
helpers) or `supabase/functions/_shared/` (Edge Function helpers — `client.ts` for
caller-scoped/service-role Supabase clients, `cors.ts` for the CORS headers every Edge
Function needs).

## Security posture (don't regress these)

- **Order totals** are recomputed server-side via `secureOrder`; the `orders.secured`
  flag marks verified financials. Never submit a client-computed `total`.
- **Row-Level Security (RLS)** is configured per table in `supabase/migrations/`.
  Customer-facing tables (`orders`, `reviews`, `loyalty_accounts`, `loyalty_transactions`,
  `wheel_progress`, `challenge_progress`, `reward_history`, `wheel_spins`,
  `challenge_submissions`) restrict reads to the owning user + admins/permission-holders.
  Admin-only tables (`products`, `categories`, `discount_codes`, `purchase_orders`, …) gate
  create/update/delete to `role: admin` (via the `is_admin()` / `has_permission(perm)` SQL
  helpers). When adding a table, set RLS explicitly.
- **Photo reviews** (`reviews`) hide pending/rejected photos from non-owners/non-admins.

## Development commands

```bash
npm install
npm run dev       # frontend against the hosted Supabase project (needs .env.local)
npm run build     # production build
npm run lint      # eslint
npm run typecheck # tsc via jsconfig
```

`.env.local`:
```
VITE_SUPABASE_URL=<project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<anon/publishable key>

# Server-side only — never prefix with VITE_ (that would ship it to the browser).
SUPABASE_SECRET_KEY=<service role key>
```

## Workflow guidance

- Make the **minimum** change the request needs; don't refactor unrelated code.
- Before editing an existing file, read it first — don't guess its contents.
- After frontend changes, run `npm run lint` and `npm run build` to catch breakages.
- After a schema/RLS/RPC change, apply it as a new migration (don't hand-edit an
  already-applied one) and re-run the affected `npm run lint`/`build` plus a live check
  against the Supabase project before considering it done.
- Don't install new npm packages unless explicitly requested; the installed set is curated
  and sufficient.
