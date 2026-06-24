import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Settings2, Trash2, Facebook, FolderOpen } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import PostModal from '../components/PostModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/client.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(n) { return String(n).padStart(2, '0'); }
function dateKey(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

export default function ContentCalendar() {
  const { isAdmin } = useAuth();
  const [cursor, setCursor] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }; });
  const [clients, setClients] = useState([]);
  const [staff, setStaff] = useState([]);
  const [categories, setCategories] = useState([]);
  const [colors, setColors] = useState([]);
  const [clientFilter, setClientFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [posts, setPosts] = useState([]);
  const [activePost, setActivePost] = useState(null); // post object being edited, or {} for "new"
  const [newPostDate, setNewPostDate] = useState(null);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [showManageColors, setShowManageColors] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [newColorNameInput, setNewColorNameInput] = useState('');
  const [newColorHexInput, setNewColorHexInput] = useState('#3b82f6');

  const monthStr = `${cursor.year}-${pad(cursor.month + 1)}`;

  const loadSettings = useCallback(() => {
    api.get('/settings').then((res) => {
      try { setCategories(JSON.parse(res.data.content_categories || '[]')); } catch { setCategories([]); }
      try { setColors(JSON.parse(res.data.content_colors || '[]')); } catch { setColors([]); }
    });
  }, []);

  const loadPosts = useCallback(() => {
    api.get('/content/posts', { params: { month: monthStr, client_id: clientFilter || undefined, status: statusFilter || undefined } })
      .then((res) => setPosts(res.data));
  }, [monthStr, clientFilter, statusFilter]);

  useEffect(() => { loadSettings(); }, [loadSettings]);
  useEffect(() => { loadPosts(); }, [loadPosts]);
  useEffect(() => {
    api.get('/clients').then((res) => setClients(res.data));
    api.get('/users').then((res) => setStaff(res.data.filter((u) => u.role === 'staff' && u.active))).catch(() => {});
  }, []);

  const postsByDay = useMemo(() => {
    const map = {};
    for (const p of posts) {
      const key = p.post_date.slice(0, 10);
      (map[key] = map[key] || []).push(p);
    }
    return map;
  }, [posts]);

  const selectedClient = clients.find((c) => String(c.id) === String(clientFilter));

  const colorHexFor = (name) => colors.find((c) => c.name === name)?.hex || '#94a3b8';

  // ---- Calendar grid ----
  const first = new Date(cursor.year, cursor.month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const todayKey = (() => { const n = new Date(); return dateKey(n.getFullYear(), n.getMonth(), n.getDate()); })();

  const goPrev = () => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }));
  const goNext = () => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));
  const goToday = () => { const n = new Date(); setCursor({ year: n.getFullYear(), month: n.getMonth() }); };

  const openNewPost = (day) => {
    setNewPostDate(dateKey(cursor.year, cursor.month, day));
    setActivePost({}); // empty object signals "new" to PostModal
  };
  const openPost = async (postId) => {
    const res = await api.get(`/content/posts/${postId}`);
    setActivePost(res.data);
  };
  const closePostModal = () => { setActivePost(null); setNewPostDate(null); };

  // ---- Drag and drop reschedule ----
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const handleDrop = async (day) => {
    if (!draggingId) return;
    const newDate = dateKey(cursor.year, cursor.month, day);
    setPosts((prev) => prev.map((p) => (p.id === draggingId ? { ...p, post_date: newDate } : p)));
    await api.patch(`/content/posts/${draggingId}/reschedule`, { post_date: newDate });
    setDraggingId(null);
    setDragOverKey(null);
  };

  const quickAddCategory = async (name) => {
    const updated = [...categories, name];
    setCategories(updated);
    await api.put('/settings', { content_categories: JSON.stringify(updated) });
  };
  const quickAddColor = async ({ name, hex }) => {
    const updated = [...colors, { name, hex }];
    setColors(updated);
    await api.put('/settings', { content_colors: JSON.stringify(updated) });
  };
  const removeCategory = async (name) => {
    const updated = categories.filter((c) => c !== name);
    setCategories(updated);
    await api.put('/settings', { content_categories: JSON.stringify(updated) });
  };
  const removeColor = async (name) => {
    const updated = colors.filter((c) => c.name !== name);
    setColors(updated);
    await api.put('/settings', { content_colors: JSON.stringify(updated) });
  };
  const addCategoryFromModal = async () => {
    const name = newCategoryInput.trim();
    if (!name || categories.includes(name)) return;
    await quickAddCategory(name);
    setNewCategoryInput('');
  };
  const addColorFromModal = async () => {
    const name = newColorNameInput.trim();
    if (!name || colors.some((c) => c.name === name)) return;
    await quickAddColor({ name, hex: newColorHexInput });
    setNewColorNameInput('');
  };

  const monthLabel = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <select className="input w-56" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <select className="input w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {['Draft', 'Pending Approval', 'Approved', 'Scheduled', 'Posted'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn-secondary" onClick={() => setShowManageCategories(true)}><Settings2 size={14} /> Categories</button>
          <button className="btn-secondary" onClick={() => setShowManageColors(true)}><Settings2 size={14} /> Colors</button>
        </div>
        <button className="btn-primary" onClick={() => openNewPost(new Date().getDate())}><Plus size={16} /> New Post</button>
      </div>

      <div className={`grid gap-4 ${selectedClient ? 'grid-cols-1 lg:grid-cols-4' : 'grid-cols-1'}`}>
        {selectedClient && (
          <div className="card p-5 lg:col-span-1 space-y-3" style={{ alignSelf: 'flex-start' }}>
            <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100">{selectedClient.full_name}</h3>
            {selectedClient.company_name && <p className="text-xs text-ink-500">{selectedClient.company_name}</p>}
            <div className="text-xs text-ink-500 space-y-1.5 pt-1">
              {selectedClient.address && <p>{selectedClient.address}</p>}
              {selectedClient.phone && <p>📞 {selectedClient.phone}</p>}
              {selectedClient.facebook_page_link && (
                <a href={selectedClient.facebook_page_link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-brand-600 hover:underline">
                  <Facebook size={13} /> Facebook Page
                </a>
              )}
              {selectedClient.creative_drive_link && (
                <a href={selectedClient.creative_drive_link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-brand-600 hover:underline">
                  <FolderOpen size={13} /> Creative Drive
                </a>
              )}
            </div>
          </div>
        )}

        <div className={selectedClient ? 'lg:col-span-3' : ''}>
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1">
                <button className="p-2 rounded-lg text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-700 dark:text-ink-300" onClick={goPrev}><ChevronLeft size={18} /></button>
                <h3 className="text-base font-semibold text-ink-800 dark:text-ink-50 w-44 text-center">{monthLabel}</h3>
                <button className="p-2 rounded-lg text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-700 dark:text-ink-300" onClick={goNext}><ChevronRight size={18} /></button>
              </div>
              <button className="btn-secondary !px-3 !py-1.5" onClick={goToday}>Today</button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((w) => <div key={w} className="text-center text-xs font-medium text-ink-400 py-1">{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} style={{ minHeight: 96 }} />;
                const key = dateKey(cursor.year, cursor.month, day);
                const dayPosts = postsByDay[key] || [];
                const isToday = key === todayKey;
                return (
                  <div
                    key={idx}
                    onDragOver={(e) => { e.preventDefault(); setDragOverKey(key); }}
                    onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
                    onDrop={() => handleDrop(day)}
                    onClick={() => openNewPost(day)}
                    style={{
                      minHeight: 96, border: `1.5px solid ${dragOverKey === key ? '#4f46e5' : isToday ? '#4f46e5' : '#e2e8f0'}`,
                      borderRadius: 8, padding: 5, cursor: 'pointer',
                      background: isToday ? 'rgba(79,70,229,0.05)' : dragOverKey === key ? 'rgba(79,70,229,0.08)' : 'transparent',
                    }}
                    className="dark:border-ink-700"
                  >
                    <p className={`text-xs mb-1 ${isToday ? 'text-brand-600 font-bold' : 'text-ink-400'}`}>{day}</p>
                    <div className="space-y-1">
                      {dayPosts.slice(0, 3).map((p) => (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={(e) => { e.stopPropagation(); setDraggingId(p.id); }}
                          onClick={(e) => { e.stopPropagation(); openPost(p.id); }}
                          style={{
                            fontSize: 10.5, borderRadius: 5, padding: '2px 5px', cursor: 'grab',
                            background: colorHexFor(p.color_label) + '22', color: colorHexFor(p.color_label),
                            borderLeft: `3px solid ${colorHexFor(p.color_label)}`,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                          }}
                          title={p.title}
                        >
                          {p.title}
                        </div>
                      ))}
                      {dayPosts.length > 3 && <p style={{ fontSize: 10, color: '#94a3b8' }}>+{dayPosts.length - 3} more</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {activePost !== null && (
        <PostModal
          post={activePost.id ? activePost : null}
          defaultDate={newPostDate}
          defaultClientId={clientFilter || undefined}
          clients={clients}
          staff={staff}
          categories={categories}
          colors={colors}
          onClose={closePostModal}
          onSaved={loadPosts}
          onDeleted={() => { closePostModal(); loadPosts(); }}
          onQuickAddCategory={quickAddCategory}
          onQuickAddColor={quickAddColor}
        />
      )}

      <Modal open={showManageCategories} onClose={() => setShowManageCategories(false)} title="Manage Content Categories">
        <p className="text-sm text-ink-500 mb-3">Tag content however fits your workflow — add or remove categories anytime.</p>
        <div className="flex gap-2 mb-3">
          <input className="input flex-1" placeholder="New category…" value={newCategoryInput} onChange={(e) => setNewCategoryInput(e.target.value)} />
          <button className="btn-primary" onClick={addCategoryFromModal}><Plus size={15} /></button>
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {categories.map((c) => (
            <div key={c} className="flex items-center justify-between px-3 py-2 rounded-lg bg-ink-50 dark:bg-ink-800">
              <span className="text-sm text-ink-700 dark:text-ink-200">{c}</span>
              {isAdmin && <button onClick={() => removeCategory(c)} className="text-ink-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={showManageColors} onClose={() => setShowManageColors(false)} title="Manage Color Labels">
        <p className="text-sm text-ink-500 mb-3">Custom colors for tagging posts (urgent, promo, holiday — whatever you need).</p>
        <div className="flex gap-2 mb-3 items-center">
          <input type="color" value={newColorHexInput} onChange={(e) => setNewColorHexInput(e.target.value)} style={{ width: 36, height: 36, padding: 0, border: 'none', borderRadius: 6 }} />
          <input className="input flex-1" placeholder="New color name…" value={newColorNameInput} onChange={(e) => setNewColorNameInput(e.target.value)} />
          <button className="btn-primary" onClick={addColorFromModal}><Plus size={15} /></button>
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {colors.map((c) => (
            <div key={c.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-ink-50 dark:bg-ink-800">
              <span className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-200">
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: c.hex, display: 'inline-block' }} />
                {c.name}
              </span>
              {isAdmin && <button onClick={() => removeColor(c.name)} className="text-ink-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
