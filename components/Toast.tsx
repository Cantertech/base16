import React, { useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number; // ms, 0 = persistent
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = React.createContext<{
    toast: (type: ToastType, title: string, message?: string, duration?: number) => void;
    dismiss: (id: string) => void;
} | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const toast = useCallback((type: ToastType, title: string, message?: string, duration = 4000) => {
        const id = `toast-${Date.now()}-${Math.random()}`;
        setToasts(prev => [...prev.slice(-4), { id, type, title, message, duration }]); // Max 5 toasts
        if (duration > 0) {
            setTimeout(() => dismiss(id), duration);
        }
    }, [dismiss]);

    return (
        <ToastContext.Provider value={{ toast, dismiss }}>
            {children}
            <ToastContainer toasts={toasts} onDismiss={dismiss} />
        </ToastContext.Provider>
    );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useToast = () => {
    const ctx = React.useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within a ToastProvider');
    return ctx;
};

// ─── Individual Toast ────────────────────────────────────────────────────────

const ICONS: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />,
    error: <XCircle className="w-5 h-5 text-red-500 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
};

const ACCENT: Record<ToastType, string> = {
    success: 'border-l-emerald-500',
    error: 'border-l-red-500',
    warning: 'border-l-amber-500',
    info: 'border-l-blue-500',
};

const PROGRESS_COLOR: Record<ToastType, string> = {
    success: 'bg-emerald-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
};

const Toast: React.FC<{ item: ToastItem; onDismiss: (id: string) => void }> = ({ item, onDismiss }) => {
    const [visible, setVisible] = useState(false);
    const [leaving, setLeaving] = useState(false);

    useEffect(() => {
        // Trigger enter animation
        const t = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(t);
    }, []);

    const handleDismiss = () => {
        setLeaving(true);
        setTimeout(() => onDismiss(item.id), 300);
    };

    return (
        <div
            className={`
                relative flex items-start gap-3 bg-white rounded-xl border border-slate-200 border-l-4
                ${ACCENT[item.type]} shadow-xl shadow-slate-900/10 p-4 pr-10 min-w-[280px] max-w-[380px]
                transition-all duration-300 ease-out overflow-hidden
                ${visible && !leaving ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}
            `}
        >
            {ICONS[item.type]}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 leading-tight">{item.title}</p>
                {item.message && (
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">{item.message}</p>
                )}
            </div>
            <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 text-slate-300 hover:text-slate-500 transition-colors"
            >
                <X className="w-4 h-4" />
            </button>
            {/* Progress bar */}
            {item.duration && item.duration > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-100">
                    <div
                        className={`h-full ${PROGRESS_COLOR[item.type]} origin-left`}
                        style={{
                            animation: `shrink ${item.duration}ms linear forwards`,
                        }}
                    />
                </div>
            )}
        </div>
    );
};

// ─── Container ───────────────────────────────────────────────────────────────

const ToastContainer: React.FC<{ toasts: ToastItem[]; onDismiss: (id: string) => void }> = ({ toasts, onDismiss }) => {
    if (toasts.length === 0) return null;
    return (
        <div className="fixed bottom-6 right-4 md:right-6 z-[9999] flex flex-col gap-2 items-end pointer-events-none">
            {toasts.map(t => (
                <div key={t.id} className="pointer-events-auto">
                    <Toast item={t} onDismiss={onDismiss} />
                </div>
            ))}
            <style>{`
                @keyframes shrink {
                    from { transform: scaleX(1); }
                    to { transform: scaleX(0); }
                }
            `}</style>
        </div>
    );
};

export default ToastProvider;
