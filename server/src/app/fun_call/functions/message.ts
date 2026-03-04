/**
 * 消息相关 Function Call 函数
 */
import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Context } from '../../core/context.js';

const imageKeyCache = new Map<string, string>();
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.bmp', '.ico']);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(currentDir, '../../../assets');

class LarkApiError extends Error {
    code?: number;
    raw?: any;

    constructor(message: string, code?: number, raw?: any) {
        super(message);
        this.name = 'LarkApiError';
        this.code = code;
        this.raw = raw;
    }
}

function formatLarkError(error: unknown): string {
    const errObj = error as any;
    const apiData = errObj?.response?.data ?? errObj?.raw;
    const code = apiData?.code ?? errObj?.code;
    const msg = apiData?.msg ?? errObj?.message ?? '未知错误';

    if (code === 99991672) {
        return '权限不足：请在飞书开放平台为应用开启并发布应用身份权限 `im:resource:upload` 或 `im:resource`，然后重启服务后重试。';
    }

    return `${msg}${code !== undefined ? ` (code: ${code})` : ''}`;
}

async function uploadImageAndGetKey(ctx: Context, filePath: string): Promise<string> {
    const imageApi = ((ctx.client as any).im?.v1?.image ?? (ctx.client as any).im?.image);
    if (!imageApi?.create) {
        throw new Error('当前飞书 SDK 不支持图片上传接口');
    }

    const uploadResult = await imageApi.create({
        data: {
            image_type: 'message',
            image: fs.readFileSync(filePath),
        },
    });

    const imageKey = uploadResult?.data?.image_key ?? uploadResult?.image_key;
    const uploadCode = uploadResult?.code;
    const uploadFailed = typeof uploadCode === 'number' ? uploadCode !== 0 : false;
    if (uploadFailed || !imageKey) {
        throw new LarkApiError(
            uploadResult?.msg || '图片上传失败',
            uploadResult?.code,
            uploadResult
        );
    }

    return imageKey;
}

async function sendImageByKey(ctx: Context, chatId: string, imageKey: string): Promise<boolean> {
    const sendResult = await ctx.client.im.v1.message.create({
        params: {
            receive_id_type: 'chat_id',
        },
        data: {
            receive_id: chatId,
            msg_type: 'image',
            content: JSON.stringify({ image_key: imageKey }),
        },
    });

    const sendCode = sendResult?.code;
    if (typeof sendCode === 'number') {
        return sendCode === 0;
    }
    return Boolean(sendResult?.data?.message_id ?? (sendResult as any)?.message_id);
}

async function uploadFileAndGetKey(ctx: Context, filePath: string, fileName: string): Promise<string> {
    const fileApi = ((ctx.client as any).im?.v1?.file ?? (ctx.client as any).im?.file);
    if (!fileApi?.create) {
        throw new Error('当前飞书 SDK 不支持文件上传接口');
    }

    const uploadResult = await fileApi.create({
        data: {
            file_type: 'stream',
            file_name: fileName,
            file: fs.readFileSync(filePath),
        },
    });

    const fileKey = uploadResult?.data?.file_key ?? uploadResult?.file_key;
    const uploadCode = uploadResult?.code;
    const uploadFailed = typeof uploadCode === 'number' ? uploadCode !== 0 : false;
    if (uploadFailed || !fileKey) {
        throw new LarkApiError(
            uploadResult?.msg || '文件上传失败',
            uploadResult?.code,
            uploadResult
        );
    }

    return fileKey;
}

async function sendFileByKey(ctx: Context, chatId: string, fileKey: string): Promise<boolean> {
    const sendResult = await ctx.client.im.v1.message.create({
        params: {
            receive_id_type: 'chat_id',
        },
        data: {
            receive_id: chatId,
            msg_type: 'file',
            content: JSON.stringify({ file_key: fileKey }),
        },
    });

    const sendCode = sendResult?.code;
    if (typeof sendCode === 'number') {
        return sendCode === 0;
    }
    return Boolean(sendResult?.data?.message_id ?? (sendResult as any)?.message_id);
}

/**
 * 主动向聊天发送消息（默认当前聊天）
 */
export async function sendMessage(text: string, chatId?: string, ctx?: Context): Promise<string> {
    try {
        if (!ctx) {
            return '错误: 无法获取上下文，发送失败';
        }

        const targetChatId = chatId || ctx.rawEvent?.message?.chat_id;
        if (!targetChatId) {
            return '错误: 无法确定目标 chatId';
        }

        const ok = await ctx.sendToChat(targetChatId, text);
        if (ok) {
            return `已发送消息到聊天 ${targetChatId}`;
        }
        return '发送失败: 未知原因';
    } catch (error) {
        console.error('发送消息时发生错误:', error);
        return `发送消息时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * 获取 assets 目录下的表情包文件列表
 */
export async function getEmojiList(): Promise<string> {
    try {
        const entries = await fsPromises.readdir(assetsDir, { withFileTypes: true });
        const files = entries
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name)
            .filter((fileName) => IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase()))
            .sort((a, b) => a.localeCompare(b, 'zh-CN'));

        if (files.length === 0) {
            return `未找到可用表情包。请将图片放到 ${assetsDir}`;
        }

        return `可用表情包共 ${files.length} 个：\n${files.map((name) => `- ${name}`).join('\n')}`;
    } catch (error) {
        console.error('获取表情包列表时发生错误:', error);
        return `获取表情包列表时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
}

/**
 * 发送表情包图片（首次上传，后续复用 image_key）
 */
export async function sendImage(fileName: string, chatId?: string, ctx?: Context): Promise<string> {
    try {
        if (!ctx) {
            return '错误: 无法获取上下文，发送失败';
        }

        const targetChatId = chatId || ctx.rawEvent?.message?.chat_id;
        if (!targetChatId) {
            return '错误: 无法确定目标 chatId';
        }

        const normalizedFileName = fileName.trim();
        if (!normalizedFileName) {
            return '错误: 文件名不能为空';
        }

        const filePath = path.resolve(assetsDir, normalizedFileName);
        const relativePath = path.relative(assetsDir, filePath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            return '错误: 非法文件路径';
        }

        let imageKey = imageKeyCache.get(normalizedFileName);
        if (!imageKey) {
            await fsPromises.access(filePath);

            const ext = path.extname(normalizedFileName).toLowerCase();
            if (!IMAGE_EXTENSIONS.has(ext)) {
                return `错误: 不支持的图片格式 ${ext || '(无扩展名)'}`;
            }
        }

        try {
            if (!imageKey) {
                imageKey = await uploadImageAndGetKey(ctx, filePath);
                imageKeyCache.set(normalizedFileName, imageKey);
            }

            const sent = await sendImageByKey(ctx, targetChatId, imageKey);
            if (!sent) {
                return '图片发送失败: 未知原因';
            }
            return `已发送图片 ${normalizedFileName} 到聊天 ${targetChatId}`;
        } catch (imageError) {
            console.error('sendImage 图片路径发送失败，尝试文件兜底:', imageError);

            // 兜底：若图片接口权限不足，尝试按文件发送，至少确保用户能收到内容
            try {
                const fileKey = await uploadFileAndGetKey(ctx, filePath, normalizedFileName);
                const sentAsFile = await sendFileByKey(ctx, targetChatId, fileKey);
                if (sentAsFile) {
                    return `图片接口不可用，已改为文件发送 ${normalizedFileName} 到聊天 ${targetChatId}`;
                }
            } catch (fileError) {
                console.error('sendImage 文件兜底发送也失败:', fileError);
                return `发送图片失败: ${formatLarkError(fileError)}`;
            }

            return `发送图片失败: ${formatLarkError(imageError)}`;
        }
    } catch (error) {
        console.error('发送图片时发生错误:', error);
        return `发送图片时发生错误: ${formatLarkError(error)}`;
    }
}



