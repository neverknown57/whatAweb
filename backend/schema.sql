-- Database Schema for WhatsApp CRM & Messaging Platform

-- 1. Organizations (Multi-tenant foundation)
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL DEFAULT 'Default Organization',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure a default organization exists
INSERT INTO organizations (id, name) VALUES (1, 'Default Organization') ON CONFLICT (id) DO NOTHING;

-- 2. Users (Authentication & Authorization)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE DEFAULT 1,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('admin', 'manager', 'agent')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. WhatsApp Account Configurations
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE DEFAULT 1,
    waba_id VARCHAR(100),
    phone_number_id VARCHAR(100),
    display_phone_number VARCHAR(50),
    access_token TEXT,
    verify_token VARCHAR(255) DEFAULT 'whatsapp_verify_token_secret',
    api_version VARCHAR(20) DEFAULT 'v21.0',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Contacts (Enhanced CRM fields)
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE DEFAULT 1,
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
    CONSTRAINT contacts_org_wa_unique UNIQUE (organization_id, wa_number)
);

-- 5. Tags
CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE DEFAULT 1,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#3b82f6',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT tags_org_name_unique UNIQUE (organization_id, name)
);

-- 6. Contact Tags Mapping
CREATE TABLE IF NOT EXISTS contact_tags (
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, tag_id)
);

-- 7. Conversations
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE DEFAULT 1,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE UNIQUE,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed')),
    unread_count INTEGER DEFAULT 0,
    last_message_preview TEXT,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Messages
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE DEFAULT 1,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
    direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    type VARCHAR(30) DEFAULT 'text',
    body TEXT,
    media_url TEXT,
    template_name VARCHAR(255),
    template_params JSONB,
    wa_message_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'sent',
    error_code VARCHAR(50),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Cached Templates
CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    language VARCHAR(20) NOT NULL DEFAULT 'en_US',
    status VARCHAR(50) DEFAULT 'APPROVED',
    category VARCHAR(50) DEFAULT 'UTILITY',
    components JSONB NOT NULL DEFAULT '[]'::jsonb,
    default_parameter_mapping JSONB DEFAULT '{}'::jsonb,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT templates_org_name_lang_unique UNIQUE (organization_id, name, language)
);

-- 10. Broadcast Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE DEFAULT 1,
    name VARCHAR(255) NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    language_code VARCHAR(20) DEFAULT 'en_US',
    parameter_mapping JSONB DEFAULT '{}'::jsonb,
    audience_type VARCHAR(50) DEFAULT 'all',
    audience_filter JSONB DEFAULT '{}'::jsonb,
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled')),
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Campaign Recipients
CREATE TABLE IF NOT EXISTS campaign_recipients (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
    message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMPTZ
);

-- 12. Imports Log
CREATE TABLE IF NOT EXISTS imports (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE DEFAULT 1,
    file_name VARCHAR(255) NOT NULL,
    total_rows INTEGER DEFAULT 0,
    successful_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    skipped_rows INTEGER DEFAULT 0,
    updated_rows INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_summary TEXT,
    error_details JSONB DEFAULT '[]'::jsonb,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Webhook Events Log
CREATE TABLE IF NOT EXISTS webhook_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE DEFAULT 1,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_org_wa_unique ON contacts(organization_id, wa_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_org_name_unique ON tags(organization_id, name);
CREATE INDEX IF NOT EXISTS idx_contacts_created ON contacts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_wa_id ON messages(wa_message_id);
CREATE INDEX IF NOT EXISTS idx_messages_contact ON messages(contact_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag ON contact_tags(tag_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_org_name_lang ON templates(organization_id, name, language);
