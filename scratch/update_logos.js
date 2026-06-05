import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.join(__dirname, '..');

// 1. Update Footer.tsx
const footerPath = path.join(projectRoot, 'components', 'Footer.tsx');
if (fs.existsSync(footerPath)) {
    let footer = fs.readFileSync(footerPath, 'utf8');
    footer = footer.replace('/orbit_logo.jpg', '/orbit_logo_new.png');
    fs.writeFileSync(footerPath, footer, 'utf8');
    console.log('Updated Footer.tsx logo');
}

// 2. Update InstallPrompt.tsx
const installPath = path.join(projectRoot, 'components', 'InstallPrompt.tsx');
if (fs.existsSync(installPath)) {
    let install = fs.readFileSync(installPath, 'utf8');
    install = install.replaceAll('shrink-0 bg-white p-1 rounded-xl shadow-sm', 'shrink-0 p-1');
    install = install.replaceAll('/orbit_logo.jpg', '/orbit_transparent_white_logo.png');
    fs.writeFileSync(installPath, install, 'utf8');
    console.log('Updated InstallPrompt.tsx logo');
}

// 3. Update Loading.tsx
const loadingPath = path.join(projectRoot, 'components', 'Loading.tsx');
if (fs.existsSync(loadingPath)) {
    let loading = fs.readFileSync(loadingPath, 'utf8');
    loading = loading.replace('/orbit_logo.jpg', '/orbit_logo_new.png');
    fs.writeFileSync(loadingPath, loading, 'utf8');
    console.log('Updated Loading.tsx logo');
}

// 4. Update Login.tsx
const loginPath = path.join(projectRoot, 'components', 'Login.tsx');
if (fs.existsSync(loginPath)) {
    let login = fs.readFileSync(loginPath, 'utf8');
    login = login.replace('/orbit_logo.jpg', '/orbit_transparent_white_logo.png');
    fs.writeFileSync(loginPath, login, 'utf8');
    console.log('Updated Login.tsx logo');
}

// 5. Update Navbar.tsx
const navbarPath = path.join(projectRoot, 'components', 'Navbar.tsx');
if (fs.existsSync(navbarPath)) {
    let navbar = fs.readFileSync(navbarPath, 'utf8');
    navbar = navbar.replace('/orbit_logo.jpg', '/orbit_transparent_white_logo.png');
    navbar = navbar.replace('rounded-lg shadow-md border border-white/20', '');
    fs.writeFileSync(navbarPath, navbar, 'utf8');
    console.log('Updated Navbar.tsx logo');
}

// 6. Update index.html
const htmlPath = path.join(projectRoot, 'index.html');
if (fs.existsSync(htmlPath)) {
    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace('https://base16schools.com/orbit_logo.jpg', '/orbit_logo_new.png');
    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log('Updated index.html logo');
}
