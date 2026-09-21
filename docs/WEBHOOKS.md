# WhatsApp Webhook Integration Guide

## 1. Webhook Verification Handshake (`GET /webhook`)
Meta sends a GET verification request when registering your webhook endpoint in Meta App Settings:
```
GET /webhook?hub.mode=subscribe&hub.verify_token=whatsapp_verify_token_secret&hub.challenge=115820120
```
The server checks `hub.verify_token` against your configuration and responds with `hub.challenge` as plain text (`HTTP 200`).

## 2. Event Handler (`POST /webhook`)
When a customer sends a message or Meta emits a status update, Meta issues a `POST /webhook` callback.

### Fast ACK Architecture
The webhook controller returns `HTTP 200 OK` immediately without awaiting long-running database transactions. Event processing executes asynchronously to prevent Meta HTTP timeout retries.

### Idempotency & Deduplication
Every incoming event payload is checked against the `webhook_events` table using Meta's `event_id` or `wamid`. Duplicate events are dropped automatically.

### Event Processing Lifecycle
1. **Inbound Messages**:
   - Upserts `contacts` table (updates `last_message_at`, extending the 24h customer window).
   - Upserts `conversations` table (increments `unread_count`, updates `last_message_preview`).
   - Inserts `messages` record (`direction = 'inbound'`).
2. **Outbound Status Callbacks**:
   - Updates `messages.status` (`sent` -> `delivered` -> `read` -> `failed`).
   - Increments `campaigns` metrics (`delivered_count`, `read_count`).
