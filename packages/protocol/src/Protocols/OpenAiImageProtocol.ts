export type ImageGenerationRequest = {
  prompt: string;
  model?: string;
  n?: number;
  size?: string;
  response_format?: "b64_json";
};

export type ImageGenerationResponse = {
  created: number;
  data: { b64_json: string }[];
};
