import { Command } from 'commander';
import { getCommandContext } from '../commandContext.js';

export async function handleHelp(program: Command): Promise<void> {
    const ctx = getCommandContext();
    await ctx.replyText(program.helpInformation());
}
