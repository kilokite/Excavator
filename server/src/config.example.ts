// 示例配置文件：仅用于展示结构，不要在这里填真实密钥
// 使用方式：
// 1. 复制本文件为 config.ts
// 2. 在本地的 config.ts 中填写真实配置（该文件已在 .gitignore 中被忽略）

export const PORT = 13431;

// OpenAI / DeepSeek API Key
export const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY';

// 智谱开放平台 API Key（网络搜索等，可选，未设置时使用 OPENAI_API_KEY）
export const BIGMODEL_API_KEY = process.env.BIGMODEL_API_KEY || OPENAI_API_KEY;

// 联网搜索 API Key（可选，未设置时使用 BIGMODEL_API_KEY）
export const WEB_SEARCH_API_KEY = process.env.WEB_SEARCH_API_KEY || BIGMODEL_API_KEY;

// 飞书机器人配置
export const LARK_APP_ID = 'YOUR_LARK_APP_ID';
export const LARK_APP_SECRET = 'YOUR_LARK_APP_SECRET';

