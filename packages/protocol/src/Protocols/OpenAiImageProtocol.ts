export type ImageGenerationRequest = {
  prompt: string;
  model?: string;
  n?: number;
  size?: string;
  quality?: string;
  style?: string;
  response_format?: string;
};

export type ImageGenerationResponse = {
  created: number;
  data: { b64_json: string }[];
};
