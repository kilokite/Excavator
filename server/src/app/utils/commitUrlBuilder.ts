import { get } from './project.js';

/**
 * 构建提交详情链接
 * @param projectId 项目ID
 * @param commitHash 提交哈希
 * @returns 构建好的链接URL，如果模板不存在则返回默认链接
 */
export function buildCommitDetailUrl(projectId: string, commitHash: string): string {
    const project = get(projectId);
    const template = project?.config?.commitDetailUrlTemplate;
    
    // 如果没有自定义模板，使用默认模板
    if (!template) {
        return `https://gitlab.huoban.ai/awesome-frontend/web/${projectId}/-/commit/${commitHash}`;
    }
    
    // 替换模板中的变量
    // 支持的变量: {commitHash}, {projectId}
    let url = template;
    url = url.replace(/\{commitHash\}/g, commitHash);
    url = url.replace(/\{projectId\}/g, projectId);
    
    return url;
}
