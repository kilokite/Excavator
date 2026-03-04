import { router, publicPro } from '../trpc/trpc.js';
import { z } from 'zod';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fetchProject } from '../app/utils/gitTools.js';

/**
 * 获取 projects 目录的根路径
 */
function getProjectsRoot(): string {
    const currentFile = fileURLToPath(import.meta.url);
    let currentDir = resolve(currentFile, '..');
    
    for (let i = 0; i < 10; i++) {
        const serverProjectsPath = join(currentDir, 'server', 'projects');
        try {
            const entries = readdirSync(join(currentDir, 'server'), { withFileTypes: true });
            const hasProjects = entries.some(
                entry => entry.isDirectory() && entry.name === 'projects'
            );
            if (hasProjects) {
                return serverProjectsPath;
            }
        } catch {
            // 忽略
        }
        
        try {
            const projectsPath = join(currentDir, 'projects');
            const entries = readdirSync(currentDir, { withFileTypes: true });
            const hasProjects = entries.some(
                entry => entry.isDirectory() && entry.name === 'projects'
            );
            if (hasProjects) {
                return projectsPath;
            }
        } catch {
            // 忽略
        }
        
        const parentDir = resolve(currentDir, '..');
        if (parentDir === currentDir) {
            break;
        }
        currentDir = parentDir;
    }
    
    return resolve(fileURLToPath(new URL('../../../projects', import.meta.url)));
}

/**
 * 检查项目是否存在且为 Git 仓库
 */
function validateProject(projectId: string): { valid: boolean; projectPath?: string; error?: string } {
    const projectsRoot = getProjectsRoot();
    const projectPath = join(projectsRoot, projectId);
    
    try {
        const entries = readdirSync(projectsRoot, { withFileTypes: true });
        const projectExists = entries.some(
            entry => entry.isDirectory() && entry.name === projectId
        );
        
        if (!projectExists) {
            return { valid: false, error: `项目 ${projectId} 不存在` };
        }
    } catch (error) {
        return { valid: false, error: `读取项目目录失败: ${error instanceof Error ? error.message : String(error)}` };
    }
    
    try {
        execSync('git rev-parse --is-inside-work-tree', { cwd: projectPath, stdio: 'pipe' });
    } catch {
        return { valid: false, error: `项目 ${projectId} 不是 Git 仓库` };
    }
    
    return { valid: true, projectPath };
}

/**
 * 执行 git 命令并返回结果
 */
function executeGitCommand(projectPath: string, command: string): { success: boolean; output: string; error?: string } {
    try {
        const fullCommand = `git ${command}`;
        // 在Windows上设置UTF-8编码环境变量
        const env = {
            ...process.env,
            LANG: 'C.UTF-8',
            LC_ALL: 'C.UTF-8',
        };
        const output = execSync(fullCommand, {
            cwd: projectPath,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: 10 * 1024 * 1024, // 10MB
            env: env,
        });
        return { success: true, output: output.trim() };
    } catch (error: any) {
        // 尝试以UTF-8解码stderr和stdout
        let stderr = '';
        let stdout = '';
        try {
            if (error.stderr) {
                stderr = typeof error.stderr === 'string' ? error.stderr : error.stderr.toString('utf-8');
            }
            if (error.stdout) {
                stdout = typeof error.stdout === 'string' ? error.stdout : error.stdout.toString('utf-8');
            }
        } catch {
            stderr = error.stderr?.toString() || '';
            stdout = error.stdout?.toString() || '';
        }
        const errorMessage = stderr || error.message || String(error);
        return {
            success: false,
            output: stdout.trim(),
            error: errorMessage,
        };
    }
}

export default router({
    // git status - 查看工作区状态
    status: publicPro
        .input(z.string().describe('项目ID'))
        .query(({ input: projectId }) => {
            const validation = validateProject(projectId);
            if (!validation.valid || !validation.projectPath) {
                throw new Error(validation.error);
            }
            return executeGitCommand(validation.projectPath, 'status');
        }),
    
    // git log - 查看提交历史
    log: publicPro
        .input(z.object({
            projectId: z.string().describe('项目ID'),
            limit: z.number().optional().default(10).describe('限制条数'),
            skip: z.number().optional().default(0).describe('跳过条数（分页用）'),
            branch: z.string().optional().describe('分支名称（可选）'),
            format: z.enum(['oneline', 'json']).optional().default('oneline').describe('输出格式'),
            search: z.string().optional().describe('按提交信息搜索（message grep，固定字符串）'),
            author: z.string().optional().describe('按作者筛选（固定字符串，匹配 author name）'),
        }))
        .query(({ input }) => {
            const validation = validateProject(input.projectId);
            if (!validation.valid || !validation.projectPath) {
                throw new Error(validation.error);
            }
            
            const safeLimit = Math.max(1, Math.min(200, input.limit ?? 10));
            const safeSkip = Math.max(0, Math.min(50000, input.skip ?? 0));

            const branchArg = input.branch ? input.branch : 'HEAD';

            const escapeForDoubleQuotes = (s: string) =>
                s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

            const escapeForRegex = (s: string) =>
                s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            const grepArg = input.search && input.search.trim().length > 0
                ? ` --grep="${escapeForDoubleQuotes(input.search.trim())}" --fixed-strings --regexp-ignore-case`
                : '';

            const authorArg = input.author && input.author.trim().length > 0
                ? ` --author="${escapeForDoubleQuotes(escapeForRegex(input.author.trim()))}" --regexp-ignore-case`
                : '';

            if (input.format === 'json') {
                // 返回结构化的commit信息
                // 使用更可靠的方法：分别获取每个commit的信息，避免分隔符冲突
                // 先获取commit hash列表
                const hashResult = executeGitCommand(
                    validation.projectPath,
                    `log ${branchArg} --pretty=format:%H -n ${safeLimit} --skip ${safeSkip}${grepArg}${authorArg}`
                );
                
                if (!hashResult.success) {
                    return hashResult;
                }
                
                const commitHashes = hashResult.output
                    .split('\n')
                    .map(h => h.trim())
                    .filter(h => h.length > 0 && /^[a-f0-9]{40}$/i.test(h));
                
                if (commitHashes.length === 0) {
                    return {
                        success: true,
                        output: '',
                        commits: [],
                    };
                }
                
                // 对每个commit使用git show获取详细信息
                // 使用换行符分隔字段，更可靠
                const commits: Array<{
                    hash: string;
                    shortHash: string;
                    author: string;
                    email: string;
                    date: string;
                    message: string;
                    body: string;
                }> = [];
                
                for (const hash of commitHashes) {
                    try {
                        // 使用git show获取单个commit的详细信息
                        // 格式：hash, shortHash, author, email, date, subject, body（用换行符分隔）
                        const showResult = executeGitCommand(
                            validation.projectPath,
                            `show ${hash} --no-patch --format=%H%n%h%n%an%n%ae%n%ai%n%s%n%b --no-color`
                        );
                        
                        if (showResult.success && showResult.output) {
                            const lines = showResult.output.split('\n');
                            if (lines.length >= 6) {
                                commits.push({
                                    hash: lines[0]?.trim() || hash,
                                    shortHash: lines[1]?.trim() || hash.substring(0, 7),
                                    author: lines[2]?.trim() || '',
                                    email: lines[3]?.trim() || '',
                                    date: lines[4]?.trim() || '',
                                    message: lines[5]?.trim() || '',
                                    body: lines.slice(6).join('\n').trim() || '',
                                });
                            }
                        }
                    } catch (e) {
                        // 如果获取单个commit失败，记录警告但继续处理其他commit
                        console.warn(`获取commit ${hash.substring(0, 7)} 信息失败:`, e);
                    }
                }
                
                return {
                    success: true,
                    output: '',
                    commits: commits,
                };
            } else {
                // 返回oneline格式
                return executeGitCommand(
                    validation.projectPath,
                    `log --oneline ${branchArg} -n ${safeLimit} --skip ${safeSkip}${grepArg}${authorArg}`
                );
            }
        }),

    // git authors - 作者候选（用于前端下拉选择）
    authors: publicPro
        .input(z.object({
            projectId: z.string().describe('项目ID'),
            branch: z.string().optional().describe('分支名称（可选）'),
            limitCommits: z.number().optional().default(500).describe('扫描最近多少条提交（默认 500）'),
            limitAuthors: z.number().optional().default(50).describe('最多返回多少作者（默认 50）'),
            keyword: z.string().optional().describe('关键词（匹配 name/email）'),
        }))
        .query(({ input }) => {
            const validation = validateProject(input.projectId);
            if (!validation.valid || !validation.projectPath) {
                throw new Error(validation.error);
            }

            const branchArg = input.branch ? input.branch : 'HEAD';
            const safeLimitCommits = Math.max(1, Math.min(5000, input.limitCommits ?? 500));
            const safeLimitAuthors = Math.max(1, Math.min(200, input.limitAuthors ?? 50));
            const kw = input.keyword?.trim().toLowerCase();

            // 使用 \t 分隔 name/email，避免空格歧义；每行一个作者
            const res = executeGitCommand(
                validation.projectPath,
                `log ${branchArg} -n ${safeLimitCommits} --format=%an%x09%ae --no-color`
            );
            if (!res.success) return res;

            const map = new Map<string, { name: string; email: string; count: number }>();
            const lines = (res.output || '').split('\n');
            for (const line of lines) {
                const [nameRaw, emailRaw] = line.split('\t');
                const name = (nameRaw || '').trim();
                const email = (emailRaw || '').trim();
                if (!name && !email) continue;
                const key = `${name}\n${email}`;
                const prev = map.get(key);
                if (prev) prev.count += 1;
                else map.set(key, { name, email, count: 1 });
            }

            let items = Array.from(map.values());
            if (kw) {
                items = items.filter(a =>
                    a.name.toLowerCase().includes(kw) || a.email.toLowerCase().includes(kw)
                );
            }
            items.sort((a, b) => b.count - a.count);
            items = items.slice(0, safeLimitAuthors);

            return {
                success: true,
                output: '',
                authors: items,
            };
        }),
    
    // git checkout - 切换分支
    checkout: publicPro
        .input(z.object({
            projectId: z.string().describe('项目ID'),
            branch: z.string().describe('分支名称'),
        }))
        .mutation(({ input }) => {
            const validation = validateProject(input.projectId);
            if (!validation.valid || !validation.projectPath) {
                throw new Error(validation.error);
            }
            const b = String(input.branch || '').trim();
            if (!b) {
                throw new Error('分支名称不能为空');
            }

            // 如果选择的是 git branch -a 输出的 remotes/<remote>/<name>，则创建/切换到本地跟踪分支，避免 detached HEAD
            if (b.startsWith('remotes/')) {
                const rest = b.replace(/^remotes\//, '');
                const [remote, ...nameParts] = rest.split('/');
                const name = nameParts.join('/');
                const remoteRef = `${remote}/${name}`;
                const localName = name; // 保留路径式分支名

                // 1) 优先尝试创建跟踪分支（不存在时）
                let r = executeGitCommand(validation.projectPath, `checkout --track ${remoteRef}`);
                if (r.success) return r;

                // 2) 如果本地分支已存在，直接切换
                r = executeGitCommand(validation.projectPath, `checkout ${localName}`);
                if (r.success) return r;

                // 3) 兜底：强制创建/重置本地分支指向远程
                r = executeGitCommand(validation.projectPath, `checkout -B ${localName} ${remoteRef}`);
                return r;
            }

            return executeGitCommand(validation.projectPath, `checkout ${b}`);
        }),
    
    // git branch - 查看分支列表
    branch: publicPro
        .input(z.object({
            projectId: z.string().describe('项目ID'),
            all: z.boolean().optional().default(false).describe('是否显示所有分支（包括远程）'),
        }))
        .query(({ input }) => {
            const validation = validateProject(input.projectId);
            if (!validation.valid || !validation.projectPath) {
                throw new Error(validation.error);
            }
            const command = input.all ? 'branch -a' : 'branch';
            return executeGitCommand(validation.projectPath, command);
        }),
    
    // git fetch - 拉取远程更新
    fetch: publicPro
        .input(z.object({
            projectId: z.string().describe('项目ID'),
            prune: z.boolean().optional().default(true).describe('是否删除已不存在的远程分支引用'),
            all: z.boolean().optional().default(true).describe('是否获取所有远程仓库'),
        }))
        .mutation(({ input }) => {
            return fetchProject(input.projectId, {
                prune: input.prune,
                all: input.all,
            });
        }),
    
    // git pull - 拉取并合并
    pull: publicPro
        .input(z.object({
            projectId: z.string().describe('项目ID'),
            branch: z.string().optional().describe('分支名称'),
        }))
        .mutation(({ input }) => {
            const validation = validateProject(input.projectId);
            if (!validation.valid || !validation.projectPath) {
                throw new Error(validation.error);
            }
            const command = input.branch ? `pull origin ${input.branch}` : 'pull';
            return executeGitCommand(validation.projectPath, command);
        }),
    
    // git diff - 查看差异
    diff: publicPro
        .input(z.object({
            projectId: z.string().describe('项目ID'),
            target: z.string().optional().describe('对比目标（提交哈希或分支）'),
        }))
        .query(({ input }) => {
            const validation = validateProject(input.projectId);
            if (!validation.valid || !validation.projectPath) {
                throw new Error(validation.error);
            }
            const command = input.target ? `diff ${input.target}` : 'diff';
            const result = executeGitCommand(validation.projectPath, command);
            // 限制输出长度
            if (result.success && result.output.length > 5000) {
                result.output = result.output.substring(0, 5000) + '\n\n...(输出已截断)';
            }
            return result;
        }),
    
    // git show - 查看提交详情
    show: publicPro
        .input(z.object({
            projectId: z.string().describe('项目ID'),
            commitHash: z.string().describe('提交哈希'),
        }))
        .query(({ input }) => {
            const validation = validateProject(input.projectId);
            if (!validation.valid || !validation.projectPath) {
                throw new Error(validation.error);
            }
            const result = executeGitCommand(validation.projectPath, `show --stat ${input.commitHash}`);
            // 限制输出长度
            if (result.success && result.output.length > 5000) {
                result.output = result.output.substring(0, 5000) + '\n\n...(输出已截断)';
            }
            return result;
        }),
    
    // git remote - 查看远程仓库
    remote: publicPro
        .input(z.string().describe('项目ID'))
        .query(({ input: projectId }) => {
            const validation = validateProject(projectId);
            if (!validation.valid || !validation.projectPath) {
                throw new Error(validation.error);
            }
            return executeGitCommand(validation.projectPath, 'remote -v');
        }),
});




















