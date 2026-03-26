import { defineCommand } from "citty";
import * as clack from "@clack/prompts";
import { c } from "../ui/colors.js";
import { VERSION } from "../version.js";

export default defineCommand({
  meta: { name: "upgrade", description: "Check for updates and show upgrade instructions" },
  args: {
    yes: { type: "boolean", alias: "y", description: "Show upgrade commands without prompting" },
    check: { type: "boolean", description: "Check for updates and exit (no prompt)" },
  },
  async run({ args }) {
    const autoYes = args.yes === true;
    const checkOnly = args.check === true;
    clack.intro(c.bold("hyperframes upgrade"));

    const s = clack.spinner();
    s.start("Checking for updates...");

    let latest: string;
    try {
      const res = await fetch("https://registry.npmjs.org/hyperframes/latest");
      if (!res.ok) {
        s.stop("Could not check for updates");
        clack.outro(c.dim("Package not yet published to npm."));
        return;
      }
      const data = (await res.json()) as { version?: string };
      latest = data.version ?? VERSION;
    } catch {
      s.stop("Could not check for updates");
      clack.outro(c.dim("Network error. Check your connection."));
      return;
    }

    if (latest === VERSION) {
      s.stop(c.success("Already up to date"));
      clack.outro(`${c.success("◇")}  ${c.bold("v" + VERSION)}`);
      return;
    }

    s.stop("Update available");

    console.log();
    console.log(`   ${c.dim("Current:")}  ${c.bold("v" + VERSION)}`);
    console.log(`   ${c.dim("Latest:")}   ${c.bold(c.accent("v" + latest))}`);
    console.log();

    if (checkOnly) {
      clack.outro(c.accent("Update available: v" + latest));
      return;
    }

    if (!autoYes) {
      const shouldUpgrade = await clack.confirm({
        message: "Upgrade now?",
      });

      if (clack.isCancel(shouldUpgrade) || !shouldUpgrade) {
        clack.outro(c.dim("Skipped."));
        return;
      }
    }

    console.log();
    console.log(`   ${c.accent("npm install -g hyperframes@" + latest)}`);
    console.log(`   ${c.dim("or")}`);
    console.log(`   ${c.accent("npx hyperframes@" + latest + " --version")}`);
    console.log();

    clack.outro(c.success("Run one of the commands above to upgrade."));
  },
});
