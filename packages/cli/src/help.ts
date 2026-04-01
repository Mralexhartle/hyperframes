/**
 * Custom help renderer for the hyperframes CLI.
 *
 * Root-level: kubectl-style grouped categories + examples.
 * Subcommands: citty's standard USAGE/ARGUMENTS/OPTIONS + appended examples.
 */
import { renderUsage } from "citty";
import type { CommandDef } from "citty";
import { VERSION } from "./version.js";

// ── ANSI helpers (respect NO_COLOR / TERM=dumb / non-TTY) ──────────────────
const colorEnabled =
  process.env.NO_COLOR !== "1" && process.env.TERM !== "dumb" && (process.stdout.isTTY ?? false);

const esc = (open: number, close: number) => (s: string) =>
  colorEnabled ? `\x1b[${open}m${s}\x1b[${close}m` : s;

const bold = esc(1, 22);
const cyan = esc(36, 39);
const dim = esc(2, 22);
const gray = esc(90, 39);

// ── Root-level command groups ──────────────────────────────────────────────
interface Group {
  title: string;
  commands: [name: string, description: string][];
}

const GROUPS: Group[] = [
  {
    title: "Getting Started",
    commands: [
      ["init", "Scaffold a new composition project"],
      ["preview", "Start the studio for previewing compositions"],
      ["render", "Render a composition to MP4 or WebM"],
    ],
  },
  {
    title: "Project",
    commands: [
      ["lint", "Validate a composition for common mistakes"],
      ["info", "Print project metadata"],
      ["compositions", "List all compositions in a project"],
      ["docs", "View inline documentation in the terminal"],
    ],
  },
  {
    title: "Tooling",
    commands: [
      ["benchmark", "Render with presets and compare speed and file size"],
      ["browser", "Manage the Chrome browser used for rendering"],
      ["doctor", "Check system dependencies and environment"],
      ["upgrade", "Check for updates and show upgrade instructions"],
    ],
  },
  {
    title: "AI & Integrations",
    commands: [
      ["skills", "Install HyperFrames and GSAP skills for AI coding tools"],
      ["transcribe", "Transcribe audio/video to word-level timestamps"],
    ],
  },
  {
    title: "Settings",
    commands: [["telemetry", "Manage anonymous usage telemetry"]],
  },
];

// ── Root-level examples ────────────────────────────────────────────────────
const ROOT_EXAMPLES: [command: string, comment: string][] = [
  ["hyperframes init my-video", "Create a new project"],
  ["hyperframes preview", "Start the live preview studio"],
  ["hyperframes render -o out.mp4", "Render to MP4"],
  ["hyperframes render --format webm -o out.webm", "Transparent WebM overlay"],
  ["hyperframes lint", "Validate your composition"],
  ["hyperframes doctor", "Check system dependencies"],
];

// ── Per-command examples (kubectl style: comment + command) ────────────────
// Each entry is [comment, command].
const COMMAND_EXAMPLES: Record<string, [comment: string, command: string][]> = {
  init: [
    ["Create a project with the interactive wizard", "hyperframes init my-video"],
    ["Pick a starter template", "hyperframes init my-video --template warm-grain"],
    ["Start from an existing video file", "hyperframes init my-video --video clip.mp4"],
    ["Start from an audio file", "hyperframes init my-video --audio track.mp3"],
    ["Non-interactive mode (for CI or AI agents)", "hyperframes init my-video --non-interactive"],
  ],
  preview: [
    ["Preview the current project", "hyperframes preview"],
    ["Preview a specific project directory", "hyperframes preview ./my-video"],
    ["Use a custom port", "hyperframes preview --port 8080"],
  ],
  render: [
    ["Render to MP4", "hyperframes render --output output.mp4"],
    ["Render transparent WebM overlay", "hyperframes render --format webm --output overlay.webm"],
    ["High quality at 60fps", "hyperframes render --fps 60 --quality high --output hd.mp4"],
    ["Deterministic render via Docker", "hyperframes render --docker --output deterministic.mp4"],
    ["Parallel rendering with 4 workers", "hyperframes render --workers 4 --output fast.mp4"],
  ],
  lint: [
    ["Lint the current project", "hyperframes lint"],
    ["Lint a specific directory", "hyperframes lint ./my-video"],
    ["Output findings as JSON", "hyperframes lint --json"],
    ["Include info-level findings", "hyperframes lint --verbose"],
  ],
  info: [
    ["Show project metadata", "hyperframes info"],
    ["Output as JSON", "hyperframes info --json"],
  ],
  compositions: [
    ["List compositions in the current project", "hyperframes compositions"],
    ["Output as JSON", "hyperframes compositions --json"],
  ],
  benchmark: [
    ["Run benchmarks with default settings (3 runs)", "hyperframes benchmark"],
    ["Run 5 iterations per config", "hyperframes benchmark --runs 5"],
    ["Output results as JSON", "hyperframes benchmark --json"],
  ],
  browser: [
    ["Find or download Chrome for rendering", "hyperframes browser ensure"],
    ["Print the Chrome executable path", "hyperframes browser path"],
    ["Remove cached Chrome download", "hyperframes browser clear"],
  ],
  skills: [
    ["Install skills to all supported AI tools", "hyperframes skills"],
    ["Install to Claude Code only", "hyperframes skills --claude"],
    ["Install to Cursor (project-level)", "hyperframes skills --cursor"],
    ["Install to specific tools", "hyperframes skills --claude --gemini"],
  ],
  transcribe: [
    ["Transcribe an audio file", "hyperframes transcribe audio.mp3"],
    ["Transcribe a video file", "hyperframes transcribe video.mp4"],
    [
      "Use a larger model for better accuracy",
      "hyperframes transcribe audio.mp3 --model medium.en",
    ],
    ["Set language to filter non-target speech", "hyperframes transcribe audio.mp3 --language en"],
    ["Import an existing SRT file", "hyperframes transcribe subtitles.srt"],
    ["Import an OpenAI Whisper JSON response", "hyperframes transcribe response.json"],
  ],
  docs: [
    ["List all available topics", "hyperframes docs"],
    ["Read about data attributes", "hyperframes docs data-attributes"],
    ["Read about rendering", "hyperframes docs rendering"],
    ["Read about GSAP integration", "hyperframes docs gsap"],
  ],
  doctor: [["Check system dependencies", "hyperframes doctor"]],
  upgrade: [
    ["Check for updates interactively", "hyperframes upgrade"],
    ["Check for updates without prompting", "hyperframes upgrade --check"],
    ["Show upgrade commands directly", "hyperframes upgrade --yes"],
  ],
  telemetry: [
    ["Check current telemetry status", "hyperframes telemetry status"],
    ["Disable telemetry", "hyperframes telemetry disable"],
    ["Enable telemetry", "hyperframes telemetry enable"],
  ],
};

// ── Render root help ───────────────────────────────────────────────────────
function renderRootHelp(): string {
  const NAME_COL = 16;
  const CMD_COL = 46;
  const lines: string[] = [];

  lines.push(
    `${bold("hyperframes")} ${dim(`v${VERSION}`)} — Create and render HTML video compositions`,
  );
  lines.push("");
  lines.push(`${bold("Usage:")}  hyperframes ${cyan("<command>")} [options]`);
  lines.push("");

  for (const group of GROUPS) {
    lines.push(bold(`${group.title}:`));
    for (const [name, desc] of group.commands) {
      lines.push(`  ${cyan(name.padEnd(NAME_COL))}${desc}`);
    }
    lines.push("");
  }

  lines.push(bold("Examples:"));
  for (const [command, comment] of ROOT_EXAMPLES) {
    lines.push(`  ${dim("$")} ${command.padEnd(CMD_COL)} ${dim(comment)}`);
  }
  lines.push("");

  lines.push(`Run ${cyan("hyperframes <command> --help")} for more information about a command.`);

  return lines.join("\n");
}

// ── Format examples section (kubectl style) ────────────────────────────────
function formatExamples(examples: [string, string][]): string {
  const lines: string[] = [];
  lines.push(bold("Examples:"));
  for (const [comment, command] of examples) {
    lines.push(`  ${gray(`# ${comment}`)}`);
    lines.push(`  ${command}`);
    lines.push("");
  }
  return lines.join("\n");
}

// ── Main showUsage override ────────────────────────────────────────────────
export async function showUsage(cmd: CommandDef, parent?: CommandDef): Promise<void> {
  if (!parent) {
    // Root help → custom grouped output
    console.log(renderRootHelp() + "\n");
    return;
  }

  // Subcommand help → citty's structured output + our examples
  const usage = await renderUsage(cmd, parent);
  console.log(usage + "\n");

  const meta = await (typeof cmd.meta === "function" ? cmd.meta() : cmd.meta);
  const name = meta?.name;
  if (name && COMMAND_EXAMPLES[name]) {
    console.log(formatExamples(COMMAND_EXAMPLES[name]) + "\n");
  }
}
