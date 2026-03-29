import { config } from './config.helper';

export async function checkServices(): Promise<void> {
  const issues: string[] = [];

  // Check frontend
  try {
    const resp = await fetch(config.frontendUrl, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok && resp.status !== 304) {
      issues.push(`Frontend at ${config.frontendUrl} returned ${resp.status}`);
    }
  } catch {
    issues.push(
      `Frontend not reachable at ${config.frontendUrl}. ` +
      `Start with: cd ../tekmar-interface && npm start`
    );
  }

  // Check API (expect 401 on protected endpoint)
  try {
    const resp = await fetch(`${config.apiUrl}/organization`, { signal: AbortSignal.timeout(5000) });
    if (resp.status !== 401 && resp.status !== 200) {
      issues.push(`API at ${config.apiUrl} returned unexpected status ${resp.status}`);
    }
  } catch {
    issues.push(
      `API not reachable at ${config.apiUrl}. ` +
      `Start with: cd ../tekmar-api && npm run start:dev`
    );
  }

  // Check pipeline
  try {
    const resp = await fetch(`${config.pipelineUrl}/health`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) {
      issues.push(`Pipeline at ${config.pipelineUrl} returned ${resp.status}`);
    }
  } catch {
    issues.push(
      `Pipeline not reachable at ${config.pipelineUrl}. ` +
      `Start with: cd ../tekmar-pipeline && uv run uvicorn app.main:app --port 8100 --reload`
    );
  }

  if (issues.length > 0) {
    throw new Error(
      `Service check failed:\n${issues.map(i => `  - ${i}`).join('\n')}\n\n` +
      `Ensure database is running: docker compose -f docker/docker-compose.yml up -d tekmar-db`
    );
  }
}
