/**
 * Function Call 函数映射表
 * 导出所有函数和 handlers
 */
import { getGitLog, getLatestCommit, getGitStatus, getGitBranches } from './git.js';
import { getProjectList, getProjectInfo, searchProjectsByKeyword } from './project.js';
import { checkCommitReport, customCodeCheck } from './check.js';
import { sendMessage, getEmojiList, sendImage } from './message.js';
import { getCommandHelp } from './command.js';
import {
    getReportByIdFunction,
    getReportByCommitFunction,
    getProjectReportsFunction,
    getAllReportsFunction,
    getReportFullFunction,
} from './report.js';
import { webSearchFunction } from './webSearch.js';

export { getGitLog, getLatestCommit, getGitStatus, getGitBranches } from './git.js';
export { getProjectList, getProjectInfo, searchProjectsByKeyword } from './project.js';
export { checkCommitReport, customCodeCheck } from './check.js';
export { sendMessage, getEmojiList, sendImage } from './message.js';
export { getCommandHelp } from './command.js';
export {
    getReportByIdFunction,
    getReportByCommitFunction,
    getProjectReportsFunction,
    getAllReportsFunction,
    getReportFullFunction,
} from './report.js';
export { webSearchFunction } from './webSearch.js';

/**
 * Function call 函数映射表
 */
export const functionHandlers: Record<string, (...args: any[]) => Promise<string>> = {
    get_git_log: getGitLog,
    get_latest_commit: getLatestCommit,
    get_git_status: getGitStatus,
    get_git_branches: getGitBranches,
    get_project_list: getProjectList,
    get_project_info: getProjectInfo,
    search_projects: searchProjectsByKeyword,
    check_commit: checkCommitReport,
    send_message: sendMessage,
    get_emoji_list: getEmojiList,
    send_image: sendImage,
    get_command_help: getCommandHelp,
    custom_code_check: customCodeCheck,
    get_report_by_id: getReportByIdFunction,
    get_report_by_commit: getReportByCommitFunction,
    get_project_reports: getProjectReportsFunction,
    get_all_reports: getAllReportsFunction,
    get_report_full: getReportFullFunction,
    web_search: webSearchFunction,
};






