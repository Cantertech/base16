import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '..', 'components', 'ReportCard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Tanstack Query useQueryClient import
if (!content.includes("import { useQueryClient }")) {
    content = "import { useQueryClient } from '@tanstack/react-query';\n" + content;
}

// 2. Add const queryClient = useQueryClient(); definition
if (!content.includes('const queryClient = useQueryClient();')) {
    content = content.replace(
        'const componentRef = useRef<HTMLDivElement>(null);',
        'const componentRef = useRef<HTMLDivElement>(null);\n    const queryClient = useQueryClient();'
    );
}

// 3. Invalidate query cache inside handleSave
const oldAlertString = 'if (error) throw error;\n            alert("Report card details saved successfully!");';
const newAlertString = 'if (error) throw error;\n            queryClient.invalidateQueries({ queryKey: [\'reportCards\'] });\n            alert("Report card details saved successfully!");';

if (content.includes(oldAlertString)) {
    content = content.replace(oldAlertString, newAlertString);
} else {
    // Alternate formatting search
    const oldAlertAlternate = 'if (error) throw error;\n            alert(\'Report card details saved successfully!\');';
    const newAlertAlternate = 'if (error) throw error;\n            queryClient.invalidateQueries({ queryKey: [\'reportCards\'] });\n            alert(\'Report card details saved successfully!\');';
    content = content.replace(oldAlertAlternate, newAlertAlternate);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully added react-query cache invalidation on save.');
