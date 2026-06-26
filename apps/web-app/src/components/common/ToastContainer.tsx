import { useUIStore } from '../../store/uiStore';
import { CheckCircle2, Info, XCircle, X } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast, rightPanelOpen } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div 
      className="toast-container" 
      style={{ right: rightPanelOpen ? 'calc(var(--sidebar-width) + 16px)' : '16px' }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-item toast-${toast.type}`}>
          <div className="toast-icon">
            {toast.type === 'success' && <CheckCircle2 size={16} />}
            {toast.type === 'error' && <XCircle size={16} />}
            {toast.type === 'info' && <Info size={16} />}
          </div>
          <span className="toast-message">{toast.message}</span>
          <button className="toast-close" onClick={() => removeToast(toast.id)}>
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
