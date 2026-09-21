# Database Architecture & Entity Relationship Guide

## 1. Overview
The database is built on PostgreSQL with multi-tenant scoping (`organization_id`). All relationships include appropriate foreign key constraints with `ON DELETE CASCADE` or `ON DELETE SET NULL`.

## 2. Table Specifications

### `organizations`
Multi-tenant root entity.
- `id` (SERIAL PRIMARY KEY)
- `name` (VARCHAR(255))
- `created_at` (TIMESTAMPTZ)

### `users`
Authentication and role-based authorization.
- `id` (SERIAL PRIMARY KEY)
- `organization_id` (FK -> organizations)
- `email` (VARCHAR(255) UNIQUE)
- `password_hash` (VARCHAR(255)) - bcrypt
- `name` (VARCHAR(255))
- `role` (`admin` | `manager` | `agent`)

### `whatsapp_accounts`
Credentials and API settings for WhatsApp Cloud API.
- `id` (SERIAL PRIMARY KEY)
- `organization_id` (FK -> organizations)
- `waba_id` (VARCHAR(100))
- `phone_number_id` (VARCHAR(100))
- `access_token` (TEXT)
- `verify_token` (VARCHAR(255))
- `api_version` (VARCHAR(20))

### `contacts`
CRM profiles and consent tracking.
- `id` (SERIAL PRIMARY KEY)
- `organization_id` (FK -> organizations)
- `wa_number` (VARCHAR(20)) - E.164 digits without `+`
- `name`, `email`, `country_code`, `source`, `notes`
- `custom_fields` (JSONB)
- `opt_in_status` (`opted_in` | `opted_out`)
- `last_message_at` (TIMESTAMPTZ) - 24-hour customer window tracker
- `conversation_status` (`open` | `pending` | `closed`)

### `tags` & `contact_tags`
Color-coded tagging join table.
- `tags`: `id`, `organization_id`, `name`, `color` (Hex)
- `contact_tags`: `(contact_id, tag_id)` PRIMARY KEY

### `conversations` & `messages`
Inbox threads and message history.
- `conversations`: `id`, `contact_id`, `unread_count`, `last_message_preview`, `last_message_at`
- `messages`: `id`, `contact_id`, `direction` (`inbound`|`outbound`), `type`, `body`, `media_url`, `template_name`, `template_params`, `wa_message_id`, `status` (`sent`|`delivered`|`read`|`failed`|`received`)

### `templates`, `campaigns`, `campaign_recipients`, `imports`, `webhook_events`, `audit_logs`
Cache Meta templates, broadcast executions, CSV/XLSX imports, event deduplication, and audit trails.

## 3. High Performance Indexes
- `idx_contacts_org_wa` ON `contacts(organization_id, wa_number)`
- `idx_messages_wa_id` ON `messages(wa_message_id)`
- `idx_messages_contact` ON `messages(contact_id, created_at ASC)`
- `idx_webhook_events_processed` ON `webhook_events(processed, created_at)`
