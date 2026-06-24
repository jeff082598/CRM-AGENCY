import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Plus, Send, Trash2, Users } from 'lucide-react';
import Modal from '../components/Modal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/client.js';

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function Chat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [people, setPeople] = useState([]);
  const [newChatMode, setNewChatMode] = useState('dm'); // 'dm' | 'group'
  const [groupName, setGroupName] = useState('');
  const [selectedPeople, setSelectedPeople] = useState([]);
  const messagesEndRef = useRef(null);
  const lastMessageIdRef = useRef(null);

  const loadConversations = useCallback(() => {
    api.get('/chat/conversations').then((res) => setConversations(res.data));
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => {
    const t = setInterval(loadConversations, 10000);
    return () => clearInterval(t);
  }, [loadConversations]);

  // Load full history when switching conversations
  useEffect(() => {
    if (!activeId) return;
    api.get(`/chat/conversations/${activeId}/messages`).then((res) => {
      setMessages(res.data);
      lastMessageIdRef.current = res.data.length ? res.data[res.data.length - 1].id : null;
      api.patch(`/chat/conversations/${activeId}/read`);
      loadConversations();
    });
  }, [activeId, loadConversations]);

  // Poll for new messages in the open conversation — this is what makes it
  // feel live without true push (websockets); a few seconds of delay at most.
  useEffect(() => {
    if (!activeId) return;
    const t = setInterval(() => {
      api.get(`/chat/conversations/${activeId}/messages`, { params: { after: lastMessageIdRef.current || 0 } }).then((res) => {
        if (res.data.length) {
          setMessages((prev) => [...prev, ...res.data]);
          lastMessageIdRef.current = res.data[res.data.length - 1].id;
          api.patch(`/chat/conversations/${activeId}/read`);
          loadConversations();
        }
      });
    }, 3000);
    return () => clearInterval(t);
  }, [activeId, loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !activeId) return;
    setDraft('');
    const res = await api.post(`/chat/conversations/${activeId}/messages`, { content: text });
    setMessages((prev) => [...prev, res.data]);
    lastMessageIdRef.current = res.data.id;
    loadConversations();
  };

  const deleteMessage = async (id) => {
    await api.delete(`/chat/messages/${id}`);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const openNewChat = () => {
    setShowNewChat(true);
    setNewChatMode('dm');
    setGroupName('');
    setSelectedPeople([]);
    api.get('/chat/people').then((res) => setPeople(res.data));
  };

  const startDm = async (userId) => {
    const res = await api.post('/chat/conversations/dm', { user_id: userId });
    setShowNewChat(false);
    loadConversations();
    setActiveId(res.data.id);
  };

  const createGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedPeople.length === 0) return;
    const res = await api.post('/chat/conversations/group', { name: groupName.trim(), participant_ids: selectedPeople });
    setShowNewChat(false);
    loadConversations();
    setActiveId(res.data.id);
  };

  const togglePerson = (id) => {
    setSelectedPeople((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  const conversationLabel = (c) => c.type === 'group' ? c.name : (c.other_user_name || 'Unknown user');
  const activeConversation = conversations.find((c) => c.id === activeId);

  return (
    <div className="flex gap-4" style={{ height: 'calc(100vh - 140px)' }}>
      {/* ---- Conversation list ---- */}
      <div className="card" style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="flex items-center justify-between p-3 border-b border-ink-100 dark:border-ink-700">
          <h3 className="text-sm font-semibold text-ink-700 dark:text-ink-100">Messages</h3>
          <button onClick={openNewChat} className="text-brand-600 hover:text-brand-700"><Plus size={18} /></button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.length === 0 && <p className="text-xs text-ink-400 p-4">No conversations yet.</p>}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className="w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-ink-50 dark:hover:bg-ink-700/40"
              style={{ background: activeId === c.id ? 'rgba(79,70,229,0.08)' : undefined, borderBottom: '1px solid #f1f5f9' }}
            >
              <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                {c.type === 'group' ? <Users size={14} /> : conversationLabel(c)[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink-800 dark:text-ink-100 truncate">{conversationLabel(c)}</p>
                  {c.last_message_at && <span className="text-[10px] text-ink-400 flex-shrink-0 ml-1">{timeAgo(c.last_message_at)}</span>}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-ink-400 truncate">{c.last_message || 'No messages yet'}</p>
                  {c.unread_count > 0 && (
                    <span className="bg-brand-600 text-white text-[10px] rounded-full px-1.5 ml-1 flex-shrink-0">{c.unread_count}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ---- Active conversation ---- */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {!activeConversation ? (
          <div className="flex items-center justify-center" style={{ flex: 1 }}>
            <p className="text-sm text-ink-400">Select a conversation, or start a new one.</p>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-ink-100 dark:border-ink-700">
              <p className="text-sm font-semibold text-ink-800 dark:text-ink-50">{conversationLabel(activeConversation)}</p>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }} className="space-y-3">
              {messages.map((m) => {
                const mine = m.sender_id === user.id;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div style={{ maxWidth: '70%' }} className="group">
                      {!mine && <p className="text-[11px] text-ink-400 mb-0.5 ml-1">{m.sender_name}</p>}
                      <div className="flex items-end gap-1">
                        {mine && (
                          <button onClick={() => deleteMessage(m.id)} className="opacity-0 group-hover:opacity-100 text-ink-300 hover:text-red-500">
                            <Trash2 size={12} />
                          </button>
                        )}
                        <div
                          className="rounded-2xl px-3.5 py-2 text-sm"
                          style={mine
                            ? { background: '#4f46e5', color: 'white', borderTopRightRadius: 4 }
                            : { background: '#f1f5f9', color: '#1e293b', borderTopLeftRadius: 4 }}
                        >
                          {m.content}
                        </div>
                      </div>
                      <p className={`text-[10px] text-ink-400 mt-0.5 ${mine ? 'text-right mr-1' : 'ml-1'}`}>{timeAgo(m.created_at)}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="p-3 border-t border-ink-100 dark:border-ink-700 flex gap-2">
              <input
                className="input flex-1"
                placeholder="Type a message…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit" className="btn-primary !px-3"><Send size={16} /></button>
            </form>
          </>
        )}
      </div>

      <Modal open={showNewChat} onClose={() => setShowNewChat(false)} title="New Message">
        <div className="flex gap-2 mb-4">
          <button onClick={() => setNewChatMode('dm')} className={`flex-1 py-1.5 rounded-lg text-sm font-medium ${newChatMode === 'dm' ? 'bg-brand-600 text-white' : 'bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-300'}`}>Direct Message</button>
          <button onClick={() => setNewChatMode('group')} className={`flex-1 py-1.5 rounded-lg text-sm font-medium ${newChatMode === 'group' ? 'bg-brand-600 text-white' : 'bg-ink-100 dark:bg-ink-700 text-ink-600 dark:text-ink-300'}`}>Group Chat</button>
        </div>

        {newChatMode === 'dm' ? (
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {people.map((p) => (
              <button key={p.id} onClick={() => startDm(p.id)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-700 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold">{p.full_name[0].toUpperCase()}</div>
                <span className="text-sm text-ink-700 dark:text-ink-200">{p.full_name}</span>
                <span className="text-xs text-ink-400 capitalize">({p.role})</span>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={createGroup} className="space-y-3">
            <div>
              <label className="label">Group Name</label>
              <input className="input" required value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            </div>
            <div>
              <label className="label">Participants</label>
              <div className="space-y-1 max-h-52 overflow-y-auto border border-ink-100 dark:border-ink-700 rounded-lg p-2">
                {people.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-ink-50 dark:hover:bg-ink-700 cursor-pointer">
                    <input type="checkbox" checked={selectedPeople.includes(p.id)} onChange={() => togglePerson(p.id)} />
                    <span className="text-sm text-ink-700 dark:text-ink-200">{p.full_name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn-secondary" onClick={() => setShowNewChat(false)}>Cancel</button>
              <button type="submit" className="btn-primary">Create Group</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
