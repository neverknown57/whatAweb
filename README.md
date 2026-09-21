# Enterprise WhatsApp CRM & Messaging Platform

A full-stack, production-ready WhatsApp Customer Relationship Management (CRM) and Messaging Platform built on top of the Meta WhatsApp Cloud API.

---

## 🌟 Key Features

- **Dashboard Analytics**: Real-time KPI summary cards, message volume counters, 24h active chat metrics, tag distribution, and recent campaign logs.
- **Contact CRM**: Full contact directory with E.164 phone normalization, email, notes, custom fields (JSONB), opt-in consent tracking, pagination, search, and CSV export.
- **Contact Importer Engine**: Multi-format CSV/XLSX contact importer with column auto-header detection, interactive mapping, duplicate handling (`SKIP` / `UPDATE`), background batch processing, and downloadable error report CSV.
- **Color-Coded Tag System**: Audience tagging, bulk tag assignments, and multi-tag filtering.
- **WhatsApp Live Chat Inbox**: Real-time CRM chat interface, 24-hour Customer Service Window countdown indicator, text/media message composer, template quick send, and delivery status ticks (sent ✓, delivered ✓✓, read ✓✓ blue).
- **Meta Webhook Engine**: Verification handshake, HMAC SHA-256 signature verification, fast ACK HTTP response, idempotent event logging (`webhook_events`), and status update callbacks.
- **Dynamic Template Builder**: Meta template catalog sync, dynamic variable field generator (`{{1}}`), parameter binding (`{{contact.name}}`), and live WhatsApp mobile phone device preview.
- **Broadcast Campaigns**: Audience targeting, pre-flight recipient estimator, rate-limited background queue execution, pause/resume/cancel controls, and delivery tracking.
- **Multi-Tenant Ready & Security**: Multi-tenant database schema (`organizations`), JWT authentication, role-based access control (Admin, Manager, Agent), and password hashing via `bcryptjs`.

---

## 📁 Repository Architecture

```
whatsapp-tagging-app/
├── backend/                    # Node.js & Express REST API Server
│   ├── middleware/             # Auth & RBAC Middleware
│   ├── routes/                 # Express Router Endpoints (auth, contacts, tags, messages, conversations, templates, campaigns, imports, dashboard, webhook)
│   ├── services/               # Core Services (WhatsAppService, TemplateService, ContactService, ImportService, CampaignService, WebhookService, AuthService, DashboardService)
│   ├── scripts/                # Database Migrations & Seed Scripts
│   ├── tests/                  # Automated Test Suite
│   ├── schema.sql              # Enhanced PostgreSQL DDL Schema
│   └── server.js               # Application Entry Point
├── whatsappFrotend/            # Modern React + TypeScript + Vite SPA
│   ├── src/
│   │   ├── components/         # Layout & Shared UI Components
│   │   ├── pages/              # Dashboard, Contacts, Import, Tags, Inbox, Templates, Campaigns, Settings, Login
│   │   ├── types/              # TypeScript Interfaces & DTOs
│   │   └── api.ts              # Axios HTTP Client with JWT Interceptors
│   └── vite.config.ts          # Vite Configuration & API Proxy
└── docs/                       # Comprehensive System Documentation
    ├── BACKEND_ANALYSIS.md
    ├── WHATSAPP_DASHBOARD_SPEC.md
    ├── DATABASE.md
    ├── API.md
    ├── WHATSAPP_API.md
    ├── WEBHOOKS.md
    ├── CAMPAIGNS.md
    ├── IMPORTS.md
    ├── SECURITY.md
    └── DEPLOYMENT.md
```

---

## 🚀 Quick Start Guide

### 1. Database Initialization
Make sure PostgreSQL is running, then run:
```bash
cd backend
npm run db:init
```

### 2. Start Backend Server
```bash
cd backend
npm start
```
Server runs at `http://localhost:3000`.

### 3. Start React Frontend Dashboard
```bash
cd whatsappFrotend
npm run dev
```
Frontend runs at `http://localhost:5173`. Default Login: `admin@example.com` / `admin123`.

---

## 🧪 Running Unit Tests
```bash
cd backend
node tests/template.test.js
```
