import React, { useState, useEffect } from 'react';
import {
  Search, Plus, Eye, Edit, Trash2, X,
  User, Phone, Mail, BookOpen, Key, Shield, DollarSign,
  ChevronLeft, ChevronRight
} from 'lucide-react';

import { supabase } from '../utils/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import Loading from './Loading';
import { useCurrency } from '../contexts/CurrencyContext';
import { getCachedData, setCachedData, clearCache } from '../utils/cache';

const CACHE_KEY_TEACHERS = 'orbit_teachers_data';
const CACHE_KEY_CLASSES = 'orbit_classes_data';
const CACHE_KEY_SUBJECTS = 'orbit_subjects_data';

// --- Types ---
interface Teacher {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  assignedClass?: string | null;
  status: 'Active' | 'On Leave';
  role: 'teacher';
  password?: string;
  salary: number;
  assignments?: any[];
}

// --- Main Component ---
interface TeachersProps {
  currentUser: {
    id: string;
    school_id: string;
    role: 'admin' | 'teacher';
    name: string;
  };
}

const Teachers: React.FC<TeachersProps> = ({ currentUser }) => {
  const { formatAmount, currency } = useCurrency();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modal & Drawer States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  // Load Data
  useEffect(() => {
    if (currentUser?.school_id) {
      loadAll(currentUser.school_id);
    }
  }, [currentUser]);

  const loadAll = async (sId: string) => {
    const keyTeachers = `${CACHE_KEY_TEACHERS}_${sId}`;
    const keyClasses = `${CACHE_KEY_CLASSES}_${sId}`;
    const keySubjects = `${CACHE_KEY_SUBJECTS}_${sId}`;

    const cachedTeachers = getCachedData<Teacher[]>(keyTeachers);
    const cachedClasses = getCachedData<any[]>(keyClasses);
    const cachedSubjects = getCachedData<any[]>(keySubjects);

    if (cachedTeachers && cachedClasses && cachedSubjects) {
      setTeachers(cachedTeachers);
      setClasses(cachedClasses);
      setSubjects(cachedSubjects);
      setLoading(false);
      // Background update
      fetchTeachers(sId, true);
      fetchClasses(sId, true);
      fetchSubjects(sId, true);
    } else {
      await Promise.all([fetchTeachers(sId), fetchClasses(sId), fetchSubjects(sId)]);
      setLoading(false);
    }
  };

  const fetchClasses = async (sId: string, background = false) => {
    try {
      const { data } = await supabase
        .from('classes')
        .select('*')
        .eq('school_id', sId)
        .order('name', { ascending: true });
      if (data) {
        setClasses(data);
        setCachedData(`${CACHE_KEY_CLASSES}_${sId}`, data);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const fetchSubjects = async (sId: string, background = false) => {
    try {
      const { data } = await supabase
        .from('subjects')
        .select('*')
        .eq('school_id', sId)
        .order('name');
      if (data) {
        setSubjects(data);
        setCachedData(`${CACHE_KEY_SUBJECTS}_${sId}`, data);
      }
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  };

  const fetchTeachers = async (sId: string, background = false) => {
    try {
      // Fetch teachers with their assignments
      const { data, error } = await supabase
        .from('teachers')
        .select(`
            *,
            teacher_assignments (
                class_id,
                subject_id,
                is_class_teacher,
                classes (name),
                subjects (name)
            )
        `)
        .eq('school_id', sId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const mappedTeachers = data.map((t: any) => ({
          id: t.id,
          name: t.name,
          email: t.email,
          phone: t.phone,
          subject: t.subject,
          assignedClass: t.assigned_class,
          status: t.status,
          role: 'teacher',
          password: t.password,
          salary: t.salary || 0,
          assignments: t.teacher_assignments || []
        }));
        setTeachers(mappedTeachers);
        setCachedData(`${CACHE_KEY_TEACHERS}_${sId}`, mappedTeachers);
      }
      setEditingTeacher(null);
    } catch (error: any) {
      console.error('Error fetching teachers:', error);
      // alert(`Failed to fetch teachers: ${error.message}`); // Suppress for now during dev
    }
  };

  const handleSaveTeacher = async (teacherData: any) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user logged in');

      let targetSchoolId = currentUser?.school_id;

      if (!targetSchoolId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('school_id')
          .eq('id', user.id)
          .single();
        targetSchoolId = profile?.school_id;
      }

      if (!targetSchoolId) throw new Error('No school associated with user');

      // Determine Primary Assigned Class (first one or manual override if we kept the field)
      // For now, let's just take the first class from assignments if available, or stay with the old field if passed
      // Ideally, the "assigned_class" column becomes a "Primary Class" for display purposes.
      const primaryAssignment = teacherData.assignments && teacherData.assignments.length > 0
        ? teacherData.assignments[0]
        : null;

      const derivedAssignedClass = primaryAssignment
        ? (classes.find(c => c.id === primaryAssignment.classId)?.name || teacherData.assignedClass)
        : teacherData.assignedClass;

      const payload = {
        school_id: targetSchoolId,
        name: teacherData.name,
        email: teacherData.email,
        phone: teacherData.phone,
        subject: teacherData.subject,
        assigned_class: derivedAssignedClass || null,
        status: 'Active',
        salary: Number(teacherData.salary) || 0
      };

      let teacherId = editingTeacher?.id;

      if (editingTeacher) {
        // Update (Existing User)
        teacherId = editingTeacher.id;
        const { error } = await supabase
          .from('teachers')
          .update(payload)
          .eq('id', teacherId);

        if (error) throw error;

        await supabase.from('profiles').update({
          full_name: teacherData.name,
          email: teacherData.email,
          phone_number: teacherData.phone
        }).eq('id', teacherId);

      } else {
        // Insert (New User)
        const tempSupabase = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const { data: authData, error: authError } = await tempSupabase.auth.signUp({
          email: teacherData.email,
          password: 'password123',
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('Failed to create user account');

        teacherId = authData.user.id;

        await supabase.rpc('confirm_user_by_email', { target_email: teacherData.email });

        const { error: profileError } = await supabase.from('profiles').insert([{
          id: teacherId,
          school_id: targetSchoolId,
          role: 'teacher',
          full_name: teacherData.name,
          email: teacherData.email,
          phone_number: teacherData.phone
        }]);

        if (profileError && profileError.code !== '23505') throw profileError;
        else if (profileError?.code === '23505') {
          await supabase.from('profiles').update({
            school_id: targetSchoolId,
            role: 'teacher',
            full_name: teacherData.name,
            phone_number: teacherData.phone
          }).eq('id', teacherId);
        }

        const { error: teacherError } = await supabase.from('teachers').insert([{
          id: teacherId,
          ...payload,
          password: 'password123'
        }]);
        if (teacherError) throw teacherError;

        alert('Teacher created! Password: password123');
      }

      // --- Handle Assignments (For both Create and Update) ---
      if (teacherId && teacherData.assignments) {
        // 1. Delete existing
        await supabase.from('teacher_assignments').delete().eq('teacher_id', teacherId);

        // 2. Insert new
        if (teacherData.assignments.length > 0) {
          const assignmentInserts = teacherData.assignments.map((a: any) => ({
            teacher_id: teacherId,
            school_id: targetSchoolId,
            class_id: a.classId,
            subject_id: a.isClassTeacher ? null : a.subjectId,
            is_class_teacher: a.isClassTeacher
          }));

          const { error: assignError } = await supabase.from('teacher_assignments').insert(assignmentInserts);
          if (assignError) {
            console.error("Assignment Error:", assignError);
            alert("Teacher saved, but there was an error saving assignments: " + assignError.message);
          }
        }
      }

      if (currentUser.school_id) fetchTeachers(currentUser.school_id);
      if (currentUser.school_id) clearCache(`${CACHE_KEY_TEACHERS}_${currentUser.school_id}`);
      setIsModalOpen(false);
      setEditingTeacher(null);
    } catch (error: any) {
      console.error('Error saving teacher:', error);
      alert(`Failed to save teacher: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTeacher = async (id: string) => {
    if (window.confirm('Are you sure you want to remove this teacher? This will delete their login access too.')) {
      try {
        // Use RPC to delete Auth User + Data
        const { error } = await supabase.rpc('delete_teacher_user', { teacher_id: id });

        if (error) throw error;

        if (currentUser.school_id) fetchTeachers(currentUser.school_id);
        if (currentUser.school_id) clearCache(`${CACHE_KEY_TEACHERS}_${currentUser.school_id}`);
      } catch (error: any) {
        console.error('Error deleting teacher:', error);
        alert(`Failed to delete teacher: ${error.message}`);
      }
    }
  };

  const openAddModal = () => {
    setEditingTeacher(null);
    setIsModalOpen(true);
  };

  const openEditModal = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setIsModalOpen(true);
  };

  // --- Filtering ---
  const filteredTeachers = teachers.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.ceil(filteredTeachers.length / itemsPerPage);
  const paginatedTeachers = filteredTeachers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6 relative h-full overflow-y-auto pb-20 md:pb-0">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">Teacher Management</h1>
          <p className="text-slate-500 text-xs md:text-sm">Manage staff profiles, class assignments, and access credentials.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search teachers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none w-full sm:w-64 text-sm"
            />
          </div>

          {/* Actions */}
          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-800 font-medium text-sm shadow-sm transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4" /> Add Teacher
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      {/* Main Table Card (Desktop) & Mobile Cards */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1">

        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="p-8"><Loading type="skeleton" fullScreen={false} /></div>
          ) : paginatedTeachers.length > 0 ? (
            paginatedTeachers.map((teacher) => (
              <div key={teacher.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                      <img
                        src={`https://ui-avatars.com/api/?name=${teacher.name}&background=random`}
                        alt={teacher.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <div
                        className="font-medium text-slate-900 line-clamp-1"
                        onClick={() => setSelectedTeacher(teacher)}
                      >
                        {teacher.name}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${teacher.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                          {teacher.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={() => setSelectedTeacher(teacher)}
                      className="text-slate-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(teacher)}
                      className="text-slate-400 hover:text-orange-600 p-2 rounded-full hover:bg-orange-50"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTeacher(teacher.id)}
                      className="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  {teacher.assignedClass ? (
                    <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-medium border border-blue-100">
                      Class: {teacher.assignedClass}
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded bg-slate-50 text-slate-500 font-medium border border-slate-100">No Class</span>
                  )}
                  <span className="px-2 py-1 rounded bg-purple-50 text-purple-700 font-medium border border-purple-100 flex items-center gap-1">
                    <BookOpen className="h-3 w-3" /> {teacher.subject}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-50">
                  <a href={`tel:${teacher.phone}`} className="flex items-center gap-1 hover:text-blue-600 p-1">
                    <Phone className="h-3 w-3" /> {teacher.phone}
                  </a>
                  <a href={`mailto:${teacher.email}`} className="flex items-center gap-1 hover:text-blue-600 p-1">
                    <Mail className="h-3 w-3" /> Email
                  </a>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-500 text-sm">
              No teachers found. Click "Add Teacher" above.
            </div>
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Teacher</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Class</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject Specialization</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <Loading type="skeleton" fullScreen={false} />
                  </td>
                </tr>
              ) : paginatedTeachers.length > 0 ? (
                paginatedTeachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm mr-3 border border-slate-200 overflow-hidden">
                          <img
                            src={`https://ui-avatars.com/api/?name=${teacher.name}&background=random`}
                            alt={teacher.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div>
                          <div
                            className="font-medium text-slate-900 cursor-pointer hover:text-primary-600"
                            onClick={() => setSelectedTeacher(teacher)}
                          >
                            {teacher.name}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {teacher.phone}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {teacher.assignedClass ? (
                        <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 font-medium text-xs border border-blue-100">
                          {teacher.assignedClass}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Subject Teacher Only</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="bg-slate-100 p-1.5 rounded-full">
                          <BookOpen className="h-3 w-3 text-slate-500" />
                        </div>
                        <span className="text-sm text-slate-700">{teacher.subject}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${teacher.status === 'Active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-orange-100 text-orange-800'
                        }`}>
                        {teacher.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setSelectedTeacher(teacher)}
                        className="text-slate-400 hover:text-blue-600 mx-1 p-1 rounded-full hover:bg-blue-50 transition-colors"
                        title="View Profile"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(teacher)}
                        className="text-slate-400 hover:text-orange-600 mx-1 p-1 rounded-full hover:bg-orange-50 transition-colors"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTeacher(teacher.id)}
                        className="text-slate-400 hover:text-red-600 mx-1 p-1 rounded-full hover:bg-red-50 transition-colors" title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No teachers found. Click "Add Teacher" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="bg-white px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <span className="text-sm text-slate-500 order-2 sm:order-1">
            Showing page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages || 1}</span>
          </span>
          <div className="flex gap-2 order-1 sm:order-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-slate-200 rounded-md text-sm disabled:opacity-50 hover:bg-slate-50"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1 border border-slate-200 rounded-md text-sm disabled:opacity-50 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}
      {isModalOpen && (
        <TeacherModal
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSaveTeacher}
          availableClasses={classes}
          availableSubjects={subjects}
          initialData={editingTeacher}
          isLoading={isSubmitting}
        />
      )}

      {/* --- SLIDE-OVER PROFILE --- */}
      {selectedTeacher && (
        <TeacherProfileDrawer
          teacher={selectedTeacher}
          onClose={() => setSelectedTeacher(null)}
          onEdit={() => {
            setSelectedTeacher(null);
            openEditModal(selectedTeacher);
          }}
        />
      )}
    </div>
  );
};

// --- Sub-component: Add/Edit Teacher Modal ---
const TeacherModal = ({ onClose, onSubmit, availableClasses = [], availableSubjects = [], initialData = null, isLoading = false }: any) => {
  const { currency } = useCurrency();
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', subject: '', salary: 0,
    assignments: [] as any[]
  });

  useEffect(() => {
    if (initialData) {
      // Map existing assignments from DB format to UI format
      const existingAssignments = initialData.assignments?.map((a: any) => ({
        id: Math.random().toString(36).substr(2, 9), // Temp ID for UI key
        classId: a.class_id,
        subjectId: a.subject_id,
        isClassTeacher: a.is_class_teacher
      })) || [];

      // If no assignments legacy check (backward compatibility)
      if (existingAssignments.length === 0 && initialData.assignedClass) {
        const classObj = availableClasses.find((c: any) => c.name === initialData.assignedClass);
        if (classObj) {
          existingAssignments.push({
            id: 'legacy',
            classId: classObj.id,
            subjectId: null,
            isClassTeacher: true // Assume legacy single assignment was class teacher
          });
        }
      }

      setFormData({
        name: initialData.name,
        email: initialData.email,
        phone: initialData.phone,
        subject: initialData.subject, // Keep for display/legacy
        salary: initialData.salary || 0,
        assignments: existingAssignments
      });
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const addAssignment = () => {
    setFormData(prev => ({
      ...prev,
      assignments: [...prev.assignments, { id: Math.random().toString(), classId: '', subjectId: '', isClassTeacher: false }]
    }));
  };

  const removeAssignment = (id: string) => {
    setFormData(prev => ({
      ...prev,
      assignments: prev.assignments.filter(a => a.id !== id)
    }));
  };

  const updateAssignment = (id: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      assignments: prev.assignments.map(a => a.id === id ? { ...a, [field]: value } : a)
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <h3 className="font-bold text-lg text-slate-800">{initialData ? 'Edit Teacher' : 'Add New Teacher'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Personal Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input required type="text" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Mr. John Doe" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
              <input required type="tel" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="024..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input required type="email" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="john@school.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Salary ({currency.code})</label>
              <input type="number" min="0" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                value={formData.salary} onChange={e => setFormData({ ...formData, salary: Number(e.target.value) })} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Display Subjects (Text)</label>
              <input type="text" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} placeholder="e.g. Math, Science" />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-bold text-slate-800">Class & Subject Assignments</h4>
              <button type="button" onClick={addAssignment} className="text-sm text-primary-600 font-medium hover:bg-primary-50 px-3 py-1 rounded-lg flex items-center gap-1">
                <Plus className="h-4 w-4" /> Add Assignment
              </button>
            </div>

            <div className="space-y-3">
              {formData.assignments.map((assignment, index) => (
                <div key={assignment.id} className="flex flex-col sm:flex-row gap-3 items-start bg-slate-50 p-3 rounded-lg border border-slate-200 relative group">
                  <div className="w-full sm:flex-1">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Class</label>
                    <select
                      required
                      className="w-full p-2 text-sm border rounded-md outline-none focus:ring-1 focus:ring-primary-500"
                      value={assignment.classId}
                      onChange={e => updateAssignment(assignment.id, 'classId', e.target.value)}
                    >
                      <option value="">Select Class</option>
                      {availableClasses.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="w-full sm:flex-1">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
                    <select
                      disabled={assignment.isClassTeacher}
                      className={`w-full p-2 text-sm border rounded-md outline-none focus:ring-1 focus:ring-primary-500 ${assignment.isClassTeacher ? 'bg-slate-100 text-slate-400' : 'bg-white'}`}
                      value={assignment.subjectId || ''}
                      onChange={e => updateAssignment(assignment.id, 'subjectId', e.target.value)}
                    >
                      <option value="">{assignment.isClassTeacher ? '(All Subjects)' : 'Select Subject'}</option>
                      {availableSubjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-col justify-center pt-2 sm:pt-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={assignment.isClassTeacher}
                        onChange={e => updateAssignment(assignment.id, 'isClassTeacher', e.target.checked)}
                        className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                      />
                      <span className="text-xs font-medium text-slate-700">Class Teacher</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeAssignment(assignment.id)}
                    className="self-end sm:self-center mt-2 sm:mt-4 p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {formData.assignments.length === 0 && (
                <p className="text-center text-sm text-slate-500 py-4 italic bg-slate-50 rounded-lg border border-dashed border-slate-300">
                  No assignments yet. Click "Add Assignment" to start.
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 shrink-0">
            <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 flex items-center gap-2">
              {isLoading && <Loading type="spinner" fullScreen={false} message="" />}
              {initialData ? 'Update Teacher' : 'Save Teacher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// --- Sub-component: Teacher Profile Drawer ---
const TeacherProfileDrawer = ({ teacher, onClose, onEdit }: { teacher: Teacher; onClose: () => void; onEdit: () => void }) => {
  const { formatAmount } = useCurrency();

  const handleResetPassword = () => {
    alert(`Password for ${teacher.name} has been reset to: password123`);
  };

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose}></div>

      {/* Drawer */}
      <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="h-40 bg-gradient-to-r from-primary-900 to-primary-800 relative">
          <button onClick={onClose} className="absolute top-4 left-4 text-white/70 hover:text-white bg-black/20 p-1.5 rounded-full backdrop-blur-md">
            <X className="h-5 w-5" />
          </button>
          <div className="absolute -bottom-12 left-8 flex items-end">
            <div className="h-24 w-24 rounded-full bg-white p-1 shadow-lg">
              <div className="h-full w-full rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                <img
                  src={`https://ui-avatars.com/api/?name=${teacher.name}&background=random`}
                  alt={teacher.name}
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
            <div className="mb-14 ml-4">
              <h2 className="text-white font-bold text-xl">{teacher.name}</h2>
              <p className="text-blue-200 text-sm">Staff ID: {teacher.id.substring(0, 8)}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mt-16 px-8 flex-1 overflow-y-auto space-y-8 pb-10">

          {/* Status Section */}
          <div className="flex justify-between items-center border-b border-slate-100 pb-6">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${teacher.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
              }`}>
              {teacher.status}
            </span>
            <button onClick={onEdit} className="text-sm text-primary-600 font-medium hover:underline">Edit Details</button>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Contact Information</h4>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="bg-slate-50 p-2.5 rounded-lg text-slate-500">
                  <Phone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{teacher.phone}</p>
                  <p className="text-xs text-slate-500">Mobile</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="bg-slate-50 p-2.5 rounded-lg text-slate-500">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">{teacher.email}</p>
                  <p className="text-xs text-slate-500">Email Address</p>
                </div>
              </div>
            </div>
          </div>

          {/* Workload & Salary */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Employment Details</h4>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Assigned Class</span>
                {teacher.assignedClass ? (
                  <span className="font-bold text-slate-900">{teacher.assignedClass}</span>
                ) : (
                  <span className="text-xs text-slate-400 italic">None</span>
                )}
              </div>
              <div className="flex justify-between items-start">
                <span className="text-sm text-slate-600">Subjects</span>
                <div className="flex flex-wrap justify-end gap-2 max-w-[60%]">
                  {teacher.subject.split(',').map((subj, i) => (
                    <span key={i} className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700">
                      {subj.trim()}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-sm text-slate-600">Monthly Salary</span>
                <span className="font-bold text-green-700 flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> {formatAmount(teacher.salary)}
                </span>
              </div>
            </div>
          </div>

          {/* System Credentials (Admin Only) */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-primary-600" />
              <h4 className="text-xs font-bold text-primary-600 uppercase tracking-wider">System Access (Admin Only)</h4>
            </div>

            <div className="bg-slate-900 rounded-xl p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10">
                <Key className="h-24 w-24 transform rotate-45" />
              </div>

              <div className="relative z-10 space-y-4">
                <div>
                  <p className="text-slate-400 text-xs uppercase tracking-wide">Username</p>
                  <p className="text-lg font-mono font-bold mt-1">{teacher.email}</p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleResetPassword}
                    className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Key className="h-4 w-4" /> Reset Password
                  </button>
                  <p className="text-center text-slate-500 text-xs mt-2">Resets to default: password123</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Teachers;
