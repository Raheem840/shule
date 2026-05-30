/**
 * AppShell.tsx — The master layout for all authenticated role screens.
 *
 * Structure:
 *   <div class="ar" data-theme="light|dark">   ← theme root (NOT <html>)
 *     <nav class="sb">                           ← 228px fixed sidebar
 *     <div class="shell-r">                      ← flex-1 right panel
 *       <div class="topbar">                     ← 56px sticky topbar
 *       <main class="shell-main">               ← page content via <Outlet>
 *
 * Theme: stored in localStorage, toggled by TopBar button.
 * The .ar div gets data-theme="dark" — CSS vars cascade to all children.
 * Sidebar tokens (--sb-bg etc.) shift slightly in dark mode per design spec.
 */

import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import { ROLE_NAV, ROLE_AVATAR, ROLE_LABEL } from '../../config/roleNav'
import { OfflineBanner } from '../shared/OfflineBanner'
import { ErrorBoundary } from '../shared/ErrorBoundary'
import { useNotifications, useMarkNotificationsRead } from '../../hooks/useNotifications'
import { useUnreadCount } from '../../hooks/useMessaging'
import { useSchoolSettings } from '../../hooks/useAdmin'
import { applyBrandColor } from '../../lib/brandColor'
import type { UserRole } from '../../store/AuthContext'
import type { NotificationType } from '../../types/week9'

// Roles that have a /profile page
const PROFILE_ROLES = new Set<UserRole>([
  'principal','deputy','dos','secretary','bursar','class_teacher','teacher','it_admin',
])

// Staff roles that have a messaging inbox
const STAFF_MSG_PATHS: Partial<Record<UserRole, string>> = {
  principal:     '/principal/messages',
  deputy:        '/deputy/messages',
  dos:           '/dos/messages',
  secretary:     '/secretary/messages',
  bursar:        '/bursar/messages',
  class_teacher: '/teacher/messages',
  teacher:       '/teacher/messages',
  it_admin:      '/admin/messages',
}

// ─── Theme persistence ─────────────────────────────────────────────────────────
function getStoredTheme(): 'light' | 'dark' {
  try {
    return (localStorage.getItem('shule-theme') as 'light' | 'dark') ?? 'light'
  } catch {
    return 'light'
  }
}

// ─── Initials from a full name ─────────────────────────────────────────────────
function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

// ─── Today's greeting + date line ─────────────────────────────────────────────
function greeting(name: string): string {
  const h = new Date().getHours()
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = name.split(' ')[0]
  return `${greet}, ${firstName}`
}

function todayLine(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPSHELL
// ═══════════════════════════════════════════════════════════════════════════════
export function AppShell() {
  const { user, signOut } = useAuth()
  const [theme, setTheme] = useState<'light' | 'dark'>(getStoredTheme)
  const location = useLocation()
  const { data: schoolSettings } = useSchoolSettings()

  // Persist theme to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('shule-theme', theme)
  }, [theme])

  // Apply brand color whenever settings load or change
  useEffect(() => {
    if (schoolSettings?.primaryColor) {
      applyBrandColor(schoolSettings.primaryColor)
    }
  }, [schoolSettings?.primaryColor])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  if (!user) return null   // ProtectedRoute handles the redirect

  const nav    = ROLE_NAV[user.role]
  const avatar = ROLE_AVATAR[user.role]
  const label  = ROLE_LABEL[user.role]

  return (
    <div className="ar" data-theme={theme}>
      {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
      <Sidebar
        nav={nav}
        user={user}
        avatar={avatar}
        roleLabel={label}
        currentPath={location.pathname}
        onSignOut={signOut}
        schoolName={schoolSettings?.schoolName ?? null}
        schoolMotto={schoolSettings?.motto ?? null}
        schoolLogoUrl={schoolSettings?.logoUrl ?? null}
      />

      {/* ── RIGHT PANEL ─────────────────────────────────────────────── */}
      <div className="shell-r">
        {/* Offline/online banner sits above TopBar */}
        <OfflineBanner />

        <TopBar
          theme={theme}
          onToggle={toggleTheme}
          greeting={greeting(user.name)}
          today={todayLine()}
          user={user}
          avatar={avatar}
        />
        <main className="shell-main">
          <div className="page sui-page-enter" key={location.pathname}>
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════════
type SidebarProps = {
  nav:           import('../../config/roleNav').RoleNav
  user:          NonNullable<ReturnType<typeof useAuth>['user']>
  avatar:        { bg: string; color: string }
  roleLabel:     string
  currentPath:   string
  onSignOut:     () => void
  schoolName:    string | null
  schoolMotto:   string | null
  schoolLogoUrl: string | null
}

function Sidebar({ nav, user, avatar, roleLabel, currentPath, onSignOut, schoolName, schoolMotto, schoolLogoUrl }: SidebarProps) {
  const navigate = useNavigate()
  const { data: msgUnread = 0 } = useUnreadCount()

  const displayName   = schoolName ?? 'My School'
  const schoolInitial = displayName.trim()[0]?.toUpperCase() ?? 'S'

  return (
    <nav className="sb">
      {/* Logo + school name */}
      <div className="sbtop">

        {/* ── Shule product brand ── */}
        <div className="sbrand">
          {/* Crafted SVG mark — custom bezier S on gradient ground */}
          <div className="slogo">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path
                d="M 15.5 6.5
                   C 15.5 4.8 13.8 3.5 11.5 3.5
                   C 8.5 3.5 5.5 5.2 5.5 8.2
                   C 5.5 10.8 7.8 11.8 10.2 12.6
                   C 12.6 13.4 15 14.5 15 17
                   C 15 19 12.8 20.5 10 20.5
                   C 7.5 20.5 5.5 19 5 17.5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              {/* Top shine overlay */}
              <rect x="0" y="0" width="20" height="9" rx="5" fill="white" fillOpacity="0.09"/>
            </svg>
          </div>
          <div>
            <div className="sname">Shule</div>
            <div className="ssub">School Management</div>
          </div>
        </div>

        {/* ── School identity pill — driven by school_profile ── */}
        <div className="school-pill">
          {schoolLogoUrl ? (
            <img
              src={schoolLogoUrl}
              alt={displayName}
              className="school-logo-img"
            />
          ) : (
            <div className="school-ico">{schoolInitial}</div>
          )}
          <div style={{ minWidth: 0 }}>
            <div className="school-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
            {schoolMotto && (
              <div className="school-loc" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {schoolMotto}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation groups */}
      <div className="sb-nav">
        {nav.map((group: import('../../config/roleNav').NavGroup, gi: number) => (
          <div key={gi}>
            {/* Only render the group label if it has text */}
            {group.label && (
              <div className="ngl">{group.label}</div>
            )}

            {group.items.map((item: import('../../config/roleNav').NavItem) => {
              const isActive = currentPath === item.path ||
                currentPath.startsWith(item.path + '/')
              const isMsgItem = item.path.endsWith('/messages')

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`ni${isActive ? ' on' : ''}`}
                >
                  {/* Icon */}
                  <span
                    className="ico"
                    dangerouslySetInnerHTML={{ __html: item.svg }}
                  />

                  {/* Label */}
                  {item.label}

                  {/* Messaging items: show real unread count; other alert items: show dot */}
                  {item.badge === 'alert' && isMsgItem && msgUnread > 0 && (
                    <span className="nb" style={{ fontSize: 9, minWidth: 16, height: 16, padding: '0 3px' }}>
                      {msgUnread > 9 ? '9+' : msgUnread}
                    </span>
                  )}
                  {item.badge === 'alert' && !isMsgItem && (
                    <span className="nb">!</span>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </div>

      {/* User pill at bottom */}
      <div className="sbbot">
        {PROFILE_ROLES.has(user.role) ? (
          <div
            className="upill"
            onClick={() => navigate('/profile')}
            title="View your profile"
            style={{ cursor: 'pointer' }}
          >
            <div className="uava" style={{ background: avatar.bg, color: avatar.color }}>
              {initials(user.name)}
            </div>
            <div>
              <div className="u-name">{user.name}</div>
              <div className="u-role">{roleLabel}</div>
            </div>
            <div className="u-dot" />
          </div>
        ) : (
          <div className="upill" onClick={onSignOut} title="Click to sign out">
            <div className="uava" style={{ background: avatar.bg, color: avatar.color }}>
              {initials(user.name)}
            </div>
            <div>
              <div className="u-name">{user.name}</div>
              <div className="u-role">{roleLabel}</div>
            </div>
            <div className="u-dot" />
          </div>
        )}
      </div>
    </nav>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOPBAR
// ═══════════════════════════════════════════════════════════════════════════════
type TopBarProps = {
  theme:    'light' | 'dark'
  onToggle: () => void
  greeting: string
  today:    string
  user:     NonNullable<ReturnType<typeof useAuth>['user']>
  avatar:   { bg: string; color: string }
}

function MessagingIcon({ role }: { role: UserRole }) {
  const navigate = useNavigate()
  const msgPath = STAFF_MSG_PATHS[role]
  const { data: unreadCount = 0 } = useUnreadCount()

  if (!msgPath) return null

  return (
    <div
      className="tb-icon"
      title="Messages"
      style={{ position: 'relative' }}
      onClick={() => navigate(msgPath)}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
      {unreadCount > 0 && (
        <div className="ndot" style={{ fontSize: 9, fontWeight: 800, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          minWidth: 16, height: 16, borderRadius: 99, padding: '0 3px' }}>
          {unreadCount > 9 ? '9+' : unreadCount}
        </div>
      )}
    </div>
  )
}

// Maps notification type → a sensible default route when link is null.
function notifRoute(type: NotificationType, role: UserRole): string {
  switch (type) {
    case 'message':      return STAFF_MSG_PATHS[role] ?? '/'
    case 'report_card':  return role === 'principal' ? '/principal/report-cards' : '/secretary/report-cards'
    case 'attendance':   return role === 'deputy' ? '/deputy/dashboard' : '/teacher/attendance'
    case 'fee':          return '/bursar/fees'
    case 'announcement': return STAFF_MSG_PATHS[role] ?? '/'
    default:             return '/'
  }
}

function NotificationBell({ role }: { role: UserRole }) {
  const { data: notifications = [] } = useNotifications()
  const { mutate: markAllRead } = useMarkNotificationsRead()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)
  const unreadCount = notifications.length

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleNotifClick(link: string | null, type: NotificationType) {
    setOpen(false)
    navigate(link ?? notifRoute(type, role))
  }

  return (
    <div ref={bellRef} style={{ position: 'relative' }}>
      <div
        className="tb-icon"
        title="Notifications"
        style={{ position: 'relative' }}
        onClick={() => setOpen(o => !o)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {unreadCount > 0 && <div className="ndot" />}
      </div>

      {open && (
        <div
          className="sui-dropdown-glass"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: 320, maxHeight: 400, overflowY: 'auto',
            zIndex: 100,
          }}
        >
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 14px', borderBottom: '1px solid var(--border)',
          }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>
              Notifications
              {unreadCount > 0 && (
                <span style={{
                  marginLeft: 6, background: 'var(--brand)', color: '#fff',
                  borderRadius: 99, fontSize: 10, fontWeight: 800,
                  padding: '1px 5px',
                }}>
                  {unreadCount}
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                style={{
                  border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 11, color: 'var(--brand)', fontWeight: 700,
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>
              No new notifications
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                className="sui-feed-row"
                onClick={() => handleNotifClick(n.link, n.type)}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                  background: n.readAt ? 'transparent' : 'var(--brand-light)',
                }}
              >
                <div style={{ fontSize: 13, color: 'var(--txt)', lineHeight: 1.4 }}>
                  {n.body}
                </div>
                <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 4 }}>
                  {new Date(n.createdAt).toLocaleString('en-GB', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function TopBar({ theme, onToggle, greeting, today, user, avatar }: TopBarProps) {
  const navigate = useNavigate()
  return (
    <div className="topbar">
      {/* Page title area */}
      <div style={{ flex: 1 }}>
        <span className="tb-title">{greeting}</span>
        <span className="tb-sub">{today}</span>
      </div>

      {/* Theme toggle */}
      <div
        className="theme-toggle"
        onClick={onToggle}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        role="button"
        aria-label="Toggle theme"
      >
        <div className="toggle-knob">
          {theme === 'dark' ? '🌙' : '☀️'}
        </div>
      </div>

      {/* Search icon */}
      <div className="tb-icon" title="Search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>

      {/* Messaging icon — staff roles only */}
      <MessagingIcon role={user.role} />

      {/* Notification bell — all roles, shows real unread count */}
      <ErrorBoundary fallback={null}>
        <NotificationBell role={user.role} />
      </ErrorBoundary>

      {/* Avatar — navigates to /profile for staff roles */}
      <div
        style={{
          width: 32, height: 32,
          borderRadius: '50%',
          background: avatar.bg,
          border: `2px solid ${avatar.color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800,
          color: avatar.color,
          fontFamily: 'var(--font2)',
          flexShrink: 0,
          cursor: PROFILE_ROLES.has(user.role) ? 'pointer' : 'default',
        }}
        title={PROFILE_ROLES.has(user.role) ? 'My Profile' : user.name}
        onClick={() => { if (PROFILE_ROLES.has(user.role)) navigate('/profile') }}
      >
        {initials(user.name)}
      </div>
    </div>
  )
}
