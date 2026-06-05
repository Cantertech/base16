// ─── Shared Exams Types ───────────────────────────────────────────────────────
// Extracted from Exams.tsx to be shared across sub-components.

export interface Result {
    id: string;
    studentId: string;
    studentName: string;
    class: string;
    subject: string;
    classScore: number;
    examScore: number;
    total: number;
    competency_status?: string;
}

export interface Student {
    id: string;
    name: string;
    class: string;
    attendance: number;
    photo?: string;
    parent_phone?: string;
    parent_name?: string;
    admission_no?: string;
    pin?: string;
    balance?: number;
}

export interface ExamConfig {
    exam_name?: string;
    current_term?: string;
    academic_year?: string;
    status?: string;
    mark_entry_enabled?: boolean;
    target_classes?: string[];
    target_subjects?: string[];
    weights?: { class: number; exam: number };
    grading_type?: string;
    grading?: GradeLevel[];
    attendance_mode?: string;
    term_total_days?: number;
    next_term_reopens?: string;
    report_card_config?: Record<string, any>;
    global_report_sections?: { title: string; content: string }[];
    headmaster_decision?: string;
    [key: string]: any;
}

export interface GradeLevel {
    grade: string;
    min: number;
    max: number;
    remark: string;
    points: number;
}
