import type { LintContext, HyperframeLintFinding } from "../context";
import { readAttr, truncateSnippet, extractOpenTags } from "../utils";

export const compositionRules: Array<(ctx: LintContext) => HyperframeLintFinding[]> = [
  // timed_element_missing_visibility_hidden
  ({ tags }) => {
    const findings: HyperframeLintFinding[] = [];
    for (const tag of tags) {
      if (tag.name === "audio" || tag.name === "script" || tag.name === "style") continue;
      if (!readAttr(tag.raw, "data-start")) continue;
      if (readAttr(tag.raw, "data-composition-id")) continue;
      if (readAttr(tag.raw, "data-composition-src")) continue;
      const classAttr = readAttr(tag.raw, "class") || "";
      const styleAttr = readAttr(tag.raw, "style") || "";
      const hasClip = classAttr.split(/\s+/).includes("clip");
      const hasHiddenStyle =
        /visibility\s*:\s*hidden/i.test(styleAttr) || /opacity\s*:\s*0/i.test(styleAttr);
      if (!hasClip && !hasHiddenStyle) {
        const elementId = readAttr(tag.raw, "id") || undefined;
        findings.push({
          code: "timed_element_missing_visibility_hidden",
          severity: "info",
          message: `<${tag.name}${elementId ? ` id="${elementId}"` : ""}> has data-start but no class="clip", visibility:hidden, or opacity:0. Consider adding initial hidden state if the element should not be visible before its start time.`,
          elementId,
          fixHint:
            'Add class="clip" (with CSS: .clip { visibility: hidden; }) or style="opacity:0" if the element should start hidden.',
          snippet: truncateSnippet(tag.raw),
        });
      }
    }
    return findings;
  },

  // deprecated_data_layer + deprecated_data_end
  ({ tags }) => {
    const findings: HyperframeLintFinding[] = [];
    for (const tag of tags) {
      if (readAttr(tag.raw, "data-layer") && !readAttr(tag.raw, "data-track-index")) {
        const elementId = readAttr(tag.raw, "id") || undefined;
        findings.push({
          code: "deprecated_data_layer",
          severity: "warning",
          message: `<${tag.name}${elementId ? ` id="${elementId}"` : ""}> uses data-layer instead of data-track-index.`,
          elementId,
          fixHint: "Replace data-layer with data-track-index. The runtime reads data-track-index.",
          snippet: truncateSnippet(tag.raw),
        });
      }
      if (readAttr(tag.raw, "data-end") && !readAttr(tag.raw, "data-duration")) {
        const elementId = readAttr(tag.raw, "id") || undefined;
        findings.push({
          code: "deprecated_data_end",
          severity: "warning",
          message: `<${tag.name}${elementId ? ` id="${elementId}"` : ""}> uses data-end without data-duration. Use data-duration in source HTML.`,
          elementId,
          fixHint:
            "Replace data-end with data-duration. The compiler generates data-end from data-duration automatically.",
          snippet: truncateSnippet(tag.raw),
        });
      }
    }
    return findings;
  },

  // template_literal_selector
  ({ scripts }) => {
    const findings: HyperframeLintFinding[] = [];
    for (const script of scripts) {
      const templateLiteralSelectorPattern =
        /(?:querySelector|querySelectorAll)\s*\(\s*`[^`]*\$\{[^}]+\}[^`]*`\s*\)/g;
      let tlMatch: RegExpExecArray | null;
      while ((tlMatch = templateLiteralSelectorPattern.exec(script.content)) !== null) {
        findings.push({
          code: "template_literal_selector",
          severity: "error",
          message:
            "querySelector uses a template literal variable (e.g. `${compId}`). " +
            "The HTML bundler's CSS parser crashes on these. Use a hardcoded string instead.",
          fixHint:
            "Replace the template literal variable with a hardcoded string. The bundler's CSS parser cannot handle interpolated variables in script content.",
          snippet: truncateSnippet(tlMatch[0]),
        });
      }
    }
    return findings;
  },

  // external_script_dependency
  ({ source }) => {
    const findings: HyperframeLintFinding[] = [];
    const externalScriptRe = /<script\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["'][^>]*>/gi;
    let match: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((match = externalScriptRe.exec(source)) !== null) {
      const src = match[1] ?? "";
      if (seen.has(src)) continue;
      seen.add(src);
      findings.push({
        code: "external_script_dependency",
        severity: "info",
        message: `This composition loads an external script from \`${src}\`. The HyperFrames bundler automatically hoists CDN scripts from sub-compositions into the parent document. In unbundled runtime mode, \`loadExternalCompositions\` re-injects them. If you're using a custom pipeline that bypasses both, you'll need to include this script manually.`,
        fixHint:
          "No action needed when using `hyperframes preview` or `hyperframes render`. If using a custom pipeline, add this script tag to your root composition or HTML page.",
        snippet: truncateSnippet(match[0] ?? ""),
      });
    }
    return findings;
  },

  // timed_element_missing_clip_class
  ({ tags }) => {
    const findings: HyperframeLintFinding[] = [];
    const skipTags = new Set(["audio", "video", "script", "style", "template"]);
    for (const tag of tags) {
      if (skipTags.has(tag.name)) continue;
      // Skip composition hosts
      if (readAttr(tag.raw, "data-composition-id")) continue;
      if (readAttr(tag.raw, "data-composition-src")) continue;

      const hasStart = readAttr(tag.raw, "data-start") !== null;
      const hasDuration = readAttr(tag.raw, "data-duration") !== null;
      const hasTrackIndex = readAttr(tag.raw, "data-track-index") !== null;
      if (!hasStart && !hasDuration && !hasTrackIndex) continue;

      const classAttr = readAttr(tag.raw, "class") || "";
      const hasClip = classAttr.split(/\s+/).includes("clip");
      if (hasClip) continue;

      const elementId = readAttr(tag.raw, "id") || undefined;
      findings.push({
        code: "timed_element_missing_clip_class",
        severity: "warning",
        message: `<${tag.name}${elementId ? ` id="${elementId}"` : ""}> has timing attributes but no class="clip". The element will be visible for the entire composition instead of only during its scheduled time range.`,
        elementId,
        fixHint:
          'Add class="clip" to the element. The HyperFrames runtime uses .clip to control visibility based on data-start/data-duration.',
        snippet: truncateSnippet(tag.raw),
      });
    }
    return findings;
  },

  // overlapping_clips_same_track
  ({ tags }) => {
    const findings: HyperframeLintFinding[] = [];

    type ClipInfo = { start: number; end: number; elementId?: string; snippet: string };
    const trackMap = new Map<string, ClipInfo[]>();

    for (const tag of tags) {
      const startStr = readAttr(tag.raw, "data-start");
      const durationStr = readAttr(tag.raw, "data-duration");
      const trackStr = readAttr(tag.raw, "data-track-index");
      if (!startStr || !durationStr || !trackStr) continue;

      const start = Number(startStr);
      const duration = Number(durationStr);
      const track = trackStr;

      // Skip non-numeric (relative timing references like "intro-comp")
      if (Number.isNaN(start) || Number.isNaN(duration)) continue;

      const clips = trackMap.get(track) || [];
      clips.push({
        start,
        end: start + duration,
        elementId: readAttr(tag.raw, "id") || undefined,
        snippet: truncateSnippet(tag.raw) || "",
      });
      trackMap.set(track, clips);
    }

    for (const [track, clips] of trackMap) {
      clips.sort((a, b) => a.start - b.start);
      for (let i = 0; i < clips.length - 1; i++) {
        const current = clips[i];
        const next = clips[i + 1];
        if (!current || !next) continue;
        if (current.end > next.start) {
          findings.push({
            code: "overlapping_clips_same_track",
            severity: "error",
            message: `Track ${track}: clip ending at ${current.end}s overlaps with clip starting at ${next.start}s. Overlapping clips on the same track cause rendering conflicts.`,
            fixHint:
              "Adjust data-start or data-duration so clips on the same track do not overlap, or move one clip to a different data-track-index.",
          });
        }
      }
    }

    return findings;
  },

  // invalid_data_props_json
  ({ tags }) => {
    const findings: HyperframeLintFinding[] = [];
    // readAttr uses [^"']+ which breaks on JSON containing quotes inside
    // single-quoted attributes. Use a dedicated regex that captures the full
    // single-quoted or double-quoted attribute value.
    const dataPropsRe = /\bdata-props\s*=\s*(?:'([^']*)'|"([^"]*)")/i;
    for (const tag of tags) {
      const match = tag.raw.match(dataPropsRe);
      if (!match) continue;
      const propsRaw = (match[1] ?? match[2] ?? "")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
      try {
        const parsed = JSON.parse(propsRaw);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
          throw new Error("not a plain object");
        }
      } catch {
        const elementId = readAttr(tag.raw, "id") || undefined;
        findings.push({
          code: "invalid_data_props_json",
          severity: "error",
          message: `<${tag.name}${elementId ? ` id="${elementId}"` : ""}> has data-props with invalid JSON. Value must be a JSON object: '{"key":"value"}'.`,
          elementId,
          fixHint:
            'Fix the data-props JSON. It must be a valid JSON object with string keys. Example: data-props=\'{"title":"Hello","color":"#fff"}\'',
          snippet: truncateSnippet(tag.raw),
        });
      }
    }
    return findings;
  },

  // mustache_placeholder_without_default
  ({ source, options }) => {
    const findings: HyperframeLintFinding[] = [];
    // Only warn in sub-composition files (not index.html), where standalone rendering matters
    const filePath = options.filePath || "";
    const isSubComposition =
      filePath.includes("compositions/") || filePath.includes("compositions\\");
    if (!isSubComposition) return findings;

    const placeholderRe = /\{\{(\s*[\w.-]+\s*)(?::([^}]*))?\}\}/g;
    let match: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((match = placeholderRe.exec(source)) !== null) {
      const key = (match[1] ?? "").trim();
      const hasDefault = match[2] !== undefined;
      if (!hasDefault && !seen.has(key)) {
        seen.add(key);
        findings.push({
          code: "mustache_placeholder_without_default",
          severity: "warning",
          message: `Placeholder {{${key}}} has no default value. This composition will show raw "{{${key}}}" when rendered standalone (preview, lint, render without a parent).`,
          fixHint: `Add a default: {{${key}:your default value}}. This ensures the composition renders correctly both standalone and when used with data-props.`,
          snippet: match[0],
        });
      }
    }
    return findings;
  },

  // unused_data_props_key (inline templates only — cross-file not supported)
  ({ rawSource }) => {
    const findings: HyperframeLintFinding[] = [];
    const placeholderRe = /\{\{(\s*[\w.-]+\s*)(?::[^}]*)?\}\}/g;

    // Use rawSource (not template-stripped source) to find hosts with data-props
    const rawTags = extractOpenTags(rawSource);
    for (const tag of rawTags) {
      // Only check hosts that reference inline templates (same-file)
      const compId = readAttr(tag.raw, "data-composition-id");
      if (!compId) continue;
      if (readAttr(tag.raw, "data-composition-src")) continue; // external — can't check

      const dataPropsMatch = tag.raw.match(/\bdata-props\s*=\s*(?:'([^']*)'|"([^"]*)")/i);
      if (!dataPropsMatch) continue;

      const propsRaw = (dataPropsMatch[1] ?? dataPropsMatch[2] ?? "")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&");
      let propsKeys: Set<string>;
      try {
        const parsed = JSON.parse(propsRaw);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) continue;
        propsKeys = new Set(Object.keys(parsed));
      } catch {
        continue; // invalid JSON is caught by invalid_data_props_json rule
      }
      if (propsKeys.size === 0) continue;

      // Find the matching inline template
      const templateRe = new RegExp(
        `<template[^>]*id=["']${compId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-template["'][^>]*>([\\s\\S]*?)</template>`,
        "i",
      );
      const templateMatch = rawSource.match(templateRe);
      if (!templateMatch?.[1]) continue;

      // Collect all placeholder keys in the template
      const templateKeys = new Set<string>();
      let pMatch: RegExpExecArray | null;
      const pRe = new RegExp(placeholderRe.source, placeholderRe.flags);
      while ((pMatch = pRe.exec(templateMatch[1])) !== null) {
        templateKeys.add((pMatch[1] ?? "").trim());
      }

      // Warn about props keys that don't match any placeholder
      for (const key of propsKeys) {
        if (!templateKeys.has(key)) {
          const elementId = readAttr(tag.raw, "id") || undefined;
          findings.push({
            code: "unused_data_props_key",
            severity: "warning",
            message: `data-props key "${key}" on <${tag.name}${elementId ? ` id="${elementId}"` : ""}> does not match any {{${key}}} placeholder in the "${compId}" template. Possible typo.`,
            elementId,
            fixHint: `Check the key name. Available placeholders in the template: ${[...templateKeys].map((k) => `{{${k}}}`).join(", ") || "(none found)"}`,
            snippet: truncateSnippet(tag.raw),
          });
        }
      }
    }
    return findings;
  },

  // requestanimationframe_in_composition
  ({ scripts }) => {
    const findings: HyperframeLintFinding[] = [];
    for (const script of scripts) {
      // Strip comments to avoid false positives
      const stripped = script.content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      if (/requestAnimationFrame\s*\(/.test(stripped)) {
        findings.push({
          code: "requestanimationframe_in_composition",
          severity: "warning",
          message:
            "`requestAnimationFrame` runs on wall-clock time, not the GSAP timeline. It will not sync with frame capture and may cause flickering or missed frames during rendering.",
          fixHint:
            "Use GSAP tweens or onUpdate callbacks instead of requestAnimationFrame for animation logic.",
          snippet: truncateSnippet(script.content),
        });
      }
    }
    return findings;
  },
];
