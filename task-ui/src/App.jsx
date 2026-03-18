import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2, Circle, Plus, Trash2, X, Zap,
  Activity, Filter, Sparkles, Terminal, Wand2, HelpCircle, BarChart2,
  MessageCircle, Send
} from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL ?? ''
const API = `${BASE}/odata/v4/api/Tasks`
const SUGGEST_API = `${BASE}/odata/v4/api/suggestTask`
const CHAT_API = `${BASE}/odata/v4/api/chatTask`
const EVENTS_URL = `${BASE}/events`

const headers = { 'Content-Type': 'application/json' }

// ─── AI suggestion ───────────────────────────────────────────────────────────

async function suggestTask(userPrompt = '') {
  const res = await fetch(SUGGEST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: userPrompt }),
  })
  if (!res.ok) throw new Error(`suggestTask failed: ${res.status}`)
  const data = await res.json()
  return { title: data.title, description: data.description }
}
// ─── helpers ────────────────────────────────────────────────────────────────

const uuid = () => crypto.randomUUID()

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, { headers, ...opts })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.status === 204 ? null : res.json()
}

// ─── styles (css-in-js objects) ─────────────────────────────────────────────

const s = {
  app: {
    minHeight: '100vh',
    background: 'var(--bg)',
    position: 'relative',
    overflow: 'hidden',
  },

  // animated grid background
  grid: {
    position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
    backgroundImage: `
      linear-gradient(rgba(124,58,237,0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(124,58,237,0.06) 1px, transparent 1px)
    `,
    backgroundSize: '48px 48px',
  },

  // top glow blob
  blob: (color, x, y, size = 600) => ({
    position: 'fixed', zIndex: 0, pointerEvents: 'none', borderRadius: '50%',
    width: size, height: size,
    background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
    left: x, top: y, transform: 'translate(-50%,-50%)',
    filter: 'blur(40px)', opacity: 0.18,
  }),

  wrap: {
    position: 'relative', zIndex: 1,
    maxWidth: 960, margin: '0 auto',
    padding: '0 24px 80px',
  },

  // ── header ──
  header: {
    padding: '40px 0 32px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    borderBottom: '1px solid var(--border)',
    marginBottom: 36,
  },
  logoRow: { display: 'flex', alignItems: 'center', gap: 12 },
  logoIcon: {
    width: 40, height: 40,
    background: 'linear-gradient(135deg,var(--violet),var(--cyan))',
    borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  title: {
    fontFamily: 'var(--font-mono)', fontWeight: 700,
    fontSize: 22, letterSpacing: 2,
    background: 'linear-gradient(90deg,var(--violet-glow),var(--cyan-glow))',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    fontFamily: 'var(--font-mono)', fontSize: 11,
    color: 'var(--text-muted)', letterSpacing: 3, marginTop: 2,
  },
  badge: {
    background: 'linear-gradient(135deg,var(--violet),var(--magenta))',
    borderRadius: 20, padding: '4px 14px',
    fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
    letterSpacing: 2, color: '#fff',
    boxShadow: '0 0 16px rgba(124,58,237,0.5)',
  },

  // ── stats row ──
  stats: {
    display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 36,
  },
  statCard: (accent) => ({
    background: 'var(--surface)',
    border: `1px solid var(--border)`,
    borderRadius: 16, padding: '20px 24px',
    position: 'relative', overflow: 'hidden',
    boxShadow: `0 0 32px ${accent}18`,
  }),
  statAccent: (accent) => ({
    position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    background: `linear-gradient(90deg,transparent,${accent},transparent)`,
  }),
  statNum: (accent) => ({
    fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 700,
    color: accent, lineHeight: 1, marginBottom: 6,
    textShadow: `0 0 20px ${accent}88`,
  }),
  statLabel: {
    fontFamily: 'var(--font-mono)', fontSize: 11,
    color: 'var(--text-muted)', letterSpacing: 2, textTransform: 'uppercase',
  },

  // ── controls ──
  controls: {
    display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap',
  },
  filterBtn: (active) => ({
    background: active
      ? 'linear-gradient(135deg,var(--violet),var(--cyan))'
      : 'var(--surface)',
    border: `1px solid ${active ? 'transparent' : 'var(--border)'}`,
    borderRadius: 10, padding: '8px 18px', cursor: 'pointer',
    color: active ? '#fff' : 'var(--text-muted)',
    fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
    letterSpacing: 1, transition: 'all 0.2s',
    boxShadow: active ? '0 0 20px rgba(124,58,237,0.4)' : 'none',
  }),
  addBtn: {
    marginLeft: 'auto',
    background: 'linear-gradient(135deg,var(--violet),var(--magenta))',
    border: 'none', borderRadius: 10, padding: '8px 20px', cursor: 'pointer',
    color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
    letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6,
    boxShadow: '0 0 24px rgba(236,72,153,0.4)',
    transition: 'all 0.2s',
  },

  // ── task card ──
  card: (completed) => ({
    background: 'var(--surface)',
    border: `1px solid ${completed ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
    borderRadius: 16, padding: '20px 24px',
    display: 'flex', alignItems: 'flex-start', gap: 16,
    cursor: 'pointer', position: 'relative', overflow: 'hidden',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }),
  cardGlow: (completed) => ({
    position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none',
    background: completed
      ? 'radial-gradient(ellipse at top left,rgba(16,185,129,0.06) 0%,transparent 70%)'
      : 'radial-gradient(ellipse at top left,rgba(124,58,237,0.06) 0%,transparent 70%)',
  }),
  checkBtn: (completed) => ({
    flexShrink: 0, marginTop: 2, background: 'none', border: 'none',
    cursor: 'pointer', color: completed ? 'var(--green)' : 'var(--text-muted)',
    transition: 'color 0.2s, filter 0.2s',
    filter: completed ? 'drop-shadow(0 0 6px var(--green))' : 'none',
  }),
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: (completed) => ({
    fontWeight: 600, fontSize: 16, marginBottom: 6,
    color: completed ? 'var(--text-muted)' : 'var(--text)',
    textDecoration: completed ? 'line-through' : 'none',
    transition: 'color 0.2s',
  }),
  cardDesc: {
    fontFamily: 'var(--font-mono)', fontSize: 11,
    color: 'var(--text-muted)', whiteSpace: 'pre', lineHeight: 1.6,
    background: 'var(--surface2)', borderRadius: 8,
    padding: '10px 12px', marginTop: 4,
    border: '1px solid var(--border)',
    overflowX: 'auto',
  },
  cardMeta: {
    marginTop: 10, display: 'flex', alignItems: 'center', gap: 10,
  },
  idBadge: {
    fontFamily: 'var(--font-mono)', fontSize: 10,
    color: 'var(--text-muted)', background: 'var(--surface2)',
    border: '1px solid var(--border)', borderRadius: 6, padding: '2px 8px',
  },
  statusBadge: (completed) => ({
    fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
    letterSpacing: 1, padding: '2px 8px', borderRadius: 6,
    background: completed ? 'rgba(16,185,129,0.15)' : 'rgba(124,58,237,0.15)',
    color: completed ? 'var(--green)' : 'var(--violet-glow)',
    border: `1px solid ${completed ? 'rgba(16,185,129,0.3)' : 'rgba(124,58,237,0.3)'}`,
  }),
  deleteBtn: {
    flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', opacity: 0.5, transition: 'all 0.2s',
    padding: 4, borderRadius: 6,
  },

  // ── empty state ──
  empty: {
    textAlign: 'center', padding: '80px 0',
    color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 13,
  },

  // ── modal backdrop ──
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 100,
    background: 'rgba(8,11,20,0.85)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24,
  },
  modal: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 20, padding: 32, width: '100%', maxWidth: 480,
    position: 'relative',
    boxShadow: '0 0 60px rgba(124,58,237,0.25)',
  },
  modalTitle: {
    fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
    letterSpacing: 2, marginBottom: 24,
    background: 'linear-gradient(90deg,var(--violet-glow),var(--cyan-glow))',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  label: {
    display: 'block', fontFamily: 'var(--font-mono)', fontSize: 11,
    color: 'var(--text-muted)', letterSpacing: 2, marginBottom: 8,
  },
  input: {
    width: '100%', background: 'var(--surface2)',
    border: '1px solid var(--border)', borderRadius: 10,
    padding: '12px 16px', color: 'var(--text)',
    fontFamily: 'var(--font-mono)', fontSize: 13, marginBottom: 20,
    outline: 'none', transition: 'border-color 0.2s',
  },
  textarea: {
    width: '100%', background: 'var(--surface2)',
    border: '1px solid var(--border)', borderRadius: 10,
    padding: '12px 16px', color: 'var(--text)',
    fontFamily: 'var(--font-mono)', fontSize: 12,
    resize: 'vertical', minHeight: 100, marginBottom: 24,
    outline: 'none', transition: 'border-color 0.2s',
  },
  modalActions: { display: 'flex', gap: 12, justifyContent: 'flex-end' },
  cancelBtn: {
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '10px 20px', cursor: 'pointer',
    color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12,
  },
  submitBtn: {
    background: 'linear-gradient(135deg,var(--violet),var(--cyan))',
    border: 'none', borderRadius: 10, padding: '10px 24px', cursor: 'pointer',
    color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
    letterSpacing: 1, boxShadow: '0 0 20px rgba(124,58,237,0.4)',
  },
  suggestBtn: (loading) => ({
    background: loading
      ? 'rgba(236,72,153,0.1)'
      : 'linear-gradient(135deg,rgba(236,72,153,0.2),rgba(124,58,237,0.2))',
    border: '1px solid rgba(236,72,153,0.5)',
    borderRadius: 10, padding: '10px 20px', cursor: loading ? 'not-allowed' : 'pointer',
    color: 'var(--magenta-glow)', fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
    letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6,
    opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
  }),
  closeBtn: {
    position: 'absolute', top: 16, right: 16,
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)',
  },
  helpBtn: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '6px 14px', cursor: 'pointer',
    color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12,
    fontWeight: 700, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6,
    transition: 'all 0.2s',
  },
  helpModal: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 20, padding: 32, width: '100%', maxWidth: 760,
    position: 'relative',
    boxShadow: '0 0 60px rgba(124,58,237,0.25)',
    maxHeight: '85vh', overflowY: 'auto',
  },
  pre: {
    fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.5,
    color: 'var(--cyan-glow)', background: 'var(--surface2)',
    border: '1px solid var(--border)', borderRadius: 10,
    padding: '16px 20px', overflowX: 'auto', whiteSpace: 'pre',
    marginBottom: 20,
  },
  helpSection: {
    fontFamily: 'var(--font-mono)', fontSize: 11,
    color: 'var(--text-muted)', letterSpacing: 1,
    marginBottom: 8, textTransform: 'uppercase',
  },
  helpPara: {
    fontFamily: 'var(--font-mono)', fontSize: 12,
    color: 'var(--text)', lineHeight: 1.7, marginBottom: 16,
  },

  // ── stats modal ──
  statsModal: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 20, padding: 32, width: '100%', maxWidth: 900,
    position: 'relative',
    boxShadow: '0 0 60px rgba(6,182,212,0.2)',
    maxHeight: '88vh', overflowY: 'auto',
  },
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 32,
  },
  table: {
    width: '100%', borderCollapse: 'collapse', marginBottom: 32,
    fontFamily: 'var(--font-mono)', fontSize: 11,
  },
  th: {
    padding: '8px 12px', textAlign: 'left',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-muted)', letterSpacing: 2, textTransform: 'uppercase',
    fontWeight: 700,
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    color: 'var(--text)', verticalAlign: 'middle',
  },
  barWrap: { marginBottom: 32 },
  barLabel: {
    fontFamily: 'var(--font-mono)', fontSize: 11,
    color: 'var(--text-muted)', letterSpacing: 2,
    textTransform: 'uppercase', marginBottom: 12,
  },
  statsBtn: {
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '6px 14px', cursor: 'pointer',
    color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 12,
    fontWeight: 700, letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6,
    transition: 'all 0.2s',
  },

  // ── toast ──
  toast: (type) => ({
    position: 'fixed', bottom: 32, right: 32, zIndex: 200,
    background: type === 'error' ? 'rgba(236,72,153,0.15)' : 'rgba(16,185,129,0.15)',
    border: `1px solid ${type === 'error' ? 'rgba(236,72,153,0.5)' : 'rgba(16,185,129,0.5)'}`,
    borderRadius: 12, padding: '12px 20px',
    fontFamily: 'var(--font-mono)', fontSize: 12,
    color: type === 'error' ? 'var(--magenta-glow)' : 'var(--green-glow)',
    display: 'flex', alignItems: 'center', gap: 8,
    boxShadow: `0 0 24px ${type === 'error' ? 'rgba(236,72,153,0.3)' : 'rgba(16,185,129,0.3)'}`,
  }),

  // ── chat ──
  chatBubble: {
    position: 'fixed', bottom: 32, right: 32, zIndex: 50,
    width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
    background: 'linear-gradient(135deg,var(--violet),var(--cyan))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 24px rgba(124,58,237,0.5), 0 0 48px rgba(6,182,212,0.2)',
  },
  chatPanel: {
    position: 'fixed', bottom: 100, right: 32, zIndex: 50,
    width: 380, height: 520,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 20, display: 'flex', flexDirection: 'column',
    boxShadow: '0 0 60px rgba(124,58,237,0.25)',
    overflow: 'hidden',
  },
  chatHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'relative', flexShrink: 0,
  },
  chatMessages: {
    flex: 1, overflowY: 'auto', padding: '16px',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  chatMsgUser: {
    alignSelf: 'flex-end', maxWidth: '80%',
    background: 'rgba(124,58,237,0.25)',
    border: '1px solid rgba(124,58,237,0.4)',
    borderRadius: '12px 12px 4px 12px',
    padding: '8px 12px',
    fontFamily: 'var(--font-mono)', fontSize: 12,
    color: 'var(--violet-glow)',
  },
  chatMsgBot: {
    alignSelf: 'flex-start', maxWidth: '85%',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: '12px 12px 12px 4px',
    padding: '8px 12px',
    fontFamily: 'var(--font-mono)', fontSize: 12,
    color: 'var(--cyan-glow)',
  },
  chatInputRow: {
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
    display: 'flex', gap: 8, flexShrink: 0,
  },
  chatInput: {
    flex: 1, background: 'var(--surface2)',
    border: '1px solid var(--border)', borderRadius: 10,
    padding: '10px 14px', color: 'var(--text)',
    fontFamily: 'var(--font-mono)', fontSize: 12,
    outline: 'none',
  },
  chatSendBtn: (disabled) => ({
    background: disabled ? 'rgba(124,58,237,0.2)' : 'linear-gradient(135deg,var(--violet),var(--cyan))',
    border: 'none', borderRadius: 10, padding: '10px 14px', cursor: disabled ? 'not-allowed' : 'pointer',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: disabled ? 0.5 : 1,
  }),
}

// ─── components ─────────────────────────────────────────────────────────────

function Toast({ message, type }) {
  return (
    <motion.div style={s.toast(type)}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}>
      {type === 'error' ? <X size={14} /> : <Zap size={14} />}
      {message}
    </motion.div>
  )
}

function StatCard({ num, label, accent, icon: Icon }) {
  return (
    <motion.div style={s.statCard(accent)}
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: `0 8px 32px ${accent}30` }}>
      <div style={s.statAccent(accent)} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <motion.div style={s.statNum(accent)}
            key={num}
            initial={{ scale: 1.3 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}>
            {num}
          </motion.div>
          <div style={s.statLabel}>{label}</div>
        </div>
        <Icon size={20} color={accent} style={{ opacity: 0.6, marginTop: 4 }} />
      </div>
    </motion.div>
  )
}

function TaskCard({ task, onToggle, onDelete }) {
  const [hovered, setHovered] = useState(false)
  return (
    <motion.div
      layout
      style={{
        ...s.card(task.completed),
        boxShadow: hovered
          ? task.completed
            ? '0 4px 24px rgba(16,185,129,0.12)'
            : '0 4px 24px rgba(124,58,237,0.15)'
          : 'none',
        borderColor: hovered
          ? task.completed ? 'rgba(16,185,129,0.5)' : 'rgba(124,58,237,0.4)'
          : task.completed ? 'rgba(16,185,129,0.3)' : 'var(--border)',
      }}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}>

      <div style={s.cardGlow(task.completed)} />

      <motion.button style={s.checkBtn(task.completed)}
        onClick={() => onToggle(task)}
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.15 }}>
        {task.completed
          ? <CheckCircle2 size={22} />
          : <Circle size={22} />}
      </motion.button>

      <div style={s.cardBody}>
        <div style={s.cardTitle(task.completed)}>{task.title}</div>
        {task.description && (
          <pre style={s.cardDesc}>{task.description}</pre>
        )}
        <div style={s.cardMeta}>
          <span style={s.idBadge}>{task.ID.slice(0, 8)}…</span>
          <span style={s.statusBadge(task.completed)}>
            {task.completed ? '✓ DONE' : '◉ PENDING'}
          </span>
        </div>
      </div>

      <motion.button style={s.deleteBtn}
        onClick={() => onDelete(task.ID)}
        whileHover={{ opacity: 1, color: 'var(--magenta)', scale: 1.1 }}
        whileTap={{ scale: 0.9 }}>
        <Trash2 size={16} />
      </motion.button>
    </motion.div>
  )
}

function AddModal({ onClose, onAdd }) {
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [prompt, setPrompt] = useState('')
  const [focused, setFocused] = useState(null)
  const [suggesting, setSuggesting] = useState(false)

  const focusBorder = (field) => ({
    borderColor: focused === field ? 'var(--violet)' : 'var(--border)',
    boxShadow: focused === field ? '0 0 0 2px rgba(124,58,237,0.2)' : 'none',
  })

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({ title: title.trim(), description: desc.trim() })
  }

  const handleSuggest = async () => {
    if (suggesting) return
    setSuggesting(true)
    try {
      const suggestion = await suggestTask(prompt)
      setTitle(suggestion.title)
      setDesc(suggestion.description)
    } catch (err) {
      console.error('Suggest failed:', err)
    } finally {
      setSuggesting(false)
    }
  }

  return (
    <motion.div style={s.backdrop}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div style={s.modal}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}>

        <div style={{ position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg,transparent,var(--violet),var(--cyan),transparent)' }} />
        </div>

        <button style={s.closeBtn} onClick={onClose}>
          <X size={18} />
        </button>

        <div style={s.modalTitle}>// NEW_TASK</div>

        <form onSubmit={submit}>
          <label style={s.label}>TITLE *</label>
          <input style={{ ...s.input, ...focusBorder('title') }}
            value={title} onChange={e => setTitle(e.target.value)}
            onFocus={() => setFocused('title')} onBlur={() => setFocused(null)}
            placeholder="What needs to be done?" autoFocus />

          <label style={s.label}>DESCRIPTION</label>
          <textarea style={{ ...s.textarea, ...focusBorder('desc') }}
            value={desc} onChange={e => setDesc(e.target.value)}
            onFocus={() => setFocused('desc')} onBlur={() => setFocused(null)}
            placeholder="ASCII art welcome..." />

          <label style={s.label}>AI PROMPT HINT</label>
          <input style={{ ...s.input, marginBottom: 24, ...focusBorder('prompt') }}
            value={prompt} onChange={e => setPrompt(e.target.value)}
            onFocus={() => setFocused('prompt')} onBlur={() => setFocused(null)}
            placeholder="e.g. something about robots and coffee..." />

          <div style={s.modalActions}>
            <button type="button" style={s.cancelBtn} onClick={onClose}>CANCEL</button>
            <motion.button
              type="button"
              style={s.suggestBtn(suggesting)}
              onClick={handleSuggest}
              disabled={suggesting}
              whileHover={suggesting ? {} : { scale: 1.03, boxShadow: '0 0 24px rgba(236,72,153,0.5)' }}
              whileTap={suggesting ? {} : { scale: 0.97 }}>
              {suggesting
                ? <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    style={{ display: 'inline-block' }}>✦</motion.span>
                : <Wand2 size={13} />}
              {suggesting ? 'ASKING AI…' : '✨ SUGGEST'}
            </motion.button>
            <motion.button type="submit" style={s.submitBtn}
              whileHover={{ scale: 1.03, boxShadow: '0 0 28px rgba(124,58,237,0.6)' }}
              whileTap={{ scale: 0.97 }}>
              + CREATE
            </motion.button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

const ARCH = `\
┌─────────────────────────────────────────────────────────────────────┐
│                     Browser (Vite :5173)                            │
│                                                                     │
│  App.jsx                                                            │
│  ┌─────────────────────┐    ┌──────────────────────────────────┐   │
│  │  useEffect (mount)  │    │  useEffect (SSE)                 │   │
│  │  loadTasks()        │    │  new EventSource('/events')      │   │
│  │  GET /odata/v4/...  │    │  on 'tasks_changed' → loadTasks()│   │
│  └──────────┬──────────┘    └───────────────┬──────────────────┘   │
│                                                                     │
│  ChatModal (floating, bottom-right)                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  user types natural-language command                         │  │
│  │  POST /odata/v4/api/chatTask  { message, taskList JSON }     │  │
│  │  ← { response, action, taskId, title, description }         │  │
│  │  handleChatAction → doAdd / handleToggle / handleDelete      │  │
│  └──────────────────────────┬───────────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────────┘
              Vite proxy       │  /odata → :8080  /events → :8080
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Spring Boot CAP Java (:8080)                       │
│                                                                     │
│  ┌──────────────────────┐    ┌──────────────────────────────────┐  │
│  │  CdsODataV4Servlet   │    │  SseController                   │  │
│  │  /odata/v4/api/Tasks │    │  GET /events                     │  │
│  │  /odata/v4/api/      │    │  → SseEmitterRegistry.register() │  │
│  │    suggestTask        │    └───────────────┬──────────────────┘  │
│  │    chatTask  ◄────────┼─── ChatTaskHandler │ holds open          │
│  │  (CRUD + actions)    │    │                ▼                     │
│  └──────────┬───────────┘    │  ┌──────────────────────────────┐   │
│             │ reads/writes   │  │  SseEmitterRegistry          │   │
│             ▼                │  │  CopyOnWriteArrayList        │   │
│  ┌──────────────────┐        │  └──────────────▲───────────────┘   │
│  │   H2 in-memory   │        │                 │ broadcast()        │
│  │   (Tasks table)  │        └─────────────────┼────────────────┐  │
│  └──────────────────┘                          │                │  │
│                                                │                │  │
│  ┌─────────────────────────────────────────────┴────────────┐   │  │
│  │  TaskAgentScheduler (10s)   CompleterAgentScheduler (~10s)│   │  │
│  │  generate → refine          fetch → pick one at random    │   │  │
│  │         → POST task         → PATCH completed=true        │   │  │
│  │                               + completedAt=now()         │   │  │
│  │  MonitorAgentScheduler (2s)                               │   │  │
│  │  snapshot GET → compare → broadcast("tasks_changed") ─────┘   │  │
│  └───────────────────────────────────────────────────────────┘   │  │
│                                                                   │  │
│  Stats (browser-side only):  StatsModal reads createdAt +         │  │
│  completedAt → avg/min/max duration, bar charts, task table       │  │
└───────────────────────────────────┬───────────────────────────────┘
                                    │ HTTP (LangChain4j)
                                    ▼
                       ┌─────────────────────────┐
                       │  Hyperspace AI Proxy     │
                       │  localhost:6655          │
                       │  → Anthropic Claude API  │
                       └─────────────────────────┘`

function ChatModal({ tasks, onTaskAction, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Hi! I can create, complete, reopen or delete tasks. What would you like to do?' }
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submit = async () => {
    const text = input.trim()
    if (!text || thinking) return
    setMessages(prev => [...prev, { role: 'user', text }])
    setInput('')
    setThinking(true)
    try {
      const taskList = JSON.stringify(tasks.map(t => ({ ID: t.ID, title: t.title, completed: t.completed })))
      const res = await fetch(CHAT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, taskList }),
      })
      if (!res.ok) throw new Error(`chatTask failed: ${res.status}`)
      const result = await res.json()
      setMessages(prev => [...prev, { role: 'bot', text: result.response || '(no response)' }])
      if (result.action && result.action !== 'none') {
        onTaskAction(result.action, result)
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: `Error: ${err.message}` }])
    } finally {
      setThinking(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
    if (e.key === 'Escape') onClose()
  }

  return (
    <motion.div style={s.chatPanel}
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 20 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}>

      {/* shimmer top border */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, zIndex: 1,
        background: 'linear-gradient(90deg,transparent,var(--violet),var(--cyan),transparent)' }} />

      {/* header */}
      <div style={s.chatHeader}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
          background: 'linear-gradient(90deg,var(--violet-glow),var(--cyan-glow))',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          // CHAT_ASSISTANT
        </div>
        <button style={s.closeBtn} onClick={onClose}><X size={16} /></button>
      </div>

      {/* messages */}
      <div style={s.chatMessages}>
        {messages.map((msg, i) => (
          <div key={i} style={msg.role === 'user' ? s.chatMsgUser : s.chatMsgBot}>
            {msg.text}
          </div>
        ))}
        {thinking && (
          <motion.div style={s.chatMsgBot}
            animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.2 }}>
            thinking…
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* input row */}
      <div style={s.chatInputRow}>
        <input
          style={s.chatInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command…"
          autoFocus
          disabled={thinking}
        />
        <button style={s.chatSendBtn(thinking || !input.trim())} onClick={submit} disabled={thinking || !input.trim()}>
          <Send size={14} />
        </button>
      </div>
    </motion.div>
  )
}

function HelpModal({ onClose }) {
  return (
    <motion.div style={s.backdrop}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div style={s.helpModal}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}>

        <div style={{ position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg,transparent,var(--violet),var(--cyan),transparent)' }} />
        </div>

        <button style={s.closeBtn} onClick={onClose}><X size={18} /></button>

        <div style={s.modalTitle}>// ARCHITECTURE</div>

        <div style={s.helpSection}>System Overview</div>
        <p style={s.helpPara}>
          Three LangGraph4j agents run on a schedule inside the Spring Boot server.
          The UI subscribes to a Server-Sent Events stream and reloads tasks automatically
          whenever an agent modifies the database — no manual refresh needed.
          A floating chat bubble (bottom-right) lets you create, complete, reopen or delete tasks
          using plain English — the command is routed through a CAP action to Claude, which
          interprets the intent and returns a structured response the UI acts on immediately.
          The STATS button shows timing analytics computed entirely in the browser
          from the createdAt and completedAt fields returned by OData.
        </p>

        <div style={s.helpSection}>Architecture Diagram</div>
        <pre style={s.pre}>{ARCH}</pre>

        <div style={s.helpSection}>Data Flow</div>
        <p style={s.helpPara}>
          1. <strong style={{ color: 'var(--violet-glow)' }}>TaskAgent</strong> (every 10s) — asks Claude to brainstorm a hackathon task, refines it so the title starts with "AI ", then POSTs it via OData. CAP sets createdAt automatically.{'\n'}
          2. <strong style={{ color: 'var(--cyan-glow)' }}>CompleterAgent</strong> (every ~10s) — fetches pending tasks, picks one at random, PATCHes completed=true and completedAt=now().{'\n'}
          3. <strong style={{ color: 'var(--green-glow)' }}>MonitorAgent</strong> (every 2s) — GETs all tasks, compares the response body to the previous snapshot. On any difference it calls broadcast(), which pushes a tasks_changed SSE event to every connected browser tab.{'\n'}
          4. The browser EventSource receives the event and calls loadTasks(), keeping the UI in sync.{'\n'}
          5. <strong style={{ color: 'var(--magenta-glow)' }}>Chat panel</strong> — type a natural-language command ("create a task to fix login", "mark it as done", "delete Buy groceries"). The current task list is sent as JSON context alongside your message to the chatTask CAP action, which calls Claude and returns {'{action, taskId, title, …}'}. The UI then executes the OData operation directly.{'\n'}
          6. <strong style={{ color: 'var(--text-muted)' }}>StatsModal</strong> — clicking STATS opens a panel that derives avg/min/max open duration, per-day bar charts, and a full task table from the live task list (createdAt → completedAt). No extra API call needed.
        </p>

        <div style={s.helpSection}>Stack</div>
        <p style={{ ...s.helpPara, marginBottom: 0 }}>
          SAP CAP Java 2.6.0 · Spring Boot 3.2 · H2 in-memory · LangGraph4j 1.8.10 · LangChain4j 1.0.0-beta3 · React 18 · Vite · Framer Motion
        </p>
      </motion.div>
    </motion.div>
  )
}

function BarChart({ data, color, valueKey, labelKey }) {
  const max = Math.max(...data.map(d => d[valueKey]), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
            {d[valueKey] || ''}
          </div>
          <motion.div
            style={{ width: '100%', background: color, borderRadius: '4px 4px 0 0', minHeight: 2 }}
            initial={{ height: 0 }}
            animate={{ height: `${(d[valueKey] / max) * 60}px` }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: i * 0.03 }}
          />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
            {d[labelKey]}
          </div>
        </div>
      ))}
    </div>
  )
}

function fmtDuration(ms) {
  if (ms == null) return '—'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

function fmtTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    + ' ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function bucketByDay(tasks, dateField) {
  const counts = {}
  tasks.forEach(t => {
    if (!t[dateField]) return
    const day = t[dateField].slice(0, 10)
    counts[day] = (counts[day] || 0) + 1
  })
  return Object.entries(counts).sort().map(([day, count]) => ({
    label: day.slice(5), // MM-DD
    count,
  }))
}

function StatsModal({ tasks, onClose }) {
  const completed = tasks.filter(t => t.completed && t.completedAt && t.createdAt)
  const durations = completed.map(t => new Date(t.completedAt) - new Date(t.createdAt))
  const avgMs = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null
  const minMs = durations.length ? Math.min(...durations) : null
  const maxMs = durations.length ? Math.max(...durations) : null

  const createdByDay  = bucketByDay(tasks, 'createdAt')
  const completedByDay = bucketByDay(completed, 'completedAt')

  const tableRows = [...tasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return (
    <motion.div style={s.backdrop}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div style={s.statsModal}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}>

        <div style={{ position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg,transparent,var(--cyan),var(--violet),transparent)' }} />
        </div>

        <button style={s.closeBtn} onClick={onClose}><X size={18} /></button>
        <div style={s.modalTitle}>// STATISTICS</div>

        {/* summary cards */}
        <div style={s.statsGrid}>
          <div style={s.statCard('var(--cyan-glow)')}>
            <div style={s.statAccent('var(--cyan-glow)')} />
            <div style={s.statNum('var(--cyan-glow)')}>{tasks.length}</div>
            <div style={s.statLabel}>TOTAL TASKS</div>
          </div>
          <div style={s.statCard('var(--violet-glow)')}>
            <div style={s.statAccent('var(--violet-glow)')} />
            <div style={s.statNum('var(--violet-glow)')}>{fmtDuration(avgMs)}</div>
            <div style={s.statLabel}>AVG TIME OPEN</div>
          </div>
          <div style={s.statCard('var(--green-glow)')}>
            <div style={s.statAccent('var(--green-glow)')} />
            <div style={s.statNum('var(--green-glow)')}>{fmtDuration(minMs)}</div>
            <div style={s.statLabel}>FASTEST CLOSE</div>
          </div>
        </div>

        {/* charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
          <div style={s.barWrap}>
            <div style={s.barLabel}>Tasks Created per Day</div>
            {createdByDay.length
              ? <BarChart data={createdByDay} color="var(--violet)" valueKey="count" labelKey="label" />
              : <div style={{ ...s.helpSection, paddingTop: 8 }}>No data yet</div>}
          </div>
          <div style={s.barWrap}>
            <div style={s.barLabel}>Tasks Completed per Day</div>
            {completedByDay.length
              ? <BarChart data={completedByDay} color="var(--green)" valueKey="count" labelKey="label" />
              : <div style={{ ...s.helpSection, paddingTop: 8 }}>No data yet</div>}
          </div>
        </div>

        {/* table */}
        <div style={s.barLabel}>All Tasks</div>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Title</th>
              <th style={s.th}>Created</th>
              <th style={s.th}>Completed</th>
              <th style={s.th}>Duration Open</th>
              <th style={s.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map(t => {
              const dur = t.completedAt && t.createdAt
                ? new Date(t.completedAt) - new Date(t.createdAt)
                : null
              return (
                <tr key={t.ID}>
                  <td style={{ ...s.td, maxWidth: 220, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</td>
                  <td style={{ ...s.td, color: 'var(--text-muted)' }}>{fmtTime(t.createdAt)}</td>
                  <td style={{ ...s.td, color: 'var(--text-muted)' }}>{fmtTime(t.completedAt)}</td>
                  <td style={{ ...s.td, color: dur != null ? 'var(--cyan-glow)' : 'var(--text-muted)' }}>
                    {fmtDuration(dur)}
                  </td>
                  <td style={s.td}>
                    <span style={s.statusBadge(t.completed)}>
                      {t.completed ? '✓ DONE' : '◉ PENDING'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div style={{ ...s.helpSection, marginBottom: 0 }}>
          Slowest close: <span style={{ color: 'var(--magenta-glow)' }}>{fmtDuration(maxMs)}</span>
          &nbsp;·&nbsp;
          {completed.length} of {tasks.length} tasks closed with timing data
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── main app ───────────────────────────────────────────────────────────────

export default function App() {
  const [tasks, setTasks] = useState([])
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  const notify = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadTasks = useCallback(async () => {
    try {
      const data = await apiFetch(API)
      setTasks(data.value)
    } catch {
      notify('Failed to load tasks', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  useEffect(() => {
    const es = new EventSource(EVENTS_URL)
    es.addEventListener('tasks_changed', () => loadTasks())
    es.onerror = (err) => console.warn('SSE error, browser will retry:', err)
    return () => es.close()
  }, [loadTasks])

  const handleToggle = async (task) => {
    const completing = !task.completed
    const updated = {
      completed: completing,
      ...(completing ? { completedAt: new Date().toISOString() } : { completedAt: null }),
    }
    setTasks(prev => prev.map(t => t.ID === task.ID ? { ...t, ...updated } : t))
    try {
      await apiFetch(`${API}(${task.ID})`, { method: 'PATCH', body: JSON.stringify(updated) })
      notify(updated.completed ? 'Task completed! 🎉' : 'Task reopened')
    } catch {
      setTasks(prev => prev.map(t => t.ID === task.ID ? task : t))
      notify('Update failed', 'error')
    }
  }

  const handleDelete = async (id) => {
    const backup = tasks.find(t => t.ID === id)
    setTasks(prev => prev.filter(t => t.ID !== id))
    try {
      await apiFetch(`${API}(${id})`, { method: 'DELETE' })
      notify('Task deleted')
    } catch {
      setTasks(prev => [...prev, backup])
      notify('Delete failed', 'error')
    }
  }

  const doAdd = async ({ title, description }) => {
    const newTask = { ID: uuid(), title, description, completed: false }
    setTasks(prev => [newTask, ...prev])
    try {
      const created = await apiFetch(API, { method: 'POST', body: JSON.stringify(newTask) })
      setTasks(prev => prev.map(t => t.ID === newTask.ID ? created : t))
      notify('Task created! ⚡')
    } catch {
      setTasks(prev => prev.filter(t => t.ID !== newTask.ID))
      notify('Create failed', 'error')
    }
  }

  const handleAdd = async ({ title, description }) => {
    setShowModal(false)
    await doAdd({ title, description })
  }

  const handleChatAction = (action, payload) => {
    if (action === 'create') {
      doAdd({ title: payload.title || 'New Task', description: payload.description || '' })
    } else if (action === 'complete') {
      const task = tasks.find(t => t.ID === payload.taskId)
      if (task && !task.completed) handleToggle(task)
    } else if (action === 'reopen') {
      const task = tasks.find(t => t.ID === payload.taskId)
      if (task && task.completed) handleToggle(task)
    } else if (action === 'delete') {
      if (payload.taskId) handleDelete(payload.taskId)
    } else if (action === 'deleteAll') {
      // taskId field contains a JSON-array-like string: [uuid1,uuid2,...]
      const raw = payload.taskId || ''
      const ids = raw.replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean)
      ids.forEach(id => handleDelete(id))
    }
  }

  const filtered = tasks.filter(t =>
    filter === 'all' ? true : filter === 'pending' ? !t.completed : t.completed
  )
  const done = tasks.filter(t => t.completed).length
  const pending = tasks.length - done

  return (
    <div style={s.app}>
      {/* background layers */}
      <div style={s.grid} />
      <div style={s.blob('rgba(124,58,237,0.8)', '15%', '10%', 700)} />
      <div style={s.blob('rgba(6,182,212,0.6)', '85%', '20%', 500)} />
      <div style={s.blob('rgba(236,72,153,0.5)', '50%', '90%', 600)} />

      <div style={s.wrap}>

        {/* header */}
        <header style={s.header}>
          <div style={s.logoRow}>
            <div style={s.logoIcon}>
              <Terminal size={20} color="#fff" />
            </div>
            <div>
              <div style={s.title}>TASK//BOARD</div>
              <div style={s.subtitle}>SAP CAP · ODATA V4 · REACT</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <motion.button style={s.statsBtn}
              onClick={() => setShowStats(true)}
              whileHover={{ scale: 1.04, borderColor: 'var(--cyan)', color: 'var(--cyan-glow)' }}
              whileTap={{ scale: 0.96 }}>
              <BarChart2 size={13} /> STATS
            </motion.button>
            <motion.button style={s.helpBtn}
              onClick={() => setShowHelp(true)}
              whileHover={{ scale: 1.04, borderColor: 'var(--violet)', color: 'var(--violet-glow)' }}
              whileTap={{ scale: 0.96 }}>
              <HelpCircle size={13} /> HELP
            </motion.button>
            <div style={s.badge}>⚡ AI HACKATHON</div>
          </div>
        </header>

        {/* stats */}
        <div style={s.stats}>
          <StatCard num={tasks.length} label="TOTAL TASKS" accent="var(--violet-glow)" icon={Activity} />
          <StatCard num={pending} label="PENDING" accent="var(--cyan-glow)" icon={Sparkles} />
          <StatCard num={done} label="COMPLETED" accent="var(--green-glow)" icon={CheckCircle2} />
        </div>

        {/* controls */}
        <div style={s.controls}>
          <Filter size={16} color="var(--text-muted)" style={{ alignSelf: 'center' }} />
          {['all', 'pending', 'done'].map(f => (
            <motion.button key={f} style={s.filterBtn(filter === f)}
              onClick={() => setFilter(f)}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              {f.toUpperCase()}
            </motion.button>
          ))}
          <motion.button style={s.addBtn}
            onClick={() => setShowModal(true)}
            whileHover={{ scale: 1.04, boxShadow: '0 0 32px rgba(236,72,153,0.6)' }}
            whileTap={{ scale: 0.96 }}>
            <Plus size={14} /> NEW TASK
          </motion.button>
        </div>

        {/* task list */}
        {loading ? (
          <motion.div style={{ ...s.empty }}
            animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.5 }}>
            <Terminal size={32} style={{ margin: '0 auto 12px', display: 'block', color: 'var(--violet)' }} />
            LOADING FROM CAP API…
          </motion.div>
        ) : (
          <motion.div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} layout>
            <AnimatePresence mode="popLayout">
              {filtered.length === 0 ? (
                <motion.div key="empty" style={s.empty}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Sparkles size={32} style={{ margin: '0 auto 12px', display: 'block', color: 'var(--violet)' }} />
                  NO TASKS FOUND
                </motion.div>
              ) : (
                filtered.map(task => (
                  <TaskCard key={task.ID} task={task}
                    onToggle={handleToggle} onDelete={handleDelete} />
                ))
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* stats modal */}
      <AnimatePresence>
        {showStats && <StatsModal tasks={tasks} onClose={() => setShowStats(false)} />}
      </AnimatePresence>

      {/* modals */}
      <AnimatePresence>
        {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      </AnimatePresence>

      {/* modal */}
      <AnimatePresence>
        {showModal && <AddModal onClose={() => setShowModal(false)} onAdd={handleAdd} />}
      </AnimatePresence>

      {/* toast */}
      <AnimatePresence>
        {toast && <Toast key={toast.message} message={toast.message} type={toast.type} />}
      </AnimatePresence>

      {/* chat panel */}
      <AnimatePresence>
        {showChat && (
          <ChatModal
            tasks={tasks}
            onTaskAction={handleChatAction}
            onClose={() => setShowChat(false)}
          />
        )}
      </AnimatePresence>

      {/* chat bubble */}
      <motion.button
        style={s.chatBubble}
        onClick={() => setShowChat(v => !v)}
        whileHover={{ scale: 1.1, boxShadow: '0 0 36px rgba(124,58,237,0.7), 0 0 64px rgba(6,182,212,0.3)' }}
        whileTap={{ scale: 0.93 }}>
        {showChat ? <X size={22} color="#fff" /> : <MessageCircle size={22} color="#fff" />}
      </motion.button>
    </div>
  )
}
