export type AgyStatus = "SUCCESS" | "ERROR" | "unknown";

export type AgyUsage = {
  input_tokens: number;
  output_tokens: number;
  thinking_tokens: number;
  cache_read_tokens: number;
  total_tokens: number;
};

export type AgyEnvelope = {
  conversation_id: string;
  status: AgyStatus;
  response: string;
  usage: AgyUsage;
  num_turns?: number;
  duration_seconds?: number;
  structured_output?: unknown;
  error?: string;
};
