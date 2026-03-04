import { getReportUrl } from '../../utils/reportStore.js';
import { truncateText } from '../../utils/textTools.js';
import { buildCommitDetailUrl } from '../../../app/utils/commitUrlBuilder.js';

export interface CardContent {
    config?: {
        wide_screen_mode?: boolean;
        enable_forward?: boolean;
    };
    header?: {
        title: {
            tag: string;
            content: string;
        };
        template?: string;
    };
    elements: Array<{
        tag: string;
        text?: {
            tag: string;
            content: string;
        };
        fields?: Array<{
            is_short?: boolean;
            text: {
                tag: string;
                content: string;
            };
        }>;
        actions?: Array<{
            tag: string;
            text: {
                tag: string;
                content: string;
            };
            type: string;
            url?: string;
            value?: Record<string, any>;
        }>;
        [key: string]: any;
    }>;
}

/**
 * 截断文本到指定长度
 */
function localTruncate(text: string, maxLength: number): string {
    // 优先使用已有工具函数，回退简单截断
    if (typeof truncateText === 'function') {
        return truncateText(text, maxLength);
    }
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}\n\n...(内容过长，已截断)`;
}

                                /**
 * 从 tiebaSummary 中提取代码等级和颜色（仅用于 header）
 */
function parseCodeLevel(tiebaSummary?: string): { level: string; color: string; template: string } {
    if (!tiebaSummary) {
        return { level: '未知', color: 'grey', template: 'grey' };
    }
    
    const textTagMatch = tiebaSummary.match(/<text_tag[^>]*color=['"]([^'"]+)['"][^>]*>([^<]+)<\/text_tag>/);
    if (textTagMatch) {
        return { level: textTagMatch[2].trim(), color: textTagMatch[1], template: textTagMatch[1] };
    }
    
    const levelMatch = tiebaSummary.match(/当前代码等级[：:]\s*([^<，,\n]+)/);
    if (levelMatch) {
        const level = levelMatch[1].trim();
        if (level.includes('有机肥')) return { level, color: 'red', template: 'red' };
        if (level.includes('不可回收垃圾')) return { level, color: 'orange', template: 'orange' };
        if (level.includes('可回收垃圾')) return { level, color: 'yellow', template: 'yellow' };
        if (level.includes('非垃圾')) return { level, color: 'green', template: 'green' };
    }
    
    return { level: '未知', color: 'grey', template: 'grey' };
}

/**
 * 创建代码审查结果卡片
 */
export function createCheckCommitCard(
    projectId: string,
    commitHash: string,
    reportId: string,
    commitInfo: string,
    executiveSummary: string,
    tiebaSummary?: string,
    baseUrl?: string
): Record<string, any> {
    const reportUrl = getReportUrl(reportId, baseUrl);
    const { level, color, template } = parseCodeLevel(tiebaSummary);

    const elements: any[] = [
        {
            tag: 'column_set',
            flex_mode: 'stretch',
            horizontal_spacing: '8px',
            horizontal_align: 'left',
            columns: [
                {
                    tag: 'column',
                    width: 'weighted',
                    elements: [
                        {
                            tag: 'markdown',
                            content: `<font color='carmine'>**项目ID**</font>\n\`${projectId}\``,
                        },
                    ],
                    vertical_spacing: '8px',
                    horizontal_align: 'left',
                    vertical_align: 'top',
                    weight: 1,
                },
                {
                    tag: 'column',
                    width: 'weighted',
                    elements: [
                        {
                            tag: 'markdown',
                            content: `<font color='carmine'>**提交哈希**</font>\n\`${commitHash.substring(0, 8)}\``,
                        },
                    ],
                    vertical_spacing: '8px',
                    horizontal_align: 'left',
                    vertical_align: 'top',
                    weight: 2,
                },
            ],
            margin: '0px 0px 0px 0px',
        },
        {
            tag: 'markdown',
            content: `**提交基本信息**\n${commitInfo}`,
            margin: '0px 0px 0px 0px',
        },
        {
            tag: 'hr',
            margin: '0px 0px 0px 0px',
        },
        {
            tag: 'markdown',
            content: `<font color='orange'>**执行摘要**</font>\n${executiveSummary}`,
            margin: '0px 0px 0px 0px',
        },
    ];

    // 如果有简单总结，添加
    if (tiebaSummary) {
        elements.push(
            {
                tag: 'hr',
                margin: '0px 0px 0px 0px',
            },
            {
                tag: 'markdown',
                content: `<font color='red'>**简单总结**</font>\n${localTruncate(tiebaSummary, 500)}`,
                margin: '0px 0px 0px 0px',
            }
        );
    }

    // 添加查看详细报告按钮
    elements.push({
        "tag": "column_set",
        "horizontal_spacing": "8px",
        "horizontal_align": "left",
        "columns": [
            {
                "tag": "column",
                "width": "weighted",
                "elements": [
                    {
                        "tag": "button",
                        "text": {
                            "tag": "plain_text",
                            "content": "查看详细报告"
                        },
                        "type": "primary_filled",
                        "width": "fill",
                        "size": "medium",
                        "icon": {
                            "tag": "standard_icon",
                            "token": "doc-comment_outlined"
                        },
                        "behaviors": [
                            {
                                "type": "open_url",
                                "default_url": reportUrl,
                                "pc_url": "",
                                "ios_url": "",
                                "android_url": ""
                            }
                        ],
                        "margin": "4px 0px 4px 0px"
                    }
                ],
                "vertical_align": "top",
                "weight": 1
            },
            {
                "tag": "column",
                "width": "weighted",
                "elements": [
                    {
                        "tag": "button",
                        "text": {
                            "tag": "plain_text",
                            "content": "查看提交"
                        },
                        "type": "default",
                        "width": "fill",
                        "size": "medium",
                        "icon": {
                            "tag": "standard_icon",
                            "token": "platform_outlined"
                        },
                        "behaviors": [
                            {
                                "type": "open_url",
                                "default_url": buildCommitDetailUrl(projectId, commitHash),
                                "pc_url": "",
                                "ios_url": "",
                                "android_url": ""
                            }
                        ],
                        "margin": "4px 0px 4px 0px"
                    }
                ],
                "vertical_align": "top",
                "weight": 1
            }
        ],
        "margin": "0px 0px 0px 0px"
    });

    return {
        schema: '2.0',
        config: {
            update_multi: true,
        },
        body: {
            direction: 'vertical',
            elements,
        },
        header: {
            title: {
                tag: 'plain_text',
                content: '代码审查结果',
            },
            subtitle: {
                tag: 'plain_text',
                content: '',
            },
            text_tag_list: [
                {
                    tag: 'text_tag',
                    text: {
                        tag: 'plain_text',
                        content: level,
                    },
                    color: color,
                },
            ],
            template: template,
            padding: '12px 8px 12px 8px',
        },
    };
}

/**
 * 创建错误卡片
 */
export function createErrorCard(
    projectId: string,
    commitHash: string,
    errorMsg: string
): CardContent {
    return {
        config: {
            wide_screen_mode: true,
        },
        header: {
            title: {
                tag: 'plain_text',
                content: '❌ 代码审查失败',
            },
            template: 'red',
        },
        elements: [
            {
                tag: 'div',
                fields: [
                    {
                        is_short: true,
                        text: {
                            tag: 'lark_md',
                            content: `**项目ID**\n\`${projectId}\``,
                        },
                    },
                    {
                        is_short: true,
                        text: {
                            tag: 'lark_md',
                            content: `**提交哈希**\n\`${commitHash.substring(0, 8)}\``,
                        },
                    },
                ],
            },
            {
                tag: 'div',
                text: {
                    tag: 'lark_md',
                    content: `**错误信息**\n\n${errorMsg}`,
                },
            },
        ],
    };
}

/**
 * 创建 Markdown 富文本卡片
 * 用于发送包含 Markdown 格式的消息
 */
export function createMarkdownCard(
    markdownContent: string,
    elementId?: string
): Record<string, any> {
    return {
        schema: '2.0',
        config: {
            update_multi: true,
        },
        body: {
            direction: 'vertical',
            elements: [
                {
                    tag: 'markdown',
                    content: markdownContent,
                    margin: '0px 0px 0px 0px',
                    ...(elementId ? { element_id: elementId } : {}),
                },
            ],
        },
    };
}

/**
 * 创建提交检测通知卡片
 * 用于通知检测到新提交并开始分析
 */
export function createCommitDetectedCard(
    hash: string,
    branch: string,
    author: string,
    message: string,
    detailUrl?: string
): Record<string, any> {
    // 如果没有提供详情链接，使用占位符
    const url = detailUrl || 'https://example.com/commit-details';
    
    return {
        schema: '2.0',
        config: {
            update_multi: true,
        },
        body: {
            direction: 'vertical',
            elements: [
                {
                    tag: 'column_set',
                    flex_mode: 'stretch',
                    horizontal_spacing: '12px',
                    horizontal_align: 'left',
                    columns: [
                        {
                            tag: 'column',
                            width: 'weighted',
                            elements: [
                                {
                                    tag: 'markdown',
                                    content: `**提交信息**\n- 哈希: \`${hash}\`\n- 分支: ${branch}\n- 作者: ${author}\n- 消息: ${message}`,
                                    text_align: 'left',
                                    text_size: 'normal',
                                },
                            ],
                            vertical_spacing: '8px',
                            horizontal_align: 'left',
                            vertical_align: 'top',
                            weight: 1,
                        },
                    ],
                    margin: '0px 0px 0px 0px',
                },
                {
                    tag: 'button',
                    text: {
                        tag: 'plain_text',
                        content: '查看提交详情',
                    },
                    type: 'primary_filled',
                    width: 'fill',
                    behaviors: [
                        {
                            type: 'open_url',
                            default_url: url,
                            pc_url: '',
                            ios_url: '',
                            android_url: '',
                        },
                    ],
                    margin: '4px 0px 4px 0px',
                },
            ],
        },
        header: {
            title: {
                tag: 'plain_text',
                content: '代码提交分析通知',
            },
            subtitle: {
                tag: 'plain_text',
                content: '',
            },
            text_tag_list: [
                {
                    tag: 'text_tag',
                    text: {
                        tag: 'plain_text',
                        content: '代码提交',
                    },
                    color: 'blue',
                },
            ],
            template: 'blue',
            icon: {
                tag: 'standard_icon',
                token: 'code_outlined',
            },
            padding: '12px 8px 12px 8px',
        },
    };
}

