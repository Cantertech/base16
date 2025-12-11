
export const generateMockData = (schoolName: string) => {
  const maleNames = ['Kwame', 'Kofi', 'Yaw', 'Kojo', 'Kwabena', 'Kweku', 'Emmanuel', 'Samuel', 'Daniel', 'Prince', 'Isaac'];
  const femaleNames = ['Ama', 'Abena', 'Adwoa', 'Akosua', 'Yaa', 'Afia', 'Esi', 'Jessica', 'Sarah', 'Olivia', 'Grace'];
  const lastNames = ['Mensah', 'Osei', 'Owusu', 'Appiah', 'Antwi', 'Asare', 'Boakye', 'Boateng', 'Frimpong', 'Gyasi', 'Opoku', 'Sarpong'];
  
  // Expanded Class List as requested
  const classNames = [
    'Creche', 'KG 1', 'KG 2', 
    'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6',
    'JHS 1', 'JHS 2', 'JHS 3'
  ];
  
  // Create Class Objects
  const classes = classNames.map((name, index) => ({
      id: `CLS-${100 + index}`,
      name: name,
      section: '', // Optional section
      studentCount: Math.floor(Math.random() * 30) + 15, // 15-45 students
      teacherId: null as string | null
  }));

  // Standard GES Curriculum Subjects
  const subjectList = [
    { name: 'Mathematics', code: 'MTH', type: 'Core' },
    { name: 'English Language', code: 'ENG', type: 'Core' },
    { name: 'Integrated Science', code: 'SCI', type: 'Core' },
    { name: 'Social Studies', code: 'SOC', type: 'Core' },
    { name: 'R.M.E', code: 'RME', type: 'Core' },
    { name: 'I.C.T', code: 'ICT', type: 'Core' },
    { name: 'French', code: 'FRE', type: 'Core' },
    { name: 'B.D.T', code: 'BDT', type: 'Core' },
    { name: 'Ghanaian Language', code: 'GHL', type: 'Elective' }
  ];

  // Create Subject Objects
  const subjects = subjectList.map((sub, index) => ({
    id: `SUB-${100 + index}`,
    name: sub.name,
    code: sub.code,
    type: sub.type,
    // Assign to random classes for mock data, mostly upper primary/JHS
    classes: classNames.filter((_, i) => i > 2) // Assign to Class 1 onwards
  }));

  // 1. Generate Students
  const students = Array.from({ length: 65 }, (_, i) => {
    const isMale = Math.random() > 0.5;
    const firstName = isMale 
      ? maleNames[Math.floor(Math.random() * maleNames.length)] 
      : femaleNames[Math.floor(Math.random() * femaleNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const studentClass = classNames[Math.floor(Math.random() * classNames.length)];
    
    // Random fee balance between 0 and 500
    const owes = Math.random() > 0.4; // 60% chance of owing
    const balance = owes ? Math.floor(Math.random() * 500) + 50 : 0;

    return {
      id: `STU-${1000 + i}`,
      name: `${firstName} ${lastName}`,
      gender: isMale ? 'Male' : 'Female',
      class: studentClass,
      balance: balance,
      parentName: isMale ? `Mr. ${lastName}` : `Mrs. ${lastName}`, 
      parentPhone: `02${Math.floor(Math.random() * 90000000 + 10000000)}`,
      dob: `20${Math.floor(Math.random() * 5 + 10)}-${Math.floor(Math.random() * 11 + 1)}-${Math.floor(Math.random() * 28 + 1)}`,
      status: 'Active',
      attendance: Math.floor(Math.random() * 20) + 80 // 80-100%
    };
  });

  // 2. Generate Teachers with Credentials
  const teachers = Array.from({ length: 15 }, (_, i) => {
      const isMale = Math.random() > 0.5;
      const firstName = isMale 
        ? maleNames[Math.floor(Math.random() * maleNames.length)] 
        : femaleNames[Math.floor(Math.random() * femaleNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      
      const assignedClass = Math.random() > 0.3 ? classNames[Math.floor(Math.random() * classNames.length)] : null;
      const isOnLeave = Math.random() > 0.9; 

      return {
          id: `TCH-${200 + i}`,
          name: `${isMale ? 'Mr.' : 'Ms.'} ${firstName} ${lastName}`,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@school.com`,
          phone: `02${Math.floor(Math.random() * 90000000 + 10000000)}`,
          subject: subjects[i % subjects.length].name,
          assignedClass: assignedClass,
          status: isOnLeave ? 'On Leave' : 'Active',
          role: 'teacher',
          password: 'password123' 
      };
  });

  // Assign teachers to classes in mock data
  classes.forEach(cls => {
    const teacher = teachers.find(t => t.assignedClass === cls.name);
    if (teacher) cls.teacherId = teacher.name;
    else cls.teacherId = 'Unassigned';
    
    // Recalculate student count based on generated students
    cls.studentCount = students.filter(s => s.class === cls.name).length;
  });

  // 3. Generate Transactions
  const transactions = Array.from({ length: 45 }, (_, i) => {
    const student = students[Math.floor(Math.random() * students.length)];
    return {
      id: `TRX-${5000 + i}`,
      studentId: student.id,
      studentName: student.name,
      amount: Math.floor(Math.random() * 300) + 50,
      date: new Date(Date.now() - Math.floor(Math.random() * 60 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0], // Past 60 days
      type: 'Tuition Fee'
    };
  });

  // 4. Generate Academic Results
  const results: any[] = [];
  students.forEach(student => {
    // Only give results for 4 random subjects
    const studentSubjects = subjects.slice(0, 4); 
    studentSubjects.forEach(subject => {
        const classScore = Math.floor(Math.random() * 16) + 14; // 14-30
        const examScore = Math.floor(Math.random() * 41) + 30; // 30-70
        results.push({
            id: `RES-${Math.random().toString(36).substr(2, 9)}`,
            studentId: student.id,
            studentName: student.name,
            class: student.class,
            subject: subject.name,
            classScore: classScore,
            examScore: examScore,
            total: classScore + examScore
        });
    });
  });

  // 5. Generate Exam Submissions (Admin Workflow)
  const submissions: any[] = [];
  // Generate submissions for JHS classes
  classNames.filter(c => c.includes('JHS')).forEach(cls => {
    subjectList.slice(0, 6).forEach(sub => {
       const rand = Math.random();
       let status = 'Pending';
       if (rand > 0.7) status = 'Approved';
       else if (rand > 0.4) status = 'Submitted';
       else if (rand > 0.3) status = 'Rejected';
       
       submissions.push({
           id: `SUB-${cls.replace(' ', '')}-${sub.code}`,
           class: cls,
           subject: sub.name,
           status: status,
           teacherName: teachers.find(t => t.subject === sub.name)?.name || 'Unknown Teacher',
           submittedDate: status !== 'Pending' ? new Date().toISOString().split('T')[0] : null
       });
    });
  });

  // 6. Generate Analytics Financial History (Mock Trend)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const financialHistory = months.map(m => {
      const baseExpected = 50000;
      const variation = Math.floor(Math.random() * 10000) - 5000;
      const expected = baseExpected + variation;
      
      // Collection usually dips mid-year or varies
      const collectionRate = 0.6 + (Math.random() * 0.35); // 60% to 95%
      const collected = Math.floor(expected * collectionRate);
      
      return {
          month: m,
          expected: expected,
          collected: collected
      };
  });

  // 7. Generate Communication Data
  const smsBalance = 420; // Fixed starting balance

  const noticeBoard = [
    {
      id: 'NOT-001',
      title: 'Staff Meeting',
      message: 'Briefing on Friday at 2 PM regarding the upcoming mid-term exams. Attendance is mandatory.',
      audience: 'Teaching Staff',
      priority: 'Urgent',
      date: new Date().toISOString().split('T')[0],
      author: 'Admin'
    },
    {
      id: 'NOT-002',
      title: 'Science Fair Projects',
      message: 'Please submit all science fair project topics by next Monday. Ensure safety guidelines are followed.',
      audience: 'All Staff',
      priority: 'Normal',
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      author: 'Mr. Mensah'
    }
  ];

  const messageHistory = [
    {
      id: 'MSG-001',
      date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
      type: 'SMS Blast',
      recipient: 'All Parents',
      content: 'Dear Parent, School will close at 12pm on Friday due to the staff meeting.',
      status: 'Delivered'
    },
    {
      id: 'MSG-002',
      date: new Date(Date.now() - 432000000).toISOString().split('T')[0],
      type: 'SMS Blast',
      recipient: 'Debtors (Fees > 0)',
      content: 'Dear Parent, kindly pay outstanding fees to avoid inconvenience.',
      status: 'Delivered'
    }
  ];

  // 8. Generate Billing History
  const billingHistory = [
     { id: 'INV-001', date: new Date().toISOString().split('T')[0], description: 'Monthly Subscription - Growth Plan', amount: 500, status: 'Paid' },
     { id: 'INV-002', date: new Date(Date.now() - 2592000000).toISOString().split('T')[0], description: 'Monthly Subscription - Growth Plan', amount: 500, status: 'Paid' },
     { id: 'INV-003', date: new Date(Date.now() - 3500000000).toISOString().split('T')[0], description: 'SMS Bundle (1000 Units)', amount: 50, status: 'Paid' },
  ];

  // 9. Generate Referral Data (NEW)
  // This school's unique code to share
  const referralCode = `SZO-${Math.floor(Math.random() * 900 + 100)}`;
  // Default reward preference
  const referralPreference = 'CASH'; 
  // History of people this school has referred
  const referralHistory = [
      { id: 'REF-001', schoolName: 'Liberty Hills Academy', date: '2025-01-15', reward: 'GH¢ 150 MoMo', status: 'Pending' },
      { id: 'REF-002', schoolName: 'Royal Seeds Int.', date: '2024-12-10', reward: '1 Month Credit', status: 'Paid' }
  ];

  // 10. Save to LocalStorage
  localStorage.setItem('schoolhub_classes', JSON.stringify(classes));
  localStorage.setItem('schoolhub_subjects', JSON.stringify(subjects));
  localStorage.setItem('schoolhub_students', JSON.stringify(students));
  localStorage.setItem('schoolhub_teachers', JSON.stringify(teachers));
  localStorage.setItem('schoolhub_transactions', JSON.stringify(transactions));
  localStorage.setItem('schoolhub_results', JSON.stringify(results));
  localStorage.setItem('schoolhub_submissions', JSON.stringify(submissions));
  localStorage.setItem('schoolhub_financial_history', JSON.stringify(financialHistory));
  // Communication Data
  localStorage.setItem('schoolhub_sms_balance', smsBalance.toString());
  localStorage.setItem('schoolhub_notices', JSON.stringify(noticeBoard));
  localStorage.setItem('schoolhub_message_history', JSON.stringify(messageHistory));
  // Billing Data
  localStorage.setItem('schoolhub_billing_history', JSON.stringify(billingHistory));
  // Referral Data
  localStorage.setItem('schoolhub_referrals', JSON.stringify(referralHistory));

  
  localStorage.setItem('schoolhub_setup_complete', 'true');
  
  return { 
    students, teachers, transactions, results, submissions, 
    financialHistory, smsBalance, noticeBoard, messageHistory, billingHistory,
    referralCode, referralPreference, referralHistory
  };
};
