import { execSync } from "node:child_process";
import { getProjectsRoot, getProjectPathById } from "../app/utils/pathUtils.js";

let cachedRoot: string | null = null;
function projectsRoot(): string {
  if (!cachedRoot) cachedRoot = getProjectsRoot();
  return cachedRoot;
}

export type CommitAuthor = { name: string | null; email: string | null };

export function getCommitAuthor(projectId: string, commitHash: string): CommitAuthor {
  try {
    const repoPath = getProjectPathById(projectId, projectsRoot());
    // 注意：git --format 输出中可能包含换行，这里只取前两行作为 name/email
    const out = execSync(`git show ${commitHash} --no-patch --format=%an%n%ae --no-color`, {
      cwd: repoPath,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 1024 * 1024,
    }).trim();
    const lines = out.split("\n");
    const name = (lines[0] || "").trim() || null;
    const email = (lines[1] || "").trim() || null;
    return { name, email };
  } catch {
    return { name: null, email: null };
  }
}

