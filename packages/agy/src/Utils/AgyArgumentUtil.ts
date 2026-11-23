import type { AgyOutputFormat, AgyRunRequest } from "@antigravity-connector/agy/Protocols/AgyRunnerProtocol.ts";

export class AgyArgumentUtil {
  static readonly DEFAULT_OUTPUT_FORMAT: AgyOutputFormat = "json";

  static build(
    request: AgyRunRequest,
    outputFormat: AgyOutputFormat = AgyArgumentUtil.DEFAULT_OUTPUT_FORMAT,
    schemaPath?: string,
  ): string[] {
    const baseArguments = ["-p", request.prompt, "--output-format", outputFormat, "--model", request.modelSlug];
    const planArguments = request.profile.isPlanMode ? ["--mode", "plan"] : [];
    const permissionArguments = request.profile.shouldSkipPermissions ? ["--dangerously-skip-permissions"] : [];
    const conversationArguments = request.conversationId === undefined ? [] : ["--conversation", request.conversationId];
    const schemaArguments = schemaPath === undefined ? [] : ["--json-schema", schemaPath];
    return [...baseArguments, ...planArguments, ...permissionArguments, ...conversationArguments, ...schemaArguments];
  }

  static buildPromptOnStdin(request: AgyRunRequest): string[] {
    const baseArguments = ["-p=", "--input-format", "stream-json", "--output-format", "stream-json", "--model", request.modelSlug];
    const planArguments = request.profile.isPlanMode ? ["--mode", "plan"] : [];
    const permissionArguments = request.profile.shouldSkipPermissions ? ["--dangerously-skip-permissions"] : [];
    const conversationArguments = request.conversationId === undefined ? [] : ["--conversation", request.conversationId];
    return [...baseArguments, ...planArguments, ...permissionArguments, ...conversationArguments];
  }
}
