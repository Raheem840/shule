/**
 * TeacherParentMessagesPage.tsx
 *
 * Identical structure to BursarMessagesPage — teachers see parent messages
 * for students in their class(es). The contact list subtitle shows:
 * "Parent of [student name] · [student's class name]"
 *
 * Reuses the same hooks: useParentConversations, useConversationWithParent,
 * useSendMessageToParent, useMarkParentThreadRead — they all filter by
 * to_user_id = current user, so they work for any staff role.
 */
import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../store/AuthContext'
import { useToast } from '../../components/ui/Toast'
import { useIsMobile } from '../../hooks/useIsMobile'
import {
  useParentConversations,
  useConversationWithParent,
  useSendMessageToParent,
  useMarkParentThreadRead,
  useUploadAttachment,
  useSearchStudentsForMessaging,
  type ParentConversation,
  type StudentParentResult,
} from '../../hooks/useMessaging'
import { supabase } from '../../lib/supabase'
import { useQuery } from '@tanstack/react-query'
import type { Message } from '../../types/app'

// ─── Palette / helpers ─────────────────────────────────────────────────────
const COLORS = ['#0d9488','#6366f1','#0ea5e9','#f59e0b','#f43f5e','#10b981','#ec4899','#8b5cf6']
const DARKS  = ['#0f766e','#4f46e5','#0284c7','#d97706','#e11d48','#059669','#db2777','#7c3aed']
function colorFor(s: string): [string, string] {
  const i = ((s.charCodeAt(0) || 65) + (s.charCodeAt(1) || 65)) % COLORS.length
  return [COLORS[i], DARKS[i]]
}
function initials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}
function formatDay(iso: string): string {
  const d = new Date(iso), n = new Date()
  if (d.toDateString() === n.toDateString()) return 'Today'
  const y = new Date(n); y.setDate(n.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── useStudentClassMap ─────────────────────────────────────────────────────
// Returns a map of studentId → className for this school
function useStudentClassMap() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['student-class-map', user?.schoolId],
    enabled: !!user?.schoolId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('students')
        .select('id, class_id, classes!inner(name)')
        .eq('school_id', user!.schoolId)
        .eq('status', 'active')
      const map = new Map<string, string>()
      for (const s of (data ?? []) as any[]) {
        if (s.id && s.classes?.name) map.set(s.id as string, s.classes.name as string)
      }
      return map
    },
  })
}

// ── useTeacherClassName ────────────────────────────────────────────────────
// Gets the teacher's primary class name (for the page header)
function useTeacherClassName() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['teacher-class-name', user?.schoolId, user?.staffId],
    enabled: !!user?.schoolId && !!user?.staffId,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      // Try streams first
      const { data: stream } = await supabase
        .from('streams')
        .select('classes!inner(name)')
        .eq('school_id', user!.schoolId)
        .eq('class_teacher_id', user!.staffId!)
        .limit(1)
        .maybeSingle()
      if (stream) return (stream as any).classes?.name as string | null

      // Fallback: staff.classes array → first class name
      const { data: staff } = await supabase
        .from('staff')
        .select('classes')
        .eq('id', user!.staffId!)
        .eq('school_id', user!.schoolId)
        .maybeSingle()
      const classIds = ((staff as any)?.classes ?? []) as string[]
      if (classIds.length === 0) return null

      const { data: cls } = await supabase
        .from('classes')
        .select('name')
        .eq('id', classIds[0])
        .eq('school_id', user!.schoolId)
        .maybeSingle()
      return (cls as any)?.name as string | null
    },
  })
}

// ─── Styles (same variables as BursarMessagesPage) ─────────────────────────
const STYLES = `
  .tpm-page {
    --ms-cl-bg:         #ffffff;
    --ms-cl-border:     1px solid #e9edf0;
    --ms-cl-title:      #0f172a;
    --ms-cl-name:       #1e293b;
    --ms-cl-sub:        #64748b;
    --ms-cl-sep:        rgba(0,0,0,.055);
    --ms-cl-row-hover:  rgba(13,148,136,.05);
    --ms-cl-row-active: rgba(13,148,136,.09);
    --ms-cl-search-bg:  #f1f5f9;
    --ms-cl-search-bdr: 1px solid #e2e8f0;
    --ms-cl-search-txt: #1e293b;
    --ms-cl-search-ph:  #94a3b8;

    --ms-hdr-bg:        #ffffff;
    --ms-hdr-shadow:    0 1px 8px rgba(0,0,0,.08);
    --ms-hdr-name:      #0f172a;
    --ms-hdr-sub:       #64748b;
    --ms-hdr-btn-bg:    rgba(0,0,0,.06);
    --ms-hdr-btn-hover: rgba(0,0,0,.11);
    --ms-hdr-btn-clr:   #475569;

    --ms-feed-bg:       #efeae2;
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
    --ms-empty-txt1:    #475569;
    --ms-empty-txt2:    #94a3b8;
    --ms-empty-bg:      #f0f2f5;
    --ms-ring-clr:      rgba(13,148,136,.12);
    --ms-skeleton-op:   1;
  }
  .ar[data-theme=dark] .tpm-page {
    --ms-cl-bg:         #111827;
    --ms-cl-border:     1px solid rgba(255,255,255,.04);
    --ms-cl-title:      #f1f5f9;
    --ms-cl-name:       #e2e8f0;
    --ms-cl-sub:        #475569;
    --ms-cl-sep:        rgba(255,255,255,.05);
    --ms-cl-row-hover:  rgba(255,255,255,.06);
    --ms-cl-row-active: rgba(255,255,255,.1);
    --ms-cl-search-bg:  rgba(255,255,255,.07);
    --ms-cl-search-bdr: 1px solid rgba(255,255,255,.09);
    --ms-cl-search-txt: #e2e8f0;
    --ms-cl-search-ph:  #475569;

    --ms-hdr-bg:        #1a2535;
    --ms-hdr-shadow:    0 2px 16px rgba(0,0,0,.45);
    --ms-hdr-name:      #f1f5f9;
    --ms-hdr-sub:       rgba(255,255,255,.38);
    --ms-hdr-btn-bg:    rgba(255,255,255,.08);
    --ms-hdr-btn-hover: rgba(255,255,255,.16);
    --ms-hdr-btn-clr:   rgba(255,255,255,.75);

    --ms-feed-bg:       #0d1623;
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
    --ms-empty-txt1:    #64748b;
    --ms-empty-txt2:    #475569;
    --ms-empty-bg:      #0d1623;
    --ms-ring-clr:      rgba(13,148,136,.15);
    --ms-skeleton-op:   .25;
  }

  .tpm-chat-feed { overflow-y: auto; -webkit-overflow-scrolling: touch; scroll-behavior: smooth }
  .tpm-chat-feed::-webkit-scrollbar       { width: 4px }
  .tpm-chat-feed::-webkit-scrollbar-track { background: transparent }
  .tpm-chat-feed::-webkit-scrollbar-thumb { background: rgba(0,0,0,.15); border-radius: 4px }

  .tpm-c-row {
    display: flex; align-items: center; gap: 14px;
    padding: 11px 18px; cursor: pointer; min-height: 76px;
    border-bottom: 1px solid var(--ms-cl-sep);
    transition: background .12s; -webkit-tap-highlight-color: transparent;
    user-select: none;
  }
  .tpm-c-row:hover  { background: var(--ms-cl-row-hover) }
  .tpm-c-row:active { background: var(--ms-cl-row-active) !important }

  .tpm-bbl-me {
    background: linear-gradient(150deg, #0ea5e9 0%, #0d9488 100%);
    color: #fff; border-radius: 18px 18px 3px 18px;
    box-shadow: 0 3px 16px rgba(13,148,136,.32);
    animation: tpmBblMe .18s cubic-bezier(.2,.8,.4,1) both;
  }
  .tpm-bbl-them {
    background: var(--ms-them-bg); color: var(--ms-them-clr);
    border-radius: 18px 18px 18px 3px; box-shadow: var(--ms-them-shadow);
    animation: tpmBblThem .18s cubic-bezier(.2,.8,.4,1) both;
  }
  .tpm-msg-bg {
    background-color: var(--ms-feed-bg);
    background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.022'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  }
  .tpm-input-bar {
    background: var(--ms-ibar-bg); border-top: var(--ms-ibar-bdr);
    padding: 10px 14px 14px; flex-shrink: 0;
  }
  .tpm-input-field {
    flex: 1; border-radius: 24px; padding: 10px 16px;
    font-size: 15px; line-height: 1.5; resize: none;
    border: none; outline: none;
    background: var(--ms-ifield-bg); color: var(--ms-ifield-clr);
    font-family: inherit; max-height: 130px; box-shadow: var(--ms-ifield-shadow);
  }
  .tpm-send-btn {
    width: 44px; height: 44px; border-radius: 50%; border: none;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; flex-shrink: 0;
    transition: transform .16s, box-shadow .16s;
    -webkit-tap-highlight-color: transparent;
  }
  .tpm-send-btn:active { transform: scale(.9) }
  .tpm-date-pill {
    display: inline-flex; padding: 3px 14px; border-radius: 99px;
    background: var(--ms-pill-bg); font-size: 11px; font-weight: 700;
    color: var(--ms-pill-clr); letter-spacing: .5px;
  }

  @keyframes tpmBblMe   { from{opacity:0;transform:translateX(14px)} to{opacity:1;transform:none} }
  @keyframes tpmBblThem { from{opacity:0;transform:translateX(-14px)} to{opacity:1;transform:none} }
  @keyframes tpmFadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
  @keyframes tpmSpin    { to{transform:rotate(360deg)} }
  @keyframes tpmRing    { to{transform:rotate(360deg)} }
`

// ─── Avatar ────────────────────────────────────────────────────────────────
function Av({ name, size = 46 }: { name: string; size?: number }) {
  const [c1, c2] = colorFor(name)
  const fs = Math.round(size * .36)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(145deg,${c1},${c2})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: fs, fontWeight: 800, color: '#fff',
      fontFamily: 'var(--font2)', userSelect: 'none',
      boxShadow: `0 2px 12px ${c1}55`,
    }}>
      {initials(name)}
    </div>
  )
}

// ─── Input bar ─────────────────────────────────────────────────────────────
function InputBar({ onSend, sending, onFileClick, attach, onClearAttach }: {
  onSend: (text: string, attachUrl: string | null) => void
  sending: boolean
  onFileClick?: () => void
  attach?: string | null
  onClearAttach?: () => void
}) {
  const [text, setText] = useState('')
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const canSend = !!(text.trim() || attach)

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
    onClearAttach?.()
  }

  return (
    <div className="tpm-input-bar">
      {attach && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '6px 12px', borderRadius: 12, background: 'rgba(13,148,136,.1)', border: '.5px solid rgba(13,148,136,.25)', width: 'fit-content' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2.4"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--brand)' }}>File attached</span>
          <button onClick={onClearAttach} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 18, lineHeight: 1, padding: '0 0 0 4px' }}>×</button>
        </div>
      )}
      <form onSubmit={send} style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        {onFileClick && (
          <button type="button" onClick={onFileClick}
            style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--ms-iicon-clr)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'color .14s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#0d9488')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ms-iicon-clr)')}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
          </button>
        )}
        <textarea
          ref={areaRef}
          className="tpm-input-field"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Reply to parent…"
          rows={1}
        />
        <button type="submit" disabled={!canSend || sending} className="tpm-send-btn"
          style={{
            background: canSend ? 'linear-gradient(145deg,#0ea5e9,#0d9488)' : 'var(--surface2)',
            boxShadow: canSend ? '0 4px 16px rgba(13,148,136,.45)' : 'none',
          }}>
          {sending
            ? <svg style={{ animation: 'tpmSpin .7s linear infinite' }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeOpacity=".3"/><path d="M12 2a10 10 0 010 20"/></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><polygon points="2,21 23,12 2,3 2,10 17,12 2,14"/></svg>
          }
        </button>
      </form>
    </div>
  )
}

// ─── Thread panel ──────────────────────────────────────────────────────────
function ThreadPanel({ conv, onBack, classNameMap: _classNameMap }: {
  conv: ParentConversation
  onBack?: () => void
  classNameMap?: Map<string, string>
}) {
  const { user } = useAuth()
  const { data: msgs = [] } = useConversationWithParent(conv.parentAuthUserId)
  const { mutate: markRead } = useMarkParentThreadRead()
  const { mutateAsync: send, isPending } = useSendMessageToParent()
  const { mutateAsync: upload } = useUploadAttachment()
  const { error: toastErr } = useToast()
  const [attach, setAttach] = useState<string | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [c1] = colorFor(conv.parentName)

  // Build subtitle with class names for each student
  const subtitle = conv.studentNames.map((sName, _i) => {
    // We can't easily map sName → classId here since we only have names
    // Use classNameMap lookup on studentNames indirectly isn't possible without IDs
    // So just show "Parent of [names]"
    return sName
  })
  const subtitleText = `Parent of ${subtitle.join(', ')}`

  useEffect(() => {
    if (conv.unreadCount > 0) markRead(conv.parentAuthUserId)
  }, [conv.parentAuthUserId])

  useLayoutEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs.length])

  async function handleSend(text: string, attachUrl: string | null) {
    try { await send({ toUserId: conv.parentAuthUserId, body: text, attachmentUrl: attachUrl }) }
    catch (e: any) { toastErr(e.message ?? 'Failed to send') }
    setAttach(null)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    try { setAttach(await upload(f)) }
    catch (e: any) { toastErr(e.message ?? 'Upload failed') }
  }

  const groups: { day: string; items: Message[] }[] = []
  for (const m of msgs) {
    const d = formatDay(m.sentAt)
    const last = groups.at(-1)
    if (!last || last.day !== d) groups.push({ day: d, items: [m] })
    else last.items.push(m)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ background: 'var(--ms-hdr-bg)', flexShrink: 0, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 13, height: 62, boxShadow: 'var(--ms-hdr-shadow)' }}>
        {onBack && (
          <button onClick={onBack}
            style={{ width: 38, height: 38, borderRadius: 12, border: 'none', background: 'var(--ms-hdr-btn-bg)', color: 'var(--ms-hdr-btn-clr)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .13s', WebkitTapHighlightColor: 'transparent' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--ms-hdr-btn-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--ms-hdr-btn-bg)')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        )}
        <Av name={conv.parentName} size={40} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--ms-hdr-name)', letterSpacing: -.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{conv.parentName}</div>
          <div style={{ fontSize: 12, color: 'var(--ms-hdr-sub)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitleText}</div>
        </div>
      </div>

      <div ref={feedRef} className="tpm-chat-feed tpm-msg-bg" style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {msgs.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, animation: 'tpmFadeUp .3s ease both' }}>
            <div style={{ width: 84, height: 84, borderRadius: '50%', background: `linear-gradient(145deg,${c1}22,${c1}0a)`, border: `2px solid ${c1}2a`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Av name={conv.parentName} size={62} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ms-empty-txt1)', fontFamily: 'var(--font2)', marginBottom: 4 }}>{conv.parentName}</div>
              <div style={{ fontSize: 13.5, color: 'var(--ms-empty-txt2)' }}>No messages in this thread yet</div>
            </div>
          </div>
        ) : (
          groups.map(({ day, items }) => (
            <div key={day}>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 10px' }}>
                <span className="tpm-date-pill">{day}</span>
              </div>
              {items.map((m, idx) => {
                const mine = m.fromUserId === user?.id
                return (
                  <div key={m.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', marginBottom: 3, paddingLeft: mine ? 60 : 0, paddingRight: mine ? 0 : 60, animationDelay: `${Math.min(idx * .02, .15)}s` }}>
                    <div className={mine ? 'tpm-bbl-me' : 'tpm-bbl-them'} style={{ padding: '8px 12px 6px', maxWidth: '72%', position: 'relative' }}>
                      {m.attachmentUrl && (
                        <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: mine ? 'rgba(255,255,255,.9)' : '#0d9488', fontSize: 12.5, fontWeight: 600, textDecoration: 'none', padding: '4px 10px', borderRadius: 8, background: mine ? 'rgba(255,255,255,.18)' : 'rgba(13,148,136,.08)' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                          Attachment
                        </a>
                      )}
                      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, wordBreak: 'break-word' }}>{m.body}</p>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: mine ? 'var(--ms-me-time)' : 'var(--ms-them-time)' }}>{formatTime(m.sentAt)}</span>
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

      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls" style={{ display: 'none' }} onChange={e => { void handleFile(e) }} />
      <InputBar onSend={handleSend} sending={isPending} attach={attach} onClearAttach={() => setAttach(null)} onFileClick={() => fileRef.current?.click()} />
    </div>
  )
}

// ─── Contact list (with compose / new-conversation flow) ───────────────────
function ContactList({ convs, loading, onSelect, activeId }: {
  convs: ParentConversation[]
  loading: boolean
  onSelect: (c: ParentConversation) => void
  activeId: string | null
}) {
  const [q, setQ]               = useState('')
  const [composing, setComposing] = useState(false)
  const [searchQ, setSearchQ]     = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(searchQ), 300)
    return () => clearTimeout(t)
  }, [searchQ])

  const { data: searchResults = [], isFetching: searching } =
    useSearchStudentsForMessaging(debouncedQ)

  const filtered = q.trim()
    ? convs.filter(c =>
        c.parentName.toLowerCase().includes(q.toLowerCase()) ||
        c.studentNames.some(s => s.toLowerCase().includes(q.toLowerCase()))
      )
    : convs

  const totalUnread = convs.reduce((s, c) => s + c.unreadCount, 0)

  function startConversation(r: StudentParentResult) {
    const synthetic: ParentConversation = {
      parentAuthUserId: r.parentAuthUserId,
      parentName:       r.parentName,
      studentNames:     r.studentNames,
      latestBody:       '',
      latestSentAt:     new Date().toISOString(),
      unreadCount:      0,
    }
    setComposing(false)
    setSearchQ('')
    onSelect(synthetic)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--ms-cl-bg)', borderRight: 'var(--ms-cl-border)' }}>
      <div style={{ padding: '18px 18px 14px', flexShrink: 0, borderBottom: 'var(--ms-cl-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ flex: 1, fontSize: 20, fontWeight: 900, color: 'var(--ms-cl-title)', fontFamily: 'var(--font2)', letterSpacing: -.5 }}>Parent Messages</span>
          {totalUnread > 0 && !composing && (
            <div style={{ background: 'linear-gradient(135deg,#0d9488,#0ea5e9)', color: '#fff', borderRadius: 99, fontSize: 12, fontWeight: 800, padding: '2px 10px', boxShadow: '0 3px 12px rgba(13,148,136,.5)', marginRight: 8 }}>
              {totalUnread > 99 ? '99+' : totalUnread}
            </div>
          )}
          <button
            onClick={() => { setComposing(v => !v); setSearchQ('') }}
            title={composing ? 'Cancel' : 'New Conversation'}
            style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: composing ? 'rgba(13,148,136,.15)' : 'var(--ms-cl-search-bg)', color: composing ? '#0d9488' : 'var(--ms-cl-sub)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .14s', flexShrink: 0 }}
          >
            {composing
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            }
          </button>
        </div>

        {composing ? (
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ms-cl-search-ph)" strokeWidth="2.4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              autoFocus value={searchQ} onChange={e => setSearchQ(e.target.value)}
              placeholder="Search student name…"
              style={{ width: '100%', paddingLeft: 36, height: 40, borderRadius: 12, background: 'var(--ms-cl-search-bg)', border: '1.5px solid #0d9488', fontSize: 14, color: 'var(--ms-cl-search-txt)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }}
            />
            {searching && (
              <svg style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', animation: 'tpmSpin .7s linear infinite' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ms-cl-search-ph)" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".25"/><path d="M12 2a10 10 0 010 20"/></svg>
            )}
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ms-cl-search-ph)" strokeWidth="2.4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search parents or students…"
              style={{ width: '100%', paddingLeft: 36, height: 40, borderRadius: 12, background: 'var(--ms-cl-search-bg)', border: 'var(--ms-cl-search-bdr)', fontSize: 14, color: 'var(--ms-cl-search-txt)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
          </div>
        )}
      </div>

      {composing ? (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!debouncedQ.trim() && (
            <div style={{ padding: '32px 18px', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(13,148,136,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0d9488" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ms-cl-name)', marginBottom: 4 }}>Find a student</div>
              <div style={{ fontSize: 12.5, color: 'var(--ms-cl-sub)', lineHeight: 1.6 }}>Type a student's name to find their parent and start a conversation</div>
            </div>
          )}
          {debouncedQ.trim() && !searching && searchResults.length === 0 && (
            <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--ms-cl-sub)', fontSize: 13.5 }}>
              No parents found for "{debouncedQ}".
              <div style={{ fontSize: 12, marginTop: 6 }}>The parent may not have an active account yet.</div>
            </div>
          )}
          {searchResults.map(r => {
            const [col] = colorFor(r.parentName)
            return (
              <div key={r.parentAuthUserId} onClick={() => startConversation(r)} className="tpm-c-row">
                <Av name={r.parentName} size={48} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, color: 'var(--ms-cl-name)', marginBottom: 2 }}>{r.parentName}</div>
                  <div style={{ fontSize: 12, color: 'var(--ms-cl-sub)', marginBottom: 1 }}>Parent of {r.studentNames.join(', ')}</div>
                  <div style={{ fontSize: 11.5, color: '#0d9488', fontFamily: 'var(--font3)' }}>{r.admissionNumbers.join(', ')}</div>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${col}14`, border: `1px solid ${col}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <>
          <div style={{ padding: '8px 18px 4px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1.2, flexShrink: 0 }}>
            {filtered.length > 0 ? `Parents (${filtered.length})` : 'No conversations yet — use ✏ to start one'}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {loading && Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 18px', minHeight: 76 }}>
                <div className="shule-skeleton" style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, opacity: 'var(--ms-skeleton-op)' as any }} />
                <div style={{ flex: 1 }}>
                  <div className="shule-skeleton" style={{ height: 13, borderRadius: 6, marginBottom: 7, width: '55%', opacity: 'var(--ms-skeleton-op)' as any }} />
                  <div className="shule-skeleton" style={{ height: 10, borderRadius: 5, width: '75%', opacity: 'var(--ms-skeleton-op)' as any }} />
                </div>
              </div>
            ))}

            {!loading && filtered.length === 0 && (
              <div style={{ padding: '40px 18px', textAlign: 'center' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ms-cl-name)', marginBottom: 6 }}>
                  {q ? 'No matches found' : 'No conversations yet'}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ms-cl-sub)', lineHeight: 1.7 }}>
                  {q ? 'Try a different name.' : 'Tap the ✏ button above to search for a student and message their parent.'}
                </div>
              </div>
            )}

            {filtered.map(c => {
              const isActive = activeId === c.parentAuthUserId
              const [col] = colorFor(c.parentName)
              return (
                <div key={c.parentAuthUserId} onClick={() => onSelect(c)} className="tpm-c-row"
                  style={{ background: isActive ? `${col}18` : undefined, borderLeft: `3.5px solid ${isActive ? col : 'transparent'}` }}>
                  <Av name={c.parentName} size={52} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: isActive ? col : 'var(--ms-cl-name)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: -.1, flex: 1, minWidth: 0 }}>{c.parentName}</span>
                      <span style={{ fontSize: 11, color: 'var(--ms-cl-sub)', flexShrink: 0 }}>{relativeTime(c.latestSentAt)}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--ms-cl-sub)', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {`Parent of ${c.studentNames.join(', ')}`}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--ms-cl-sub)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: .8 }}>{c.latestBody}</div>
                  </div>
                  {c.unreadCount > 0 && (
                    <div style={{ background: `linear-gradient(145deg,${col},${DARKS[COLORS.indexOf(col)] ?? col})`, color: '#fff', borderRadius: 99, fontSize: 12, fontWeight: 800, minWidth: 22, height: 22, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 2px 10px ${col}55` }}>
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

// ─── Empty state ───────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 40, background: 'var(--ms-empty-bg)' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {[130, 100, 76].map((sz, i) => (
          <div key={i} style={{ position: 'absolute', width: sz, height: sz, borderRadius: '50%', border: '1.5px solid var(--ms-ring-clr)', animation: `tpmRing ${14 + i * 4}s linear infinite`, animationDirection: i % 2 === 0 ? 'normal' : 'reverse' }} />
        ))}
        <div style={{ width: 72, height: 72, borderRadius: 24, background: 'rgba(13,148,136,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(13,148,136,.2)' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.6">
            <path d="M22 13V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2h9"/>
            <polyline points="22 13 16 13 14 15 10 15 8 13 2 13"/>
          </svg>
        </div>
      </div>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--ms-empty-txt1)', fontFamily: 'var(--font2)', letterSpacing: -.5, marginBottom: 10 }}>Select a conversation</div>
        <div style={{ fontSize: 14, color: 'var(--ms-empty-txt2)', lineHeight: 1.8 }}>
          Parents whose children are in your class can contact you through the parent portal.
          Their messages appear here.
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEACHER PARENT MESSAGES PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export function TeacherParentMessagesPage() {
  const { data: convs = [], isLoading } = useParentConversations()
  const { data: _classNameMap = new Map<string, string>() } = useStudentClassMap()
  const { data: teacherClassName } = useTeacherClassName()
  const [active, setActive] = useState<ParentConversation | null>(null)
  const isMobile = useIsMobile()
  const arEl = useMemo(() => document.querySelector('.ar') as HTMLElement ?? document.body, [])

  useEffect(() => {
    if (isMobile) return
    const p = document.querySelector('.shell-main > .page') as HTMLElement | null
    if (!p) return
    p.style.cssText = 'padding:0!important;height:100%;display:flex;flex-direction:column;'
    return () => { p.style.cssText = '' }
  }, [isMobile])

  if (isMobile) {
    return createPortal(
      <>
        <style>{STYLES}</style>
        <div className="tpm-page" style={{
          position: 'fixed',
          top: `calc(56px + env(safe-area-inset-top, 0px))`,
          left: 0, right: 0,
          bottom: `calc(64px + env(safe-area-inset-bottom, 0px))`,
          zIndex: 36, overflow: 'hidden', background: 'var(--ms-cl-bg)',
        }}>
          <div style={{ position: 'absolute', inset: 0 }}>
            <ContactList convs={convs} loading={isLoading} onSelect={setActive} activeId={active?.parentAuthUserId ?? null} />
          </div>
          <div style={{
            position: 'absolute', inset: 0, background: 'var(--ms-feed-bg)',
            transform: active !== null ? 'translateX(0)' : 'translateX(100%)',
            transition: active !== null ? 'transform .28s cubic-bezier(.32,.72,0,1)' : 'transform .24s cubic-bezier(.4,0,.6,1)',
            willChange: 'transform',
            boxShadow: active !== null ? '-10px 0 40px rgba(0,0,0,.35)' : 'none',
          }}>
            {active && <ThreadPanel conv={active} onBack={() => setActive(null)} />}
          </div>
        </div>
      </>,
      arEl
    )
  }

  return (
    <>
      <style>{STYLES}</style>
      {teacherClassName && (
        <div style={{ padding: '0 0 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(13,148,136,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="2">
              <path d="M22 13V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2h9"/>
              <polyline points="22 13 16 13 14 15 10 15 8 13 2 13"/>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--txt)', letterSpacing: -.4, fontFamily: 'var(--font2)' }}>
              Parent Messages — {teacherClassName}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--txt2)', marginTop: 1 }}>Messages from parents about student matters</div>
          </div>
        </div>
      )}
      <div className="tpm-page" style={{
        display: 'flex', flex: 1, minHeight: 440,
        borderRadius: 18, overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,.14)',
        border: '1px solid rgba(0,0,0,.1)',
      }}>
        <div style={{ width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(0,0,0,.06)' }}>
          <ContactList convs={convs} loading={isLoading} onSelect={setActive} activeId={active?.parentAuthUserId ?? null} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {active === null ? <EmptyState /> : <ThreadPanel conv={active} />}
        </div>
      </div>
    </>
  )
}
