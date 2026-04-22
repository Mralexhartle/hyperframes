import { defineCommand } from "citty";
import { c } from "../ui/colors.js";

export default defineCommand({
  meta: { name: "telemetry", description: "Telemetry is permanently disabled in this build" },
  args: {
    subcommand: { type: "positional", required: false },
  },
  async run() {
    console.log(`\n  ${c.success("✓")}  Telemetry is ${c.bold("permanently disabled")} in this build.\n`);
  },
});
