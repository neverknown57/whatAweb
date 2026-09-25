# Broadcast Campaigns & Queue Processing

## 1. Campaign Types & Cost-Effective Session Messaging

### A. Meta Approved Template Broadcasts
- **Use Case**: Out-of-session broadcasts (to contacts who haven't messaged in >24 hours or new contacts).
- **Meta Fee**: Standard Meta conversation category charge (Marketing / Utility / Authentication).
- **Dynamic Parameter Binding**: Map template placeholders (`{{1}}`, `{{2}}`) to contact attributes (`{{contact.name}}`, `{{contact.phone}}`) or system variables (`{{current_date}}`).

### B. 100% Free Session Broadcasts ($0 Meta Fee)
- **Use Case**: Broadcasts to active customers who replied/messaged within the last 24 hours.
- **Meta Fee**: **$0 (100% FREE)** inside Meta's 24-hour Customer Service Window.
- **Message Format**: Free-form text (`FREE_TEXT`) or direct Media attachments (`FREE_MEDIA` with `image`, `video`, `document`, `audio` + HTTPS URL and captions). Custom template approval from Meta is **NOT required**.
- **Dynamic Tagging**: Automatically targets the `"24h Active"` system tag or active 24h window contacts with dynamic placeholder substitution (`{{contact.name}}`, `{{current_date}}`).

---

## 2. 24-Hour Active Window Tagging & Tag Refresh Engine

1. **Auto-Assignment on Inbound Reply**: When a customer sends an incoming WhatsApp message, the webhook automatically updates `last_message_at = NOW()` and assigns the `"24h Active"` tag to that contact profile.
2. **Opt-Out Safety**: If a contact sends `STOP` or `UNSUBSCRIBE`, they are automatically opted out and the `"24h Active"` tag is immediately removed.
3. **1-Click 24h Tag Refresh & Cleanup**:
   - UI Button: Click **Refresh 24h Tags** in the Contacts or Broadcast Manager headers.
   - API Endpoint: `POST /api/contacts/refresh-24h`.
   - Action: Scans contact timestamps and automatically deletes `"24h Active"` tags from all contacts whose `last_message_at` is older than 24 hours (>24h).

---

## 3. Campaign Pipeline & Controls

1. **Define Campaign**: Set Campaign Name & choose **Meta Template** OR **Free Text Broadcast (24h Window)**.
2. **Audience Filter**: Target All Opted-In Contacts, filter by Tag (e.g. `"24h Active"`), or target active 24h window contacts. Opted-out contacts are automatically suppressed.
3. **Execution Worker**: Asynchronous background worker processes recipients with rate limiting (50ms delay per send = ~20 msgs/sec) to respect Meta Cloud API thresholds.
4. **Real-time Lifecycle Controls**:
   - **Launch**: Start background queue worker.
   - **Pause / Resume**: Pause or resume running worker.
   - **Relaunch / Edit & Relaunch**: Instantly clone and relaunch prior campaigns.
   - **Cancel**: Abort campaign execution.
