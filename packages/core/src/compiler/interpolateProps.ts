/**
 * Interpolate `{{key}}` and `{{key:default}}` mustache-style placeholders
 * in HTML content using values from a `data-props` JSON attribute.
 *
 * Supports:
 * - `{{key}}` — replaced with the value, or left as-is if no value provided
 * - `{{key:default}}` — replaced with the value, or the default if no value provided
 * - Nested keys are NOT supported (flat key-value only)
 *
 * Values are coerced to strings. Numbers and booleans are stringified.
 */

/**
 * Matches `{{key}}` and `{{key:default value}}`.
 * Group 1: key (trimmed)
 * Group 2: default value (everything after the first colon, if present)
 */
const MUSTACHE_RE = /\{\{(\s*[\w.-]+\s*)(?::([^}]*))?\}\}/g;

/**
 * Parse `data-props` JSON from an element attribute.
 * Returns null if the attribute is missing or invalid JSON.
 */
export function parseVariableValues(
  raw: string | null | undefined,
): Record<string, string | number | boolean> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, string | number | boolean>;
  } catch {
    return null;
  }
}

/**
 * Escape a string for safe insertion into HTML content.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escape a string for safe insertion into a JavaScript string context.
 * Handles quote characters, backslashes, template literal delimiters,
 * and `</script>` sequences that would prematurely close a script tag.
 */
function escapeJsString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${")
    .replace(/<\/(script)/gi, "<\\/$1");
}

/**
 * Interpolate `{{key}}` and `{{key:default}}` placeholders in an HTML string.
 * Values are HTML-escaped to prevent XSS. When no value is provided and a
 * default is specified, the default is used. Unmatched placeholders without
 * defaults are preserved as-is.
 */
export function interpolateProps(
  html: string,
  values?: Record<string, string | number | boolean> | null,
): string {
  if (!html) return html;
  const vals = values ?? {};
  return html.replace(MUSTACHE_RE, (_match, rawKey: string, rawDefault: string | undefined) => {
    const key = rawKey.trim();
    if (key in vals) {
      return escapeHtml(String(vals[key]));
    }
    if (rawDefault !== undefined) {
      return escapeHtml(rawDefault);
    }
    return _match;
  });
}

/**
 * Interpolate props in script content. String values are JS-escaped to
 * prevent breaking out of string delimiters. Numbers and booleans are
 * inserted as-is (safe for direct use as JS literals).
 * Defaults are used when no value is provided.
 */
export function interpolateScriptProps(
  scriptContent: string,
  values?: Record<string, string | number | boolean> | null,
): string {
  if (!scriptContent) return scriptContent;
  const vals = values ?? {};
  return scriptContent.replace(
    MUSTACHE_RE,
    (_match, rawKey: string, rawDefault: string | undefined) => {
      const key = rawKey.trim();
      if (key in vals) {
        const val = vals[key];
        if (typeof val === "string") return escapeJsString(val);
        return String(val);
      }
      if (rawDefault !== undefined) {
        return escapeJsString(rawDefault);
      }
      return _match;
    },
  );
}

/**
 * Interpolate props in CSS content. Values are inserted raw — HTML entity
 * escaping (`&amp;`, `&lt;`) is invalid in CSS and would produce broken rules.
 * Defaults are used when no value is provided.
 */
export function interpolateCssProps(
  cssContent: string,
  values?: Record<string, string | number | boolean> | null,
): string {
  if (!cssContent) return cssContent;
  const vals = values ?? {};
  return cssContent.replace(
    MUSTACHE_RE,
    (_match, rawKey: string, rawDefault: string | undefined) => {
      const key = rawKey.trim();
      if (key in vals) return String(vals[key]);
      if (rawDefault !== undefined) return rawDefault;
      return _match;
    },
  );
}
