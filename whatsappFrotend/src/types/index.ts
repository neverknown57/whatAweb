export interface Tag {
  id: number;
  name: string;
  color: string;
  contact_count?: number;
}

export interface Contact {
  id: number;
  wa_number: string;
  name: string | null;
  email: string | null;
  country_code: string | null;
  source: string;
  notes: string | null;
  custom_fields: Record<string, any>;
  opt_in_status: 'opted_in' | 'opted_out';
  last_message_at: string | null;
  conversation_status: 'open' | 'pending' | 'closed';
  created_at: string;
  updated_at: string;
  tags?: Tag[];
}

export interface Message {
  id: number;
  contact_id: number;
  conversation_id: number;
  campaign_id?: number | null;
  direction: 'inbound' | 'outbound';
  type: 'text' | 'template' | 'image' | 'video' | 'audio' | 'document' | 'location';
  body: string | null;
  media_url: string | null;
  template_name: string | null;
  template_params: any;
  wa_message_id: string | null;
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'received';
  error_message: string | null;
  created_at: string;
}

export interface Conversation {
  id: number;
  contact_id: number;
  contact_name: string | null;
  wa_number: string;
  contact_email: string | null;
  customer_last_message_at: string | null;
  status: 'open' | 'pending' | 'closed';
  unread_count: number;
  last_message_preview: string | null;
  last_message_at: string;
  tags?: Tag[];
}

export interface Template {
  id: number;
  name: string;
  language: string;
  status: string;
  category: string;
  components: any[];
  default_parameter_mapping?: Record<string, any>;
  synced_at: string;
}

export interface Campaign {
  id: number;
  name: string;
  template_name: string;
  language_code: string;
  parameter_mapping: Record<string, any>;
  audience_type: 'all' | 'tags' | '24h_window';
  audience_filter: Record<string, any>;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
  creator_name?: string;
  created_at: string;
}

export interface ImportLog {
  id: number;
  file_name: string;
  total_rows: number;
  successful_rows: number;
  failed_rows: number;
  skipped_rows: number;
  updated_rows: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error_summary: string | null;
  uploaded_by_name?: string;
  created_at: string;
}

export interface DashboardStats {
  contacts: {
    total: number;
    recent7Days: number;
  };
  messages: {
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    inbound: number;
  };
  activeConversations24h: number;
  tagsDistribution: { name: string; color: string; count: number }[];
  recentCampaigns: Campaign[];
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'agent';
  organizationId: number;
  organizationName?: string;
}
