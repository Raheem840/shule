import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useStaffPhotoUrl } from '../../hooks/useStaffPhotoUrl'
import { supabase } from '../../lib/supabase'
import {
  useContacts, useMessages, useSendMessage, useMarkRead,
  useAnnouncements, usePostAnnouncement, useUploadAttachment,
  useSearchStudentsForMessaging, type StudentParentResult,
} from '../../hooks/useMessaging'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { ROLE_LABEL } from '../../config/roleNav'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { Contact } from '../../types/week9'
import type { Message, UserRole } from '../../types/app'

// ─── Palette ──────────────────────────────────────────────────────────────────
const COLORS = ['#0d9488','#6366f1','#0ea5e9','#f59e0b','#f43f5e','#10b981','#ec4899','#8b5cf6']
const DARKS  = ['#0f766e','#4f46e5','#0284c7','#d97706','#e11d48','#059669','#db2777','#7c3aed']
function colorFor(s: string): [string, string] {
  const i = ((s.charCodeAt(0) || 65) + (s.charCodeAt(1) || 65)) % COLORS.length
  return [COLORS[i], DARKS[i]]
}
function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0,2).map(w => w[0].toUpperCase()).join('')
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
}
function formatDay(iso: string): string {
  const d = new Date(iso), n = new Date()
  if (d.toDateString() === n.toDateString()) return 'Today'
  const y = new Date(n); y.setDate(n.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })
}

const CAN_POST = new Set(['principal','deputy','dos','secretary','bursar','it_admin'])

// ─── Theme-aware CSS variables ────────────────────────────────────────────────
// Light mode: clean white sidebar + warm feed
// Dark mode:  deep navy sidebar + dark feed
const STYLES = `
  /* ── Light mode variables (default) ── */
  .ar {
    --ms-cl-bg:         #ffffff;
    --ms-cl-border:     1px solid #e9edf0;
    --ms-cl-title:      #0f172a;
    --ms-cl-name:       #1e293b;
    --ms-cl-role:       #64748b;
    --ms-cl-sep:        rgba(0,0,0,.055);
    --ms-cl-row-hover:  rgba(13,148,136,.05);
    --ms-cl-row-active: rgba(13,148,136,.09);
    --ms-cl-section:    #94a3b8;
    --ms-cl-search-bg:  #f1f5f9;
    --ms-cl-search-bdr: 1px solid #e2e8f0;
    --ms-cl-search-txt: #1e293b;
    --ms-cl-search-ph:  #94a3b8;
    --ms-cl-unread-txt: #ffffff;
    --ms-ann-row-bg:    rgba(139,92,246,.07);

    --ms-hdr-bg:        #ffffff;
    --ms-hdr-shadow:    0 1px 8px rgba(0,0,0,.08);
    --ms-hdr-name:      #0f172a;
    --ms-hdr-role:      #64748b;
    --ms-hdr-btn-bg:    rgba(0,0,0,.06);
    --ms-hdr-btn-hover: rgba(0,0,0,.11);
    --ms-hdr-btn-clr:   #475569;
    --ms-hdr-cnt:       #475569;
    --ms-ann-sub:       #8b5cf6;

    --ms-feed-bg:       #efeae2;
    --ms-feed-pattern:  rgba(0,0,0,.025);

    --ms-them-bg:       #ffffff;
    --ms-them-clr:      #1e293b;
    --ms-them-shadow:   0 1px 6px rgba(0,0,0,.09);
    --ms-me-time:       rgba(255,255,255,.6);
    --ms-them-time:     #94a3b8;

    --ms-ibar-bg:       #f0f2f5;
    --ms-ibar-bdr:      1px solid #dce1e7;
    --ms-ifield-bg:     #ffffff;
    --ms-ifield-clr:    #1e293b;
    --ms-ifield-shadow: 0 1px 4px rgba(0,0,0,.1);
    --ms-iicon-clr:     #8696a0;

    --ms-pill-bg:       rgba(0,0,0,.11);
    --ms-pill-clr:      #5f6368;

    --ms-ann-feed-bg:   #f4f6f8;
    --ms-ann-bbl-bg:    #ffffff;
    --ms-ann-bbl-clr:   #1e293b;
    --ms-ann-shadow:    0 1px 6px rgba(0,0,0,.08);

    --ms-tpl-bg:        #ffffff;
    --ms-tpl-bdr:       1px solid #e9edf0;
    --ms-tpl-hover:     #f8fafc;
    --ms-tpl-title:     #0f172a;
    --ms-tpl-body:      #64748b;
    --ms-tpl-section:   #94a3b8;

    --ms-empty-txt1:    #475569;
    --ms-empty-txt2:    #94a3b8;
    --ms-empty-bg:      #f0f2f5;
    --ms-ring-clr:      rgba(13,148,136,.12);
    --ms-skeleton-op:   1;

    --ms-mob-container: #f5f6f7;
    --ms-chat-slide-bg: #efeae2;
  }

  /* ── Dark mode variables ── */
  .ar[data-theme=dark] {
    --ms-cl-bg:         #111827;
    --ms-cl-border:     1px solid rgba(255,255,255,.04);
    --ms-cl-title:      #f1f5f9;
    --ms-cl-name:       #e2e8f0;
    --ms-cl-role:       #475569;
    --ms-cl-sep:        rgba(255,255,255,.05);
    --ms-cl-row-hover:  rgba(255,255,255,.06);
    --ms-cl-row-active: rgba(255,255,255,.1);
    --ms-cl-section:    #334155;
    --ms-cl-search-bg:  rgba(255,255,255,.07);
    --ms-cl-search-bdr: 1px solid rgba(255,255,255,.09);
    --ms-cl-search-txt: #e2e8f0;
    --ms-cl-search-ph:  #475569;
    --ms-cl-unread-txt: #ffffff;
    --ms-ann-row-bg:    rgba(139,92,246,.15);

    --ms-hdr-bg:        #1a2535;
    --ms-hdr-shadow:    0 2px 16px rgba(0,0,0,.45);
    --ms-hdr-name:      #f1f5f9;
    --ms-hdr-role:      rgba(255,255,255,.38);
    --ms-hdr-btn-bg:    rgba(255,255,255,.08);
    --ms-hdr-btn-hover: rgba(255,255,255,.16);
    --ms-hdr-btn-clr:   rgba(255,255,255,.75);
    --ms-hdr-cnt:       rgba(255,255,255,.55);
    --ms-ann-sub:       rgba(167,139,250,.75);

    --ms-feed-bg:       #0d1623;
    --ms-feed-pattern:  rgba(255,255,255,.015);

    --ms-them-bg:       #1e2d3d;
    --ms-them-clr:      #e2e8f0;
    --ms-them-shadow:   0 1px 6px rgba(0,0,0,.3);
    --ms-me-time:       rgba(255,255,255,.5);
    --ms-them-time:     #64748b;

    --ms-ibar-bg:       #111827;
    --ms-ibar-bdr:      1px solid rgba(255,255,255,.06);
    --ms-ifield-bg:     #1e2d3d;
    --ms-ifield-clr:    #e2e8f0;
    --ms-ifield-shadow: 0 1px 4px rgba(0,0,0,.3);
    --ms-iicon-clr:     #475569;

    --ms-pill-bg:       rgba(255,255,255,.1);
    --ms-pill-clr:      #64748b;

    --ms-ann-feed-bg:   #0d1117;
    --ms-ann-bbl-bg:    #1e2d3d;
    --ms-ann-bbl-clr:   #e2e8f0;
    --ms-ann-shadow:    0 1px 6px rgba(0,0,0,.3);

    --ms-tpl-bg:        #1a2535;
    --ms-tpl-bdr:       1px solid rgba(255,255,255,.07);
    --ms-tpl-hover:     #1e2d3d;
    --ms-tpl-title:     #e2e8f0;
    --ms-tpl-body:      #64748b;
    --ms-tpl-section:   #334155;

    --ms-empty-txt1:    #64748b;
    --ms-empty-txt2:    #475569;
    --ms-empty-bg:      #0d1623;
    --ms-ring-clr:      rgba(13,148,136,.15);
    --ms-skeleton-op:   .25;

    --ms-mob-container: #111827;
    --ms-chat-slide-bg: #0d1623;
  }

  /* ── Components using variables ── */
  .chat-feed { overflow-y: auto; -webkit-overflow-scrolling: touch; scroll-behavior: smooth }

  .c-row {
    display: flex; align-items: center; gap: 14px;
    padding: 11px 18px; cursor: pointer; min-height: 72px;
    border-bottom: 1px solid var(--ms-cl-sep);
    transition: background .12s; -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  .c-row:hover  { background: var(--ms-cl-row-hover) }
  .c-row:active { background: var(--ms-cl-row-active) !important }

  .bbl-me {
    background: linear-gradient(150deg, #0ea5e9 0%, #0d9488 100%);
    color: #fff;
    border-radius: 18px 18px 3px 18px;
    box-shadow: 0 3px 16px rgba(13,148,136,.32);
    animation: bblMe .18s cubic-bezier(.2,.8,.4,1) both;
  }
  .bbl-them {
    background: var(--ms-them-bg);
    color: var(--ms-them-clr);
    border-radius: 18px 18px 18px 3px;
    box-shadow: var(--ms-them-shadow);
    animation: bblThem .18s cubic-bezier(.2,.8,.4,1) both;
  }

  .msg-bg {
    background-color: var(--ms-feed-bg);
    background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.022'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  }

  .input-bar {
    background: var(--ms-ibar-bg);
    border-top: var(--ms-ibar-bdr);
    padding: 10px 14px 14px;
    flex-shrink: 0;
  }
  .input-field {
    flex: 1; border-radius: 24px; padding: 10px 16px;
    font-size: 15px; line-height: 1.5; resize: none;
    border: none; outline: none;
    background: var(--ms-ifield-bg);
    color: var(--ms-ifield-clr);
    font-family: inherit; max-height: 130px;
    box-shadow: var(--ms-ifield-shadow);
  }

  .ann-bubble {
    padding: 11px 15px; border-radius: 3px 18px 18px 18px;
    background: var(--ms-ann-bbl-bg);
    color: var(--ms-ann-bbl-clr);
    box-shadow: var(--ms-ann-shadow);
    border-left: 3px solid #8b5cf6;
  }

  .send-btn {
    width: 44px; height: 44px; border-radius: 50%; border: none;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; flex-shrink: 0;
    transition: transform .16s, box-shadow .16s;
    -webkit-tap-highlight-color: transparent;
  }
  .send-btn:active { transform: scale(.9) }

  .date-pill {
    display: inline-flex; padding: 3px 14px; border-radius: 99px;
    background: var(--ms-pill-bg); font-size: 11px; font-weight: 700;
    color: var(--ms-pill-clr); letter-spacing: .5px;
  }

  @keyframes onlinePulse { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.5)} 50%{box-shadow:0 0 0 5px rgba(34,197,94,0)} }
  @keyframes bblMe       { from{opacity:0;transform:translateX(14px)} to{opacity:1;transform:none} }
  @keyframes bblThem     { from{opacity:0;transform:translateX(-14px)} to{opacity:1;transform:none} }
  @keyframes annIn       { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
  @keyframes spinRing    { to{transform:rotate(360deg)} }
  @keyframes fadeUp      { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }

  .chat-feed::-webkit-scrollbar       { width: 4px }
  .chat-feed::-webkit-scrollbar-track { background: transparent }
  .chat-feed::-webkit-scrollbar-thumb { background: rgba(0,0,0,.15); border-radius: 4px }
`

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, photoUrl, size = 46, online = false }: {
  name: string; photoUrl?: string | null; size?: number; online?: boolean
}) {
  const src = useStaffPhotoUrl(photoUrl ?? null)
  const [c1, c2] = colorFor(name)
  const fs = Math.round(size * .36)
  return (
    <div style={{ position:'relative', width:size, height:size, flexShrink:0 }}>
      <div style={{
        width:size, height:size, borderRadius:'50%', overflow:'hidden', flexShrink:0,
        background: src ? 'transparent' : `linear-gradient(145deg,${c1},${c2})`,
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:fs, fontWeight:800, color:'#fff', fontFamily:'var(--font2)',
        userSelect:'none',
        boxShadow: src ? 'none' : `0 2px 12px ${c1}55`,
      }}>
        {src ? <img src={src} alt={name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : initials(name)}
      </div>
      {online && (
        <div style={{
          position:'absolute', bottom:0, right:0,
          width:Math.round(size*.28), height:Math.round(size*.28),
          borderRadius:'50%', background:'#22c55e',
          border:`2.5px solid var(--ms-cl-bg)`,
          animation:'onlinePulse 2s ease infinite',
        }}/>
      )}
    </div>
  )
}

// ─── InputBar ─────────────────────────────────────────────────────────────────
function InputBar({ onSend, sending, accent = '#0d9488', placeholder = 'Message…', showTemplates, onToggleTemplates, onFileClick, attach, onClearAttach }: {
  onSend: (text: string, attachUrl: string | null) => void
  sending: boolean
  accent?: string
  placeholder?: string
  showTemplates?: boolean
  onToggleTemplates?: () => void
  onFileClick?: () => void
  attach?: string | null
  onClearAttach?: () => void
}) {
  const [text, setText] = useState('')
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const canSend = !!(text.trim() || attach)

  // Auto-resize textarea
  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 130) + 'px'
  }, [text])

  function send(e?: React.FormEvent) {
    e?.preventDefault()
    if (!canSend || sending) return
    onSend(text.trim(), attach ?? null)
    setText('')
    if (onClearAttach) onClearAttach()
  }

  return (
    <div className="input-bar">
      {attach && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, padding:'6px 12px', borderRadius:12, background:'rgba(13,148,136,.1)', border:'.5px solid rgba(13,148,136,.25)', width:'fit-content' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.4"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
          <span style={{ fontSize:12.5, fontWeight:600, color:'var(--brand)' }}>File attached</span>
          <button onClick={onClearAttach} style={{ border:'none', background:'none', cursor:'pointer', color:'var(--danger)', fontSize:18, lineHeight:1, padding:'0 0 0 4px' }}>×</button>
        </div>
      )}
      <form onSubmit={send} style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
        {/* Side actions */}
        {onFileClick && (
          <button type="button" onClick={onFileClick}
            style={{ width:44, height:44, borderRadius:'50%', border:'none', background:'transparent', color:'var(--ms-iicon-clr)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'color .14s' }}
            onMouseEnter={e => (e.currentTarget.style.color = accent)}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ms-iicon-clr)')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
          </button>
        )}
        {onToggleTemplates && (
          <button type="button" onClick={onToggleTemplates}
            style={{ width:44, height:44, borderRadius:'50%', border:'none', background:'transparent', color: showTemplates ? accent : 'var(--ms-iicon-clr)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'color .14s' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </button>
        )}
        {/* Textarea */}
        <textarea
          ref={areaRef}
          className="input-field"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={placeholder}
          rows={1}
        />
        {/* Send */}
        <button type="submit" disabled={!canSend || sending} className="send-btn"
          style={{
            background: canSend ? `linear-gradient(145deg,${accent},${DARKS[COLORS.indexOf(accent)] ?? '#0f766e'})` : 'var(--surface2)',
            boxShadow: canSend ? `0 4px 16px ${accent}55` : 'none',
          }}>
          {sending
            ? <svg style={{ animation:'spinRing .7s linear infinite' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeOpacity=".3"/><path d="M12 2a10 10 0 010 20"/></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><polygon points="2,21 23,12 2,3 2,10 17,12 2,14"/></svg>
          }
        </button>
      </form>
    </div>
  )
}

// ─── Templates drawer ─────────────────────────────────────────────────────────
const TEMPLATES = [
  { label:'Exam reminder',  body:'Dear [Name], the [Subject] exam is scheduled for [Date] at [Time]. Ensure [Class] is fully prepared.' },
  { label:'Class teacher',  body:'Dear [Name], you are assigned as class teacher for [Class] effective [Date]. Collect the register from the secretary.' },
  { label:'End of term',    body:'Dear [Name], Term [Number] ends on [Date]. Report cards release on [Release Date]. Remarks due by [Deadline].' },
]

function highlight(text: string) {
  return text.split(/(\[[^\]]+\])/g).map((p, i) =>
    /^\[.+\]$/.test(p)
      ? <mark key={i} style={{ background:'rgba(245,158,11,.15)', color:'#d97706', padding:'1px 4px', borderRadius:3, fontWeight:700 }}>{p}</mark>
      : <span key={i}>{p}</span>
  )
}

function TemplatesDrawer({ onSelect }: { onSelect: (body: string) => void }) {
  return (
    <div style={{ background:'var(--ms-tpl-bg)', borderTop:'var(--ms-tpl-bdr)', maxHeight:200, overflowY:'auto' }}>
      <div style={{ padding:'8px 18px 4px', fontSize:10, fontWeight:700, color:'var(--ms-tpl-section)', textTransform:'uppercase', letterSpacing:1.1 }}>Templates</div>
      {TEMPLATES.map((t, i) => (
        <button key={i} type="button" onClick={() => onSelect(t.body)}
          style={{ display:'block', width:'100%', textAlign:'left', padding:'10px 18px', border:'none', background:'none', cursor:'pointer', borderBottom: i < TEMPLATES.length - 1 ? 'var(--ms-tpl-bdr)' : 'none', transition:'background .1s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--ms-tpl-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
          <div style={{ fontWeight:700, fontSize:13, color:'var(--ms-tpl-title)', marginBottom:2 }}>{t.label}</div>
          <div style={{ fontSize:12, color:'var(--ms-tpl-body)', lineHeight:1.5 }}>{highlight(t.body)}</div>
        </button>
      ))}
    </div>
  )
}

// ─── Message feed / thread ────────────────────────────────────────────────────
function Thread({ contact, onBack }: { contact: Contact; onBack?: () => void }) {
  const { user } = useAuth()
  const { data: msgs = [] }    = useMessages(contact.id)
  const { mutate: markRead }   = useMarkRead()
  const { mutateAsync: send, isPending } = useSendMessage()
  const { mutateAsync: upload } = useUploadAttachment()
  const { error: toastErr } = useToast()
  const [showTpl, setShowTpl]   = useState(false)
  const [attach, setAttach]     = useState<string | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const isDos = user?.role === 'dos'
  const roleLabel = ROLE_LABEL[contact.role as UserRole] ?? contact.role.replace(/_/g, ' ')
  const [c1] = colorFor(contact.name)

  // Mark read when thread opens
  useEffect(() => { if (contact.unreadCount > 0) markRead(contact.id) }, [contact.id])

  // Scroll to bottom on new messages
  useLayoutEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs.length])

  async function handleSend(text: string, attachUrl: string | null) {
    try { await send({ toUserId: contact.id, body: text, attachmentUrl: attachUrl }) }
    catch (e: any) { toastErr(e.message ?? 'Failed to send') }
    setAttach(null)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    try { setAttach(await upload(f)) }
    catch (e: any) { toastErr(e.message ?? 'Upload failed') }
  }

  // Group messages by day
  const groups: { day: string; items: Message[] }[] = []
  for (const m of msgs) {
    const d = formatDay(m.sentAt)
    const last = groups.at(-1)
    if (!last || last.day !== d) groups.push({ day: d, items: [m] })
    else last.items.push(m)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Header */}
      <div style={{ background:'var(--ms-hdr-bg)', flexShrink:0, padding:'0 14px', display:'flex', alignItems:'center', gap:13, height:62, boxShadow:'var(--ms-hdr-shadow)' }}>
        {onBack && (
          <button onClick={onBack}
            style={{ width:38, height:38, borderRadius:12, border:'none', background:'var(--ms-hdr-btn-bg)', color:'var(--ms-hdr-btn-clr)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'background .13s', WebkitTapHighlightColor:'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--ms-hdr-btn-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--ms-hdr-btn-bg)')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        )}
        <Avatar name={contact.name} photoUrl={contact.photoUrl} size={40} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:800, fontSize:16, color:'var(--ms-hdr-name)', letterSpacing:-.3, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{contact.name}</div>
          <div style={{ fontSize:12, color:'var(--ms-hdr-role)', marginTop:1, textTransform:'capitalize' }}>{roleLabel}</div>
        </div>
      </div>

      {/* Feed */}
      <div ref={feedRef} className="chat-feed msg-bg" style={{ flex:1, padding:'12px 14px', display:'flex', flexDirection:'column', gap:0 }}>
        {msgs.length === 0 ? (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:18, animation:'fadeUp .3s ease both' }}>
            <div style={{ width:84, height:84, borderRadius:'50%', background:`linear-gradient(145deg,${c1}22,${c1}0a)`, border:`2px solid ${c1}2a`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Avatar name={contact.name} photoUrl={contact.photoUrl} size={62} />
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:16, fontWeight:800, color:'var(--ms-empty-txt1)', fontFamily:'var(--font2)', marginBottom:4 }}>{contact.name}</div>
              <div style={{ fontSize:13.5, color:'var(--ms-empty-txt2)' }}>No messages yet</div>
            </div>
          </div>
        ) : (
          groups.map(({ day, items }) => (
            <div key={day}>
              <div style={{ display:'flex', justifyContent:'center', margin:'14px 0 10px' }}>
                <span className="date-pill">{day}</span>
              </div>
              {items.map((m, idx) => {
                const mine = m.fromUserId === user?.id
                return (
                  <div key={m.id} style={{ display:'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom:3, paddingLeft: mine ? 60 : 0, paddingRight: mine ? 0 : 60, animationDelay:`${Math.min(idx * .02, .15)}s` }}>
                    <div className={mine ? 'bbl-me' : 'bbl-them'} style={{ padding:'8px 12px 6px', maxWidth:'100%', position:'relative' }}>
                      {m.attachmentUrl && (
                        <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer"
                          style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, color: mine ? 'rgba(255,255,255,.9)' : '#0d9488', fontSize:12.5, fontWeight:600, textDecoration:'none', padding:'4px 10px', borderRadius:8, background: mine ? 'rgba(255,255,255,.18)' : 'rgba(13,148,136,.08)' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                          Attachment
                        </a>
                      )}
                      <p style={{ margin:0, fontSize:15, lineHeight:1.55, wordBreak:'break-word' }}>{m.body}</p>
                      <div style={{ display:'flex', justifyContent:'flex-end', alignItems:'center', gap:4, marginTop:4 }}>
                        <span style={{ fontSize:11, color: mine ? 'var(--ms-me-time)' : 'var(--ms-them-time)' }}>{formatTime(m.sentAt)}</span>
                        {mine && (
                          <svg width="16" height="10" viewBox="0 0 22 13" fill="none">
                            {m.readAt
                              ? <><path d="M1 7l4 4L14 2" stroke="rgba(255,255,255,.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 7l4 4L21 2" stroke="rgba(255,255,255,.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>
                              : <path d="M1 7l4 4L15 2" stroke="rgba(255,255,255,.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            }
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      {isDos && showTpl && (
        <TemplatesDrawer onSelect={body => { setShowTpl(false); handleSend(body, null) }} />
      )}

      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls" style={{ display:'none' }} onChange={e => { void handleFile(e) }} />
      <InputBar
        onSend={handleSend} sending={isPending}
        attach={attach} onClearAttach={() => setAttach(null)}
        onFileClick={() => fileRef.current?.click()}
        showTemplates={showTpl}
        onToggleTemplates={isDos ? () => setShowTpl(v => !v) : undefined}
        placeholder="Message…"
      />
    </div>
  )
}

// ─── Announcements ────────────────────────────────────────────────────────────
function AnnouncementsView({ onBack }: { onBack?: () => void }) {
  const { user } = useAuth()
  const { data: anns = [] }   = useAnnouncements()
  const { mutateAsync: post, isPending } = usePostAnnouncement()
  const { error: toastErr } = useToast()
  const feedRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [attach, setAttach] = useState<string | null>(null)
  const canPost = user && CAN_POST.has(user.role)

  useLayoutEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [anns.length])

  async function handlePost(text: string) {
    try {
      await post({ body: text })
      void supabase.functions.invoke('broadcast-announcement', { body: { body: text, role: user?.role, school_id: user?.schoolId } })
    } catch (e: any) { toastErr(e.message) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Header */}
      <div style={{ background:'var(--ms-hdr-bg)', flexShrink:0, padding:'0 14px', display:'flex', alignItems:'center', gap:13, height:62, boxShadow:'var(--ms-hdr-shadow)' }}>
        {onBack && (
          <button onClick={onBack}
            style={{ width:38, height:38, borderRadius:12, border:'none', background:'var(--ms-hdr-btn-bg)', color:'var(--ms-hdr-btn-clr)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, WebkitTapHighlightColor:'transparent', transition:'background .13s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--ms-hdr-btn-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--ms-hdr-btn-bg)')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        )}
        <div style={{ width:40, height:40, borderRadius:'50%', background:'linear-gradient(145deg,#8b5cf6,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:'0 3px 14px rgba(139,92,246,.55)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:800, fontSize:16, color:'var(--ms-hdr-name)', letterSpacing:-.3 }}>Announcements</div>
          <div style={{ fontSize:12, color:'var(--ms-ann-sub)', marginTop:1 }}>Broadcast to all staff</div>
        </div>
        <span style={{ padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:800, background:'rgba(139,92,246,.18)', color:'#a78bfa', border:'.5px solid rgba(139,92,246,.28)', flexShrink:0 }}>{anns.length}</span>
      </div>

      {/* Feed */}
      <div ref={feedRef} className="chat-feed" style={{ flex:1, padding:'14px 16px', background:'var(--ms-ann-feed-bg)', display:'flex', flexDirection:'column', gap:16 }}>
        {anns.length === 0 && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:18, animation:'fadeUp .3s ease both' }}>
            <div style={{ width:72, height:72, borderRadius:24, background:'rgba(139,92,246,.1)', border:'1px solid rgba(139,92,246,.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.7"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            </div>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:16, fontWeight:800, color:'var(--ms-empty-txt1)', marginBottom:4 }}>No announcements yet</div>
              <div style={{ fontSize:13.5, color:'var(--ms-empty-txt2)' }}>{canPost ? 'Post the first broadcast below.' : 'School-wide broadcasts appear here.'}</div>
            </div>
          </div>
        )}
        {[...anns].reverse().map((a, i) => {
          const [c1] = colorFor(a.fromName)
          return (
            <div key={a.id} style={{ display:'flex', gap:12, animation:'annIn .22s ease both', animationDelay:`${Math.min(i * .04, .3)}s` }}>
              <div style={{ width:40, height:40, borderRadius:'50%', background:`linear-gradient(145deg,${c1},#7c3aed)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:'#fff', flexShrink:0, boxShadow:`0 3px 12px ${c1}44` }}>
                {initials(a.fromName)}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:9, marginBottom:5 }}>
                  <span style={{ fontSize:13.5, fontWeight:800, color:'var(--ms-hdr-name)' }}>{a.fromName}</span>
                  <span style={{ fontSize:11, color:'var(--ms-empty-txt2)' }}>{new Date(a.postedAt).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                </div>
                <div className="ann-bubble">
                  <p style={{ margin:0, fontSize:14.5, lineHeight:1.65 }}>{a.body}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {canPost && (
        <>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:'none' }} />
          <InputBar
            onSend={handlePost} sending={isPending}
            attach={attach} onClearAttach={() => setAttach(null)}
            onFileClick={() => fileRef.current?.click()}
            accent="#8b5cf6"
            placeholder="Broadcast to all staff…"
          />
        </>
      )}
    </div>
  )
}

// ─── Contact list ─────────────────────────────────────────────────────────────
function ContactList({ contacts, loading, totalUnread, onSelect, activeId }: {
  contacts: Contact[]
  loading: boolean
  totalUnread: number
  onSelect: (c: Contact | 'announcements') => void
  activeId: string | 'announcements' | null
}) {
  const [q, setQ] = useState('')
  const [composing, setComposing] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')

  // Debounce the parent/student search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQ), 300)
    return () => clearTimeout(t)
  }, [searchQ])

  const { data: searchResults = [], isFetching: searching } = useSearchStudentsForMessaging(debouncedQ)

  const filtered = q.trim()
    ? contacts.filter(c => c.name.toLowerCase().includes(q.toLowerCase()) || c.role.includes(q.toLowerCase()))
    : contacts

  // Search results represent a parent — build the same Contact shape the
  // rest of this page already works with (useMessages/useSendMessage are
  // keyed only by auth_user_id, so a parent's works identically to staff's).
  function startConversationWithParent(r: StudentParentResult) {
    setComposing(false)
    setSearchQ('')
    onSelect({
      id:          r.parentAuthUserId,
      staffId:     '',
      name:        r.parentName,
      role:        'parent',
      photoUrl:    null,
      unreadCount: 0,
    })
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--ms-cl-bg)', borderRight:'var(--ms-cl-border)' }}>
      {/* Title bar */}
      <div style={{ padding:'18px 18px 14px', flexShrink:0, borderBottom:'var(--ms-cl-border)' }}>
        <div style={{ display:'flex', alignItems:'center', marginBottom:14 }}>
          <span style={{ flex:1, fontSize:24, fontWeight:900, color:'var(--ms-cl-title)', fontFamily:'var(--font2)', letterSpacing:-.6 }}>Messages</span>
          {totalUnread > 0 && !composing && (
            <div style={{ background:'linear-gradient(135deg,#0d9488,#0ea5e9)', color:'#fff', borderRadius:99, fontSize:12, fontWeight:800, padding:'2px 10px', boxShadow:'0 3px 12px rgba(13,148,136,.5)', marginRight:8 }}>
              {totalUnread > 99 ? '99+' : totalUnread}
            </div>
          )}
          <button
            onClick={() => { setComposing(v => !v); setSearchQ('') }}
            title={composing ? 'Cancel' : 'Message a parent or student'}
            style={{ width:36, height:36, borderRadius:10, border:'none', background: composing ? 'rgba(13,148,136,.15)' : 'var(--ms-cl-search-bg)', color: composing ? '#0d9488' : 'var(--ms-cl-role)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all .14s', flexShrink:0 }}
          >
            {composing
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            }
          </button>
        </div>
        {composing ? (
          <div style={{ position:'relative' }}>
            <svg style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ms-cl-search-ph)" strokeWidth="2.4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              autoFocus
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="Search student name to find their parent…"
              style={{ width:'100%', paddingLeft:36, height:40, borderRadius:12, background:'var(--ms-cl-search-bg)', border:'1.5px solid #0d9488', fontSize:14, color:'var(--ms-cl-search-txt)', outline:'none', fontFamily:'inherit', boxSizing:'border-box' as const }}
            />
            {searching && (
              <svg style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', animation:'spinRing .7s linear infinite' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ms-cl-search-ph)" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 010 20"/></svg>
            )}
          </div>
        ) : (
          <div style={{ position:'relative' }}>
            <svg style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ms-cl-search-ph)" strokeWidth="2.4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search staff…"
              style={{ width:'100%', paddingLeft:36, height:40, borderRadius:12, background:'var(--ms-cl-search-bg)', border:'var(--ms-cl-search-bdr)', fontSize:14, color:'var(--ms-cl-search-txt)', outline:'none', fontFamily:'inherit', boxSizing:'border-box' as const }}
            />
          </div>
        )}
      </div>

      {composing ? (
        /* Parent/student search results */
        <div style={{ flex:1, overflowY:'auto' }}>
          {!debouncedQ.trim() && (
            <div style={{ padding:'32px 18px', textAlign:'center' }}>
              <div style={{ width:52, height:52, borderRadius:16, background:'rgba(13,148,136,.08)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <div style={{ fontSize:13.5, fontWeight:700, color:'var(--ms-cl-name)', marginBottom:4 }}>Find a student</div>
              <div style={{ fontSize:12.5, color:'var(--ms-cl-role)', lineHeight:1.6 }}>Type a student's name to find their parent and start a conversation</div>
            </div>
          )}
          {debouncedQ.trim() && !searching && searchResults.length === 0 && (
            <div style={{ padding:'28px 18px', textAlign:'center', color:'var(--ms-cl-role)', fontSize:13.5 }}>
              No parents found for "{debouncedQ}".
              <div style={{ fontSize:12, marginTop:6 }}>The parent may not have an active account yet.</div>
            </div>
          )}
          {searchResults.map(r => {
            const [col] = colorFor(r.parentName)
            return (
              <div key={r.parentAuthUserId} onClick={() => startConversationWithParent(r)} className="c-row">
                <Avatar name={r.parentName} photoUrl={null} size={52} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:15.5, color:'var(--ms-cl-name)', marginBottom:1 }}>{r.parentName}</div>
                  <div style={{ fontSize:12, color:'var(--ms-cl-role)', marginBottom:1 }}>Parent of {r.studentNames.join(', ')}</div>
                  <div style={{ fontSize:11.5, color:'#0d9488', fontFamily:'var(--font3)' }}>{r.admissionNumbers.join(', ')}</div>
                </div>
                <div style={{ width:32, height:32, borderRadius:'50%', background:`${col}14`, border:`1px solid ${col}28`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
      <>
      {/* Announcements pinned */}
      <div onClick={() => onSelect('announcements')} className="c-row"
        style={{ background: activeId === 'announcements' ? 'var(--ms-ann-row-bg)' : undefined, borderLeft:`3.5px solid ${activeId === 'announcements' ? '#8b5cf6' : 'transparent'}` }}>
        <div style={{ width:52, height:52, borderRadius:'50%', background: activeId === 'announcements' ? 'linear-gradient(145deg,#8b5cf6,#7c3aed)' : 'rgba(139,92,246,.18)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow: activeId === 'announcements' ? '0 4px 16px rgba(139,92,246,.5)' : 'none', transition:'all .2s' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={activeId === 'announcements' ? '#fff' : '#a78bfa'} strokeWidth="2.1"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:15.5, color: activeId === 'announcements' ? '#a78bfa' : 'var(--ms-cl-name)' }}>Announcements</div>
          <div style={{ fontSize:12.5, color:'var(--ms-cl-role)', marginTop:2 }}>Broadcast to all staff</div>
        </div>
      </div>

      {/* Section label */}
      <div style={{ padding:'10px 18px 5px', fontSize:10, fontWeight:700, color:'var(--ms-cl-section)', textTransform:'uppercase', letterSpacing:1.2, flexShrink:0 }}>
        Staff ({filtered.length})
      </div>

      {/* Scrollable contacts */}
      <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch' } as React.CSSProperties}>
        {loading && Array.from({ length:5 }).map((_, i) => (
          <div key={i} style={{ display:'flex', gap:14, alignItems:'center', padding:'12px 18px', minHeight:72 }}>
            <div className="shule-skeleton" style={{ width:52, height:52, borderRadius:'50%', flexShrink:0, opacity:'var(--ms-skeleton-op)' as any }} />
            <div style={{ flex:1 }}>
              <div className="shule-skeleton" style={{ height:13, borderRadius:6, marginBottom:7, width:'50%', opacity:'var(--ms-skeleton-op)' as any }} />
              <div className="shule-skeleton" style={{ height:10, borderRadius:5, width:'32%', opacity:'var(--ms-skeleton-op)' as any }} />
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <div style={{ padding:'28px 18px', textAlign:'center', color:'var(--ms-cl-role)', fontSize:13.5 }}>
            {q ? 'No contacts match.' : 'No staff to message.'}
          </div>
        )}

        {filtered.map(c => {
          const isActive = activeId !== 'announcements' && activeId === c.id
          const [col] = colorFor(c.name)
          const role = ROLE_LABEL[c.role as UserRole] ?? c.role.replace(/_/g,' ')
          return (
            <div key={c.id} onClick={() => onSelect(c)} className="c-row"
              style={{ background: isActive ? `${col}18` : undefined, borderLeft:`3.5px solid ${isActive ? col : 'transparent'}` }}>
              <Avatar name={c.name} photoUrl={c.photoUrl} size={52} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:15.5, color: isActive ? col : 'var(--ms-cl-name)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', letterSpacing:-.1 }}>{c.name}</div>
                <div style={{ fontSize:12.5, color:'var(--ms-cl-role)', marginTop:2, textTransform:'capitalize' }}>{role}</div>
              </div>
              {c.unreadCount > 0 && (
                <div style={{ background:`linear-gradient(145deg,${col},${DARKS[COLORS.indexOf(col)] ?? col})`, color:'#fff', borderRadius:99, fontSize:12, fontWeight:800, minWidth:22, height:22, padding:'0 6px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, boxShadow:`0 2px 10px ${col}55` }}>
                  {c.unreadCount > 9 ? '9+' : c.unreadCount}
                </div>
              )}
            </div>
          )
        })}
      </div>
      </>
      )}
    </div>
  )
}

// ─── Empty chat area (desktop) ────────────────────────────────────────────────
function EmptyChat({ contacts, onSelect }: { contacts: Contact[]; onSelect: (c: Contact) => void }) {
  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:28, padding:32, background:'var(--ms-empty-bg)' }}>
      <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {[130, 100, 76].map((sz, i) => (
          <div key={i} style={{ position:'absolute', width:sz, height:sz, borderRadius:'50%', border:`1.5px solid var(--ms-ring-clr)`, animation:`spinRing ${14+i*4}s linear infinite`, animationDirection: i%2===0?'normal':'reverse' }}/>
        ))}
        <div style={{ width:72, height:72, borderRadius:24, background:'rgba(13,148,136,.1)', display:'flex', alignItems:'center', justifyContent:'center', border:'1.5px solid rgba(13,148,136,.2)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.6"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        </div>
      </div>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:21, fontWeight:900, color:'var(--ms-empty-txt1)', fontFamily:'var(--font2)', letterSpacing:-.5, marginBottom:8 }}>Select a conversation</div>
        <div style={{ fontSize:14, color:'var(--ms-empty-txt2)', lineHeight:1.85, maxWidth:340 }}>
          Pick a contact for a direct message<br/>or open <strong style={{ color:'#8b5cf6' }}>Announcements</strong> to broadcast to all staff.
        </div>
      </div>
      {contacts.length > 0 && (
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center', maxWidth:280 }}>
          {contacts.slice(0,6).map(c => {
            const [c1, c2] = colorFor(c.name)
            return (
              <button key={c.id} title={c.name} onClick={() => onSelect(c)}
                style={{ width:50, height:50, borderRadius:'50%', border:'none', cursor:'pointer', background:`linear-gradient(145deg,${c1},${c2})`, color:'#fff', fontSize:13, fontWeight:900, fontFamily:'var(--font2)', boxShadow:`0 4px 16px ${c1}44`, transition:'transform .2s cubic-bezier(.34,1.56,.64,1)', WebkitTapHighlightColor:'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.2) translateY(-3px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
                {initials(c.name)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function MessagingPage() {
  const { data: contacts = [], isLoading } = useContacts()
  const [active, setActive] = useState<Contact | 'announcements' | null>(null)
  const isMobile = useIsMobile()

  const totalUnread = contacts.reduce((s, c) => s + c.unreadCount, 0)
  const activeId: string | 'announcements' | null = active === 'announcements' ? 'announcements' : active ? (active as Contact).id : null
  const arEl = useMemo(() => document.querySelector('.ar') as HTMLElement ?? document.body, [])

  // Desktop: remove .page padding so panel fills edge-to-edge
  useEffect(() => {
    if (isMobile) return
    const p = document.querySelector('.shell-main > .page') as HTMLElement | null
    if (!p) return
    p.style.cssText = 'padding:0!important;height:100%;display:flex;flex-direction:column;'
    return () => { p.style.cssText = '' }
  }, [isMobile])

  // ── MOBILE ────────────────────────────────────────────────────────────────
  if (isMobile) {
    return createPortal(
      <>
        <style>{STYLES}</style>
        <div style={{
          position:'fixed',
          top:`calc(56px + env(safe-area-inset-top, 0px))`,
          left:0, right:0,
          bottom:`calc(64px + env(safe-area-inset-bottom, 0px))`,
          zIndex:36, overflow:'hidden', background:'var(--ms-cl-bg)',
        }}>
          {/* Contacts — stays underneath */}
          <div style={{ position:'absolute', inset:0 }}>
            <ContactList contacts={contacts} loading={isLoading} totalUnread={totalUnread} onSelect={setActive} activeId={activeId} />
          </div>

          {/* Chat / Announcements — slides over from right */}
          <div style={{
            position:'absolute', inset:0, background:'var(--ms-feed-bg)',
            transform: active !== null ? 'translateX(0)' : 'translateX(100%)',
            transition: active !== null
              ? 'transform .28s cubic-bezier(.32,.72,0,1)'
              : 'transform .24s cubic-bezier(.4,0,.6,1)',
            willChange:'transform',
            boxShadow: active !== null ? '-10px 0 40px rgba(0,0,0,.35)' : 'none',
          }}>
            {active === 'announcements'
              ? <AnnouncementsView onBack={() => setActive(null)} />
              : active
                ? <Thread contact={active as Contact} onBack={() => setActive(null)} />
                : null
            }
          </div>
        </div>
      </>,
      arEl
    )
  }

  // ── DESKTOP ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{STYLES}</style>
      <div style={{
        display:'flex', flex:1, minHeight:440,
        borderRadius:18, overflow:'hidden',
        boxShadow:'0 8px 40px rgba(0,0,0,.14)',
        border:'1px solid rgba(0,0,0,.1)',
      }}>
        {/* Dark contact sidebar */}
        <div style={{ width:300, flexShrink:0, display:'flex', flexDirection:'column', borderRight:'1px solid rgba(255,255,255,.05)' }}>
          <ContactList contacts={contacts} loading={isLoading} totalUnread={totalUnread} onSelect={setActive} activeId={activeId} />
        </div>

        {/* Chat area */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>
          {active === null
            ? <EmptyChat contacts={contacts} onSelect={setActive} />
            : active === 'announcements'
              ? <AnnouncementsView />
              : <Thread contact={active as Contact} />
          }
        </div>
      </div>
    </>
  )
}
