# Backend Analysis & Codebase Audit Report

## 1. Existing Architecture

The current project is a lightweight proof-of-concept for WhatsApp messaging and contact tagging:
- **Backend Stack**: Node.js, Express (v4), PostgreSQL (`pg` pool, raw SQL queries).
- **Frontend Stack**: 
  - `frontend/`: Vanilla HTML/CSS/JS single-page client.
  - `whatsappFrotend/`: Boilerplate Vite + React + TypeScript setup (default starter template).
- **External Integration**: Meta WhatsApp Cloud API (`https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages`).
- **Database**: Single PostgreSQL database instance managed via `backend/schema.sql`.

---

## 2. Current Folder Structure

```
whatsapp-tagging-app/
├── backend/
│   ├── .env                    # Environment variables (DB URL, Meta tokens)
│   ├── db.js                   # PostgreSQL connection pool configuration
│   ├── package.json            # Node.js dependencies (axios, cors, dotenv, express, pg)
│   ├── schema.sql              # Database DDL script
│   ├── server.js               # Express application entry point & route registration
│   ├── whatsapp.js             # Meta Cloud API HTTP wrapper (sendText, sendTemplate)
│   └── routes/
│       ├── contacts.js         # Contact CRUD & tag association endpoints
│       ├── messages.js         # Text/template send & broadcast logic
│       ├── tags.js             # Tag CRUD operations
│       └── webhook.js          # Webhook verification & incoming event handler
├── frontend/                   # Vanilla JavaScript SPA (legacy)
│   ├── app.js
│   ├── index.html
│   └── style.css
├── whatsappFrotend/            # React + TypeScript + Vite SPA shell
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── vite.config.ts
└── README.md                   # Basic setup documentation
```

---

## 3. Existing API Endpoints

| Method | Endpoint | Description | Query / Body Params |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server health check | None |
| `GET` | `/api/contacts` | List contacts with aggregated tags | `?tag=name` |
| `POST` | `/api/contacts` | Create or update contact by WA number | `{ wa_number, name }` |
| `POST` | `/api/contacts/:id/tags` | Associate tag with contact | `{ tag_id }` |
| `DELETE` | `/api/contacts/:id/tags/:tagId` | Remove tag association | None |
| `GET` | `/api/tags` | List all tags | None |
| `POST` | `/api/tags` | Create tag | `{ name, color }` |
| `DELETE` | `/api/tags/:id` | Delete tag | None |
| `GET` | `/api/messages/:contactId` | Fetch message history for contact | None |
| `POST` | `/api/messages/send` | Send free-text message (24h window) | `{ contact_id, body }` |
| `POST` | `/api/messages/send-template` | Send template message | `{ contact_id, template_name, language_code, params }` |
| `POST` | `/api/messages/broadcast` | Broadcast template message by tag | `{ tag_id, template_name, language_code, params }` |
| `GET` | `/webhook` | Meta Webhook verification handshake | `hub.mode, hub.verify_token, hub.challenge` |
| `POST` | `/webhook` | Meta Webhook event receiver | Raw Webhook payload |

---

## 4. Database Entities & Tables

### `contacts`
- `id` (SERIAL PRIMARY KEY)
- `wa_number` (VARCHAR(20) UNIQUE NOT NULL) - Digits only without `+` or spaces
- `name` (VARCHAR(255))
- `last_message_at` (TIMESTAMPTZ) - Tracks customer-initiated 24-hour service window
- `created_at` (TIMESTAMPTZ DEFAULT now())

### `tags`
- `id` (SERIAL PRIMARY KEY)
- `name` (VARCHAR(100) UNIQUE NOT NULL)
- `color` (VARCHAR(7) DEFAULT '#6b7280')
- `created_at` (TIMESTAMPTZ DEFAULT now())

### `contact_tags`
- `contact_id` (INTEGER REFERENCES contacts(id) ON DELETE CASCADE)
- `tag_id` (INTEGER REFERENCES tags(id) ON DELETE CASCADE)
- `PRIMARY KEY (contact_id, tag_id)`

### `messages`
- `id` (SERIAL PRIMARY KEY)
- `contact_id` (INTEGER REFERENCES contacts(id) ON DELETE CASCADE)
- `direction` (VARCHAR(10) CHECK ('inbound', 'outbound'))
- `body` (TEXT)
- `wa_message_id` (VARCHAR(100)) - Meta message ID (`wamid.HBgL...`)
- `status` (VARCHAR(20) DEFAULT 'sent') - `sent` | `delivered` | `read` | `failed` | `received`
- `created_at` (TIMESTAMPTZ DEFAULT now())

---

## 5. Core Operational Flows

### A. WhatsApp API Flow
1. API calls `axios` client configured with base URL `https://graph.facebook.com/{API_VERSION}/{PHONE_NUMBER_ID}`.
2. Authorization header injects `Bearer {WHATSAPP_ACCESS_TOKEN}`.
3. `sendText` builds text payload: `{ messaging_product: 'whatsapp', to, type: 'text', text: { body } }`.
4. `sendTemplate` builds template payload: `{ messaging_product: 'whatsapp', to, type: 'template', template: { name, language, components } }`.

### B. Webhook Flow
1. Meta sends `GET /webhook` with verify token; server verifies `hub.verify_token` against `WHATSAPP_WEBHOOK_VERIFY_TOKEN` and echoes `hub.challenge`.
2. Meta sends `POST /webhook` for incoming messages and status callbacks.
3. **CRITICAL DEFECT IDENTIFIED**: `webhook.js` contains a early `return;` statement on line 32 after `console.log`, causing incoming messages and status updates to be completely skipped in execution!

### C. Message & Session Window Flow
1. Outbound free-text messaging checks `contact.last_message_at`.
2. If `(Date.now() - last_message_at) >= 24 hours`, endpoint returns `409 Conflict` requiring a template message.
3. Outbound messages insert a record into `messages` table with `status = 'sent'`.

---

## 6. Current Strengths & Weaknesses

### Strengths
- Clean separation of database connection (`db.js`), routes, and WhatsApp API client (`whatsapp.js`).
- Native 24-hour Customer Service Window enforcement for free-text messages.
- Clean database schema design with cascade deletion constraints.
- Lightweight and fast execution footprint.

### Weaknesses & Technical Debt
1. **Disabled Webhook Processing**: Line 32 of `webhook.js` returns early, breaking real-time message ingestion and status delivery updates.
2. **Synchronous Broadcast Loop**: `/api/messages/broadcast` iterates over contacts in a standard `for...of` loop with synchronous `await`. Blocking HTTP connection for large contact groups will cause request timeouts.
3. **No Dynamic Template Variable System**: Templates rely on a flat `params` array of strings. No parameter discovery, header media handling, button parameter binding, or contact field interpolation.
4. **Missing Authentication & Authorization**: All routes are publicly accessible without JWT/Session verification or role checks.
5. **No Contact Custom Fields, Notes, or Opt-In Tracking**: Lacks compliance features (opt-in/opt-out), contact notes, email, or metadata.
6. **No File Import Engine**: Contact management is limited to single manual creation or basic queries.
7. **No Server-Side Pagination & Filtering**: Contacts and messages return complete unpaginated datasets, leading to severe memory and performance degradation on large tables.
8. **Single-Tenant Database**: Hardcoded single WABA configuration without multi-tenant isolation.
9. **No Error Recovery or Retry Mechanism**: Failed broadcast items are simply recorded with error strings; no automated queue retry or exponential backoff exists.

---

## 7. Security Audit & Vulnerabilities

1. **Authentication Absence**: API endpoints lack auth middleware. Anyone with network access can send messages, trigger broadcasts, and delete contacts.
2. **Raw Token Leak Risk**: Debugging statements (`console.log(VERIFY_TOKEN + "kek")`) expose sensitive credentials in log files.
3. **Missing Webhook Signature Validation**: `POST /webhook` does not verify Meta's `X-Hub-Signature-256` HMAC SHA-256 payload signature.
4. **Unvalidated Input**: Phone numbers, tag colors, and message content are stored without strict normalization (e.g. E.164 compliance) or length sanitization.
5. **CORS Open Policy**: `app.use(cors())` permits requests from any origin.

---

## 8. Scalability & Architectural Bottlenecks

- **Database Connection Pool Exhaustion**: Large broadcast batch loops issue synchronous sequential queries inside standard HTTP handlers.
- **Unindexed Message Queries**: `messages.wa_message_id` is missing an index; status updates via webhooks perform full table scans on large tables.
- **Lack of Background Job Processing**: Imports and broadcasts execute on Express main event loop instead of a background job queue.

---

## 9. Recommended Target Architecture

- **Backend**: Express + TypeScript / ESM modular architecture with Service-Repository pattern.
- **Queue/Async Processing**: Background job queue system for bulk operations (broadcasts, imports, webhook processing) with concurrency control and rate limiting.
- **Frontend**: Modern React + TypeScript SPA powered by Vite, Tailwind CSS / Vanilla CSS system, Lucide icons, React Router, and clean state management.
- **Database**: Enhanced PostgreSQL schema with indexing on `wa_message_id`, `wa_number`, `organization_id`, full audit log, import history, and template component metadata tables.
