import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgyRunRequest } from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";

export class AgyWorkspaceUtil {
  static readonly SCHEMA_FILE_NAME = "schema.json";

  static async writeInputs(directory: string, request: AgyRunRequest): Promise<string | undefined> {
    for (const attachment of request.attachments ?? []) {
      await writeFile(join(directory, attachment.fileName), attachment.bytes);
    }
    if (request.jsonSchema === undefined) {
      return undefined;
    }
    const schemaPath = join(directory, AgyWorkspaceUtil.SCHEMA_FILE_NAME);
    await writeFile(schemaPath, request.jsonSchema, "utf8");
    return schemaPath;
  }
}
