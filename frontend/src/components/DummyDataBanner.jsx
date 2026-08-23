/**
 * DummyDataBanner.jsx
 * Shown when live financial data is unavailable.
 * Rule: Not dismissible while dummy data is active; auto-hides when live data arrives.
 */
export default function DummyDataBanner({ show }) {
  if (!show) return null;
  return (
    <div style={{
      width: '100%',
      background: '#7c1d1d',
      borderBottom: '3px solid #f85149',
      color: '#ffdcd8',
      padding: '12px 20px',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      fontSize: 13,
      lineHeight: 1.6,
      zIndex: 9999,
      position: 'sticky',
      top: 0,
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
      <div>
        <strong style={{ fontSize: 14 }}>Warning: Live market data is currently unavailable.</strong>
        <br />
        All displayed data is simulated or placeholder data and does <strong>not</strong> reflect real market values.
        <strong style={{ color: '#ffb3ae' }}> Do not make financial decisions based on this information.</strong>
      </div>
    </div>
  );
}
