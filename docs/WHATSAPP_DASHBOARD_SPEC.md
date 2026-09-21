# WhatsApp Business Platform CRM & Messaging Dashboard Specification

## 1. System Overview & Product Scope

The application is an enterprise-grade WhatsApp Customer Relationship Management (CRM) and Messaging Platform built on top of the Meta WhatsApp Cloud API. It provides real-time conversation management, contact profiling, CSV/XLSX contact import, dynamic template parsing, automated variable binding, broadcast campaigns, consent management, and analytics.

---

## 2. Functional Modules & Architecture

### A. Dashboard & Analytics
- **KPI Metrics**: Total Contacts, New Contacts (7d/30d), Total Messages Sent, Delivered Rate (%), Read Rate (%), Delivery Failures, Inbound Messages, Active Conversations (24h Window).
- **Interactive Visualizations**:
  - Daily Message Volume (Sent, Delivered, Read, Failed) stacked bar/line charts.
  - Contacts by Tag distribution bar chart.
  - Template Usage breakdown pie chart.
  - Active Campaign progress widgets.

### B. Contact Profile & CRM System
- **Fields**:
  - `id`, `organization_id`, `wa_number` (E.164 formatted, e.g. `+14155552671`), `name`, `email`, `country_code`, `source` (Import, Webhook, Manual), `opt_in_status` (`opted_in`, `opted_out`), `opt_in_timestamp`, `opt_out_timestamp`.
  - `notes` (Internal agent notes), `custom_fields` (JSONB key-value store for attributes like `order_id`, `company`, `plan`), `last_message_at`, `conversation_status` (`open`, `pending`, `closed`).
- **Validation**: Strict E.164 phone normalization powered by `google-libphonenumber` or custom regex fallback (`/^\+[1-9]\d{1,14}$/`).

### C. Advanced Contact Importer Engine
- **Supported Formats**: `.csv`, `.xlsx`, `.xls`.
- **Import Flow**:
  1. **Upload**: Accepts file via multipart form upload.
  2. **Parsing & Detection**: Parses headers and auto-maps columns (`name`, `phone`, `email`, `tags`, `custom_fields`).
  3. **Mapping UI**: Drag/drop or dropdown selection for manual column re-mapping.
  4. **Validation & Preview**: Previews first 10 rows, validates E.164 phone formats, flags malformed numbers and duplicate rows.
  5. **Duplicate Resolution Strategy**:
     - `SKIP`: Keep existing contact without modifying.
     - `UPDATE`: Overwrite existing contact fields with non-empty values from file.
     - `CREATE_DUPLICATE`: Flag as error.
  6. **Background Execution**: Processes imports in asynchronous batches (100 rows per batch) with real-time status reporting (`pending` -> `processing` -> `completed` / `failed`).
  7. **Error Report**: Generates downloadable CSV report of failed rows with exact error reasons.

### D. Tagging & Audience Segmentation
- **Tag Entity**: `id`, `organization_id`, `name`, `color` (Hex code), `created_at`.
- **Features**:
  - Custom tag creation, color picker, tag renaming, deletion.
  - Multi-tag assignment per contact.
  - Bulk actions: Tag contacts, untag contacts, bulk export.
  - Advanced filtering: Match contacts with `ALL` tags (AND) or `ANY` tag (OR).

### E. Live Inbox & Conversations Platform
- **CRM Chat Layout**: Split view with Contact List (Left) and Chat Window (Right).
- **Session Window Indicator**: Visual countdown timer showing remaining hours/minutes in customer's 24-hour service window. Warns agent when free-text is disabled and forces template selection.
- **Message Types Supported**:
  - Free-text messages (when within 24h window).
  - WhatsApp Approved Templates (with dynamic parameter inputs).
  - Media attachments (Image, Video, Audio, Document, Location).
  - Outbound delivery status ticks: `sending` (🕒), `sent` (✓), `delivered` (✓✓), `read` (✓✓ blue), `failed` (⚠️).

### F. Meta Webhook Engine & Event Processor
- **Verification Endpoint**: `GET /webhook` verifying `hub.verify_token` and responding with `hub.challenge`.
- **Event Handler (`POST /webhook`)**:
  - Immediately acknowledges HTTP request with `200 OK` (under 100ms response window).
  - **Idempotency**: Logs raw event to `webhook_events` with unique `event_id` or Meta `wamid`. Drops duplicate deliveries.
  - **Payload Signature Validation**: Validates `X-Hub-Signature-256` header against `WHATSAPP_APP_SECRET`.
  - **Event Normalization**: Parses inbound text/media messages, updates `contacts.last_message_at`, and updates outbound message statuses (`sent` -> `delivered` -> `read` -> `failed`).

### G & H & I. Dynamic Template Parser & Parameter System
- **Template Synchronization**: Fetches template definitions from Meta Cloud API (`GET /v21.0/{WABA_ID}/message_templates`).
- **Template Structure Analysis**:
  - `HEADER`: `TEXT` (supports `{{1}}`), `IMAGE`, `VIDEO`, `DOCUMENT`.
  - `BODY`: Parses `{{1}}`, `{{2}}`, ..., `{{n}}` placeholders.
  - `FOOTER`: Static plain text.
  - `BUTTONS`: `QUICK_REPLY`, `URL` (supports dynamic URL suffix `{{1}}`), `PHONE_NUMBER`.
- **Dynamic Parameter UI**:
  - Scans template component tree and dynamically renders form controls.
  - Parameter source selection:
    - **Contact Attribute**: Auto-resolves `{{contact.name}}`, `{{contact.phone}}`, `{{contact.email}}`, `{{contact.custom_fields.order_id}}`.
    - **System Variable**: Auto-resolves `{{current_date}}`, `{{current_time}}`.
    - **Manual Input**: Static user-provided text.

### J & K. Live WhatsApp Message Preview
- **Preview Component**: Mobile device mock rendering exact message layout:
  - Header image/video/document placeholder or actual media preview.
  - Body text with resolved variable substitutions highlighted.
  - Footer text.
  - Interactive action buttons.
- **Pre-flight Validation**: Disables send button and flags missing/unresolved template parameters in red.

### L & M. Campaign Engine & Queue Execution
- **Campaign Pipeline**:
  1. Define Campaign Name & Select Approved Template.
  2. Map Template Parameters (Static values or Contact variable binding).
  3. Select Audience (All Contacts, Tag Filter, Custom Filter).
  4. Review Target Recipient Summary (Total Eligible, Opted Out Excluded, Invalid Numbers Excluded).
  5. Schedule or Immediately Launch.
- **Queue Execution & Rate Limiting**:
  - Asynchronous background worker processes campaign recipients in configurable batches (e.g. 50 messages/sec rate limit).
  - State machine: `draft` -> `scheduled` -> `running` -> `paused` -> `completed` / `cancelled`.
  - Retries transient network failures with exponential backoff (max 3 retries).

### N. Message Lifecycle & Audit Trail
- Messages transition through: `queued` -> `sending` -> `sent` -> `delivered` -> `read` / `failed`.
- Detailed error logging records Meta API error codes (e.g. `131026: Message undeliverable`, `131047: Re-engagement message required`).

### O. Opt-In / Consent Management
- Strict compliance filtering: Contacts with `opt_in_status = 'opted_out'` are automatically suppressed from all campaign audience lists.
- Support for automated keyword opt-out handling via webhooks (e.g., handling "STOP" / "UNSUBSCRIBE" inbound messages).

### P & Q. Server-Side Pagination, Filtering & Search
- All lists (`/api/contacts`, `/api/messages`, `/api/campaigns`) support server-side pagination: `page`, `limit`, `sort_by`, `sort_order`, `search` query parameters.

### R & S. Multi-Tenant Architecture & Authentication
- **Authentication**: JWT-based session auth with HTTP-Only cookie or Bearer token header.
- **Password Hashing**: `bcryptjs` with salt rounds.
- **Roles & Permissions**:
  - `Admin`: Full system access, configuration, user management, template sync.
  - `Manager`: Contacts, campaigns, template sending, export.
  - `Agent`: Live chat inbox, message send, contact editing.
- **Tenant Isolation**: All database tables include `organization_id` column to support multi-tenancy.

---

## 3. Database Schema Blueprint

```sql
-- Organizations (Multi-tenant)
CREATE TABLE organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users & Auth
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'agent' CHECK (role IN ('admin', 'manager', 'agent')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WhatsApp Account Configuration
CREATE TABLE whatsapp_accounts (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    waba_id VARCHAR(100) NOT NULL,
    phone_number_id VARCHAR(100) NOT NULL,
    display_phone_number VARCHAR(50),
    access_token TEXT NOT NULL,
    verify_token VARCHAR(255) NOT NULL,
    api_version VARCHAR(20) DEFAULT 'v21.0',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts
CREATE TABLE contacts (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    wa_number VARCHAR(20) NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    country_code VARCHAR(10),
    source VARCHAR(50) DEFAULT 'manual',
    notes TEXT,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    opt_in_status VARCHAR(20) DEFAULT 'opted_in' CHECK (opt_in_status IN ('opted_in', 'opted_out')),
    opt_in_timestamp TIMESTAMPTZ DEFAULT NOW(),
    opt_out_timestamp TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ,
    conversation_status VARCHAR(20) DEFAULT 'open' CHECK (conversation_status IN ('open', 'pending', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_org_wa_number UNIQUE(organization_id, wa_number)
);

-- Tags
CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_org_tag_name UNIQUE(organization_id, name)
);

-- Contact Tags Join Table
CREATE TABLE contact_tags (
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, tag_id)
);

-- Conversations
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'open',
    unread_count INTEGER DEFAULT 0,
    last_message_preview TEXT,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    type VARCHAR(30) DEFAULT 'text' CHECK (type IN ('text', 'template', 'image', 'video', 'audio', 'document', 'location', 'interactive')),
    body TEXT,
    media_url TEXT,
    template_name VARCHAR(255),
    template_params JSONB,
    wa_message_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'received')),
    error_code VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cached Templates
CREATE TABLE templates (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    language VARCHAR(20) NOT NULL,
    status VARCHAR(50) NOT NULL,
    category VARCHAR(50),
    components JSONB NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_org_template UNIQUE(organization_id, name, language)
);

-- Campaigns
CREATE TABLE campaigns (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    language_code VARCHAR(20) DEFAULT 'en_US',
    parameter_mapping JSONB DEFAULT '{}'::jsonb,
    audience_type VARCHAR(50) DEFAULT 'all', -- 'all', 'tags'
    audience_filter JSONB DEFAULT '{}'::jsonb,
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled')),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign Recipients
CREATE TABLE campaign_recipients (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMPTZ
);

-- Imports Log
CREATE TABLE imports (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    total_rows INTEGER DEFAULT 0,
    successful_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    skipped_rows INTEGER DEFAULT 0,
    updated_rows INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_summary TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook Events Log
CREATE TABLE webhook_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for High Performance
CREATE INDEX idx_contacts_org_wa ON contacts(organization_id, wa_number);
CREATE INDEX idx_contacts_org_created ON contacts(organization_id, created_at DESC);
CREATE INDEX idx_messages_wa_id ON messages(wa_message_id);
CREATE INDEX idx_messages_contact ON messages(contact_id, created_at ASC);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at ASC);
CREATE INDEX idx_campaign_recipients_campaign ON campaign_recipients(campaign_id, status);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed, created_at);
```

---

## 4. Complete REST API Specifications

### Auth Endpoints
- `POST /api/auth/register` - Create user/organization
- `POST /api/auth/login` - Authenticate & obtain JWT
- `GET /api/auth/me` - Get current authenticated user profile

### Dashboard & Analytics Endpoints
- `GET /api/dashboard/stats` - Consolidated KPI stats, charts, and metrics
- `GET /api/dashboard/recent-activity` - Feed of recent messages, imports, campaigns

### Contact Endpoints
- `GET /api/contacts` - Search, filter, paginate contacts (`?page=1&limit=25&search=john&tag=VIP&opt_in=opted_in`)
- `POST /api/contacts` - Create contact with normalization & custom fields
- `GET /api/contacts/:id` - Get contact details, tags, custom fields, and conversation history
- `PATCH /api/contacts/:id` - Update contact attributes or notes
- `DELETE /api/contacts/:id` - Delete contact
- `POST /api/contacts/export` - Export contacts to CSV with filters applied

### Import Endpoints
- `POST /api/contacts/import/upload` - Upload file, return auto-detected column mappings & preview
- `POST /api/contacts/import/process` - Confirm mapping & duplicate strategy, start background import job
- `GET /api/imports` - Get import history
- `GET /api/imports/:id` - Get import job status and summary
- `GET /api/imports/:id/errors` - Download CSV error log for failed rows

### Tag Endpoints
- `GET /api/tags` - List all tags with usage counts
- `POST /api/tags` - Create tag
- `PATCH /api/tags/:id` - Edit tag name/color
- `DELETE /api/tags/:id` - Delete tag
- `POST /api/contacts/bulk-tag` - Add or remove tags for array of contact IDs

### Conversation & Inbox Endpoints
- `GET /api/conversations` - List active conversations with last message & unread badge
- `GET /api/conversations/:id/messages` - Fetch paginated messages for a conversation
- `POST /api/messages/send` - Send free-text message (validates 24h window)
- `POST /api/messages/send-template` - Send template message with dynamic parameter resolution
- `POST /api/messages/send-media` - Send image, video, audio, or document attachment

### Template Management Endpoints
- `GET /api/templates` - List cached Meta templates
- `POST /api/templates/sync` - Fetch latest templates from Meta Cloud API
- `GET /api/templates/:name` - Get specific template definition & required parameters

### Campaign Endpoints
- `GET /api/campaigns` - List campaigns with delivery metrics
- `POST /api/campaigns` - Create campaign with audience filter & parameter mapping
- `GET /api/campaigns/:id` - Get campaign details and recipient breakdown
- `POST /api/campaigns/:id/start` - Trigger background worker execution
- `POST /api/campaigns/:id/pause` - Pause running campaign
- `POST /api/campaigns/:id/resume` - Resume paused campaign
- `POST /api/campaigns/:id/cancel` - Cancel queued/running campaign

### Webhook Endpoints
- `GET /webhook` - Meta verification endpoint
- `POST /webhook` - Meta event callback handler

---

## 5. Security & Compliance Requirements

1. **JWT Authentication & Middleware**: Secure HTTP endpoints using JSON Web Tokens with password hashing via `bcryptjs`.
2. **Payload Verification**: Verify Meta webhook requests using `X-Hub-Signature-256` HMAC validation.
3. **Sensitive Token Isolation**: WhatsApp Permanent Tokens and App Secrets stored exclusively in server environment variables or encrypted DB columns.
4. **Input Sanitization & Protection**: Prevent SQL injection via parameterized PG queries, prevent CSV formula injection (`=`, `@`, `+`, `-`), sanitize file uploads.
5. **Rate Limiting**: Express rate limiter for auth routes (`10 req/15min`) and API routes (`100 req/min`).
