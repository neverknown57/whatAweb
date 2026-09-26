# WhatsApp CRM REST API Server

Node.js & Express REST API server providing Meta WhatsApp Cloud API communications, contact CRM, CSV/XLSX imports, template dynamic parsing, broadcast queue workers, and webhook handlers.

---

## 🛠️ Environment Configuration (`.env`)

```env
# Meta WhatsApp Cloud API Credentials
WHATSAPP_PHONE_NUMBER_ID=123456785890
WHATSAPP_BUSINESS_ACCOUNT_ID=18008888888
WHATSAPP_ACCESS_TOKEN=your_permanent_meta_access_token
WHATSAPP_API_VERSION=v27.0

# Webhook Verification Token Secret
WHATSAPP_WEBHOOK_VERIFY_TOKEN=choosesecretstring

# PostgreSQL Database Connection
DATABASE_URL=postgres://postgres:password@localhost:5433/db_name

# Server Port & Auth
PORT=3000
JWT_SECRET=super_secret_jwt_key_whatsapp_crm
```

---

## 🚀 Quick Commands

### Database Migration & Initial Seed
```bash
npm run db:init
```

### Start Server (Development Mode with auto-restart)
```bash
npm run dev
```

### Start Server (Production Mode)
```bash
npm start
```

### Run Automated Unit Tests
```bash
node tests/template.test.js
```

---

## 🔗 Key Endpoints

- `GET /health` - Server health status
- `GET /webhook` - Meta webhook verification handshake
- `POST /webhook` - Meta incoming event & status update callbacks
- `POST /api/auth/login` - User authentication
- `GET /api/contacts` - Search, filter, paginate CRM contacts
- `POST /api/contacts/import/process` - Async CSV/XLSX contact import
- `GET /api/conversations` - Active CRM chat threads
- `POST /api/messages/send` - Send free-text (24h window)
- `POST /api/messages/send-template` - Send approved Meta template
- `POST /api/campaigns` - Create broadcast campaign
- `POST /api/campaigns/:id/start` - Trigger campaign queue worker
