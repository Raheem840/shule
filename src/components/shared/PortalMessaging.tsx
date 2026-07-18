import { useState, useRef, useEffect } from 'react'
import { useMessages, useSendMessage, useUploadAttachment } from '../../hooks/useMessaging'
import { useToast } from '../ui/Toast'
import type { StaffContact } from '../../hooks/useParentPortal'
import type { Message } from '../../types/app'

// ── Shared 1:1 portal chat (parent/student ↔ bursar/class teacher) ────────
// Used by both ParentPortalPage and StudentPortalPage — a parent has one
// contact per child's class plus the bursar, a student has exactly one class
// teacher plus the bursar, but the chat UI itself (thread, composer,
// attachments) is identical either way. Routes through useMessages/
// useSendMessage/useUploadAttachment (realtime + attachments), the same
// hooks the staff-to-staff messaging system uses.
function PortalChatThread({ contact, myId }: { contact: StaffContact; myId: string }) {
  const { data: messages = [], isLoading } = useMessages(contact.authUserId)
  const sendMsg = useSendMessage()
  const upload  = useUploadAttachment()
  const { error: toastErr } = useToast()
  const [draft, setDraft]           = useState('')
  const [attachUrl, setAttachUrl]   = useState<string | null>(null)
  const [attachName, setAttachName] = useState<string | null>(null)
  const [uploading, setUploading]   = useState(false)
  const fileRef   = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const url = await upload.mutateAsync(file)
      setAttachUrl(url)
      setAttachName(file.name)
    } catch (err) {
      toastErr(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleSend() {
    if (sendMsg.isPending) return // guards rapid double-Enter, not just the Send button's disabled state
    const text = draft.trim()
    if (!text && !attachUrl) return
    setDraft('')
    const url = attachUrl, name = attachName
    setAttachUrl(null); setAttachName(null)
    await sendMsg.mutateAsync({
      toUserId:       contact.authUserId,
      body:           text,
      attachmentUrl:  url,
      attachmentName: name,
    })
  }

  const roleLabel = contact.role === 'class_teacher'
    ? (contact.contextLabel ? `Class Teacher · ${contact.contextLabel}` : 'Class Teacher')
    : contact.role === 'bursar' ? 'School Bursar' : contact.role

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '0.75rem 1.25rem', background: 'linear-gradient(135deg,rgba(13,148,136,.08),rgba(14,165,233,.06))', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand),var(--info))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'var(--font2)', fontWeight: 900, fontSize: 13, flexShrink: 0 }}>
          {contact.firstName[0]}{contact.lastName[0]}
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 13.5, color: 'var(--txt)' }}>{contact.firstName} {contact.lastName}</div>
          <div style={{ fontSize: 10.5, color: 'var(--brand)', fontWeight: 700 }}>{roleLabel}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
        {isLoading && [0, 1, 2].map(i => (
          <div key={i} style={{ display: 'flex', justifyContent: i % 2 === 0 ? 'flex-end' : 'flex-start' }}>
            <div style={{ width: '55%', height: 44, borderRadius: 14, background: 'var(--surface2)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          </div>
        ))}
        {!isLoading && messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '2rem', textAlign: 'center' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(13,148,136,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt2)' }}>Start the conversation</div>
            <div style={{ fontSize: 12, color: 'var(--txt3)' }}>Send a message to {contact.firstName} below.</div>
          </div>
        )}
        {messages.map((msg: Message) => {
          const isOwn = msg.fromUserId === myId
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isOwn ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '78%', background: isOwn ? 'linear-gradient(135deg,var(--brand),var(--info))' : 'var(--surface2)', color: isOwn ? '#fff' : 'var(--txt)', borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px', padding: '0.65rem 1rem', boxShadow: isOwn ? '0 4px 14px rgba(13,148,136,.3)' : '0 1px 3px rgba(0,0,0,.08)' }}>
                {msg.attachmentUrl && (
                  <a href={msg.attachmentUrl} target="_blank" rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, padding: '4px 10px', borderRadius: 8, textDecoration: 'none', fontSize: 12, fontWeight: 700, color: isOwn ? '#fff' : 'var(--brand)', background: isOwn ? 'rgba(255,255,255,.18)' : 'rgba(13,148,136,.08)' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                    {msg.attachmentName ?? 'Attachment'}
                  </a>
                )}
                {msg.body && <div style={{ fontSize: 13.5, lineHeight: 1.55, wordBreak: 'break-word' }}>{msg.body}</div>}
                <div style={{ fontSize: 10, marginTop: 4, color: isOwn ? 'rgba(255,255,255,.6)' : 'var(--txt3)', textAlign: 'right' }}>
                  {new Date(msg.sentAt).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { void handleFile(e) }} />
      <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {attachName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 10, background: 'rgba(13,148,136,.1)', width: 'fit-content' }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--brand)' }}>{attachName}</span>
            <button onClick={() => { setAttachUrl(null); setAttachName(null) }} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            title="Attach a file"
            style={{ width: 42, height: 42, borderRadius: '50%', border: '1.5px solid var(--border)', background: 'var(--surface2)', color: 'var(--txt3)', cursor: uploading ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            {uploading
              ? <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--brand)', animation: 'spin .7s linear infinite' }} />
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
            }
          </button>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
            placeholder={`Message ${contact.firstName}…`}
            rows={1}
            // fontSize 16 (not 13.5) — anything smaller makes iOS Safari
            // auto-zoom the whole page on focus, which on a chat composer
            // used from a phone is jarring every single time it's tapped.
            style={{ flex: 1, resize: 'none', border: '1.5px solid var(--border)', borderRadius: 14, padding: '10px 14px', fontSize: 16, fontFamily: 'var(--font)', color: 'var(--txt)', background: 'var(--surface2)', outline: 'none', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }}
          />
          <button
            onClick={() => { void handleSend() }}
            disabled={(!draft.trim() && !attachUrl) || sendMsg.isPending}
            style={{ width: 42, height: 42, borderRadius: '50%', border: 'none', background: (draft.trim() || attachUrl) ? 'linear-gradient(135deg,var(--brand),var(--info))' : 'var(--surface2)', color: (draft.trim() || attachUrl) ? '#fff' : 'var(--txt3)', cursor: (draft.trim() || attachUrl) ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .2s' }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: 'rotate(90deg)' }}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shared contacts-sidebar + thread layout ────────────────────────────────
export function PortalMessagesTab({
  contacts, isLoading, myId,
}: {
  contacts:  StaffContact[]
  isLoading: boolean
  myId:      string
}) {
  const [selectedContact, setSelectedContact] = useState<StaffContact | null>(null)

  useEffect(() => {
    if ((!selectedContact || !contacts.some(c => c.authUserId === selectedContact.authUserId)) && contacts.length > 0) {
      setSelectedContact(contacts[0])
    }
  }, [contacts, selectedContact])

  if (isLoading) {
    return <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'center', color: 'var(--txt3)', fontSize: 13 }}>Loading contacts…</div>
  }

  if (contacts.length === 0) {
    return (
      <div style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt2)' }}>No contacts available</div>
        <div style={{ fontSize: 12.5, color: 'var(--txt3)' }}>The school bursar and class teacher are not yet set up. Contact the school office.</div>
      </div>
    )
  }

  return (
    <div className="portal-msg-shell" style={{ display: 'flex', height: '60vh', minHeight: 320, overflow: 'hidden' }}>
      <div className="portal-msg-rail" style={{ width: 'clamp(72px, 30%, 180px)', flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface2)', overflowY: 'auto' }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 10, fontWeight: 800, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: .5 }}>Contacts</div>
        {contacts.map(c => {
          const isSel = selectedContact?.authUserId === c.authUserId
          const roleLabel = c.role === 'class_teacher'
            ? (c.contextLabel ? `Teacher · ${c.contextLabel}` : 'Class Teacher')
            : 'School Bursar'
          return (
            <button key={c.authUserId} onClick={() => setSelectedContact(c)}
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 12px', border: 'none', cursor: 'pointer', background: isSel ? 'rgba(13,148,136,.1)' : 'transparent', borderLeft: `3px solid ${isSel ? 'var(--brand)' : 'transparent'}`, textAlign: 'left', transition: 'all .15s' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: isSel ? 'linear-gradient(135deg,var(--brand),var(--info))' : 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSel ? '#fff' : 'var(--txt2)', fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                {c.firstName[0]}{c.lastName[0]}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: isSel ? 'var(--brand)' : 'var(--txt)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.firstName}</div>
                <div style={{ fontSize: 10.5, color: 'var(--txt3)', fontWeight: 600 }}>{roleLabel}</div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="portal-msg-thread" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedContact
          ? <PortalChatThread key={selectedContact.authUserId} contact={selectedContact} myId={myId} />
          : <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt3)', fontSize: 13 }}>Select a contact</div>
        }
      </div>
    </div>
  )
}
