import React, { useEffect, useState, useRef } from 'react';
import {
  Send,
  Clock,
  Check,
  CheckCheck,
  RefreshCw,
} from 'lucide-react';
import api from '../api';
import { Conversation, Message, Template } from '../types';

export const InboxPage: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  // Message inputs
  const [textBody, setTextBody] = useState('');
  const [selectedTemplateName, setSelectedTemplateName] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'text' | 'template' | 'media'>('text');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = async () => {
    try {
      const res = await api.get('/conversations');
      if (res.data.success) {
        setConversations(res.data.conversations);
        if (!selectedConv && res.data.conversations.length > 0) {
          setSelectedConv(res.data.conversations[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
    }
  };

  const fetchMessages = async (contactId: number) => {
    try {
      const res = await api.get(`/conversations/${contactId}/messages`);
      if (res.data.success) {
        setMessages(res.data.messages);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/templates');
      if (res.data.success) setTemplates(res.data.templates);
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (selectedConv) {
      fetchMessages(selectedConv.contact_id);
    }
  }, [selectedConv]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Calculate 24h Customer Service Window state
  const isWithin24hWindow = (lastMessageAt: string | null) => {
    if (!lastMessageAt) return false;
    const hours = (Date.now() - new Date(lastMessageAt).getTime()) / 36e5;
    return hours < 24;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConv) return;

    try {
      if (activeTab === 'text') {
        if (!textBody.trim()) return;
        const res = await api.post('/messages/send', {
          contact_id: selectedConv.contact_id,
          body: textBody,
        });
        if (res.data.success) {
          setTextBody('');
          fetchMessages(selectedConv.contact_id);
          fetchConversations();
        }
      } else if (activeTab === 'template') {
        if (!selectedTemplateName) return alert('Select a template');
        const res = await api.post('/messages/send-template', {
          contact_id: selectedConv.contact_id,
          template_name: selectedTemplateName,
        });
        if (res.data.success) {
          setSelectedTemplateName('');
          fetchMessages(selectedConv.contact_id);
          fetchConversations();
        }
      } else if (activeTab === 'media') {
        if (!mediaUrl.trim()) return alert('Media URL required');
        const res = await api.post('/messages/send-media', {
          contact_id: selectedConv.contact_id,
          type: 'image',
          media_url: mediaUrl,
        });
        if (res.data.success) {
          setMediaUrl('');
          fetchMessages(selectedConv.contact_id);
          fetchConversations();
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to send message');
    }
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
      {/* Left Conversations Sidebar */}
      <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-950/60 shrink-0">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-xs text-slate-200">Conversations</h3>
          <button onClick={fetchConversations} className="p-1 text-slate-400 hover:text-slate-200">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {conversations.length > 0 ? (
            conversations.map((c) => {
              const active24h = isWithin24hWindow(c.customer_last_message_at);
              const isSelected = selectedConv?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedConv(c)}
                  className={`w-full p-3.5 text-left flex items-start justify-between gap-2 transition-colors ${
                    isSelected ? 'bg-blue-600/10 border-l-4 border-blue-500' : 'hover:bg-slate-900/40'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-100 truncate">{c.contact_name || `+${c.wa_number}`}</span>
                      <span className="text-[10px] text-slate-500">{new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{c.last_message_preview || 'No messages yet'}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                          active24h ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {active24h ? '24h Active' : 'Session Expired'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-6 text-center text-xs text-slate-500">No active conversations found.</div>
          )}
        </div>
      </div>

      {/* Right Chat Thread Area */}
      {selectedConv ? (
        <div className="flex-1 flex flex-col min-w-0 bg-slate-900">
          {/* Chat Header */}
          <div className="h-14 px-5 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-bold text-sm text-slate-100">{selectedConv.contact_name || 'Customer'}</h3>
              <p className="text-[11px] font-mono text-slate-400">+{selectedConv.wa_number}</p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                  isWithin24hWindow(selectedConv.customer_last_message_at)
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                {isWithin24hWindow(selectedConv.customer_last_message_at) ? '24h Window Open' : 'Use Template (24h Expired)'}
              </span>
            </div>
          </div>

          {/* Messages Thread */}
          <div className="flex-1 p-5 overflow-y-auto space-y-3.5 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
            {messages.map((m) => {
              const isInbound = m.direction === 'inbound';
              return (
                <div key={m.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-md p-3 rounded-xl text-xs space-y-1 shadow-md ${
                      isInbound ? 'bg-slate-800 text-slate-100 border border-slate-700' : 'bg-emerald-950 text-emerald-100 border border-emerald-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    {m.media_url && (
                      <div className="pt-1">
                        <img src={m.media_url} alt="Media Attachment" className="max-w-xs rounded-lg border border-slate-700" />
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-1.5 pt-1 text-[10px] text-slate-400">
                      <span>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {!isInbound && (
                        <span>
                          {m.status === 'read' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-blue-400 inline" />
                          ) : m.status === 'delivered' ? (
                            <CheckCheck className="w-3.5 h-3.5 text-slate-400 inline" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-slate-400 inline" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Composer Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/80 space-y-3">
            {/* Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('text')}
                className={`px-3 py-1 rounded text-xs font-semibold ${
                  activeTab === 'text' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Free Text
              </button>
              <button
                onClick={() => setActiveTab('template')}
                className={`px-3 py-1 rounded text-xs font-semibold ${
                  activeTab === 'template' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Send Template
              </button>
              <button
                onClick={() => setActiveTab('media')}
                className={`px-3 py-1 rounded text-xs font-semibold ${
                  activeTab === 'media' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Send Media
              </button>
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              {activeTab === 'text' && (
                <input
                  type="text"
                  placeholder={
                    isWithin24hWindow(selectedConv.customer_last_message_at)
                      ? 'Type a message...'
                      : '24h Window closed. Switch to "Send Template"'
                  }
                  value={textBody}
                  onChange={(e) => setTextBody(e.target.value)}
                  disabled={!isWithin24hWindow(selectedConv.customer_last_message_at)}
                  className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 disabled:opacity-50"
                />
              )}

              {activeTab === 'template' && (
                <select
                  value={selectedTemplateName}
                  onChange={(e) => setSelectedTemplateName(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100"
                >
                  <option value="">Select an approved WhatsApp template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name} ({t.language})
                    </option>
                  ))}
                </select>
              )}

              {activeTab === 'media' && (
                <input
                  type="text"
                  placeholder="Paste image / media URL (e.g. https://example.com/image.png)..."
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100"
                />
              )}

              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
          Select a conversation thread to start chatting.
        </div>
      )}
    </div>
  );
};
