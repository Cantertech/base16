/**
 * ExamsContext.tsx
 *
 * Central React Context for the Exams module.
 * ExamsInner initializes all state, queries and mutations, then provides them here.
 * Sub-components (TeacherView, ExamSetupPanel, ExamMonitoringPanel, ExamPublishingPanel)
 * consume this context instead of receiving 30+ props each.
 *
 * This is the structural fix for the 3279-line monolith (Fix 7).
 */

import React, { createContext, useContext } from 'react';
import { Student, Result } from './ExamsTypes';

// ─── Context Shape ─────────────────────────────────────────────────────────────

export interface ExamsContextValue {
    // Identity
    currentUser: any;
    schoolId: string | undefined;
    isAdmin: boolean;
    activeModules: string[] | undefined;

    // Server data
    schoolInfo: any;
    examConfig: any;
    localConfig: any;
    setLocalConfig: (c: any) => void;
    students: Student[];
    results: Result[];
    submissionOverview: any[];
    releasedClasses: string[];
    subjectAssignments: any[];
    allAssignments: any[];
    myAssignments: any[];
    allReportCards: any[];

    // Derived / computed
    availableClasses: string[];
    availableSubjects: string[];
    classStudents: Student[];
    isClassTeacher: boolean;

    // Selections
    selectedClass: string;
    setSelectedClass: (c: string) => void;
    selectedSubject: string;
    setSelectedSubject: (s: string) => void;
    expandedMonitoringClass: string | null;
    setExpandedMonitoringClass: (c: string | null) => void;
    viewingClassList: string | null;
    setViewingClassList: (c: string | null) => void;
    reportStudent: Student | null;
    setReportStudent: (s: Student | null) => void;
    releaseModalData: { className: string; studentCount: number; validPhones: number } | null;
    setReleaseModalData: (d: any) => void;
    isBulkPrinting: boolean;
    isLevelArchiveOpen: boolean;
    setIsLevelArchiveOpen: (v: boolean) => void;
    newLevelName: string;
    setNewLevelName: (v: string) => void;
    isUploadingImage: string | null;

    // Mark entry
    pendingChanges: Record<string, { classScore: number; examScore: number; competencyStatus?: string }>;
    setPendingChanges: (c: any) => void;
    pendingRemarks: Record<string, Record<string, any>>;
    setPendingRemarks: (r: any) => void;
    teacherTab: 'marks' | 'remarks';
    setTeacherTab: (t: 'marks' | 'remarks') => void;
    activeTool: string;
    setActiveTool: (t: any) => void;
    paintBrush: string;
    setPaintBrush: (v: string) => void;
    userPresets: string[];
    setUserPresets: (p: string[]) => void;
    conductPresets: string[];
    setConductPresets: (p: string[]) => void;
    interestPresets: string[];
    setInterestPresets: (p: string[]) => void;
    newPresetValue: string;
    setNewPresetValue: (v: string) => void;
    isPresetModalOpen: boolean;
    setIsPresetModalOpen: (v: boolean) => void;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    activeTab: 'setup' | 'publishing';
    setActiveTab: (t: 'setup' | 'publishing') => void;

    // Mutations & handlers
    saveConfigMutation: any;
    toggleMarkEntryMutation: any;
    publishResultsMutation: any;
    saveMarksMutation: any;
    submitMarksMutation: any;
    saveBulkRemarksMutation: any;
    resetSubjectMarksMutation: any;
    handleSaveConfig: (config: any) => void;
    handleConfirmRelease: (className: string, sendSms: boolean) => void;
    handleSubmitMarks: () => void;
    handleResetSubjectMarks: (className: string, subjectName: string) => void;
    saveMarks: () => void;
    saveBulkRemarks: () => void;
    handleScoreChange: (studentId: string, field: string, value: string) => void;
    handleRemarkChange: (studentId: string, field: string, value: any) => void;
    getExistingScore: (studentId: string, field: string) => number;
    getExistingCompetency: (studentId: string) => string;
    getGrade: (score: number) => string;
    getPendingKey: (studentId: string) => string;
    getLayoutForClass: (className: string) => string;
    handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>, field: string) => void;
    getPrefilledResults: (student: Student, rawResults: any[]) => any[];
    triggerBulkPrint: () => void;
    bulkPrintRef: React.RefObject<HTMLDivElement | null>;
    reportResultsRaw: any[];
    classResultsRaw: any[];
    studentRank: any;
    classRanks: Record<string, any>;
    currentTerm: string;
    currentYear: string;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const ExamsContext = createContext<ExamsContextValue | null>(null);

export const ExamsProvider = ExamsContext.Provider;

export const useExamsContext = (): ExamsContextValue => {
    const ctx = useContext(ExamsContext);
    if (!ctx) throw new Error('useExamsContext must be used within ExamsProvider');
    return ctx;
};
