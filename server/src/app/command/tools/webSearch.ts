/**
 * 智谱网络搜索 API 工具类
 * @see https://open.bigmodel.cn/api/paas/v4/web_search
 * @see https://docs.bigmodel.cn/llms.txt
 */

import { WEB_SEARCH_API_KEY } from '../../../config.js';

const WEB_SEARCH_BASE = 'https://open.bigmodel.cn/api/paas/v4/web_search';

export type SearchEngine = 'search_std' | 'search_pro' | 'search_pro_sogou' | 'search_pro_quark';
export type SearchRecencyFilter = 'oneDay' | 'oneWeek' | 'oneMonth' | 'oneYear' | 'noLimit';
export type ContentSize = 'medium' | 'high';

export interface WebSearchRequest {
    /** 搜索内容，建议不超过 70 字符 */
    search_query: string;
    /** 搜索引擎：search_std 智谱基础版 / search_pro 智谱高阶 / search_pro_sogou 搜狗 / search_pro_quark 夸克 */
    search_engine: SearchEngine;
    /** 是否进行搜索意图识别，默认 false 直接搜索 */
    search_intent?: boolean;
    /** 返回条数 1–50，默认 10 */
    count?: number;
    /** 白名单域名过滤 */
    search_domain_filter?: string;
    /** 时间范围：oneDay / oneWeek / oneMonth / oneYear / noLimit */
    search_recency_filter?: SearchRecencyFilter;
    /** 内容长短：medium 摘要 / high 详细 */
    content_size?: ContentSize;
    request_id?: string;
    /** 终端用户唯一 ID，6–128 字符 */
    user_id?: string;
}

export interface SearchIntentItem {
    query: string;
    intent: 'SEARCH_ALL' | 'SEARCH_NONE' | 'SEARCH_ALWAYS';
    keywords?: string;
}

export interface SearchResultItem {
    title?: string;
    content?: string;
    link?: string;
    media?: string;
    icon?: string;
    refer?: string;
    publish_date?: string;
}

export interface WebSearchResponse {
    id?: string;
    created?: number;
    request_id?: string;
    search_intent?: SearchIntentItem[];
    search_result?: SearchResultItem[];
}

export interface WebSearchError {
    error: { code: string; message: string };
}

/**
 * 调用智谱网络搜索 API
 */
export async function webSearch(options: WebSearchRequest): Promise<WebSearchResponse> {
    const apiKey = WEB_SEARCH_API_KEY;
    if (!apiKey) {
        throw new Error('WEB_SEARCH_API_KEY 未配置，无法调用网络搜索');
    }

    const body = {
        search_query: options.search_query.slice(0, 70),
        search_engine: options.search_engine ?? 'search_std',
        search_intent: options.search_intent ?? false,
        count: options.count ?? 10,
        ...(options.search_domain_filter != null && { search_domain_filter: options.search_domain_filter }),
        ...(options.search_recency_filter != null && { search_recency_filter: options.search_recency_filter }),
        ...(options.content_size != null && { content_size: options.content_size }),
        ...(options.request_id != null && { request_id: options.request_id }),
        ...(options.user_id != null && options.user_id.length >= 6 && { user_id: options.user_id }),
    };

    const res = await fetch(WEB_SEARCH_BASE, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    });

    const data = (await res.json()) as WebSearchResponse | WebSearchError;

    if (!res.ok) {
        const err = data as WebSearchError;
        throw new Error(
            err?.error?.message || `网络搜索请求失败: ${res.status} ${res.statusText}`
        );
    }

    return data as WebSearchResponse;
}

/**
 * 将搜索结果格式化为可读文本（供命令回复与 function call 共用）
 */
export function formatSearchResults(response: WebSearchResponse): string {
    const lines: string[] = [];
    if (response.search_intent?.length) {
        const intent = response.search_intent[0];
        if (intent.intent === 'SEARCH_NONE') {
            return '未识别到搜索意图，请换一种说法再试。';
        }
        if (intent.keywords) {
            lines.push(`关键词：${intent.keywords}\n`);
        }
    }
    const results = response.search_result ?? [];
    if (!results.length) {
        return lines.join('') + '未找到相关结果。';
    }
    results.forEach((item, i) => {
        const title = item.title || '(无标题)';
        const content = item.content ? `\n${item.content}` : '';
        const link = item.link ? `\n${item.link}` : '';
        const media = item.media ? ` [${item.media}]` : '';
        lines.push(`${i + 1}. **${title}**${media}${content}${link}\n`);
    });
    lines.push('--------------------------------');
    lines.push('如果是抽象梗，请务必在尽可能理解梗的精髓后抽象回复，注意：这个时候你不是助手，你是他妈的网友，学着网友的说话方式，用户玩多烂的梗，你都得接着，绝不要出现任何与梗无关的内容，否则会被用户举报。');
    lines.push('--------------------------------');
    return lines.join('\n');
}
