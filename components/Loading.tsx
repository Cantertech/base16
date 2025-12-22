import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingProps {
    fullScreen?: boolean;
    message?: string;
    type?: 'spinner' | 'skeleton';
}

const Loading: React.FC<LoadingProps> = ({ fullScreen = true, message = "Loading...", type = 'spinner' }) => {
    if (type === 'skeleton') {
        return (
            <div className={`${fullScreen ? 'fixed inset-0 z-50 flex items-center justify-center bg-slate-50' : 'w-full h-full flex items-center justify-center p-8'}`}>
                <div className="w-full max-w-md p-4 space-y-4 animate-pulse">
                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                    <div className="space-y-2">
                        <div className="h-4 bg-slate-200 rounded"></div>
                        <div className="h-4 bg-slate-200 rounded w-5/6"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`${fullScreen ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm' : 'flex flex-col items-center justify-center p-8'}`}>
            <div className="flex flex-col items-center gap-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary-200 rounded-full animate-ping opacity-75"></div>
                    <div className="relative bg-white p-3 rounded-full shadow-lg border border-primary-100">
                        <img src="/orbit_logo.jpg" alt="Loading" className="w-10 h-10 object-contain animate-pulse" />
                    </div>
                </div>
                {/* Spinner Ring */}
                {/* <Loader2 className="h-8 w-8 text-primary-600 animate-spin" /> */}

                <div className="flex flex-col items-center">
                    <h3 className="text-lg font-bold text-slate-800">{message}</h3>
                    <p className="text-sm text-slate-500">Please wait a moment</p>
                </div>
            </div>
        </div>
    );
};

export default Loading;
