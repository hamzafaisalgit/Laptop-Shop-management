# Laptop Shop Management System

A MERN stack inventory and sales management system for a single offline laptop shop.
Staff-only — no customer-facing pages, no e-commerce, no online payments.

## Tech Stack

- **Frontend:** React (Vite) + React Router + Tailwind CSS + shadcn/ui + Recharts + Axios + React Hook Form + Zod + Sonner + lucide-react
- **Backend:** Node.js + Express + Mongoose + JWT (httpOnly cookie) + bcryptjs + multer + xlsx (SheetJS) + pdfkit
- **Database:** MongoDB (local via mongod, or MongoDB Atlas in production)
- **Package manager:** npm
- **Language:** JavaScript (not TypeScript)

## Project Structure
laptop-shop/
├── backend/
│   ├── models/         # Mongoose schemas
│   ├── routes/         # Express routers
│   ├── controllers/    # Request handlers
│   ├── services/       # Business logic (import parser, invoice PDF, merge detector)
│   ├── middleware/     # Auth, role checks, error handler
│   ├── utils/          # Helpers (invoice numbering, audit logger)
│   ├── scripts/        # seed.js and one-off scripts
│   └── server.js
└── frontend/
├── src/
│   ├── pages/      # Route-level components
│   ├── components/ # Reusable UI
│   ├── hooks/      # useAuth, useApi, etc.
│   ├── lib/        # axios instance, formatters, utils
│   └── App.jsx
└── vite.config.js

## Core Domain Rules

### Inventory Model — Hybrid Tracking

Every Laptop document is either a single unit OR a batch of identical units:

- **`trackingMode: 'unit'`** — Used/Refurbished/Open-box. Has `serialNumber`, `quantity` is always 1, each physical laptop is its own record.
- **`trackingMode: 'batch'`** — New laptops with identical specs. Has `quantity` (integer ≥ 0). "+" and "-" buttons in the UI adjust the count.

**Merge detection:** when adding a `New` laptop, check if an existing batch matches on `brand + model + modelNumber + all specs + costPrice + sellingPrice + condition='New'`. If match found, prompt user to merge (increment quantity) rather than create duplicate.

### User Roles

- **`admin`** — full access. Sees cost price, min sale price, and profit everywhere. Can delete, import, access reports.
- **`salesperson`** — cannot see cost price, min sale price, or profit. Cannot delete inventory or access reports. Can create sales, view inventory, and increment (receive) stock but NOT decrement.

Strip sensitive fields (`costPrice`, `minSalePrice`, `profit`) on the backend before responding to salesperson requests — never rely on frontend hiding.

### Sale Flow

- Full payment only, no installments or partial payments
- Single shop only — no branch logic anywhere
- Invoice format: `INV-YYYY-NNNN`, atomic sequential counter per year
- On sale: batch items decrement quantity, unit items set `status='sold'`, snapshot `costPrice` into the sale for profit calc
- Cancel (admin only) restores inventory: batch `+= qty`, unit `status='in_stock'`, `soldInvoiceId` cleared
- Sales snapshot customer details (name, phone, etc.) into the sale doc so later customer edits don't change historical invoices

### Audit Log

Every mutation (create, update, delete, quantity change, price edit, sale cancel) writes an entry to `AuditLog` with `{ user, action, entity, entityId, changes, ip }`. Only admins can view the audit log UI.

## Design System

Modern SaaS aesthetic inspired by Linear/Stripe. Light theme only.

- **Backgrounds:** `#ffffff` cards, `#f8fafc` page background
- **Primary accent:** `indigo-600` (`#4f46e5`) for CTAs, active states, links
- **Text:** `slate-900` headings, `slate-600` body, `slate-400` muted
- **Borders:** `slate-200`, `rounded-lg` (8px) on cards and inputs
- **Layout:** fixed 240px left sidebar (white, slate-200 right border), main content max-w-7xl with px-8 py-6
- **Typography:** Inter font, text-sm base, font-semibold for headings
- **Focus states:** `ring-2 ring-indigo-500 ring-offset-2`
- **Status badges:** `rounded-full px-2.5 py-0.5 text-xs font-medium`
  - `in_stock` → emerald
  - `sold` → slate
  - `low_stock` → amber
  - `damaged` → red
- **Icons:** lucide-react only
- **Toasts:** sonner
- **Charts:** Recharts — indigo primary (`#4f46e5`), emerald profit (`#10b981`)

### UI Patterns

- Use shadcn/ui components throughout (Button, Input, Label, Card, Table, Badge, Dialog, DropdownMenu, etc.)
- Loading states: skeletons, not spinners
- Empty states: centered icon + helpful text + CTA
- Tables: sticky header, striped hover, pagination at 25/page default
- Forms: react-hook-form + zod, inline error messages below fields
- Destructive actions: confirm dialog with clear warning

## Coding Conventions

### Backend

- Use async/await, no callback or promise chains
- Wrap mutations in try/catch; pass errors via `next(err)` to the central error handler
- Validate inputs with `express-validator` or Zod at the route level
- Mongoose: use `.lean()` for reads that don't need doc methods
- Snapshot data on sale creation — never rely on fetching related docs later for historical accuracy
- All routes return JSON: `{ data }` on success, `{ error: { message, code, details? } }` on failure
- Use httpOnly cookies for JWT, never localStorage

### Frontend

- Functional components + hooks only, no class components
- Co-locate component-specific styles; use Tailwind utilities, not CSS modules
- Derive state — don't duplicate server state in local state unnecessarily (prefer TanStack Query if we add it, else careful `useState`)
- Forms: always `react-hook-form` + `zod` schemas; never raw `useState` form handling for multi-field forms
- Axios instance at `src/lib/api.js` with `withCredentials: true` and `baseURL` from `VITE_API_URL`
- Optimistic UI for quantity +/- buttons with rollback on error

### File Naming

- Components: `PascalCase.jsx`
- Hooks: `useCamelCase.js`
- Utilities: `camelCase.js`
- Mongoose models: `PascalCase.js` (singular, e.g., `Laptop.js`, `Sale.js`)
- Routes: `kebab-case.js` (e.g., `laptop-routes.js`) OR plural resource names

## Environment Variables

All secrets live in `.env` files, never committed. Templates in `.env.example`.

**Backend (`backend/.env`):**
PORT=5000
MONGO_URI=mongodb://localhost:27017/laptop_shop
JWT_SECRET=<long random string>
JWT_EXPIRES=7d
NODE_ENV=development
CLIENT_URL=http://localhost:5173

**Frontend (`frontend/.env`):**
VITE_API_URL=http://localhost:5000/api

## Security Rules

- Never commit `.env`, `node_modules`, or anything with secrets
- Never log full JWTs or passwords
- Never expose `costPrice`, `minSalePrice`, or `profit` to salesperson role
- Rate-limit `/api/auth/login` (5 attempts per 15 min per IP)
- For production (cross-domain): cookies must use `secure: true, sameSite: 'none'`
- Hash passwords with bcrypt, cost factor 12
- Validate SKU uniqueness at both application and DB index level

## What NOT to Build

Do not add these unless explicitly asked:

- Online purchases or e-commerce flows
- Customer-facing pages or customer login
- Payment gateway integration
- Email/SMS notifications (offline shop)
- Multi-branch / multi-store logic
- Installments or partial payment tracking
- TypeScript migration
- Next.js or SSR (this is a SPA)
- Real-time / websockets
- Mobile app

## Build Order (Reference)

This project was built in 5 phased steps. Current status should be tracked in README.md. Do not skip ahead or combine steps.

1. Auth + base UI shell + role-based layout
2. Inventory (hybrid model, Excel import, +/- quantity, merge detection)
3. Customers + Sales + Invoice PDF
4. Dashboard + Reports + Analytics
5. Settings + Users management + Audit log UI + deployment prep

## Testing and Verification

After any change, run through this smoke test:

1. Log in as admin, log in as salesperson — role restrictions visible
2. Add a laptop (both unit and batch modes) — merge prompt works on duplicate New
3. Excel import → preview → commit — merges count correctly
4. +/- buttons on batch inventory row — optimistic UI, rollback on 400
5. Create a sale with new customer — invoice PDF downloads, inventory decrements
6. Cancel a sale (admin) — inventory restored
7. Dashboard KPIs match manual calculation on seed data
8. Audit log shows all recent actions

## Deployment

- **Local / on-shop PC:** Node + local MongoDB + PM2 for auto-start
- **Cloud (optional):** Vercel (frontend) + Render (backend) + MongoDB Atlas
- See `DEPLOYMENT.md` for full step-by-step

## Known Decisions & Tradeoffs

- **Hybrid inventory model** chosen over pure per-unit for operational simplicity on identical new stock while preserving per-unit tracking for used laptops
- **JWT in httpOnly cookie** rather than localStorage to prevent XSS token theft
- **Snapshot pattern on sales** so editing customer/laptop records never changes historical invoices
- **Soft delete / archive** for users and inventory instead of hard delete, to preserve sales history referential integrity
- **Single MongoDB, no Redis** — scale is small (single shop), simpler is better