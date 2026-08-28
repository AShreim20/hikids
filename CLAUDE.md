# CLAUDE.md

Guidance for Claude (and other AI coding agents) working on this repository.

## What this app is

**HiKids** — a premium bilingual (Arabic/English, RTL-first) online toy store built on the
Base44 platform. Published at https://hikids.base44.app. The store has a full storefront
(shop, product detail, cart, checkout, wishlist, reviews, bundles, challenges, a Mystery
Unboxing reward wheel, loyalty wallet) plus an admin dashboard (products, inventory,
purchase orders, suppliers, categories, discounts, orders, loyalty, reports, site content).

## First: read AGENTS.md

`AGENTS.md` has the general Base44-agent setup (CLI, skills, key files). Follow it. This
file adds **project-specific** conventions on top.

## Tech stack & hard rules

- **Frontend:** React 18 + Vite (ESM only — **never** use `require()`/`module.exports`),
  Tailwind CSS, shadcn/ui (`@/components/ui/*`), lucide-react icons, react-router-dom v6.
- **Backend:** Base44's built-in database. Data = **entities** (JSON schemas in
  `base44/entities/*.jsonc`). Access via the pre-initialized SDK:
  ```js
  import { base44 } from '@/api/base44Client';
  base44.entities.Product.list();
  base44.entities.Order.create({ ... });
  ```
  Built-in fields on every record (never declare them): `id`, `created_date`,
  `updated_date`, `created_by_id`.
- **Backend functions** (external API / secure server logic) live in
  `base44/functions/<name>/entry.ts`. Reuse existing ones before creating new ones — see
  the list below. Shared logic goes in `base44/shared/` and is imported by functions.
- **Auth** is platform-managed. Boilerplate pages already exist at
  `src/pages/{Login,Register,ForgotPassword,ResetPassword}.jsx` — do **not** recreate them.
  Routes for all four are registered in `src/App.jsx`. `ProtectedRoute` gates authed pages.

### Import rules that break the build if ignored
- Use the `@/` alias for all `src/` imports — **never** relative `src/` paths.
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
- **Images:** render content images (any `media.base44.com` / `static.wixstatic.com` URL)
  with `<Image />` from `@/components/ui/image`, never a plain `<img>`.
- **Cart/wishlist:** custom React context providers in `src/context/` using `localStorage`
  for persistence. Don't swap for an external store.
- **Errors:** let them bubble up unless it's a user-facing form/auth flow (those catch and
  show inline errors — that behavior is the feature).
- **Mobile:** fixed bottom nav (`MobileNav`), web footer hidden on mobile, content padded
  to start below the fixed header (`Navbar` reserves a measured spacer).

## Backend functions that already exist (reuse, don't duplicate)

Loyalty: `adjustLoyaltyPoints`, `awardLoyaltyPoints`, `redeemLoyaltyPoints`,
`releaseLoyaltyPoints`, `reverseOrderLoyalty`, `getLoyaltyBalance`, `adminLoyaltyWallet`,
`loyaltyDashboard`, `setWalletStatus`.
Wheel/rewards: `wheelSpin`, `wheelState`, `wheelGrantFirstSpin`, `finalizeWheelRewards`,
`reverseWheelRewards`.
Challenges: `challengesClaim`, `challengesReview`, `challengesSubmitPhoto`.
Orders/stock: `onOrderPlaced`, `commitOrderStock`, `secureOrder` (authoritative
server-side price verification — **always** use this for order totals, never trust
client-side totals).
Reviews: `submitPhotoReview`, `reviewPhoto`.
Discounts: `validateDiscount`, `redeemDiscount`.
Purchase orders/suppliers: `postPurchaseOrder`, `cancelPurchaseOrder`,
`recordSupplierPayment`.
Inventory: `shopProducts` (server-side paginated product listing), `validateBarcode`.
Analytics: `gaInsights` (uses the authorized `google_analytics` connector).
Account/audit: `deleteAccount`, `logAuditActivity`, `recordShareView`.

Shared backend modules: `base44/shared/loyalty.ts`, `rewards.ts`, `challenges.ts`,
`permissions.ts`.

## Security posture (don't regress these)

- **Order totals** are recomputed server-side via `secureOrder`; the `Order.secured`
  flag marks verified financials. Never submit a client-computed `total`.
- **Row-Level Security (RLS)** is configured per entity in its `base44/entities/*.jsonc`
  under `rls`. Customer-facing entities (`Order`, `Review`, `LoyaltyAccount`,
  `LoyaltyTransaction`, `WheelProgress`, `ChallengeProgress`, `RewardHistory`,
  `WheelSpin`, `ChallengeSubmission`) restrict reads to the owning user + admins.
  Admin-only entities (`Product`, `Category`, `DiscountCode`, `PurchaseOrder`, …) gate
  create/update/delete to `role: admin`. When adding an entity, set RLS explicitly.
- **Photo reviews** (`Review`) hide pending/rejected photos from non-owners/non-admins.

## Development commands

```bash
npm install
base44 dev        # full local backend + frontend (preferred)
npm run dev       # frontend only against the hosted backend (needs .env.local)
npm run build     # production build
npm run lint      # eslint
npm run typecheck # tsc via jsconfig
```

`.env.local` (frontend-only mode):
```
VITE_BASE44_APP_ID=<app id>
VITE_BASE44_APP_BASE_URL=https://hikids.base44.app
```

## Workflow guidance

- Make the **minimum** change the request needs; don't refactor unrelated code.
- Before editing an existing file, read it first — don't guess its contents.
- After frontend changes, run `npm run lint` and `npm run build` to catch breakages.
- Don't install new npm packages unless explicitly requested; the installed set is curated
  and sufficient. Never uninstall `@base44/sdk` or `@base44/vite-plugin`.
- For Base44 platform-feature questions (publishing, billing, connectors, workflows,
  agents), prefer the Base44 docs over guessing.