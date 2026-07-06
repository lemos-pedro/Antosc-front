import { defineMcp } from "@lovable.dev/mcp-js";
import listTowersTool from "./tools/list-towers";
import getTowerTool from "./tools/get-tower";
import slaGlobalTool from "./tools/sla-global";

export default defineMcp({
  name: "antosc-mcp",
  title: "ANTOSC — Monitorização de Torres",
  version: "0.1.0",
  instructions:
    "Tools for the ANTOSC telecom tower monitoring system. Use `list_towers` to browse towers (optionally filtered by status), `get_tower` to inspect one tower's details, and `get_sla_global` for the rolling availability SLA.",
  tools: [listTowersTool, getTowerTool, slaGlobalTool],
});