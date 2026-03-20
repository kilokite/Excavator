/**
 * Function Call：网络搜索
 * 供模型在需要实时/联网信息时主动调用
 */
import { webSearch, formatSearchResults, type SearchEngine } from '../../command/tools/webSearch.js';

const ENGINES: SearchEngine[] = ['search_std', 'search_pro', 'search_pro_sogou', 'search_pro_quark'];

export async function webSearchFunction(
    search_query: string,
    search_engine?: string,
    count?: number
): Promise<string> {
    const query = (search_query || '').trim().slice(0, 70);
    if (!query) {
        return '搜索关键词不能为空。';
    }
    const engine: SearchEngine = ENGINES.includes(search_engine as SearchEngine)
        ? (search_engine as SearchEngine)
        : 'search_std';
    const limit = count != null ? Math.min(50, Math.max(1, count)) : 10;
    try {
        const response = await webSearch({
            search_query: query,
            search_engine: engine,
            search_intent: false,
            count: limit,
        });
        let result = formatSearchResults(response);
        return result;
    } catch (err: any) {
        return `网络搜索失败：${err?.message ?? String(err)}`;
    }
}
