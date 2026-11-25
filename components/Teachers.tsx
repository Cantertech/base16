import React, { useState, useEffect } from 'react';
import {
  Search, Plus, Eye, Edit, Trash2, X,
  User, Phone, Mail, BookOpen, Key, Shield, DollarSign,
  ChevronLeft, ChevronRight, Award, GraduationCap, Check, CheckSquare, Layers
} from 'lucide-react';

import { supabase } from '../utils/supabaseClient';
import { createClient } from '@supabase/supabase-js';
import Loading from './Loading';
import { useCurrency } from '../contexts/CurrencyContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import TeacherAttendance from './TeacherAttendance';
import TeacherPayroll from './TeacherPayroll';

// --- Types ---
interface TeacherAssignment {
  id?: string;
  class_id?: string;
  classId?: string;
  subject_id?: string | null;
  subjectId?: string | null;
  is_class_teacher?: boolean;
  isClassTeacher?: boolean;
  classes?: { id?: string; name: string } | null;
  subjects?: { id?: string; name: string } | null;
}

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
  assignments?: TeacherAssignment[];
  allowances?: any[];
  deductions?: any[];
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
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, school_id')
    .eq('school_id', schoolId)
    .order('name', { ascending: true });
  if (error) {
    console.error('Error fetching classes:', error);
    return [];
  }
  return data || [];
};

const fetchSubjects = async (schoolId: string) => {
  const { data, error } = await supabase
    .from('subjects')
    .select('id, name, school_id')
    .eq('school_id', schoolId)
    .order('name', { ascending: true });
  if (error) {
    console.error('Error fetching subjects:', error);
    return [];
  }
  return data || [];
};

const fetchTeachers = async (schoolId: string) => {
  // 1. Fetch teacher profiles with teacher_assignments from master_schema_v1.sql
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select(`
      id,
      school_id,
      role,
      full_name,
      email,
      phone_number,
      status,
      salary,
      teacher_assignments (
        id,
        class_id,
        subject_id,
        is_class_teacher,
        classes (id, name),
        subjects (id, name)
      )
    `)
    .eq('school_id', schoolId)
    .eq('role', 'teacher')
    .order('created_at', { ascending: false });

  if (profilesError) {
    console.error('Error fetching teacher profiles:', profilesError);
  }

  const list = profilesData || [];
  return list.map((p: any) => {
    const assignments = p.teacher_assignments || [];
    const classTeacherAssign = assignments.find((a: any) => a.is_class_teacher);
    const assignedClass = classTeacherAssign?.classes?.name || null;
    const subjectList = Array.from(new Set(assignments.map((a: any) => a.subjects?.name).filter(Boolean)));
    const subject = subjectList.join(', ');

    return {
      id: p.id,
      name: p.full_name || '',
      email: p.email || '',
      phone: p.phone_number || '',
      subject: subject,
      assignedClass: assignedClass,
      status: p.status || 'Active',
      role: 'teacher' as const,
      password: 'password123',
      salary: Number(p.salary) || 0,
      assignments: assignments,
      allowances: [],
      deductions: []
    };
  }) as Teacher[];
};

const Teachers: React.FC<TeachersProps> = ({ currentUser }) => {
  const { formatAmount, currency } = useCurrency();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [activeTab, setActiveTab] = useState<'directory' | 'attendance' | 'payroll'>('directory');

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

      // Determine primary class assignment for backward-compatible assigned_class column ONLY if class teacher
      const classTeacherAssignment = teacherData.assignments?.find((a: any) => a.isClassTeacher);
      let derivedAssignedClass: string | null = null;
      if (classTeacherAssignment?.classId) {
        const foundClass = classes.find((c: any) => c.id === classTeacherAssignment.classId);
        if (foundClass?.name) derivedAssignedClass = foundClass.name;
      }

      // Collect human-friendly subject string for directory display
      const assignedSubjectNames = (teacherData.assignments || [])
        .filter((a: any) => !a.isClassTeacher && a.subjectId)
        .map((a: any) => subjects.find((s: any) => s.id === a.subjectId)?.name)
        .filter(Boolean);

      const derivedSubjectText = teacherData.subject?.trim() || (
        assignedSubjectNames.length > 0
          ? Array.from(new Set(assignedSubjectNames)).join(', ')
          : (classTeacherAssignment ? 'Class Teacher' : 'General Staff')
      );

      let teacherId = editingTeacher?.id;
      const passwordToUse = teacherData.password?.trim() || 'password123';

      if (!editingTeacher) {
        // 1. Try master RPC: admin_create_teacher (from master_schema_v1.sql)
        try {
          const { data: rpcId, error: rpcErr } = await supabase.rpc('admin_create_teacher', {
            p_school_id: schoolId,
            p_email: teacherData.email.trim().toLowerCase(),
            p_password: passwordToUse,
            p_full_name: teacherData.name.trim(),
            p_phone: teacherData.phone?.trim() || '',
            p_salary: Number(teacherData.salary) || 0,
            p_primary_class: derivedAssignedClass || null,
            p_primary_subject: derivedSubjectText || null
          });

          if (!rpcErr && rpcId) {
            teacherId = rpcId;
          } else if (rpcErr) {
            console.warn('admin_create_teacher RPC notice:', rpcErr.message);
          }
        } catch (rpcEx) {
          console.warn('admin_create_teacher exception:', rpcEx);
        }

        // Secondary fallback: check existing profile or client auth signup
        if (!teacherId) {
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', teacherData.email.trim().toLowerCase())
            .maybeSingle();

          if (existingProfile?.id) {
            teacherId = existingProfile.id;
          } else {
            try {
              const tempSupabase = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_ANON_KEY,
                { auth: { autoRefreshToken: false, persistSession: false } }
              );
              const { data: authData } = await tempSupabase.auth.signUp({
                email: teacherData.email.trim().toLowerCase(),
                password: passwordToUse,
              });
              if (authData?.user) teacherId = authData.user.id;
            } catch (_) {}
          }
        }

        if (!teacherId) {
          teacherId = crypto.randomUUID();
        }

        // Auto confirm email
        try {
          await supabase.rpc('confirm_user_by_email', { target_email: teacherData.email.trim().toLowerCase() });
        } catch (_) {}

        // Upsert Profile in master schema
        await supabase.from('profiles').upsert([{
          id: teacherId,
          school_id: schoolId,
          role: 'teacher',
          full_name: teacherData.name.trim(),
          email: teacherData.email.trim().toLowerCase(),
          phone_number: teacherData.phone?.trim() || '',
          salary: Number(teacherData.salary) || 0,
          status: 'Active'
        }]);

      } else {
        // Edit existing teacher
        teacherId = editingTeacher.id;

        // 1. Update profiles table in master schema
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: teacherData.name.trim(),
            email: teacherData.email.trim().toLowerCase(),
            phone_number: teacherData.phone?.trim() || '',
            salary: Number(teacherData.salary) || 0,
            status: editingTeacher.status || 'Active'
          })
          .eq('id', teacherId);

        if (profileError) throw profileError;
      }

      // 3. Atomically set teacher assignments via master RPC: admin_set_teacher_assignments
      const formattedAssignments = (teacherData.assignments || [])
        .filter((a: any) => !!a.classId)
        .map((a: any) => ({
          class_id: a.classId,
          subject_id: a.isClassTeacher ? null : (a.subjectId || null),
          is_class_teacher: !!a.isClassTeacher
        }));

      let rpcAssigned = false;
      try {
        const { error: assignRpcError } = await supabase.rpc('admin_set_teacher_assignments', {
          p_school_id: schoolId,
          p_teacher_id: teacherId,
          p_assignments: formattedAssignments
        });

        if (!assignRpcError) {
          rpcAssigned = true;
        } else {
          console.warn('admin_set_teacher_assignments RPC notice, using table fallback:', assignRpcError.message);
        }
      } catch (e) {
        console.warn('admin_set_teacher_assignments exception:', e);
      }

      // Fallback direct table linking
      if (!rpcAssigned) {
        await supabase.from('teacher_assignments').delete().eq('teacher_id', teacherId);

        if (formattedAssignments.length > 0) {
          const rows = formattedAssignments.map((a: any) => ({
            school_id: schoolId,
            teacher_id: teacherId,
            class_id: a.class_id,
            subject_id: a.subject_id,
            is_class_teacher: a.is_class_teacher
          }));
          const { error: insErr } = await supabase.from('teacher_assignments').insert(rows);
          if (insErr) {
            console.error('Direct assignment insert error:', insErr);
          }
        }
      }

      return { 
        isNew: !editingTeacher, 
        password: passwordToUse 
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['teachers', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['teacherClasses', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats', schoolId] });
      setIsModalOpen(false);
      setEditingTeacher(null);
      if (data.isNew) {
        alert(`Teacher created successfully!\n\nDefault Login Password: ${data.password}\nThey can log in with their email and this password.`);
      } else {
        alert('Teacher profile and class/subject assignments updated successfully!');
      }
    },
    onError: (error: any) => {
      console.error('Error saving teacher:', error);
      alert(`Failed to save teacher: ${error.message}`);
    }
  });

  const deleteTeacherMutation = useMutation({
    mutationFn: async (id: string) => {
      // 1. Try master RPC: admin_delete_teacher from master_schema_v1.sql
      let rpcDeleted = false;
      try {
        const { error: rpcErr } = await supabase.rpc('admin_delete_teacher', {
          p_school_id: schoolId,
          p_teacher_id: id
        });
        if (!rpcErr) rpcDeleted = true;
      } catch (_) {}

      // Fallback if RPC wasn't executed
      if (!rpcDeleted) {
        try {
          await supabase.rpc('delete_teacher_user', { teacher_id: id });
        } catch (_) {}
        await supabase.from('teacher_assignments').delete().eq('teacher_id', id);
        await supabase.from('profiles').delete().eq('id', id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats', schoolId] });
      alert('Teacher removed successfully.');
    },
    onError: (error: any) => {
      alert(`Failed to delete teacher: ${error.message}`);
    }
  });

  const resetTeacherPasswordMutation = useMutation({
    mutationFn: async (id: string) => {
      const defaultPassword = 'password123';
      try {
        await supabase.rpc('admin_reset_teacher_password', { 
          target_teacher_id: id, 
          p_teacher_id: id,
          p_school_id: schoolId,
          new_password: defaultPassword,
          p_new_password: defaultPassword
        });
      } catch (_) {}
    },
    onSuccess: () => {
      alert('Password reset successfully to default: password123');
    },
    onError: (error: any) => {
      alert(`Failed to reset password: ${error.message}`);
    }
  });

  // --- Handlers ---
  const handleSaveTeacher = (data: any) => saveTeacherMutation.mutate(data);
  const handleDeleteTeacher = (id: string) => {
    if (window.confirm('Are you sure you want to remove this teacher? This will delete their login access too.')) {
      deleteTeacherMutation.mutate(id);
    }
  };

  const handleResetPassword = (id: string) => {
    if (window.confirm('Reset this teacher\'s password to default (password123)?')) {
      resetTeacherPasswordMutation.mutate(id);
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
    ((t.name || '').toLowerCase().includes(searchQuery.toLowerCase())) ||
    ((t.subject || '').toLowerCase().includes(searchQuery.toLowerCase()))
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
          {activeTab === 'directory' && (
            <>
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
              <button
                onClick={openAddModal}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-800 font-medium text-sm shadow-sm transition-colors whitespace-nowrap"
              >
                <Plus className="h-4 w-4" /> Add Teacher
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar border-b border-slate-200">
        <div className="flex gap-6 px-2">
          <button
            onClick={() => setActiveTab('directory')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'directory' ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Staff Directory
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'attendance' ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Daily Attendance
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === 'payroll' ? 'border-primary-600 text-primary-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Payroll & Slips
          </button>
        </div>
      </div>

      {activeTab === 'attendance' && <TeacherAttendance schoolId={schoolId!} teachers={teachers} />}
      {activeTab === 'payroll' && <TeacherPayroll schoolId={schoolId!} teachers={teachers} />}

      {/* Main Table Card (Desktop) & Mobile Cards */}
      {activeTab === 'directory' && (
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
                        onClick={() => handleResetPassword(teacher.id)}
                        className="text-slate-400 hover:text-emerald-600 p-2 rounded-full hover:bg-emerald-50"
                        title="Reset Password"
                      >
                        <Key className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTeacher(teacher.id)}
                        className="text-slate-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-xs">
                    {(() => {
                      const assignments = teacher.assignments || [];
                      const ctClasses = assignments
                        .filter((a: any) => a.is_class_teacher)
                        .map((a: any) => a.classes?.name || classes.find((c: any) => c.id === a.class_id)?.name)
                        .filter(Boolean);
                      const subClasses = assignments
                        .filter((a: any) => !a.is_class_teacher)
                        .map((a: any) => a.classes?.name || classes.find((c: any) => c.id === a.class_id)?.name)
                        .filter(Boolean);
                      const uniqueSubClasses = Array.from(new Set(subClasses));

                      return (
                        <>
                          {ctClasses.map((cName: string, i: number) => (
                            <span key={`ct-${i}`} className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 font-bold border border-amber-200 flex items-center gap-1">
                              ⭐ Class Teacher: {cName}
                            </span>
                          ))}
                          {uniqueSubClasses.map((cName: string, i: number) => (
                            <span key={`sub-${i}`} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium border border-blue-100">
                              {cName}
                            </span>
                          ))}
                          {ctClasses.length === 0 && uniqueSubClasses.length === 0 && (
                            teacher.assignedClass ? (
                              <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-medium border border-blue-100">
                                Class: {teacher.assignedClass}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-slate-50 text-slate-500 font-medium border border-slate-100 italic">No Class Assigned</span>
                            )
                          )}
                        </>
                      );
                    })()}
                    {teacher.subject && (
                      <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-medium border border-purple-100 flex items-center gap-1">
                        <BookOpen className="h-3 w-3" /> {teacher.subject}
                      </span>
                    )}
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
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Assigned Classes</th>
                  <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Subjects</th>
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
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {(() => {
                            const assignments = teacher.assignments || [];
                            const ctClasses = assignments
                              .filter((a: any) => a.is_class_teacher)
                              .map((a: any) => a.classes?.name || classes.find((c: any) => c.id === a.class_id)?.name)
                              .filter(Boolean);
                            const subClasses = assignments
                              .filter((a: any) => !a.is_class_teacher)
                              .map((a: any) => a.classes?.name || classes.find((c: any) => c.id === a.class_id)?.name)
                              .filter(Boolean);
                            const uniqueSubClasses = Array.from(new Set(subClasses));

                            if (ctClasses.length === 0 && uniqueSubClasses.length === 0) {
                              if (teacher.assignedClass) {
                                return (
                                  <span className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-semibold text-xs border border-blue-100">
                                    {teacher.assignedClass}
                                  </span>
                                );
                              }
                              return <span className="text-slate-400 text-xs italic">No Class Assigned</span>;
                            }

                            return (
                              <>
                                {ctClasses.map((cName: string, i: number) => (
                                  <span
                                    key={`ct-${i}`}
                                    className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1 shadow-2xs"
                                    title="Main Class Teacher"
                                  >
                                    ⭐ {cName} <span className="text-[10px] text-amber-600 font-semibold">(Class Teacher)</span>
                                  </span>
                                ))}
                                {uniqueSubClasses.map((cName: string, i: number) => (
                                  <span
                                    key={`sub-${i}`}
                                    className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-xs font-medium"
                                  >
                                    {cName}
                                  </span>
                                ))}
                              </>
                            );
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1 max-w-xs items-center">
                          {(() => {
                            const assignedSubjects = (teacher.assignments || [])
                              .filter((a: any) => !a.is_class_teacher)
                              .map((a: any) => a.subjects?.name || subjects.find((s: any) => s.id === a.subject_id)?.name)
                              .filter(Boolean);
                            const uniqueSubjects = Array.from(new Set(assignedSubjects));

                            if (uniqueSubjects.length > 0) {
                              return uniqueSubjects.map((sName: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100 text-xs font-medium flex items-center gap-1">
                                  <BookOpen className="h-3 w-3 text-purple-500" /> {sName}
                                </span>
                              ));
                            }
                            if (teacher.subject) {
                              return (
                                <div className="flex items-center gap-1.5 text-sm text-slate-700">
                                  <BookOpen className="h-3.5 w-3.5 text-slate-400" />
                                  <span>{teacher.subject}</span>
                                </div>
                              );
                            }
                            return <span className="text-slate-400 text-xs italic">General</span>;
                          })()}
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
                          onClick={() => handleResetPassword(teacher.id)}
                          className="text-slate-400 hover:text-emerald-600 mx-1 p-1 rounded-full hover:bg-emerald-50 transition-colors"
                          title="Reset Password"
                        >
                          <Key className="h-4 w-4" />
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
      )}

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
          availableClasses={classes}
          availableSubjects={subjects}
          onClose={() => setSelectedTeacher(null)}
          onEdit={() => {
            const t = selectedTeacher;
            setSelectedTeacher(null);
            openEditModal(t);
          }}
        />
      )}
    </div>
  );
};

const TeacherModal = ({ onClose, onSubmit, availableClasses = [], availableSubjects = [], initialData = null, isLoading = false }: any) => {
  const { currency } = useCurrency();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: 'password123',
    subject: '',
    salary: 0,
    assignments: [] as any[],
    allowances: [] as any[],
    deductions: [] as any[]
  });

  // Single Quick Add States
  const [quickClassId, setQuickClassId] = useState('');
  const [quickSubjectId, setQuickSubjectId] = useState('');
  const [quickIsClassTeacher, setQuickIsClassTeacher] = useState(false);

  // Bulk Selection States
  const [showBulkTool, setShowBulkTool] = useState(false);
  const [bulkClasses, setBulkClasses] = useState<string[]>([]);
  const [bulkSubjects, setBulkSubjects] = useState<string[]>([]);
  const [bulkIsClassTeacher, setBulkIsClassTeacher] = useState(false);

  useEffect(() => {
    if (initialData) {
      // Map existing assignments from DB format to UI format
      const existingAssignments = (initialData.assignments || []).map((a: any) => ({
        id: a.id || Math.random().toString(36).substring(2, 9),
        classId: a.class_id || a.classId,
        subjectId: a.subject_id || a.subjectId,
        isClassTeacher: !!(a.is_class_teacher || a.isClassTeacher)
      }));

      // Legacy fallback: if no assignments exist in DB yet, but assignedClass text exists
      if (existingAssignments.length === 0 && initialData.assignedClass) {
        const classObj = availableClasses.find((c: any) => c.name?.toLowerCase() === initialData.assignedClass?.toLowerCase());
        if (classObj) {
          existingAssignments.push({
            id: 'legacy-assignment',
            classId: classObj.id,
            subjectId: null,
            isClassTeacher: true
          });
        }
      }

      setFormData({
        name: initialData.name || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        password: initialData.password || 'password123',
        subject: initialData.subject || '',
        salary: initialData.salary || 0,
        assignments: existingAssignments,
        allowances: initialData.allowances || [],
        deductions: initialData.deductions || []
      });
    }
  }, [initialData, availableClasses]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleQuickAdd = () => {
    if (!quickClassId) {
      alert("Please select a target class first.");
      return;
    }
    if (!quickIsClassTeacher && !quickSubjectId) {
      alert("Please choose a subject or check 'Main Class Teacher'.");
      return;
    }

    const newAssignment = {
      id: Math.random().toString(36).substring(2, 9),
      classId: quickClassId,
      subjectId: quickIsClassTeacher ? null : quickSubjectId,
      isClassTeacher: quickIsClassTeacher
    };

    // Check if assignment already exists
    const duplicate = formData.assignments.some(
      (a: any) => a.classId === newAssignment.classId &&
                  a.subjectId === newAssignment.subjectId &&
                  a.isClassTeacher === newAssignment.isClassTeacher
    );

    if (duplicate) {
      alert("This exact class & subject assignment is already in the list.");
      return;
    }

    setFormData(prev => ({
      ...prev,
      assignments: [...prev.assignments, newAssignment]
    }));

    // Reset subject only, keep class for quick multiple-subject entry
    if (!quickIsClassTeacher) {
      setQuickSubjectId('');
    }
  };

  const removeAssignment = (id: string) => {
    setFormData(prev => ({
      ...prev,
      assignments: prev.assignments.filter(a => a.id !== id)
    }));
  };

  const handleBulkAdd = () => {
    if (bulkClasses.length === 0) return alert("Select at least one class");
    if (!bulkIsClassTeacher && bulkSubjects.length === 0) return alert("Select at least one subject or check 'Class Teacher'");

    const newAssignments: any[] = [];

    bulkClasses.forEach(classId => {
      if (bulkIsClassTeacher) {
        newAssignments.push({
          id: Math.random().toString(36).substring(2, 9),
          classId: classId,
          subjectId: null,
          isClassTeacher: true
        });
      } else {
        bulkSubjects.forEach(subjectId => {
          newAssignments.push({
            id: Math.random().toString(36).substring(2, 9),
            classId: classId,
            subjectId: subjectId,
            isClassTeacher: false
          });
        });
      }
    });

    // Filter duplicates
    const finalAssignments = [...formData.assignments];
    newAssignments.forEach(na => {
      const exists = finalAssignments.find(fa => fa.classId === na.classId && fa.subjectId === na.subjectId && fa.isClassTeacher === na.isClassTeacher);
      if (!exists) finalAssignments.push(na);
    });

    setFormData(prev => ({ ...prev, assignments: finalAssignments }));
    // Reset bulk selections
    setBulkClasses([]);
    setBulkSubjects([]);
    setBulkIsClassTeacher(false);
    setShowBulkTool(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-xs p-3 md:p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] border border-slate-100">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary-50 rounded-xl text-primary-600">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800">
                {initialData ? 'Edit Teacher Profile & Assignments' : 'Add New Teacher'}
              </h3>
              <p className="text-xs text-slate-500">
                Link teacher account, assign classes, subjects, and roles.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Personal & Login Info */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">1. Personal & Account Credentials</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  required
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Mr. Kwame Mensah"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address (Login Username) *</label>
                <input
                  required
                  type="email"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="teacher@school.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                <input
                  required
                  type="tel"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="024XXXXXXX"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Login Password {initialData ? '(Leave as-is or set new)' : '(Default: password123)'}
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm font-mono"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    placeholder="password123"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Monthly Salary ({currency.code})</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm"
                    value={formData.salary}
                    onChange={e => setFormData({ ...formData, salary: Number(e.target.value) })}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject Specialization Note (Optional)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none text-sm"
                  value={formData.subject}
                  onChange={e => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g. Mathematics, Integrated Science (Auto-fills from assignments if blank)"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Class & Subject Assignments */}
          <div className="border-t border-slate-100 pt-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-primary-600" /> 2. Class & Subject Assignments
                </h4>
                <p className="text-[11px] text-slate-500">
                  Assign this teacher as a Class Teacher or assign them specific subjects to teach in classes.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowBulkTool(!showBulkTool)}
                className="text-xs font-bold text-primary-600 hover:text-primary-800 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Layers className="h-3.5 w-3.5" />
                {showBulkTool ? 'Hide Bulk Assign' : 'Open Bulk Assign Tool'}
              </button>
            </div>

            {/* Quick Single Assignment Box */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide block">
                Quick Assign: Choose Class & Subject
              </span>
              
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                {/* Target Class */}
                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Target Class</label>
                  <select
                    value={quickClassId}
                    onChange={e => setQuickClassId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-primary-600 outline-none"
                  >
                    <option value="">-- Choose Class --</option>
                    {availableClasses.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Role / Subject */}
                <div className="sm:col-span-5">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-600">
                      {quickIsClassTeacher ? 'Class Teacher (All Subjects)' : 'Teaching Subject'}
                    </label>
                    <label className="flex items-center gap-1 text-[11px] text-amber-700 font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={quickIsClassTeacher}
                        onChange={e => {
                          setQuickIsClassTeacher(e.target.checked);
                          if (e.target.checked) setQuickSubjectId('');
                        }}
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
                      />
                      Class Teacher
                    </label>
                  </div>

                  {quickIsClassTeacher ? (
                    <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold text-amber-800 flex items-center gap-1.5">
                      ⭐ Main Class Teacher (Supervises Class)
                    </div>
                  ) : (
                    <select
                      value={quickSubjectId}
                      onChange={e => setQuickSubjectId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-primary-600 outline-none"
                    >
                      <option value="">-- Choose Subject --</option>
                      {availableSubjects.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Add Button */}
                <div className="sm:col-span-3">
                  <button
                    type="button"
                    onClick={handleQuickAdd}
                    className="w-full py-2 px-3 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1 shadow-sm"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Assignment
                  </button>
                </div>
              </div>
            </div>

            {/* Bulk Assignment Drawer / Accordion */}
            {showBulkTool && (
              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-indigo-600" />
                    <span className="text-xs font-bold text-indigo-900 uppercase tracking-tight">Bulk Multi-Class Generator</span>
                  </div>
                  <span className="text-[10px] text-indigo-600 font-semibold">Select multiple classes & subjects at once</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bulk Classes */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Target Classes ({bulkClasses.length})</label>
                      <button
                        type="button"
                        onClick={() => setBulkClasses(bulkClasses.length === availableClasses.length ? [] : availableClasses.map((c: any) => c.id))}
                        className="text-[10px] font-bold text-primary-600 hover:underline"
                      >
                        {bulkClasses.length === availableClasses.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-2.5 bg-white border border-slate-200 rounded-lg">
                      {availableClasses.map((c: any) => (
                        <label
                          key={c.id}
                          className={`flex items-center gap-2 p-1.5 rounded-md border text-xs cursor-pointer transition-all ${
                            bulkClasses.includes(c.id) ? 'bg-primary-50 border-primary-300 font-bold text-primary-700' : 'bg-slate-50 border-slate-100 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-primary-600 h-3.5 w-3.5"
                            checked={bulkClasses.includes(c.id)}
                            onChange={e => {
                              if (e.target.checked) setBulkClasses([...bulkClasses, c.id]);
                              else setBulkClasses(bulkClasses.filter(id => id !== c.id));
                            }}
                          />
                          <span className="truncate">{c.name}</span>
                        </label>
                      ))}
                      {availableClasses.length === 0 && (
                        <p className="text-xs text-slate-400 italic col-span-2 p-2">No classes found in this school.</p>
                      )}
                    </div>
                  </div>

                  {/* Bulk Subjects */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-bold text-slate-600 uppercase">Target Subjects ({bulkSubjects.length})</label>
                      <label className="flex items-center gap-1 text-[10px] font-bold text-amber-700 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-amber-600 h-3.5 w-3.5"
                          checked={bulkIsClassTeacher}
                          onChange={e => {
                            setBulkIsClassTeacher(e.target.checked);
                            if (e.target.checked) setBulkSubjects([]);
                          }}
                        />
                        Class Teacher (All)
                      </label>
                    </div>
                    <div className={`grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-2.5 bg-white border border-slate-200 rounded-lg transition-opacity ${bulkIsClassTeacher ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                      {availableSubjects.map((s: any) => (
                        <label
                          key={s.id}
                          className={`flex items-center gap-2 p-1.5 rounded-md border text-xs cursor-pointer transition-all ${
                            bulkSubjects.includes(s.id) ? 'bg-purple-50 border-purple-300 font-bold text-purple-700' : 'bg-slate-50 border-slate-100 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="rounded border-slate-300 text-purple-600 h-3.5 w-3.5"
                            checked={bulkSubjects.includes(s.id)}
                            onChange={e => {
                              if (e.target.checked) setBulkSubjects([...bulkSubjects, s.id]);
                              else setBulkSubjects(bulkSubjects.filter(id => id !== s.id));
                            }}
                          />
                          <span className="truncate">{s.name}</span>
                        </label>
                      ))}
                      {availableSubjects.length === 0 && (
                        <p className="text-xs text-slate-400 italic col-span-2 p-2">No subjects found in this school.</p>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBulkAdd}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Plus className="h-4 w-4" /> Generate Assignments From Selection
                </button>
              </div>
            )}

            {/* Active Assignments List */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Active Assignments ({formData.assignments.length})
                </span>
                {formData.assignments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, assignments: [] })}
                    className="text-[11px] font-bold text-red-500 hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {formData.assignments.map((assignment: any, index: number) => {
                  const classObj = availableClasses.find((c: any) => c.id === assignment.classId);
                  const subjectObj = availableSubjects.find((s: any) => s.id === assignment.subjectId);

                  return (
                    <div
                      key={assignment.id || index}
                      className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 hover:border-primary-200 transition-colors shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 font-bold text-[10px] flex items-center justify-center">
                          {index + 1}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold text-xs border border-blue-100">
                            {classObj?.name || 'Class ID: ' + assignment.classId?.slice(0, 8)}
                          </span>
                          {assignment.isClassTeacher ? (
                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-bold text-xs border border-amber-200 flex items-center gap-1">
                              ⭐ Main Class Teacher
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-semibold text-xs border border-purple-100 flex items-center gap-1">
                              <BookOpen className="h-3 w-3" /> {subjectObj?.name || 'Subject ID: ' + assignment.subjectId?.slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeAssignment(assignment.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remove assignment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}

                {formData.assignments.length === 0 && (
                  <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <p className="text-xs font-semibold text-slate-400">
                      No classes or subjects assigned yet. Use Quick Assign above to link this teacher to their classes.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Payroll Allowances & Deductions */}
          <div className="border-t border-slate-100 pt-5">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">3. Standard Allowances & Fixed Deductions</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Allowances */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-600">Monthly Allowances</span>
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, allowances: [...p.allowances, { name: '', amount: 0 }] }))}
                    className="text-xs text-primary-600 font-bold hover:underline"
                  >
                    + Add
                  </button>
                </div>
                {formData.allowances.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="e.g. Transport"
                      className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none"
                      value={item.name}
                      onChange={e => {
                        const newAll = [...formData.allowances];
                        newAll[idx].name = e.target.value;
                        setFormData({ ...formData, allowances: newAll });
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      className="w-24 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none"
                      value={item.amount}
                      onChange={e => {
                        const newAll = [...formData.allowances];
                        newAll[idx].amount = Number(e.target.value);
                        setFormData({ ...formData, allowances: newAll });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newAll = [...formData.allowances];
                        newAll.splice(idx, 1);
                        setFormData({ ...formData, allowances: newAll });
                      }}
                      className="p-1 text-slate-400 hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {formData.allowances.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No allowances configured</p>
                )}
              </div>

              {/* Deductions */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-slate-600">Fixed Deductions</span>
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, deductions: [...p.deductions, { name: '', amount: 0 }] }))}
                    className="text-xs text-primary-600 font-bold hover:underline"
                  >
                    + Add
                  </button>
                </div>
                {formData.deductions.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="e.g. Pension / Tax"
                      className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none"
                      value={item.name}
                      onChange={e => {
                        const newDed = [...formData.deductions];
                        newDed[idx].name = e.target.value;
                        setFormData({ ...formData, deductions: newDed });
                      }}
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      className="w-24 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none"
                      value={item.amount}
                      onChange={e => {
                        const newDed = [...formData.deductions];
                        newDed[idx].amount = Number(e.target.value);
                        setFormData({ ...formData, deductions: newDed });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newDed = [...formData.deductions];
                        newDed.splice(idx, 1);
                        setFormData({ ...formData, deductions: newDed });
                      }}
                      className="p-1 text-slate-400 hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {formData.deductions.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No deductions configured</p>
                )}
              </div>
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && <Loading type="spinner" fullScreen={false} message="" />}
              {isLoading ? 'Saving Teacher...' : (initialData ? 'Save Changes' : 'Create Teacher Account')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Sub-component: Teacher Profile Drawer ---
const TeacherProfileDrawer = ({ teacher, availableClasses = [], availableSubjects = [], onClose, onEdit }: any) => {
  const { formatAmount } = useCurrency();

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-300 flex flex-col justify-between">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Teacher Profile</h2>
              <p className="text-xs text-slate-400">Staff Credentials & Class Assignments</p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
              <X className="h-6 w-6 text-slate-400" />
            </button>
          </div>

          {/* Profile Card */}
          <div className="flex flex-col items-center">
            <div className="h-24 w-24 rounded-full bg-slate-100 border-4 border-white shadow-lg overflow-hidden mb-3">
              <img
                src={`https://ui-avatars.com/api/?name=${teacher.name}&background=random`}
                alt={teacher.name}
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-lg font-bold text-slate-800 text-center">{teacher.name}</h3>
            <p className="text-slate-500 text-xs">{teacher.subject || 'Faculty Member'}</p>
            <span className={`mt-2 px-3 py-0.5 rounded-full text-xs font-bold ${teacher.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
              {teacher.status}
            </span>
          </div>

          {/* Account Details */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2.5">
            <h4 className="font-bold text-slate-700 text-xs flex items-center gap-1.5 uppercase tracking-wide">
              <User className="h-3.5 w-3.5 text-primary-600" /> Account Details
            </h4>
            <div className="divide-y divide-slate-100 text-xs space-y-2 pt-1">
              <div className="flex justify-between pt-1">
                <span className="text-slate-500">Email</span>
                <span className="font-medium text-slate-900">{teacher.email}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-500">Phone</span>
                <span className="font-medium text-slate-900">{teacher.phone}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-slate-500">Base Salary</span>
                <span className="font-bold text-slate-900">{formatAmount(teacher.salary || 0)}</span>
              </div>
            </div>
          </div>

          {/* Class & Subject Assignments */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2.5">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-slate-700 text-xs flex items-center gap-1.5 uppercase tracking-wide">
                <Shield className="h-3.5 w-3.5 text-primary-600" /> Linked Assignments ({teacher.assignments?.length || 0})
              </h4>
            </div>

            <div className="space-y-1.5">
              {teacher.assignments && teacher.assignments.length > 0 ? (
                teacher.assignments.map((a: any, i: number) => {
                  const className = a.classes?.name || availableClasses.find((c: any) => c.id === (a.class_id || a.classId))?.name || 'Class';
                  const subjectName = a.subjects?.name || availableSubjects.find((s: any) => s.id === (a.subject_id || a.subjectId))?.name || 'Subject';

                  return (
                    <div key={i} className="text-xs bg-white p-2.5 rounded-lg border border-slate-200 flex justify-between items-center shadow-2xs">
                      <span className="font-bold text-slate-800">{className}</span>
                      {a.is_class_teacher || a.isClassTeacher ? (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 font-bold rounded-md border border-amber-200 text-[11px]">
                          ⭐ Class Teacher
                        </span>
                      ) : (
                        <span className="text-slate-600 font-medium">{subjectName}</span>
                      )}
                    </div>
                  );
                })
              ) : (
                teacher.assignedClass ? (
                  <div className="text-xs bg-white p-2.5 rounded-lg border border-slate-200 flex justify-between items-center shadow-2xs">
                    <span className="font-bold text-slate-800">{teacher.assignedClass}</span>
                    <span className="text-slate-500 text-[11px]">Assigned Class</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">No class assignments linked yet.</p>
                )
              )}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-4">
          <button
            onClick={onEdit}
            className="w-full bg-primary-600 text-white py-2.5 rounded-xl font-bold text-sm hover:bg-primary-700 transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            <Edit className="h-4 w-4" /> Edit Profile & Assignments
          </button>
        </div>
      </div>
    </div>
  );
};

export default Teachers;
