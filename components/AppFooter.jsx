export default function AppFooter() {
  return (
    <footer
      style={{
        textAlign: 'center',
        padding: '12px 16px',
        fontSize: 12,
        color: 'var(--color-muted)',
        borderTop: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      __APP_NAME__ — v{process.env.NEXT_PUBLIC_APP_VERSION}
    </footer>
  )
}
