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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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

// --- Fetch Functions ---
const fetchClasses = async (schoolId: string) => {
  const { data } = await supabase
    .from('classes')
    .select('*')
    .eq('school_id', schoolId)
    .order('name', { ascending: true });
  if (!data) throw new Error('Failed to fetch classes');
  return data;
};

const fetchSubjects = async (schoolId: string) => {
  const { data } = await supabase
    .from('subjects')
    .select('*')
    .eq('school_id', schoolId)
    .order('name');
  if (!data) throw new Error('Failed to fetch subjects');
  return data;
};

const fetchTeachers = async (schoolId: string) => {
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
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return data.map((t: any) => ({
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
  })) as Teacher[];
};

const Teachers: React.FC<TeachersProps> = ({ currentUser }) => {
  const { formatAmount, currency } = useCurrency();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modal & Drawer States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null);

  const schoolId = currentUser?.school_id;

  // --- Queries ---
  const { data: teachers = [], isLoading: isLoadingTeachers } = useQuery({
    queryKey: ['teachers', schoolId],
    queryFn: () => fetchTeachers(schoolId),
    enabled: !!schoolId
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['teacherClasses', schoolId],
    queryFn: () => fetchClasses(schoolId!),
    enabled: !!schoolId
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['teacherSubjects', schoolId],
    queryFn: () => fetchSubjects(schoolId!),
    enabled: !!schoolId
  });

  // --- Mutations ---
  const saveTeacherMutation = useMutation({
    mutationFn: async (teacherData: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user logged in');
      if (!schoolId) throw new Error('No school associated with user');

      const primaryAssignment = teacherData.assignments && teacherData.assignments.length > 0
        ? teacherData.assignments[0]
        : null;

      const derivedAssignedClass = primaryAssignment
        ? (classes.find((c: any) => c.id === primaryAssignment.classId)?.name || teacherData.assignedClass)
        : teacherData.assignedClass;

      const payload = {
        school_id: schoolId,
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
        teacherId = editingTeacher.id;
        const { error } = await supabase.from('teachers').update(payload).eq('id', teacherId);
        if (error) throw error;
        await supabase.from('profiles').update({
          full_name: teacherData.name, email: teacherData.email, phone_number: teacherData.phone
        }).eq('id', teacherId);
      } else {
        // Create New User Logic
        const tempSupabase = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const { data: authData, error: authError } = await tempSupabase.auth.signUp({
          email: teacherData.email, password: 'password123',
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('Failed to create user account');

        teacherId = authData.user.id;
        await supabase.rpc('confirm_user_by_email', { target_email: teacherData.email });

        // Profile Insert
        const { error: profileError } = await supabase.from('profiles').insert([{
          id: teacherId, school_id: schoolId, role: 'teacher', full_name: teacherData.name,
          email: teacherData.email, phone_number: teacherData.phone
        }]);
        if (profileError && profileError.code !== '23505') throw profileError;
        else if (profileError?.code === '23505') {
          await supabase.from('profiles').update({
            school_id: schoolId, role: 'teacher', full_name: teacherData.name, phone_number: teacherData.phone
          }).eq('id', teacherId);
        }

        const { error: teacherError } = await supabase.from('teachers').insert([{ id: teacherId, ...payload, password: 'password123' }]);
        if (teacherError) throw teacherError;
      }

      // Handle Assignments
      if (teacherId && teacherData.assignments) {
        await supabase.from('teacher_assignments').delete().eq('teacher_id', teacherId);
        if (teacherData.assignments.length > 0) {
          const assignmentInserts = teacherData.assignments.map((a: any) => ({
            teacher_id: teacherId,
            school_id: schoolId,
            class_id: a.classId,
            subject_id: a.isClassTeacher ? null : a.subjectId,
            is_class_teacher: a.isClassTeacher
          }));
          const { error: assignError } = await supabase.from('teacher_assignments').insert(assignmentInserts);
          if (assignError) throw new Error("Error saving assignments: " + assignError.message);
        }
      }
      return { isNew: !editingTeacher };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['teachers', schoolId] });
      setIsModalOpen(false);
      setEditingTeacher(null);
      if (data.isNew) alert('Teacher created! Password: password123');
    },
    onError: (error: any) => {
      console.error("Error saving teacher", error);
      alert(`Failed to save teacher: ${error.message}`);
    }
  });

  const deleteTeacherMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_teacher_user', { teacher_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers', schoolId] });
    },
    onError: (error: any) => {
      alert(`Failed to delete teacher: ${error.message}`);
    }
  });

  // --- Handlers ---
  const handleSaveTeacher = (data: any) => saveTeacherMutation.mutate(data);
  const handleDeleteTeacher = (id: string) => {
    if (window.confirm('Are you sure you want to remove this teacher? This will delete their login access too.')) {
      deleteTeacherMutation.mutate(id);
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

      {/* Main Table Card (Desktop) & Mobile Cards */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1">

        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {isLoadingTeachers ? (
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
              {isLoadingTeachers ? (
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
          isLoading={saveTeacherMutation.isPending}
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
              {isLoading ? 'Saving...' : 'Save Teacher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Sub-component: Teacher Profile Drawer ---
const TeacherProfileDrawer = ({ teacher, onClose, onEdit }: any) => {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-xl font-bold text-slate-800">Teacher Profile</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
            <X className="h-6 w-6 text-slate-400" />
          </button>
        </div>

        {/* Profile Card */}
        <div className="flex flex-col items-center mb-8">
          <div className="h-28 w-28 rounded-full bg-slate-100 border-4 border-white shadow-lg overflow-hidden mb-4">
            <img
              src={`https://ui-avatars.com/api/?name=${teacher.name}&background=random`}
              alt={teacher.name}
              className="w-full h-full object-cover"
            />
          </div>
          <h3 className="text-xl font-bold text-slate-800 text-center">{teacher.name}</h3>
          <p className="text-slate-500 text-sm">{teacher.subject}</p>
          <span className={`mt-2 px-3 py-1 rounded-full text-xs font-bold ${teacher.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
            {teacher.status}
          </span>
        </div>

        {/* Details Grid */}
        <div className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm">
              <User className="h-4 w-4" /> Account Details
            </h4>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Email</span>
                <span className="font-medium text-slate-900">{teacher.email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Phone</span>
                <span className="font-medium text-slate-900">{teacher.phone}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Salary</span>
                <span className="font-medium text-slate-900">GH₵{teacher.salary ? teacher.salary.toLocaleString() : '0.00'}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4" /> Assignments
            </h4>
            <div className="space-y-2">
              {teacher.assignments && teacher.assignments.length > 0 ? teacher.assignments.map((a: any, i: number) => (
                <div key={i} className="text-sm bg-white p-2 rounded border border-slate-200 flex justify-between">
                  <span className="font-medium">{a.classes?.name || 'Unknown Class'}</span>
                  <span className="text-slate-500">{a.subjects?.name || (a.is_class_teacher ? 'Class Teacher' : 'All Subjects')}</span>
                </div>
              )) : (
                <span className="text-xs text-slate-400 italic">No specific assignments found.</span>
              )}
              {(!teacher.assignments || teacher.assignments.length === 0) && teacher.assignedClass && (
                <div className="text-sm bg-white p-2 rounded border border-slate-200 flex justify-between">
                  <span className="font-medium">{teacher.assignedClass}</span>
                  <span className="text-slate-500">Legacy Assignment</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onEdit}
              className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-primary-700 transition-colors shadow-sm"
            >
              Edit Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Teachers;
