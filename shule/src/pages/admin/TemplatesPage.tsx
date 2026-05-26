import { PageHeader } from '../../components/ui/PageHeader'

// Report card templates — stub card for now.
// Full implementation will allow uploading custom CSS/logo for the PDF header.
export function TemplatesPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 600 }}>
      <PageHeader
        title="Report Templates"
        subtitle="Customise the PDF layout for report cards."
      />
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--txt3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M7 8h10M7 12h10M7 16h6" />
        </svg>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--txt)' }}>Coming soon</div>
        <div style={{ fontSize: 13, color: 'var(--txt3)', maxWidth: 340 }}>
          Report card templates will allow you to upload a custom school logo and adjust the PDF header layout.
          For now, all report cards use the default Shule template.
        </div>
      </div>
    </div>
  )
}
