import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '..', 'components', 'Exams.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Locate and update saveConfigMutation's onSuccess to use setQueryData
const oldMutationSuccess = `        onSuccess: (newConfig) => {
            queryClient.invalidateQueries({ queryKey: ['examConfig', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['schoolInfo', schoolId] }); // Config is also in school info json
            // Refetch results as term/year might have changed
            queryClient.invalidateQueries({ queryKey: ['examResults', schoolId] });
            toast('success', 'Configuration Saved', 'Exam configuration saved successfully!');
        },`;

const newMutationSuccess = `        onSuccess: (newConfig) => {
            // Instantly update the local query cache to trigger immediate UI reflection without reload
            queryClient.setQueryData(['examConfig', schoolId], newConfig);
            queryClient.setQueryData(['schoolInfo', schoolId], (old: any) => {
                if (!old) return old;
                return {
                    ...old,
                    exam_config: newConfig,
                    report_card_config: newConfig.report_card_config || old.report_card_config
                };
            });

            queryClient.invalidateQueries({ queryKey: ['examConfig', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['schoolInfo', schoolId] });
            queryClient.invalidateQueries({ queryKey: ['examResults'] });
            queryClient.invalidateQueries({ queryKey: ['reportCards'] });
            
            toast('success', 'Configuration Saved', 'Exam configuration saved successfully!');
        },`;

if (content.includes(oldMutationSuccess)) {
    content = content.replace(oldMutationSuccess, newMutationSuccess);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Successfully updated Exams.tsx saveConfigMutation with direct cache setters.');
} else {
    console.error('Could not locate saveConfigMutation.onSuccess inside Exams.tsx');
}
