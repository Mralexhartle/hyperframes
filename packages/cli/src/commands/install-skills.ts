import { defineCommand } from "citty";
import { existsSync, mkdirSync, readdirSync, rmSync, cpSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as clack from "@clack/prompts";
import { c } from "../ui/colors.js";

// ---------------------------------------------------------------------------
// Target CLI tools — each has a global skills directory
// ---------------------------------------------------------------------------

interface Target {
  name: string;
  flag: string;
  dir: string;
  defaultEnabled: boolean;
}

const TARGETS: Target[] = [
  {
    name: "Claude Code",
    flag: "claude",
    dir: join(homedir(), ".claude", "skills"),
    defaultEnabled: true,
  },
  {
    name: "Gemini CLI",
    flag: "gemini",
    dir: join(homedir(), ".gemini", "skills"),
    defaultEnabled: true,
  },
  {
    name: "Codex CLI",
    flag: "codex",
    dir: join(homedir(), ".codex", "skills"),
    defaultEnabled: true,
  },
  {
    name: "Cursor",
    flag: "cursor",
    dir: join(process.cwd(), ".cursor", "skills"),
    defaultEnabled: false,
  },
];

const GSAP_REPO = "https://github.com/greensock/gsap-skills.git";
const GSAP_CACHE = join(homedir(), ".cache", "hyperframes", "gsap-skills");

// ---------------------------------------------------------------------------
// Bundled HyperFrames skills
// ---------------------------------------------------------------------------

function getBundledSkillsDir(): string {
  const dir = dirname(fileURLToPath(import.meta.url));
  const devPath = resolve(dir, "..", "..", "..", "..", "skills");
  const builtPath = resolve(dir, "skills");
  return existsSync(devPath) ? devPath : builtPath;
}

// ---------------------------------------------------------------------------
// GSAP skills — cloned from GitHub
// ---------------------------------------------------------------------------

function hasGit(): boolean {
  try {
    execSync("git --version", { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function fetchGsapSkills(): string {
  if (existsSync(GSAP_CACHE)) {
    try {
      execSync("git pull --ff-only", { cwd: GSAP_CACHE, stdio: "ignore", timeout: 30_000 });
    } catch {
      rmSync(GSAP_CACHE, { recursive: true, force: true });
      execSync(`git clone --depth 1 ${GSAP_REPO} ${GSAP_CACHE}`, {
        stdio: "ignore",
        timeout: 60_000,
      });
    }
  } else {
    mkdirSync(dirname(GSAP_CACHE), { recursive: true });
    execSync(`git clone --depth 1 ${GSAP_REPO} ${GSAP_CACHE}`, {
      stdio: "ignore",
      timeout: 60_000,
    });
  }
  return GSAP_CACHE;
}

// ---------------------------------------------------------------------------
// Install logic — generic per target directory
// ---------------------------------------------------------------------------

interface InstalledSkill {
  name: string;
  source: "hyperframes" | "gsap";
}

function installSkillsFromDir(
  sourceDir: string,
  targetDir: string,
  source: "hyperframes" | "gsap",
): InstalledSkill[] {
  const installed: InstalledSkill[] = [];
  if (!existsSync(sourceDir)) return installed;

  const entries = readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = join(sourceDir, entry.name, "SKILL.md");
    if (!existsSync(skillFile)) continue;

    const destDir = join(targetDir, entry.name);
    if (existsSync(destDir)) rmSync(destDir, { recursive: true, force: true });
    mkdirSync(destDir, { recursive: true });
    cpSync(join(sourceDir, entry.name), destDir, { recursive: true });
    installed.push({ name: entry.name, source });
  }
  return installed;
}

// ---------------------------------------------------------------------------
// Command
// ---------------------------------------------------------------------------

function resolveTargets(args: Record<string, unknown>): Target[] {
  const hasAnyFlag = TARGETS.some((t) => args[t.flag] === true);

  if (hasAnyFlag) {
    // Explicit flags — install only to those targets
    return TARGETS.filter((t) => args[t.flag] === true);
  }

  // No flags — install to all default-enabled targets
  return TARGETS.filter((t) => t.defaultEnabled);
}

async function runInstall({ args }: { args: Record<string, unknown> }): Promise<void> {
  clack.intro(c.bold("hyperframes skills"));

  const targets = resolveTargets(args);

  // 1. Gather skill sources
  const bundledDir = getBundledSkillsDir();
  const hasBundled = existsSync(bundledDir);

  let gsapSourceDir: string | undefined;
  if (!hasGit()) {
    clack.log.warn(c.warn("git not found — skipping GSAP skills. Install git and retry."));
  } else {
    const gsapSpinner = clack.spinner();
    gsapSpinner.start("Fetching GSAP skills from GitHub...");
    try {
      const cacheDir = fetchGsapSkills();
      const skillsRoot = join(cacheDir, "skills");
      if (existsSync(skillsRoot)) gsapSourceDir = skillsRoot;
      gsapSpinner.stop(c.success("GSAP skills fetched"));
    } catch (err) {
      gsapSpinner.stop(
        c.warn(`Failed to fetch GSAP skills: ${err instanceof Error ? err.message : err}`),
      );
    }
  }

  // 2. Install to each target
  const allInstalled: InstalledSkill[] = [];

  for (const target of targets) {
    const spinner = clack.spinner();
    spinner.start(`Installing to ${target.name}...`);

    mkdirSync(target.dir, { recursive: true });

    let count = 0;
    if (hasBundled) {
      const hf = installSkillsFromDir(bundledDir, target.dir, "hyperframes");
      count += hf.length;
      // Only track for summary from first target to avoid duplicates
      if (target === targets[0]) allInstalled.push(...hf);
    }
    if (gsapSourceDir) {
      const gsap = installSkillsFromDir(gsapSourceDir, target.dir, "gsap");
      count += gsap.length;
      if (target === targets[0]) allInstalled.push(...gsap);
    }

    spinner.stop(c.success(`${count} skills → ${target.name} ${c.dim(target.dir)}`));
  }

  // 3. Summary
  const hfNames = allInstalled.filter((s) => s.source === "hyperframes").map((s) => s.name);
  const gsapNames = allInstalled.filter((s) => s.source === "gsap").map((s) => s.name);

  console.log();
  if (hfNames.length > 0) {
    console.log(`   ${c.dim("HyperFrames:")} ${hfNames.map((s) => c.accent(s)).join(", ")}`);
  }
  if (gsapNames.length > 0) {
    console.log(`   ${c.dim("GSAP:")}        ${gsapNames.map((s) => c.accent(s)).join(", ")}`);
  }
  console.log(`   ${c.dim("Targets:")}     ${targets.map((t) => t.name).join(", ")}`);
  console.log();

  clack.outro(
    c.success(
      `${allInstalled.length} skills installed to ${targets.length} tool${targets.length > 1 ? "s" : ""}.`,
    ),
  );
}

export default defineCommand({
  meta: {
    name: "skills",
    description: "Install HyperFrames and GSAP skills for AI coding tools",
  },
  args: {
    claude: { type: "boolean", description: "Install to Claude Code (~/.claude/skills/)" },
    gemini: { type: "boolean", description: "Install to Gemini CLI (~/.gemini/skills/)" },
    codex: { type: "boolean", description: "Install to Codex CLI (~/.codex/skills/)" },
    cursor: {
      type: "boolean",
      description: "Install to Cursor (.cursor/skills/ in current project)",
    },
  },
  run: runInstall,
});
