import type { Context } from '../core/context.js';
import { createProgram } from './programSetup.js';
import { runWithContext } from './commandContext.js';

/**
 * 使用 commander 解析并处理命令
 * @returns 是否成功识别并处理命令
 */
export async function handleCommand(
    textContent: string,
    ctx: Context
): Promise<boolean> {
    const normalizedText = textContent.replace(/^@\w+/, '').trim();
    if (!normalizedText) return false;
    //去掉@
    console.log('normalizedText', normalizedText);
    const argv = normalizedText.split(/\s+/);
    const program = createProgram();

    try {
        // 在 context 作用域内执行命令解析
        await runWithContext(ctx, () => program.parseAsync(argv, { from: 'user' }));
        return true;
    } catch (error: any) {
        if (error?.code === 'commander.unknownCommand') {
            return false;
        }
        if (error?.code === 'commander.missingArgument') {
            if (ctx.message) {
                ctx.message.textContent += '\n[命令中间件]这是一个命令，用户输入的命令不完整，请参考以下帮助信息：\n' + program.helpInformation();
            }
            return false;
        }
        console.warn('命令解析异常，按普通消息处理:', error?.message || error);
        return false;
    }
}
