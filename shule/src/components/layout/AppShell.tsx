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

import { useState, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import { ROLE_NAV, ROLE_AVATAR, ROLE_LABEL } from '../../config/roleNav'

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

  // Persist theme to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('shule-theme', theme)
  }, [theme])

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
      />

      {/* ── RIGHT PANEL ─────────────────────────────────────────────── */}
      <div className="shell-r">
        <TopBar
          theme={theme}
          onToggle={toggleTheme}
          greeting={greeting(user.name)}
          today={todayLine()}
          user={user}
          avatar={avatar}
        />
        <main className="shell-main">
          <div className="page">
            <Outlet />
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
  nav:         ReturnType<typeof ROLE_NAV[keyof typeof ROLE_NAV]>
  user:        NonNullable<ReturnType<typeof useAuth>['user']>
  avatar:      { bg: string; color: string }
  roleLabel:   string
  currentPath: string
  onSignOut:   () => void
}

function Sidebar({ nav, user, avatar, roleLabel, currentPath, onSignOut }: SidebarProps) {
  return (
    <nav className="sb">
      {/* Logo + school name */}
      <div className="sbtop">
        <div className="sbrand">
          <div className="slogo">S</div>
          <div>
            <div className="sname">Shule</div>
            <div className="ssub">School OS</div>
          </div>
        </div>

        {/* School pill — name comes from user.schoolId for now; real name via DB later */}
        <div className="school-pill">
          <div className="school-ico">K</div>
          <div>
            <div className="school-name">Kampala Junior Academy</div>
            <div className="school-loc">Nakasero, Kampala</div>
          </div>
        </div>
      </div>

      {/* Navigation groups */}
      <div className="sb-nav">
        {nav.map((group, gi) => (
          <div key={gi}>
            {/* Only render the group label if it has text */}
            {group.label && (
              <div className="ngl">{group.label}</div>
            )}

            {group.items.map((item) => {
              // NavLink from react-router-dom handles active state
              // We add class "on" when this route is active
              const isActive = currentPath === item.path ||
                currentPath.startsWith(item.path + '/')

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

                  {/* Badge (alert dot — real count comes later from hooks) */}
                  {item.badge === 'alert' && (
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
        <div className="upill" onClick={onSignOut} title="Click to sign out">
          <div
            className="uava"
            style={{ background: avatar.bg, color: avatar.color }}
          >
            {initials(user.name)}
          </div>
          <div>
            <div className="u-name">{user.name}</div>
            <div className="u-role">{roleLabel}</div>
          </div>
          <div className="u-dot" />
        </div>
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

function TopBar({ theme, onToggle, greeting, today, user, avatar }: TopBarProps) {
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

      {/* Notifications icon */}
      <div className="tb-icon" title="Notifications" style={{ position: 'relative' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        {/* Notification dot — always shown for now; will be conditional later */}
        <div className="ndot" />
      </div>

      {/* Avatar */}
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
          cursor: 'pointer',
        }}
        title={user.name}
      >
        {initials(user.name)}
      </div>
    </div>
  )
}
