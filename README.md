# 🚀 Enterprise WhatsApp Cloud API CRM & Messaging Platform

A full-stack, production-grade WhatsApp Customer Relationship Management (CRM), Live Chat Inbox, and Broadcast Messaging Platform built on top of the **Meta WhatsApp Cloud API**, **Node.js/Express**, **PostgreSQL**, and **React 18 + TypeScript + Vite**.

---

## 🌟 Key Features & Capabilities

- **💬 Real-Time Live Chat Inbox**:
  - Customer thread list with unread counter badges and 24-hour Customer Service Window countdown timers.
  - Text messaging, image/video/document attachments, and approved Meta template quick senders.
  - Delivery checkmarks: `sent` (✓), `delivered` (✓✓), `read` (✓✓ blue), `failed` (⚠️).
  - Mobile-first single-pane thread layout with header back button on small screens.

- **📇 Contact CRM & Audience Segmentation**:
  - E.164 phone normalization, email, country code, opt-in consent status tracking (`opted_in` vs `opted_out`).
  - Color-coded tag system with inline manual tag assignment & removal.
  - Custom fields (JSONB key-value store), internal agent notes, and search/filtering.
  - One-click CSV contact export.
  - Responsive desktop data table and mobile contact cards.

- **📊 Advanced Contact Importer Engine**:
  - Import `.csv`, `.xlsx`, and `.xls` files.
  - Automatic column header detection & interactive column re-mapping.
  - Duplicate resolution options (`SKIP` existing or `UPDATE` existing contact profiles).
  - Background batch processing with progress bar and downloadable CSV error report for invalid rows.

- **✨ Dynamic WhatsApp Template Engine**:
  - Instant template synchronization from Meta Cloud API (`GET /v21.0/{WABA_ID}/message_templates`).
  - Component variable inspector for `HEADER`, `BODY` (`{{1}}`, `{{2}}`), `FOOTER`, and `BUTTONS`.
  - Dynamic contact field binding (`{{contact.name}}`, `{{contact.email}}`, `{{contact.phone}}`, `{{current_date}}`).
  - Live interactive mobile phone device preview.

- **📢 Broadcast Campaigns & Queue Execution**:
  - Audience targeting (All opted-in contacts or filtered by Tag).
  - Pre-flight recipient estimator excluding opted-out contacts.
  - Rate-limited background queue execution worker (~20 messages/sec rate limit to respect Meta thresholds).
  - Real-time campaign controls: **Launch**, **Pause**, **Resume**, and **Cancel**.

- **⚡ Robust Webhook Engine**:
  - Instant `200 OK` ACK response to prevent Meta webhook retries/timeouts.
  - `GET /webhook` verification handshake.
  - HMAC SHA-256 payload signature verification (`X-Hub-Signature-256`).
  - Idempotent event logging (`webhook_events` deduplication).
  - Inbound message ingestion and status update callbacks (`sent` -> `delivered` -> `read` -> `failed`).

- **🎨 Modern SaaS UI & Automatic Theme Engine**:
  - Centralized CSS design tokens in `index.css`.
  - Supports **System** (auto-tracks OS `prefers-color-scheme`), **Light**, and **Dark** modes with `localStorage` persistence and zero theme flash.
  - Mobile header drawer + bottom navigation bar for one-handed phone navigation.
  - Built-in Skeleton loaders, Toast notifications, and empty state illustrations.
  - Centralized Telegram Support Integration (`https://t.me/neverknown`).

---

## 📁 Repository Structure

```
whatsapp-tagging-app/
├── backend/                    # Node.js & Express REST API Server
│   ├── middleware/             # Auth & RBAC Middleware
│   ├── routes/                 # Express Router Endpoints (auth, contacts, tags, messages, conversations, templates, campaigns, imports, dashboard, webhook)
│   ├── services/               # Core Services (WhatsAppService, TemplateService, ContactService, ImportService, CampaignService, WebhookService, AuthService, DashboardService)
│   ├── scripts/                # Database Migrations (initDb.js)
│   ├── tests/                  # Automated Test Suite (template.test.js)
│   ├── schema.sql              # Enhanced PostgreSQL DDL Schema
│   └── server.js               # Application Entry Point
├── whatsappFrotend/            # Modern React 18 + TypeScript + Vite SPA
│   ├── src/
│   │   ├── components/         # Layout, UI Primitives (Toast, Skeleton, EmptyState, ThemeSwitcher)
│   │   ├── context/            # ThemeContext & ToastContext Providers
│   │   ├── pages/              # Dashboard, Contacts, Import, Tags, Inbox, Templates, Campaigns, Settings, Login
│   │   ├── types/              # TypeScript Interfaces & DTOs
│   │   └── api.ts              # Axios HTTP Client with JWT Interceptors
│   └── vite.config.ts          # Vite Config & API Proxy
└── docs/                       # System Documentation
    ├── BACKEND_ANALYSIS.md
    ├── WHATSAPP_DASHBOARD_SPEC.md
    ├── DATABASE.md
    ├── API.md
    ├── WHATSAPP_API.md
    ├── WEBHOOKS.md
    ├── CAMPAIGNS.md
    ├── IMPORTS.md
    ├── SECURITY.md
    ├── DEPLOYMENT.md
    ├── FRONTEND_ANALYSIS.md
    └── FRONTEND_DESIGN.md
```

---

## ⚙️ Environment Configuration (`backend/.env`)

Create a `.env` file inside the `backend/` directory:

```env
# --- WhatsApp Cloud API Credentials (Meta Developer Dashboard) ---
WHATSAPP_PHONE_NUMBER_ID=1360945377093153
WHATSAPP_BUSINESS_ACCOUNT_ID=1800524357778820
WHATSAPP_ACCESS_TOKEN=your_permanent_meta_access_token
WHATSAPP_API_VERSION=v26.0

# --- Webhook Verification Secret ---
# Match this exact string in Meta Dashboard > WhatsApp > Configuration > Verify Token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=choose_a_random_secret_string

# --- Database (PostgreSQL Connection String) ---
DATABASE_URL=postgres://postgres:12345@localhost:5433/whatsapp_tagging

# --- Application Server Port ---
PORT=3000

# --- Authentication ---
JWT_SECRET=super_secret_jwt_key_whatsapp_crm
```

---

## 🚀 Step-by-Step Installation & Quick Start

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **PostgreSQL**: v13 or higher

### 1. Database Setup & Initialization
Create a PostgreSQL database named `whatsapp_tagging`, then run the initializer script:

```bash
cd backend
npm run db:init
```

*This creates all database tables (`organizations`, `users`, `whatsapp_accounts`, `contacts`, `tags`, `conversations`, `messages`, `templates`, `campaigns`, `imports`, `webhook_events`, etc.) and seeds default admin credentials.*

### 2. Start Backend REST API Server

```bash
cd backend
npm run dev
# OR for production:
npm start
```
*Backend server runs at `http://localhost:3000`.*

### 3. Start React Frontend Dashboard

```bash
cd whatsappFrotend
npm run dev
```
*Frontend runs at `http://localhost:5173`.*

- **Default Admin Login**:
  - **Email**: `admin@example.com`
  - **Password**: `admin123`

---

## 🔗 Meta Webhook Setup (Local Development)

To receive real-time incoming messages and delivery status callbacks during development:

1. Expose your local backend port `3000` using `ngrok` or `cloudflared`:
   ```bash
   ngrok http 3000
   ```
2. In **Meta for Developers** -> **WhatsApp** -> **Configuration**:
   - **Callback URL**: `https://<your-ngrok-subdomain>.ngrok-free.app/webhook`
   - **Verify Token**: `choose_a_random_secret_string` (matches `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in `.env`)
3. Click **Verify and Save**.
4. Subscribe to Webhook fields: `messages`.

---

## 🧪 Running Automated Unit Tests

```bash
cd backend
node tests/template.test.js
```

---

## 📚 Technical Documentation

For detailed architectural specifications, API endpoints, database schemas, and UX guidelines, check the `/docs` directory:

- [📄 Database Architecture & DDL](docs/DATABASE.md)
- [📄 REST API Endpoints Guide](docs/API.md)
- [📄 Meta WhatsApp Cloud API Guide](docs/WHATSAPP_API.md)
- [📄 Webhook System Specifications](docs/WEBHOOKS.md)
- [📄 Broadcast Campaign Architecture](docs/CAMPAIGNS.md)
- [📄 Contact Import Specifications](docs/IMPORTS.md)
- [📄 Security & Compliance](docs/SECURITY.md)
- [📄 Production Deployment Guide](docs/DEPLOYMENT.md)
- [📄 Frontend Design System & Mobile UX](docs/FRONTEND_DESIGN.md)

---

## 📞 Support

For custom integrations or assistance:
- **Telegram Support**: [@neverknown](https://t.me/neverknown)
