// ── validators.ts — Shule validation & normalisation utilities ────────────────
// No external dependencies. All functions return values / booleans; never throw.

// ── String normalisation ──────────────────────────────────────────────────────

/**
 * Capitalise each word, respecting apostrophes and hyphens.
 * "john doe"      → "John Doe"
 * "o'brien"       → "O'Brien"
 * "jean-baptiste" → "Jean-Baptiste"
 * "MARY ALICE"    → "Mary Alice"
 */
export function capitalizeName(str: string): string {
  if (!str) return str
  return str
    .toLowerCase()
    .replace(/(?:^|[\s\-'])([a-z])/g, (match, ch) => match.slice(0, match.length - 1) + ch.toUpperCase())
}

/**
 * Capitalise only the first letter of the whole string.
 * "hello world" → "Hello world"
 */
export function capitalizeFirst(str: string): string {
  if (!str) return str
  const t = str.trim()
  if (!t) return str
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

/**
 * Trim and lowercase an email address.
 * "  John@SCHOOL.AC.UG  " → "john@school.ac.ug"
 */
export function normalizeEmail(str: string): string {
  return str.trim().toLowerCase()
}

/**
 * Trim, collapse multiple internal spaces, remove null bytes.
 */
export function sanitizeText(str: string): string {
  return str.replace(/\0/g, '').trim().replace(/\s{2,}/g, ' ')
}

// ── Uganda phone normalisation ────────────────────────────────────────────────

export type PhoneResult = {
  normalized: string
  isUgandan:  boolean
  warning?:   string
}

/**
 * Normalise a phone number to Uganda local format where possible.
 * Rules (never block — always returns something):
 *  07XXXXXXXX (10 digits)       → keep, isUgandan = true
 *  +256XXXXXXXXX / 256XXXXXXXXX → strip prefix, prepend 0, isUgandan = true
 *  0800XXXXXX (toll-free)       → keep, isUgandan = true
 *  +X... (other country code)   → keep, isUgandan = false, warning = "International…"
 *  empty / blank                → { normalized: '', isUgandan: false }
 *  else                         → keep, isUgandan = false, warning = "Unrecognised…"
 */
export function normalizePhone(raw: string): PhoneResult {
  const stripped = raw.replace(/[\s\-().]/g, '')
  if (!stripped) return { normalized: '', isUgandan: false }

  // +256 prefix
  const plus256 = stripped.match(/^\+256(\d{9})$/)
  if (plus256) {
    return { normalized: '0' + plus256[1], isUgandan: true }
  }

  // 256 prefix (no +)
  const bare256 = stripped.match(/^256(\d{9})$/)
  if (bare256) {
    return { normalized: '0' + bare256[1], isUgandan: true }
  }

  // Local 07XXXXXXXX (10 digits)
  if (/^07\d{8}$/.test(stripped)) {
    return { normalized: stripped, isUgandan: true }
  }

  // Ugandan toll-free 0800XXXXXX
  if (/^0800\d{6}$/.test(stripped)) {
    return { normalized: stripped, isUgandan: true }
  }

  // Other international (+X...)
  if (/^\+\d/.test(stripped)) {
    return {
      normalized: stripped,
      isUgandan:  false,
      warning:    "International number — verify it's correct",
    }
  }

  // Unrecognised
  return {
    normalized: raw.trim(),
    isUgandan:  false,
    warning:    "Unrecognized format — verify it's correct",
  }
}

// ── Field validators (return true/false, never throw) ────────────────────────

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/**
 * Accepts: 07XXXXXXXX (10 digits), +256XXXXXXXXX, 256XXXXXXXXX
 */
export function isValidUgandaPhone(phone: string): boolean {
  const s = phone.replace(/[\s\-().]/g, '')
  return /^07\d{8}$/.test(s) || /^\+256\d{9}$/.test(s) || /^256\d{9}$/.test(s)
}

/**
 * Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
 */
export function isValidDate(str: string): boolean {
  return normalizeDate(str) !== null
}

/**
 * Normalise date string to ISO YYYY-MM-DD; returns null if unparseable.
 * Accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
 */
export function normalizeDate(str: string): string | null {
  const s = str.trim()
  if (!s) return null

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : s
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = s.match(/^(\d{2})[/\-](\d{2})[/\-](\d{4})$/)
  if (dmyMatch) {
    const iso = `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`
    const d   = new Date(iso)
    return isNaN(d.getTime()) ? null : iso
  }

  return null
}

/**
 * Uganda NIN: starts with CF or CM, 14 chars total, alphanumeric.
 * Example: CF80012345678P
 */
export function isValidNationalId(id: string): boolean {
  const s = id.trim().toUpperCase()
  return /^(CF|CM)[A-Z0-9]{12}$/.test(s)
}

/**
 * Integer between 2000 and currentYear+1 (inclusive).
 */
export function isValidYear(year: string | number): boolean {
  const n    = typeof year === 'string' ? parseInt(year, 10) : year
  const curr = new Date().getFullYear()
  return Number.isInteger(n) && n >= 2000 && n <= curr + 1
}

/**
 * Term must be 1, 2, or 3.
 */
export function isValidTerm(term: string | number): boolean {
  const n = typeof term === 'string' ? parseInt(term, 10) : term
  return n === 1 || n === 2 || n === 3
}

// ── Form helpers ──────────────────────────────────────────────────────────────

export function validateRequired(value: string, label: string): string | null {
  return value.trim() ? null : `${label} is required`
}

export function validateMaxLength(value: string, max: number, label: string): string | null {
  return value.length <= max ? null : `${label} must be ${max} characters or fewer`
}

export function validateMinLength(value: string, min: number, label: string): string | null {
  return value.length >= min ? null : `${label} must be at least ${min} characters`
}

// ── Import row validators ─────────────────────────────────────────────────────

export type RowWarning = {
  field:    string
  message:  string
  severity: 'error' | 'warning'
}

const VALID_GENDERS: string[] = ['male', 'female', 'm', 'f']
const VALID_STAFF_ROLES: string[] = [
  'principal', 'deputy', 'dos', 'secretary', 'bursar', 'class_teacher', 'teacher',
]

function str(v: unknown): string {
  return typeof v === 'string' ? v : String(v ?? '')
}

/**
 * Validate a parsed student import row.
 * Errors:   missing first_name, missing last_name
 * Warnings: unrecognised gender, invalid dob format, invalid phone format
 */
export function validateStudentRow(row: Record<string, unknown>): RowWarning[] {
  const warnings: RowWarning[] = []

  if (!str(row.first_name).trim()) {
    warnings.push({ field: 'first_name', message: 'First name is required', severity: 'error' })
  }
  if (!str(row.last_name).trim()) {
    warnings.push({ field: 'last_name', message: 'Last name is required', severity: 'error' })
  }

  const gender = str(row.gender).trim().toLowerCase()
  if (gender && !VALID_GENDERS.includes(gender)) {
    warnings.push({
      field:    'gender',
      message:  `Unrecognised gender value "${str(row.gender)}" — expected male or female`,
      severity: 'warning',
    })
  }

  const dob = str(row.dob).trim()
  if (dob && !isValidDate(dob)) {
    warnings.push({
      field:    'dob',
      message:  `Invalid date of birth format "${dob}" — use YYYY-MM-DD`,
      severity: 'warning',
    })
  }

  const phone = str(row.phone).trim()
  if (phone) {
    const result = normalizePhone(phone)
    if (result.warning) {
      warnings.push({ field: 'phone', message: result.warning, severity: 'warning' })
    }
  }

  return warnings
}

/**
 * Validate a parsed staff import row.
 * Errors:   missing first_name, missing last_name, missing role, invalid role value
 * Warnings: invalid email, unrecognised phone format, invalid national_id format
 */
export function validateStaffRow(row: Record<string, unknown>): RowWarning[] {
  const warnings: RowWarning[] = []

  if (!str(row.first_name).trim()) {
    warnings.push({ field: 'first_name', message: 'First name is required', severity: 'error' })
  }
  if (!str(row.last_name).trim()) {
    warnings.push({ field: 'last_name', message: 'Last name is required', severity: 'error' })
  }

  const role = str(row.role).trim().toLowerCase()
  if (!role) {
    warnings.push({ field: 'role', message: 'Role is required', severity: 'error' })
  } else if (!VALID_STAFF_ROLES.includes(role)) {
    warnings.push({
      field:    'role',
      message:  `Invalid role "${str(row.role)}" — valid values: ${VALID_STAFF_ROLES.join(', ')}`,
      severity: 'error',
    })
  }

  const email = str(row.email).trim()
  if (email && !isValidEmail(email)) {
    warnings.push({ field: 'email', message: `Invalid email address "${email}"`, severity: 'warning' })
  }

  const phone = str(row.phone).trim()
  if (phone) {
    const result = normalizePhone(phone)
    if (result.warning) {
      warnings.push({ field: 'phone', message: result.warning, severity: 'warning' })
    }
  }

  const nationalId = str(row.national_id).trim()
  if (nationalId && !isValidNationalId(nationalId)) {
    warnings.push({
      field:    'national_id',
      message:  'Invalid National ID format — expected CF or CM followed by 12 alphanumeric characters',
      severity: 'warning',
    })
  }

  return warnings
}

/**
 * Validate a parsed fee import row.
 * Errors:   missing student_name (or both first_name+last_name), missing class_name,
 *           invalid amount_paid, invalid amount_due, invalid term
 * Warnings: amount_paid > amount_due (overpayment), year < 2020 or > currentYear+1
 */
export function validateFeeRow(row: Record<string, unknown>): RowWarning[] {
  const warnings: RowWarning[] = []
  const curr = new Date().getFullYear()

  const studentName = str(row.student_name).trim()
  const firstName   = str(row.first_name).trim()
  const lastName    = str(row.last_name).trim()
  if (!studentName && !(firstName && lastName)) {
    warnings.push({
      field:    'student_name',
      message:  'Student name is required (provide student_name or both first_name and last_name)',
      severity: 'error',
    })
  }

  if (!str(row.class_name).trim()) {
    warnings.push({ field: 'class_name', message: 'Class name is required', severity: 'error' })
  }

  const amountDueRaw  = str(row.amount_due).trim()
  const amountPaidRaw = str(row.amount_paid).trim()
  const amountDue     = amountDueRaw  ? parseFloat(amountDueRaw)  : NaN
  const amountPaid    = amountPaidRaw ? parseFloat(amountPaidRaw) : NaN

  if (amountDueRaw && isNaN(amountDue)) {
    warnings.push({ field: 'amount_due',  message: `Invalid amount_due "${amountDueRaw}" — must be a number`,  severity: 'error' })
  }
  if (amountPaidRaw && isNaN(amountPaid)) {
    warnings.push({ field: 'amount_paid', message: `Invalid amount_paid "${amountPaidRaw}" — must be a number`, severity: 'error' })
  }

  const termRaw = str(row.term).trim()
  if (termRaw && !isValidTerm(termRaw)) {
    warnings.push({ field: 'term', message: `Invalid term "${termRaw}" — must be 1, 2, or 3`, severity: 'error' })
  }

  if (!isNaN(amountDue) && !isNaN(amountPaid) && amountPaid > amountDue) {
    warnings.push({
      field:    'amount_paid',
      message:  `Amount paid (${amountPaid}) exceeds amount due (${amountDue}) — possible overpayment`,
      severity: 'warning',
    })
  }

  const yearRaw = str(row.year).trim()
  if (yearRaw) {
    const yr = parseInt(yearRaw, 10)
    if (isNaN(yr) || yr < 2020 || yr > curr + 1) {
      warnings.push({
        field:    'year',
        message:  `Year "${yearRaw}" is out of expected range (2020–${curr + 1})`,
        severity: 'warning',
      })
    }
  }

  return warnings
}
