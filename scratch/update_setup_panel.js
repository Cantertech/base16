import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '..', 'components', 'ExamSetupPanel.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add activeSubTab type update
content = content.replace(
    "const [activeSubTab, setActiveSubTab] = useState<'general' | 'grading' | 'layouts' | 'branding' | 'global'>('general');",
    "const [activeSubTab, setActiveSubTab] = useState<'general' | 'grading' | 'design' | 'layouts' | 'branding' | 'global'>('general');"
);

// 2. Add design tab to subTabs array
content = content.replace(
    `    const subTabs = [
        { id: 'general', label: 'General & Weights', icon: Settings },
        { id: 'grading', label: 'Grading Scales', icon: Award },
        { id: 'layouts', label: 'Class Layouts', icon: Layers },
        { id: 'branding', label: 'Signature & Stamp', icon: ImageIcon },
        { id: 'global', label: 'Global Sections', icon: FileText }
    ] as const;`,
    `    const subTabs = [
        { id: 'general', label: 'General & Weights', icon: Settings },
        { id: 'grading', label: 'Grading Scales', icon: Award },
        { id: 'design', label: 'Exams Report Design', icon: FileText },
        { id: 'layouts', label: 'Class Layouts', icon: Layers },
        { id: 'branding', label: 'Signature & Stamp', icon: ImageIcon },
        { id: 'global', label: 'Global Sections', icon: FileText }
    ] as const;`
);

// 3. Add batch assign options for layoutId
content = content.replace(
    `                                    {['modern', 'classic_tabular', 'nursery'].map(layoutId => (`,
    `                                    {['modern', 'classic_tabular', 'nursery', 'adventist', 'compact'].map(layoutId => (`
);

content = content.replace(
    `                                            {layoutId === 'modern' ? 'Standard' : layoutId === 'classic_tabular' ? 'Classic' : 'Nursery'}`,
    `                                            {layoutId === 'modern' ? 'Standard' : (layoutId === 'classic_tabular' ? 'Classic' : (layoutId === 'nursery' ? 'Nursery' : (layoutId === 'adventist' ? 'Chart' : 'Minimalist')))}`
);

// 4. Add template list inside class layout loop
content = content.replace(
    `                                                        {[
                                                            { id: 'modern', label: 'Standard' },
                                                            { id: 'classic_tabular', label: 'Classic' },
                                                            { id: 'nursery', label: 'Nursery' }
                                                        ].map(layout => {`,
    `                                                        {[
                                                            { id: 'modern', label: 'Standard' },
                                                            { id: 'classic_tabular', label: 'Classic' },
                                                            { id: 'nursery', label: 'Nursery' },
                                                            { id: 'adventist', label: 'Chart' },
                                                            { id: 'compact', label: 'Minimal' }
                                                        ].map(layout => {`
);

// 5. Inject exams report design view rendering before Branding Sub-Tab
const designTabRendering = `
                    {/* Exams Report Design Sub-Tab */}
                    {activeSubTab === 'design' && (
                        <div className="space-y-6 animate-in fade-in duration-200">
                            {renderPanelHeader('Exams Report Design', 'Choose a default layout template for student terminal report cards.')}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {[
                                    { id: 'modern', name: 'Standard Modern', desc: 'Clean sans-serif fonts, blue/slate brand highlights, rounded status badges.', badge: 'Standard' },
                                    { id: 'classic_tabular', name: 'Classic Tabular', desc: 'Traditional institutional layout, high-contrast black borders, classic layout grid.', badge: 'Classic' },
                                    { id: 'nursery', name: 'Nursery Narrative', desc: 'Georgia serif fonts, narrative developmental milestones, decorative corner frames.', badge: 'Nursery' },
                                    { id: 'adventist', name: 'Chart-Integrated Classic', desc: 'Inspired by J.A. Boateng. Features dynamic horizontal bar charts mapping subject scores.', badge: 'New/Chart' },
                                    { id: 'compact', name: 'Compact Minimalist', desc: 'High-contrast grid lines, minimalist layout structure optimized to fit single-page print constraints.', badge: 'Minimalist' }
                                ].map(template => {
                                    const isSelected = (localConfig?.report_card_config?.layout || 'modern') === template.id;
                                    return (
                                        <button
                                            key={template.id}
                                            type="button"
                                            onClick={() => {
                                                setLocalConfig({
                                                    ...localConfig,
                                                    report_card_config: {
                                                        ...(localConfig.report_card_config || {}),
                                                        layout: template.id
                                                    }
                                                });
                                            }}
                                            className={\`p-5 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between h-44 group \${
                                                isSelected 
                                                    ? 'bg-primary-50/30 border-primary-500 shadow-sm' 
                                                    : 'bg-white border-slate-200 hover:border-slate-350 hover:bg-slate-50/30'
                                            }\`}
                                        >
                                            <div className="space-y-2">
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
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
`;

content = content.replace(
    '                    {/* Branding Sub-Tab */}',
    designTabRendering + '\n                    {/* Branding Sub-Tab */}'
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated ExamSetupPanel.tsx to support design selector tab');
