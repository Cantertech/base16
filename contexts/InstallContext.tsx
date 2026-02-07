import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface InstallContextType {
    isInstallable: boolean;
    isIOS: boolean;
    isAppInstalled: boolean;
    showInstallPrompt: () => void;
    deferredPrompt: any;
}

const InstallContext = createContext<InstallContextType | undefined>(undefined);

export const InstallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isIOS, setIsIOS] = useState(false);
    const [isAppInstalled, setIsAppInstalled] = useState(false);

    useEffect(() => {
        // Check if device is iOS
        const isIosDevice = /iPhone|iPad|iPod/.test(navigator.userAgent);
        setIsIOS(isIosDevice);

        // Check if app is already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        setIsAppInstalled(isStandalone);

        const handleBeforeInstallPrompt = (e: any) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
        };

        const handleAppInstalled = () => {
            setIsAppInstalled(true);
            setDeferredPrompt(null);
            console.log('App installed successfully');
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const showInstallPrompt = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult: any) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the install prompt');
                } else {
                    console.log('User dismissed the install prompt');
                }
                setDeferredPrompt(null);
            });
        }
    };

    return (
        <InstallContext.Provider value={{
            isInstallable: !!deferredPrompt || isIOS,
            isIOS,
            isAppInstalled,
            showInstallPrompt,
            deferredPrompt
        }}>
            {children}
        </InstallContext.Provider>
    );
};

export const useInstall = () => {
    const context = useContext(InstallContext);
    if (context === undefined) {
        throw new Error('useInstall must be used within an InstallProvider');
    }
    return context;
};
