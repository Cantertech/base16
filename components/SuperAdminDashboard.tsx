import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { CheckCircle, XCircle, LogOut } from 'lucide-react';

interface School {
    id: string;
    name: string;
    admin_email: string; // We might need to join with profiles to get this, or store it in schools
    status: string;
    created_at: string;
}

interface SuperAdminDashboardProps {
    onLogout: () => void;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onLogout }) => {
    const [schools, setSchools] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPendingSchools();
    }, []);

    const fetchPendingSchools = async () => {
        setLoading(true);
        // Fetch schools with status 'pending'. 
        // Note: You need to ensure your RLS policies allow this user to see these records.
        const { data, error } = await supabase
            .from('schools')
            .select(`
        *,
        profiles:admin_id (email, full_name)
      `)
            .eq('status', 'pending');

        if (error) {
            console.error('Error fetching schools:', error);
        } else {
            setSchools(data || []);
        }
        setLoading(false);
    };

    const approveSchool = async (schoolId: string) => {
        const { error } = await supabase
            .from('schools')
            .update({ status: 'active' })
            .eq('id', schoolId);

        if (error) {
            alert('Error approving school');
            console.error(error);
        } else {
            // Remove from list
            setSchools(schools.filter(s => s.id !== schoolId));
            alert('School approved successfully!');
        }
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

                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                        <h2 className="text-xl font-semibold text-slate-800">Pending Approvals</h2>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-slate-500">Loading...</div>
                    ) : schools.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">No pending schools found.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-slate-600 uppercase text-xs">
                                    <tr>
                                        <th className="px-6 py-4">School Name</th>
                                        <th className="px-6 py-4">Admin Name</th>
                                        <th className="px-6 py-4">Email</th>
                                        <th className="px-6 py-4">Date Applied</th>
                                        <th className="px-6 py-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {schools.map((school) => (
                                        <tr key={school.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 font-medium text-slate-900">{school.name}</td>
                                            <td className="px-6 py-4 text-slate-600">{school.profiles?.full_name || 'N/A'}</td>
                                            <td className="px-6 py-4 text-slate-600">{school.profiles?.email || 'N/A'}</td>
                                            <td className="px-6 py-4 text-slate-500 text-sm">
                                                {new Date(school.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => approveSchool(school.id)}
                                                    className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
                                                >
                                                    <CheckCircle className="h-4 w-4" /> Approve
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SuperAdminDashboard;
