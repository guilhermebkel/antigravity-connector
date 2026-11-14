import { ResponseSchemaWrapperSchema, type ChatCompletionRequest } from "@antigravity-connector/protocol";
import { ApiRequestError } from "@antigravity-connector/api/Errors/ApiRequestError.ts";

type ResponseFormat = NonNullable<ChatCompletionRequest["response_format"]>;

export class ChatSchemaUtil {
  static readonly MAX_SCHEMA_BYTES = 65536;

  static readonly JSON_OBJECT_SCHEMA = "{\"type\":\"object\"}";

  static readonly TYPE_TO_SCHEMA: Readonly<Record<ResponseFormat["type"], (format: ResponseFormat) => string | undefined>> = {
    text: () => undefined,
    json_object: () => ChatSchemaUtil.JSON_OBJECT_SCHEMA,
    json_schema: (format) => ChatSchemaUtil.readSchemaText(format.json_schema),
  };

  static readResponseSchema(request: ChatCompletionRequest): string | undefined {
    const format = request.response_format;
    if (format === undefined) {
      return undefined;
    }
    return ChatSchemaUtil.TYPE_TO_SCHEMA[format.type](format);
  }

  static readSchemaText(jsonSchema: unknown): string {
    const parsed = ResponseSchemaWrapperSchema.safeParse(jsonSchema);
    if (!parsed.success) {
      throw new ApiRequestError(
        "invalid_request_error",
        "response_format",
        "response_format with type json_schema needs json_schema.schema, a JSON object.",
      );
    }
    const schemaText = JSON.stringify(parsed.data.schema);
    if (Buffer.byteLength(schemaText) > ChatSchemaUtil.MAX_SCHEMA_BYTES) {
      throw new ApiRequestError("invalid_request_error", "response_format", "response_format schema is larger than 64 KB.");
    }
    return schemaText;
  }
}
