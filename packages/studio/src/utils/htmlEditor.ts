/**
 * HTML Editor — Surgical split/delete operations on HyperFrame HTML source.
 *
 * Uses a hybrid approach: DOMParser for validation + regex for mutation.
 * - DOMParser validates the element exists, gets tag name, checks structure
 * - Regex operates on the raw source string, preserving ALL formatting
 * - Scripts are never parsed/executed — opaque string content
 * - Only targeted attributes change — everything else stays byte-identical
 */

import type { CapturedStyles } from "./styleCapture";

/**
 * Parse a CSS inline style string into a key-value map.
 * e.g. "opacity: 0.5; transform: matrix(1,0,0,1,0,0)" →
 *      { opacity: "0.5", transform: "matrix(1,0,0,1,0,0)" }
 */
export function parseStyleString(style: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const decl of style.split(";")) {
    const colonIdx = decl.indexOf(":");
    if (colonIdx < 0) continue;
    const key = decl.slice(0, colonIdx).trim();
    const value = decl.slice(colonIdx + 1).trim();
    if (key && value) result[key] = value;
  }
  return result;
}

/**
 * Merge `newStyles` into an opening tag string's `style` attribute.
 * - New values win over existing ones.
 * - If no `style` attribute is present, one is added before the closing `>`.
 */
export function mergeStyleIntoTag(tag: string, newStyles: string): string {
  if (!newStyles.trim()) return tag;

  const incoming = parseStyleString(newStyles);

  // Match style="..." or style='...' — handle multi-line attrs via dotall-like trick
  const styleAttrRe = /style=(["'])([\s\S]*?)\1/;
  const match = tag.match(styleAttrRe);

  if (match) {
    const quote = match[1];
    const existing = parseStyleString(match[2]);
    const merged = { ...existing, ...incoming };
    const serialized = Object.entries(merged)
      .map(([k, v]) => `${k}: ${v}`)
      .join("; ");
    return tag.replace(styleAttrRe, `style=${quote}${serialized}${quote}`);
  }

  // No style attribute — insert one before the closing `>`
  const serialized = Object.entries(incoming)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");
  // Handle self-closing tags (`/>`) and regular closing (`>`)
  return tag.replace(/(\/?>)$/, ` style="${serialized}"$1`);
}

/**
 * Apply baked (computed) styles from a `CapturedStyles` snapshot onto a clone
 * HTML string. This overwrites any initial animation state (e.g. opacity:0)
 * with the live computed values captured at the split point.
 */
export function applyBakedStyles(cloneHtml: string, captured: CapturedStyles): string {
  let result = cloneHtml;

  // Patch the root element (first opening tag in the string)
  if (captured.rootStyle) {
    // The root element is the first tag — find its end
    const firstTagEnd = result.indexOf(">");
    if (firstTagEnd >= 0) {
      const firstTag = result.slice(0, firstTagEnd + 1);
      const patched = mergeStyleIntoTag(firstTag, captured.rootStyle);
      result = patched + result.slice(firstTagEnd + 1);
    }
  }

  // Patch each child element that has an id
  for (const [id, style] of captured.elementStyles) {
    if (!style) continue;
    const idIdx = result.indexOf(`id="${id}"`);
    if (idIdx < 0) continue;

    // Walk backward to find the `<` that starts this tag
    let tagStart = idIdx;
    while (tagStart > 0 && result[tagStart] !== "<") tagStart--;

    // Walk forward to find the closing `>` of the opening tag (quote-aware)
    let tagEnd = idIdx;
    let inQuote: string | null = null;
    while (tagEnd < result.length) {
      const ch = result[tagEnd];
      if (inQuote) {
        if (ch === inQuote) inQuote = null;
      } else {
        if (ch === '"' || ch === "'") inQuote = ch;
        if (ch === ">") {
          tagEnd++;
          break;
        }
      }
      tagEnd++;
    }

    const openTag = result.slice(tagStart, tagEnd);
    const patched = mergeStyleIntoTag(openTag, style);
    result = result.slice(0, tagStart) + patched + result.slice(tagEnd);
  }

  // Second pass: apply styles for positional (class-based) captures — elements without IDs
  // that were captured under keys like __cls_{className}_{index}.
  // We use DOMParser on the clone HTML only (format preservation doesn't matter for clones).
  const positionalEntries = [...captured.elementStyles.entries()].filter(([key]) =>
    key.startsWith("__cls_"),
  );

  if (positionalEntries.length > 0) {
    const posParser = new DOMParser();
    const posDoc = posParser.parseFromString(result, "text/html");

    for (const [key, style] of positionalEntries) {
      if (!style) continue;
      // Key format: __cls_{className}_{index}
      const match = key.match(/^__cls_(.+)_(\d+)$/);
      if (!match) continue;
      const [, className, idxStr] = match;
      const targetIdx = parseInt(idxStr, 10);

      // Find all elements carrying this class; pick the one at targetIdx within its parent.
      const candidates = posDoc.querySelectorAll(`.${CSS.escape(className)}`);
      for (const el of candidates) {
        const parent = el.parentElement;
        if (!parent) continue;
        const siblingIdx = Array.from(parent.children).indexOf(el as Element);
        if (siblingIdx === targetIdx) {
          // Merge existing inline style with captured style (captured values win).
          const existing = parseStyleString(el.getAttribute("style") || "");
          const incoming = parseStyleString(style);
          const merged = { ...existing, ...incoming };
          const serialized = Object.entries(merged)
            .map(([k, v]) => `${k}: ${v}`)
            .join("; ");
          el.setAttribute("style", serialized);
          break;
        }
      }
    }

    result = posDoc.body.innerHTML;
  }

  // Apply captured textContent for leaf elements (GSAP counter / typewriter effects).
  // Only replace innerHTML for elements that contain no child element tags — replacing
  // a parent's innerHTML would destroy its children.
  if (captured.textContents) {
    for (const [id, text] of captured.textContents) {
      const idIdx = result.indexOf(`id="${id}"`);
      if (idIdx < 0) continue;

      // Walk backward to find the opening `<`
      let tagStart = idIdx;
      while (tagStart > 0 && result[tagStart] !== "<") tagStart--;

      // Walk forward to find the end of the opening tag (quote-aware)
      let tagEnd = tagStart;
      let inQ: string | null = null;
      while (tagEnd < result.length) {
        const ch = result[tagEnd];
        if (inQ) {
          if (ch === inQ) inQ = null;
        } else {
          if (ch === '"' || ch === "'") inQ = ch;
          if (ch === ">") {
            tagEnd++;
            break;
          }
        }
        tagEnd++;
      }

      const openTag = result.slice(tagStart, tagEnd);

      // Skip self-closing tags — they can't have text content.
      if (openTag.trimEnd().endsWith("/>")) continue;

      // Find the tag name to locate the closing tag.
      const tagNameMatch = openTag.match(/^<([a-z][a-z0-9]*)/i);
      if (!tagNameMatch) continue;
      const tagName = tagNameMatch[1].toLowerCase();
      const closeTag = `</${tagName}>`;

      const closeIdx = result.indexOf(closeTag, tagEnd);
      if (closeIdx < 0) continue;

      // Extract current innerHTML between opening and closing tags.
      const currentInner = result.slice(tagEnd, closeIdx);

      // Only replace if this is a text-only element — no child element tags.
      if (currentInner.includes("<")) continue;

      result = result.slice(0, tagEnd) + text + result.slice(closeIdx);
    }
  }

  // Inject seek scripts for canvas renderers (Lottie, Three.js)
  if (captured.seekScripts.length > 0) {
    result += "\n" + captured.seekScripts.join("\n");
  }

  return result;
}

/**
 * Replace a single attribute value in an opening tag string.
 * Returns the tag with the attribute updated, or unchanged if not found.
 */
function patchAttrInTag(tag: string, attrName: string, newValue: string): string {
  const re = new RegExp(`(${attrName}=["'])([^"']*)(["'])`);
  return tag.replace(re, `$1${newValue}$3`);
}

/**
 * Find the full opening tag in the source HTML for an element with a given ID.
 * Returns the match with: [fullTag, indent, openTag, tagName] or null.
 */
function findOpeningTag(
  html: string,
  elementId: string,
): {
  fullTag: string;
  indent: string;
  openTag: string;
  tagName: string;
  index: number;
} | null {
  // Match the opening tag containing this ID — [^>]* handles single-line attrs
  // For multi-line attrs: the id="X" anchors us, then we find < before and > after
  const idIdx = html.indexOf(`id="${elementId}"`);
  if (idIdx < 0) return null;

  // Walk backward to find < and capture indent
  let tagStart = idIdx;
  while (tagStart > 0 && html[tagStart] !== "<") tagStart--;

  // Capture indent (whitespace before the <)
  let indentStart = tagStart;
  while (indentStart > 0 && html[indentStart - 1] !== "\n") indentStart--;
  const indent = html.slice(indentStart, tagStart);

  // Walk forward from id to find the closing > of the opening tag
  let tagEnd = idIdx;
  let inQuote: string | null = null;
  while (tagEnd < html.length) {
    const ch = html[tagEnd];
    if (inQuote) {
      if (ch === inQuote) inQuote = null;
    } else {
      if (ch === '"' || ch === "'") inQuote = ch;
      if (ch === ">") {
        tagEnd++;
        break;
      }
    }
    tagEnd++;
  }

  const openTag = html.slice(tagStart, tagEnd);
  const tagNameMatch = openTag.match(/^<([a-z][a-z0-9]*)/i);
  if (!tagNameMatch) return null;

  return {
    fullTag: openTag,
    indent: /^[\t ]*$/.test(indent) ? indent : "",
    openTag,
    tagName: tagNameMatch[1],
    index: tagStart,
  };
}

/**
 * Find the full element block (opening tag through closing tag) in the source.
 * Uses quote-aware scanning to handle attributes containing >.
 * Uses depth counting to handle nested same-name tags.
 */
function findElementBlock(
  html: string,
  elementId: string,
): {
  start: number;
  end: number;
  openTag: string;
  tagName: string;
  indent: string;
  innerContent: string;
  isSelfClosing: boolean;
} | null {
  const info = findOpeningTag(html, elementId);
  if (!info) return null;

  const { openTag, tagName, index: start, indent } = info;
  const isSelfClosing =
    openTag.trimEnd().endsWith("/>") ||
    ["img", "br", "hr", "input", "meta", "link", "source"].includes(tagName.toLowerCase());

  if (isSelfClosing) {
    return {
      start,
      end: start + openTag.length,
      openTag,
      tagName,
      indent,
      innerContent: "",
      isSelfClosing: true,
    };
  }

  // Find matching closing tag using depth counting
  // Skip content inside <script>, <style>, and <!-- comments -->
  const closeTag = `</${tagName.toLowerCase()}>`;
  const openPattern = `<${tagName.toLowerCase()}`;
  let depth = 0;
  let pos = start;
  const lower = html.toLowerCase();

  while (pos < html.length) {
    // Skip comments
    if (lower.startsWith("<!--", pos)) {
      const commentEnd = lower.indexOf("-->", pos + 4);
      pos = commentEnd < 0 ? html.length : commentEnd + 3;
      continue;
    }

    // Skip <script>...</script> blocks (not the target element's script children — those are counted)
    if (lower.startsWith("<script", pos) && depth > 0) {
      const scriptEnd = lower.indexOf("</script>", pos);
      pos = scriptEnd < 0 ? html.length : scriptEnd + 9;
      continue;
    }

    // Check for opening tag of same name
    if (lower.startsWith(openPattern, pos) && /[\s>/]/.test(html[pos + openPattern.length] || "")) {
      depth++;
      pos += openPattern.length;
      continue;
    }

    // Check for closing tag of same name
    if (lower.startsWith(closeTag, pos)) {
      depth--;
      if (depth === 0) {
        const end = pos + closeTag.length;
        const innerContent = html.slice(start + openTag.length, pos);
        return { start, end, openTag, tagName, indent, innerContent, isSelfClosing: false };
      }
      pos += closeTag.length;
      continue;
    }

    pos++;
  }

  return null; // closing tag not found
}

/**
 * Split an element at a given time. Modifies the HTML source string.
 *
 * - Shortens the original element's data-duration
 * - Clones the full element block with new id, data-start, data-duration
 * - For video/audio: adjusts data-media-start on the clone
 * - Inserts the clone right after the original
 */
export function splitElement(
  html: string,
  elementId: string,
  currentTime: number,
  element: { start: number; duration: number; playbackStart?: number },
  capturedStyles?: CapturedStyles | null,
): string {
  // Validate with DOMParser first
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const domEl = doc.getElementById(elementId);
  if (!domEl) return html;

  const splitTime = currentTime - element.start;
  const remainingDuration = element.duration - splitTime;
  if (splitTime <= 0 || remainingDuration <= 0) return html;

  // Find the element block in the source string
  const block = findElementBlock(html, elementId);
  if (!block) return html;

  const { start, end, openTag, indent, innerContent, isSelfClosing } = block;
  const newId = `${elementId}-b`;
  const firstDuration = Math.round(splitTime * 100) / 100;
  const secondStart = Math.round(currentTime * 100) / 100;
  const secondDuration = Math.round(remainingDuration * 100) / 100;

  // Build the shortened original
  const shortenedOpenTag = patchAttrInTag(openTag, "data-duration", String(firstDuration));

  // Build the clone's opening tag
  let cloneOpenTag = patchAttrInTag(openTag, "id", newId);
  cloneOpenTag = patchAttrInTag(cloneOpenTag, "data-start", String(secondStart));
  cloneOpenTag = patchAttrInTag(cloneOpenTag, "data-duration", String(secondDuration));

  // Update data-composition-id if present (for sub-composition hosts)
  if (openTag.includes("data-composition-id=")) {
    cloneOpenTag = patchAttrInTag(cloneOpenTag, "data-composition-id", newId);
  }

  // For video/audio: adjust data-media-start on the clone
  if (openTag.includes("data-media-start=")) {
    const existingMediaStart = parseFloat(
      (openTag.match(/data-media-start=["']([^"']*)["']/) || [])[1] || "0",
    );
    cloneOpenTag = patchAttrInTag(
      cloneOpenTag,
      "data-media-start",
      String(Math.round((existingMediaStart + splitTime) * 100) / 100),
    );
  } else if (domEl.tagName === "VIDEO" || domEl.tagName === "AUDIO") {
    // Add data-media-start if not present
    cloneOpenTag = cloneOpenTag.replace(/>$/, ` data-media-start="${firstDuration}">`);
  }

  // Reconstruct
  const closingTag = isSelfClosing ? "" : `</${block.tagName}>`;

  const originalBlock = shortenedOpenTag + innerContent + closingTag;
  let cloneBlock = cloneOpenTag + innerContent + closingTag;

  // Apply captured computed styles to the clone so the second half starts at
  // the exact visual state the element was in at the split point. This
  // correctly overwrites any entrance-animation initial values (e.g. opacity:0)
  // without clobbering unrelated inline styles.
  if (capturedStyles) {
    cloneBlock = applyBakedStyles(cloneBlock, capturedStyles);
  }

  return html.slice(0, start) + originalBlock + "\n" + indent + cloneBlock + html.slice(end);
}

/**
 * Delete an element from the HTML source string.
 * Removes the entire element block including children.
 */
export function deleteElement(html: string, elementId: string): string {
  // Validate with DOMParser first
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  if (!doc.getElementById(elementId)) return html;

  const block = findElementBlock(html, elementId);
  if (!block) return html;

  // Remove the element block + any trailing newline
  let { start, end } = block;

  // Also consume the leading whitespace/indent on the same line
  let lineStart = start;
  while (lineStart > 0 && html[lineStart - 1] !== "\n") lineStart--;
  if (html.slice(lineStart, start).trim() === "") {
    start = lineStart;
  }

  // Consume trailing newline
  if (html[end] === "\n") end++;

  return html.slice(0, start) + html.slice(end);
}
