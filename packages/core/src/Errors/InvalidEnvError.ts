export class InvalidEnvError extends Error {
  readonly variableNames: readonly string[];

  constructor(variableNames: readonly string[]) {
    super(`Invalid environment variables: ${variableNames.join(", ")}. Values are not shown.`);
    this.name = "InvalidEnvError";
    this.variableNames = variableNames;
  }
}
