const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRouter = require('./routes/auth');
const contactsRouter = require('./routes/contacts');
const tagsRouter = require('./routes/tags');
const messagesRouter = require('./routes/messages');
const conversationsRouter = require('./routes/conversations');
const templatesRouter = require('./routes/templates');
const campaignsRouter = require('./routes/campaigns');
const importsRouter = require('./routes/imports');
const dashboardRouter = require('./routes/dashboard');
const webhookRouter = require('./routes/webhook');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Route registration
app.use('/api/auth', authRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/imports', importsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/webhook', webhookRouter);

app.get('/health', (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred.',
    },
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`WhatsApp CRM Backend running on http://localhost:${PORT}`);
});

module.exports = app;