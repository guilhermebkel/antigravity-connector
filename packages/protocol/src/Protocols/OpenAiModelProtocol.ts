export type OpenAiModel = {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
};

export type ModelList = {
  object: "list";
  data: OpenAiModel[];
};
