import { Command } from 'commander';
import { getCommandContext } from './commandContext.js';
import { handleCheckCommit } from './handler/checkCommit.js';
import { handleChatId } from './handler/chatId.js';
import { handleUserId } from './handler/userId.js';
import { handleHelp } from './handler/help.js';
import {
    handleGitStatus,
    handleGitLog,
    handleGitBranch,
    handleGitFetch,
    handleGitPull,
    handleGitDiff,
    handleGitShow,
    handleGitRemote,
} from './handler/git.js';
import {
    handleProjectList,
    handleProjectInfo,
    handleProjectSearch,
    handleProjectUpdate,
    handleProjectDelete,
    handleProjectAdd,
} from './handler/project.js';
import {
    handleAutoCheckList,
    handleAutoCheckAdd,
    handleAutoCheckUpdate,
    handleAutoCheckRemove,
    handleAutoCheckEnable,
} from './handler/autoCheck.js';
import {
    handleReportGet,
    handleReportGetByCommit,
    handleReportList,
    handleReportListAll,
    handleReportFull,
} from './handler/report.js';
import { handleWebSearch } from './handler/webSearch.js';
import type { SearchEngine } from './tools/webSearch.js';

/**
 * 创建并配置 Command 实例
 * 所有 handler 通过 getCommandContext() 获取 context
 */
export function createProgram(): Command {
    const program = new Command();

    program
        .exitOverride()
        .configureOutput({
            writeOut: () => { },
            writeErr: () => { },
        });

    // 基础命令
    program
        .command('checkcommit <projectId> <commitHash>')
        .alias('checkCommit')
        .description('检查代码提交')
        .action(async (projectId: string, commitHash: string) => {
            await handleCheckCommit({ projectId, commitHash });
        });

    program
        .command('chatid')
        .alias('chatId')
        .description('获取当前 Chat ID')
        .action(async () => {
            await handleChatId();
        });

    program
        .command('userid')
        .alias('userId')
        .description('获取当前用户 ID')
        .action(async () => {
            await handleUserId();
        });

    program
        .command('help')
        .alias('h')
        .description('显示帮助信息')
        .action(async () => {
            await handleHelp(program);
        });

    // 注册 git 命令
    registerGitCommands(program);

    // 注册项目管理命令
    registerProjectCommands(program);

    // 注册自动检查配置命令
    registerAutoCheckCommands(program);

    // 注册报告查询命令
    registerReportCommands(program);

    // 网络搜索（智谱 Web Search API）
    registerWebSearchCommands(program);

    return program;
}

function registerGitCommands(program: Command): void {
    program
        .command('git-status <projectId>')
        .alias('gitStatus')
        .description('查看项目工作区状态')
        .action(async (projectId: string) => {
            await handleGitStatus(projectId);
        });

    program
        .command('git-log <projectId> [limit]')
        .alias('gitLog')
        .description('查看项目提交历史')
        .action(async (projectId: string, limit?: string) => {
            const limitNum = limit ? parseInt(limit, 10) : 10;
            await handleGitLog(projectId, isNaN(limitNum) ? 10 : limitNum);
        });

    program
        .command('git-branch <projectId>')
        .alias('gitBranch')
        .option('-a, --all', '显示所有分支（包括远程）')
        .description('查看项目分支列表')
        .action(async (projectId: string, options: { all?: boolean }) => {
            await handleGitBranch(projectId, options.all);
        });

    program
        .command('git-fetch <projectId>')
        .alias('gitFetch')
        .option('--no-prune', '不删除过时的远程分支引用')
        .description('从远程拉取更新')
        .action(async (projectId: string, options: { prune?: boolean }) => {
            await handleGitFetch(projectId, options.prune !== false);
        });

    program
        .command('git-pull <projectId> [branch]')
        .alias('gitPull')
        .description('拉取并合并远程更新')
        .action(async (projectId: string, branch?: string) => {
            await handleGitPull(projectId, branch);
        });

    program
        .command('git-diff <projectId> [target]')
        .alias('gitDiff')
        .description('查看工作区或提交之间的差异')
        .action(async (projectId: string, target?: string) => {
            await handleGitDiff(projectId, target);
        });

    program
        .command('git-show <projectId> <commitHash>')
        .alias('gitShow')
        .description('查看提交详情')
        .action(async (projectId: string, commitHash: string) => {
            await handleGitShow(projectId, commitHash);
        });

    program
        .command('git-remote <projectId>')
        .alias('gitRemote')
        .description('查看远程仓库配置')
        .action(async (projectId: string) => {
            await handleGitRemote(projectId);
        });
}

function registerProjectCommands(program: Command): void {
    program
        .command('project-list')
        .alias('projectList')
        .alias('pl')
        .description('列出所有项目')
        .action(async () => {
            await handleProjectList();
        });

    program
        .command('project-info <projectId>')
        .alias('projectInfo')
        .alias('pi')
        .description('获取项目详细信息')
        .action(async (projectId: string) => {
            await handleProjectInfo(projectId);
        });

    program
        .command('project-search <keyword>')
        .alias('projectSearch')
        .alias('ps')
        .description('搜索项目')
        .action(async (keyword: string) => {
            await handleProjectSearch(keyword);
        });

    program
        .command('project-update <projectId>')
        .alias('projectUpdate')
        .option('-n, --name <name>', '设置项目别名')
        .option('-d, --description <description>', '设置项目描述')
        .option('-r, --git-remote <gitRemote>', '设置Git远程仓库地址')
        .option('-t, --tags <tags>', '设置项目标签（逗号分隔）')
        .description('更新项目配置')
        .action(async (projectId: string, options: {
            name?: string;
            description?: string;
            gitRemote?: string;
            tags?: string;
        }) => {
            await handleProjectUpdate(projectId, options);
        });

    program
        .command('project-delete <projectId>')
        .alias('projectDelete')
        .description('删除项目（目录和配置）')
        .action(async (projectId: string) => {
            await handleProjectDelete(projectId);
        });

    program
        .command('project-add <projectId>')
        .alias('projectAdd')
        .alias('pa')
        .option('-r, --git-remote <gitRemote>', 'Git远程仓库地址（如果提供，将从该地址克隆项目）')
        .option('-n, --name <name>', '项目名称（别名）')
        .option('-d, --description <description>', '项目描述')
        .option('-t, --tags <tags>', '项目标签（逗号分隔）')
        .description('添加新项目')
        .action(async (projectId: string, options: {
            gitRemote?: string;
            name?: string;
            description?: string;
            tags?: string;
        }) => {
            await handleProjectAdd(projectId, options);
        });
}

function registerAutoCheckCommands(program: Command): void {
    program
        .command('autocheck-list')
        .alias('autocheckList')
        .alias('acl')
        .description('列出所有自动检查配置')
        .action(async () => {
            await handleAutoCheckList();
        });

    program
        .command('autocheck-add <projectId> <targetChatId>')
        .alias('autocheckAdd')
        .alias('aca')
        .option('-i, --interval <interval>', '检查间隔（如 5m 或 30s，默认 1m）')
        .option('--enabled', '启用自动检查（默认）')
        .option('--disabled', '禁用自动检查')
        .description('添加自动检查项目配置')
        .action(async (projectId: string, targetChatId: string, options: {
            interval?: string;
            enabled?: boolean;
            disabled?: boolean;
        }) => {
            await handleAutoCheckAdd(projectId, targetChatId, {
                interval: options.interval,
                enabled: options.disabled ? false : (options.enabled !== undefined ? options.enabled : true),
            });
        });

    program
        .command('autocheck-update <projectId>')
        .alias('autocheckUpdate')
        .alias('acu')
        .option('-c, --chat-id <chatId>', '目标聊天ID')
        .option('-i, --interval <interval>', '检查间隔（如 5m 或 30s）')
        .option('--enable', '启用自动检查')
        .option('--disable', '禁用自动检查')
        .description('更新自动检查项目配置')
        .action(async (projectId: string, options: {
            chatId?: string;
            interval?: string;
            enable?: boolean;
            disable?: boolean;
        }) => {
            await handleAutoCheckUpdate(projectId, {
                targetChatId: options.chatId,
                interval: options.interval,
                enabled: options.disable ? false : (options.enable ? true : undefined),
            });
        });

    program
        .command('autocheck-remove <projectId>')
        .alias('autocheckRemove')
        .alias('acr')
        .description('删除自动检查项目配置')
        .action(async (projectId: string) => {
            await handleAutoCheckRemove(projectId);
        });

    program
        .command('autocheck-enable')
        .alias('autocheckEnable')
        .alias('ace')
        .description('启用全局自动检查')
        .action(async () => {
            await handleAutoCheckEnable(true);
        });

    program
        .command('autocheck-disable')
        .alias('autocheckDisable')
        .alias('acd')
        .description('禁用全局自动检查')
        .action(async () => {
            await handleAutoCheckEnable(false);
        });
}

function registerReportCommands(program: Command): void {
    program
        .command('report-get <reportId>')
        .alias('reportGet')
        .alias('rg')
        .description('根据报告ID获取审查报告')
        .action(async (reportId: string) => {
            await handleReportGet(reportId);
        });

    program
        .command('report-get-by-commit <projectId> <commitHash>')
        .alias('reportGetByCommit')
        .alias('rgc')
        .description('根据项目和提交哈希获取审查报告')
        .action(async (projectId: string, commitHash: string) => {
            await handleReportGetByCommit(projectId, commitHash);
        });

    program
        .command('report-list <projectId> [limit]')
        .alias('reportList')
        .alias('rl')
        .description('获取项目的所有审查报告列表')
        .action(async (projectId: string, limit?: string) => {
            const limitNum = limit ? parseInt(limit, 10) : undefined;
            await handleReportList(projectId, isNaN(limitNum || 0) ? undefined : limitNum);
        });

    program
        .command('report-list-all [limit]')
        .alias('reportListAll')
        .alias('rla')
        .description('获取所有审查报告列表')
        .action(async (limit?: string) => {
            const limitNum = limit ? parseInt(limit, 10) : undefined;
            await handleReportListAll(isNaN(limitNum || 0) ? undefined : limitNum);
        });

    program
        .command('report-full <reportId>')
        .alias('reportFull')
        .alias('rf')
        .description('获取完整的审查报告内容（不截断）')
        .action(async (reportId: string) => {
            await handleReportFull(reportId);
        });
}

function registerWebSearchCommands(program: Command): void {
    const engines: SearchEngine[] = ['search_std', 'search_pro', 'search_pro_sogou', 'search_pro_quark'];
    program
        .command('websearch <query...>')
        .alias('search')
        .alias('ws')
        .description('网络搜索（智谱 Web Search API）')
        .option('-e, --engine <engine>', `搜索引擎: ${engines.join(' | ')}`, 'search_std')
        .option('-c, --count <n>', '返回条数 1-50', '10')
        .action(async (queryParts: string[], options: { engine?: string; count?: string }) => {
            const query = queryParts.join(' ').trim();
            if (!query) {
                const ctx = getCommandContext();
                await ctx.replyText('请提供搜索关键词，例如：websearch 智谱 API');
                return;
            }
            const engine = engines.includes(options.engine as SearchEngine)
                ? (options.engine as SearchEngine)
                : 'search_std';
            const count = options.count ? parseInt(options.count, 10) : undefined;
            await handleWebSearch(query, { engine, count });
        });
}


