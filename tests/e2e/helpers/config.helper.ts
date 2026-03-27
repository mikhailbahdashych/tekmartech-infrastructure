import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env.test if it exists, then fallback to env/.env.development
const envTestPath = path.resolve(__dirname, '..', '.env.test');
const envDevPath = path.resolve(__dirname, '..', '..', '..', 'env', '.env.development');

if (fs.existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath });
} else {
  dotenv.config({ path: envDevPath });
}

const ts = Date.now();

export const config = {
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:4200',
  apiUrl: process.env.API_URL || 'http://localhost:3000/api/v1',
  pipelineUrl: process.env.PIPELINE_URL || 'http://localhost:8100',

  testUserEmail: `${process.env.TEST_USER_EMAIL_PREFIX || 'e2e-test'}-${ts}@tekmar.test`,
  testUserPassword: process.env.TEST_USER_PASSWORD || 'E2eTestPass123!',
  testUserDisplayName: 'E2E Test Admin',
  testOrgName: process.env.TEST_ORG_NAME || `E2E Test Org ${ts}`,

  secondUserEmail: `e2e-invited-${ts}@tekmar.test`,
  secondUserPassword: 'InvitedPass456!',
  secondUserDisplayName: 'E2E Invited User',

  memberUserEmail: `e2e-member-${ts}@tekmar.test`,
  memberUserPassword: 'MemberPass789!',
  memberUserDisplayName: 'E2E Member User',

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
