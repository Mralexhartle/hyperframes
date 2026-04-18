import { defineCommand } from "citty";
import { execFileSync, spawn } from "node:child_process";
import * as clack from "@clack/prompts";
import { c } from "../ui/colors.js";

function hasNpx(): boolean {
  try {
    execFileSync("npx", ["--version"], { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Environment additions for child processes that will do a `git clone`
 * on our behalf (e.g. the upstream `skills` CLI, which clones this repo
 * to read its `skills/` directory).
 *
 * Why this exists — GH #316:
 *
 * Git 2.45+ refuses to execute hooks during `git clone` unless the
 * caller opts in via `GIT_CLONE_PROTECTION_ACTIVE=0`. Users who have
 * run `git lfs install` globally have a post-checkout hook registered
 * at `core.hooksPath`. When the `skills` CLI (`npx skills add …`)
 * clones a repo, git detects the hook and aborts with:
 *
 *   fatal: active `post-checkout` hook found during `git clone`
 *
 * This fails even when the cloned repo itself doesn't use LFS — the
 * check is on the user's hooks, not the repo's content. Users report
 * `npx skills add heygen-com/hyperframes` bouncing off this consistently.
 *
 * Setting `GIT_CLONE_PROTECTION_ACTIVE=0` here is the correct knob for
 * our case: we're installing a known, trusted repo (`heygen-com/*`)
 * whose post-checkout hook is the user's own LFS hook — nothing
 * adversarial. The env-var name makes the trade-off explicit at the
 * call site rather than papering over it with a wrapper script.
 *
 * Upstream fix tracked separately: the `skills` CLI itself should set
 * this env var when it shells out to `git clone`, which would fix the
 * bug for every user invoking `skills` directly. Until that lands, we
 * patch our own code path.
 */
function gitCloneFriendlyEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GIT_CLONE_PROTECTION_ACTIVE: "0",
  };
}

function runSkillsAdd(repo: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["skills", "add", repo, "--all"], {
      stdio: "inherit",
      timeout: 120_000,
      env: gitCloneFriendlyEnv(),
    });
    child.on("close", (code, signal) => {
      if (code === 0) resolve();
      else if (signal === "SIGINT" || code === 130) process.exit(0);
      else reject(new Error(`npx skills add exited with code ${code}`));
    });
    child.on("error", reject);
  });
}

const SOURCES = [{ name: "HyperFrames", repo: "heygen-com/hyperframes" }];

export default defineCommand({
  meta: {
    name: "skills",
    description: "Install HyperFrames skills for AI coding tools",
  },
  args: {},
  async run() {
    if (!hasNpx()) {
      clack.log.error(c.error("npx not found. Install Node.js and retry."));
      return;
    }

    for (const source of SOURCES) {
      console.log();
      console.log(c.bold(`Installing ${source.name} skills...`));
      console.log();
      try {
        await runSkillsAdd(source.repo);
      } catch {
        console.log(c.dim(`${source.name} skills skipped`));
      }
    }
  },
});
