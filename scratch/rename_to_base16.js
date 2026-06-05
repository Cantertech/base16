import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '..', 'components', 'ReportCard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Replace all occurrences of Orbit naming in ReportCard.tsx
content = content.replace('Orbit Learning Management System', 'Base16 Schools Management System');
content = content.replace('Orbit SMS v2.0', 'Base16 SMS v2.0');
content = content.replace('\'Orbit Academy\'', '\'Base16 School\'');
content = content.replace('Orbit Education ERP System', 'Base16 Schools Management System');
content = content.replace('\'Orbit Institution\'', '\'Base16 School\'');
content = content.replace('Orbit ERP Secure Digital Card', 'Base16 SMS Secure Digital Card');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully replaced all Orbit brand references with Base16 in ReportCard.tsx');
