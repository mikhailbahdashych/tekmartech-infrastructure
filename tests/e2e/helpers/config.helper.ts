import path from 'path';
import fs from 'fs';

// Determine environment: NODE_ENV controls which env file to load
const env = process.env.NODE_ENV || 'development';
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const envFile = path.resolve(repoRoot, 'env', `.env.${env}`);

if (fs.existsSync(envFile)) {
  // Parse and load without overriding existing process.env values
  const content = fs.readFileSync(envFile, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...rest] = trimmed.split('=');
    const k = key.trim();
    if (!(k in process.env)) {
      process.env[k] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
}

// Generate a unique run ID once per process — shared across all spec files.
// Written to a temp file so that the cleanup script knows which run to target.
const RUN_ID_FILE = path.resolve(__dirname, '..', '.run-id');

function getRunId(): string {
  // If this process already wrote a run ID, reuse it
  if (process.env.__E2E_RUN_ID) return process.env.__E2E_RUN_ID;

  // If the file exists and was written within the last 30 minutes, reuse it
  // (handles the case where Playwright spawns multiple workers)
  if (fs.existsSync(RUN_ID_FILE)) {
    const stat = fs.statSync(RUN_ID_FILE);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs < 30 * 60 * 1000) {
      const id = fs.readFileSync(RUN_ID_FILE, 'utf-8').trim();
      process.env.__E2E_RUN_ID = id;
      return id;
    }
  }

  // Generate new run ID
  const id = Date.now().toString();
  fs.writeFileSync(RUN_ID_FILE, id);
  process.env.__E2E_RUN_ID = id;
  return id;
}

const runId = getRunId();

export const config = {
  runId,
  env,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',
  apiUrl: process.env.API_URL || 'http://localhost:3000/api/v1',
  pipelineUrl: process.env.PIPELINE_URL || 'http://localhost:8100',

  testUserEmail: `e2e-test-${runId}@tekmar.test`,
  testUserPassword: process.env.TEST_USER_PASSWORD || 'E2eTestPass123!',
  testUserDisplayName: 'E2E Test Admin',
  testOrgName: process.env.TEST_ORG_NAME || `E2E Test Org ${runId}`,

  secondUserPassword: 'InvitedPass456!',

  githubPat: process.env.GITHUB_TEST_PAT || '',
  githubOrg: process.env.GITHUB_TEST_ORG || '',

  awsAccessKeyId: process.env.AWS_TEST_ACCESS_KEY_ID || '',
  awsSecretAccessKey: process.env.AWS_TEST_SECRET_ACCESS_KEY || '',
  awsRegion: process.env.AWS_TEST_REGION || '',

  get hasGitHub(): boolean {
    return !!(this.githubPat && this.githubOrg);
  },

  get hasAws(): boolean {
    return !!(this.awsAccessKeyId && this.awsSecretAccessKey && this.awsRegion);
  },
};
