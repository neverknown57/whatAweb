# Frontend Design System & Mobile UX Architecture

## 1. Overview
The frontend of the WhatsApp CRM Platform is designed as an enterprise SaaS application focused on accessibility, dark & light theme compliance, and full mobile responsiveness.

---

## 2. Design Tokens & Theme Engine

Theme mode choices:
1. **System Mode (Default)**: Automatically tracks OS theme preferences via `window.matchMedia('(prefers-color-scheme: dark)')`. Updates dynamically if the OS theme switches.
2. **Light Mode**: Forces clean slate-light palette (`--bg-body: #f8fafc`, `--bg-card: #ffffff`, `--text-primary: #0f172a`).
3. **Dark Mode**: Forces dark glassmorphism palette (`--bg-body: #090d16`, `--bg-card: #111827`, `--text-primary: #f9fafb`).

User preference is stored in `localStorage` under `app-theme`.

---

## 3. Responsive Layout Strategy & Breakpoints

| Breakpoint | Target Devices | Navigation Pattern | Layout Strategy |
| :--- | :--- | :--- | :--- |
| `< 768px` | Mobile (320px–767px) | Header Bar + Bottom Tab Navigation + Slide-out Drawer | Compact Cards, single-pane Chat Inbox view, Bottom-sheet Modals |
| `>= 768px` | Tablets & Laptops (768px–1023px) | Sidebar Navigation | Tabular Data Tables, Split-view Inbox |
| `>= 1024px` | Desktop (1024px+) | Full Sidebar Navigation | Multi-column KPI dashboards, Split-view Live WhatsApp device previews |

---

## 4. Mobile UX Transformations

- **Contact CRM**: Desktop tabular rows (`<table>`) automatically transform into touch-friendly `ContactCard` components on mobile screens (`< 768px`), featuring inline tag management, search, and action buttons.
- **Messaging Inbox**: On mobile, selecting a chat thread transitions to a full-screen mobile chat view with a top `< Back to Conversations` header button. The message composer remains sticky at the bottom of the viewport.
- **Templates Builder**: On small screens, a **"Preview Message"** button triggers a responsive WhatsApp device mockup modal.
- **Modals**: Forms transition to bottom-sheet drawers on mobile with generous touch targets (minimum 44x44px).

---

## 5. Centralized Support Integration

- **Telegram Support**: Integrated with centralized constant `TELEGRAM_SUPPORT_URL = 'https://t.me/neverknown'` (Username `@neverknown`).
- Accessible from Desktop Sidebar footer, Mobile Drawer, and Settings page.
