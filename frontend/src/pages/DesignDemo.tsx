export default function DesignDemo() {
  return (
    <div style={{ background: '#111113', minHeight: '100vh', padding: 32 }}>
      <p style={{ color: 'white', fontFamily: 'monospace', fontSize: 24 }}>
        DESIGN DEMO — React is rendering
      </p>
      <p style={{ color: '#4A9B8E', fontFamily: 'monospace', fontSize: 14, marginTop: 16 }}>
        If you see this, the component mounts fine and the issue is inside the full component code.
        If this page is also white, the issue is in the CSS pipeline or React mounting.
      </p>
    </div>
  );
}
