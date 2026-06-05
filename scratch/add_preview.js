import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '..', 'components', 'ExamSetupPanel.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add import ReportCard
if (!content.includes("import ReportCard from './ReportCard';")) {
    content = "import ReportCard from './ReportCard';\n" + content;
}

// 2. Add mock data constants outside the component
const mockDataDefs = `
const MOCK_PREVIEW_STUDENT = {
    id: "preview-123",
    name: "Osei Bonsu Eden Obeng",
    class: "Class 5B",
    attendance: 70
};

const MOCK_PREVIEW_RESULTS = [
    { subject: "English Language", classScore: 39, examScore: 23, total: 62 },
    { subject: "History", classScore: 38, examScore: 20, total: 58 },
    { subject: "Creative Art", classScore: 43, examScore: 39, total: 82 },
    { subject: "Computing", classScore: 40, examScore: 38, total: 78 },
    { subject: "Mathematics", classScore: 22, examScore: 19, total: 41 }
];
`;

if (!content.includes('const MOCK_PREVIEW_STUDENT =')) {
    content = content.replace(
        'const GRADING_PRESETS = {',
        mockDataDefs + '\nconst GRADING_PRESETS = {'
    );
}

// 3. Add state inside the component
if (!content.includes('const [previewLayout, setPreviewLayout] =')) {
    content = content.replace(
        "const [classSearchQuery, setClassSearchQuery] = useState('');",
        "const [classSearchQuery, setClassSearchQuery] = useState('');\n    const [previewLayout, setPreviewLayout] = useState<string | null>(null);"
    );
}

// 4. Update template rendering in the Exams Report Design subtab to include the Preview button
const oldTemplateRender = `                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className={\`text-[10px] font-black uppercase px-2 py-0.5 rounded \${
                                                        isSelected ? 'bg-primary-100 text-primary-750' : 'bg-slate-100 text-slate-650'
                                                    }\`}>
                                                        {template.badge}
                                                    </span>
                                                    {isSelected && (
                                                        <span className="w-2.5 h-2.5 bg-primary-600 rounded-full"></span>
                                                    )}
                                                </div>
                                                <h4 className="font-bold text-slate-800 text-sm group-hover:text-primary-650 transition-colors">{template.name}</h4>
                                                <p className="text-xs text-slate-500 line-clamp-3 leading-snug">{template.desc}</p>
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-2 block">
                                                {isSelected ? 'Active Layout' : 'Select Template'}
                                            </span>`;

const newTemplateRender = `                                            <div className="space-y-2 w-full">
                                                <div className="flex justify-between items-center">
                                                    <span className={\`text-[10px] font-black uppercase px-2 py-0.5 rounded \${
                                                        isSelected ? 'bg-primary-100 text-primary-750' : 'bg-slate-100 text-slate-650'
                                                    }\`}>
                                                        {template.badge}
                                                    </span>
                                                    {isSelected && (
                                                        <span className="w-2.5 h-2.5 bg-primary-600 rounded-full"></span>
                                                    )}
                                                </div>
                                                <h4 className="font-bold text-slate-800 text-sm group-hover:text-primary-650 transition-colors">{template.name}</h4>
                                                <p className="text-xs text-slate-500 line-clamp-2 leading-snug">{template.desc}</p>
                                            </div>
                                            <div className="w-full mt-2 space-y-1.5">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPreviewLayout(template.id);
                                                    }}
                                                    className="w-full py-1.5 border border-slate-300 hover:border-primary-500 hover:text-primary-600 text-[10px] font-black uppercase rounded-xl text-center transition-all bg-white"
                                                >
                                                    Preview Design
                                                </button>
                                                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center block">
                                                    {isSelected ? 'Active Default Layout' : 'Click Card to Set Default'}
                                                </span>
                                            </div>`;

content = content.replace(oldTemplateRender, newTemplateRender);

// 6. Append ReportCard modal portal at the end of the root layout container of ExamSetupPanel
const reportCardModal = `            {previewLayout && (
                <ReportCard
                    student={MOCK_PREVIEW_STUDENT}
                    results={MOCK_PREVIEW_RESULTS}
                    onClose={() => setPreviewLayout(null)}
                    schoolConfig={{
                        name: localConfig.exam_name || "Orbit Academy",
                        logo_url: localConfig.report_card_config?.stamp_url || "",
                        current_term: localConfig.current_term,
                        academic_year: localConfig.academic_year,
                        grading: localConfig.grading,
                        grading_type: localConfig.grading_type,
                        report_card_config: {
                            layout: previewLayout,
                            show_position: true,
                            show_attendance: true,
                            show_class_teacher_remark: true,
                            show_head_teacher_remark: true,
                            show_student_photo: true
                        }
                    }}
                    position={{ position: 33, total: 49 }}
                    schoolId="preview-school"
                />
            )}
        </div>
    );
};`;

content = content.replace(
    `        </div>\n    );\n};`,
    reportCardModal
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added live template preview support to ExamSetupPanel.tsx');
