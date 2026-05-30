/**
 * roleNav.ts — Sidebar navigation config per user role.
 *
 * SVG paths are taken verbatim from the canonical design files:
 *   Design_docs/shule-designs.html  (Principal)
 *   Design_docs/shule-wireframes.html (all other roles)
 *
 * Finance nav items NEVER appear for non-finance roles.
 * This is the UI-layer enforcement. DB-level RLS is the hard wall.
 */

import type { UserRole } from '../store/AuthContext'

export type NavItem = {
  label: string
  path: string
  svg: string        // full <svg …>…</svg> string from canonical HTML
  badge?: 'alert'    // shows red badge — count comes from a future hook
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

export type RoleNav = NavGroup[]

// ─── SVG helpers (exact paths from design files) ──────────────────────────────

const SVG = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  analytics: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  auditLog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  students: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
  staff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>`,
  classes: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  reportCards: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>`,
  academicYear: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  messages: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  announcements: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M21 12h-2M19.07 19.07l-1.41-1.41M12 21v-2M4.93 19.07l1.41-1.41M3 12h2M4.93 4.93l1.41 1.41"/></svg>`,
  feeLedger: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>`,
  importData: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
  feeStructure: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  addPayment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`,
  smsReminders: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>`,
  deliveryLog: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  salary: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>`,
  feeReports: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  examJournal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>`,
  enterMarks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  attendance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  curriculum: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`,
  reportPreview: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  subjects: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>`,
  teachers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>`,
  curriculumPlan: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/></svg>`,
  allJournals: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>`,
  timetable: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  discipline: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  results: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  feeBalance: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>`,
  notices: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/></svg>`,
  survey: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`,
  passwordResets: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`,
  schoolProfile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>`,
  apiConfig: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>`,
  reportTemplates: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>`,
  systemSettings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M21 12h-2M19.07 19.07l-1.41-1.41M12 21v-2M4.93 19.07l1.41-1.41M3 12h2M4.93 4.93l1.41 1.41"/></svg>`,
  feeStatus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  portalLinks: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>`,
}

// ─── Role navigation configs ───────────────────────────────────────────────────

export const ROLE_NAV: Record<UserRole, RoleNav> = {

  // ── PRINCIPAL ── Full access to everything
  principal: [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard',    path: '/principal/dashboard',    svg: SVG.dashboard    },
        { label: 'Analytics',    path: '/principal/analytics',    svg: SVG.analytics    },
        { label: 'Audit Log',    path: '/principal/audit',        svg: SVG.auditLog     },
      ],
    },
    {
      label: 'School',
      items: [
        { label: 'Students',     path: '/principal/students',     svg: SVG.students     },
        { label: 'Staff',        path: '/principal/staff',        svg: SVG.staff        },
        { label: 'Classes',      path: '/principal/classes',      svg: SVG.classes      },
      ],
    },
    {
      label: 'Academic',
      items: [
        { label: 'Report Cards', path: '/principal/report-cards', svg: SVG.reportCards },
        { label: 'Academic Year',path: '/principal/academic-year',svg: SVG.academicYear },
      ],
    },
    {
      label: 'Communication',
      items: [
        { label: 'Messages',     path: '/principal/messages',     svg: SVG.messages,    badge: 'alert' },
        { label: 'Announcements',path: '/principal/announcements',svg: SVG.announcements},
        { label: 'Settings',     path: '/principal/settings',     svg: SVG.settings     },
      ],
    },
  ],

  // ── SECRETARY ── Student/staff management, fee STATUS only (no amounts)
  secretary: [
    {
      label: 'Main',
      items: [
        { label: 'Dashboard',    path: '/secretary/dashboard',    svg: SVG.dashboard    },
        { label: 'Students',     path: '/secretary/students',     svg: SVG.students     },
        { label: 'Staff',        path: '/secretary/staff',        svg: SVG.staff        },
        { label: 'Classes',      path: '/secretary/classes',      svg: SVG.classes      },
      ],
    },
    {
      label: 'Limited Access',
      items: [
        // Secretary sees fee status FLAG only — no amounts, no ledger
        { label: 'Fee Status',   path: '/secretary/fee-status',  svg: SVG.feeStatus    },
      ],
    },
    {
      label: 'Reports',
      items: [
        { label: 'Morning Brief', path: '/secretary/briefing',    svg: SVG.analytics   },
        { label: 'Reports',       path: '/secretary/reports',     svg: SVG.auditLog    },
        { label: 'Report Cards',  path: '/secretary/report-cards',svg: SVG.reportCards },
        { label: 'Portal Links',  path: '/secretary/portal-links',svg: SVG.portalLinks },
        { label: 'Import Data',   path: '/secretary/import',      svg: SVG.importData  },
        { label: 'Messages',      path: '/secretary/messages',    svg: SVG.messages,   badge: 'alert' },
      ],
    },
  ],

  // ── BURSAR ── Full finance access, no academic/discipline
  bursar: [
    {
      label: 'Finance',
      items: [
        { label: 'Dashboard',    path: '/bursar/dashboard',       svg: SVG.dashboard    },
        { label: 'Fee Ledger',   path: '/bursar/fees',            svg: SVG.feeLedger    },
        { label: 'Import Fees',  path: '/bursar/import',          svg: SVG.importData   },
        { label: 'Fee Structure',path: '/bursar/fee-structure',   svg: SVG.feeStructure },
      ],
    },
    {
      label: 'Payments',
      items: [
        { label: 'Add Payment',  path: '/bursar/add-payment',    svg: SVG.addPayment   },
        { label: 'SMS Reminders',path: '/bursar/reminders',      svg: SVG.smsReminders },
        { label: 'Delivery Log', path: '/bursar/delivery-log',   svg: SVG.deliveryLog  },
      ],
    },
    {
      label: 'Payroll',
      items: [
        { label: 'Salary Records',path: '/bursar/salaries',      svg: SVG.salary       },
        { label: 'Fee Reports',  path: '/bursar/reports',        svg: SVG.feeReports   },
        { label: 'Messages',     path: '/bursar/messages',       svg: SVG.messages,    badge: 'alert' },
      ],
    },
  ],

  // ── TEACHER ── Academic only, zero finance
  teacher: [
    {
      label: 'My Teaching',
      items: [
        { label: 'Dashboard',    path: '/teacher/dashboard',     svg: SVG.dashboard    },
        { label: 'My Events',    path: '/teacher/events',        svg: SVG.announcements},
        { label: 'Exam Journal', path: '/teacher/exams',         svg: SVG.examJournal  },
        { label: 'Attendance',   path: '/teacher/attendance',    svg: SVG.attendance   },
        { label: 'My Timetable', path: '/teacher/timetable',     svg: SVG.timetable    },
        { label: 'Curriculum',   path: '/teacher/curriculum',    svg: SVG.curriculum   },
      ],
    },
    {
      label: 'Reports',
      items: [
        { label: 'Remarks',      path: '/teacher/exams/remarks', svg: SVG.reportPreview},
        { label: 'Messages',     path: '/teacher/messages',      svg: SVG.messages,    badge: 'alert' },
      ],
    },
  ],

  // ── CLASS TEACHER ── Same as teacher (same routes, same nav)
  class_teacher: [
    {
      label: 'My Teaching',
      items: [
        { label: 'Dashboard',    path: '/teacher/dashboard',     svg: SVG.dashboard    },
        { label: 'My Events',    path: '/teacher/events',        svg: SVG.announcements},
        { label: 'Exam Journal', path: '/teacher/exams',         svg: SVG.examJournal  },
        { label: 'Attendance',   path: '/teacher/attendance',    svg: SVG.attendance   },
        { label: 'My Timetable', path: '/teacher/timetable',     svg: SVG.timetable    },
        { label: 'Curriculum',   path: '/teacher/curriculum',    svg: SVG.curriculum   },
      ],
    },
    {
      label: 'Reports',
      items: [
        { label: 'Remarks',      path: '/teacher/exams/remarks', svg: SVG.reportPreview},
        { label: 'Messages',     path: '/teacher/messages',      svg: SVG.messages,    badge: 'alert' },
      ],
    },
  ],

  // ── DOS (Director of Studies) ── Academic analytics, zero finance
  dos: [
    {
      label: 'Academic',
      items: [
        { label: 'Dashboard',     path: '/dos/dashboard',         svg: SVG.analytics    },
        { label: 'Subjects',      path: '/dos/subjects',          svg: SVG.subjects     },
        { label: 'Classes',       path: '/dos/classes',           svg: SVG.classes      },
        { label: 'Teachers',      path: '/dos/teachers',          svg: SVG.teachers     },
        { label: 'Curriculum Plan',path: '/dos/curriculum',       svg: SVG.curriculumPlan},
        { label: 'All Journals',  path: '/dos/journals',          svg: SVG.allJournals  },
      ],
    },
    {
      label: 'Tools',
      items: [
        { label: 'Timetable',    path: '/dos/timetable',         svg: SVG.timetable    },
        { label: 'Surveys',      path: '/dos/surveys',           svg: SVG.auditLog     },
        { label: 'Messages',     path: '/dos/messages',          svg: SVG.messages,    badge: 'alert' },
      ],
    },
  ],

  // ── DEPUTY PRINCIPAL ── Discipline + attendance, zero finance
  deputy: [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard',    path: '/deputy/dashboard',      svg: SVG.dashboard    },
        { label: 'Discipline',   path: '/deputy/discipline',     svg: SVG.discipline   },
        { label: 'Timetable',    path: '/deputy/timetable',      svg: SVG.timetable    },
        { label: 'Students',     path: '/deputy/students',       svg: SVG.students     },
        { label: 'Messages',     path: '/deputy/messages',       svg: SVG.messages,    badge: 'alert' },
      ],
    },
  ],

  // ── PARENT ── Read-only portal — all tabs live on /parent/portal
  parent: [
    {
      label: '',
      items: [
        { label: 'My Portal',    path: '/parent/portal',         svg: SVG.dashboard    },
      ],
    },
  ],

  // ── STUDENT ── Own data only — all tabs live on /student/portal
  student: [
    {
      label: 'My Portal',
      items: [
        { label: 'My Portal',    path: '/student/portal',        svg: SVG.dashboard    },
      ],
    },
  ],

  // ── IT ADMIN ── System management, no school data
  it_admin: [
    {
      label: 'System',
      items: [
        { label: 'Dashboard',      path: '/admin/dashboard',     svg: SVG.dashboard        },
        { label: 'Users',          path: '/admin/users',         svg: SVG.users            },
        { label: 'Password Resets',path: '/admin/resets',        svg: SVG.passwordResets },
      ],
    },
    {
      label: 'Settings',
      items: [
        { label: 'School Profile', path: '/admin/school',        svg: SVG.schoolProfile    },
        { label: 'SMS / WhatsApp', path: '/admin/api',           svg: SVG.apiConfig        },
        { label: 'Report Templates',path: '/admin/templates',    svg: SVG.reportTemplates  },
        { label: 'System Settings',path: '/admin/settings',      svg: SVG.systemSettings   },
        { label: 'Messages',       path: '/admin/messages',      svg: SVG.messages,        badge: 'alert' },
      ],
    },
  ],
}

// ─── Avatar colors per role (from CLAUDE.md) ──────────────────────────────────
export const ROLE_AVATAR: Record<UserRole, { bg: string; color: string }> = {
  principal:     { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b' },
  deputy:        { bg: 'rgba(34,211,238,0.12)',   color: '#22d3ee' },
  dos:           { bg: 'rgba(139,92,246,0.15)',   color: '#a78bfa' },
  secretary:     { bg: 'rgba(244,114,182,0.15)',  color: '#f472b6' },
  bursar:        { bg: 'rgba(245,158,11,0.15)',   color: '#fbbf24' },
  class_teacher: { bg: 'rgba(14,165,233,0.15)',   color: '#38bdf8' },
  teacher:       { bg: 'rgba(14,165,233,0.15)',   color: '#38bdf8' },
  student:       { bg: 'rgba(13,217,196,0.12)',   color: '#0dd9c4' },
  parent:        { bg: 'rgba(16,185,129,0.12)',   color: '#10b981' },
  it_admin:      { bg: 'rgba(100,116,139,0.20)',  color: '#94a3b8' },
}

// ─── Human-readable role labels ────────────────────────────────────────────────
export const ROLE_LABEL: Record<UserRole, string> = {
  principal:     'Principal',
  deputy:        'Deputy Principal',
  dos:           'Dir. of Studies',
  secretary:     'Secretary',
  bursar:        'Bursar',
  class_teacher: 'Class Teacher',
  teacher:       'Teacher',
  student:       'Student',
  parent:        'Parent',
  it_admin:      'IT Administrator',
}
