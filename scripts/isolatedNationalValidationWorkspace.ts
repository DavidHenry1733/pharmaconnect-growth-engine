/**
 * Isolated WORKSPACE_ROOT for offline National Search Intelligence validators.
 * Must be created before importing pharmacyWorkspacePaths (that module freezes the root at load).
 * Does not write into the repository config/projects directory.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CODE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const DATAFORSEO_CREDENTIAL_ENV_KEYS = [
  "DATAFORSEO_LOGIN",
  "DATAFORSEO_PASSWORD",
  "DATAFORSEO_API_LOGIN",
  "DATAFORSEO_API_PASSWORD",
  "DATAFORSEO_USER",
  "DATAFORSEO_PASS",
  "DATAFORSEO_USERNAME",
] as const;

export function stripDataForSeoCredentialEnv(): void {
  for (const key of DATAFORSEO_CREDENTIAL_ENV_KEYS) {
    delete process.env[key];
  }
}

export interface IsolatedNationalValidationWorkspace {
  root: string;
  codeRoot: string;
  writeProjectConfig: (slug: string, config: Record<string, unknown>) => string;
  cleanup: () => void;
}

export function createIsolatedNationalValidationWorkspace(options: {
  prefix: string;
  copyCommittedProjectSlugs?: string[];
}): IsolatedNationalValidationWorkspace {
  stripDataForSeoCredentialEnv();

  const previousWorkspaceRoot = process.env.WORKSPACE_ROOT;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), options.prefix));
  fs.mkdirSync(path.join(root, "data", "pharmacy-profiles"), { recursive: true });
  fs.mkdirSync(path.join(root, "data", "national-growth-engine"), { recursive: true });
  fs.mkdirSync(path.join(root, "fixtures", "national-growth-engine"), { recursive: true });
  fs.mkdirSync(path.join(root, "config", "projects"), { recursive: true });

  process.env.WORKSPACE_ROOT = root;

  function writeProjectConfig(slug: string, config: Record<string, unknown>): string {
    const file = path.join(root, "config", "projects", `${slug}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");
    return file;
  }

  for (const slug of options.copyCommittedProjectSlugs || []) {
    const source = path.join(CODE_ROOT, "config", "projects", `${slug}.json`);
    if (!fs.existsSync(source)) {
      throw new Error(`Committed project config missing for isolation copy: ${source}`);
    }
    fs.copyFileSync(source, path.join(root, "config", "projects", `${slug}.json`));
  }

  let cleaned = false;
  function cleanup(): void {
    if (cleaned) return;
    cleaned = true;
    if (previousWorkspaceRoot === undefined) delete process.env.WORKSPACE_ROOT;
    else process.env.WORKSPACE_ROOT = previousWorkspaceRoot;
    fs.rmSync(root, { recursive: true, force: true });
  }

  process.on("exit", cleanup);

  return {
    root,
    codeRoot: CODE_ROOT,
    writeProjectConfig,
    cleanup,
  };
}

export function assertIsolatedProjectConfigPath(file: string, workspaceRoot: string, codeRoot: string): void {
  const resolved = path.resolve(file);
  const isolatedProjects = path.resolve(workspaceRoot, "config", "projects");
  const repoProjects = path.resolve(codeRoot, "config", "projects");
  if (!resolved.startsWith(isolatedProjects + path.sep)) {
    throw new Error(`Fixture project config is not inside isolated workspace: ${resolved}`);
  }
  if (resolved.startsWith(repoProjects + path.sep)) {
    throw new Error(`Fixture project config must not be written to repository config/projects: ${resolved}`);
  }
}
