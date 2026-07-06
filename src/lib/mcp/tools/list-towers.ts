import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_towers",
  title: "List towers",
  description: "List monitored telecom towers with status, operator and region.",
  inputSchema: {
    status: z.enum(["online", "degraded", "offline"]).optional().describe("Filter by tower status."),
    limit: z.number().int().min(1).max(200).optional().describe("Max rows to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ status, limit }) => {
    const base = process.env.ANTOSC_API_BASE_URL ?? "http://localhost:8000";
    const url = new URL("/api/v1/towers", base);
    if (status) url.searchParams.set("status", status);
    if (limit) url.searchParams.set("limit", String(limit));
    const res = await fetch(url.toString());
    if (!res.ok) {
      return { content: [{ type: "text", text: `Erro ${res.status}: ${res.statusText}` }], isError: true };
    }
    const data = await res.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { towers: data },
    };
  },
});