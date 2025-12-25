import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { CheckCircle, XCircle, LogOut, Calendar, RefreshCw, AlertTriangle, Lock } from 'lucide-react';

interface School {
    id: string;
    name: string;
    admin_email: string;
    status: string;
    created_at: string;
    next_payment_due?: string;
    last_payment_date?: string;
    student_count?: number;
    teacher_count?: number;
}

interface SchoolDetailModalProps {
    school: School;
    onClose: () => void;
    onRenew: (id: string) => void;
    onToggleStatus: (id: string, currentStatus: string) => void;
    onImpersonate: (id: string) => void;
}

const SchoolDetailModal: React.FC<SchoolDetailModalProps> = ({ school, onClose, onRenew, onToggleStatus, onImpersonate }) => {
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        const fetchStats = async () => {
            const { count: students } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', school.id);
            const { count: teachers } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('school_id', school.id).eq('role', 'teacher');
            setStats({ students: students || 0, teachers: teachers || 0 });
        };
        fetchStats();
    }, [school.id]);

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">{school.name}</h2>
                        <p className="text-sm text-slate-500">School ID: {school.id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <XCircle className="h-6 w-6 text-slate-400" />
                    </button>
                </div>

                <div className="p-8 space-y-8">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <p className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">Total Students</p>
                            <p className="text-3xl font-bold text-slate-800">{stats ? stats.students : '...'}</p>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                            <p className="text-purple-600 text-xs font-bold uppercase tracking-wider mb-1">Total Teachers</p>
                            <p className="text-3xl font-bold text-slate-800">{stats ? stats.teachers : '...'}</p>
                        </div>
                    </div>

                    {/* Subscription Info */}
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-slate-500" /> Subscription Status
                        </h3>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-xs text-slate-500 mb-1">Status</p>
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase ${school.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {school.status}
                                </span>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 mb-1">Next Payment Due</p>
                                <p className="font-medium text-slate-900">{school.next_payment_due ? new Date(school.next_payment_due).toLocaleDateString() : 'N/A'}</p>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button
                                onClick={() => onImpersonate(school.id)}
                                className="flex-1 bg-slate-800 text-white py-2 rounded-lg font-bold text-sm hover:bg-slate-900 transition-colors flex items-center justify-center gap-2"
                            >
                                <LogOut className="h-4 w-4" /> Login as Admin
                            </button>
                            <button
                                onClick={() => onRenew(school.id)}
                                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="h-4 w-4" /> Extend 30 Days
                            </button>
                            <button
                                onClick={() => onToggleStatus(school.id, school.status)}
                                className={`flex-1 py-2 rounded-lg font-bold text-sm border transition-colors flex items-center justify-center gap-2 ${school.status === 'active' ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}
                            >
                                {school.status === 'active' ? <Lock className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                                {school.status === 'active' ? 'Suspend' : 'Activate'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface SuperAdminDashboardProps {
    onLogout: () => void;
    onImpersonate?: (schoolId: string) => void;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onLogout, onImpersonate }) => {
    const [pendingSchools, setPendingSchools] = useState<any[]>([]);
    const [activeSchools, setActiveSchools] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'pending' | 'active'>('pending');
    const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
    const [globalStats, setGlobalStats] = useState({ schools: 0, students: 0, revenue: 0 });

    useEffect(() => {
        fetchSchools();
    }, []);

    const fetchSchools = async () => {
        setLoading(true);

        // Fetch Pending
        const { data: pending, error: pendingError } = await supabase
            .from('schools')
            .select('*, profiles(*)')
            .eq('status', 'pending');

        if (pendingError) console.error('Error fetching pending schools:', pendingError);
        else setPendingSchools(pending || []);

        // Fetch Active with counts
        // Note: Supabase doesn't support deep count joins easily in one go without RPC or complex queries.
        // For now, we'll fetch schools and then fetch counts in parallel or use a simplified approach.
        // A better approach for production is a database view or RPC.
        const { data: active, error: activeError } = await supabase
            .from('schools')
            .select('*, profiles(*)')
            .eq('status', 'active');

        if (activeError) {
            console.error('Error fetching active schools:', activeError);
        } else if (active) {
            // Fetch counts for each school (This is N+1 but acceptable for admin dashboard with low N)
            const enriched = await Promise.all(active.map(async (school: any) => {
                const { count: sCount } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', school.id);
                const { count: tCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('school_id', school.id).eq('role', 'teacher');
                return { ...school, student_count: sCount || 0, teacher_count: tCount || 0 };
            }));
            setActiveSchools(enriched);

            // Calculate Global Stats
            const totalStudents = enriched.reduce((sum, s) => sum + (s.student_count || 0), 0);
            setGlobalStats({
                schools: enriched.length,
                students: totalStudents,
                revenue: enriched.length * 200 // Mock revenue calc based on base plan
            });
        }

        setLoading(false);
    };

    const approveSchool = async (schoolId: string) => {
        // Set next_payment_due to 30 days from now upon approval
        const nextDue = new Date();
        nextDue.setDate(nextDue.getDate() + 30);

        const { error } = await supabase
            .from('schools')
            .update({
                status: 'active',
                next_payment_due: nextDue.toISOString(),
                last_payment_date: new Date().toISOString()
            })
            .eq('id', schoolId);

        if (error) {
            alert('Error approving school');
            console.error(error);
        } else {
            alert('School approved successfully!');
            fetchSchools(); // Refresh lists
        }
    };

    const renewSubscription = async (schoolId: string) => {
        if (!confirm('Confirm payment received and renew subscription for 30 days?')) return;

        const nextDue = new Date();
        nextDue.setDate(nextDue.getDate() + 30);

        const { error } = await supabase
            .from('schools')
            .update({
                next_payment_due: nextDue.toISOString(),
                last_payment_date: new Date().toISOString(),
                status: 'active' // Ensure it's active if it was suspended
            })
            .eq('id', schoolId);

        if (error) {
            alert('Error renewing subscription');
            console.error(error);
        } else {
            alert('Subscription renewed successfully!');
            fetchSchools();
            if (selectedSchool) setSelectedSchool(null);
        }
    };

    const toggleSchoolStatus = async (schoolId: string, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
        if (!confirm(`Are you sure you want to ${newStatus === 'suspended' ? 'SUSPEND' : 'ACTIVATE'} this school?`)) return;

        const { error } = await supabase
            .from('schools')
            .update({ status: newStatus })
            .eq('id', schoolId);

        if (error) {
            alert(`Error updating status: ${error.message}`);
        } else {
            alert(`School ${newStatus === 'suspended' ? 'suspended' : 'activated'} successfully.`);
            fetchSchools();
            if (selectedSchool) setSelectedSchool(null);
        }
    };

    const getSubscriptionStatus = (nextPaymentDue?: string) => {
        if (!nextPaymentDue) return { status: 'Unknown', color: 'text-slate-500', bg: 'bg-slate-100' };

        const today = new Date();
        const due = new Date(nextPaymentDue);
        today.setHours(0, 0, 0, 0);
        due.setHours(0, 0, 0, 0);

        const diffTime = today.getTime() - due.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 7) return { status: 'Suspended', color: 'text-red-700', bg: 'bg-red-100', icon: Lock };
        if (diffDays > 0) return { status: `Overdue (${diffDays}d)`, color: 'text-orange-700', bg: 'bg-orange-100', icon: AlertTriangle };
        return { status: 'Active', color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle };
    };

    return (
        <div className="min-h-screen bg-slate-100 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Super Admin Dashboard</h1>
                    <button
                        onClick={onLogout}
                        className="flex items-center gap-2 bg-white text-slate-700 px-4 py-2 rounded-lg shadow hover:bg-slate-50"
                    >
                        <LogOut className="h-4 w-4" /> Logout
                    </button>
                </div>

                {/* Global Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                        <div className="p-4 bg-blue-50 text-blue-600 rounded-xl"><CheckCircle className="h-6 w-6" /></div>
                        <div><p className="text-slate-500 text-sm font-medium">Active Schools</p><h3 className="text-2xl font-bold text-slate-800">{globalStats.schools}</h3></div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                        <div className="p-4 bg-purple-50 text-purple-600 rounded-xl"><Calendar className="h-6 w-6" /></div>
                        <div><p className="text-slate-500 text-sm font-medium">Total Students Managed</p><h3 className="text-2xl font-bold text-slate-800">{globalStats.students}</h3></div>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                        <div className="p-4 bg-green-50 text-green-600 rounded-xl"><RefreshCw className="h-6 w-6" /></div>
                        <div><p className="text-slate-500 text-sm font-medium">Est. Monthly Revenue</p><h3 className="text-2xl font-bold text-slate-800">GH¢ {globalStats.revenue}</h3></div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 mb-6">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${activeTab === 'pending' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                        Pending Approvals ({pendingSchools.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('active')}
                        className={`px-6 py-2 rounded-lg font-medium transition-colors ${activeTab === 'active' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                        Active Schools ({activeSchools.length})
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h2 className="text-xl font-semibold text-slate-800">
                            {activeTab === 'pending' ? 'Pending Approvals' : 'Active Schools Management'}
                        </h2>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Loading...</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-4">School Name</th>
                                        <th className="px-6 py-4">Admin Info</th>
                                        {activeTab === 'active' && <th className="px-6 py-4">Stats</th>}
                                        <th className="px-6 py-4">Date Created</th>
                                        {activeTab === 'active' && <th className="px-6 py-4">Subscription</th>}
                                        {activeTab === 'active' && <th className="px-6 py-4">Next Payment</th>}
                                        <th className="px-6 py-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(activeTab === 'pending' ? pendingSchools : activeSchools).length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                                No {activeTab} schools found.
                                            </td>
                                        </tr>
                                    ) : (
                                        (activeTab === 'pending' ? pendingSchools : activeSchools).map((school) => {
                                            const subStatus = getSubscriptionStatus(school.next_payment_due);
                                            const StatusIcon = subStatus.icon || CheckCircle;
                                            const admin = Array.isArray(school.profiles)
                                                ? (school.profiles.find((p: any) => p.role === 'admin') || school.profiles[0])
                                                : school.profiles;

                                            return (
                                                <tr key={school.id} className="hover:bg-slate-50">
                                                    <td className="px-6 py-4 font-medium text-slate-900">{school.name}</td>
                                                    <td className="px-6 py-4 text-slate-600">
                                                        <div className="text-sm">{admin?.full_name || 'N/A'}</div>
                                                        <div className="text-xs text-slate-400">{admin?.email || 'N/A'}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-500 text-sm">
                                                        {new Date(school.created_at).toLocaleDateString()}
                                                    </td>
                                                    {activeTab === 'active' && (
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col gap-1 text-xs text-slate-500">
                                                                <span><b>{school.student_count}</b> Students</span>
                                                                <span><b>{school.teacher_count}</b> Teachers</span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {activeTab === 'active' && (
                                                        <>
                                                            <td className="px-6 py-4">
                                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${subStatus.bg} ${subStatus.color}`}>
                                                                    <StatusIcon className="h-3 w-3" />
                                                                    {subStatus.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-slate-500 text-sm">
                                                                {school.next_payment_due ? new Date(school.next_payment_due).toLocaleDateString() : 'N/A'}
                                                            </td>
                                                        </>
                                                    )}
                                                    <td className="px-6 py-4">
                                                        {activeTab === 'pending' ? (
                                                            <button
                                                                onClick={() => approveSchool(school.id)}
                                                                className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
                                                            >
                                                                <CheckCircle className="h-4 w-4" /> Approve
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => setSelectedSchool(school)}
                                                                className="flex items-center gap-1 bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                                                            >
                                                                Manage
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {
                selectedSchool && (
                    <SchoolDetailModal
                        school={selectedSchool}
                        onClose={() => setSelectedSchool(null)}
                        onRenew={renewSubscription}
                        onToggleStatus={toggleSchoolStatus}
                        onImpersonate={onImpersonate!}
                    />
                )
            }
        </div >
    );
};

export default SuperAdminDashboard;
