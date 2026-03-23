import fs from 'fs';

const content = fs.readFileSync('c:\\Users\\silas\\Desktop\\orbit\\components\\ReportCard.tsx', 'utf8');

function checkBalance(text) {
    let openDivs = 0;
    let braces = 0;
    let lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const open = (line.match(/<div/g) || []).length;
        const close = (line.match(/<\/div>/g) || []).length;
        openDivs += open;
        openDivs -= close;

        const openBrace = (line.match(/\{/g) || []).length;
        const closeBrace = (line.match(/\}/g) || []).length;
        braces += openBrace;
        braces -= closeBrace;

        if (openDivs < 0) console.log(`Negative divs at line ${i + 1}`);
        if (braces < 0) console.log(`Negative braces at line ${i + 1}`);
    }

    console.log(`Final open divs: ${openDivs}`);
    console.log(`Final braces: ${braces}`);
}

checkBalance(content);
