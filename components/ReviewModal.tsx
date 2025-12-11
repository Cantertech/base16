import React, { useState } from 'react';
import { X, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface Result {
  id: string;
  studentId: string;
  studentName: string;
  classScore: number;
  examScore: number;
  total: number;
}

interface ReviewModalProps {
  submission: {
    class: string;
    subject: string;
    teacherName: string;
  };
  results: Result[];
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ submission, results, onClose, onApprove, onReject }) => {
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const getGrade = (total: number) => {
    if (total >= 80) return 'A';
    if (total >= 70) return 'B';
    if (total >= 60) return 'C';
    if (total >= 50) return 'D';
    return 'F';
  };

  const isSuspicious = (res: Result) => res.total === 100 || res.total === 0 || res.examScore === 0;

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
           <div>
             <h3 className="font-bold text-lg text-slate-800">Review Marks Submission</h3>
             <p className="text-sm text-slate-500">
                {submission.class} • {submission.subject} • Submitted by <span className="font-medium text-slate-700">{submission.teacherName}</span>
             </p>
           </div>
           <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
             <X className="h-6 w-6" />
           </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-0">
           {results.length === 0 ? (
               <div className="p-12 text-center text-slate-500">No marks found for this submission.</div>
           ) : (
             <table className="w-full text-left border-collapse">
                <thead className="bg-white sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Student Name</th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-center">Class Score (30)</th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-center">Exam Score (70)</th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-center">Total (100)</th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-center">Grade</th>
                        <th className="px-6 py-3 text-xs font-semibold text-slate-500 uppercase text-center">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {results.map((res) => {
                        const suspicious = isSuspicious(res);
                        const grade = getGrade(res.total);
                        return (
                            <tr key={res.id} className={`hover:bg-slate-50 ${suspicious ? 'bg-orange-50/50' : ''}`}>
                                <td className="px-6 py-3 font-medium text-slate-900">{res.studentName}</td>
                                <td className="px-6 py-3 text-center text-slate-600">{res.classScore}</td>
                                <td className="px-6 py-3 text-center text-slate-600">{res.examScore}</td>
                                <td className={`px-6 py-3 text-center font-bold ${suspicious ? 'text-orange-600' : 'text-slate-800'}`}>
                                    {res.total}
                                </td>
                                <td className="px-6 py-3 text-center">
                                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                        grade === 'F' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                    }`}>
                                        {grade}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-center">
                                    {suspicious && (
                                        <div className="flex items-center justify-center gap-1 text-orange-600 text-xs font-medium" title="Score looks unusual">
                                            <AlertTriangle className="h-3 w-3" /> Check
                                        </div>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
             </table>
           )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50">
            {!isRejecting ? (
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={() => setIsRejecting(true)}
                        className="px-6 py-2 border border-red-200 text-red-600 rounded-lg font-bold hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                        <XCircle className="h-5 w-5" /> Reject
                    </button>
                    <button 
                        onClick={onApprove}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-md transition-colors flex items-center gap-2"
                    >
                        <CheckCircle className="h-5 w-5" /> Approve & Publish
                    </button>
                </div>
            ) : (
                <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <label className="text-sm font-bold text-slate-700">Reason for Rejection:</label>
                    <textarea 
                        autoFocus
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="e.g. Too many students failing, please re-check Exam 2 scores."
                        className="w-full p-3 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 outline-none text-sm"
                    ></textarea>
                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => setIsRejecting(false)}
                            className="px-4 py-2 text-slate-500 font-medium hover:text-slate-700"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={() => onReject(rejectReason)}
                            disabled={!rejectReason.trim()}
                            className="px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                            Confirm Rejection
                        </button>
                    </div>
                </div>
            )}
        </div>

      </div>
    </div>
  );
};

export default ReviewModal;