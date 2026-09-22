# Frontend Architecture & UI/UX Audit Report

## 1. Current Frontend Architecture

The frontend is a single-page application built using:
- **Framework**: React 18 + TypeScript + Vite
- **Routing**: `react-router-dom` (v6)
- **Styling**: Tailwind CSS (`@tailwindcss/vite`), custom CSS variables in `index.css`
- **Icons**: `lucide-react`
- **HTTP Client**: Axios instance in `src/api.ts` with JWT `Authorization` header injection

---

## 2. Page & Component Structure Audit

| Page Component | Path | Functionality | Current Deficiencies & Mobile Bottlenecks |
| :--- | :--- | :--- | :--- |
| `DashboardPage.tsx` | `/` | KPI Cards, Message Volume Breakdown, Tag Distribution, Recent Campaigns | Hardcoded dark styles, fixed grid column math causing card squishing on small mobile viewports (`320px-375px`), no loading skeleton. |
| `InboxPage.tsx` | `/inbox` | Live WhatsApp Chat thread, 24h window indicator, text/media composer, template quick send | Fixed split-view desktop layout (`w-80` sidebar + flex-1 chat) forces horizontal scroll on mobile devices instead of a full-screen thread view with a back button. |
| `ContactsPage.tsx` | `/contacts` | Contact directory table, search, filters, opt-in toggle, tag chips, add/edit modal, CSV export | HTML `<table>` overflows horizontally on mobile devices (`< 768px`), modal dialogs remain desktop-centered popups without mobile bottom-sheet styling. |
| `ImportPage.tsx` | `/import` | CSV/XLSX file upload dropzone, column header mapping, duplicate strategy selector, result error report | Upload dropzone lacks touch-friendly mobile target sizing, column mapping dropdowns overflow on narrow screens. |
| `TagsPage.tsx` | `/tags` | Color-coded tag creator, contact usage count, edit/delete modal | Grid cards lack responsive gap optimization, tag color pickers are small touch targets. |
| `TemplatesPage.tsx` | `/templates` | Meta template catalog, sync button, dynamic variable field generator, live WhatsApp phone preview | Split layout places mobile phone mockup off-screen on mobile devices without an interactive preview toggle button. |
| `CampaignsPage.tsx` | `/campaigns` | Broadcast campaign wizard, rate-limited queue controls (start, pause, resume, cancel) | Data table overflows on mobile viewports; campaign wizard lacks step indicator. |
| `SettingsPage.tsx` | `/settings` | WhatsApp Cloud API credentials configuration (WABA ID, Phone Number ID, Access Token) | Input forms lack input field masking toggle and clear validation states. |
| `LoginPage.tsx` | `/login` | User authentication form | Missing system theme toggle and responsive branding container. |

---

## 3. UI/UX Deficiencies & UX Gaps

1. **Hardcoded Color & Theme Architecture**:
   - `index.css` and components use hardcoded dark classes (`bg-slate-900`, `text-slate-100`, `border-slate-800`), making true Light mode and automatic System theme switching impossible.
   - Lacks design tokens for background, card background, borders, input controls, text primary, and text muted.

2. **Mobile Layout & Navigation Deficiencies**:
   - `AppLayout.tsx` renders a fixed desktop sidebar (`w-64`) without a mobile drawer, hamburger menu, or bottom navigation bar.
   - On screens smaller than `768px`, the sidebar pushes page content off-screen.

3. **Data Table Responsiveness**:
   - Tables on `/contacts` and `/campaigns` rely on desktop tabular columns (`<th>`/`<td>`). On mobile screens, columns get severely clipped or force horizontal scroll.

4. **Chat Inbox Mobile Flow**:
   - `/inbox` displays conversation list and message thread side-by-side on mobile, leaving both columns uncomfortably cramped. Needs full-screen mobile thread toggle with back navigation.

5. **Missing Polish & Feedback Systems**:
   - Lacks unified Skeleton loading states, Toast notifications, empty state illustrations, and accessible keyboard focus states.
   - Lacks centralized Telegram support link integration (`https://t.me/neverknown`).

---

## 4. Proposed Target Frontend Architecture

- **Theme Engine**: Centralized Design Token system powered by CSS variables (`[data-theme='light']`, `[data-theme='dark']`) + automatic `prefers-color-scheme` listener with System / Light / Dark persistence.
- **Mobile Navigation System**: Responsive Desktop Sidebar + Mobile Bottom Navigation Bar & Slide-out Drawer.
- **Responsive Card View**: Automatic switching between tabular `DataTable` view on desktop (`>= md`) and mobile-friendly `ContactCard` cards on small viewports (`< md`).
- **Responsive Mobile Inbox**: Single-pane mobile view toggling between conversation list and active chat view with header back button.
- **Reusable Component System**: `Button`, `Input`, `Select`, `Modal`, `Drawer`, `Toast`, `Skeleton`, `EmptyState`, `ThemeSwitcher`, `Badge`, `Avatar`.
- **Telegram Support Button**: Integrated support button pointing to `https://t.me/neverknown`.
