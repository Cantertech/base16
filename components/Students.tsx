import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Plus, FileSpreadsheet, Eye, Edit,
  X, User, Phone, CheckCircle, AlertCircle, ChevronLeft,
  ChevronRight, Download, DollarSign, Calendar, TrendingUp, Trash2,
  Table as TableIcon, LayoutList, Camera, UploadCloud, Lock,
  Mail, MapPin, Shield, Copy, GraduationCap, School, CreditCard
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabaseClient';
import Loading from './Loading';
import { useCurrency } from '../contexts/CurrencyContext';
import { compressImage } from '../utils/imageCompression';

// --- Types ---
interface Student {
  id: string;
  name: string;
  class: string;
  gender: 'Male' | 'Female';
  parentName: string;
  parentPhone: string;
  balance: number;
  dob?: string;
  status?: 'Active' | 'Suspended' | 'Graduated';
  attendance?: number;
  admission_no?: string;
  pin?: string;
  photo_url?: string;
}

interface StudentsProps {
  currentUser?: {
    id: string;
    role: 'admin' | 'teacher';
    assignedClass?: string | null;
    school_id?: string;
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

const fetchFeeStructure = async (schoolId: string) => {
  const { data } = await supabase
    .from('fee_structure')
    .select('*')
    .eq('school_id', schoolId);

  if (!data) return [];
  return data;
};

const fetchStudents = async (currentUser: any) => {
  const schoolId = currentUser?.school_id;
  if (!schoolId) throw new Error('No school ID');

  const isTeacher = currentUser?.role === 'teacher';
  let query = supabase
    .from('students')
    .select('*')
    .eq('school_id', schoolId)
    .order('name', { ascending: true });

  if (isTeacher && currentUser?.id) {
    // Fetch assignments first
    const { data: assignments } = await supabase
      .from('teacher_assignments')
      .select('classes(name)')
      .eq('teacher_id', currentUser.id);

    let assignedClassNames: string[] = [];

    if (assignments && assignments.length > 0) {
      assignedClassNames = assignments.map((a: any) => a.classes?.name).filter(Boolean);
    }

    // Fallback to legacy assignedClass if no assignments found
    if (assignedClassNames.length === 0 && currentUser.assignedClass) {
      assignedClassNames = [currentUser.assignedClass];
    }

    if (assignedClassNames.length > 0) {
      query = query.in('class', assignedClassNames);
    } else {
      // No classes assigned -> show nothing
      // We can simulate an empty result by filtering on a non-existent ID
      return [];
    }
  }

  const { data, error } = await query;
  if (error) throw error;

  return data.map((s: any) => ({
    id: s.id,
    name: s.name,
    class: s.class,
    gender: s.gender,
    parentName: s.parent_name,
    parentPhone: s.parent_phone,
    balance: s.balance,
    dob: s.date_of_birth,
    status: s.status,
    attendance: 100, // Mock for now
    admission_no: s.admission_no,
    pin: s.pin,
    photo_url: s.photo_url
  })) as Student[];
};

// --- Main Component ---
const Students: React.FC<StudentsProps> = ({ currentUser }) => {
  const { formatAmount, currency } = useCurrency();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [mobileViewMode, setMobileViewMode] = useState<'card' | 'table'>('card');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; status: string } | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);

  // Profile Drawer State
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const isTeacher = currentUser?.role === 'teacher';
  const schoolId = currentUser?.school_id;

  // --- Queries ---
  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ['students', schoolId, currentUser?.id], // Add user ID to key for teachers
    queryFn: () => fetchStudents(currentUser),
    enabled: !!schoolId,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['studentClasses', schoolId],
    queryFn: () => fetchClasses(schoolId!),
    enabled: !!schoolId,
  });

  const { data: feeStructure = [] } = useQuery({
    queryKey: ['feeStructure', schoolId],
    queryFn: () => fetchFeeStructure(schoolId!),
    enabled: !!schoolId,
  });

  const { data: teacherClasses = [] } = useQuery({
    queryKey: ['teacherClasses', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return [];
      const { data: assignments } = await supabase
        .from('teacher_assignments')
        .select('classes(name)')
        .eq('teacher_id', currentUser.id);

      const assigned = assignments?.map((a: any) => a.classes?.name).filter(Boolean) || [];
      // Combine with legacy assignedClass if present and not already in list
      if (currentUser.assignedClass && !assigned.includes(currentUser.assignedClass)) {
        assigned.push(currentUser.assignedClass);
      }
      return assigned;
    },
    enabled: !!currentUser?.id && isTeacher
  });

  const { data: activeModules = [] } = useQuery({
    queryKey: ['activeModules', schoolId],
    queryFn: async () => {
      if (!schoolId) return [];
      const { data } = await supabase
        .from('school_subscriptions')
        .select('module_id')
        .eq('school_id', schoolId)
        .eq('status', 'active');

      return data ? data.map(sub => sub.module_id) : [];
    },
    enabled: !!schoolId
  });

  const hasFeesModule = activeModules.includes('revenue_guard') || activeModules.includes('complete_bundle');

  // Automatically set class filter for teachers
  useEffect(() => {
    if (isTeacher && classFilter === 'All') {
      if (teacherClasses.length > 0) {
        setClassFilter(teacherClasses[0]);
      } else if (currentUser?.assignedClass) {
        setClassFilter(currentUser.assignedClass);
      }
    }
  }, [isTeacher, teacherClasses, currentUser, classFilter]);


  // --- Mutations ---
  const addStudentMutation = useMutation({
    mutationFn: async (studentData: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user logged in');
      if (!schoolId) throw new Error('No school associated with user');

      const admission_no = studentData.admission_no || `${new Date().getFullYear()}${(studentData.class || 'G').replace(/[^a-zA-Z0-9]/g, '').substring(0, 2).toUpperCase()}${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 99).toString().padStart(2, '0')}`;
      const pin = studentData.pin || `${Math.floor(Math.random() * 9000 + 1000)}`;

      const newStudentPayload: any = {
        school_id: schoolId,
        name: studentData.name,
        class: studentData.class,
        gender: studentData.gender,
        parent_name: studentData.parentName,
        parent_phone: studentData.parentPhone,
        date_of_birth: studentData.dob || null,
        status: 'Active',
        balance: Number(studentData.balance) || 0,
        admission_no,
        pin
      };

      const { data: insertedData, error: insertError } = await supabase
        .from('students')
        .insert([newStudentPayload])
        .select()
        .single();

      if (insertError) throw insertError;
      const newStudentId = insertedData.id;

      if (studentData.photoFile) {
        try {
          const compressedFile = await compressImage(studentData.photoFile);
          const fileName = `${newStudentId}_${Date.now()}.jpg`;
          const filePath = `${newStudentId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('student-photos')
            .upload(filePath, compressedFile);

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from('student-photos')
              .getPublicUrl(filePath);

            if (publicUrlData.publicUrl) {
              await supabase
                .from('students')
                .update({ photo_url: publicUrlData.publicUrl })
                .eq('id', newStudentId);
            }
          }
        } catch (err) { console.error(err); }
      }
      return { admission_no, pin };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
      setIsAddModalOpen(false);
      alert(`Student added successfully!\n\nGENERATED CREDENTIALS:\nStudent ID: ${data.admission_no}\nPIN: ${data.pin}\n\nPlease share these with the parent.`);
    },
    onError: (error: any) => {
      alert(`Failed to add student: ${error.message}`);
    }
  });

  const editStudentMutation = useMutation({
    mutationFn: async ({ id, data: updatedData }: { id: string, data: any }) => {
      const updatePayload: any = {
        name: updatedData.name,
        class: updatedData.class,
        gender: updatedData.gender,
        parent_name: updatedData.parentName,
        parent_phone: updatedData.parentPhone,
        date_of_birth: updatedData.dob || null,
        balance: Number(updatedData.balance),
        admission_no: updatedData.admission_no,
        pin: updatedData.pin
      };

      if (updatedData.photoFile) {
        try {
          const compressedFile = await compressImage(updatedData.photoFile);
          const fileName = `${id}_${Date.now()}.jpg`;
          const filePath = `${id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('student-photos')
            .upload(filePath, compressedFile);

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from('student-photos')
              .getPublicUrl(filePath);

            if (publicUrlData.publicUrl) {
              updatePayload.photo_url = publicUrlData.publicUrl;
            }
          }
        } catch (err) { console.error(err); }
      }

      const { error } = await supabase.from('students').update(updatePayload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
      setIsEditModalOpen(false);
      setStudentToEdit(null);
      alert('Student updated successfully!');
    },
    onError: (error: any) => {
      alert(`Failed to update student: ${error.message}`);
    }
  });

  const deleteStudentsMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('students').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
      setSelectedStudents(new Set());
      alert('Students deleted successfully.');
    },
    onError: (error: any) => {
      alert(`Failed to delete students: ${error.message}`);
    }
  });

  // --- Handlers ---
  const handleAddStudent = (data: any) => addStudentMutation.mutate(data);
  const handleEditStudent = (id: string, data: any) => editStudentMutation.mutate({ id, data });
  const handleBulkDelete = () => {
    if (selectedStudents.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedStudents.size} students?`)) return;
    deleteStudentsMutation.mutate(Array.from(selectedStudents));
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const allIds = new Set(filteredStudents.map(s => s.id));
      setSelectedStudents(allIds);
    } else {
      setSelectedStudents(new Set());
    }
  };

  const handleSelectStudent = (id: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedStudents(newSelected);
  };

  // Import Handler (Kept mostly as is but cleaner)
  const handleImportCSV = async (file: File) => {
    setImportProgress({ current: 0, total: 0, status: 'Reading file...' });
    try {
      if (!schoolId) throw new Error('No school ID');

      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        if (!text) return;

        const lines = text.split('\n');
        const csvClasses = new Set<string>();
        const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;
        setImportProgress({ current: 0, total: lines.length - startIndex, status: 'Fetching existing data...' });

        // 1. Fetch existing
        const { data: existingStudents } = await supabase
          .from('students')
          .select('id, name')
          .eq('school_id', schoolId);

        const studentMap = new Map();
        existingStudents?.forEach(s => studentMap.set(s.name.trim().toLowerCase(), s.id));

        // 2. Parse
        const parsedLines = [];
        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const parts = line.split(',');
          if (parts.length >= 2) {
            parsedLines.push(parts);
            if (parts[1]?.trim()) csvClasses.add(parts[1]?.trim());
          }
        }

        // 3. Classes
        if (csvClasses.size > 0) {
          const { data: existingClasses } = await supabase.from('classes').select('name').eq('school_id', schoolId);
          const existingClassNames = new Set(existingClasses?.map(c => c.name) || []);
          const classesToCreate = Array.from(csvClasses).filter(c => !existingClassNames.has(c));

          if (classesToCreate.length > 0) {
            await supabase.from('classes').insert(classesToCreate.map(name => ({ school_id: schoolId, name })));
            queryClient.invalidateQueries({ queryKey: ['classes', schoolId] });
          }
        }

        // 4. Prepare
        let updateCount = 0;
        let insertCount = 0;
        const total = parsedLines.length;
        setImportProgress({ current: 0, total, status: 'Preparing data...' });

        const studentsToUpdate: any[] = [];
        const studentsToInsert: any[] = [];
        const seenInBatch = new Set<string>();

        for (let i = 0; i < total; i++) {
          const parts = parsedLines[i];
          const name = parts[0]?.trim();
          const studentClass = parts[1]?.trim();
          if (!name || !studentClass) continue;

          const key = name.toLowerCase();
          if (seenInBatch.has(key)) continue;
          seenInBatch.add(key);

          const existingId = studentMap.get(key);
          let initialBalance = 0;
          if (parts[5] && parts[5].trim() !== '') {
            initialBalance = Number(parts[5].trim());
          } else if (!existingId) {
            initialBalance = feeStructure
              .filter(f => !f.target_class || f.target_class === 'All' || f.target_class === studentClass)
              .reduce((sum: number, f: any) => sum + Number(f.amount), 0);
          }

          const payload: any = {
            school_id: schoolId,
            name,
            class: studentClass,
            gender: (parts[2]?.trim().toLowerCase() === 'female' ? 'Female' : 'Male'),
            parent_name: parts[3]?.trim() || 'Parent',
            parent_phone: parts[4]?.trim(),
            status: 'Active',
            admission_no: `${new Date().getFullYear()}${(studentClass || 'G').replace(/[^a-zA-Z0-9]/g, '').substring(0, 2).toUpperCase()}${(Date.now() + i).toString().slice(-4)}${Math.floor(Math.random() * 99).toString().padStart(2, '0')}`,
            pin: `${Math.floor(Math.random() * 9000 + 1000)}`
          };

          if (parts[5] && parts[5].trim() !== '') { payload.balance = initialBalance; }
          else if (!existingId) { payload.balance = initialBalance; }

          if (existingId) {
            payload.id = existingId;
            studentsToUpdate.push(payload);
            updateCount++;
          } else {
            studentsToInsert.push(payload);
            insertCount++;
          }
        }

        // 5. Execute
        const chunkSize = 20;
        let processed = 0;
        if (studentsToUpdate.length > 0) {
          setImportProgress({ current: processed, total, status: `Updating...` });
          for (let i = 0; i < studentsToUpdate.length; i += chunkSize) {
            await supabase.from('students').upsert(studentsToUpdate.slice(i, i + chunkSize));
            processed += Math.min(chunkSize, studentsToUpdate.length - i);
            setImportProgress(p => ({ ...p!, current: processed }));
          }
        }
        if (studentsToInsert.length > 0) {
          setImportProgress({ current: processed, total, status: `Inserting...` });
          for (let i = 0; i < studentsToInsert.length; i += chunkSize) {
            await supabase.from('students').insert(studentsToInsert.slice(i, i + chunkSize));
            processed += Math.min(chunkSize, studentsToInsert.length - i);
            setImportProgress(p => ({ ...p!, current: processed }));
          }
        }

        queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
        setIsImportModalOpen(false);
        alert(`Import successful!\nUpdated: ${updateCount}\nInserted: ${insertCount}`);

      };
      reader.readAsText(file);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setImportProgress(null);
    }
  };


  // --- Filtering & Pagination ---
  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = classFilter === 'All' || s.class === classFilter;
    return matchesSearch && matchesClass;
  });

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6 relative h-full overflow-y-auto pb-20 md:pb-0">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800">
            {isTeacher && currentUser?.assignedClass ? `My Class: ${currentUser.assignedClass}` : 'Student Management'}
          </h1>
          <p className="text-slate-500 text-xs md:text-sm">Manage admissions, view records, and track fees.</p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none w-full sm:w-64 text-sm"
            />
          </div>

          <div className="flex gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1">
            {/* View Toggle (Mobile Only) */}
            <button
              onClick={() => setMobileViewMode(prev => prev === 'card' ? 'table' : 'card')}
              className="md:hidden flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors whitespace-nowrap"
            >
              {mobileViewMode === 'card' ? <TableIcon className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
              <span className="hidden sm:inline">{mobileViewMode === 'card' ? 'Table View' : 'Card View'}</span>
            </button>

            {/* Filter */}
            <div className="relative min-w-[120px]">
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="w-full pl-4 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none appearance-none bg-white text-sm"
              >
                <option value="All">All Classes</option>
                {isTeacher ? (
                  teacherClasses.length > 0 ? teacherClasses.map((c: string) => (
                    <option key={c} value={c}>{c}</option>
                  )) : (
                    currentUser?.assignedClass && <option value={currentUser.assignedClass}>{currentUser.assignedClass}</option>
                  )
                ) : (
                  classes.length > 0 ? classes.map((c: any) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  )) : (
                    ['JHS 3', 'JHS 2', 'JHS 1', 'Class 6', 'Class 5', 'Class 4'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))
                  )
                )}
              </select>
              <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
            </div>

            {/* Actions */}
            {selectedStudents.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 font-medium text-sm transition-colors whitespace-nowrap"
              >
                <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Delete</span> ({selectedStudents.size})
              </button>
            )}

            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors whitespace-nowrap"
            >
              <FileSpreadsheet className="h-4 w-4" /> <span className="hidden sm:inline">Import</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-800 font-medium text-sm shadow-sm transition-colors whitespace-nowrap"
            >
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Add</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1">
        {/* Mobile View: Cards */}
        <div className={`md:hidden divide-y divide-slate-100 ${mobileViewMode === 'table' ? 'hidden' : ''}`}>
          {isLoadingStudents ? (
            <div className="p-8"><Loading type="skeleton" fullScreen={false} /></div>
          ) : paginatedStudents.length > 0 ? (
            paginatedStudents.map((student) => (
              <div key={student.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm border border-slate-200 overflow-hidden">
                      {student.photo_url ? (
                        <img src={student.photo_url} alt={student.name} className="w-full h-full object-cover" />
                      ) : (
                        student.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900 line-clamp-1">{student.name}</div>
                      <div className="text-xs text-slate-500">{student.id.substring(0, 8)}...</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setSelectedStudent(student)}
                      className="text-slate-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setStudentToEdit(student);
                        setIsEditModalOpen(true);
                      }}
                      className="text-slate-400 hover:text-orange-600 p-2 rounded-full hover:bg-orange-50"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-1 rounded-md bg-slate-100 font-medium border border-slate-200">
                    {student.class}
                  </span>
                  <span className={`px-2 py-1 rounded-full font-medium ${student.gender === 'Male' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                    }`}>
                    {student.gender}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
                  <div>
                    <span className="block font-bold text-slate-400 uppercase text-[10px]">Parent</span>
                    {student.parentName}
                  </div>
                  <div>
                    <span className="block font-bold text-slate-400 uppercase text-[10px]">Phone</span>
                    {student.parentPhone}
                  </div>
                </div>

                {(!isTeacher && hasFeesModule) && (
                  <div className="flex justify-between items-center text-xs pt-1">
                    <span className="font-semibold text-slate-600">Balance:</span>
                    <span className={`font-bold ${student.balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {formatAmount(student.balance)}
                    </span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400">
              <p>No students found.</p>
            </div>
          )}
        </div>

        {/* Desktop View: Table (Also used for Mobile Table Mode) */}
        <div className={`overflow-x-auto ${mobileViewMode === 'card' ? 'hidden md:block' : 'block'}`}>
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input type="checkbox" onChange={handleSelectAll} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Student</th>
                {!isTeacher && <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Class</th>}
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Gender</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Parent Details</th>
                {(!isTeacher && hasFeesModule) && <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Balance</th>}
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingStudents ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">Loading...</td>
                </tr>
              ) : paginatedStudents.length > 0 ? (
                paginatedStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedStudents.has(student.id)}
                        onChange={() => handleSelectStudent(student.id)}
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs overflow-hidden border border-slate-200">
                          {student.photo_url ? (
                            <img src={student.photo_url} alt={student.name} className="w-full h-full object-cover" />
                          ) : (
                            student.name.charAt(0)
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{student.name}</p>
                          <p className="text-xs text-slate-500 font-mono tracking-tight">{student.admission_no}</p>
                        </div>
                      </div>
                    </td>
                    {!isTeacher && <td className="px-6 py-4 text-sm text-slate-600 font-medium">{student.class}</td>}
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${student.gender === 'Male' ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'
                        }`}>
                        {student.gender}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-slate-700">{student.parentName}</p>
                        <p className="text-xs text-slate-500">{student.parentPhone}</p>
                      </div>
                    </td>
                    {(!isTeacher && hasFeesModule) && (
                      <td className="px-6 py-4">
                        <span className={`text-sm font-bold ${student.balance > 0 ? 'text-red-500' : 'text-green-600 bg-green-50 px-2 py-0.5 rounded'}`}>
                          {formatAmount(student.balance)}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-green-100 text-green-700 rounded-full">{student.status || 'Active'}</span>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <button
                        onClick={() => setSelectedStudent(student)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Profile"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setStudentToEdit(student);
                          setIsEditModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                        title="Edit Student"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                    No students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredStudents.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Showing <span className="font-bold">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-bold">{Math.min(currentPage * itemsPerPage, filteredStudents.length)}</span> of <span className="font-bold">{filteredStudents.length}</span> students
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-white transition-colors"
              >
                <ChevronLeft className="h-4 w-4 text-slate-600" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-slate-300 rounded-lg disabled:opacity-50 hover:bg-white transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-slate-600" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* --- MODALS --- */}
      {isAddModalOpen && (
        <AddStudentModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSave={handleAddStudent}
          classes={classes}
          isSubmitting={addStudentMutation.isPending}
          hasFeesModule={hasFeesModule}
        />
      )}

      {isEditModalOpen && studentToEdit && (
        <EditStudentModal
          isOpen={isEditModalOpen}
          student={studentToEdit}
          onClose={() => {
            setIsEditModalOpen(false);
            setStudentToEdit(null);
          }}
          onSave={(data: any) => handleEditStudent(studentToEdit.id, data)}
          classes={classes}
          isSubmitting={editStudentMutation.isPending}
          hasFeesModule={hasFeesModule}
        />
      )}

      {selectedStudent && (
        <StudentProfileDrawer
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onEdit={() => {
            setStudentToEdit(selectedStudent);
            setIsEditModalOpen(true);
            setSelectedStudent(null);
          }}
          hasFeesModule={hasFeesModule}
        />
      )}

      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Import Students</h3>
                <p className="text-slate-500 text-sm">Bulk add students by uploading a CSV file.</p>
              </div>
              <button onClick={() => setIsImportModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
                <h4 className="text-blue-800 font-bold text-sm mb-2 flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" /> Required CSV Format
                </h4>
                <p className="text-blue-600 text-xs mb-4">
                  Your CSV file <strong>must</strong> have the headers in the exact order shown below. The first row is skipped as a header row.
                </p>

                <div className="overflow-x-auto border border-blue-200 rounded-lg bg-white">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-blue-100">
                      <tr>
                        <th className="px-3 py-2 border-r border-slate-100">Name <span className="text-red-500">*</span></th>
                        <th className="px-3 py-2 border-r border-slate-100">Class <span className="text-red-500">*</span></th>
                        <th className="px-3 py-2 border-r border-slate-100">Gender</th>
                        <th className="px-3 py-2 border-r border-slate-100">Parent Name</th>
                        <th className="px-3 py-2 border-r border-slate-100">Parent Phone</th>
                        <th className="px-3 py-2">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-600">
                      <tr className="border-b border-slate-50">
                        <td className="px-3 py-2 border-r border-slate-50">John Doe</td>
                        <td className="px-3 py-2 border-r border-slate-50">JHS 1</td>
                        <td className="px-3 py-2 border-r border-slate-50">Male</td>
                        <td className="px-3 py-2 border-r border-slate-50">Mary Doe</td>
                        <td className="px-3 py-2 border-r border-slate-50">0541234567</td>
                        <td className="px-3 py-2">0</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 border-r border-slate-50">Jane Smith</td>
                        <td className="px-3 py-2 border-r border-slate-50">Class 6</td>
                        <td className="px-3 py-2 border-r border-slate-50">Female</td>
                        <td className="px-3 py-2 border-r border-slate-50">Peter Smith</td>
                        <td className="px-3 py-2 border-r border-slate-50">0209876543</td>
                        <td className="px-3 py-2">150.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-4">
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center hover:border-primary-500 hover:bg-primary-50/50 transition-all cursor-pointer group relative">
                  <UploadCloud className="h-10 w-10 text-slate-400 group-hover:text-primary-500 mb-2 transition-colors" />
                  <p className="text-sm font-medium text-slate-700 group-hover:text-primary-700">Click to upload CSV file</p>
                  <p className="text-xs text-slate-400 mt-1">or drag and drop here</p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImportCSV(file);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>

                {importProgress && (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-2">
                      <span>{importProgress.status}</span>
                      <span>{Math.round((importProgress.current / (importProgress.total || 1)) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-600 transition-all duration-300 ease-out"
                        style={{ width: `${(importProgress.current / (importProgress.total || 1)) * 100}%` }}
                      ></div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 text-center">Processing record {importProgress.current} of {importProgress.total}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-white hover:shadow-sm rounded-lg transition-all border border-transparent hover:border-slate-200">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Sub-components (Modals) ---
// Note: In a real refactor, these should be separate files. Keeping here for context.

const AddStudentModal = ({ isOpen, onClose, onSave, classes, isSubmitting, hasFeesModule }: any) => {
  const [formData, setFormData] = useState({
    name: '', class: classes[0]?.name || '', gender: 'Male', parentName: '', parentPhone: '', balance: '', dob: '', photoFile: null as File | null
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  useEffect(() => {
    if (classes.length > 0 && !formData.class) {
      setFormData(prev => ({ ...prev, class: classes[0].name }));
    }
  }, [classes]);

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Add New Student</h2>
            <p className="text-slate-500 text-sm">Enter the student's information to create a new record.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Section 1: Identity */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
              <User className="h-4 w-4 text-primary-600" /> Student Identity
            </h3>
            <div className="flex flex-col sm:flex-row gap-6">
              {/* Photo Upload */}
              <div className="flex flex-col items-center space-y-2">
                <div className="relative group">
                  <div className="h-28 w-28 rounded-full bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden hover:border-primary-500 transition-colors">
                    {formData.photoFile ? (
                      <img src={URL.createObjectURL(formData.photoFile)} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                      <Camera className="h-8 w-8 text-slate-300 group-hover:text-primary-500 transition-colors" />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={e => {
                      if (e.target.files?.[0]) setFormData({ ...formData, photoFile: e.target.files[0] });
                    }}
                  />
                  <div className="absolute bottom-0 right-0 bg-primary-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white">
                    <Edit className="h-3 w-3" />
                  </div>
                </div>
                <p className="text-xs text-slate-400 font-medium text-center">Tap to upload photo</p>
              </div>

              {/* Bio Fields */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name <span className="text-red-500">*</span></label>
                  <input
                    required
                    type="text"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-sm font-medium"
                    placeholder="e.g. John Doe"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Class/Grade</label>
                  <div className="relative">
                    <select
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-sm appearance-none"
                      value={formData.class}
                      onChange={e => setFormData({ ...formData, class: e.target.value })}
                    >
                      {classes.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 rotate-90 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Gender</label>
                  <div className="relative">
                    <select
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-sm appearance-none"
                      value={formData.gender}
                      onChange={e => setFormData({ ...formData, gender: e.target.value as any })}
                    >
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                    <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 rotate-90 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date of Birth</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-sm text-slate-600"
                    value={formData.dob}
                    onChange={e => setFormData({ ...formData, dob: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Guardian */}
          <section>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Phone className="h-4 w-4 text-primary-600" /> Guardian Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Parent/Guardian Name <span className="text-red-500">*</span></label>
                <input
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-sm"
                  placeholder="e.g. Mary Doe"
                  value={formData.parentName}
                  onChange={e => setFormData({ ...formData, parentName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Phone Number <span className="text-red-500">*</span></label>
                <input
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-sm"
                  placeholder="e.g. 020 123 4567"
                  value={formData.parentPhone}
                  onChange={e => setFormData({ ...formData, parentPhone: e.target.value })}
                />
              </div>
            </div>
          </section>

          {/* Section 3: Financials */}
          {hasFeesModule && (
            <section>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2 flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary-600" /> Initial Data
              </h3>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Outstanding Balance (Optional)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">GHS</span>
                  <input
                    type="number"
                    className="w-full pl-14 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-sm font-mono"
                    placeholder="0.00"
                    value={formData.balance}
                    onChange={e => setFormData({ ...formData, balance: e.target.value })}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Leave empty to use default class fees.</p>
              </div>
            </section>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 shadow-sm shadow-primary-200 transition-all text-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Saving Use...</> : <><Plus className="h-4 w-4" /> Add Student</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditStudentModal = ({ isOpen, student, onClose, onSave, classes, isSubmitting, hasFeesModule }: any) => {
  const [formData, setFormData] = useState({
    name: student.name,
    class: student.class,
    gender: student.gender,
    parentName: student.parentName,
    parentPhone: student.parentPhone,
    balance: student.balance,
    dob: student.dob || '',
    admission_no: student.admission_no,
    pin: student.pin,
    photoFile: null as File | null
  });

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(formData); };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Edit Student</h2>
            <p className="text-sm text-slate-500">Update student information and settings.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="h-5 w-5 text-slate-500" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Section 1: Profile & Bio */}
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex flex-col items-center space-y-2">
              <div className="relative group">
                <div className="h-28 w-28 rounded-full bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden hover:border-primary-500 transition-colors">
                  {(formData.photoFile || student.photo_url) ? (
                    <img src={formData.photoFile ? URL.createObjectURL(formData.photoFile) : student.photo_url} className="w-full h-full object-cover" alt="Student" />
                  ) : <User className="h-8 w-8 text-slate-300" />}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={e => {
                    if (e.target.files?.[0]) setFormData({ ...formData, photoFile: e.target.files[0] });
                  }}
                />
                <div className="absolute bottom-0 right-0 bg-white text-primary-600 p-1.5 rounded-full shadow border border-slate-200 cursor-pointer">
                  <Camera className="h-3 w-3" />
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full Name</label>
                  <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-sm" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Class</label>
                  <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-sm" value={formData.class} onChange={e => setFormData({ ...formData, class: e.target.value })}>
                    {classes.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Gender</label>
                  <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-sm" value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value as any })}>
                    <option>Male</option><option>Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date of Birth</label>
                  <input type="date" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-sm text-slate-600" value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} />
                </div>
              </div>
            </div>
          </div>

          {/* Guardian */}
          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Guardian Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Parent Name</label>
                <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-sm" value={formData.parentName} onChange={e => setFormData({ ...formData, parentName: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Parent Phone</label>
                <input className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 outline-none transition-all text-sm" value={formData.parentPhone} onChange={e => setFormData({ ...formData, parentPhone: e.target.value })} />
              </div>
            </div>
          </div>

          {/* Admin Data */}
          <div className="pt-4 border-t border-slate-100 bg-slate-50 p-4 rounded-xl">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Lock className="h-3 w-3" /> System Generated Data</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Admission No.</label>
                <input readOnly className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg outline-none text-sm font-mono text-slate-500 cursor-not-allowed" value={formData.admission_no} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Login PIN</label>
                <input readOnly className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg outline-none text-sm font-mono text-slate-500 cursor-not-allowed" value={formData.pin} />
              </div>
              {hasFeesModule && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Current Balance</label>
                  <input readOnly type="number" className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg outline-none text-sm font-mono text-slate-500 cursor-not-allowed" value={formData.balance} />
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 font-medium text-sm transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium text-sm shadow-sm transition-colors">{isSubmitting ? 'Updating...' : 'Update Student'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const StudentProfileDrawer = ({ student, onClose, onEdit, hasFeesModule }: any) => {
  const { formatAmount } = useCurrency();
  const [showPin, setShowPin] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/40 z-[70] flex justify-end backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Cover / Header */}
        {/* Cover / Header */}
        <div className="relative h-40 bg-gradient-to-tr from-primary-700 via-primary-600 to-blue-500 overflow-hidden shrink-0">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay z-0"></div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/30 text-white rounded-full transition-colors backdrop-blur-md z-50 flex items-center justify-center"
            title="Close Profile"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Profile Content */}
        <div className="px-6 relative -mt-16 pb-10">
          {/* Avatar & Header Info */}
          <div className="flex flex-col items-center mb-6">
            <div className="h-32 w-32 rounded-full border-4 border-white shadow-xl bg-slate-100 flex items-center justify-center overflow-hidden mb-3">
              {student.photo_url ? (
                <img src={student.photo_url} className="w-full h-full object-cover" alt={student.name} />
              ) : (
                <span className="text-4xl font-bold text-slate-300">{student.name.charAt(0)}</span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-slate-800 text-center">{student.name}</h2>
            <div className="flex gap-2 items-center mt-1">
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-medium text-xs border border-slate-200">
                {student.class}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${student.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                }`}>
                {student.status || 'Active'}
              </span>
            </div>
          </div>

          {/* Quick Stats */}
          <div className={`grid ${hasFeesModule ? 'grid-cols-3' : 'grid-cols-2'} gap-3 mb-8`}>
            {hasFeesModule && (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Fee Balance</div>
                <div className={`font-bold text-sm sm:text-base ${student.balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {formatAmount(student.balance)}
                </div>
              </div>
            )}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Gender</div>
              <div className="font-bold text-slate-700 text-sm sm:text-base">{student.gender}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-center">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Attendance</div>
              <div className="font-bold text-slate-700 text-sm sm:text-base">{student.attendance || 100}%</div>
            </div>
          </div>

          <div className="space-y-6">

            {/* Credentials Card */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-5 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-10"><Shield className="h-16 w-16" /></div>
              <h4 className="flex items-center gap-2 font-bold mb-4 text-slate-200 text-sm tracking-wide">
                <Lock className="h-4 w-4" /> STUDENT CREDENTIALS
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
                <div>
                  <span className="block text-slate-400 text-xs mb-1">Admission Number</span>
                  <div className="font-mono text-lg font-bold tracking-wider flex items-center gap-2">
                    {student.admission_no}
                    <button className="text-slate-500 hover:text-white transition-colors" onClick={() => navigator.clipboard.writeText(student.admission_no || '')}><Copy className="h-3 w-3" /></button>
                  </div>
                </div>
                <div>
                  <span className="block text-slate-400 text-xs mb-1">Login PIN</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold tracking-wider">
                      {showPin ? student.pin : '••••'}
                    </span>
                    <button onClick={() => setShowPin(!showPin)} className="text-slate-400 hover:text-white transition-colors">
                      {showPin ? <Eye className="h-3 w-3" /> : <Eye className="h-3 w-3 off" />}
                    </button>
                  </div>
                </div>
                <div className="col-span-1 sm:col-span-2 pt-2 border-t border-slate-700/50">
                  <span className="block text-slate-500 text-[10px] uppercase tracking-wider mb-1">System ID</span>
                  <div className="font-mono text-xs text-slate-400 break-all select-all cursor-text">
                    {student.id}
                  </div>
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div className="border border-slate-100 rounded-xl p-5 shadow-sm">
              <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <User className="h-4 w-4 text-primary-500" /> Personal Information
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-50 last:border-0 last:pb-0">
                  <span className="text-slate-500 text-sm">Full Name</span>
                  <span className="font-medium text-slate-700 text-sm">{student.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50 last:border-0 last:pb-0">
                  <span className="text-slate-500 text-sm">Target Class</span>
                  <span className="font-medium text-slate-700 text-sm">{student.class}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50 last:border-0 last:pb-0">
                  <span className="text-slate-500 text-sm">Date of Birth</span>
                  <span className="font-medium text-slate-700 text-sm">{student.dob || 'Not Set'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50 last:border-0 last:pb-0">
                  <span className="text-slate-500 text-sm">Gender</span>
                  <span className="font-medium text-slate-700 text-sm">{student.gender}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-50 last:border-0 last:pb-0">
                  <span className="text-slate-500 text-sm">Account Status</span>
                  <span className={`font-bold text-sm ${student.status === 'Active' ? 'text-green-600' : 'text-red-500'}`}>{student.status || 'Active'}</span>
                </div>
              </div>
            </div>

            {/* Guardian Information */}
            <div className="border border-slate-100 rounded-xl p-5 shadow-sm">
              <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary-500" /> Guardian Details
              </h4>
              <div className="flex items-center gap-4 mb-4">
                <div className="h-10 w-10 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 font-bold">
                  {student.parentName.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-slate-700 text-sm">{student.parentName}</div>
                  <div className="text-slate-400 text-xs">Primary Guardian</div>
                </div>
                <a href={`tel:${student.parentPhone}`} className="ml-auto p-2 bg-green-50 text-green-600 rounded-full hover:bg-green-100 transition-colors">
                  <Phone className="h-4 w-4" />
                </a>
              </div>
              <div className="flex justify-between py-2 border-t border-slate-50">
                <span className="text-slate-500 text-sm">Contact Number</span>
                <span className="font-mono font-medium text-slate-700 text-sm">{student.parentPhone}</span>
              </div>
            </div>

            \n

            {/* Actions */}
            <div className="flex gap-3 sticky bottom-0 bg-white pt-4 pb-2 border-t border-slate-50 mt-4">
              <button
                onClick={onClose}
                className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                title="Close"
              >
                Close
              </button>
              <button
                onClick={onEdit}
                className="flex-1 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
              >
                <Edit className="h-4 w-4" /> Edit Profile
              </button>
              <button className="px-4 py-3 border border-red-200 text-red-600 bg-red-50 rounded-xl font-bold hover:bg-red-100 transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Students;