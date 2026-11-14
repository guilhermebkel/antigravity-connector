export type OpenAiRole = "system" | "developer" | "user" | "assistant";

export type OpenAiTextPart = {
  type: "text";
  text: string;
};

export type OpenAiImagePart = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type OpenAiContentPart = OpenAiTextPart | OpenAiImagePart;

export type OpenAiMessage = {
  role: OpenAiRole;
  content: string | OpenAiContentPart[];
};

export type ChatCompletionRequest = {
  model: string;
  messages: OpenAiMessage[];
  stream?: boolean;
  stream_options?: { include_usage?: boolean };
  reasoning_effort?: string;
  response_format?: {
    type: "text" | "json_object" | "json_schema";
    json_schema?: unknown;
  };
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  tools?: unknown[];
  tool_choice?: unknown;
  conversation_id?: string;
};

export type OpenAiFinishReason = "stop" | "length" | "tool_calls" | "content_filter";

export type OpenAiUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  completion_tokens_details?: { reasoning_tokens: number };
  prompt_tokens_details?: { cached_tokens: number };
};

export type ChatCompletionResponse = {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: OpenAiFinishReason;
  }[];
  usage: OpenAiUsage;
  conversation_id: string;
};

export type ChatCompletionChunk = {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: "assistant";
      content?: string;
    };
    finish_reason: OpenAiFinishReason | null;
  }[];
  usage?: OpenAiUsage | null;
};
