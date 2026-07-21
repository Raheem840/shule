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

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import { supabase } from '../../lib/supabase'
import { ROLE_NAV, ROLE_AVATAR, ROLE_LABEL, ROLE_BOTTOM_NAV } from '../../config/roleNav'
import { OfflineBanner } from '../shared/OfflineBanner'
import { ErrorBoundary } from '../shared/ErrorBoundary'
import { useNotifications, useMarkNotificationsRead } from '../../hooks/useNotifications'
import { NotificationPushListener } from '../shared/NotificationPush'
import { useUnreadCount, useParentMessagesUnreadCount } from '../../hooks/useMessaging'
import { useSchoolSettings } from '../../hooks/useAdmin'
import { applyBrandColor } from '../../lib/brandColor'
import { useIsMobile } from '../../hooks/useIsMobile'
import type { UserRole } from '../../store/AuthContext'
import type { NotificationType } from '../../types/week9'
import { ConnectionBanner } from '../ui/ConnectionBanner'
import { SyncManager } from './SyncManager'
import { GlobalSearch } from './GlobalSearch'
import { OnboardingWizard } from '../shared/OnboardingWizard'

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

// ─── Shule brand badge (fallback when no school logo uploaded) ─────────────────
function ShuleBadge({ size = 34 }: { size?: number }) {
  const r = Math.round(size * 0.29)   // border-radius
  const p = Math.round(size * 0.12)   // inner padding
  const ic = size - p * 2             // icon canvas
  return (
    <div
      title="Shule — upload your school badge in Settings"
      style={{
        width: size, height: size, borderRadius: r, flexShrink: 0,
        background: 'linear-gradient(145deg,#0d9488 0%,#0f766e 55%,#064e3b 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 10px rgba(13,148,136,.45), inset 0 1px 0 rgba(255,255,255,.18)',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Subtle top-right glow */}
      <div style={{ position: 'absolute', top: -4, right: -4, width: size * 0.7, height: size * 0.7, borderRadius: '50%', background: 'rgba(255,255,255,.07)', pointerEvents: 'none' }} />
      {/* Book + graduation cap mark */}
      <svg width={ic} height={ic} viewBox="0 0 20 20" fill="none" style={{ position: 'relative', zIndex: 1 }}>
        {/* Open book */}
        <path d="M10 15.5C10 15.5 5 13.5 2 14V5.5C5 5 8.5 6.5 10 8C11.5 6.5 15 5 18 5.5V14C15 13.5 10 15.5 10 15.5Z" fill="rgba(255,255,255,.9)" />
        <line x1="10" y1="8" x2="10" y2="15.5" stroke="rgba(13,148,136,.6)" strokeWidth="1" />
        {/* Cap / mortarboard */}
        <polygon points="10,2 16,5 10,8 4,5" fill="#fff" opacity=".95" />
        <line x1="16" y1="5" x2="16" y2="8.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".8" />
        <circle cx="16" cy="9" r="1" fill="#fff" opacity=".8" />
      </svg>
    </div>
  )
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
  // JWT full_name falls back to email when the hook claim is missing.
  // Convert "peter.kato@school.ug" → "Peter" so the greeting reads naturally.
  const display = name.includes('@')
    ? name.split('@')[0].replace(/[._-]/g, ' ')
    : name
  const first = display.split(' ').filter(Boolean)[0] ?? display
  const cap   = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
  return `${greet}, ${cap}`
}

function todayLine(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// APPSHELL
// ═══════════════════════════════════════════════════════════════════════════════
// ─── Page title lookup (mobile topbar) ──────────────────────────────────────
function getPageTitle(pathname: string, nav: import('../../config/roleNav').RoleNav): string {
  for (const group of nav) {
    for (const item of group.items) {
      if (pathname === item.path || pathname.startsWith(item.path + '/')) {
        return item.label
      }
    }
  }
  if (pathname.endsWith('/profile')) return 'My Profile'
  return 'Shule'
}

export function AppShell() {
  const { user, signOut } = useAuth()
  const [theme, setTheme]               = useState<'light' | 'dark'>(getStoredTheme)
  const [drawerOpen, setDrawer]         = useState(false)
  const [showPwBanner, setShowPwBanner]       = useState(false)
  const [showOnboarding, setShowOnboarding]   = useState(false)
  const [isFirstLogin, setIsFirstLogin]       = useState(false)
  const [searchOpen, setSearchOpen]           = useState(false)
  // Sidebar rests collapsed (icon + badge only) and expands on hover by
  // default — "pinned" opts out of that, keeping it permanently expanded.
  const [sidebarPinned, setSidebarPinned]     = useState(() => localStorage.getItem('shule-sb-pinned') === '1')

  const openSearch  = useCallback(() => setSearchOpen(true),  [])
  const closeSearch = useCallback(() => setSearchOpen(false), [])
  const location  = useLocation()
  const navigate  = useNavigate()
  const isMobile  = useIsMobile()
  const { data: schoolSettings } = useSchoolSettings()
  const { data: unreadCount = 0 } = useUnreadCount()

  // Staff-only roles that get the first-login password prompt
  const isStaffRole = user?.role && !['student', 'parent'].includes(user.role)

  // Fetch real first name + check first login (last_login_at null = never logged in before)
  const { data: staffFirstName } = useQuery({
    queryKey: ['staff-first-name', user?.id],
    enabled: !!user?.id,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      if (!isStaffRole) return null
      const { data } = await supabase
        .from('staff')
        .select('first_name, last_login_at')
        .eq('auth_user_id', user!.id)
        .maybeSingle()
      if (!data) return null

      // First login: show role-specific onboarding wizard + password banner
      if (!data.last_login_at) {
        setShowPwBanner(true)
        setIsFirstLogin(true)
        setShowOnboarding(true)
      }

      // Stamp last_login_at so neither prompt shows again
      await supabase
        .from('staff')
        .update({ last_login_at: new Date().toISOString() })
        .eq('auth_user_id', user!.id)

      return (data.first_name as string | null) ?? null
    },
  })

  useEffect(() => { localStorage.setItem('shule-theme', theme) }, [theme])
  useEffect(() => { localStorage.setItem('shule-sb-pinned', sidebarPinned ? '1' : '0') }, [sidebarPinned])

  // Global Ctrl+K (search) and Ctrl+B (sidebar toggle) shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(o => !o)
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b' && !isMobile) {
        e.preventDefault()
        setSidebarPinned(p => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => {
    if (schoolSettings?.primaryColor) applyBrandColor(schoolSettings.primaryColor)
  }, [schoolSettings?.primaryColor])

  // Close drawer whenever route changes
  useEffect(() => { setDrawer(false) }, [location.pathname])

  // Route mouse-wheel vertical delta → horizontal scroll on .table-scroll / .hscroll elements.
  // Works in every browser regardless of overflow-y setting.
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      // Only act when the pointer is over a horizontal-scroll container
      const el = (e.target as Element | null)?.closest<HTMLElement>('.table-scroll, .hscroll')
      if (!el) return
      // Skip if the content doesn't actually overflow horizontally
      if (el.scrollWidth <= el.clientWidth + 1) return
      // Skip if the user is already scrolling primarily horizontally (trackpad 2-finger)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      e.preventDefault()
      // Multiply by a small factor so it feels natural (not too fast/slow)
      el.scrollLeft += e.deltaY * 0.8
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [])

  // Lock body scroll when drawer is open on mobile
  useEffect(() => {
    if (isMobile && drawerOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
    document.body.style.overflow = ''
  }, [isMobile, drawerOpen])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  if (!user) return null

  const nav         = ROLE_NAV[user.role]
  const avatar      = ROLE_AVATAR[user.role]
  const label       = ROLE_LABEL[user.role]
  const bottomItems = ROLE_BOTTOM_NAV[user.role] ?? []
  const displayName = staffFirstName ?? user.name
  const pageTitle   = getPageTitle(location.pathname, nav)

  const schoolNeedsSetup = !!schoolSettings && !schoolSettings.schoolName

  // Show onboarding when: school not set up (always for it_admin/principal) OR first login for any staff
  const showWizard = schoolNeedsSetup || showOnboarding

  return (
    <div className={`ar${sidebarPinned && !isMobile ? ' sb-pinned-mode' : ''}`} data-theme={theme}>
      {showWizard && (
        <OnboardingWizard
          isFirstLogin={isFirstLogin}
          schoolNeedsSetup={schoolNeedsSetup}
          onDone={() => { setShowOnboarding(false); setIsFirstLogin(false) }}
        />
      )}
      <ConnectionBanner />
      <SyncManager />

      {/* ── Drawer overlay (mobile only) ─────────────────────────── */}
      <div
        className={`mob-overlay${drawerOpen ? ' open' : ''}`}
        onClick={() => setDrawer(false)}
      />

      {/* ── SIDEBAR (desktop fixed / mobile drawer) ──────────────── */}
      <Sidebar
        nav={nav}
        user={user}
        avatar={avatar}
        roleLabel={label}
        currentPath={location.pathname}
        onSignOut={signOut}
        schoolName={schoolSettings?.schoolName || null}
        schoolMotto={schoolSettings?.motto || null}
        schoolLogoUrl={schoolSettings?.logoUrl ?? null}
        drawerOpen={drawerOpen}
        onClose={() => setDrawer(false)}
        pinned={sidebarPinned && !isMobile}
        onTogglePinned={() => setSidebarPinned(p => !p)}
      />

      {/* ── RIGHT PANEL ──────────────────────────────────────────── */}
      <div className="shell-r" style={{ paddingTop: 'var(--banner-height, 0)' }}>
        <OfflineBanner />

        {/* First-login password change prompt — dismissable, not mandatory */}
        {showPwBanner && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 20px',
            background: 'linear-gradient(90deg,rgba(139,92,246,.12),rgba(99,102,241,.08))',
            borderBottom: '1px solid rgba(139,92,246,.2)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" style={{ flexShrink: 0 }}>
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            <span style={{ flex: 1, fontSize: 13, color: 'var(--txt2)', lineHeight: 1.4 }}>
              <strong style={{ color: 'var(--txt)' }}>Welcome!</strong> You are logged in with your default credentials.
              Consider{' '}
              <button
                onClick={() => { navigate('/profile'); setShowPwBanner(false) }}
                style={{ background: 'none', border: 'none', padding: 0, color: '#8b5cf6', fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
              >
                changing your password
              </button>
              {' '}when ready — it is not mandatory right now.
            </span>
            <button
              onClick={() => setShowPwBanner(false)}
              aria-label="Dismiss"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', padding: 4, borderRadius: 6, flexShrink: 0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        )}

        {/* Mobile topbar */}
        <div className="mob-topbar">
          {/* Hamburger */}
          <button
            className="mob-icon-btn"
            onClick={() => setDrawer(o => !o)}
            aria-label="Menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {drawerOpen ? (
                <>
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </>
              ) : (
                <>
                  <line x1="3" y1="7" x2="21" y2="7"/>
                  <line x1="3" y1="12" x2="21" y2="12"/>
                  <line x1="3" y1="17" x2="21" y2="17"/>
                </>
              )}
            </svg>
          </button>

          {/* School logo / badge — uploaded logo or Shule brand mark.
              Sized to be readable at a glance on a phone screen, not just
              decorative — this is the only school-identity cue in the
              mobile topbar. */}
          {schoolSettings?.logoUrl ? (
            <img src={schoolSettings.logoUrl} alt="School badge" style={{ width: 42, height: 42, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.25))' }} />
          ) : (
            <ShuleBadge size={42} />
          )}

          {/* Page title (centered) */}
          <div style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'var(--font2)', fontWeight: 800, fontSize: 16,
            color: 'var(--txt)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            margin: '0 4px',
          }}>
            {pageTitle}
          </div>

          {/* Theme toggle — SVG sun/moon */}
          <button
            className="mob-icon-btn"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            )}
          </button>

          {/* Notification bell */}
          <MobileNotifBell role={user.role} />
        </div>

        {/* Desktop topbar */}
        <TopBar
          theme={theme}
          onToggle={toggleTheme}
          greeting={greeting(displayName)}
          today={todayLine()}
          user={user}
          avatar={avatar}
          onSearchOpen={openSearch}
        />

        <main className="shell-main">
          <div className="page sui-page-enter" key={location.pathname}>
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>

        <NotificationPushListener />
        <GlobalSearch open={searchOpen} onClose={closeSearch} />

        {/* ── Bottom navigation (mobile only) ─────────────────────── */}
        {bottomItems.length > 0 && (
          <nav className="mob-nav" role="navigation" aria-label="Main navigation">
            {bottomItems.map(item => {
              const isActive = location.pathname === item.path ||
                location.pathname.startsWith(item.path + '/')
              const isMsg    = item.path.endsWith('/messages')
              return (
                <button
                  key={item.path}
                  className={`mob-tab${isActive ? ' active' : ''}`}
                  onClick={() => navigate(item.path)}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <div className="mob-tab-icon-wrap">
                    <svg
                      viewBox="0 0 24 24" fill="none"
                      stroke="currentColor"
                      strokeLinecap="round" strokeLinejoin="round"
                      dangerouslySetInnerHTML={{
                        __html: item.svg.replace(/<svg[^>]*>/, '').replace('</svg>', '')
                      }}
                    />
                    {isMsg && unreadCount > 0 && (
                      <span className="mob-tab-badge">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                  <span className="mob-tab-label">{item.label}</span>
                </button>
              )
            })}

            {/* More button — opens sidebar drawer */}
            <button
              className={`mob-tab${drawerOpen ? ' active' : ''}`}
              onClick={() => setDrawer(o => !o)}
              aria-label="More options"
            >
              <div className="mob-tab-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round">
                  <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                  <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                  <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                </svg>
              </div>
              <span className="mob-tab-label">More</span>
            </button>
          </nav>
        )}
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
  drawerOpen?:      boolean
  onClose?:         () => void
  pinned?:          boolean
  onTogglePinned?:  () => void
}

function Sidebar({ nav, user, avatar, roleLabel, currentPath, onSignOut, schoolName, schoolMotto, schoolLogoUrl, drawerOpen, onClose, pinned, onTogglePinned }: SidebarProps) {
  const navigate = useNavigate()
  const { data: msgUnread = 0 }       = useUnreadCount()
  const { data: parentMsgUnread = 0 } = useParentMessagesUnreadCount()

  // Live pending report card count — only fetched for principals
  const { data: pendingRCCount = 0 } = useQuery({
    queryKey: ['pending-rc-sidebar', user.schoolId],
    enabled:  user.role === 'principal',
    queryFn:  async () => {
      const { count, error } = await supabase
        .from('report_cards')
        .select('id', { count: 'exact', head: true })
        .eq('school_id', user.schoolId)
        .eq('status', 'ready')
      return error ? 0 : (count ?? 0)
    },
    staleTime:       60_000,
    refetchInterval: 2 * 60_000,
  })

  const hasSchoolName = !!schoolName
  const displayName   = schoolName || 'Setup Required'
  const schoolInitial = hasSchoolName ? (displayName.trim()[0]?.toUpperCase() ?? 'S') : null

  return (
    <nav className={`sb${drawerOpen ? ' sb-open' : ''}${pinned ? ' sb-pinned' : ''}`}>
      {/* Mobile drawer close button */}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            display: 'none',
            position: 'absolute', top: 12, right: 12,
            width: 32, height: 32, borderRadius: 10,
            border: 'none', background: 'rgba(255,255,255,0.08)',
            color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 300, lineHeight: 1,
          }}
          className="mob-drawer-close"
          aria-label="Close menu"
        >×</button>
      )}

      {/* Pin toggle — desktop only. Sidebar rests collapsed and expands on
          hover by default; pinning keeps it permanently expanded. Fixed
          top-right position works in both the collapsed (64px) and
          expanded (228px) widths, so it doesn't need to react to hover. */}
      {onTogglePinned && (
        <button
          onClick={onTogglePinned}
          title={pinned ? 'Unpin sidebar — collapse when not hovered (Ctrl+B)' : 'Pin sidebar open (Ctrl+B)'}
          className="sb-pin-btn mob-hide-btn"
          aria-label={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          aria-pressed={pinned}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M12 17v5M9 10.5V4h6v6.5l2 3.5H7l2-3.5z"/>
          </svg>
        </button>
      )}

      {/* Logo + school name */}
      <div className="sbtop">

        {/* ── Shule product brand ── */}
        <div className="sbrand">
          {/* Mortarboard mark — instantly reads as "school" at any size */}
          <div className="slogo">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              {/* Board — the flat wide top of a mortarboard */}
              <rect x="2" y="6" width="22" height="4" rx="2" fill="white"/>
              {/* Crown — the cap body below the board */}
              <rect x="8" y="10" width="10" height="7" rx="1.5" fill="white"/>
              {/* Tassel string from right end of board */}
              <line x1="21" y1="8" x2="21" y2="17.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.75"/>
              {/* Tassel ball */}
              <circle cx="21" cy="19.5" r="2.2" fill="white" fillOpacity="0.75"/>
              {/* Crown bottom baseline */}
              <rect x="7" y="17" width="12" height="1.5" rx="0.75" fill="white" fillOpacity="0.45"/>
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
          ) : schoolInitial ? (
            <div className="school-ico">{schoolInitial}</div>
          ) : (
            <div className="school-ico" style={{ background: 'rgba(148,163,184,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 21h18"/><path d="M9 21V7l3-3 3 3v14"/><path d="M3 21V10l6-6"/><path d="M21 21V10l-6-6"/>
                <rect x="9" y="12" width="2" height="3"/><rect x="13" y="12" width="2" height="3"/>
              </svg>
            </div>
          )}
          <div className="school-pill-text">
            <div className="school-name" style={!hasSchoolName ? { color: 'var(--txt3)', fontStyle: 'italic', fontSize: 11 } : undefined}>
              {displayName}
            </div>
            {hasSchoolName && schoolMotto && (
              <div className="school-loc">{schoolMotto}</div>
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
              const isParentMsgItem = item.path.endsWith('/parent-messages')
              const isStaffMsgItem  = item.path.endsWith('/messages') && !isParentMsgItem

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`ni${isActive ? ' on' : ''}`}
                  title={item.label}
                >
                  {/* Icon */}
                  <span
                    className="ico"
                    dangerouslySetInnerHTML={{ __html: item.svg }}
                  />

                  {/* Label */}
                  <span className="ni-label">{item.label}</span>

                  {/* Messaging badge — staff-to-staff unread only, matches
                      what this specific page (useContacts, staff-only) shows */}
                  {item.badge === 'alert' && isStaffMsgItem && msgUnread > 0 && (
                    <span className="nb" style={{ fontSize: 9, minWidth: 16, height: 16, padding: '0 3px' }}>
                      {msgUnread > 9 ? '9+' : msgUnread}
                    </span>
                  )}
                  {/* Parent Messages badge — parent/student unread only */}
                  {item.badge === 'alert' && isParentMsgItem && parentMsgUnread > 0 && (
                    <span className="nb" style={{ fontSize: 9, minWidth: 16, height: 16, padding: '0 3px' }}>
                      {parentMsgUnread > 9 ? '9+' : parentMsgUnread}
                    </span>
                  )}
                  {/* Report Cards badge — live pending count, never static */}
                  {item.path === '/principal/report-cards' && pendingRCCount > 0 && (
                    <span className="nb" style={{ fontSize: 9, minWidth: 16, height: 16, padding: '0 3px' }}>
                      {pendingRCCount > 9 ? '9+' : pendingRCCount}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </div>

      {/* User identity + sign-out at bottom */}
      <div className="sbbot">
        {/* User pill — navigates to profile for staff roles */}
        <div
          className="upill"
          onClick={() => PROFILE_ROLES.has(user.role) ? navigate('/profile') : undefined}
          title={PROFILE_ROLES.has(user.role) ? 'View your profile' : user.name}
          style={{ cursor: PROFILE_ROLES.has(user.role) ? 'pointer' : 'default' }}
        >
          <div className="uava" style={{ background: avatar.bg, color: avatar.color }}>
            {initials(user.name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="u-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>{user.name}</div>
            <div className="u-role">{roleLabel}</div>
          </div>
          <div className="u-dot" />
        </div>

        {/* Premium sign-out button — sidebar only, never in topbar */}
        <button
          className="sb-signout-btn"
          onClick={onSignOut}
          aria-label="Sign out"
        >
          {/* Log-out icon (door with arrow exiting) */}
          <svg
            className="sb-so-icon"
            viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>

          <span>Sign out</span>

          {/* Arrow appears on hover */}
          <svg
            className="sb-so-arrow"
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          >
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
      </div>
    </nav>
  )
}

// ─── Mobile notification bell (compact) ─────────────────────────────────────
function MobileNotifBell({ role: _role }: { role: UserRole }) {
  const { data: notifications = [] } = useNotifications()
  const { mutate: markAllRead }       = useMarkNotificationsRead()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const unread = notifications.length

  useEffect(() => {
    function handler(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler as EventListener)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler as EventListener)
    }
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="mob-icon-btn" onClick={() => setOpen(o => !o)} aria-label="Notifications" style={{ position: 'relative' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {unread > 0 && (
          <div style={{
            position: 'absolute', top: 6, right: 6,
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--danger)', border: '2px solid var(--surface)',
          }} />
        )}
      </button>
      {open && (
        <div className="sui-dropdown-glass" style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 280, maxHeight: 360, overflowY: 'auto', zIndex: 100,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>
              Notifications {unread > 0 && <span style={{ marginLeft: 4, background: 'var(--brand)', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 800, padding: '1px 5px' }}>{unread}</span>}
            </span>
            {unread > 0 && (
              <button onClick={() => markAllRead()} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--brand)', fontWeight: 700 }}>
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--txt3)', fontSize: 13 }}>No new notifications</div>
          ) : notifications.map(n => (
            <div key={n.id} className="sui-feed-row" onClick={() => { setOpen(false); navigate(n.link ?? '/') }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: n.readAt ? 'transparent' : 'var(--brand-light)' }}>
              <div style={{ fontSize: 13, color: 'var(--txt)', lineHeight: 1.4 }}>{n.body}</div>
              <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 4 }}>
                {new Date(n.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOPBAR
// ═══════════════════════════════════════════════════════════════════════════════
type TopBarProps = {
  theme:         'light' | 'dark'
  onToggle:      () => void
  greeting:      string
  today:         string
  user:          NonNullable<ReturnType<typeof useAuth>['user']>
  avatar:        { bg: string; color: string }
  onSearchOpen:  () => void
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
    function handleClick(e: MouseEvent | TouchEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('touchstart', handleClick as EventListener)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('touchstart', handleClick as EventListener)
    }
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

function TopBar({ theme, onToggle, greeting, today, user, avatar, onSearchOpen }: TopBarProps) {
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

      {/* Search button */}
      <button
        onClick={onSearchOpen}
        title="Search (Ctrl+K)"
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--surface2)',
          color: 'var(--txt3)', cursor: 'pointer',
          fontSize: 12, fontFamily: 'var(--font2)', fontWeight: 600,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--txt3)' }}
      >
        <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <span>Search</span>
        <kbd style={{
          padding: '1px 5px', borderRadius: 5, fontSize: 10,
          background: 'var(--border)', color: 'var(--txt3)',
          fontFamily: 'var(--font3)', fontWeight: 700,
        }}>⌘K</kbd>
      </button>

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
