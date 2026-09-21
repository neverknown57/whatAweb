import React, { useEffect, useState } from 'react';
import { Search, Plus, Download, Trash2, Edit2, CheckCircle, XCircle, RefreshCw, X } from 'lucide-react';
import api from '../api';
import { Contact, Tag } from '../types';

export const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Filtering
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [optInFilter, setOptInFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Selection & Bulk
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkTagId, setBulkTagId] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<Contact> | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  // Inline Quick Tag Dropdown State (active contact ID)
  const [activeTagDropdownId, setActiveTagDropdownId] = useState<number | null>(null);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/contacts', {
        params: { page, limit: 15, search, tag: selectedTag, opt_in: optInFilter },
      });
      if (res.data.success) {
        setContacts(res.data.contacts);
        setTotalPages(res.data.pagination.pages);
      }
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const res = await api.get('/tags');
      if (res.data.success) setTags(res.data.tags);
    } catch (err) {
      console.error('Error fetching tags:', err);
    }
  };

  useEffect(() => {
    fetchContacts();
    fetchTags();
  }, [page, search, selectedTag, optInFilter]);

  const openModalForCreate = () => {
    setEditingContact({ opt_in_status: 'opted_in', custom_fields: {} });
    setSelectedTagIds([]);
    setIsModalOpen(true);
  };

  const openModalForEdit = (contact: Contact) => {
    setEditingContact(contact);
    setSelectedTagIds(contact.tags ? contact.tags.map((t) => t.id) : []);
    setIsModalOpen(true);
  };

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact?.wa_number) return alert('WhatsApp number is required');

    try {
      const payload = {
        ...editingContact,
        tag_ids: selectedTagIds,
      };
      const res = await api.post('/contacts', payload);
      if (res.data.success) {
        setIsModalOpen(false);
        setEditingContact(null);
        setSelectedTagIds([]);
        fetchContacts();
      }
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to save contact');
    }
  };

  const handleDeleteContact = async (id: number) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    try {
      await api.delete(`/contacts/${id}`);
      fetchContacts();
    } catch (err) {
      alert('Failed to delete contact');
    }
  };

  const handleQuickAddTag = async (contactId: number, tagId: number) => {
    try {
      await api.post(`/contacts/${contactId}/tags`, { tag_id: tagId });
      setActiveTagDropdownId(null);
      fetchContacts();
    } catch (err) {
      alert('Failed to assign tag');
    }
  };

  const handleQuickRemoveTag = async (contactId: number, tagId: number) => {
    try {
      await api.delete(`/contacts/${contactId}/tags/${tagId}`);
      fetchContacts();
    } catch (err) {
      alert('Failed to remove tag');
    }
  };

  const handleBulkTag = async () => {
    if (!selectedIds.length || !bulkTagId) return alert('Select contacts and a tag');
    try {
      await api.post('/contacts/bulk-tag', {
        contact_ids: selectedIds,
        tag_id: parseInt(bulkTagId),
        action: 'add',
      });
      setSelectedIds([]);
      setBulkTagId('');
      fetchContacts();
    } catch (err) {
      alert('Failed to apply bulk tag');
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await api.post('/contacts/export', { search, tag: selectedTag }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'contacts_export.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to export CSV');
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === contacts.length) setSelectedIds([]);
    else setSelectedIds(contacts.map((c) => c.id));
  };

  const toggleSelectOne = (id: number) => {
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter((i) => i !== id));
    else setSelectedIds([...selectedIds, id]);
  };

  const toggleModalTag = (tagId: number) => {
    if (selectedTagIds.includes(tagId)) {
      setSelectedTagIds(selectedTagIds.filter((id) => id !== tagId));
    } else {
      setSelectedTagIds([...selectedTagIds, tagId]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Contact CRM & Directory</h2>
          <p className="text-xs text-slate-400 mt-1">Manage audience profiles, tags, consent opt-in status & custom fields</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={openModalForCreate}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Contact
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-1 items-center gap-3 w-full">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, phone or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Tag Filter */}
          <select
            value={selectedTag}
            onChange={(e) => {
              setSelectedTag(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Opt In Filter */}
          <select
            value={optInFilter}
            onChange={(e) => {
              setOptInFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Opt-in Status</option>
            <option value="opted_in">Opted In</option>
            <option value="opted_out">Opted Out</option>
          </select>
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
            <span className="text-xs text-slate-400 font-semibold">{selectedIds.length} selected</span>
            <select
              value={bulkTagId}
              onChange={(e) => setBulkTagId(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200"
            >
              <option value="">Select Tag</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkTag}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white"
            >
              Apply Tag
            </button>
          </div>
        )}
      </div>

      {/* Contacts Data Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === contacts.length && contacts.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-700 bg-slate-900 text-blue-600"
                  />
                </th>
                <th className="px-4 py-3">Name / WhatsApp Number</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Tags (Manual Management)</th>
                <th className="px-4 py-3">Opt-in Status</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <RefreshCw className="w-5 h-5 text-blue-500 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : contacts.length > 0 ? (
                contacts.map((c) => {
                  const assignedTagIds = c.tags ? c.tags.map((t) => t.id) : [];
                  const unassignedTags = tags.filter((t) => !assignedTagIds.includes(t.id));

                  return (
                    <tr key={c.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(c.id)}
                          onChange={() => toggleSelectOne(c.id)}
                          className="rounded border-slate-700 bg-slate-900 text-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-100">{c.name || 'Unnamed Contact'}</p>
                        <p className="text-[11px] text-slate-400 font-mono">+{c.wa_number}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{c.email || '—'}</td>

                      {/* Interactive Tags Column */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5 relative">
                          {c.tags?.map((t) => (
                            <span
                              key={t.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white group/tag"
                              style={{ backgroundColor: t.color }}
                            >
                              {t.name}
                              <button
                                type="button"
                                title="Remove tag"
                                onClick={() => handleQuickRemoveTag(c.id, t.id)}
                                className="hover:text-rose-200 focus:outline-none"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}

                          {/* Quick Add Tag Dropdown Button */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setActiveTagDropdownId(activeTagDropdownId === c.id ? null : c.id)}
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-0.5 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              Tag
                            </button>

                            {/* Dropdown Menu */}
                            {activeTagDropdownId === c.id && (
                              <div className="absolute left-0 mt-1 z-30 w-44 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-1.5 space-y-1">
                                <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider border-b border-slate-800">
                                  Assign Tag
                                </div>
                                {unassignedTags.length > 0 ? (
                                  unassignedTags.map((t) => (
                                    <button
                                      key={t.id}
                                      type="button"
                                      onClick={() => handleQuickAddTag(c.id, t.id)}
                                      className="w-full text-left px-2 py-1.5 rounded text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition-colors"
                                    >
                                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                                      <span className="truncate">{t.name}</span>
                                    </button>
                                  ))
                                ) : (
                                  <p className="text-[10px] text-slate-500 px-2 py-1.5">All tags assigned</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                            c.opt_in_status === 'opted_in'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {c.opt_in_status === 'opted_in' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {c.opt_in_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 capitalize text-[11px]">{c.source}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openModalForEdit(c)}
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-900 rounded transition-colors"
                            title="Edit Contact Profile & Tags"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteContact(c.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded transition-colors"
                            title="Delete Contact"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No contacts found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Contact Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100">
                {editingContact?.id ? 'Edit Contact Profile' : 'Add New WhatsApp Contact'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">WhatsApp Phone Number *</label>
                <input
                  type="text"
                  placeholder="e.g. 14155552671 (with country code)"
                  value={editingContact?.wa_number || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, wa_number: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={editingContact?.name || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="john@example.com"
                  value={editingContact?.email || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100"
                />
              </div>

              {/* Tag Selector Component */}
              <div>
                <label className="block text-slate-400 font-semibold mb-1.5 flex items-center justify-between">
                  <span>Assign Tags</span>
                  <span className="text-[10px] font-normal text-slate-500">Click chips to select/deselect</span>
                </label>
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900 border border-slate-800 rounded-lg max-h-28 overflow-y-auto">
                    {tags.map((t) => {
                      const isSelected = selectedTagIds.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => toggleModalTag(t.id)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-all ${
                            isSelected
                              ? 'text-white shadow-md ring-2 ring-white/30 scale-105'
                              : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700 opacity-60'
                          }`}
                          style={isSelected ? { backgroundColor: t.color } : {}}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: isSelected ? '#ffffff' : t.color }}
                          />
                          {t.name}
                          {isSelected && <X className="w-3 h-3 ml-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">No tags created yet. Create tags in the Tag Management tab.</p>
                )}
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Opt-in Consent Status</label>
                <select
                  value={editingContact?.opt_in_status || 'opted_in'}
                  onChange={(e) => setEditingContact({ ...editingContact, opt_in_status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100"
                >
                  <option value="opted_in">Opted In (Can receive broadcasts)</option>
                  <option value="opted_out">Opted Out (Block broadcasts)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Agent Notes</label>
                <textarea
                  placeholder="Internal notes..."
                  value={editingContact?.notes || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100 h-16 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/20"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
