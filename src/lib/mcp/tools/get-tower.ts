import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "get_tower",
  title: "Get tower details",
  description: "Fetch full details for a single tower by its ID.",
  inputSchema: {
    tower_id: z.string().min(1).describe("The tower identifier."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async ({ tower_id }) => {
    const base = process.env.ANTOSC_API_BASE_URL ?? "http://localhost:8000";
    const res = await fetch(new URL(`/api/v1/towers/${tower_id}`, base).toString());
    if (!res.ok) {
      return { content: [{ type: "text", text: `Erro ${res.status}: ${res.statusText}` }], isError: true };
    }
    const data = await res.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { tower: data },
    };
  },
});