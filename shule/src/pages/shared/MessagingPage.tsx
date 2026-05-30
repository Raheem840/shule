import { useState, useRef, useEffect } from 'react'
import { useStaffPhotoUrl } from '../../hooks/useStaffPhotoUrl'
import { useBandwidth } from '../../store/BandwidthContext'
import { supabase } from '../../lib/supabase'
import {
  useContacts,
  useMessages,
  useSendMessage,
  useMarkRead,
  useAnnouncements,
  usePostAnnouncement,
  useUploadAttachment,
} from '../../hooks/useMessaging'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { ROLE_LABEL } from '../../config/roleNav'
import type { Contact, Announcement } from '../../types/week9'
import type { Message, UserRole } from '../../types/app'

// ─── Constants ────────────────────────────────────────────────────────────────
const CAN_POST_ROLES = ['principal', 'deputy', 'dos', 'secretary', 'bursar', 'it_admin'] as const

const AVATAR_PALETTE = [
  { color: '#0d9488', bg: 'rgba(13,148,136,0.18)' },
  { color: '#8b5cf6', bg: 'rgba(139,92,246,0.18)' },
  { color: '#0ea5e9', bg: 'rgba(14,165,233,0.18)' },
  { color: '#f59e0b', bg: 'rgba(245,158,11,0.18)'  },
  { color: '#f43f5e', bg: 'rgba(244,63,94,0.18)'   },
  { color: '#10b981', bg: 'rgba(16,185,129,0.18)'  },
]
function avatarColor(name: string) {
  const code = (name.charCodeAt(0) ?? 65) + (name.charCodeAt(1) ?? 65)
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length]
}
function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

// ─── DoS templates ────────────────────────────────────────────────────────────
const DOS_TEMPLATES = [
  { label: 'Exam schedule reminder',    body: 'Dear [Name], please note that [Subject] exam is scheduled for [Date] at [Time]. Ensure all [Class] students are prepared and present.' },
  { label: 'Class teacher assignment',  body: 'Dear [Name], you have been assigned as class teacher for [Class] effective [Date]. Please collect the register from the secretary\'s office.' },
  { label: 'End of term notice',        body: 'Dear [Name], Term [Number] ends on [Date]. Report cards will be distributed on [Release Date]. Ensure all remarks are complete by [Deadline].' },
] as const

function HighlightedTemplate({ body }: { body: string }) {
  return (
    <span>
      {body.split(/(\[[^\]]+\])/g).map((part, i) =>
        /^\[.+\]$/.test(part)
          ? <mark key={i} style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderRadius: 3, padding: '0 2px', fontWeight: 700 }}>{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </span>
  )
}

// ─── Avatar component ─────────────────────────────────────────────────────────
function StaffAvatar({ name, photoPath, size = 40, lowBandwidth = false }: {
  name: string; photoPath?: string | null; size?: number; lowBandwidth?: boolean
}) {
  const signedUrl = useStaffPhotoUrl(lowBandwidth ? null : photoPath)
  const av = avatarColor(name)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: signedUrl ? 'transparent' : `linear-gradient(135deg, ${av.color}cc 0%, ${av.color}88 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.33, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)',
      boxShadow: `0 2px 8px ${av.color}30`,
      overflow: 'hidden', userSelect: 'none',
    }}>
      {signedUrl
        ? <img src={signedUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials(name)}
    </div>
  )
}

// ─── Sidebar contact row ──────────────────────────────────────────────────────
function ContactRow({ contact, isActive, onClick }: {
  contact: Contact; isActive: boolean; onClick: () => void
}) {
  const { isLowBandwidth } = useBandwidth()
  const [hovered, setHovered] = useState(false)
  const roleLabel = ROLE_LABEL[contact.role as UserRole] ?? contact.role.replace(/_/g, ' ')

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px', cursor: 'pointer',
        background: isActive
          ? 'rgba(13,148,136,0.08)'
          : hovered ? 'var(--surface2)' : 'transparent',
        borderLeft: `3px solid ${isActive ? 'var(--brand)' : 'transparent'}`,
        transition: 'all 0.12s',
      }}
    >
      <StaffAvatar name={contact.name} photoPath={contact.photoUrl} size={42} lowBandwidth={isLowBandwidth} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700, fontSize: 13.5,
          color: isActive ? 'var(--brand)' : 'var(--txt)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {contact.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1, textTransform: 'capitalize' }}>
          {roleLabel}
        </div>
      </div>
      {contact.unreadCount > 0 && (
        <div style={{
          background: 'var(--brand)', color: '#fff',
          borderRadius: 99, fontSize: 10, fontWeight: 900,
          minWidth: 20, height: 20, padding: '0 5px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, boxShadow: '0 2px 6px rgba(13,148,136,0.4)',
        }}>
          {contact.unreadCount > 9 ? '9+' : contact.unreadCount}
        </div>
      )}
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function ChatBubble({ msg, isMine }: { msg: Message; isMine: boolean }) {
  const time = new Date(msg.sentAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{
      display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start',
      marginBottom: 4,
      animation: 'msgSlideIn 0.18s cubic-bezier(0.16,1,0.3,1) both',
    }}>
      <div style={{
        maxWidth: '68%',
        padding: '9px 13px 6px',
        borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: isMine
          ? 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)'
          : 'var(--surface2)',
        color: isMine ? '#fff' : 'var(--txt)',
        boxShadow: isMine
          ? '0 2px 12px rgba(13,148,136,0.25)'
          : '0 1px 4px rgba(0,0,0,0.06)',
        border: isMine ? 'none' : '1px solid var(--border)',
      }}>
        {msg.attachmentUrl && (
          <a
            href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              color: isMine ? 'rgba(255,255,255,0.85)' : 'var(--brand)',
              fontSize: 12, fontWeight: 700, marginBottom: 6,
              padding: '4px 8px', borderRadius: 6,
              background: isMine ? 'rgba(255,255,255,0.1)' : 'rgba(13,148,136,0.08)',
              textDecoration: 'none',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
            View attachment
          </a>
        )}
        <div style={{ fontSize: 14, lineHeight: 1.5 }}>{msg.body}</div>
        <div style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4,
          marginTop: 3, fontSize: 10,
          color: isMine ? 'rgba(255,255,255,0.6)' : 'var(--txt3)',
        }}>
          <span>{time}</span>
          {isMine && (
            <svg width="14" height="10" viewBox="0 0 16 11" fill="none">
              {msg.readAt ? (
                <>
                  <path d="M1 5l4 4L14 1" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M5 5l4 4L18 1" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </>
              ) : (
                <path d="M1 5l4 4L14 1" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              )}
            </svg>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Date separator ───────────────────────────────────────────────────────────
function DateSeparator({ date }: { date: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      margin: '16px 0 8px', userSelect: 'none',
    }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{
        fontSize: 10, fontWeight: 800, color: 'var(--txt3)',
        textTransform: 'uppercase', letterSpacing: 0.8,
        padding: '3px 10px', borderRadius: 99,
        background: 'var(--surface2)', border: '1px solid var(--border)',
      }}>
        {date}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  )
}

// ─── 1:1 Chat thread ──────────────────────────────────────────────────────────
function ChatThread({ contact }: { contact: Contact }) {
  const { user } = useAuth()
  const { isLowBandwidth } = useBandwidth()
  const { data: messages = [] } = useMessages(contact.id)
  const { mutate: markRead } = useMarkRead()
  const { mutateAsync: sendMsg, isPending } = useSendMessage()
  const { mutateAsync: uploadFile } = useUploadAttachment()
  const { error: showError } = useToast()
  const [text, setText]             = useState('')
  const [attachUrl, setAttachUrl]   = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef   = useRef<HTMLInputElement>(null)
  const isDos = user?.role === 'dos'

  useEffect(() => {
    if (contact.unreadCount > 0) markRead(contact.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() && !attachUrl) return
    await sendMsg({ toUserId: contact.id, body: text.trim(), attachmentUrl: attachUrl })
    setText('')
    setAttachUrl(null)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const url = await uploadFile(file)
      setAttachUrl(url)
    } catch (err: any) {
      showError(err.message ?? 'Upload failed')
    }
  }

  // Group messages by date
  const dayGroups: { date: string; msgs: Message[] }[] = []
  for (const m of messages) {
    const d = new Date(m.sentAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const last = dayGroups[dayGroups.length - 1]
    if (!last || last.date !== d) dayGroups.push({ date: d, msgs: [m] })
    else last.msgs.push(m)
  }

  const roleLabel = ROLE_LABEL[contact.role as UserRole] ?? contact.role.replace(/_/g, ' ')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Chat header ── */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 14,
        background: 'var(--surface)',
      }}>
        <StaffAvatar name={contact.name} photoPath={contact.photoUrl} size={40} lowBandwidth={isLowBandwidth} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>
            {contact.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1, textTransform: 'capitalize' }}>
            {roleLabel}
          </div>
        </div>
      </div>

      {/* ── Message feed ── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px 20px',
        background: 'var(--bg)',
        backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}>
        {messages.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 10, color: 'var(--txt3)',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 18, background: 'var(--surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt2)' }}>No messages yet</div>
            <div style={{ fontSize: 12 }}>Send a message to start the conversation</div>
          </div>
        )}
        {dayGroups.map(({ date, msgs }) => (
          <div key={date}>
            <DateSeparator date={date} />
            {msgs.map(m => (
              <ChatBubble key={m.id} msg={m} isMine={m.fromUserId === user?.id} />
            ))}
          </div>
        ))}
        <div ref={bottomRef} style={{ height: 4 }} />
      </div>

      {/* ── Templates panel ── */}
      {isDos && showTemplates && (
        <div style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)', maxHeight: 220, overflowY: 'auto',
          animation: 'msgSlideIn 0.18s ease both',
        }}>
          <div style={{
            padding: '8px 16px', fontSize: 9, fontWeight: 800, color: 'var(--txt3)',
            textTransform: 'uppercase', letterSpacing: 0.8,
            borderBottom: '1px solid var(--border)',
          }}>
            Quick templates
          </div>
          {DOS_TEMPLATES.map((t, i) => (
            <button
              key={i} type="button"
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
              <div style={{ fontSize: 11, color: 'var(--txt3)' }}><HighlightedTemplate body={t.body} /></div>
            </button>
          ))}
        </div>
      )}

      {/* ── Input bar ── */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        {attachUrl && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 8, marginBottom: 8,
            background: 'rgba(13,148,136,0.08)', border: '1px solid rgba(13,148,136,0.2)',
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.5">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)' }}>File attached</span>
            <button type="button" onClick={() => setAttachUrl(null)} style={{
              border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)',
              fontWeight: 900, fontSize: 13, lineHeight: 1, padding: 0,
            }}>×</button>
          </div>
        )}
        <form onSubmit={e => { void handleSend(e) }} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          {/* Left: attach + templates */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {isDos && (
              <button type="button" onClick={() => setShowTemplates(v => !v)} title="Templates" style={{
                width: 38, height: 38, borderRadius: 12, border: '1px solid var(--border)',
                background: showTemplates ? 'rgba(13,148,136,0.1)' : 'var(--surface2)',
                color: showTemplates ? 'var(--brand)' : 'var(--txt3)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </button>
            )}
            <button type="button" onClick={() => fileRef.current?.click()} title="Attach file" style={{
              width: 38, height: 38, borderRadius: 12, border: '1px solid var(--border)',
              background: 'var(--surface2)', color: 'var(--txt3)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--brand)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface2)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--txt3)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls" style={{ display: 'none' }}
            onChange={e => { void handleFile(e) }} />

          {/* Text area */}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { void handleSend(e) } }}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="sui-input"
            style={{
              flex: 1, resize: 'none', padding: '9px 13px', borderRadius: 14,
              fontSize: 14, lineHeight: 1.5,
            }}
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={isPending || (!text.trim() && !attachUrl)}
            style={{
              width: 38, height: 38, borderRadius: 12, flexShrink: 0,
              background: (text.trim() || attachUrl) && !isPending
                ? 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)'
                : 'var(--surface2)',
              border: 'none', cursor: (text.trim() || attachUrl) ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: (text.trim() || attachUrl) ? '#fff' : 'var(--txt3)',
              transition: 'all 0.15s',
              boxShadow: (text.trim() || attachUrl) ? '0 3px 10px rgba(13,148,136,0.3)' : 'none',
            }}
          >
            {isPending ? (
              <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', animation: 'spin 0.6s linear infinite' }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Announcement bubble ──────────────────────────────────────────────────────
function AnnouncementBubble({ ann }: { ann: Announcement }) {
  const av = avatarColor(ann.fromName)
  const time = new Date(ann.postedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{
      display: 'flex', gap: 10, marginBottom: 12,
      animation: 'msgSlideIn 0.2s ease both',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
        background: `linear-gradient(135deg, ${av.color}cc 0%, ${av.color}88 100%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 900, color: '#fff', fontFamily: 'var(--font2)',
      }}>
        {initials(ann.fromName)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--txt)' }}>{ann.fromName}</span>
          <span style={{ fontSize: 10, color: 'var(--txt3)' }}>{time}</span>
        </div>
        <div style={{
          padding: '10px 14px', borderRadius: '4px 14px 14px 14px',
          background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.15)',
        }}>
          {ann.attachmentUrl && (
            <a href={ann.attachmentUrl} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                color: 'var(--violet)', fontSize: 12, fontWeight: 700, marginBottom: 6,
              }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
              </svg>
              Attachment
            </a>
          )}
          <div style={{ fontSize: 14, color: 'var(--txt)', lineHeight: 1.6 }}>{ann.body}</div>
        </div>
      </div>
    </div>
  )
}

// ─── Announcements channel ────────────────────────────────────────────────────
function AnnouncementsChannel() {
  const { user } = useAuth()
  const { data: announcements = [] } = useAnnouncements()
  const { mutateAsync: post, isPending } = usePostAnnouncement()
  const { error: showError } = useToast()
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const canPost = user && (CAN_POST_ROLES as readonly string[]).includes(user.role)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [announcements.length])

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    try {
      await post({ body: text.trim() })
      setText('')
      void supabase.functions.invoke('broadcast-announcement', { body: { body: text.trim(), role: user?.role } })
    } catch (err: any) {
      showError(err.message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
        background: 'var(--surface)',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: 'rgba(139,92,246,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" strokeWidth="2">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, fontFamily: 'var(--font2)', color: 'var(--txt)' }}>Announcements</div>
          <div style={{ fontSize: 11, color: 'var(--violet)', marginTop: 1 }}>Visible to all staff</div>
        </div>
      </div>

      {/* Feed */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '20px',
        background: 'var(--bg)',
        backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}>
        {announcements.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', gap: 10, color: 'var(--txt3)',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 18, background: 'var(--surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt2)' }}>No announcements yet</div>
          </div>
        )}
        {[...announcements].reverse().map(a => <AnnouncementBubble key={a.id} ann={a} />)}
        <div ref={bottomRef} />
      </div>

      {/* Post input */}
      {canPost && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
          <form onSubmit={e => { void handlePost(e) }} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { void handlePost(e) } }}
              placeholder="Broadcast an announcement to all staff… (Enter to send)"
              rows={2}
              className="sui-input"
              style={{ flex: 1, resize: 'none', padding: '9px 13px', borderRadius: 14, fontSize: 14 }}
            />
            <button
              type="submit"
              disabled={isPending || !text.trim()}
              style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                background: text.trim() && !isPending
                  ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                  : 'var(--surface2)',
                border: 'none', cursor: text.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: text.trim() ? '#fff' : 'var(--txt3)',
                transition: 'all 0.15s',
                boxShadow: text.trim() ? '0 3px 10px rgba(139,92,246,0.3)' : 'none',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
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
  const [activeContact, setActiveContact] = useState<Contact | 'announcements' | null>(null)
  const [search, setSearch] = useState('')

  const filteredContacts = search.trim()
    ? contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.role.includes(search.toLowerCase()))
    : contacts

  return (
    <>
      <style>{`
        @keyframes msgSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{
        display: 'flex', height: 'calc(100vh - 100px)', borderRadius: 16, overflow: 'hidden',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 32px rgba(0,0,0,0.06)',
      }}>

        {/* ════ LEFT SIDEBAR ════ */}
        <div style={{
          width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column',
          background: 'var(--surface)', borderRight: '1px solid var(--border)',
        }}>

          {/* Sidebar header */}
          <div style={{ padding: '16px 16px 12px' }}>
            <div style={{ fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 17, color: 'var(--txt)', marginBottom: 10 }}>
              Messages
            </div>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                placeholder="Search contacts…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="sui-input"
                style={{ paddingLeft: 30, width: '100%', fontSize: 12, height: 34, borderRadius: 10 }}
              />
            </div>
          </div>

          {/* Announcements channel (pinned) */}
          <div
            onClick={() => setActiveContact('announcements')}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 16px', cursor: 'pointer',
              background: activeContact === 'announcements'
                ? 'rgba(139,92,246,0.08)'
                : 'transparent',
              borderLeft: `3px solid ${activeContact === 'announcements' ? 'var(--violet)' : 'transparent'}`,
              borderBottom: '1px solid var(--border)',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { if (activeContact !== 'announcements') (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)' }}
            onMouseLeave={e => { if (activeContact !== 'announcements') (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
          >
            <div style={{
              width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(139,92,246,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" strokeWidth="2">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: activeContact === 'announcements' ? 'var(--violet)' : 'var(--txt)' }}>
                Announcements
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 1 }}>Broadcast to all staff</div>
            </div>
          </div>

          {/* Contacts section header */}
          <div style={{ padding: '10px 16px 6px', fontSize: 9, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Direct messages
          </div>

          {/* Contacts list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {isLoading && (
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...Array(5)].map((_, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div className="shule-skeleton" style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div className="shule-skeleton" style={{ height: 12, borderRadius: 6, marginBottom: 5, width: '70%' }} />
                      <div className="shule-skeleton" style={{ height: 10, borderRadius: 5, width: '40%' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!isLoading && filteredContacts.length === 0 && (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--txt3)', fontSize: 12 }}>
                {search ? 'No contacts found.' : 'No staff to message.'}
              </div>
            )}
            {filteredContacts.map(c => (
              <ContactRow
                key={c.id} contact={c}
                isActive={activeContact !== 'announcements' && (activeContact as Contact)?.id === c.id}
                onClick={() => setActiveContact(c)}
              />
            ))}
          </div>
        </div>

        {/* ════ RIGHT PANEL ════ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface)', minWidth: 0 }}>
          {activeContact === null ? (
            /* Empty state */
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 14,
              background: 'var(--bg)',
              backgroundImage: 'radial-gradient(var(--border) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}>
              <div style={{
                width: 72, height: 72, borderRadius: 24,
                background: 'var(--surface)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt2)', fontFamily: 'var(--font2)', marginBottom: 4 }}>
                  Select a conversation
                </div>
                <div style={{ fontSize: 13, color: 'var(--txt3)' }}>
                  Choose a contact or open Announcements
                </div>
              </div>
            </div>
          ) : activeContact === 'announcements' ? (
            <AnnouncementsChannel />
          ) : (
            <ChatThread contact={activeContact as Contact} />
          )}
        </div>
      </div>
    </>
  )
}
