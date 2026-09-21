const API_BASE = 'http://localhost:3000/api';

let allTags = [];
let currentFilter = '';

async function fetchJSON(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// ---------- Tags ----------

async function loadTags() {
  allTags = await fetchJSON(`${API_BASE}/tags`);
  renderTagList();
  renderTagFilter();
  renderBroadcastTagSelect();
}

function renderTagList() {
  const el = document.getElementById('tag-list');
  el.innerHTML = '';
  allTags.forEach((tag) => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.style.background = tag.color;
    chip.innerHTML = `${tag.name} <button data-id="${tag.id}" title="Delete tag">×</button>`;
    chip.querySelector('button').addEventListener('click', async (e) => {
      e.stopPropagation();
      await fetchJSON(`${API_BASE}/tags/${tag.id}`, { method: 'DELETE' });
      await loadTags();
      await loadContacts();
    });
    el.appendChild(chip);
  });
}

function renderTagFilter() {
  const el = document.getElementById('tag-filter');
  el.innerHTML = '<option value="">All contacts</option>';
  allTags.forEach((tag) => {
    const opt = document.createElement('option');
    opt.value = tag.name;
    opt.textContent = tag.name;
    el.appendChild(opt);
  });
}

function renderBroadcastTagSelect() {
  const el = document.getElementById('broadcast-tag');
  el.innerHTML = '';
  allTags.forEach((tag) => {
    const opt = document.createElement('option');
    opt.value = tag.id;
    opt.textContent = tag.name;
    el.appendChild(opt);
  });
}

document.getElementById('tag-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nameInput = document.getElementById('new-tag-name');
  const name = nameInput.value.trim();
  if (!name) return;
  const color = `hsl(${Math.floor(Math.random() * 360)}, 60%, 45%)`;
  await fetchJSON(`${API_BASE}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color }),
  });
  nameInput.value = '';
  await loadTags();
});

document.getElementById('tag-filter').addEventListener('change', (e) => {
  currentFilter = e.target.value;
  loadContacts();
});

// ---------- Contacts ----------

async function loadContacts() {
  const url = currentFilter
    ? `${API_BASE}/contacts?tag=${encodeURIComponent(currentFilter)}`
    : `${API_BASE}/contacts`;
  const contacts = await fetchJSON(url);
  renderContacts(contacts);
}

function tagColor(tagName) {
  const tag = allTags.find((t) => t.name === tagName);
  return tag ? tag.color : '#6b7280';
}

function renderContacts(contacts) {
  const body = document.getElementById('contacts-body');
  body.innerHTML = '';

  contacts.forEach((contact) => {
    const tr = document.createElement('tr');

    const tagsHtml = (contact.tags || [])
      .map((t) => `<span class="contact-tag-chip" style="background:${tagColor(t)}">${t}</span>`)
      .join('');

    const lastMsg = contact.last_message_at
      ? new Date(contact.last_message_at).toLocaleString()
      : '—';

    tr.innerHTML = `
      <td>${contact.name || '—'}</td>
      <td>${contact.wa_number}</td>
      <td>${tagsHtml}</td>
      <td>${lastMsg}</td>
      <td></td>
    `;

    const actionsCell = tr.querySelector('td:last-child');

    const tagSelect = document.createElement('select');
    tagSelect.innerHTML = '<option value="">+ tag</option>' +
      allTags.map((t) => `<option value="${t.id}">${t.name}</option>`).join('');
    tagSelect.addEventListener('change', async () => {
      if (!tagSelect.value) return;
      await fetchJSON(`${API_BASE}/contacts/${contact.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_id: tagSelect.value }),
      });
      await loadContacts();
    });
    actionsCell.appendChild(tagSelect);

    body.appendChild(tr);
  });
}

document.getElementById('contact-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const numberInput = document.getElementById('new-contact-number');
  const nameInput = document.getElementById('new-contact-name');
  const wa_number = numberInput.value.trim();
  if (!wa_number) return;

  await fetchJSON(`${API_BASE}/contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wa_number, name: nameInput.value.trim() || null }),
  });
  numberInput.value = '';
  nameInput.value = '';
  await loadContacts();
});

// ---------- Broadcast ----------

document.getElementById('broadcast-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const tag_id = document.getElementById('broadcast-tag').value;
  const template_name = document.getElementById('broadcast-template').value.trim();
  const language_code = document.getElementById('broadcast-lang').value.trim() || 'en_US';
  const paramsRaw = document.getElementById('broadcast-params').value.trim();
  const params = paramsRaw ? paramsRaw.split(',').map((s) => s.trim()) : [];

  const resultEl = document.getElementById('broadcast-result');
  resultEl.textContent = 'Sending...';

  try {
    const result = await fetchJSON(`${API_BASE}/messages/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id, template_name, language_code, params }),
    });
    const failed = result.results.filter((r) => r.status === 'failed').length;
    resultEl.textContent = `Sent to ${result.total} contact(s), ${failed} failed.`;
  } catch (err) {
    resultEl.textContent = `Error: ${err.message}`;
  }
});

// ---------- Init ----------

(async function init() {
  await loadTags();
  await loadContacts();
})();
