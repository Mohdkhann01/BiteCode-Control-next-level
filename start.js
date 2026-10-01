import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const root = path.dirname(fileURLToPath(import.meta.url));
const children = [];

function run(name, args, cwd) {
  const child = spawn(npm, args, { cwd, stdio: 'inherit', shell: false });
  child.on('error', (err) => console.error(`[${name}] ${err.message}`));
  child.on('exit', (code, signal) => {
    if (signal) console.log(`[${name}] stopped (${signal})`);
    else if (code && code !== 0) console.log(`[${name}] exited with code ${code}`);
  });
  children.push(child);
}

console.log('Starting BiteCode Control...');
console.log('Frontend: http://localhost:5173');
console.log('Backend:  http://localhost:5000/api/health');

run('backend', ['start'], path.join(root, 'backend'));
run('frontend', ['run', 'dev'], path.join(root, 'frontend'));

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);
