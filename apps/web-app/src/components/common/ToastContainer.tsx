import { CheckCircle2, Info, XCircle, X } from 'lucide-react';
import { useUIStore } from '../../store/uiStore';
import { Button } from '../ui/Button';
import './ToastContainer.css';

const TOAST_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
} as const;

export default function ToastContainer() {
  const { toasts, removeToast, rightPanelOpen } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className="toast-container"
      style={{ right: rightPanelOpen ? 'calc(var(--sidebar-width) + 16px)' : '16px' }}
    >
      {toasts.map((toast) => {
        const Icon = TOAST_ICONS[toast.type] ?? Info;

        return (
          <div key={toast.id} className="ds-toast toast-item" data-kind={toast.type} role="status">
            <Icon className="toast-icon" aria-hidden />
            <span className="toast-message">{toast.message}</span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="toast-close"
              onClick={() => removeToast(toast.id)}
              title="Dismiss"
              aria-label="Dismiss notification"
            >
              <X />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
