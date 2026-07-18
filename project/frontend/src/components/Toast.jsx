import { useEffect, useState } from 'react';

let toastId = 0;
let globalAddToast = null;

export function addToast(message, type = 'info', duration = 4000) {
  if (globalAddToast) {
    globalAddToast({ id: ++toastId, message, type, duration });
  }
}

const BORDER_COLORS = {
  success: '#34d399',
  error: '#f87171',
  warning: '#fbbf24',
  info: '#818cf8',
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    globalAddToast = (t) => setToasts(prev => [...prev, t]);
    return () => { globalAddToast = null; };
  }, []);

  const remove = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 10,
      pointerEvents: 'none', width: '90%', maxWidth: 380,
    }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDone={() => remove(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDone }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDone, 300);
    }, toast.duration);
    return () => clearTimeout(timer);
  }, [visible]);

  const borderColor = BORDER_COLORS[toast.type] || BORDER_COLORS.info;

  return (
    <div
      onClick={() => { setExiting(true); setTimeout(onDone, 300); }}
      style={{
        padding: '14px 18px',
        borderRadius: 12,
        background: 'rgba(22, 22, 24, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderLeft: `3px solid ${borderColor}`,
        color: 'var(--text-primary)',
        fontSize: 14,
        fontWeight: 500,
        lineHeight: 1.4,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        cursor: 'pointer',
        pointerEvents: 'all',
        transform: visible && !exiting ? 'translateX(0) scale(1)' : 'translateX(40px) scale(0.95)',
        opacity: visible && !exiting ? 1 : 0,
        transition: 'transform 0.3s ease, opacity 0.3s ease',
      }}
    >
      {toast.message}
    </div>
  );
}
