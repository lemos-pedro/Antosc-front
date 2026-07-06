import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "get_sla_global",
  title: "Global SLA",
  description: "Return global availability SLA across all towers over the rolling window.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async () => {
    const base = process.env.ANTOSC_API_BASE_URL ?? "http://localhost:8000";
    const res = await fetch(new URL("/api/v1/sla/global", base).toString());
    if (!res.ok) {
      return { content: [{ type: "text", text: `Erro ${res.status}: ${res.statusText}` }], isError: true };
    }
    const data = await res.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { sla: data },
    };
  },
});