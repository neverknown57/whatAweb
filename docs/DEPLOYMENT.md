# Production Deployment & Environment Guide

## 1. Environment Configuration

### Backend (`/backend/.env`)
```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/whatsapp_db
JWT_SECRET=your_super_secret_jwt_key
WHATSAPP_WABA_ID=your_waba_id
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_permanent_access_token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=whatsapp_verify_token_secret
WHATSAPP_API_VERSION=v21.0
```

## 2. Database Setup
Run the database schema migration script:
```bash
cd backend
npm run db:init
```

## 3. Running Services

### Start Backend Server
```bash
cd backend
npm start
```

### Build & Run React Frontend
```bash
cd whatsappFrotend
npm run build
npm run preview
```

## 4. Webhook Tunnel / SSL Setup
For Meta Cloud API to deliver webhooks locally during development, use `ngrok`:
```bash
ngrok http 3000
```
Then set Webhook URL in Meta App Dashboard to: `https://<ngrok-subdomain>.ngrok-free.app/webhook`.
