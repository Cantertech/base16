import React, { useState, useEffect } from 'react';
import {
  Search, Filter, Plus, FileSpreadsheet, Eye, Edit,
  X, User, Phone, CheckCircle, AlertCircle, ChevronLeft,
  ChevronRight, Download, DollarSign, Calendar, TrendingUp, Trash2,
  Table as TableIcon, LayoutList
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import Loading from './Loading';
import { useCurrency } from '../contexts/CurrencyContext';
import { getCachedData, setCachedData, clearCache } from '../utils/cache';

const CACHE_KEY_STUDENTS = 'orbit_students_data';
const CACHE_KEY_CLASSES = 'orbit_classes_data';

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
}

interface Transaction {
  id: string;
  studentId: string;
  date: string;
  amount: number;
  type: string;
}

interface StudentsProps {
  currentUser?: {
    id: string;
    role: 'admin' | 'teacher';
    assignedClass?: string | null;
    school_id?: string;
  };
}

// --- Main Component ---
const Students: React.FC<StudentsProps> = ({ currentUser }) => {
  const { formatAmount, currency } = useCurrency();
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('All');
  const [classes, setClasses] = useState<any[]>([]);
  const [feeStructure, setFeeStructure] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [teacherClasses, setTeacherClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<'card' | 'table'>('card');

  // Bulk Selection & Import Progress State
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

  // Load Data
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);

      // Check Cache First
      const cachedStudents = getCachedData<Student[]>(CACHE_KEY_STUDENTS);
      const cachedClasses = getCachedData<any[]>(CACHE_KEY_CLASSES);

      if (cachedStudents && cachedClasses && !isTeacher) { // Simplified cache check for non-teacher
        setStudents(cachedStudents);
        setClasses(cachedClasses);
        setLoading(false);
        // Optional: Background refresh
        fetchStudents(true);
        fetchClasses(true);
      } else {
        await Promise.all([fetchStudents(), fetchClasses()]);
        setLoading(false);
      }
    };
    loadAll();
  }, [currentUser, isTeacher]);

  const fetchClasses = async (background = false) => {
    try {
      if (!background) {
        const cached = getCachedData<any[]>(CACHE_KEY_CLASSES);
        if (cached) {
          setClasses(cached);
          // Verify with background refresh if needed, but for now just return
          // Actually, the useEffect above handles the "check cache first" logic.
          // This function is called by the useEffect if cache hits, or directly.
          // Let's rely on standard fetch unless background is requested.
        }
      }

      const { data } = await supabase
        .from('classes')
        .select('*')
        .order('name', { ascending: true });

      if (data) {
        setClasses(data);
        setCachedData(CACHE_KEY_CLASSES, data);
      } else {
        // Fallback to cache if request fails but we have data?
        // Usually handled by initial load logic, but if explicit refresh:
        const cached = getCachedData<any[]>(CACHE_KEY_CLASSES);
        if (cached) setClasses(cached);
      }

      // Fetch Fee Structure
      const { data: feesData } = await supabase
        .from('fee_structure')
        .select('*');

      if (feesData) {
        setFeeStructure(feesData);
      }
    } catch (error) {
      console.error('Error fetching classes/fees:', error);
    }
  };

  const fetchStudents = async (background = false) => {
    try {
      if (!background && !isTeacher) {
        const cached = getCachedData<Student[]>(CACHE_KEY_STUDENTS);
        if (cached) {
          setStudents(cached);
          // We can return here if we trust the cache fully, preventing double network request
          // OR we can continue to fetch in background.
          // Given the user complained about "dataload again", they want NO loading.
          // So if we have cache, we set it. The network request below updates it.
        }
      }
      let query = supabase
        .from('students')
        .select('*')
        .eq('school_id', currentUser?.school_id)
        .order('created_at', { ascending: false });

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
          setTeacherClasses(assignedClassNames);
          // Set filter to first class by default if not set
          if (classFilter === 'All') setClassFilter(assignedClassNames[0]);
        } else {
          // No classes assigned -> show none?
          query = query.eq('id', '00000000-0000-0000-0000-000000000000'); // Return nothing
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        const mappedStudents: Student[] = data.map((s: any) => ({
          id: s.id,
          name: s.name,
          class: s.class,
          gender: s.gender,
          parentName: s.parent_name,
          parentPhone: s.parent_phone,
          balance: s.balance,
          dob: s.date_of_birth,
          status: s.status,
          attendance: 100 // Mock for now
        }));
        setStudents(mappedStudents);
        if (!isTeacher) {
          setCachedData(CACHE_KEY_STUDENTS, mappedStudents);
        }
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  // --- Actions ---
  const handleAddStudent = async (studentData: any) => {
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

      const newStudent = {
        school_id: targetSchoolId,
        name: studentData.name,
        class: studentData.class,
        gender: studentData.gender,
        parent_name: studentData.parentName,
        parent_phone: studentData.parentPhone,
        date_of_birth: studentData.dob || null,
        status: 'Active',
        balance: Number(studentData.balance) || 0
      };

      const { error } = await supabase
        .from('students')
        .insert([newStudent]);

      if (error) throw error;

      fetchStudents();
      clearCache(CACHE_KEY_STUDENTS); // Force refresh next time or ensure fetchStudents updates cache
      setIsAddModalOpen(false);
      alert('Student added successfully!');

    } catch (error: any) {
      console.error('Error adding student:', error);
      alert(`Failed to add student: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditStudent = async (id: string, updatedData: any) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('students')
        .update({
          name: updatedData.name,
          class: updatedData.class,
          gender: updatedData.gender,
          parent_name: updatedData.parentName,
          parent_phone: updatedData.parentPhone,
          date_of_birth: updatedData.dob || null,
          balance: Number(updatedData.balance)
        })
        .eq('id', id);

      if (error) throw error;

      fetchStudents();
      clearCache(CACHE_KEY_STUDENTS);
      setIsEditModalOpen(false);
      setStudentToEdit(null);
      alert('Student updated successfully!');
    } catch (error: any) {
      console.error('Error updating student:', error);
      alert(`Failed to update student: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Bulk Selection Handlers ---
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

  const handleBulkDelete = async () => {
    if (selectedStudents.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedStudents.size} students? This action cannot be undone.`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('students')
        .delete()
        .in('id', Array.from(selectedStudents));

      if (error) throw error;

      alert('Students deleted successfully.');
      setSelectedStudents(new Set());
      fetchStudents();
      clearCache(CACHE_KEY_STUDENTS);
    } catch (error: any) {
      console.error('Error deleting students:', error);
      alert(`Failed to delete students: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImportCSV = async (file: File) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setImportProgress({ current: 0, total: 0, status: 'Reading file...' });

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

      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target?.result as string;
        if (!text) return;

        const lines = text.split('\n');
        const csvClasses = new Set<string>();

        // Simple header check
        const startIndex = lines[0].toLowerCase().includes('name') ? 1 : 0;

        setImportProgress({ current: 0, total: lines.length - startIndex, status: 'Fetching existing data...' });

        // 1. Fetch existing students for duplicate checking (Smart Upsert by NAME only)
        // We match by Name to allow updating Class and other details.
        const { data: existingStudents } = await supabase
          .from('students')
          .select('id, name')
          .eq('school_id', targetSchoolId);

        const studentMap = new Map();
        if (existingStudents) {
          existingStudents.forEach(s => {
            // Create a unique key based on Name only (normalized)
            const key = s.name.trim().toLowerCase();
            studentMap.set(key, s.id);
          });
        }

        // 2. Parse CSV and collect data
        const parsedLines = [];
        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const parts = line.split(',');
          if (parts.length >= 2) { // Need at least Name and Class
            parsedLines.push(parts);
            const className = parts[1]?.trim();
            if (className) csvClasses.add(className);
          }
        }

        // 3. Check and Create Missing Classes
        if (csvClasses.size > 0) {
          setImportProgress({ current: 0, total: parsedLines.length, status: 'Checking classes...' });
          const { data: existingClasses } = await supabase
            .from('classes')
            .select('name')
            .eq('school_id', targetSchoolId);

          const existingClassNames = new Set(existingClasses?.map(c => c.name) || []);
          const classesToCreate = Array.from(csvClasses).filter(c => !existingClassNames.has(c));

          if (classesToCreate.length > 0) {
            const newClassesPayload = classesToCreate.map(name => ({
              school_id: targetSchoolId,
              name: name
            }));

            await supabase.from('classes').insert(newClassesPayload);
            await fetchClasses(); // Refresh classes
            clearCache(CACHE_KEY_CLASSES);
          }
        }

        // 4. Prepare Student Data for Upsert
        let updateCount = 0;
        let insertCount = 0;
        const total = parsedLines.length;

        setImportProgress({ current: 0, total: total, status: 'Preparing data...' });

        const studentsToUpdate: any[] = [];
        const studentsToInsert: any[] = [];
        const seenInBatch = new Set<string>();

        for (let i = 0; i < total; i++) {
          const parts = parsedLines[i];
          // Expected: Name, Class, Gender, Parent Name, Parent Phone, Balance(Optional)
          if (parts.length >= 2) {
            const name = parts[0]?.trim();
            const studentClass = parts[1]?.trim();

            if (!name || !studentClass) continue;

            const key = name.toLowerCase(); // Match by Name only

            // Prevent duplicates within the same file upload
            if (seenInBatch.has(key)) continue;
            seenInBatch.add(key);

            const existingId = studentMap.get(key);

            // Calculate default balance from fee structure if not provided in CSV
            let initialBalance = 0;
            if (parts[5] && parts[5].trim() !== '') {
              initialBalance = Number(parts[5].trim());
            } else if (!existingId) {
              // Only calculate default balance for NEW students
              initialBalance = feeStructure
                .filter(f => !f.target_class || f.target_class === 'All' || f.target_class === studentClass)
                .reduce((sum, f) => sum + Number(f.amount), 0);
            }

            const studentPayload: any = {
              school_id: targetSchoolId,
              name: name,
              class: studentClass,
              gender: (parts[2]?.trim().toLowerCase() === 'female' ? 'Female' : 'Male'),
              parent_name: parts[3]?.trim() || 'Parent',
              parent_phone: parts[4]?.trim(),
              status: 'Active'
            };

            // Only update balance if it was explicitly provided in CSV, otherwise keep existing or set default for new
            if (parts[5] && parts[5].trim() !== '') {
              studentPayload.balance = initialBalance;
            } else if (!existingId) {
              studentPayload.balance = initialBalance;
            }

            if (existingId) {
              studentPayload.id = existingId; // Add ID to trigger update
              studentsToUpdate.push(studentPayload);
              updateCount++;
            } else {
              studentsToInsert.push(studentPayload);
              insertCount++;
            }
          }
        }

        // 5. Execute Updates and Inserts
        const chunkSize = 20; // Reduced to prevent server timeout
        let processed = 0;

        // Handle Updates
        if (studentsToUpdate.length > 0) {
          setImportProgress({ current: processed, total: total, status: `Updating ${studentsToUpdate.length} existing students...` });
          for (let i = 0; i < studentsToUpdate.length; i += chunkSize) {
            const chunk = studentsToUpdate.slice(i, i + chunkSize);
            const { error } = await supabase
              .from('students')
              .upsert(chunk); // upsert is fine here because all have IDs

            if (error) throw error;
            processed += chunk.length;
            setImportProgress({
              current: processed,
              total: total,
              status: `Updated ${Math.min(processed, studentsToUpdate.length)} of ${studentsToUpdate.length} existing...`
            });
          }
        }

        // Handle Inserts
        if (studentsToInsert.length > 0) {
          setImportProgress({ current: processed, total: total, status: `Inserting ${studentsToInsert.length} new students...` });
          for (let i = 0; i < studentsToInsert.length; i += chunkSize) {
            const chunk = studentsToInsert.slice(i, i + chunkSize);
            const { error } = await supabase
              .from('students')
              .insert(chunk); // insert strictly for new records

            if (error) throw error;
            processed += chunk.length;
            setImportProgress({
              current: processed,
              total: total,
              status: `Inserted ${Math.min(processed - studentsToUpdate.length, studentsToInsert.length)} of ${studentsToInsert.length} new...`
            });
          }
        }

        fetchStudents();
        clearCache(CACHE_KEY_STUDENTS);
        setIsImportModalOpen(false);
        alert(`Import successful!\nUpdated: ${updateCount} students\nInserted: ${insertCount} students`);
      };

      reader.readAsText(file);

    } catch (error: any) {
      console.error('Import error:', error);
      alert(`Import failed: ${error.message}`);
    } finally {
      setIsSubmitting(false);
      setImportProgress(null);
    }
  };

  // --- Filtering ---
  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesClass = classFilter === 'All' || s.class === classFilter;
    return matchesSearch && matchesClass;
  });

  // --- Pagination ---
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
            {!isTeacher && (
              <div className="relative min-w-[120px]">
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="w-full pl-4 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none appearance-none bg-white text-sm"
                >
                  <option value="All">All Classes</option>
                  {classes.length > 0 ? classes.map((c: any) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  )) : (
                    ['JHS 3', 'JHS 2', 'JHS 1', 'Class 6', 'Class 5', 'Class 4'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))
                  )}
                </select>
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
              </div>
            )}

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
      {/* Main Table Card (Desktop) & Mobile Cards */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex-1">
        {/* Mobile View: Cards */}
        <div className={`md:hidden divide-y divide-slate-100 ${mobileViewMode === 'table' ? 'hidden' : ''}`}>
          {loading ? (
            <div className="p-8"><Loading type="skeleton" fullScreen={false} /></div>
          ) : paginatedStudents.length > 0 ? (
            paginatedStudents.map((student) => (
              <div key={student.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm border border-slate-200">
                      {student.name.charAt(0)}
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
                    <span className="block font-bold text-slate-400 uppercase text-[10px]">Contact</span>
                    <a href={`tel:${student.parentPhone}`} className="text-blue-600">{student.parentPhone}</a>
                  </div>
                </div>

                {!isTeacher && (
                  <div className="flex justify-between items-center pt-1">
                    {student.balance > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                        <AlertCircle className="h-3 w-3" /> Owes {formatAmount(student.balance)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600">
                        <CheckCircle className="h-3 w-3" /> Paid
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-500 text-sm">No students found.</div>
          )}
        </div>

        {/* Desktop View: Table (or Mobile Table View) */}
        <div className={`overflow-x-auto ${mobileViewMode === 'card' ? 'hidden md:block' : 'block'}`}>
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 w-10">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    onChange={handleSelectAll}
                    checked={filteredStudents.length > 0 && selectedStudents.size === filteredStudents.length}
                  />
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student Info</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Class</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Gender</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Parent Contact</th>
                {!isTeacher && <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fee Status</th>}
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={isTeacher ? 6 : 7} className="px-6 py-12 text-center text-slate-500">
                    <Loading type="skeleton" fullScreen={false} />
                  </td>
                </tr>
              ) : paginatedStudents.length > 0 ? (
                paginatedStudents.map((student) => (
                  <tr key={student.id} className={`hover:bg-slate-50 transition-colors group ${selectedStudents.has(student.id) ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        checked={selectedStudents.has(student.id)}
                        onChange={() => handleSelectStudent(student.id)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm mr-3 border border-slate-200">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{student.name}</div>
                          <div className="text-xs text-slate-500">{student.id.substring(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      <span className="px-2 py-1 rounded-md bg-slate-100 font-medium text-xs border border-slate-200">
                        {student.class}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${student.gender === 'Male'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-pink-100 text-pink-800'
                        }`}>
                        {student.gender}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900">{student.parentName}</div>
                      <a href={`tel:${student.parentPhone}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {student.parentPhone}
                      </a>
                    </td>
                    {!isTeacher && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {student.balance > 0 ? (
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-red-600 bg-red-50 px-3 py-1 rounded-full">
                            <AlertCircle className="h-3 w-3" /> Owes {formatAmount(student.balance)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-sm font-semibold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                            <CheckCircle className="h-3 w-3" /> Paid
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setSelectedStudent(student)}
                        className="text-slate-400 hover:text-blue-600 mx-2 p-1 rounded-full hover:bg-blue-50 transition-colors"
                        title="View Profile"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          setStudentToEdit(student);
                          setIsEditModalOpen(true);
                        }}
                        className="text-slate-400 hover:text-orange-600 mx-2 p-1 rounded-full hover:bg-orange-50 transition-colors"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isTeacher ? 5 : 6} className="px-6 py-12 text-center text-slate-500">
                    No students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="bg-white px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <span className="text-sm text-slate-500 order-2 sm:order-1">
            Showing page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
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
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-slate-200 rounded-md text-sm disabled:opacity-50 hover:bg-slate-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}
      {isAddModalOpen && (
        <StudentModal
          onClose={() => setIsAddModalOpen(false)}
          onSubmit={handleAddStudent}
          availableClasses={classes}
          feeStructure={feeStructure}
          title="Add New Student"
          isLoading={isSubmitting}
        />
      )}

      {isEditModalOpen && studentToEdit && (
        <StudentModal
          onClose={() => setIsEditModalOpen(false)}
          onSubmit={(data: any) => handleEditStudent(studentToEdit.id, data)}
          availableClasses={classes}
          feeStructure={feeStructure}
          initialData={studentToEdit}
          title="Edit Student"
          isLoading={isSubmitting}
        />
      )}

      {isImportModalOpen && (
        <ImportStudentModal
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImportCSV}
          isLoading={isSubmitting}
          progress={importProgress}
        />
      )}

      {/* --- SLIDE-OVER PROFILE --- */}
      {selectedStudent && (
        <StudentProfileDrawer
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}

    </div>
  );
};

// --- Sub-component: Student Modal (Add/Edit) ---
const StudentModal = ({ onClose, onSubmit, availableClasses, feeStructure, initialData, title, isLoading = false }: any) => {
  const { currency } = useCurrency();
  const [formData, setFormData] = useState({
    name: '', class: '', gender: 'Male', parentName: '', parentPhone: '', dob: '', balance: 0
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        class: initialData.class,
        gender: initialData.gender,
        parentName: initialData.parentName,
        parentPhone: initialData.parentPhone,
        dob: initialData.dob || '',
        balance: initialData.balance
      });
    }
  }, [initialData]);

  // Auto-calculate balance for NEW students when class changes
  useEffect(() => {
    if (!initialData && formData.class && feeStructure) {
      const classFees = feeStructure
        .filter((f: any) => !f.target_class || f.target_class === 'All' || f.target_class === formData.class)
        .reduce((sum: number, f: any) => sum + Number(f.amount), 0);

      setFormData(prev => ({ ...prev, balance: classFees }));
    }
  }, [formData.class, feeStructure, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input required type="text" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
              value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Kwame Mensah" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
              <select required className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none bg-white"
                value={formData.class} onChange={e => setFormData({ ...formData, class: e.target.value })}>
                <option value="">Select Class</option>
                {availableClasses.map((c: any) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
              <select className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none bg-white"
                value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
              <input type="date" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                value={formData.dob} onChange={e => setFormData({ ...formData, dob: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Outstanding Balance ({currency.code})</label>
              <input type="number" min="0" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none font-bold text-slate-700"
                value={formData.balance} onChange={e => setFormData({ ...formData, balance: Number(e.target.value) })} />
              {!initialData && <p className="text-xs text-slate-500 mt-1">Auto-calculated from fee structure.</p>}
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Parent / Guardian Info</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Parent Name</label>
                <input required type="text" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                  value={formData.parentName} onChange={e => setFormData({ ...formData, parentName: e.target.value })} placeholder="e.g. Mr. Mensah" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                <input required type="tel" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                  value={formData.parentPhone} onChange={e => setFormData({ ...formData, parentPhone: e.target.value })} placeholder="024..." />
              </div>
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={isLoading} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 flex items-center gap-2">
              {isLoading && <Loading type="spinner" fullScreen={false} message="" />}
              Save Student
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Sub-component: Import Modal ---
const ImportStudentModal = ({ onClose, onImport, isLoading = false, progress }: any) => {
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (file) {
      onImport(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">Import Students (CSV)</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <FileSpreadsheet className="h-10 w-10 text-slate-400 mb-3" />
            {file ? (
              <div>
                <p className="font-bold text-slate-800">{file.name}</p>
                <p className="text-sm text-slate-500">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-slate-700">Click to upload CSV</p>
                <p className="text-xs text-slate-500 mt-1">Format: Name, Class, Gender, Parent Name, Parent Phone, Balance (Optional)</p>
              </div>
            )}
          </div>

          {progress && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-blue-700">{progress.status}</span>
                <span className="text-xs font-bold text-blue-700">
                  {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%
                </span>
              </div>
              <div className="h-2 w-full bg-blue-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          )}

          {!progress && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h4 className="text-xs font-bold text-blue-700 uppercase mb-2">CSV Format Guide</h4>
              <p className="text-xs text-blue-600 mb-2">Ensure your CSV columns are in this order:</p>
              <ol className="list-decimal list-inside text-xs text-blue-800 space-y-1">
                <li>Student Name</li>
                <li>Class (e.g. JHS 1)</li>
                <li>Gender (Male/Female)</li>
                <li>Parent Name</li>
                <li>Parent Phone</li>
                <li>Outstanding Balance (Optional)</li>
              </ol>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50">Cancel</button>
            <button
              type="submit"
              disabled={!file || isLoading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading && <Loading type="spinner" fullScreen={false} message="" />}
              {isLoading ? 'Processing...' : 'Import Students'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Sub-component: Student Profile Drawer ---
const StudentProfileDrawer = ({ student, onClose }: { student: Student; onClose: () => void }) => {
  const { formatAmount } = useCurrency();
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const fetchTransactions = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false });

      if (data) {
        setTransactions(data.map((t: any) => ({
          id: t.id,
          studentId: t.student_id,
          date: t.date,
          amount: t.amount,
          type: t.type
        })));
      }
    };
    fetchTransactions();
  }, [student.id]);

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
              <div className="h-full w-full rounded-full bg-slate-200 flex items-center justify-center text-3xl font-bold text-slate-500">
                {student.name.charAt(0)}
              </div>
            </div>
            <div className="mb-14 ml-4">
              <h2 className="text-white font-bold text-xl">{student.name}</h2>
              <p className="text-blue-200 text-sm">ID: {student.id.substring(0, 8)}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mt-16 px-8 flex-1 overflow-y-auto space-y-8 pb-10">

          {/* Status Section */}
          <div className="flex justify-between items-center border-b border-slate-100 pb-6">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${student.balance > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}>
              {student.balance > 0 ? 'Fees Outstanding' : 'Fees Paid'}
            </span>
            <span className="text-sm text-slate-500 font-medium">{student.class}</span>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Gender</p>
              <p className="font-medium text-slate-800">{student.gender}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Date of Birth</p>
              <p className="font-medium text-slate-800">{student.dob || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Parent Name</p>
              <p className="font-medium text-slate-800">{student.parentName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">Parent Phone</p>
              <a href={`tel:${student.parentPhone}`} className="font-medium text-blue-600 hover:underline flex items-center gap-1">
                <Phone className="h-3 w-3" /> {student.parentPhone}
              </a>
            </div>
          </div>

          {/* Financials */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Financial Status</h4>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-600">Outstanding Balance</span>
                <span className={`text-lg font-bold ${student.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatAmount(student.balance)}
                </span>
              </div>
              <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${student.balance > 0 ? 'bg-red-500' : 'bg-green-500'}`}
                  style={{ width: '100%' }}
                ></div>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Recent Transactions</h4>
            <div className="space-y-3">
              {transactions.length > 0 ? (
                transactions.map(t => (
                  <div key={t.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-50 text-green-600 rounded-lg">
                        <DollarSign className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{t.type}</p>
                        <p className="text-xs text-slate-500">{t.date}</p>
                      </div>
                    </div>
                    <span className="font-bold text-green-600 text-sm">+ {formatAmount(t.amount)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400 italic text-center py-4">No transactions found.</p>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Students;