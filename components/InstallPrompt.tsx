import React, { useEffect, useState } from 'react';
import { Download, X, Share, PlusSquare } from 'lucide-react';

const InstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // Check if device is iOS
        const isIosDevice = /iPhone|iPad|iPod/.test(navigator.userAgent);
        // Check if app is already installed (standalone mode)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

        if (isIosDevice && !isStandalone) {
            setIsIOS(true);
            setIsVisible(true);
        }

        const handleBeforeInstallPrompt = (e: any) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Update UI to notify the user they can add to home screen
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);

        // We've used the prompt, so clear it
        setDeferredPrompt(null);
        setIsVisible(false);
    };

    if (!isVisible) return null;

    if (isIOS) {
        return (
            <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom duration-500">
                <div className="bg-primary-900 text-white p-5 rounded-2xl shadow-2xl border border-primary-700 mx-auto max-w-md relative">
                    <button
                        onClick={() => setIsVisible(false)}
                        className="absolute top-2 right-2 p-2 text-blue-300 hover:text-white transition-colors"
                        aria-label="Dismiss"
                    >
                        <X className="h-5 w-5" />
                    </button>

                    <div className="flex items-start gap-4 pr-8">
                        <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-sm shrink-0">
                            <Download className="h-6 w-6 text-blue-200" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base mb-1">Install Base16 App</h3>
                            <p className="text-sm text-blue-100 mb-3 leading-relaxed">
                                Install this application on your home screen for quick and easy access.
                            </p>
                            <div className="flex flex-col gap-2 text-xs text-blue-200 font-medium">
                                <div className="flex items-center gap-2">
                                    <span className="bg-white/10 w-5 h-5 flex items-center justify-center rounded-full text-[10px]">1</span>
                                    <span>Tap the <Share className="h-3 w-3 inline mx-1" /> <strong>Share</strong> button below</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="bg-white/10 w-5 h-5 flex items-center justify-center rounded-full text-[10px]">2</span>
                                    <span>Select <PlusSquare className="h-3 w-3 inline mx-1" /> <strong>Add to Home Screen</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom duration-500">
            <div className="bg-primary-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border border-primary-700 mx-auto max-w-md">
                <div className="flex items-center gap-4">
                    <div className="bg-white/10 p-2.5 rounded-xl backdrop-blur-sm">
                        <Download className="h-6 w-6 text-blue-200" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm">Install Base16 App</h3>
                        <p className="text-xs text-blue-200 mt-0.5">Add to Home Screen for quick access</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsVisible(false)}
                        className="p-2 text-blue-300 hover:text-white transition-colors"
                        aria-label="Dismiss"
                    >
                        <X className="h-5 w-5" />
                    </button>
                    <button
                        onClick={handleInstallClick}
                        className="bg-white text-primary-900 px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-50 transition-colors shadow-sm"
                    >
                        Install
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InstallPrompt;
