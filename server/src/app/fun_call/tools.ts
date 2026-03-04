/**
 * Function Call 工具定义
 * 定义可供 AI 模型调用的函数及其参数
 */

/**
 * 获取 Function Call 工具列表
 * 这些工具会被传递给 OpenAI API
 */
export function getFunctionCallTools() {
    return [
        {
            type: "function" as const,
            function: {
                name: "get_git_log",
                description: "获取指定项目的 Git 提交历史记录。当用户询问项目的提交历史、最近的提交、git log 等信息时使用此函数。",
                parameters: {
                    type: "object",
                    properties: {
                        projectId: {
                            type: "string",
                            description: "项目ID，即 projects 目录下的子目录名称",
                        },
                        limit: {
                            type: "integer",
                            description: "返回的提交数量，默认为 10 条",
                            minimum: 1,
                            maximum: 50,
                            default: 10,
                        },
                    },
                    required: ["projectId"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function" as const,
            function: {
                name: "get_latest_commit",
                description: "获取指定项目的最新提交信息，包括分支、哈希、作者、时间和提交消息。当用户询问最新提交、最近的提交等信息时使用此函数。",
                parameters: {
                    type: "object",
                    properties: {
                        projectId: {
                            type: "string",
                            description: "项目ID，即 projects 目录下的子目录名称",
                        },
                    },
                    required: ["projectId"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function" as const,
            function: {
                name: "get_git_status",
                description: "获取指定项目的 Git 工作区状态，包括已修改、已暂存、未跟踪的文件等信息。当用户询问项目状态、工作区状态、是否有未提交的更改等信息时使用此函数。",
                parameters: {
                    type: "object",
                    properties: {
                        projectId: {
                            type: "string",
                            description: "项目ID，即 projects 目录下的子目录名称",
                        },
                    },
                    required: ["projectId"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function" as const,
            function: {
                name: "get_git_branches",
                description: "获取指定项目的分支列表。当用户询问项目有哪些分支、查看分支列表等信息时使用此函数。",
                parameters: {
                    type: "object",
                    properties: {
                        projectId: {
                            type: "string",
                            description: "项目ID，即 projects 目录下的子目录名称",
                        },
                        includeRemote: {
                            type: "boolean",
                            description: "是否包含远程分支，默认为 false（仅返回本地分支）",
                            default: false,
                        },
                    },
                    required: ["projectId"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function" as const,
            function: {
                name: "get_project_list",
                description: "获取所有项目列表，包括项目ID、别名、描述、标签等信息。当用户询问有哪些项目、列出所有项目、查看项目列表等信息时使用此函数。",
                parameters: {
                    type: "object",
                    properties: {},
                    required: [],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function" as const,
            function: {
                name: "get_project_info",
                description: "获取指定项目的详细信息，包括项目配置（别名、描述、标签、Git远程仓库等）。当用户询问某个项目的详细信息、查看项目配置等信息时使用此函数。",
                parameters: {
                    type: "object",
                    properties: {
                        projectId: {
                            type: "string",
                            description: "项目ID，即 projects 目录下的子目录名称",
                        },
                    },
                    required: ["projectId"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function" as const,
            function: {
                name: "search_projects",
                description: "根据关键词搜索项目，可以匹配项目ID、别名、描述、标签等。当用户想要查找特定项目、搜索项目等信息时使用此函数。",
                parameters: {
                    type: "object",
                    properties: {
                        keyword: {
                            type: "string",
                            description: "搜索关键词，可以匹配项目ID、别名、描述、标签等",
                        },
                    },
                    required: ["keyword"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function" as const,
            function: {
                name: "check_commit",
                description: "检查指定项目的提交，返回总结信息（只读）。当用户想要审查某个提交的摘要或检查结果时使用此函数。",
                parameters: {
                    type: "object",
                    properties: {
                        projectId: {
                            type: "string",
                            description: "项目ID，即 projects 目录下的子目录名称",
                        },
                        commitHash: {
                            type: "string",
                            description: "要检查的提交哈希",
                        },
                    },
                    required: ["projectId", "commitHash"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function" as const,
            function: {
                name: "send_message",
                description: "向聊天发送文本消息。默认发送到当前聊天，可指定 chatId。",
                parameters: {
                    type: "object",
                    properties: {
                        text: {
                            type: "string",
                            description: "要发送的文本内容",
                        },
                        chatId: {
                            type: "string",
                            description: "目标聊天ID，不填则使用当前聊天",
                        },
                    },
                    required: ["text"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function" as const,
            function: {
                name: "get_emoji_list",
                description: "获取 server/src/assets 下可用表情包（图片）文件名列表。当用户想查看有哪些表情包时使用此函数。",
                parameters: {
                    type: "object",
                    properties: {},
                    required: [],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function" as const,
            function: {
                name: "send_image",
                description: "发送表情包图片。参数为图片文件名（位于 server/src/assets），默认发到当前聊天，可指定 chatId。",
                parameters: {
                    type: "object",
                    properties: {
                        fileName: {
                            type: "string",
                            description: "图片文件名（带扩展名），例如：笑哭.png",
                        },
                        chatId: {
                            type: "string",
                            description: "目标聊天ID，不填则使用当前聊天",
                        },
                    },
                    required: ["fileName"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function" as const,
            function: {
                name: "get_command_help",
                description: "获取机器人命令的帮助信息。当用户询问有命令相关话题或遇到无法解决的问题等情况时使用此函数。可以获取所有命令的列表，命令只能由用户执行，权限更大，或指定命令名称获取详细帮助。",
                parameters: {
                    type: "object",
                    properties: {
                        commandName: {
                            type: "string",
                            description: "要查询的命令名称，支持命令名或别名。不填则返回所有可用命令列表。例如: 'git-status', 'gitStatus', 'project-list', 'pl' 等",
                        },
                    },
                    required: [],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function" as const,
            function: {
                name: "custom_code_check",
                description: "对指定项目的代码执行自定义检查。AI 可以生成自己的检查 prompt，要求 Claude 对代码执行检查。此函数强制使用只读模式，不会修改任何代码。当用户要求对代码进行特定方面的检查、审查或分析时使用此函数。",
                parameters: {
                    type: "object",
                    properties: {
                        projectId: {
                            type: "string",
                            description: "项目ID，即 projects 目录下的子目录名称",
                        },
                        checkPrompt: {
                            type: "string",
                            description: "自定义的检查 prompt，描述要对代码执行什么类型的检查或分析。例如：'检查代码中的安全漏洞'、'分析代码的性能问题'、'审查代码是否符合最佳实践'等",
                        },
                        timeout: {
                            type: "integer",
                            description: "超时时间（毫秒），默认为 10 分钟（600000 毫秒）。建议值：600000（10分钟）或 1200000（20分钟）",
                            minimum: 10000,
                            maximum: 1800000,
                        },
                    },
                    required: ["projectId", "checkPrompt"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function" as const,
            function: {
                name: "get_report_by_id",
                description: "根据报告ID获取代码审查报告。当用户提供报告ID或想要查看特定报告时使用此函数。",
                parameters: {
                    type: "object",
                    properties: {
                        reportId: {
                            type: "string",
                            description: "报告的唯一标识ID",
                        },
                    },
                    required: ["reportId"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function" as const,
            function: {
                name: "get_report_by_commit",
                description: "根据项目ID和提交哈希获取代码审查报告。当用户询问某个提交的审查结果时使用此函数。",
                parameters: {
                    type: "object",
                    properties: {
                        projectId: {
                            type: "string",
                            description: "项目ID，即 projects 目录下的子目录名称",
                        },
                        commitHash: {
                            type: "string",
                            description: "提交的哈希值（完整或部分）",
                        },
                    },
                    required: ["projectId", "commitHash"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function" as const,
            function: {
                name: "get_project_reports",
                description: "获取指定项目的所有审查报告列表。当用户询问某个项目有哪些审查报告、查看项目的审查历史时使用此函数。",
                parameters: {
                    type: "object",
                    properties: {
                        projectId: {
                            type: "string",
                            description: "项目ID，即 projects 目录下的子目录名称",
                        },
                        limit: {
                            type: "integer",
                            description: "返回的报告数量限制，默认为 10 条",
                            minimum: 1,
                            maximum: 100,
                            default: 10,
                        },
                    },
                    required: ["projectId"],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function" as const,
            function: {
                name: "get_all_reports",
                description: "获取所有审查报告列表。当用户询问有哪些审查报告、查看所有审查历史时使用此函数。",
                parameters: {
                    type: "object",
                    properties: {
                        limit: {
                            type: "integer",
                            description: "返回的报告数量限制，默认为 20 条",
                            minimum: 1,
                            maximum: 100,
                            default: 20,
                        },
                    },
                    required: [],
                    additionalProperties: false,
                },
            },
        },
        {
            type: "function" as const,
            function: {
                name: "get_report_full",
                description: "获取完整的审查报告内容（不截断）。当用户需要查看报告的完整内容时使用此函数。",
                parameters: {
                    type: "object",
                    properties: {
                        reportId: {
                            type: "string",
                            description: "报告的唯一标识ID",
                        },
                    },
                    required: ["reportId"],
                    additionalProperties: false,
                },
            },
        },
    ];
}

