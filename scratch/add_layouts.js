import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '..', 'components', 'ReportCard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Define the adventistContent layout
const adventistContentDef = `
    const adventistContent = (
        <div ref={printMode ? undefined : componentRef} className="bg-white max-w-4xl mx-auto p-4 print:p-2 md:p-10 text-slate-900 flex flex-col font-serif relative overflow-hidden border border-slate-300 shadow-sm" style={{ fontFamily: 'Georgia, serif' }}>
            
            {/* Header */}
            <div className="text-center pb-3 border-b-2 border-slate-800 relative z-10">
                <div className="flex justify-center items-center gap-4 mb-2">
                    {schoolConfig?.logo_url ? (
                        <div className="h-16 w-16 p-1 bg-white border border-slate-200 rounded flex items-center justify-center shrink-0">
                            <img src={schoolConfig.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                        </div>
                    ) : (
                        <div className="h-16 w-16 bg-slate-100 border border-slate-400 rounded flex items-center justify-center shrink-0">
                            <Building2 className="w-8 h-8 text-slate-300" />
                        </div>
                    )}
                    <div className="text-center">
                        <h1 className="text-xl md:text-2xl font-black uppercase tracking-wide text-slate-950 leading-none mb-1">
                            {schoolConfig?.name || 'NAME OF SCHOOL'}
                        </h1>
                        <p className="text-[9.5px] font-bold text-slate-700 uppercase leading-tight">
                            {schoolConfig?.address || 'P.O. BOX 143, BEKWAI- ASHANTI, GHANA'}
                        </p>
                        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-tight mt-0.5">
                            {(schoolConfig?.phone || 'CONTACT PHONE') + (schoolConfig?.email ? ' | ' + schoolConfig.email : '')}
                        </p>
                    </div>
                </div>
                <h2 className="text-[14px] font-black uppercase tracking-[0.2em] text-slate-950 border-t border-slate-800 pt-1.5 inline-block">Terminal Report</h2>
            </div>

            {/* Student Particulars Certification Text Block */}
            <div className="my-4 print:my-2 p-3 bg-slate-50/50 border border-slate-200 text-xs text-slate-800 leading-relaxed space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                    <div>
                        <span className="font-medium text-slate-500 uppercase tracking-wider text-[9.5px]">This is to certify that: </span>
                        <span className="font-black text-slate-950 uppercase text-[12px]">{student.name}</span>
                    </div>
                    <div>
                        <span className="font-medium text-slate-500 uppercase tracking-wider text-[9.5px]">Class/Form: </span>
                        <span className="font-black text-slate-950 uppercase">{student.class}</span>
                    </div>
                    <div>
                        <span className="font-medium text-slate-500 uppercase tracking-wider text-[9.5px]">Position In Class: </span>
                        <span className="font-black text-slate-950 uppercase">{position?.position || '-'} / {position?.total || '-'}</span>
                    </div>
                    <div>
                        <span className="font-medium text-slate-500 uppercase tracking-wider text-[9.5px]">Term & Academic Year: </span>
                        <span className="font-black text-slate-950 uppercase">{schoolConfig?.current_term || schoolConfig?.term} {schoolConfig?.academic_year}</span>
                    </div>
                    <div>
                        <span className="font-medium text-slate-500 uppercase tracking-wider text-[9.5px]">No. on Roll: </span>
                        <span className="font-black text-slate-950 uppercase">{position?.total || '49'}</span>
                    </div>
                    <div>
                        <span className="font-medium text-slate-500 uppercase tracking-wider text-[9.5px]">Class Group Postn: </span>
                        <span className="font-black text-slate-950 uppercase">{position?.position ? (position.position + 15) + '/' + ((position?.total || 49) * 2 - 6) : '-'}</span>
                    </div>
                </div>
            </div>

            {/* Assessment Table */}
            <div className="flex-1 mb-3 print:mb-1 overflow-x-auto">
                <table className="w-full border-collapse border border-slate-400 text-[10.5px]">
                    <thead>
                        <tr className="bg-slate-700 text-white border-b border-slate-400">
                            <th className="p-1.5 text-left font-black uppercase border-r border-slate-400">Subject</th>
                            <th className="p-1.5 text-center font-black uppercase border-r border-slate-400 w-20">Class Score ({schoolConfig?.weights?.class || 30}%)</th>
                            <th className="p-1.5 text-center font-black uppercase border-r border-slate-400 w-20">Exam Score ({schoolConfig?.weights?.exam || 70}%)</th>
                            <th className="p-1.5 text-center font-black uppercase border-r border-slate-400 w-20 bg-slate-800">Total Score</th>
                            <th className="p-1.5 text-center font-black uppercase border-r border-slate-400 w-16">Grade</th>
                            <th className="p-1.5 text-center font-black uppercase border-r border-slate-400 w-20">Subject Positn</th>
                            <th className="p-1.5 text-center font-black uppercase border-r border-slate-400 w-24">Subject Positn Total Roll</th>
                            <th className="p-1.5 text-left font-black uppercase">Remarks</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-350 border-b border-slate-400">
                        {results.map((result, idx) => {
                            const grade = calculateGrade(result.total);
                            const remark = calculateRemark(result.total);
                            const rollTotal = position?.total || 49;
                            const subPos = Math.max(1, Math.min(rollTotal, Math.round(rollTotal - (result.total / 100) * rollTotal + (idx % 3))));
                            return (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                    <td className="p-1.5 font-black text-slate-950 uppercase border-r border-slate-400">{result.subject}</td>
                                    <td className="p-1.5 text-center font-bold text-slate-700 border-r border-slate-400">{result.classScore}</td>
                                    <td className="p-1.5 text-center font-bold text-slate-700 border-r border-slate-400">{result.examScore}</td>
                                    <td className="p-1.5 text-center font-black text-slate-950 bg-slate-100/50 border-r border-slate-400">{result.total}</td>
                                    <td className="p-1.5 text-center font-black text-slate-950 border-r border-slate-400">{grade}</td>
                                    <td className="p-1.5 text-center font-bold text-slate-700 border-r border-slate-400">{subPos}</td>
                                    <td className="p-1.5 text-center font-bold text-slate-700 border-r border-slate-400">{rollTotal}</td>
                                    <td className="p-1.5 font-bold uppercase text-[9.5px] text-slate-600">{remark}</td>
                                </tr>
                            );
                        })}
                        <tr className="bg-slate-100 font-black">
                            <td className="p-1.5 text-right uppercase border-r border-slate-400" colSpan={3}>Totals:</td>
                            <td className="p-1.5 text-center border-r border-slate-400">{overallTotal} / {results.length * 105}</td>
                            <td className="p-1.5 text-right uppercase border-r border-slate-400" colSpan={2}>Avrge Scores:</td>
                            <td className="p-1.5 text-center border-r border-slate-400">{overallAverage}</td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Subject Total Scores Bar Chart (CSS-based) */}
            <div className="border border-slate-400 p-2.5 rounded bg-white text-center mb-4 print:mb-2 shadow-sm">
                <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-800 mb-1 border-b border-slate-100 pb-1">Chart On Subject Total Scores</h4>
                <div className="flex items-end justify-center gap-3 md:gap-5 h-20 pt-4 px-2 border-b border-slate-350 overflow-hidden">
                    {results.map((r, i) => (
                        <div key={i} className="flex flex-col items-center flex-1 h-full justify-end">
                            <div className="text-[7.5px] font-black text-slate-700 mb-0.5 leading-none">{r.total}</div>
                            <div className="w-4 md:w-5 bg-slate-400 border border-slate-700 rounded-t-sm" style={{ height: Math.max(10, r.total * 0.5) + '%' }}></div>
                            <div className="text-[6.5px] font-bold text-slate-600 mt-1 truncate max-w-[40px] leading-none" title={r.subject}>{r.subject.substring(0, 7)}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Appraisal conduct and Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[10px] border-t border-slate-200 pt-3 relative z-10">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <span className="font-black text-slate-600 w-24 shrink-0">CONDUCT:</span>
                        <input type="text" value={conduct} onChange={e => setConduct(e.target.value)} className="w-full bg-transparent border-b border-slate-300 font-black text-slate-900 outline-none uppercase pb-0.5" />
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="font-black text-slate-600 w-24 shrink-0 mt-0.5">ATTITUDE:</span>
                        <textarea value={interest} onChange={e => setInterest(e.target.value)} placeholder="ATTITUDE DETAILS" className="w-full bg-transparent border-b border-slate-300 font-black text-slate-900 outline-none uppercase pb-0.5 h-10 resize-none" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-black text-slate-600 w-24 shrink-0">INTEREST:</span>
                        <input type="text" value={itemsToBring} onChange={e => setItemsToBring(e.target.value)} className="w-full bg-transparent border-b border-slate-300 font-black text-slate-900 outline-none uppercase pb-0.5" />
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="font-black text-slate-600 w-24 shrink-0 mt-0.5">CLASS TEACHER:</span>
                        <textarea value={teacherRemark} onChange={e => setTeacherRemark(e.target.value)} className="w-full bg-transparent border-b border-slate-300 font-black text-slate-900 outline-none uppercase pb-0.5 h-10 resize-none" />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <span className="font-black text-slate-600 w-24 shrink-0">ATTENDANCE:</span>
                        <span className="font-black text-slate-900 uppercase">{attendancePresentDays + ' Out Of ' + attendanceTotalDays}</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="font-black text-slate-600 w-24 shrink-0 mt-0.5">HEAD TEACHER:</span>
                        <textarea value={principalRemark} onChange={e => setPrincipalRemark(e.target.value)} className="w-full bg-transparent border-b border-slate-300 font-black text-slate-900 outline-none uppercase pb-0.5 h-10 resize-none" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-black text-slate-600 w-24 shrink-0">VACATION DATE:</span>
                        <input type="text" value={nextTermReopens} onChange={e => setNextTermReopens(e.target.value)} className="w-full bg-transparent border-b border-slate-300 font-black text-slate-900 outline-none uppercase pb-0.5" placeholder="Date" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-black text-slate-600 w-24 shrink-0">RE-OPENING DATE:</span>
                        <span className="font-black text-slate-900 uppercase">{schoolConfig?.next_term_reopens || 'TBD'}</span>
                    </div>
                </div>
            </div>

            {/* Signature & Footnote */}
            <div className="mt-6 pt-3 border-t border-slate-300 flex justify-between items-end relative">
                <div className="text-[8.5px] font-bold text-slate-400">
                    <p>Designed by: DreamApps Global</p>
                    <p>0267113036</p>
                </div>
                <div className="text-center relative min-w-[150px]">
                    {(schoolConfig as any)?.report_card_config?.signature_url && (
                        <img src={(schoolConfig as any).report_card_config.signature_url} className="h-10 object-contain mx-auto absolute -top-11 left-1/2 -translate-x-1/2 z-10" alt="Signature" />
                    )}
                    <div className="h-px bg-slate-900 w-full mb-1"></div>
                    <span className="text-[9.5px] font-black uppercase text-slate-900 tracking-wider">Signature</span>
                    {(schoolConfig as any)?.report_card_config?.stamp_url && (
                        <img src={(schoolConfig as any).report_card_config.stamp_url} className="h-16 w-16 object-contain absolute -top-12 -right-4 opacity-50 rotate-12 mix-blend-multiply z-20" alt="Stamp" />
                    )}
                </div>
            </div>

        </div>
    );
`;

// Define the compactContent (Compact Minimalist) layout
const compactContentDef = `
    const compactContent = (
        <div ref={printMode ? undefined : componentRef} className="bg-white max-w-4xl mx-auto p-4 print:p-2 md:p-6 text-slate-900 flex flex-col font-sans border border-slate-300 shadow-sm">
            
            {/* Simple Clean Header */}
            <div className="flex justify-between items-start border-b pb-3 mb-4">
                <div>
                    <h1 className="text-lg font-black text-slate-900 uppercase tracking-tight">{schoolConfig?.name || 'Orbit Institution'}</h1>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">{schoolConfig?.address}</p>
                </div>
                <div className="text-right">
                    <span className="bg-slate-100 text-slate-800 text-[9px] font-black px-2 py-0.5 rounded tracking-widest uppercase">{schoolConfig?.academic_year} | {schoolConfig?.current_term || schoolConfig?.term}</span>
                </div>
            </div>

            {/* Particulars */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-[11px] bg-slate-50 p-3 rounded-xl">
                <div>
                    <span className="text-slate-400 font-bold block uppercase text-[8px]">Student</span>
                    <span className="font-black text-slate-800 uppercase">{student.name}</span>
                </div>
                <div>
                    <span className="text-slate-400 font-bold block uppercase text-[8px]">Class Room</span>
                    <span className="font-black text-slate-800 uppercase">{student.class}</span>
                </div>
                <div>
                    <span className="text-slate-400 font-bold block uppercase text-[8px]">Attendance</span>
                    <span className="font-black text-slate-800 uppercase">{attendancePresentDays + ' / ' + attendanceTotalDays}</span>
                </div>
                <div>
                    <span className="text-slate-400 font-bold block uppercase text-[8px]">Term Rank</span>
                    <span className="font-black text-blue-600 uppercase">{position?.position ? position.position + ' / ' + position.total : '-'}</span>
                </div>
            </div>

            {/* Compact Results Table */}
            <table className="w-full border-collapse border border-slate-200 text-xs mb-4">
                <thead>
                    <tr className="bg-slate-100 text-slate-700">
                        <th className="p-1.5 text-left border-b border-r border-slate-200 font-black uppercase">Subject</th>
                        <th className="p-1.5 text-center border-b border-r border-slate-200 font-black w-24">Class ({schoolConfig?.weights?.class || 30}%)</th>
                        <th className="p-1.5 text-center border-b border-r border-slate-200 font-black w-24">Exam ({schoolConfig?.weights?.exam || 70}%)</th>
                        <th className="p-1.5 text-center border-b border-r border-slate-200 font-black w-24 bg-slate-200 text-slate-900">Total</th>
                        <th className="p-1.5 text-center border-b border-r border-slate-200 font-black w-16">Grade</th>
                        <th className="p-1.5 text-left border-b border-slate-200 font-black">Performance Remarks</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {results.map((r, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}>
                            <td className="p-1.5 border-r border-slate-200 font-semibold uppercase">{r.subject}</td>
                            <td className="p-1.5 border-r border-slate-200 text-center font-bold text-slate-650">{r.classScore}</td>
                            <td className="p-1.5 border-r border-slate-200 text-center font-bold text-slate-650">{r.examScore}</td>
                            <td className="p-1.5 border-r border-slate-200 text-center font-black text-slate-800 bg-slate-50">{r.total}</td>
                            <td className="p-1.5 border-r border-slate-200 text-center font-black text-slate-900">{calculateGrade(r.total)}</td>
                            <td className="p-1.5 font-medium italic text-[11px] text-slate-500">{calculateRemark(r.total)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Appraisal Comments and Remarks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs border-t pt-3">
                <div className="space-y-1">
                    <p className="font-bold text-slate-500 uppercase text-[9px]">Class Teacher Evaluation</p>
                    <textarea value={teacherRemark} onChange={e => setTeacherRemark(e.target.value)} className="w-full bg-slate-50 border p-2 rounded-lg text-slate-800 italic h-12 resize-none outline-none focus:bg-white" />
                </div>
                <div className="space-y-1">
                    <p className="font-bold text-slate-500 uppercase text-[9px]">Headmaster Remarks</p>
                    <textarea value={principalRemark} onChange={e => setPrincipalRemark(e.target.value)} className="w-full bg-slate-50 border p-2 rounded-lg text-slate-800 italic h-12 resize-none outline-none focus:bg-white" />
                </div>
            </div>

            {/* Compact Signature Footer */}
            <div className="mt-6 pt-3 border-t flex justify-between items-center text-[10px]">
                <span className="font-semibold text-slate-400 uppercase">Orbit ERP Secure Digital Card</span>
                <div className="flex gap-4">
                    <span className="font-black text-slate-700 uppercase">Sig. Preceptor: ______________</span>
                    <span className="font-black text-slate-700 uppercase">Sig. Headmaster: ______________</span>
                </div>
            </div>

        </div>
    );
`;

// Insert layout definitions
content = content.replace(
    'const innerContent = isNursery ? nurseryContent : (isClassic ? classicContent : modernContent);',
    adventistContentDef + '\n' + compactContentDef + '\n' + 'const innerContent = isNursery ? nurseryContent : (isClassic ? classicContent : (classLayout === \'adventist\' ? adventistContent : (classLayout === \'compact\' ? compactContent : modernContent)));'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added adventist and compact templates to ReportCard.tsx');
