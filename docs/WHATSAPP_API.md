# Meta WhatsApp Cloud API Integration Guide

## 1. Overview
The platform integrates directly with the Meta WhatsApp Cloud API (`https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages`).

## 2. Customer Service Window (24h Rule)
- Meta enforces a strict 24-hour Customer Service Window starting from the timestamp of the last message sent by the customer.
- Within this 24-hour window, businesses can send free-form text messages and media attachments.
- Outside the 24-hour window, free-text messaging is blocked by Meta. Businesses must send Meta-approved Template Messages.

## 3. Template Component Architecture
Templates registered in the Meta WhatsApp Business Account (WABA) consist of components:
- `HEADER`: Text, Image, Video, or Document.
- `BODY`: Contains text with `{{1}}`, `{{2}}`, ..., `{{n}}` placeholders.
- `FOOTER`: Plain text.
- `BUTTONS`: Quick Replies, Phone Numbers, or Dynamic URLs (`https://example.com/track/{{1}}`).

The system inspects template definitions and maps placeholders to contact fields (`{{contact.name}}`, `{{contact.email}}`, `{{contact.phone}}`) or custom attributes.
