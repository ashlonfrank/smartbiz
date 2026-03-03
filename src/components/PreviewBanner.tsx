import React from 'react';

export default function PreviewBanner() {
  const now = new Date().toLocaleString();
  return (
    <div style={{ padding: 12, background: '#f0f9ff', borderRadius: 8, marginBottom: 16, border: '1px solid #d0e7ff' }}>
      <strong>Live Preview:</strong> edited at {now}
    </div>
  );
}

