const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const rootDir = process.cwd();

console.log('🧹 Cleaning up environment & build artifacts...');

// 1. Clear terminal output
console.clear();

// 2. Remove specified files and directories safely
const targetsToClean = [
  '.env',
  'prisma.config.ts',
  'node_modules/.cache',
  'node_modules/.vite',
  'out',
  'prisma'
];

try {
  const vsixFiles = fs.readdirSync(rootDir).filter(file => file.endsWith('.vsix'));
  targetsToClean.push(...vsixFiles);
} catch (e) {
  // Ignore if directory can't be read
}

for (const target of targetsToClean) {
  const targetPath = path.join(rootDir, target);
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

// 3. Write fresh .env file
console.log('📝 Generating fresh .env file...');
const envContent = [
  'NODE_ENV=development',
  'DATABASE_URL=postgresql://mili:kiki-fake@localhost:5432/forms?schema=public'
].join('\n') + '\n';

fs.writeFileSync(path.join(rootDir, '.env'), envContent, 'utf8');

// 4. Clean and deduplicate .gitignore
console.log('🛡️ Updating .gitignore...');
const gitignorePath = path.join(rootDir, '.gitignore');
let lines = [];
if (fs.existsSync(gitignorePath)) {
  lines = fs.readFileSync(gitignorePath, 'utf8').split(/\r?\n/);
}

lines.push('/src/generated/prisma');

// Deduplicate, trim whitespace, and discard empty entries
const cleanLines = [...new Set(lines.map(line => line.trim()).filter(Boolean))];
fs.writeFileSync(gitignorePath, cleanLines.join('\n') + '\n', 'utf8');

// 5. Execute build commands synchronously
console.log('🚀 Running build & setup pipeline...');
try {
  execSync('pnpm build', { stdio: 'inherit' });
  execSync('pnpm ix', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Build failed during script execution.');
  process.exit(1);
}

console.log('✨ Workspace reset complete!');