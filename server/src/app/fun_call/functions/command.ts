/**
 * 命令相关 Function Call 函数
 */
import { createProgram } from '../../command/programSetup.js';

/**
 * 获取命令帮助信息
 */
export async function getCommandHelp(commandName?: string): Promise<string> {
    try {
        const program = createProgram();
        
        if (!commandName) {
            return `可用命令列表:\n\n${program.helpInformation()}`;
        }
        
        const commands = program.commands;
        const targetCommand = commands.find(cmd => 
            cmd.name() === commandName || 
            cmd.alias() === commandName ||
            cmd.aliases().includes(commandName)
        );
        
        if (!targetCommand) {
            const matchedCommands = commands.filter(cmd => {
                const name = cmd.name().toLowerCase();
                const aliases = cmd.aliases().map(a => a.toLowerCase());
                const keyword = commandName.toLowerCase();
                return name.includes(keyword) || aliases.some(a => a.includes(keyword));
            });
            
            if (matchedCommands.length === 0) {
                return `未找到命令 "${commandName}"。\n\n可用命令:\n${program.helpInformation()}`;
            }
            
            if (matchedCommands.length === 1) {
                return `命令 "${matchedCommands[0].name()}" 帮助:\n\n${matchedCommands[0].helpInformation()}`;
            }
            
            const matchedList = matchedCommands.map(cmd => {
                const aliases = cmd.aliases();
                const aliasStr = aliases.length > 0 ? ` (别名: ${aliases.join(', ')})` : '';
                return `- ${cmd.name()}${aliasStr}: ${cmd.description()}`;
            }).join('\n');
            
            return `找到 ${matchedCommands.length} 个匹配的命令:\n\n${matchedList}\n\n请指定具体命令名称获取详细帮助。`;
        }
        
        return `命令 "${targetCommand.name()}" 帮助:\n\n${targetCommand.helpInformation()}`;
    } catch (error) {
        return `获取命令帮助时发生错误: ${error instanceof Error ? error.message : String(error)}`;
    }
}






