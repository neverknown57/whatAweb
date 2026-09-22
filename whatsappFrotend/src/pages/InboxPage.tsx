import React, { useEffect, useState, useRef } from 'react';
import {
  Send,
  Clock,
  Check,
  CheckCheck,
  RefreshCw,
  ArrowLeft,
  MessageSquare,
} from 'lucide-react';
import api from '../api';
import { Conversation, Message, Template } from '../types';
import { useToast } from '../context/ToastContext';
import { EmptyState } from '../components/ui/EmptyState';

export const InboxPage: React.FC = () => {
  const { showToast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  // Mobile View Toggle State: 'list' or 'chat'
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');

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
      showToast('Failed to load conversations', 'error');
    }
  };

  const fetchMessages = async (contactId: number) => {
    try {
      const res = await api.get(`/conversations/${contactId}/messages`);
      if (res.data.success) {
        setMessages(res.data.messages);
      }
    } catch (err) {
      showToast('Failed to load chat thread', 'error');
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

  const selectThread = (c: Conversation) => {
    setSelectedConv(c);
    setMobileView('chat');
  };

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
          showToast('Message sent', 'success');
          fetchMessages(selectedConv.contact_id);
          fetchConversations();
        }
      } else if (activeTab === 'template') {
        if (!selectedTemplateName) return showToast('Select a template first', 'error');
        const res = await api.post('/messages/send-template', {
          contact_id: selectedConv.contact_id,
          template_name: selectedTemplateName,
        });
        if (res.data.success) {
          setSelectedTemplateName('');
          showToast('Template message sent', 'success');
          fetchMessages(selectedConv.contact_id);
          fetchConversations();
        }
      } else if (activeTab === 'media') {
        if (!mediaUrl.trim()) return showToast('Media URL required', 'error');
        const res = await api.post('/messages/send-media', {
          contact_id: selectedConv.contact_id,
          type: 'image',
          media_url: mediaUrl,
        });
        if (res.data.success) {
          setMediaUrl('');
          showToast('Media sent', 'success');
          fetchMessages(selectedConv.contact_id);
          fetchConversations();
        }
      }
    } catch (err: any) {
      showToast(err.response?.data?.error?.message || 'Failed to send message', 'error');
    }
  };

  return (
    <div className="h-[calc(100vh-8.5rem)] md:h-[calc(100vh-6.5rem)] flex rounded-xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl relative">
      {/* Conversation Thread List (Desktop: Left panel | Mobile: Full screen when mobileView === 'list') */}
      <div
        className={`${
          mobileView === 'chat' ? 'hidden md:flex' : 'flex'
        } w-full md:w-80 border-r border-slate-800 flex-col bg-slate-900/60 shrink-0`}
      >
        <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-xs text-slate-200">Active Conversations</h3>
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
                  onClick={() => selectThread(c)}
                  className={`w-full p-3.5 text-left flex items-start justify-between gap-2 transition-colors ${
                    isSelected ? 'bg-blue-600/10 border-l-4 border-blue-500' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-slate-100 truncate">{c.contact_name || `+${c.wa_number}`}</span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
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
            <div className="p-6 text-center text-xs text-slate-500">No active conversations.</div>
          )}
        </div>
      </div>

      {/* Chat Thread Area (Desktop: Right panel | Mobile: Full screen when mobileView === 'chat') */}
      {selectedConv ? (
        <div
          className={`${
            mobileView === 'list' ? 'hidden md:flex' : 'flex'
          } flex-1 flex-col min-w-0 bg-slate-950 w-full h-full`}
        >
          {/* Chat Header with Mobile Back Button */}
          <div className="h-14 px-4 sm:px-5 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              {/* Back to thread list button for mobile */}
              <button
                onClick={() => setMobileView('list')}
                className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                aria-label="Back to conversations"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-100">{selectedConv.contact_name || 'Customer'}</h3>
                <p className="text-[10px] sm:text-[11px] font-mono text-slate-400">+{selectedConv.wa_number}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold flex items-center gap-1 ${
                  isWithin24hWindow(selectedConv.customer_last_message_at)
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>{isWithin24hWindow(selectedConv.customer_last_message_at) ? '24h Open' : 'Template Required'}</span>
              </span>
            </div>
          </div>

          {/* Messages Thread Window */}
          <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3.5 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
            {messages.map((m) => {
              const isInbound = m.direction === 'inbound';
              return (
                <div key={m.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                  <div
                    className={`max-w-[85%] sm:max-w-md p-3 rounded-xl text-xs space-y-1 shadow-md ${
                      isInbound ? 'bg-slate-800 text-slate-100 border border-slate-700' : 'bg-emerald-950 text-emerald-100 border border-emerald-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    {m.media_url && (
                      <div className="pt-1">
                        <img src={m.media_url} alt="Media Attachment" className="max-w-full rounded-lg border border-slate-700" />
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-1.5 pt-1 text-[9px] text-slate-400">
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
          <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/90 space-y-2.5">
            {/* Tabs */}
            <div className="flex gap-1.5 text-xs">
              <button
                onClick={() => setActiveTab('text')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                  activeTab === 'text' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Free Text
              </button>
              <button
                onClick={() => setActiveTab('template')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                  activeTab === 'template' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                Send Template
              </button>
              <button
                onClick={() => setActiveTab('media')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
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
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 disabled:opacity-50"
                />
              )}

              {activeTab === 'template' && (
                <select
                  value={selectedTemplateName}
                  onChange={(e) => setSelectedTemplateName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
                >
                  <option value="">Select an approved Meta template...</option>
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
                  placeholder="Paste image / media URL..."
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-100"
                />
              )}

              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center">
          <EmptyState
            icon={MessageSquare}
            title="No conversation selected"
            description="Select a chat thread from the left menu to view messages."
          />
        </div>
      )}
    </div>
  );
};
