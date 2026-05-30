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
import type { Contact, Announcement } from '../../types/week9'
import type { Message } from '../../types/app'

// ─── Announcement poster roles (for post button visibility) ───────────────
const CAN_POST_ROLES = ['principal', 'deputy', 'dos', 'secretary', 'bursar', 'it_admin'] as const

// ─── Contact avatar — resolves signed URL for private staff-photos bucket ──
function ContactAvatar({ photoPath, name, lowBandwidth }: {
  photoPath: string | null | undefined
  name: string
  lowBandwidth: boolean
}) {
  const signedUrl = useStaffPhotoUrl(lowBandwidth ? null : photoPath)
  const inits = name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: 'var(--surface2)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: 13, fontWeight: 800,
      color: 'var(--brand)', flexShrink: 0, overflow: 'hidden',
    }}>
      {signedUrl
        ? <img src={signedUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : inits}
    </div>
  )
}

// ─── DoS message templates ─────────────────────────────────────────────────
const DOS_TEMPLATES = [
  {
    label: 'Exam schedule reminder',
    body:  'Dear [Name], please note that [Subject] exam is scheduled for [Date] at [Time]. Ensure all [Class] students are prepared and present.',
  },
  {
    label: 'Grade submission deadline',
    body:  'Dear [Name], this is a reminder that all [Term] marks for [Subject] must be submitted by [Deadline]. Contact the DoS office for any issues.',
  },
  {
    label: 'Class teacher assignment',
    body:  'Dear [Name], you have been assigned as class teacher for [Class] effective [Date]. Please collect the register from the secretary\'s office.',
  },
  {
    label: 'End of term notice',
    body:  'Dear [Name], Term [Number] ends on [Date]. Report cards will be distributed on [Release Date]. Ensure all remarks are complete by [Deadline].',
  },
] as const

// ─── Template placeholder highlight helper ─────────────────────────────────
function HighlightedTemplate({ body }: { body: string }) {
  const parts = body.split(/(\[[^\]]+\])/g)
  return (
    <span>
      {parts.map((part, i) =>
        /^\[.+\]$/.test(part)
          ? <mark key={i} style={{ background: 'var(--warning-bg)', color: 'var(--warning)',
              borderRadius: 3, padding: '0 2px', fontWeight: 700 }}>{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </span>
  )
}

// ─── Contact List Item ─────────────────────────────────────────────────────
function ContactItem({
  contact,
  isActive,
  onClick,
}: {
  contact: Contact
  isActive: boolean
  onClick: () => void
}) {
  const { isLowBandwidth } = useBandwidth()

  function initials(name: string) {
    return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
  }

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', cursor: 'pointer',
        background: isActive ? 'var(--brand-light)' : 'transparent',
        borderLeft: isActive ? '3px solid var(--brand)' : '3px solid transparent',
        transition: 'background 0.1s',
      }}
    >
      <ContactAvatar photoPath={contact.photoUrl} name={contact.name} lowBandwidth={isLowBandwidth} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {contact.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--txt3)', textTransform: 'capitalize' }}>
          {contact.role.replace('_', ' ')}
        </div>
      </div>
      {contact.unreadCount > 0 && (
        <div style={{
          background: 'var(--brand)', color: '#fff',
          borderRadius: 99, fontSize: 10, fontWeight: 800,
          padding: '2px 6px', minWidth: 18, textAlign: 'center',
        }}>
          {contact.unreadCount > 9 ? '9+' : contact.unreadCount}
        </div>
      )}
    </div>
  )
}

// ─── Chat Bubble ───────────────────────────────────────────────────────────
function ChatBubble({ msg, isMine }: { msg: Message; isMine: boolean }) {
  const time = new Date(msg.sentAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const readTick = isMine ? (msg.readAt ? '✓✓' : '✓') : null

  return (
    <div style={{
      display: 'flex',
      justifyContent: isMine ? 'flex-end' : 'flex-start',
      marginBottom: 8,
    }}>
      <div style={{
        maxWidth: '70%', padding: '8px 12px', borderRadius: 14,
        background: isMine ? 'var(--brand)' : 'var(--surface2)',
        color: isMine ? '#fff' : 'var(--txt)',
        fontSize: 14,
        borderBottomRightRadius: isMine ? 4 : 14,
        borderBottomLeftRadius: isMine ? 14 : 4,
      }}>
        {msg.attachmentUrl && (
          <div style={{ marginBottom: 6 }}>
            <a
              href={msg.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: isMine ? 'rgba(255,255,255,0.85)' : 'var(--brand)', fontSize: 12 }}
            >
              📎 Attachment
            </a>
          </div>
        )}
        <div style={{ lineHeight: 1.5 }}>{msg.body}</div>
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 4,
          marginTop: 4, fontSize: 10,
          color: isMine ? 'rgba(255,255,255,0.7)' : 'var(--txt3)',
        }}>
          <span>{time}</span>
          {readTick && (
            <span style={{ color: msg.readAt ? (isMine ? '#fff' : 'var(--brand)') : undefined }}>
              {readTick}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Announcement Bubble ───────────────────────────────────────────────────
function AnnouncementBubble({ ann }: { ann: Announcement }) {
  const time = new Date(ann.postedAt).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div style={{
      background: 'var(--violet-bg)', border: '1px solid var(--violet)',
      borderRadius: 12, padding: '10px 14px', marginBottom: 8,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--violet)', marginBottom: 4 }}>
        {ann.fromName}
      </div>
      {ann.attachmentUrl && (
        <a href={ann.attachmentUrl} target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--violet)', fontSize: 12, display: 'block', marginBottom: 4 }}>
          📎 Attachment
        </a>
      )}
      <div style={{ fontSize: 14, color: 'var(--txt)', lineHeight: 1.5 }}>{ann.body}</div>
      <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 6 }}>{time}</div>
    </div>
  )
}

// ─── 1:1 Chat Thread ──────────────────────────────────────────────────────
function ChatThread({ contact }: { contact: Contact }) {
  const { user } = useAuth()
  const { data: messages = [] } = useMessages(contact.id)
  const { mutate: markRead } = useMarkRead()
  const { mutateAsync: sendMsg, isPending } = useSendMessage()
  const { mutateAsync: uploadFile } = useUploadAttachment()
  const { error: showError } = useToast()
  const [text, setText] = useState('')
  const [attachUrl, setAttachUrl] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const isDos = user?.role === 'dos'

  // Mark thread as read when opened
  useEffect(() => {
    if (contact.unreadCount > 0) markRead(contact.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact.id])

  // Scroll to bottom on new messages
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        fontWeight: 700, fontSize: 14, color: 'var(--txt)',
      }}>
        {contact.name}
        <span style={{ marginLeft: 8, fontWeight: 400, fontSize: 12, color: 'var(--txt3)',
          textTransform: 'capitalize' }}>
          {contact.role.replace('_', ' ')}
        </span>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {messages.map(m => (
          <ChatBubble key={m.id} msg={m} isMine={m.fromUserId === user?.id} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ borderTop: '1px solid var(--border)', position: 'relative' }}>
        {/* DoS templates dropdown */}
        {isDos && showTemplates && (
          <div style={{
            position: 'absolute', bottom: '100%', left: 12, right: 12, zIndex: 20,
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '8px 12px', fontWeight: 700, fontSize: 11,
              color: 'var(--txt3)', borderBottom: '1px solid var(--border)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Message Templates
            </div>
            {DOS_TEMPLATES.map((t, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setText(t.body); setShowTemplates(false) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '10px 12px', border: 'none', background: 'none',
                  cursor: 'pointer', borderBottom: i < DOS_TEMPLATES.length - 1 ? '1px solid var(--border)' : 'none',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--txt)', marginBottom: 2 }}>
                  {t.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--txt3)' }}>
                  <HighlightedTemplate body={t.body} />
                </div>
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={e => { void handleSend(e) }}
          style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'flex-end' }}
        >
          {attachUrl && (
            <div style={{
              fontSize: 11, color: 'var(--brand)', padding: '2px 8px',
              background: 'var(--brand-light)', borderRadius: 6, alignSelf: 'center',
            }}>
              Attached
              <button type="button" onClick={() => setAttachUrl(null)}
                style={{ marginLeft: 4, border: 'none', background: 'none',
                  cursor: 'pointer', color: 'var(--danger)', fontWeight: 700 }}>✕</button>
            </div>
          )}
          {/* DoS templates toggle button */}
          {isDos && (
            <button
              type="button"
              onClick={() => setShowTemplates(v => !v)}
              style={{
                border: '1px solid var(--border)', borderRadius: 10,
                background: showTemplates ? 'var(--brand-light)' : 'var(--surface2)',
                padding: '8px 10px', cursor: 'pointer',
                color: showTemplates ? 'var(--brand)' : 'var(--txt3)', flexShrink: 0,
              }}
              title="Message templates"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{
              border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface2)',
              padding: '8px 10px', cursor: 'pointer', color: 'var(--txt3)', flexShrink: 0,
            }}
            title="Attach file (max 5MB)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => { void handleFile(e) }}
          />
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { void handleSend(e); } }}
            placeholder="Type a message…"
            rows={1}
            className="sui-input"
            style={{ flex: 1, resize: 'none', padding: '8px 12px' }}
          />
          <button
            type="submit"
            disabled={isPending || (!text.trim() && !attachUrl)}
            className="sui-btn-primary"
            style={{ padding: '8px 16px', flexShrink: 0 }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Announcements Channel ─────────────────────────────────────────────────
function AnnouncementsChannel() {
  const { user } = useAuth()
  const { data: announcements = [] } = useAnnouncements()
  const { mutateAsync: post, isPending } = usePostAnnouncement()
  const { error: showError } = useToast()
  const [text, setText] = useState('')
  const canPost = user && (CAN_POST_ROLES as readonly string[]).includes(user.role)

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    try {
      const body = text.trim()
      await post({ body })
      setText('')
      // Fire-and-forget: broadcast via Edge Function for push notifications
      void supabase.functions.invoke('broadcast-announcement', { body: { body, role: user?.role } })
    } catch (err: any) {
      showError(err.message)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border)',
        fontWeight: 700, fontSize: 14, color: 'var(--violet)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        Announcements
        <span style={{ fontSize: 11, color: 'var(--txt3)', fontWeight: 400 }}>
          (all staff can read)
        </span>
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {announcements.length === 0 ? (
          <div style={{ color: 'var(--txt3)', fontSize: 13, textAlign: 'center', paddingTop: 32 }}>
            No announcements yet.
          </div>
        ) : (
          [...announcements].reverse().map(a => (
            <AnnouncementBubble key={a.id} ann={a} />
          ))
        )}
      </div>

      {/* Post input — only for permitted roles */}
      {canPost && (
        <form
          onSubmit={e => { void handlePost(e) }}
          style={{
            padding: 12, borderTop: '1px solid var(--border)',
            display: 'flex', gap: 8, alignItems: 'flex-end',
          }}
        >
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Post an announcement to all staff…"
            rows={2}
            className="sui-input"
            style={{ flex: 1, resize: 'none' }}
          />
          <button
            type="submit"
            disabled={isPending || !text.trim()}
            className="sui-btn-primary"
            style={{ padding: '8px 16px', flexShrink: 0, alignSelf: 'flex-end' }}
          >
            {isPending ? 'Posting…' : 'Post'}
          </button>
        </form>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGING PAGE
// ═══════════════════════════════════════════════════════════════════════════
export function MessagingPage() {
  const { data: contacts = [], isLoading } = useContacts()
  const [activeContact, setActiveContact] = useState<Contact | 'announcements' | null>(null)

  return (
    <div style={{
      display: 'flex', height: 'calc(100vh - 100px)',
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, overflow: 'hidden',
    }}>
      {/* ─── Contact List ──────────────────────────────────────────────── */}
      <div style={{
        width: 260, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          padding: '14px 14px 10px',
          fontWeight: 900, fontSize: 15,
          fontFamily: 'var(--font2)', color: 'var(--txt)',
          borderBottom: '1px solid var(--border)',
        }}>
          Messages
        </div>

        {/* Announcements channel — always at top */}
        <div
          onClick={() => setActiveContact('announcements')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', cursor: 'pointer',
            background: activeContact === 'announcements' ? 'var(--violet-bg)' : 'transparent',
            borderLeft: activeContact === 'announcements' ? '3px solid var(--violet)' : '3px solid transparent',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--violet-bg)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--violet)" strokeWidth="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>Announcements</div>
            <div style={{ fontSize: 11, color: 'var(--violet)' }}>All staff</div>
          </div>
        </div>

        {/* Staff contacts */}
        {isLoading && (
          <div style={{ padding: 16, color: 'var(--txt3)', fontSize: 12 }}>Loading contacts…</div>
        )}
        {contacts.map(c => (
          <ContactItem
            key={c.id}
            contact={c}
            isActive={activeContact !== 'announcements' && (activeContact as Contact)?.id === c.id}
            onClick={() => setActiveContact(c)}
          />
        ))}
      </div>

      {/* ─── Thread Panel ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeContact === null ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--txt3)', fontSize: 14, flexDirection: 'column', gap: 12,
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            Select a contact to start messaging
          </div>
        ) : activeContact === 'announcements' ? (
          <AnnouncementsChannel />
        ) : (
          <ChatThread contact={activeContact as Contact} />
        )}
      </div>
    </div>
  )
}
