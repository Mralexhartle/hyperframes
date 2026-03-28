import { c } from "../ui/colors.js";
import type { ProjectLintResult } from "./lintProject.js";

export interface LintFormatOptions {
  /** Show elementId in brackets after the code (default: true) */
  showElementId?: boolean;
  /** Show summary line with error/warning counts (default: false) */
  showSummary?: boolean;
  /** Group errors before warnings per file (default: false — interleaved) */
  errorsFirst?: boolean;
}

/**
 * Format lint findings for console output. Used by lint, render, and dev commands.
 */
export function formatLintFindings(
  { results, totalErrors, totalWarnings }: ProjectLintResult,
  options: LintFormatOptions = {},
): string[] {
  const { showElementId = true, showSummary = false, errorsFirst = false } = options;
  const lines: string[] = [];
  const multiFile = results.length > 1;

  for (const { file, result } of results) {
    if (result.findings.length === 0) continue;

    const format = (finding: (typeof result.findings)[0]) => {
      const prefix = finding.severity === "error" ? c.error("✗") : c.warn("⚠");
      const fileLabel = multiFile ? c.dim(`[${file}] `) : "";
      const loc =
        showElementId && finding.elementId ? ` ${c.accent(`[${finding.elementId}]`)}` : "";
      lines.push(`  ${prefix} ${fileLabel}${c.bold(finding.code)}${loc}: ${finding.message}`);
      if (finding.fixHint) lines.push(`    ${c.dim(`Fix: ${finding.fixHint}`)}`);
    };

    if (errorsFirst) {
      for (const f of result.findings) if (f.severity === "error") format(f);
      for (const f of result.findings) if (f.severity === "warning") format(f);
    } else {
      for (const f of result.findings) format(f);
    }
  }

  if (showSummary) {
    const icon = totalErrors > 0 ? c.error("◇") : c.success("◇");
    lines.push("");
    lines.push(`${icon}  ${totalErrors} error(s), ${totalWarnings} warning(s)`);
  }

  return lines;
}
