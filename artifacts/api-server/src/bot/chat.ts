export type ChatMessageType = "chat" | "system" | "whisper" | "self";

export interface ChatMessage {
  ts: number;
  sender: string;
  text: string;
  type: ChatMessageType;
}

const MAX_MESSAGES = 200;
const messages: ChatMessage[] = [];

export function pushChat(m: ChatMessage): void {
  messages.push(m);
  if (messages.length > MAX_MESSAGES) {
    messages.splice(0, messages.length - MAX_MESSAGES);
  }
}

export function getChatMessages(): ChatMessage[] {
  return messages;
}
