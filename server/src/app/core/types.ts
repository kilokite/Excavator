export interface MessageData {
    message: {
        chat_id: string;
        message_id: string;
        message_type: string;
        content: string;
        parent_id?: string;
        root_id?: string;
        sender?: {
            sender_id?: {
                user_id?: string;
                open_id?: string;
            };
        };
    };
}

export interface ParsedMessage {
    chatId: string;
    messageId: string;
    textContent: string;
    senderId?: string;
    parentId?: string;
    rootId?: string;
}

