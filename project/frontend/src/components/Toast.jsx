import { useEffect, useState } from 'react';

let toastId = 0;
let globalAddToast = null;

export function addToast(message, type = 'info', duration = 4000) {
  if (globalAddToast) {
    globalAddToast({ id: ++toastId, message, type, duration });
  }
}

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
      position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10,
      pointerEvents: 'none', width: '90%', maxWidth: 420
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

  const bg = {
    success: '#0d3d1a',
    error: '#3d0d0d',
    info: '#1a1a3d',
    warning: '#3d2d0d',
  }[toast.type] || '#1a1a3d';

  const border = {
    success: '#1a6e3a',
    error: '#6e1a1a',
    info: '#3a3a8e',
    warning: '#8e6e1a',
  }[toast.type] || '#3a3a8e';

  const color = {
    success: '#a5fca5',
    error: '#fca5a5',
    info: '#a5b4fc',
    warning: '#fcd34d',
  }[toast.type] || '#a5b4fc';

  return (
    <div
      onClick={() => { setExiting(true); setTimeout(onDone, 300); }}
      style={{
        padding: '14px 18px',
        borderRadius: 12,
        background: bg,
        border: `1px solid ${border}`,
        color,
        fontSize: 15,
        fontWeight: 500,
        lineHeight: 1.4,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        cursor: 'pointer',
        pointerEvents: 'all',
        transform: visible && !exiting ? 'translateY(0) scale(1)' : 'translateY(-20px) scale(0.95)',
        opacity: visible && !exiting ? 1 : 0,
        transition: 'transform 0.3s ease, opacity 0.3s ease',
        textAlign: 'center',
      }}
    >
      {toast.message}
    </div>
  );
}
