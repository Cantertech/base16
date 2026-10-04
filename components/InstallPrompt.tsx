import React, { useEffect, useState } from 'react';
import { Download, X, Share, PlusSquare, Zap } from 'lucide-react';
import { useInstall } from '../contexts/InstallContext';

const InstallPrompt: React.FC = () => {
    const { isInstallable, showInstallPrompt, isIOS, isAppInstalled } = useInstall();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const isDismissed = sessionStorage.getItem('base16_pwa_dismissed');
        if (isInstallable && !isAppInstalled && !isDismissed) {
            const timer = setTimeout(() => setIsVisible(true), 2500);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [isInstallable, isAppInstalled]);

    const handleDismiss = () => {
        setIsVisible(false);
        sessionStorage.setItem('base16_pwa_dismissed', 'true');
    };

    if (!isVisible) return null;

    if (isIOS) {
        return (
            <div className="fixed bottom-5 left-4 right-4 z-[999] animate-in slide-in-from-bottom-5 duration-500 max-w-md mx-auto">
                <div className="bg-slate-900/95 backdrop-blur-xl text-white p-5 rounded-3xl shadow-2xl border border-slate-700/80 relative">
                    <button
                        onClick={handleDismiss}
                        className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white bg-slate-800/80 rounded-full transition-colors"
                        aria-label="Dismiss"
                    >
                        <X className="h-4 w-4" />
                    </button>

                    <div className="flex items-start gap-3.5 pr-6">
                        <div className="w-12 h-12 rounded-2xl bg-blue-600 p-2 shrink-0 flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <img src="/orbit_pwa.png" alt="Base16" className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold uppercase tracking-wider mb-1">
                                <Zap className="w-3 h-3 text-blue-400" />
                                <span>Offline Ready</span>
                            </div>
                            <h3 className="font-black text-sm text-white">Install Base16 App</h3>
                            <p className="text-xs text-slate-300 mt-1 mb-3 leading-relaxed">
                                Add the full school system to your iPhone home screen for fast 1-tap access.
                            </p>
                            <div className="flex flex-col gap-2 text-xs text-slate-300 bg-slate-800/80 p-3 rounded-2xl border border-slate-700/50">
                                <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">1</span>
                                    <span>Tap the <Share className="h-3.5 w-3.5 inline mx-1 text-blue-400" /> <b>Share</b> button in Safari</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">2</span>
                                    <span>Scroll down and select <PlusSquare className="h-3.5 w-3.5 inline mx-1 text-emerald-400" /> <b>Add to Home Screen</b></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-5 left-4 right-4 z-[999] animate-in slide-in-from-bottom-5 duration-500 max-w-md mx-auto">
            <div className="bg-slate-900/95 backdrop-blur-xl text-white p-4 rounded-3xl shadow-2xl border border-slate-700/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-blue-600 p-2 shrink-0 flex items-center justify-center shadow-lg shadow-blue-500/30">
                        <img src="/orbit_pwa.png" alt="Base16" className="w-full h-full object-contain" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <h3 className="font-black text-sm text-white truncate">Install Base16 App</h3>
                            <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full">
                                Full System
                            </span>
                        </div>
                        <p className="text-xs text-slate-300 truncate mt-0.5">1-tap desktop & mobile access • Offline ready</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleDismiss}
                        className="p-2 text-slate-400 hover:text-white transition-colors"
                        aria-label="Dismiss"
                    >
                        <X className="h-4 w-4" />
                    </button>
                    <button
                        onClick={showInstallPrompt}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-600/30 active:scale-95"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Install App</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InstallPrompt;
