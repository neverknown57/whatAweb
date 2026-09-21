# WhatsApp CRM REST API Reference

All requests must supply `Authorization: Bearer <token>` (except public auth and webhook routes).

## 1. Authentication
- `POST /api/auth/login`: `{ email, password }` -> Returns `{ success, token, user }`
- `POST /api/auth/register`: `{ name, email, password, organization_name }`
- `GET /api/auth/me`: Get profile of authenticated user

## 2. Dashboard & Analytics
- `GET /api/dashboard/stats`: Returns KPI metrics, message counters, active 24h chats, tag distribution
- `GET /api/dashboard/config`: Returns WhatsApp account configuration (token masked)
- `POST /api/dashboard/config`: Updates WABA ID, Phone Number ID, Access Token, Verify Token

## 3. Contacts CRM
- `GET /api/contacts?page=1&limit=25&search=john&tag=VIP&opt_in=opted_in`: List paginated contacts
- `POST /api/contacts`: Create or update contact (`{ wa_number, name, email, notes, custom_fields, opt_in_status }`)
- `GET /api/contacts/:id`: Single contact details and tags
- `DELETE /api/contacts/:id`: Delete contact
- `POST /api/contacts/bulk-tag`: `{ contact_ids: [], tag_id, action: 'add'|'remove' }`
- `POST /api/contacts/export`: Download CSV export of filtered contacts

## 4. Contact Imports
- `POST /api/contacts/import/upload`: Multipart upload file (`.csv`, `.xlsx`). Returns header analysis
- `POST /api/contacts/import/process`: Confirm column mapping & duplicate strategy (`SKIP` / `UPDATE`)
- `GET /api/imports`: Import history list
- `GET /api/imports/:id/errors`: Download CSV error report of failed rows

## 5. Conversations & Messaging
- `GET /api/conversations`: List active chat threads with last preview & 24h window status
- `GET /api/conversations/:contactId/messages`: Fetch chat thread messages for contact
- `POST /api/messages/send`: Send free-text message (verifies 24h window)
- `POST /api/messages/send-template`: Send approved Meta template message
- `POST /api/messages/send-media`: Send image, video, audio, or document link

## 6. Templates
- `GET /api/templates`: List cached templates
- `POST /api/templates/sync`: Sync templates from Meta Cloud API
- `GET /api/templates/:name/analyze`: Extract template variables (`{{1}}`) and component parameters

## 7. Broadcast Campaigns
- `GET /api/campaigns`: List campaign history and metrics
- `POST /api/campaigns`: Create campaign draft (`{ name, template_name, audience_type, audience_filter, parameter_mapping }`)
- `POST /api/campaigns/:id/start`: Trigger background execution worker
- `POST /api/campaigns/:id/pause`: Pause running campaign
- `POST /api/campaigns/:id/resume`: Resume paused campaign
- `POST /api/campaigns/:id/cancel`: Cancel campaign
