# AttendanceMS — Labour Attendance Management System

A full-stack web application for managing labour attendance, payroll, advances, leaves, and site operations in small-to-medium organisations. Deployable as a PWA or Android app.

---

## Features

### Core
- **Multi-role authentication** — Admin, Manager, Labour with JWT (8-hour access token + 30-day refresh)
- **Labour management** — Add, edit, deactivate labours; configure pay cycle (weekly / monthly), daily wage, joining date
- **Daily attendance** — Mark Present / Absent / Half Day / Present+Half / Double Duty; bulk entry; fill-month shortcut
- **Salary calculation** — Weekly (Sat–Fri) or rolling-monthly cycles; auto-consolidates unpaid periods; partial payments supported
- **Salary slip** — Printable salary slip per labour
- **Pay register** — Monthly payroll register view with per-week breakdown
- **Statistics** — Organisation overview, weekly trend charts, labour-wise analytics, site-wise cost breakdown

### Financial
- **Advance management** — Issue advances, track repaid amounts, full or partial deduction from salary payments
- **Overtime tracking** — Log extra hours with rate multiplier

### HR
- **Leave management** — Sick (12), Casual (12), Earned (15) days per year; approve/reject workflow; balance tracking
- **Document management** — Upload and view Aadhaar, PAN, photos, certificates per labour (PDF/JPG/PNG/DOC)

### Operations
- **Multi-site support** — Create sites, assign labours, filter salary/attendance by site; site-wise cost charts
- **Payroll register** — Grouped by site; pending amounts per site filter on salary page

### Notifications
- **In-app notifications** — Bell icon with unread count
- **WhatsApp** — Notifications via Meta Cloud API
- **Push notifications** — Web Push (VAPID) for browsers and PWA

### Platform
- **PWA** — Installable on Android/iOS home screen; offline indicator with sync queue
- **Android app** — Capacitor 6 build (Android Studio / APK)
- **Dark mode** — Full dark theme toggle
- **CSV export** — Labour, attendance, and salary data exports
- **Audit log** — Full change history across all entities
- **Backup / Restore** — Admin-triggered data backups

### Café Inventory *(admin-only during testing)*
- Track stock entries (item, quantity, unit price, supplier, site) per site
- Manage items with categories and units
- Dashboard with monthly cost summary
- Analytics charts (by item, by site, trend)
- Admin-controlled price access per manager (`cafe_price_access` toggle)
- Edit and delete stock entries

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI (Python 3.9+) |
| **Database** | CSV / SQLite (default) or PostgreSQL (`USE_POSTGRES=true`) |
| **ORM** | SQLAlchemy (PostgreSQL mode) |
| **Auth** | JWT (python-jose), bcrypt (passlib) |
| **Frontend** | React 18 + Vite |
| **Styling** | TailwindCSS + PostCSS |
| **Charts** | Recharts |
| **Icons** | Lucide React |
| **HTTP client** | Axios (in-memory cache + TTL, auto token refresh) |
| **Routing** | React Router v6 |
| **Mobile** | Capacitor 6 (Android) |
| **Deploy — backend** | Render |
| **Deploy — frontend** | Vercel |

---

## Project Structure

```
attendance/
├── backend/
│   ├── app/
│   │   ├── routers/
│   │   │   ├── auth.py          # Login, register, refresh, user management
│   │   │   ├── labours.py       # Labour CRUD
│   │   │   ├── attendance.py    # Mark & query attendance
│   │   │   ├── salary.py        # Calculate, pay, register, slip
│   │   │   ├── stats.py         # Charts and overview data
│   │   │   ├── advances.py      # Advance issuance and repayment
│   │   │   ├── leaves.py        # Leave application and approval
│   │   │   ├── overtime.py      # Overtime logging
│   │   │   ├── sites.py         # Site management and labour assignment
│   │   │   ├── export.py        # CSV exports
│   │   │   ├── reports.py       # HTML reports and salary slips
│   │   │   ├── notifications.py # In-app notifications
│   │   │   ├── push.py          # Web push subscriptions
│   │   │   ├── documents.py     # Document upload/download
│   │   │   ├── audit.py         # Audit log
│   │   │   ├── backup.py        # Backup and restore
│   │   │   ├── cafe_items.py    # Café item catalogue
│   │   │   └── cafe_stock.py    # Café stock entries and analytics
│   │   ├── main.py              # App factory, startup migrations
│   │   ├── models.py            # Pydantic models
│   │   ├── db_models.py         # SQLAlchemy ORM models
│   │   ├── db_operations.py     # PostgreSQL DB operations
│   │   ├── database.py          # CSV DB operations
│   │   ├── db_wrapper.py        # CSV ↔ PostgreSQL abstraction
│   │   ├── db_connection.py     # SQLAlchemy engine setup
│   │   ├── salary_calculator.py # Pay cycle and salary logic
│   │   ├── auth.py              # JWT helpers
│   │   ├── config.py            # Paths and constants
│   │   ├── whatsapp_service.py  # Meta WhatsApp Cloud API
│   │   └── push_service.py      # VAPID push notifications
│   ├── data/                    # CSV data files (auto-created)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Layout.jsx        # Sidebar, top bar, dark mode toggle
│   │   │   ├── NotificationBell.jsx
│   │   │   ├── OfflineIndicator.jsx
│   │   │   ├── SalarySlip.jsx
│   │   │   └── InstallPrompt.jsx # PWA install prompt
│   │   ├── context/
│   │   │   └── AuthContext.jsx   # Global auth state
│   │   ├── hooks/
│   │   │   ├── useDarkMode.js
│   │   │   ├── usePushNotifications.js
│   │   │   └── useOfflineSync.js
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Labours.jsx
│   │   │   ├── Attendance.jsx
│   │   │   ├── Salary.jsx        # Pending payments (site-grouped) + Pay Register
│   │   │   ├── Stats.jsx
│   │   │   ├── Export.jsx
│   │   │   ├── More.jsx          # Leaves, Advances, Overtime, Sites, Documents, Reports, Audit
│   │   │   ├── Users.jsx         # User management + café price access toggle
│   │   │   ├── CafeDashboard.jsx
│   │   │   ├── CafeEntry.jsx
│   │   │   ├── CafeHistory.jsx   # With edit/delete
│   │   │   ├── CafeAnalytics.jsx
│   │   │   └── CafeItems.jsx
│   │   ├── api.js                # Axios client with cache, token refresh
│   │   ├── App.jsx               # Routes and role guards
│   │   └── main.jsx
│   ├── public/
│   │   └── sw.js                 # Service Worker
│   ├── package.json
│   ├── vite.config.js
│   └── capacitor.config.ts
└── README.md
```

---

## Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+

### Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate       # Windows
source venv/bin/activate    # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Run (CSV mode — no database setup needed)
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Access

| URL | Purpose |
|-----|---------|
| http://localhost:5173 | Frontend |
| http://localhost:8000 | Backend API |
| http://localhost:8000/docs | Swagger / OpenAPI docs |

### Default Login

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |

> **Change the default password immediately in production.**

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_POSTGRES` | `false` | Set `true` to use PostgreSQL instead of CSV |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `FRONTEND_URL` | — | Frontend URL for CORS allow-list |
| `SECRET_KEY` | hardcoded | JWT signing secret — **must change in production** |
| `RENDER_EXTERNAL_URL` | — | Self-ping URL to keep Render free tier alive |
| `WHATSAPP_PHONE_ID` | — | Meta WhatsApp Cloud API phone ID |
| `WHATSAPP_ACCESS_TOKEN` | — | Meta WhatsApp Cloud API token |
| `VAPID_PUBLIC_KEY` | — | Web Push VAPID public key |
| `VAPID_PRIVATE_KEY` | — | Web Push VAPID private key |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8000` | Backend base URL |

---

## Roles & Access

| Feature | Admin | Manager | Labour |
|---------|:-----:|:-------:|:------:|
| Dashboard | ✅ | ✅ | ✅ |
| Labours | ✅ | ✅ | — |
| Attendance | ✅ | ✅ | ✅ (view) |
| Salary | ✅ | — | — |
| Statistics | ✅ | — | — |
| Export | ✅ | — | — |
| More (Leaves, Advances, etc.) | ✅ | — | — |
| Users | ✅ | — | — |
| Café Inventory | ✅ | ✅* | — |
| Café Analytics | ✅ | — | — |
| Café Prices | ✅ | toggle† | — |

\* Café routes currently restricted to Admin during testing phase.
† Admin can grant `cafe_price_access` per manager in the Users page.

---

## Salary Logic

- **Weekly cycle**: Week runs Saturday → Friday. Salary = `days_present × daily_wage`.
- **Monthly cycle**: Rolling monthly periods anchored to `joined_date` (e.g. joined Jan 11 → periods are Jan 11–Feb 10, Feb 11–Mar 10, …).
- **Attendance values**: Present = 1.0, Half Day = 0.5, Present+Half = 1.5, Double Duty = 2.0, Absent = 0.
- **Consolidation**: Unpaid periods accumulate; paying marks all periods up to the selected week/month as paid.
- **Partial payment**: Enter any amount less than the total — remaining stays pending.
- **Advance deduction**: Full or partial advance deduction can be applied at payment time.
- **Joining date change**: Changing a labour's `joined_date` automatically wipes unpaid salary records so they are recalculated cleanly from the new anchor date. Use **Recalculate** to regenerate.

---

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full step-by-step instructions.

**Quick summary:**
1. Create a PostgreSQL database (Render / Supabase / Neon)
2. Deploy backend to Render — set `USE_POSTGRES=true` and `DATABASE_URL`
3. Deploy frontend to Vercel — set `VITE_API_URL` to your Render URL
4. Update `FRONTEND_URL` on Render with your Vercel URL

---

## Android / PWA Build

```bash
cd frontend

# Build and sync to Capacitor
npm run cap:build

# Open Android Studio
npm run cap:android

# Run on connected device / emulator
npm run cap:run:android
```

---

## API Overview

Full interactive documentation available at `/docs` (Swagger UI).

| Router | Prefix | Notes |
|--------|--------|-------|
| Auth | `/auth` | Login, refresh, user management |
| Labours | `/labours` | CRUD |
| Attendance | `/attendance` | Single, bulk, fill-month |
| Salary | `/salary` | Calculate, pay, register, slip |
| Advances | `/advances` | Issue, repay, deduct |
| Leaves | `/leaves` | Apply, approve, balance |
| Overtime | `/overtime` | Log extra hours |
| Sites | `/sites` | Create, assign, group |
| Statistics | `/stats` | Charts and overviews |
| Export | `/export` | CSV downloads |
| Reports | `/reports` | HTML payroll reports |
| Notifications | `/notifications` | In-app bell |
| Push | `/push` | Subscribe / unsubscribe |
| Documents | `/documents` | Upload / download (auth-gated) |
| Audit | `/audit` | Change history (admin) |
| Backup | `/backup` | Backup and restore (admin) |
| Café Items | `/cafe/items` | Item catalogue |
| Café Stock | `/cafe/stock` | Entries, dashboard, analytics |

---

## License

MIT
