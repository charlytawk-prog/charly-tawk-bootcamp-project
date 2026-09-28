const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const testImage = 'charly-tawk-bootcamp-project-test';
const composeNetwork = 'charly-tawk-bootcamp-project_default';

function run(command, args, options = {}) {
  const isWindowsNpm = process.platform === 'win32' && command === 'npm';
  const executable = isWindowsNpm ? (process.env.ComSpec || 'cmd.exe') : command;
  const executableArgs = isWindowsNpm
    ? ['/d', '/s', '/c', `npm ${args.join(' ')}`]
    : args;
  return spawnSync(executable, executableArgs, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    ...options,
  });
}

function runSuccessfully(command, args, options) {
  const result = run(command, args, options);
  if (result.error) {
    console.error(result.error.message);
    return false;
  }
  return result.status === 0;
}

function readTestDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  const envFile = path.join(root, '.env');
  if (!fs.existsSync(envFile)) return null;

  const setting = fs.readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .find((line) => /^\s*TEST_DATABASE_URL\s*=/.test(line));
  if (!setting) return null;

  let value = setting.slice(setting.indexOf('=') + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return value || null;
}

function dockerTestDatabaseUrl() {
  const configuredUrl = readTestDatabaseUrl();
  if (!configuredUrl) {
    throw new Error('TEST_DATABASE_URL is missing from the environment and .env.');
  }

  let databaseUrl;
  try {
    databaseUrl = new URL(configuredUrl);
  } catch {
    throw new Error('TEST_DATABASE_URL is not a valid URL.');
  }

  if (databaseUrl.pathname.replace(/^\//, '') !== 'ops_hub_test') {
    throw new Error('TEST_DATABASE_URL must target the ops_hub_test database.');
  }

  databaseUrl.hostname = 'postgres';
  return databaseUrl.toString();
}

function runDockerWorkflow() {
  const commands = [
    ['docker', ['compose', 'up', '-d', 'postgres']],
    ['docker', ['build', '--target', 'test', '-t', testImage, '.']],
  ];

  for (const [command, args] of commands) {
    if (!runSuccessfully(command, args)) return false;
  }

  let testDatabaseUrl;
  try {
    testDatabaseUrl = dockerTestDatabaseUrl();
  } catch (error) {
    console.error(error.message);
    return false;
  }

  const migrationArgs = [
    'run', '--rm', '--network', composeNetwork,
    '--env-file', '.env',
    '-e', `DATABASE_URL=${testDatabaseUrl}`,
    testImage, 'npx', 'prisma', 'migrate', 'deploy',
  ];
  if (!runSuccessfully('docker', migrationArgs)) return false;

  const testArgs = [
    'run', '--rm', '--network', composeNetwork,
    '--env-file', '.env',
    testImage,
  ];
  return runSuccessfully('docker', testArgs);
}

function printReleaseIdentity() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const commit = result.status === 0 ? result.stdout.trim() : 'unavailable';
  console.log(`Commit SHA: ${commit}`);
  console.log(`Time: ${new Date().toISOString()}`);
}

function cleanTree() {
  const result = spawnSync('git', ['status', '--short'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error || result.status !== 0) {
    console.error(result.error?.message || result.stderr.trim());
    return false;
  }
  if (result.stdout.trim()) {
    process.stdout.write(result.stdout);
    return false;
  }
  return true;
}

printReleaseIdentity();

const steps = [
  ['Backend build', () => runSuccessfully('npm', ['run', 'build'])],
  ['Frontend build', () => runSuccessfully('npm', ['--prefix', 'frontend', 'run', 'build'])],
  ['README container tests', runDockerWorkflow],
  ['Clean tree check', cleanTree],
];

let passed = true;
for (const [name, action] of steps) {
  let stepPassed = false;
  try {
    stepPassed = action();
  } catch (error) {
    console.error(error.message);
  }
  console.log(`${stepPassed ? 'PASS' : 'FAIL'} ${name}`);
  if (!stepPassed) {
    passed = false;
    break;
  }
}

console.log(`RELEASE GATE: ${passed ? 'GO' : 'NO-GO'}`);
process.exitCode = passed ? 0 : 1;