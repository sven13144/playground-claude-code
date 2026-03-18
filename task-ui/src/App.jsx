import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2, Circle, Plus, Trash2, X, Zap,
  Activity, Filter, Sparkles, Terminal
} from 'lucide-react'

const API = '/odata/v4/api/Tasks'

const headers = { 'Content-Type': 'application/json' }

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
  closeBtn: {
    position: 'absolute', top: 16, right: 16,
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)',
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
  const [focused, setFocused] = useState(null)

  const focusBorder = (field) => ({
    borderColor: focused === field ? 'var(--violet)' : 'var(--border)',
    boxShadow: focused === field ? '0 0 0 2px rgba(124,58,237,0.2)' : 'none',
  })

  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({ title: title.trim(), description: desc.trim() })
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

          <div style={s.modalActions}>
            <button type="button" style={s.cancelBtn} onClick={onClose}>CANCEL</button>
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

// ─── main app ───────────────────────────────────────────────────────────────

export default function App() {
  const [tasks, setTasks] = useState([])
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
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

  const handleToggle = async (task) => {
    const updated = { completed: !task.completed }
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

  const handleAdd = async ({ title, description }) => {
    setShowModal(false)
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
          <div style={s.badge}>⚡ AI HACKATHON</div>
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

      {/* modal */}
      <AnimatePresence>
        {showModal && <AddModal onClose={() => setShowModal(false)} onAdd={handleAdd} />}
      </AnimatePresence>

      {/* toast */}
      <AnimatePresence>
        {toast && <Toast key={toast.message} message={toast.message} type={toast.type} />}
      </AnimatePresence>
    </div>
  )
}
