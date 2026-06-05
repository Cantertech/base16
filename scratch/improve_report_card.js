import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '..', 'components', 'ReportCard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add printStyles definition and include it in return statements
if (!content.includes('const printStyles =')) {
    const printStylesDef = `
    const printStyles = (
        <style dangerouslySetInnerHTML={{__html: \`
            @media print {
                @page {
                    size: A4 portrait;
                    margin: 5mm 6mm 5mm 6mm !important;
                }
                body {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    background-color: white !important;
                }
                .print\\\\:min-h-0 {
                    min-height: 0 !important;
                }
                /* Compact spacing specifically for printing on 1 page */
                .print\\\\:mb-1 { margin-bottom: 0.25rem !important; }
                .print\\\\:mb-2 { margin-bottom: 0.5rem !important; }
                .print\\\\:mb-3 { margin-bottom: 0.75rem !important; }
                .print\\\\:mb-4 { margin-bottom: 1rem !important; }
                .print\\\\:mt-2 { margin-top: 0.5rem !important; }
                .print\\\\:mt-4 { margin-top: 1rem !important; }
                .print\\\\:py-0\\\\.5 { padding-top: 0.125rem !important; padding-bottom: 0.125rem !important; }
                .print\\\\:py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
                .print\\\\:p-2 { padding: 0.5rem !important; }
                .print\\\\:p-3 { padding: 0.75rem !important; }
                .print\\\\:p-4 { padding: 1rem !important; }
                .print-page-break {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }
            }
        \`}} />
    );
`;

    // Insert printStylesDef right after const componentRef = useRef<HTMLDivElement>(null);
    content = content.replace(
        'const componentRef = useRef<HTMLDivElement>(null);',
        'const componentRef = useRef<HTMLDivElement>(null);' + printStylesDef
    );

    // Insert {printStyles} inside returns
    content = content.replace(
        'return (\n            <div className="print-page-break"',
        'return (\n            <div className="print-page-break">\n                {printStyles}'
    );
    content = content.replace(
        'return (\n        <div className="fixed inset-0',
        'return (\n        <div className="fixed inset-0">\n            {printStyles}'
    );
}

// 2. Perform font scale-up transformations (careful mapping to not mess up styling syntax)
const replacements = [
    { from: /text-\[5px\]/g, to: 'text-[9px]' },
    { from: /text-\[6px\]/g, to: 'text-[9px]' },
    { from: /text-\[7px\]/g, to: 'text-[10px]' },
    { from: /text-\[8px\]/g, to: 'text-[10.5px]' },
    { from: /text-\[9px\]/g, to: 'text-[11px]' },
    { from: /text-\[10px\]/g, to: 'text-[12px]' },
    { from: /text-\[11px\]/g, to: 'text-[12.5px]' }
];

replacements.forEach(r => {
    content = content.replace(r.from, r.to);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated font sizes and added printStyles to ReportCard.tsx');
