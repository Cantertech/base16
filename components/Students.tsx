import React, { useState, useEffect } from 'react';
import { 
  Search, Filter, Plus, FileSpreadsheet, Eye, Edit, 
  X, User, Phone, CheckCircle, AlertCircle, ChevronLeft, 
  ChevronRight, Download, DollarSign, Calendar, TrendingUp
} from 'lucide-react';

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
        role: 'admin' | 'teacher';
        assignedClass?: string | null;
    };
}

// --- Main Component ---
const Students: React.FC<StudentsProps> = ({ currentUser }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // Profile Drawer State
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const isTeacher = currentUser?.role === 'teacher';

  // Load Data
  useEffect(() => {
    const stored = localStorage.getItem('schoolhub_students');
    if (stored) {
        let loadedStudents: Student[] = JSON.parse(stored);
        
        // If teacher, filter by assigned class immediately if one exists
        if (isTeacher && currentUser?.assignedClass) {
            loadedStudents = loadedStudents.filter(s => s.class === currentUser.assignedClass);
            // Lock the filter dropdown to this class visually
            setClassFilter(currentUser.assignedClass);
        }
        setStudents(loadedStudents);
    }
  }, [currentUser, isTeacher]);

  const saveStudents = (newStudents: Student[]) => {
    setStudents(newStudents);
    if (!isTeacher) {
        localStorage.setItem('schoolhub_students', JSON.stringify(newStudents));
    }
  };

  // --- Actions ---
  const handleAddStudent = (studentData: Omit<Student, 'id' | 'balance' | 'status'>) => {
    const newStudent: Student = {
      ...studentData,
      id: `STU-${1000 + students.length + 1}`,
      balance: 0,
      status: 'Active',
      attendance: 100
    };
    // Fetch full list to append properly
    const fullList = JSON.parse(localStorage.getItem('schoolhub_students') || '[]');
    const updatedList = [newStudent, ...fullList];
    
    if (isTeacher) {
        // Just update local view
        setStudents([newStudent, ...students]);
        // Also save to LS for persistence in this demo
        localStorage.setItem('schoolhub_students', JSON.stringify(updatedList));
    } else {
        saveStudents(updatedList);
    }
    setIsAddModalOpen(false);
  };

  const handleImportCSV = (csvText: string) => {
    // Expected Format: Name, Class, ParentPhone, Gender
    const lines = csvText.split('\n');
    const imported: Student[] = [];
    
    lines.forEach((line, idx) => {
      const parts = line.split(',');
      if (parts.length >= 3) {
        imported.push({
          id: `STU-${Date.now() + idx}`,
          name: parts[0]?.trim(),
          class: parts[1]?.trim(),
          parentPhone: parts[2]?.trim(),
          gender: (parts[3]?.trim().toLowerCase() === 'female' ? 'Female' : 'Male'),
          parentName: 'Parent', // Placeholder
          balance: 0,
          status: 'Active'
        });
      }
    });

    if (imported.length > 0) {
      const fullList = JSON.parse(localStorage.getItem('schoolhub_students') || '[]');
      const updatedList = [...imported, ...fullList];
      
      if(!isTeacher) {
          saveStudents(updatedList);
      } else {
          // If teacher imports, add to local view + LS
           setStudents([...imported, ...students]);
           localStorage.setItem('schoolhub_students', JSON.stringify(updatedList));
      }
      setIsImportModalOpen(false);
      alert(`Successfully imported ${imported.length} students.`);
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
    <div className="p-8 space-y-6 relative h-full">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h1 className="text-2xl font-bold text-slate-800">
               {isTeacher && currentUser?.assignedClass ? `My Class: ${currentUser.assignedClass}` : 'Student Management'}
           </h1>
           <p className="text-slate-500 text-sm">Manage admissions, view records, and track fees.</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
           {/* Search */}
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
             <input 
               type="text" 
               placeholder="Search students..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none w-64 text-sm"
             />
           </div>

           {/* Filter */}
           {!isTeacher && (
               <div className="relative">
                  <select 
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="pl-4 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:outline-none appearance-none bg-white text-sm"
                  >
                    <option value="All">All Classes</option>
                    {['JHS 3', 'JHS 2', 'JHS 1', 'Class 6', 'Class 5', 'Class 4'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <Filter className="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
               </div>
           )}

           {/* Actions */}
           <button 
             onClick={() => setIsImportModalOpen(true)}
             className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium text-sm transition-colors"
           >
             <FileSpreadsheet className="h-4 w-4" /> Import CSV
           </button>
           <button 
             onClick={() => setIsAddModalOpen(true)}
             className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-800 font-medium text-sm shadow-sm transition-colors"
           >
             <Plus className="h-4 w-4" /> Add Student
           </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student Info</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Class</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Gender</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Parent Contact</th>
                {!isTeacher && <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Fee Status</th>}
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedStudents.length > 0 ? (
                paginatedStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-sm mr-3 border border-slate-200">
                           {student.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{student.name}</div>
                          <div className="text-xs text-slate-500">{student.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      <span className="px-2 py-1 rounded-md bg-slate-100 font-medium text-xs border border-slate-200">
                        {student.class}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        student.gender === 'Male' 
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
                             <AlertCircle className="h-3 w-3" /> Owes GH¢ {student.balance}
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
                       <button className="text-slate-400 hover:text-orange-600 mx-2 p-1 rounded-full hover:bg-orange-50 transition-colors" title="Edit">
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
        <div className="bg-white px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm text-slate-500">
               Showing page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
            </span>
            <div className="flex gap-2">
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
        <AddStudentModal 
          onClose={() => setIsAddModalOpen(false)} 
          onSubmit={handleAddStudent} 
        />
      )}
      
      {isImportModalOpen && (
        <ImportStudentModal 
          onClose={() => setIsImportModalOpen(false)} 
          onSubmit={handleImportCSV} 
        />
      )}

      {/* --- SLIDE-OVER PROFILE --- */}
      {selectedStudent && (
        <StudentProfileDrawer 
          student={selectedStudent} 
          isTeacher={isTeacher}
          onClose={() => setSelectedStudent(null)} 
        />
      )}

    </div>
  );
};

// --- Sub-component: Add Student Modal ---
const AddStudentModal = ({ onClose, onSubmit }: any) => {
    const [formData, setFormData] = useState({
        name: '', class: 'JHS 1', gender: 'Male', parentName: '', parentPhone: '', dob: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-lg text-slate-800">Add New Student</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                           <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                           <input required type="text" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none" 
                             value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
                           <select className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none bg-white"
                             value={formData.class} onChange={e => setFormData({...formData, class: e.target.value})}>
                               {['JHS 3', 'JHS 2', 'JHS 1', 'Class 6', 'Class 5', 'Class 4'].map(c => <option key={c} value={c}>{c}</option>)}
                           </select>
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                           <select className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none bg-white"
                             value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                               <option value="Male">Male</option>
                               <option value="Female">Female</option>
                           </select>
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">Parent Name</label>
                           <input required type="text" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                             value={formData.parentName} onChange={e => setFormData({...formData, parentName: e.target.value})} />
                        </div>
                        <div>
                           <label className="block text-sm font-medium text-slate-700 mb-1">Parent Phone</label>
                           <input required type="tel" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                             value={formData.parentPhone} onChange={e => setFormData({...formData, parentPhone: e.target.value})} />
                        </div>
                        <div className="col-span-2">
                           <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
                           <input type="date" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
                             value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} />
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">Create Student</button>
                    </div>
                </form>
            </div>
        </div>
    )
}

// --- Sub-component: Import Modal ---
const ImportStudentModal = ({ onClose, onSubmit }: any) => {
    const [text, setText] = useState('');

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">Bulk Import Students</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-500">
                        Paste student data below. Each line represents a student.<br/>
                        Format: <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">Name, Class, Phone, Gender</code>
                    </p>
                    <textarea 
                        className="w-full h-40 p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-600 outline-none font-mono text-sm"
                        placeholder={`Kofi Mensah, JHS 1, 0551234567, Male\nAma Osei, Class 6, 0247654321, Female`}
                        value={text}
                        onChange={e => setText(e.target.value)}
                    ></textarea>
                    <div className="pt-2 flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                        <button 
                            onClick={() => onSubmit(text)} 
                            disabled={!text.trim()}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium disabled:opacity-50"
                        >
                            Import Data
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Sub-component: Student Profile Drawer ---
const StudentProfileDrawer = ({ student, onClose, isTeacher }: { student: Student; onClose: () => void; isTeacher: boolean }) => {
    const [activeTab, setActiveTab] = useState<'Overview' | 'Financials' | 'Academics'>('Overview');
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    useEffect(() => {
        // Fetch transactions relevant to this student
        const allTrans = JSON.parse(localStorage.getItem('schoolhub_transactions') || '[]');
        const studentTrans = allTrans.filter((t: any) => t.studentId === student.id || t.studentName === student.name);
        setTransactions(studentTrans);
    }, [student]);

    const tabs = ['Overview', !isTeacher && 'Financials', 'Academics'].filter(Boolean) as string[];

    return (
        <div className="fixed inset-0 z-[60] flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose}></div>
            
            {/* Drawer */}
            <div className="relative w-full max-w-md md:max-w-lg h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
                
                {/* Header */}
                <div className="h-40 bg-primary-900 relative">
                    <button onClick={onClose} className="absolute top-4 left-4 text-white/70 hover:text-white bg-black/20 p-1.5 rounded-full backdrop-blur-md">
                        <X className="h-5 w-5" />
                    </button>
                    <div className="absolute -bottom-12 left-8 flex items-end">
                        <div className="h-24 w-24 rounded-full bg-white p-1 shadow-lg">
                            <div className="h-full w-full rounded-full bg-slate-200 flex items-center justify-center overflow-hidden">
                                <span className="text-3xl font-bold text-slate-400">{student.name.charAt(0)}</span>
                            </div>
                        </div>
                        <div className="mb-14 ml-4">
                             <h2 className="text-white font-bold text-xl">{student.name}</h2>
                             <p className="text-blue-200 text-sm">{student.class} Student</p>
                        </div>
                    </div>
                </div>

                {/* Status Toggle & Content */}
                <div className="mt-14 px-8 flex-1 overflow-y-auto">
                    
                    {/* Status Bar */}
                    <div className="flex justify-between items-center mb-8">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                            student.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                            {student.status || 'Active'}
                        </span>
                        {!isTeacher && (
                            <div className="flex gap-2">
                                <button className="text-xs font-medium text-slate-500 hover:text-slate-900 border border-slate-200 px-3 py-1 rounded-full">Suspend</button>
                                <button className="text-xs font-medium text-slate-500 hover:text-slate-900 border border-slate-200 px-3 py-1 rounded-full">Edit Profile</button>
                            </div>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-slate-100 mb-6">
                        {tabs.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab as any)}
                                className={`flex-1 pb-3 text-sm font-medium transition-colors relative ${
                                    activeTab === tab ? 'text-primary-600' : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                {tab}
                                {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-600 rounded-t-full"></div>}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="pb-8 space-y-6">
                        {activeTab === 'Overview' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Personal Details</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="block text-slate-500 text-xs">Admission No.</span>
                                            <span className="font-medium text-slate-800">{student.id}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-500 text-xs">Gender</span>
                                            <span className="font-medium text-slate-800">{student.gender}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-500 text-xs">Date of Birth</span>
                                            <span className="font-medium text-slate-800">{student.dob || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-slate-500 text-xs">Attendance</span>
                                            <span className="font-medium text-green-600">{student.attendance}%</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Guardian Info</h4>
                                    <div className="flex items-start gap-3">
                                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                                            <User className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">{student.parentName}</p>
                                            <p className="text-xs text-slate-500">Father / Guardian</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                                            <Phone className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">{student.parentPhone}</p>
                                            <a href={`tel:${student.parentPhone}`} className="text-xs text-blue-600 hover:underline">Call now</a>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'Financials' && !isTeacher && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                {/* Big Card */}
                                <div className={`p-6 rounded-xl border ${student.balance > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'} text-center`}>
                                    <p className="text-slate-500 text-sm font-medium mb-1">Current Balance</p>
                                    <h3 className={`text-3xl font-bold ${student.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        GH¢ {student.balance.toLocaleString()}
                                    </h3>
                                    {student.balance > 0 && <p className="text-xs text-red-500 mt-2">Payment Overdue</p>}
                                </div>

                                {/* Transactions */}
                                <div>
                                    <h4 className="font-bold text-slate-800 mb-3 text-sm">Recent Transactions</h4>
                                    <div className="space-y-2">
                                        {transactions.length > 0 ? (
                                            transactions.map(t => (
                                                <div key={t.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg hover:border-slate-200 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-green-100 p-2 rounded-full text-green-700">
                                                            <DollarSign className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-slate-900 text-sm">{t.type}</p>
                                                            <p className="text-xs text-slate-500">{t.date}</p>
                                                        </div>
                                                    </div>
                                                    <span className="font-bold text-slate-700 text-sm">+GH¢{t.amount}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-lg border border-slate-100 border-dashed">
                                                No transaction history found.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'Academics' && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div className="p-4 bg-blue-50 text-blue-800 rounded-lg text-sm border border-blue-100 flex gap-2">
                                   <TrendingUp className="h-5 w-5" />
                                   Academic performance module is available in the Pro Plan. Showing mock data.
                                </div>

                                <div className="space-y-4">
                                   {['Mathematics', 'English Language', 'Integrated Science', 'Social Studies'].map(subject => (
                                       <div key={subject} className="flex items-center justify-between p-3 border-b border-slate-100">
                                          <span className="text-sm font-medium text-slate-700">{subject}</span>
                                          <div className="flex items-center gap-2">
                                             <div className="h-2 w-24 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-primary-600" style={{ width: `${Math.floor(Math.random() * 40) + 50}%` }}></div>
                                             </div>
                                             <span className="text-xs font-bold text-slate-900">{Math.floor(Math.random() * 40) + 50}%</span>
                                          </div>
                                       </div>
                                   ))}
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Students;