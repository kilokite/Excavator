import OpenAI from "openai";
import { OPENAI_API_KEY } from "../../config.js";
import { TIEBA_OLD_BROTHER, TIEBA_OLD_BROTHER_DAILY, REBUTTAL_HANDLER } from "./prompt.js";
const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: OPENAI_API_KEY,
});

export async function transToTiebaOldBrother(text: string){
    const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
            {
                role: "system",
                content: TIEBA_OLD_BROTHER()
            },
            {
                role: "user",
                content: text
            }
        ]
    });
    return response.choices[0].message.content;
}

export async function transToTiebaOldBrotherDaily(text: string){
    const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
            {
                role: "system",
                content: TIEBA_OLD_BROTHER_DAILY()
            },
            {
                role: "user",
                content: text
            }
        ]
    });
    return response.choices[0].message.content;
}

/**
 * 处理用户对代码审查结果的反驳
 * @param userRebuttal 用户的反驳内容
 * @param reviewContent 原始代码审查报告内容
 * @returns AI 生成的回应
 */
export async function handleRebuttal(userRebuttal: string, reviewContent: string): Promise<string | null> {
    try {
        const response = await openai.chat.completions.create({
            model: "deepseek-chat",
            messages: [
                {
                    role: "system",
                    content: REBUTTAL_HANDLER()
                },
                {
                    role: "user",
                    content: `原始代码审查报告：\n\n${reviewContent}\n\n用户的反驳：\n\n${userRebuttal}\n\n请根据以上内容，生成一个专业、友好、有建设性的回应。`
                }
            ]
        });
        return response.choices[0].message.content;
    } catch (error) {
        console.error('处理反驳失败:', error);
        return null;
    }
}