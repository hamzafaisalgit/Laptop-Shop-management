# Laptop Shop Management System

A full-stack internal management system for a single offline laptop shop. Handles inventory, sales, customers, invoicing, and reporting — staff-only, no customer-facing pages.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, React Hook Form, Zod, Recharts, Sonner |
| Backend | Node.js, Express 5, Mongoose |
| Database | MongoDB |
| Auth | JWT via httpOnly cookies |
| PDF | PDFKit |
| Excel | SheetJS (xlsx) |

---

## Features

### Inventory
- Add laptops manually or via bulk Excel import (.xlsx)
- Every laptop has a quantity, serial number, condition, full specs, cost/selling/min-sale price, and supplier
- Merge detection — importing or adding a laptop that already exists (same specs + price) prompts to merge quantities rather than duplicate
- Low-stock alerts with configurable threshold per record
- Soft archive (preserves sales history)
- Per-laptop audit trail

### Sales
- Full invoice flow with line items, accessories, flat/percent discount and tax
- Invoice PDF generated server-side (PDFKit), sequential numbering `INV-YYYY-NNNN`
- Customer details snapshotted into each sale — editing a customer never alters past invoices
- Cancel sale (admin) restores inventory automatically
- Draft persistence in localStorage

### Customers
- Customer profiles with purchase history and total spend
- Linked to sales; new customers can be created inline during checkout

### Reports & Dashboard
- KPI cards: revenue, profit, units sold (today / this month / this year)
- Sales trend chart, top brands by revenue, slow-moving inventory
- Stock value (cost and retail)
- Low-stock list

### Access Control
- **Admin** — full access including cost prices, profit, deletion, reports, bulk import
- **Salesperson** — inventory view, create sales, receive stock; cost price and profit never sent by the API
- Role enforcement is server-side; frontend hiding is cosmetic only

### Other
- Dark / light mode toggle, persisted in localStorage
- Excel import template download with example row
- Role-consistency test suite (`npm run test:roles`)
- Demo seed script (`npm run seed:demo`)

---

## Project Structure

```
laptop-shop-management/
├── backend/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── services/        # Import parser, invoice PDF, merge detector
│   ├── utils/           # SKU generator, audit logger, invoice numbering
│   ├── scripts/         # Seed scripts, role-consistency tests
│   └── server.js
└── frontend/
    └── src/
        ├── pages/
        ├── components/
        ├── hooks/
        └── lib/
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)

### Setup

```bash
# Backend
cd backend
cp .env.example .env      # fill in MONGO_URI and JWT_SECRET
npm install
npm run dev               # runs on :5000

# Frontend
cd frontend
cp .env.example .env      # set VITE_API_URL=http://localhost:5000/api
npm install
npm run dev               # runs on :5173
```

### Seed demo data

```bash
cd backend
npm run seed:demo
```

Default credentials after seeding: `admin / admin123` and `salesperson / sales123`

---

## Environment Variables

**Backend (`backend/.env`)**
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/laptop_shop
JWT_SECRET=<long random string>
JWT_EXPIRES=7d
NODE_ENV=development
CLIENT_URL=http://localhost:5173
```

**Frontend (`frontend/.env`)**
```
VITE_API_URL=http://localhost:5000/api
```

---

## Security Notes

- Passwords hashed with bcrypt (cost 12)
- JWT stored in httpOnly cookie — not accessible to JavaScript
- Sensitive fields (`costPrice`, `minSalePrice`, profit) stripped server-side for salesperson role
- Login rate-limited to 5 attempts per 15 min per IP
