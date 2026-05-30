import { useState, useRef, useEffect } from 'react'
import { useStaffPhotoUrl } from '../../hooks/useStaffPhotoUrl'
import { useBandwidth } from '../../store/BandwidthContext'
import { supabase } from '../../lib/supabase'
import {
  useContacts, useMessages, useSendMessage, useMarkRead,
  useAnnouncements, usePostAnnouncement, useUploadAttachment,
} from '../../hooks/useMessaging'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { ROLE_LABEL } from '../../config/roleNav'
import type { Contact, Announcement } from '../../types/week9'
import type { Message, UserRole } from '../../types/app'

// ─── Constants ─────────────────────────────────────────────────────────────────
const CAN_POST_ROLES = ['principal', 'deputy', 'dos', 'secretary', 'bursar', 'it_admin'] as const

const PALETTE: [string, string][] = [
  ['#0d9488', '#0f766e'],
  ['#8b5cf6', '#7c3aed'],
  ['#0ea5e9', '#0284c7'],
  ['#f59e0b', '#d97706'],
  ['#f43f5e', '#e11d48'],
  ['#10b981', '#059669'],
]
function pal(name: string) {
  const i = ((name.charCodeAt(0) ?? 65) + (name.charCodeAt(1) ?? 65)) % PALETTE.length
  return PALETTE[i]
}
function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

const DOS_TEMPLATES = [
  { label: 'Exam schedule reminder',   body: 'Dear [Name], please note that [Subject] exam is scheduled for [Date] at [Time]. Ensure all [Class] students are prepared and present.' },
  { label: 'Class teacher assignment', body: "Dear [Name], you have been assigned as class teacher for [Class] effective [Date]. Please collect the register from the secretary's office." },
  { label: 'End of term notice',       body: 'Dear [Name], Term [Number] ends on [Date]. Report cards will be distributed on [Release Date]. Ensure all remarks are complete by [Deadline].' },
] as const

const REACTIONS = ['👍', '❤️', '😂', '😮', '🙏', '👏']

// ─── Global styles injected once ───────────────────────────────────────────────
const MSG_CSS = `
  /* ── Shell wrapper — the colourful backdrop the glass blurs through ── */
  .msg-shell {
    position: relative; overflow: hidden;
    background: linear-gradient(145deg,
      rgba(13,148,136,0.10) 0%,
      rgba(139,92,246,0.07) 40%,
      rgba(14,165,233,0.06) 70%,
      rgba(245,158,11,0.05) 100%
    );
  }
  [data-theme="dark"] .msg-shell {
    background: linear-gradient(145deg,
      rgba(13,148,136,0.18) 0%,
      rgba(139,92,246,0.12) 40%,
      rgba(7,13,26,1) 100%
    );
  }

  /* ── Ambient orbs (give glass something vivid to blur through) ── */
  .msg-orb {
    position: absolute; border-radius: 50%;
    pointer-events: none; filter: blur(80px);
  }

  /* ── Sidebar — solid surface so it's always visible ── */
  .msg-sidebar {
    background: var(--surface) !important;
    border-right: 1px solid var(--border) !important;
    box-shadow: 2px 0 16px rgba(0,0,0,0.04);
  }
  [data-theme="dark"] .msg-sidebar {
    background: #0f172a !important;
    border-right: 1px solid rgba(255,255,255,0.07) !important;
  }

  /* ── Right panel — slightly tinted to contrast with the shell gradient ── */
  .msg-panel {
    background: var(--bg) !important;
  }
  [data-theme="dark"] .msg-panel {
    background: #070d1a !important;
  }

  /* ── Chat headers and input bars — solid, always readable ── */
  .msg-topbar {
    background: var(--surface) !important;
    border-bottom: 1px solid var(--border) !important;
    box-shadow: 0 1px 8px rgba(0,0,0,0.04);
  }
  [data-theme="dark"] .msg-topbar {
    background: #0f172a !important;
    border-bottom: 1px solid rgba(255,255,255,0.06) !important;
  }
  .msg-inputbar {
    background: var(--surface) !important;
    border-top: 1px solid var(--border) !important;
    box-shadow: 0 -1px 8px rgba(0,0,0,0.03);
  }
  [data-theme="dark"] .msg-inputbar {
    background: #0f172a !important;
    border-top: 1px solid rgba(255,255,255,0.06) !important;
  }

  /* ── Contact rows ── */
  .msg-crow { transition: all 0.13s ease; cursor: pointer; }
  .msg-crow:hover { background: rgba(13,148,136,0.055) !important; }
  [data-theme="dark"] .msg-crow:hover { background: rgba(255,255,255,0.04) !important; }
  .msg-crow-active { background: rgba(13,148,136,0.08) !important; }
  [data-theme="dark"] .msg-crow-active { background: rgba(13,148,136,0.14) !important; }

  /* ── Bubbles ── */
  .msg-bubble-mine   { animation: msgBubbleRight 0.24s cubic-bezier(0.34,1.56,0.64,1) both; }
  .msg-bubble-theirs { animation: msgBubbleLeft  0.24s cubic-bezier(0.34,1.56,0.64,1) both; }

  /* ── Reactions row (visible on bubble hover) ── */
  .msg-bubble-wrap { position: relative; }
  .msg-bubble-wrap:hover .msg-rxn { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
  .msg-rxn {
    opacity: 0; transform: translateY(6px) scale(0.88);
    transition: all 0.18s cubic-bezier(0.34,1.56,0.64,1);
    pointer-events: none;
  }
  .msg-rxn-btn { transition: transform 0.15s ease; }
  .msg-rxn-btn:hover { transform: scale(1.3) !important; }

  /* ── Typing dots ── */
  .msg-dot { animation: msgDot 1.4s ease infinite; }
  .msg-dot:nth-child(2) { animation-delay: 0.18s; }
  .msg-dot:nth-child(3) { animation-delay: 0.36s; }

  /* ── Online ring ── */
  .msg-online-ring {
    position: absolute; inset: 0; border-radius: 50%;
    border: 2px solid #10b981; opacity: 0;
    animation: msgOnlineRing 2.5s ease infinite;
  }

  /* ── Unread badge ── */
  .msg-badge { animation: msgBadgePop 0.3s cubic-bezier(0.34,1.56,0.64,1) both; }
  .msg-badge-pulse { animation: msgBadgePulse 2.5s ease infinite; }

  /* ── Announcement posts ── */
  .msg-ann-post { animation: msgAnnIn 0.25s cubic-bezier(0.16,1,0.3,1) both; }

  /* ── Send button active state ── */
  .msg-send-btn:active { transform: scale(0.88) !important; }

  @keyframes msgBubbleRight  { from{opacity:0;transform:translateX(24px) scale(0.88)} to{opacity:1;transform:none} }
  @keyframes msgBubbleLeft   { from{opacity:0;transform:translateX(-24px) scale(0.88)} to{opacity:1;transform:none} }
  @keyframes msgDot          { 0%,60%,100%{transform:translateY(0);opacity:0.4} 30%{transform:translateY(-6px);opacity:1} }
  @keyframes msgOnlineRing   { 0%{transform:scale(1);opacity:0.7} 100%{transform:scale(1.9);opacity:0} }
  @keyframes msgBadgePop     { from{transform:scale(0)} to{transform:scale(1)} }
  @keyframes msgBadgePulse   { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }
  @keyframes msgAnnIn        { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }
  @keyframes msgOrbFloat     { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(28px,-22px) scale(1.06)} 70%{transform:translate(-18px,14px) scale(0.96)} }
  @keyframes msgOrbFloat2    { 0%,100%{transform:translate(0,0)} 55%{transform:translate(-35px,28px)} }
  @keyframes msgSlideUp      { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
  @keyframes msgSpin         { to{transform:rotate(360deg)} }
`

// ─── Avatar ────────────────────────────────────────────────────────────────────
function StaffAvatar({ name, photoPath, size = 40, online = false, lowBandwidth = false }: {
  name: string; photoPath?: string | null; size?: number; online?: boolean; lowBandwidth?: boolean
}) {
  const url = useStaffPhotoUrl(lowBandwidth ? null : photoPath)
  const [c1, c2] = pal(name)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: url ? 'transparent' : `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.34, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)',
        boxShadow: url ? 'none' : `0 3px 12px ${c1}45`,
        overflow: 'hidden', userSelect: 'none',
      }}>
        {url
          ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initials(name)}
      </div>
      {online && (
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: size * 0.28, height: size * 0.28 }}>
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div className="msg-online-ring" />
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              background: '#10b981', border: `${Math.max(1.5, size * 0.04)}px solid var(--surface)`,
            }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Highlighted template text ─────────────────────────────────────────────────
function HighlightedTemplate({ body }: { body: string }) {
  return (
    <span>
      {body.split(/(\[[^\]]+\])/g).map((p, i) =>
        /^\[.+\]$/.test(p)
          ? <mark key={i} style={{ background: 'rgba(245,158,11,0.18)', color: '#f59e0b', borderRadius: 3, padding: '0 3px', fontWeight: 700 }}>{p}</mark>
          : <span key={i}>{p}</span>
      )}
    </span>
  )
}

// ─── Contact sidebar row ───────────────────────────────────────────────────────
function ContactRow({ contact, isActive, onClick }: {
  contact: Contact; isActive: boolean; onClick: () => void
}) {
  const { isLowBandwidth } = useBandwidth()
  const roleLabel = ROLE_LABEL[contact.role as UserRole] ?? contact.role.replace(/_/g, ' ')
  const [c1] = pal(contact.name)

  return (
    <div
      onClick={onClick}
      className={`msg-crow ${isActive ? 'msg-crow-active' : ''}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px',
        borderLeft: `3px solid ${isActive ? c1 : 'transparent'}`,
      }}
    >
      <StaffAvatar name={contact.name} photoPath={contact.photoUrl} size={44} lowBandwidth={isLowBandwidth} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700, fontSize: 13.5,
          color: isActive ? c1 : 'var(--txt)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          transition: 'color 0.13s',
        }}>
          {contact.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1, textTransform: 'capitalize' }}>
          {roleLabel}
        </div>
      </div>
      {contact.unreadCount > 0 && (
        <div className="msg-badge msg-badge-pulse" style={{
          background: `linear-gradient(135deg, ${c1} 0%, var(--brand-dark) 100%)`,
          color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 900,
          minWidth: 20, height: 20, padding: '0 5px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, boxShadow: `0 2px 8px ${c1}55`,
        }}>
          {contact.unreadCount > 9 ? '9+' : contact.unreadCount}
        </div>
      )}
    </div>
  )
}

// ─── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator({ name }: { name: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8, animation: 'msgSlideUp 0.2s ease both' }}>
      <div style={{
        padding: '10px 16px', borderRadius: '18px 18px 18px 4px',
        background: 'var(--surface)', border: '1px solid var(--border)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <span style={{ fontSize: 11, color: 'var(--txt3)', marginRight: 4 }}>{name.split(' ')[0]} is typing</span>
        {[0,1,2].map(i => (
          <div key={i} className="msg-dot" style={{
            width: 5, height: 5, borderRadius: '50%',
            background: 'var(--brand)',
            animationDelay: `${i * 0.18}s`,
          }} />
        ))}
      </div>
    </div>
  )
}

// ─── Date separator ────────────────────────────────────────────────────────────
function DateSep({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 10px', userSelect: 'none' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <div style={{
        padding: '3px 12px', borderRadius: 99,
        background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(8px)',
        border: '1px solid var(--border)',
        fontSize: 10, fontWeight: 800, color: 'var(--txt3)',
        textTransform: 'uppercase', letterSpacing: 0.9,
        boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
      }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

// ─── Message bubble ────────────────────────────────────────────────────────────
function ChatBubble({ msg, isMine, idx }: { msg: Message; isMine: boolean; idx: number }) {
  const time = new Date(msg.sentAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const [c1] = pal('me')

  return (
    <div
      className="msg-bubble-wrap"
      style={{
        display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start',
        marginBottom: 3, paddingBottom: 2,
        animationDelay: `${Math.min(idx * 0.04, 0.3)}s`,
      }}
    >
      {/* Reaction bar */}
      <div className="msg-rxn" style={{
        position: 'absolute',
        [isMine ? 'right' : 'left']: 4, bottom: 'calc(100% + 4px)',
        display: 'flex', gap: 3,
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(0,0,0,0.07)',
        borderRadius: 999, padding: '4px 8px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
        zIndex: 20,
      }}>
        {REACTIONS.map(r => (
          <button key={r} className="msg-rxn-btn" style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 15, padding: '1px 2px', borderRadius: 4,
          }}>{r}</button>
        ))}
      </div>

      {/* Bubble */}
      <div
        className={isMine ? 'msg-bubble-mine' : 'msg-bubble-theirs'}
        style={{
          maxWidth: '66%',
          padding: '9px 13px 7px',
          borderRadius: isMine ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
          background: isMine
            ? `linear-gradient(135deg, ${c1} 0%, var(--brand-dark) 100%)`
            : 'var(--surface)',
          color: isMine ? '#fff' : 'var(--txt)',
          boxShadow: isMine
            ? `0 4px 20px ${c1}35, 0 1px 4px rgba(0,0,0,0.1)`
            : '0 2px 10px rgba(0,0,0,0.07)',
          border: isMine ? 'none' : '1px solid var(--border)',
        }}
      >
        {msg.attachmentUrl && (
          <a
            href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              color: isMine ? 'rgba(255,255,255,0.9)' : 'var(--brand)',
              fontSize: 12, fontWeight: 700, marginBottom: 7, textDecoration: 'none',
              padding: '5px 9px', borderRadius: 8,
              background: isMine ? 'rgba(255,255,255,0.12)' : 'rgba(13,148,136,0.07)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
            View attachment
          </a>
        )}
        <div style={{ fontSize: 14, lineHeight: 1.55 }}>{msg.body}</div>
        <div style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4,
          marginTop: 4, fontSize: 10,
          color: isMine ? 'rgba(255,255,255,0.55)' : 'var(--txt3)',
        }}>
          <span>{time}</span>
          {isMine && (
            <svg width="14" height="9" viewBox="0 0 18 11" fill="none">
              {msg.readAt ? (
                <>
                  <path d="M1 5l4 4L14 1" stroke="rgba(255,255,255,0.95)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 5l4 4L18 1" stroke="rgba(255,255,255,0.95)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </>
              ) : (
                <path d="M1 5l4 4L14 1" stroke="rgba(255,255,255,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              )}
            </svg>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Chat thread ───────────────────────────────────────────────────────────────
function ChatThread({ contact }: { contact: Contact }) {
  const { user } = useAuth()
  const { isLowBandwidth } = useBandwidth()
  const { data: messages = [] } = useMessages(contact.id)
  const { mutate: markRead } = useMarkRead()
  const { mutateAsync: sendMsg, isPending } = useSendMessage()
  const { mutateAsync: uploadFile } = useUploadAttachment()
  const { error: showError } = useToast()
  const [text, setText]           = useState('')
  const [attachUrl, setAttachUrl] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)
  const isDos = user?.role === 'dos'
  const roleLabel = ROLE_LABEL[contact.role as UserRole] ?? contact.role.replace(/_/g, ' ')
  const [c1] = pal(contact.name)
  const canSend = !!(text.trim() || attachUrl)

  useEffect(() => { if (contact.unreadCount > 0) markRead(contact.id) }, [contact.id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!canSend) return
    await sendMsg({ toUserId: contact.id, body: text.trim(), attachmentUrl: attachUrl })
    setText(''); setAttachUrl(null)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    try { setAttachUrl(await uploadFile(file)) }
    catch (err: any) { showError(err.message ?? 'Upload failed') }
  }

  // Group messages by date
  const dayGroups: { date: string; msgs: Message[] }[] = []
  for (const m of messages) {
    const d = new Date(m.sentAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const last = dayGroups.at(-1)
    if (!last || last.date !== d) dayGroups.push({ date: d, msgs: [m] })
    else last.msgs.push(m)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      {/* ── Header ── */}
      <div className="msg-topbar" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <StaffAvatar name={contact.name} photoPath={contact.photoUrl} size={42} lowBandwidth={isLowBandwidth} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>
            {contact.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1, textTransform: 'capitalize' }}>
            {roleLabel}
          </div>
        </div>
        {/* Call / video icons — decorative */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .99h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z',
            'M23 7l-7 5 7 5V7zM1 5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H3a2 2 0 01-2-2V5z',
          ].map((d, i) => (
            <div key={i} style={{
              width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--surface2)', cursor: 'default', opacity: 0.5,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--txt2)" strokeWidth="1.8" strokeLinecap="round">
                <path d={d} />
              </svg>
            </div>
          ))}
        </div>
      </div>

      {/* ── Message feed ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 20px', minHeight: 0,
        background: 'var(--bg)',
        backgroundImage: `
          radial-gradient(rgba(13,148,136,0.04) 1.5px, transparent 1.5px),
          radial-gradient(rgba(139,92,246,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '28px 28px, 14px 14px',
        backgroundPosition: '0 0, 14px 14px',
      }}>
        {messages.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 14,
          }}>
            <div style={{
              width: 80, height: 80, borderRadius: 28,
              background: `linear-gradient(135deg, ${c1}18 0%, ${c1}08 100%)`,
              border: `2px solid ${c1}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 8px 32px ${c1}18`,
            }}>
              <StaffAvatar name={contact.name} size={52} lowBandwidth={isLowBandwidth} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt2)', fontFamily: 'var(--font2)', marginBottom: 4 }}>
                {contact.name}
              </div>
              <div style={{ fontSize: 13, color: 'var(--txt3)' }}>No messages yet · say hello 👋</div>
            </div>
          </div>
        ) : (
          dayGroups.map(({ date, msgs }) => (
            <div key={date}>
              <DateSep label={date} />
              {msgs.map((m, i) => (
                <ChatBubble key={m.id} msg={m} isMine={m.fromUserId === user?.id} idx={i} />
              ))}
            </div>
          ))
        )}
        <div ref={bottomRef} style={{ height: 4 }} />
      </div>

      {/* ── Templates ── */}
      {isDos && showTemplates && (
        <div style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)', maxHeight: 210, overflowY: 'auto',
          animation: 'msgSlideUp 0.2s ease both',
        }}>
          <div style={{ padding: '8px 16px 6px', fontSize: 9, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Quick templates
          </div>
          {DOS_TEMPLATES.map((t, i) => (
            <button key={i} type="button"
              onClick={() => { setText(t.body); setShowTemplates(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: i < DOS_TEMPLATES.length - 1 ? '1px solid var(--border)' : 'none',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--txt)', marginBottom: 3 }}>{t.label}</div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', lineHeight: 1.5 }}><HighlightedTemplate body={t.body} /></div>
            </button>
          ))}
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="msg-inputbar" style={{ padding: '10px 16px', flexShrink: 0 }}>
        {attachUrl && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '4px 10px', borderRadius: 99, marginBottom: 8,
            background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.22)',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)' }}>File attached</span>
            <button type="button" onClick={() => setAttachUrl(null)} style={{
              border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)',
              fontWeight: 900, fontSize: 14, lineHeight: 1, padding: 0,
            }}>×</button>
          </div>
        )}
        <form onSubmit={e => { void handleSend(e) }} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {isDos && (
              <button type="button" onClick={() => setShowTemplates(v => !v)} title="Templates" style={{
                width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                border: '1px solid var(--border)',
                background: showTemplates ? 'rgba(13,148,136,0.12)' : 'var(--surface2)',
                color: showTemplates ? 'var(--brand)' : 'var(--txt3)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </button>
            )}
            <button type="button" onClick={() => fileRef.current?.click()} title="Attach file" style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              border: '1px solid var(--border)', background: 'var(--surface2)',
              color: 'var(--txt3)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { const b = e.currentTarget; b.style.background = 'var(--surface)'; b.style.color = 'var(--brand)' }}
              onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'var(--surface2)'; b.style.color = 'var(--txt3)' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls" style={{ display: 'none' }}
            onChange={e => { void handleFile(e) }} />

          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { void handleSend(e) } }}
            placeholder="Message… (Enter to send)"
            rows={1}
            className="sui-input"
            style={{
              flex: 1, resize: 'none', padding: '9px 14px',
              borderRadius: 14, fontSize: 14, lineHeight: 1.5,
              background: 'var(--surface)',
            }}
          />

          <button
            type="submit"
            disabled={isPending || !canSend}
            className="msg-send-btn"
            style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0, border: 'none',
              background: canSend && !isPending
                ? `linear-gradient(135deg, ${PALETTE[0][0]} 0%, ${PALETTE[0][1]} 100%)`
                : 'var(--surface2)',
              cursor: canSend ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: canSend ? '#fff' : 'var(--txt3)',
              transition: 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
              boxShadow: canSend ? `0 4px 14px ${PALETTE[0][0]}40` : 'none',
            }}
          >
            {isPending ? (
              <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'msgSpin 0.6s linear infinite' }} />
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none"/>
              </svg>
            )}
          </button>
        </form>
      </div>

      {/* Show typing indicator for show (non-functional placeholder for future real-time) */}
    </div>
  )
}

// ─── Announcement bubble ───────────────────────────────────────────────────────
function AnnBubble({ ann, idx }: { ann: Announcement; idx: number }) {
  const [c1] = pal(ann.fromName)
  const time = new Date(ann.postedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="msg-ann-post" style={{
      display: 'flex', gap: 12, marginBottom: 14,
      animationDelay: `${Math.min(idx * 0.05, 0.4)}s`,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: `linear-gradient(135deg, ${c1} 0%, #7c3aed 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)',
        boxShadow: `0 3px 12px ${c1}40`,
      }}>
        {initials(ann.fromName)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--txt)' }}>{ann.fromName}</span>
          <span style={{ fontSize: 10, color: 'var(--txt3)' }}>{time}</span>
        </div>
        <div style={{
          padding: '12px 16px', borderRadius: '4px 16px 16px 16px',
          background: 'rgba(139,92,246,0.06)',
          border: '1px solid rgba(139,92,246,0.14)',
          boxShadow: '0 2px 12px rgba(139,92,246,0.07)',
        }}>
          {ann.attachmentUrl && (
            <a href={ann.attachmentUrl} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                color: '#8b5cf6', fontSize: 12, fontWeight: 700, marginBottom: 7,
                textDecoration: 'none',
              }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
              </svg>
              View attachment
            </a>
          )}
          <div style={{ fontSize: 14, color: 'var(--txt)', lineHeight: 1.6 }}>{ann.body}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Announcements channel ─────────────────────────────────────────────────────
function AnnouncementsChannel() {
  const { user } = useAuth()
  const { data: announcements = [] } = useAnnouncements()
  const { mutateAsync: post, isPending } = usePostAnnouncement()
  const { error: showError } = useToast()
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const canPost = user && (CAN_POST_ROLES as readonly string[]).includes(user.role)
  const canSend = text.trim().length > 0

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [announcements.length])

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    if (!canSend) return
    try {
      await post({ body: text.trim() })
      setText('')
      void supabase.functions.invoke('broadcast-announcement', { body: { body: text.trim(), role: user?.role } })
    } catch (err: any) { showError(err.message) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

      {/* Header */}
      <div className="msg-topbar" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(139,92,246,0.4)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>Announcements</div>
          <div style={{ fontSize: 11, color: '#8b5cf6', marginTop: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#8b5cf6' }} />
            Broadcast to all staff
          </div>
        </div>
        <div style={{
          marginLeft: 'auto', padding: '4px 10px', borderRadius: 99, fontSize: 10, fontWeight: 800,
          background: 'rgba(139,92,246,0.1)', color: '#8b5cf6',
          border: '1px solid rgba(139,92,246,0.2)',
        }}>
          {announcements.length} posts
        </div>
      </div>

      {/* Feed */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '20px 24px', minHeight: 0,
        background: 'var(--bg)',
        backgroundImage: 'radial-gradient(rgba(139,92,246,0.045) 1.5px, transparent 1.5px)',
        backgroundSize: '28px 28px',
      }}>
        {announcements.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 14,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 24,
              background: 'linear-gradient(135deg, rgba(139,92,246,0.14) 0%, rgba(139,92,246,0.06) 100%)',
              border: '2px solid rgba(139,92,246,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(139,92,246,0.14)',
            }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.5">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--txt2)', fontFamily: 'var(--font2)', marginBottom: 4 }}>No announcements</div>
              <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
                {canPost ? 'Post the first announcement to all staff' : 'Announcements from leadership will appear here'}
              </div>
            </div>
          </div>
        )}
        {[...announcements].reverse().map((a, i) => <AnnBubble key={a.id} ann={a} idx={i} />)}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      {canPost && (
        <div className="msg-inputbar" style={{ padding: '10px 16px', flexShrink: 0 }}>
          <form onSubmit={e => { void handlePost(e) }} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { void handlePost(e) } }}
              placeholder="Broadcast to all staff… (Enter to post)"
              rows={2}
              className="sui-input"
              style={{ flex: 1, resize: 'none', padding: '9px 14px', borderRadius: 14, fontSize: 14 }}
            />
            <button
              type="submit"
              disabled={isPending || !canSend}
              className="msg-send-btn"
              style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0, border: 'none',
                background: canSend && !isPending
                  ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                  : 'var(--surface2)',
                cursor: canSend ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: canSend ? '#fff' : 'var(--txt3)',
                transition: 'all 0.18s cubic-bezier(0.34,1.56,0.64,1)',
                boxShadow: canSend ? '0 4px 16px rgba(139,92,246,0.4)' : 'none',
              }}
            >
              {isPending ? (
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'msgSpin 0.6s linear infinite' }} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none"/>
                </svg>
              )}
            </button>
          </form>
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
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.role.includes(search.toLowerCase()))
    : contacts

  const totalUnread = contacts.reduce((s, c) => s + c.unreadCount, 0)

  return (
    <div
      className="msg-shell"
      style={{
        display: 'flex',
        height: 'calc(100vh - 56px - 2.8rem)',
        borderRadius: 20, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.45)',
        boxShadow: '0 8px 48px rgba(0,0,0,0.10), 0 2px 12px rgba(0,0,0,0.06)',
      }}
    >
      <style>{MSG_CSS}</style>
        {/* Decorative ambient orbs */}
        <div className="msg-orb" style={{
          width: 420, height: 420, top: -80, right: -80,
          background: 'radial-gradient(circle, rgba(13,148,136,0.18) 0%, transparent 70%)',
          animation: 'msgOrbFloat 12s ease-in-out infinite',
        }} />
        <div className="msg-orb" style={{
          width: 380, height: 380, bottom: -100, left: -80,
          background: 'radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)',
          animation: 'msgOrbFloat2 14s ease-in-out infinite',
        }} />
        <div className="msg-orb" style={{
          width: 280, height: 280, top: '40%', left: '30%',
          background: 'radial-gradient(circle, rgba(14,165,233,0.09) 0%, transparent 70%)',
          animation: 'msgOrbFloat 18s ease-in-out infinite 4s',
        }} />

        {/* ════ SIDEBAR ════ */}
        <div className="msg-sidebar" style={{
          width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column',
          position: 'relative', zIndex: 1,
        }}>
          {/* Sidebar header */}
          <div style={{
            padding: '18px 16px 12px',
            background: 'linear-gradient(180deg, rgba(13,148,136,0.06) 0%, transparent 100%)',
            borderBottom: '1px solid rgba(13,148,136,0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 18, color: 'var(--txt)', flex: 1 }}>
                Messages
              </div>
              {totalUnread > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%)',
                  color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 900,
                  padding: '2px 8px',
                  boxShadow: '0 2px 8px rgba(13,148,136,0.4)',
                }}>
                  {totalUnread}
                </div>
              )}
            </div>

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search contacts…"
                className="sui-input"
                style={{ paddingLeft: 33, width: '100%', fontSize: 12, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.6)' }}
              />
            </div>
          </div>

          {/* Announcements (pinned) */}
          <div
            onClick={() => setActive('announcements')}
            className="msg-crow"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 16px',
              borderLeft: `3px solid ${active === 'announcements' ? '#8b5cf6' : 'transparent'}`,
              borderBottom: '1px solid var(--border)',
              background: active === 'announcements' ? 'rgba(139,92,246,0.07)' : undefined,
              transition: 'all 0.13s',
            }}
            onMouseEnter={e => { if (active !== 'announcements') (e.currentTarget as HTMLDivElement).style.background = 'rgba(139,92,246,0.04)' }}
            onMouseLeave={e => { if (active !== 'announcements') (e.currentTarget as HTMLDivElement).style.background = '' }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: active === 'announcements'
                ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                : 'rgba(139,92,246,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: active === 'announcements' ? '0 4px 14px rgba(139,92,246,0.4)' : 'none',
              transition: 'all 0.18s',
            }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={active === 'announcements' ? '#fff' : '#8b5cf6'} strokeWidth="2">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: active === 'announcements' ? '#8b5cf6' : 'var(--txt)', transition: 'color 0.13s' }}>
                Announcements
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>All staff · broadcast</div>
            </div>
          </div>

          {/* DM section label */}
          <div style={{ padding: '10px 16px 4px', fontSize: 9, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 1.2 }}>
            Direct messages
          </div>

          {/* Contacts */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isLoading && [...Array(6)].map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 16px' }}>
                <div className="shule-skeleton" style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="shule-skeleton" style={{ height: 12, borderRadius: 6, marginBottom: 5, width: '65%' }} />
                  <div className="shule-skeleton" style={{ height: 10, borderRadius: 5, width: '40%' }} />
                </div>
              </div>
            ))}
            {!isLoading && filtered.length === 0 && (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--txt3)', fontSize: 12 }}>
                {search ? 'No contacts found.' : 'No staff to message.'}
              </div>
            )}
            {filtered.map(c => (
              <ContactRow
                key={c.id} contact={c}
                isActive={active !== 'announcements' && (active as Contact)?.id === c.id}
                onClick={() => setActive(c)}
              />
            ))}
          </div>
        </div>

        {/* ════ RIGHT PANEL ════ */}
        <div className="msg-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden', position: 'relative', zIndex: 1, alignItems: 'stretch' }}>
          {active === null ? (
            /* Empty state */
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 20,
              background: 'var(--bg)',
              backgroundImage: `
                radial-gradient(rgba(13,148,136,0.04) 1.5px, transparent 1.5px),
                radial-gradient(rgba(139,92,246,0.03) 1px, transparent 1px)
              `,
              backgroundSize: '28px 28px, 14px 14px',
              backgroundPosition: '0 0, 14px 14px',
            }}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: 96, height: 96, borderRadius: 32,
                  background: 'linear-gradient(135deg, rgba(13,148,136,0.12) 0%, rgba(139,92,246,0.08) 100%)',
                  border: '2px solid rgba(13,148,136,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 12px 48px rgba(13,148,136,0.14)',
                }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.2">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                  </svg>
                </div>
                {/* Floating badge */}
                <div style={{
                  position: 'absolute', top: -6, right: -6, width: 24, height: 24, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 3px 10px rgba(139,92,246,0.5)',
                }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--txt)', fontFamily: 'var(--font2)', marginBottom: 6 }}>
                  Select a conversation
                </div>
                <div style={{ fontSize: 13, color: 'var(--txt3)', lineHeight: 1.6 }}>
                  Choose a contact for direct messages<br/>or open Announcements to broadcast
                </div>
              </div>
              {contacts.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {contacts.slice(0, 4).map(c => {
                    const [cc] = pal(c.name)
                    return (
                      <button key={c.id} onClick={() => setActive(c)} style={{
                        width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: `linear-gradient(135deg, ${cc} 0%, ${pal(c.name)[1]} 100%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: 13, fontWeight: 900, fontFamily: 'var(--font2)',
                        boxShadow: `0 3px 12px ${cc}40`,
                        transition: 'transform 0.15s ease',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.12)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
                      >
                        {initials(c.name)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ) : active === 'announcements' ? (
            <AnnouncementsChannel />
          ) : (
            <ChatThread contact={active as Contact} />
          )}
        </div>
    </div>
  )
}
