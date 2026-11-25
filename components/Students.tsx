import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Plus, FileSpreadsheet, Eye, Edit,
  X, User, Phone, CheckCircle, AlertCircle, ChevronLeft,
  ChevronRight, Download, DollarSign, Calendar, TrendingUp, Trash2,
  Table as TableIcon, LayoutList, Camera, UploadCloud, Lock,
  Mail, MapPin, Shield, Copy, GraduationCap, School, CreditCard,
  Users, RefreshCw, ArrowRight, Loader2, Check
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabaseClient';
import Loading from './Loading';
import { useCurrency } from '../contexts/CurrencyContext';
import { compressImage } from '../utils/imageCompression';
import { uploadToCloudinary } from '../utils/cloudinary';

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

const fetchStudents = async (schoolId: string, assignedClasses: string[] = []) => {
  // Projection: Avoid fetching heavy or sensitive columns like 'pin' in the main list unless needed
  let query = supabase
    .from('students')
    .select('id, name, class, gender, parent_name, parent_phone, balance, status, admission_no, photo_url, date_of_birth')
    .eq('school_id', schoolId)
    .limit(5000)
    .order('name', { ascending: true });

  if (assignedClasses.length > 0) {
    query = query.in('class', assignedClasses);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Critical: Failed to fetch students", error);
    throw error;
  }

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
    attendance: 100, // Mock
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
  const [importStep, setImportStep] = useState<'upload' | 'preview'>('upload');
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [classMappings, setClassMappings] = useState<Record<string, { targetClass: string; isNew: boolean }>>({});
  const [importFileName, setImportFileName] = useState('');
  const [isProcessingImport, setIsProcessingImport] = useState(false);
  const [balanceStrategy, setBalanceStrategy] = useState<'fee_structure' | 'zero'>('fee_structure');
  const [treatZeroAsEmpty, setTreatZeroAsEmpty] = useState(false);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);

  // Profile Drawer State
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const isTeacher = currentUser?.role === 'teacher';
  const schoolId = currentUser?.school_id;

  const { data: teacherClasses = [] } = useQuery({
    queryKey: ['teacherClasses', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id || currentUser.role !== 'teacher') return [];
      const { data: assignmentsData } = await supabase
        .from('teacher_assignments')
        .select('classes(name)')
        .eq('teacher_id', currentUser.id);

      const assigned = assignmentsData?.map((a: any) => {
        const cls = Array.isArray(a.classes) ? a.classes[0] : a.classes;
        return cls?.name;
      }).filter(Boolean) || [];
      if (assigned.length === 0 && currentUser.assignedClass) {
        assigned.push(currentUser.assignedClass);
      }
      return Array.from(new Set(assigned)) as string[];
    },
    enabled: !!currentUser?.id && isTeacher,
    staleTime: 60 * 1000
  });

  // --- Queries ---
  const { data: students = [], isLoading: isLoadingStudents, isError: isStudentError, refetch: refetchStudents } = useQuery({
    queryKey: ['students', schoolId, teacherClasses.length], 
    queryFn: () => fetchStudents(schoolId!, teacherClasses as string[]),
    enabled: !!schoolId && (!isTeacher || teacherClasses.length > 0 || !!currentUser?.assignedClass),
    staleTime: 10 * 60 * 1000,
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt * 1000, 5000)
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

  const hasFeesModule = true;
 
  // Helper to calculate total fees for a given class from fee_structure
  const calculateClassFee = (targetClassName: string) => {
    if (!feeStructure || feeStructure.length === 0) return 0;
    const normalizedTarget = targetClassName?.trim().toLowerCase();
    return feeStructure
      .filter((f: any) => {
        if (!f.target_class || f.target_class.trim() === '' || f.target_class.trim().toLowerCase() === 'all') {
          return true;
        }
        return f.target_class.trim().toLowerCase() === normalizedTarget;
      })
      .reduce((sum: number, f: any) => sum + Number(f.amount || 0), 0);
  };

  // Resolve starting balance for an imported student row
  const getInitialStudentBalance = (row: any, targetClassName: string) => {
    const hasExplicitBalance = row.balance !== null && !isNaN(row.balance);
    const isZero = hasExplicitBalance && Number(row.balance) === 0;

    if (isZero && treatZeroAsEmpty && balanceStrategy === 'fee_structure') {
      const fee = calculateClassFee(targetClassName);
      return { amount: fee, source: 'fee_structure' as const };
    }

    if (hasExplicitBalance) {
      return { amount: Number(row.balance), source: 'csv' as const };
    }

    if (balanceStrategy === 'fee_structure') {
      const fee = calculateClassFee(targetClassName);
      return { amount: fee, source: 'fee_structure' as const };
    }

    return { amount: 0, source: 'zero' as const };
  };

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
        parent_name: studentData.parentName || 'Parent',
        parent_phone: studentData.parentPhone || '',
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
          const photoUrl = await uploadToCloudinary(compressedFile, `${newStudentId}_${Date.now()}.jpg`);

          if (photoUrl) {
            await supabase
              .from('students')
              .update({ photo_url: photoUrl })
              .eq('id', newStudentId);
          }
        } catch (err) { console.error('Student photo upload failed:', err); }
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
        parent_name: updatedData.parentName || 'Parent',
        parent_phone: updatedData.parentPhone || '',
        date_of_birth: updatedData.dob || null,
        balance: Number(updatedData.balance),
        admission_no: updatedData.admission_no,
        pin: updatedData.pin
      };

      if (updatedData.photoFile) {
        try {
          const compressedFile = await compressImage(updatedData.photoFile);
          const photoUrl = await uploadToCloudinary(compressedFile, `${id}_${Date.now()}.jpg`);

          if (photoUrl) {
            updatePayload.photo_url = photoUrl;
          }
        } catch (err) { console.error('Student photo upload failed:', err); }
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

  // Download Sample CSV Template
  const handleDownloadTemplate = () => {
    const csvContent = "Name,Class,Gender,Parent Name,Parent Phone,Balance\nJohn Doe,Primary 1,Male,Mary Doe,0541234567,\nJane Smith,Primary 2,Female,Peter Smith,0209876543,150.00\nKwame Mensah,JHS 1,Male,,,0\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'orbit_students_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Quote-aware CSV Parser
  const parseCSVContent = (content: string) => {
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return [];

    const parseLine = (text: string): string[] => {
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
          if (inQuotes && text[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === ',' && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += c;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const parsed = lines.map(parseLine);
    const hasHeader = parsed[0][0]?.toLowerCase().includes('name') || parsed[0][1]?.toLowerCase().includes('class');
    const dataRows = hasHeader ? parsed.slice(1) : parsed;
    return dataRows;
  };

  // Step 1: Read and analyze uploaded CSV
  const handleFileSelected = (file: File) => {
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      const rawRows = parseCSVContent(text);
      if (rawRows.length === 0) {
        alert('No data rows found in this CSV file. Please ensure it contains student records.');
        return;
      }

      // Filter rows that have at least a Name
      const validRows = rawRows
        .filter(r => r[0] && r[0].trim().length > 0)
        .map(r => ({
          name: r[0]?.trim() || '',
          rawClass: r[1]?.trim() || 'Unassigned',
          gender: (r[2]?.trim().toLowerCase() === 'female' ? 'Female' : 'Male'),
          parentName: r[3]?.trim() || '',
          parentPhone: r[4]?.trim() || '',
          balance: r[5] && r[5].trim() !== '' ? Number(r[5].trim()) : null
        }));

      if (validRows.length === 0) {
        alert('Could not find valid student names in the uploaded CSV.');
        return;
      }

      // Collect unique classes from the CSV
      const uniqueCsvClasses = Array.from(new Set(validRows.map(r => r.rawClass))).filter(Boolean);

      // Existing classes in school
      const schoolClassNames = (classes || []).map((c: any) => c.name);

      // Auto-match or detect new
      const initialMappings: Record<string, { targetClass: string; isNew: boolean }> = {};
      uniqueCsvClasses.forEach(rawC => {
        // Try case-insensitive exact match
        const exactMatch = schoolClassNames.find(sc => sc.trim().toLowerCase() === rawC.trim().toLowerCase());
        if (exactMatch) {
          initialMappings[rawC] = { targetClass: exactMatch, isNew: false };
        } else {
          // If no exact match, default to creating it as new class with the exact CSV name
          initialMappings[rawC] = { targetClass: rawC, isNew: true };
        }
      });

      setParsedRows(validRows);
      setClassMappings(initialMappings);
      setImportStep('preview');
    };
    reader.readAsText(file);
  };

  // Step 2: Confirm & Execute Import
  const handleConfirmImport = async () => {
    if (parsedRows.length === 0 || !schoolId) return;
    setIsProcessingImport(true);
    setImportProgress({ current: 0, total: parsedRows.length, status: 'Setting up classes...' });

    try {
      // 1. Identify which classes need to be created
      const classesToCreate = new Set<string>();
      Object.entries(classMappings).forEach(([_, mapping]) => {
        if (mapping.isNew && mapping.targetClass.trim()) {
          classesToCreate.add(mapping.targetClass.trim());
        }
      });

      // Insert new classes if any
      if (classesToCreate.size > 0) {
        const { data: existingInDb } = await supabase
          .from('classes')
          .select('name')
          .eq('school_id', schoolId);
        const existingNamesLower = new Set(existingInDb?.map(c => c.name.trim().toLowerCase()) || []);
        
        const newClassRows = Array.from(classesToCreate)
          .filter(name => !existingNamesLower.has(name.toLowerCase()))
          .map(name => ({ school_id: schoolId, name }));

        if (newClassRows.length > 0) {
          await supabase.from('classes').insert(newClassRows);
          queryClient.invalidateQueries({ queryKey: ['classes', schoolId] });
        }
      }

      // 2. Fetch existing students to detect updates vs new inserts
      setImportProgress({ current: 0, total: parsedRows.length, status: 'Checking existing students...' });
      const { data: existingStudents } = await supabase
        .from('students')
        .select('id, name')
        .eq('school_id', schoolId);

      const studentMap = new Map();
      existingStudents?.forEach(s => studentMap.set(s.name.trim().toLowerCase(), s.id));

      // 3. Prepare student payloads
      const studentsToInsert: any[] = [];
      const studentsToUpdate: any[] = [];
      const seenInBatch = new Set<string>();

      for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        const key = row.name.toLowerCase();
        if (seenInBatch.has(key)) continue;
        seenInBatch.add(key);

        const targetClass = classMappings[row.rawClass]?.targetClass || row.rawClass;
        const existingId = studentMap.get(key);
        const initialBalanceInfo = getInitialStudentBalance(row, targetClass);

        const payload: any = {
          school_id: schoolId,
          name: row.name,
          class: targetClass,
          gender: row.gender,
          parent_name: row.parentName || 'Parent',
          parent_phone: row.parentPhone || '',
          status: 'Active',
          admission_no: `${new Date().getFullYear()}${(targetClass || 'G').replace(/[^a-zA-Z0-9]/g, '').substring(0, 2).toUpperCase()}${(Date.now() + i).toString().slice(-4)}${Math.floor(Math.random() * 99).toString().padStart(2, '0')}`,
          pin: `${Math.floor(Math.random() * 9000 + 1000)}`
        };

        if (existingId) {
          payload.id = existingId;
          if (row.balance !== null && !isNaN(row.balance)) {
            payload.balance = initialBalanceInfo.amount;
          }
          studentsToUpdate.push(payload);
        } else {
          payload.balance = initialBalanceInfo.amount;
          studentsToInsert.push(payload);
        }
      }

      // 4. Execute chunked operations
      const chunkSize = 25;
      let processed = 0;
      const totalOps = studentsToUpdate.length + studentsToInsert.length;

      if (studentsToUpdate.length > 0) {
        setImportProgress({ current: processed, total: totalOps, status: 'Updating matching students...' });
        for (let i = 0; i < studentsToUpdate.length; i += chunkSize) {
          const { error: updateError } = await supabase.from('students').upsert(studentsToUpdate.slice(i, i + chunkSize));
          if (updateError) {
            console.error('Update error:', updateError);
            throw new Error(`Failed to update students: ${updateError.message}`);
          }
          processed += Math.min(chunkSize, studentsToUpdate.length - i);
          setImportProgress(p => ({ ...p!, current: processed }));
        }
      }

      if (studentsToInsert.length > 0) {
        setImportProgress({ current: processed, total: totalOps, status: 'Registering new students...' });
        for (let i = 0; i < studentsToInsert.length; i += chunkSize) {
          const { error: insertError } = await supabase.from('students').insert(studentsToInsert.slice(i, i + chunkSize));
          if (insertError) {
            console.error('Insert error:', insertError);
            throw new Error(`Failed to enroll students: ${insertError.message}`);
          }
          processed += Math.min(chunkSize, studentsToInsert.length - i);
          setImportProgress(p => ({ ...p!, current: processed }));
        }
      }

      // 5. Invalidate & Wrap up
      queryClient.invalidateQueries({ queryKey: ['students', schoolId] });
      queryClient.invalidateQueries({ queryKey: ['classes', schoolId] });
      setIsImportModalOpen(false);
      setImportStep('upload');
      setParsedRows([]);
      setClassMappings({});
      alert(`Success! Successfully processed ${totalOps} students (${studentsToInsert.length} enrolled, ${studentsToUpdate.length} updated).`);
    } catch (err: any) {
      console.error('CSV import failed:', err);
      alert(`Import failed: ${err.message || 'Unknown error occurred.'}`);
    } finally {
      setIsProcessingImport(false);
      setImportProgress(null);
    }
  };


  // --- Filtering & Pagination ---
  const filteredStudents = students.filter(s => {
    const matchesSearch = (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.admission_no || '').toLowerCase().includes(searchQuery.toLowerCase());
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
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-[400px]">
        {isStudentError ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Failed to load students</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
              Our servers are currently experiencing high traffic. Please try again in a few moments.
            </p>
            <button
              onClick={() => refetchStudents()}
              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-slate-200"
            >
              <RefreshCw className="h-4 w-4" /> Retry Fetching
            </button>
          </div>
        ) : (
          <>
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
          </>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
              <div>
                <h3 className="text-xl font-bold text-slate-800">
                  {importStep === 'upload' ? 'Import Students' : 'Review & Class Mapping'}
                </h3>
                <p className="text-slate-500 text-sm">
                  {importStep === 'upload'
                    ? 'Bulk add students by uploading a CSV file.'
                    : `${importFileName} • ${parsedRows.length} student records found`}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportStep('upload');
                  setParsedRows([]);
                  setClassMappings({});
                  setImportProgress(null);
                }}
                disabled={isProcessingImport}
                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {importStep === 'upload' ? (
                <>
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-3">
                      <h4 className="text-blue-900 font-bold text-sm flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4 text-blue-600" /> Required CSV Format
                      </h4>
                      <button
                        onClick={handleDownloadTemplate}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-200 text-blue-700 hover:bg-blue-100/60 rounded-lg text-xs font-bold transition-all shadow-xs shrink-0"
                      >
                        <Download className="h-3.5 w-3.5" /> Download Sample Template
                      </button>
                    </div>

                    <p className="text-blue-700 text-xs mb-3 leading-relaxed">
                      Your CSV file must have the column headers in the exact order below. 
                      <span className="font-bold"> Guardian details and Gender are optional. Balance can be left blank to automatically apply class term fees.</span>
                    </p>

                    <div className="overflow-x-auto border border-blue-200/80 rounded-lg bg-white shadow-xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-blue-100">
                          <tr>
                            <th className="px-3 py-2 border-r border-slate-100">Name <span className="text-red-500">*</span></th>
                            <th className="px-3 py-2 border-r border-slate-100">Class <span className="text-red-500">*</span></th>
                            <th className="px-3 py-2 border-r border-slate-100">Gender</th>
                            <th className="px-3 py-2 border-r border-slate-100">Parent Name <span className="text-slate-400 font-normal">(Opt)</span></th>
                            <th className="px-3 py-2 border-r border-slate-100">Parent Phone <span className="text-slate-400 font-normal">(Opt)</span></th>
                            <th className="px-3 py-2">Balance <span className="text-slate-400 font-normal">(Opt)</span></th>
                          </tr>
                        </thead>
                        <tbody className="text-slate-600">
                          <tr className="border-b border-slate-50">
                            <td className="px-3 py-2 border-r border-slate-50 font-medium">Kofi Mensah</td>
                            <td className="px-3 py-2 border-r border-slate-50">Primary 1</td>
                            <td className="px-3 py-2 border-r border-slate-50">Male</td>
                            <td className="px-3 py-2 border-r border-slate-50">Kwame Mensah</td>
                            <td className="px-3 py-2 border-r border-slate-50">0244123456</td>
                            <td className="px-3 py-2 text-slate-400 italic font-normal">(Blank for Class Fees)</td>
                          </tr>
                          <tr>
                            <td className="px-3 py-2 border-r border-slate-50 font-medium">Ama Serwaa</td>
                            <td className="px-3 py-2 border-r border-slate-50">Primary 2</td>
                            <td className="px-3 py-2 border-r border-slate-50">Female</td>
                            <td className="px-3 py-2 border-r border-slate-50 text-slate-400 italic">Optional</td>
                            <td className="px-3 py-2 border-r border-slate-50 text-slate-400 italic">Optional</td>
                            <td className="px-3 py-2">150.00</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center hover:border-primary-500 hover:bg-primary-50/50 transition-all cursor-pointer group relative">
                    <UploadCloud className="h-10 w-10 text-slate-400 group-hover:text-primary-500 mb-2 transition-colors" />
                    <p className="text-sm font-medium text-slate-700 group-hover:text-primary-700">Click to upload CSV file</p>
                    <p className="text-xs text-slate-400 mt-1">or drag and drop here</p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelected(file);
                        e.target.value = '';
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Step 2: Class Mapping Review */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">Class Assignment & Matching</h4>
                        <p className="text-xs text-slate-500">
                          Verify which school class each CSV class connects to. You can map to existing classes or auto-create new ones.
                        </p>
                      </div>
                      <span className="text-xs font-black bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
                        {Object.keys(classMappings).length} Classes Found
                      </span>
                    </div>

                    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                      {Object.entries(classMappings).map(([rawClass, mapping]) => {
                        const studentCountInClass = parsedRows.filter(r => r.rawClass === rawClass).length;
                        return (
                          <div key={rawClass} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border border-slate-200 rounded-xl gap-2 shadow-2xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-bold text-slate-800 text-sm truncate">{rawClass}</span>
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold shrink-0">
                                {studentCountInClass} student{studentCountInClass === 1 ? '' : 's'}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 text-xs font-bold shrink-0">assigns to</span>
                              <select
                                value={mapping.isNew ? '__CREATE_NEW__' : mapping.targetClass}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === '__CREATE_NEW__') {
                                    setClassMappings(prev => ({
                                      ...prev,
                                      [rawClass]: { targetClass: rawClass, isNew: true }
                                    }));
                                  } else {
                                    setClassMappings(prev => ({
                                      ...prev,
                                      [rawClass]: { targetClass: val, isNew: false }
                                    }));
                                  }
                                }}
                                className="p-2 text-xs font-bold border border-slate-300 rounded-lg bg-white outline-none focus:ring-2 focus:ring-primary-500 min-w-[200px]"
                              >
                                <option value="__CREATE_NEW__">+ Create New Class: "{rawClass}"</option>
                                <optgroup label="Existing School Classes">
                                  {classes.map((c: any) => (
                                    <option key={c.id} value={c.name}>{c.name}</option>
                                  ))}
                                </optgroup>
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Fee & Balance Strategy */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">Fee & Starting Balance Strategy</h4>
                        <p className="text-xs text-slate-500">
                          Configure how blank or zero balances in the CSV should be billed on enrollment.
                        </p>
                      </div>
                      {feeStructure.length > 0 ? (
                        <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                          ✓ Fee Structure Active ({feeStructure.length} items)
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                          No Fees Set Up Yet (Defaults to 0.00)
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        balanceStrategy === 'fee_structure'
                          ? 'bg-white border-primary-600 shadow-2xs ring-1 ring-primary-500/20'
                          : 'bg-white/60 border-slate-200 hover:bg-white'
                      }`}>
                        <input
                          type="radio"
                          name="balanceStrategy"
                          checked={balanceStrategy === 'fee_structure'}
                          onChange={() => setBalanceStrategy('fee_structure')}
                          className="mt-0.5 text-primary-600 focus:ring-primary-500"
                        />
                        <div className="text-xs">
                          <p className="font-bold text-slate-800">Auto-apply Class Fee Structure</p>
                          <p className="text-slate-500 mt-0.5">
                            Blank balance cells will be billed the full term fee configured for their class.
                          </p>
                        </div>
                      </label>

                      <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        balanceStrategy === 'zero'
                          ? 'bg-white border-primary-600 shadow-2xs ring-1 ring-primary-500/20'
                          : 'bg-white/60 border-slate-200 hover:bg-white'
                      }`}>
                        <input
                          type="radio"
                          name="balanceStrategy"
                          checked={balanceStrategy === 'zero'}
                          onChange={() => setBalanceStrategy('zero')}
                          className="mt-0.5 text-primary-600 focus:ring-primary-500"
                        />
                        <div className="text-xs">
                          <p className="font-bold text-slate-800">Clean Slate (GH₵ 0.00)</p>
                          <p className="text-slate-500 mt-0.5">
                            Blank balance cells will start at 0.00 (fees marked cleared).
                          </p>
                        </div>
                      </label>
                    </div>

                    {balanceStrategy === 'fee_structure' && (
                      <div className="mt-3 pt-3 border-t border-slate-200/80">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={treatZeroAsEmpty}
                            onChange={(e) => setTreatZeroAsEmpty(e.target.checked)}
                            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500 h-3.5 w-3.5"
                          />
                          <span>Also apply class fee structure if CSV balance explicitly has <strong>0</strong> or <strong>0.00</strong></span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Student Data Preview */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-bold text-slate-800 text-sm">
                        Preview Records <span className="text-slate-400 font-normal text-xs">(First {Math.min(5, parsedRows.length)} of {parsedRows.length})</span>
                      </h4>
                      <span className="text-xs text-slate-500 font-medium">Ready for import</span>
                    </div>

                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="px-3 py-2.5">#</th>
                            <th className="px-3 py-2.5">Name</th>
                            <th className="px-3 py-2.5">Target Class</th>
                            <th className="px-3 py-2.5">Gender</th>
                            <th className="px-3 py-2.5">Guardian Details</th>
                            <th className="px-3 py-2.5 text-right">CSV Balance</th>
                            <th className="px-3 py-2.5 text-right">Starting Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {parsedRows.slice(0, 5).map((row, idx) => {
                            const mappedClass = classMappings[row.rawClass]?.targetClass || row.rawClass;
                            const balanceInfo = getInitialStudentBalance(row, mappedClass);
                            return (
                              <tr key={idx} className="hover:bg-slate-50/60">
                                <td className="px-3 py-2 text-slate-400 font-medium">{idx + 1}</td>
                                <td className="px-3 py-2 font-bold text-slate-900">{row.name}</td>
                                <td className="px-3 py-2">
                                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-100">
                                    {mappedClass}
                                  </span>
                                </td>
                                <td className="px-3 py-2">{row.gender}</td>
                                <td className="px-3 py-2 text-slate-500">
                                  {row.parentName || row.parentPhone ? (
                                    <span>{row.parentName || 'Parent'} {row.parentPhone ? `(${row.parentPhone})` : ''}</span>
                                  ) : (
                                    <span className="text-slate-400 italic">None (Optional)</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-500 font-medium">
                                  {row.balance !== null ? formatAmount(row.balance) : <span className="text-slate-400 italic">Blank</span>}
                                </td>
                                <td className="px-3 py-2 text-right font-bold">
                                  <div className="inline-flex items-center justify-end gap-1.5">
                                    <span className={balanceInfo.amount > 0 ? 'text-slate-900' : 'text-slate-500'}>
                                      {formatAmount(balanceInfo.amount)}
                                    </span>
                                    {balanceInfo.source === 'fee_structure' && (
                                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded border border-emerald-200">
                                        Fee Plan
                                      </span>
                                    )}
                                    {balanceInfo.source === 'csv' && (
                                      <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-200">
                                        From CSV
                                      </span>
                                    )}
                                    {balanceInfo.source === 'zero' && (
                                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded">
                                        0.00
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {importProgress && (
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                      <div className="flex justify-between text-xs font-bold text-slate-700 mb-2">
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-600" />
                          {importProgress.status}
                        </span>
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
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              {importStep === 'preview' ? (
                <button
                  onClick={() => setImportStep('upload')}
                  disabled={isProcessingImport}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-lg transition-all disabled:opacity-50"
                >
                  ← Change File
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportStep('upload');
                    setParsedRows([]);
                    setClassMappings({});
                    setImportProgress(null);
                  }}
                  disabled={isProcessingImport}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-white hover:shadow-xs rounded-lg transition-all border border-transparent hover:border-slate-200 disabled:opacity-50"
                >
                  Cancel
                </button>

                {importStep === 'preview' && (
                  <button
                    onClick={handleConfirmImport}
                    disabled={isProcessingImport || parsedRows.length === 0}
                    className="px-5 py-2 text-xs font-black uppercase tracking-wider bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isProcessingImport ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5 stroke-[3px]" />
                        Confirm & Import ({parsedRows.length})
                      </>
                    )}
                  </button>
                )}
              </div>
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