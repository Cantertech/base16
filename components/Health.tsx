import React, { useState, useEffect } from 'react';
import {
    Heart,
    Activity,
    Plus,
    Search,
    FileText,
    AlertCircle,
    Thermometer,
    Stethoscope,
    Calendar,
    Save,
    X,
    User
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

const Health = ({ currentUser }: { currentUser: any }) => {
    const [activeTab, setActiveTab] = useState('visits'); // visits, records
    const [showVisitModal, setShowVisitModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    return (
        <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-full overflow-hidden">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Heart className="h-6 w-6 text-red-500 fill-red-500" /> Health Centre
                    </h1>
                    <p className="text-slate-500 text-sm">Manage student health records and clinic visits.</p>
                </div>
                <button
                    onClick={() => setShowVisitModal(true)}
                    className="bg-red-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200 flex items-center gap-2"
                >
                    <Plus className="h-5 w-5" /> Log Clinic Visit
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-50 text-red-600 rounded-lg"><Activity className="h-5 w-5" /></div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Today's Visits</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">0</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><AlertCircle className="h-5 w-5" /></div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Medical Alerts</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-800">0</p>
                </div>
            </div>

            {/* Config / Tabs */}
            <div className="flex space-x-2 bg-slate-100 p-1 rounded-xl w-full md:w-fit overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('visits')}
                    className={`px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap ${activeTab === 'visits' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Clinic Visits
                </button>
                <button
                    onClick={() => setActiveTab('records')}
                    className={`px-4 md:px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap ${activeTab === 'records' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Medical Records
                </button>
            </div>

            {/* Content Area */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">
                {activeTab === 'visits' ? (
                    <div className="p-8 text-center text-slate-400">
                        <Stethoscope className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>No clinic visits recorded yet.</p>
                    </div>
                ) : (
                    <div className="p-8 text-center text-slate-400">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p>No medical records found.</p>
                    </div>
                )}
            </div>

            {/* Modal - Placeholder for now */}
            {showVisitModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">Log Clinic Visit</h3>
                            <button onClick={() => setShowVisitModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
                        </div>
                        <p className="text-slate-500 text-sm mb-6">Clinic module is being set up. Database tables required.</p>
                        <button onClick={() => setShowVisitModal(false)} className="w-full py-3 bg-slate-100 font-bold text-slate-600 rounded-xl hover:bg-slate-200">Close</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Health;
