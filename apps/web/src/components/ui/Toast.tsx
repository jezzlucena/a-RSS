import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToastStore, Toast as ToastType, ToastType as ToastVariant } from '@/stores/toastStore';
import { cn } from '@/lib/utils';

const icons: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
};

const variants: Record<ToastVariant, string> = {
  success: 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400',
  error: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
  warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400',
};

const iconColors: Record<ToastVariant, string> = {
  success: 'text-green-500',
  error: 'text-red-500',
  info: 'text-blue-500',
  warning: 'text-yellow-500',
};

const progressColors: Record<ToastVariant, string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  warning: 'bg-yellow-500',
};

function ToastItem({ toast }: { toast: ToastType }) {
  const { removeToast } = useToastStore();
  const Icon = icons[toast.type];
  const duration = toast.duration || 5000;
  const [isPaused, setIsPaused] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const handleAnimationEnd = () => {
    removeToast(toast.id);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={cn(
        'relative flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-lg shadow-lg overflow-hidden',
        variants[toast.type]
      )}
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0', iconColors[toast.type])} />
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        onClick={() => removeToast(toast.id)}
        className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Countdown progress bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/5 dark:bg-white/5 overflow-hidden">
          <div
            ref={progressRef}
            className={cn('h-full w-full origin-left', progressColors[toast.type])}
            style={{
              animation: `toast-progress ${duration}ms linear forwards`,
              animationPlayState: isPaused ? 'paused' : 'running',
            }}
            onAnimationEnd={handleAnimationEnd}
          />
        </div>
      )}
    </motion.div>
  );
}

export function ToastContainer() {
  const { toasts } = useToastStore();

  return (
    <>
      {/* CSS animation keyframes */}
      <style>{`
        @keyframes toast-progress {
          from {
            transform: scaleX(1);
          }
          to {
            transform: scaleX(0);
          }
        }
      `}</style>

      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastItem toast={toast} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
