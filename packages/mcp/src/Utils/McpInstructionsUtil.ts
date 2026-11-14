export class McpInstructionsUtil {
  static build(): string {
    return [
      "antigravity-connector is a personal server that answers through the owner's Google AI subscription, using the agy agent.",
      "Every tool call is a full agent run: it is slow (a web search takes about 20 to 45 seconds) and it counts against the daily limits.",
      "Use web_search for questions that need current information from the web. The answer comes with links; cite them.",
    ].join(" ");
  }
}
