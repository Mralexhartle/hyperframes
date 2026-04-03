import { describe, it, expect } from "vitest";
import {
  interpolateProps,
  interpolateScriptProps,
  interpolateCssProps,
  parseVariableValues,
} from "./interpolateProps";

describe("parseVariableValues", () => {
  it("parses valid JSON object", () => {
    expect(parseVariableValues('{"title":"Hello","price":19}')).toEqual({
      title: "Hello",
      price: 19,
    });
  });

  it("returns null for null/undefined/empty", () => {
    expect(parseVariableValues(null)).toBeNull();
    expect(parseVariableValues(undefined)).toBeNull();
    expect(parseVariableValues("")).toBeNull();
  });

  it("returns null for non-object JSON", () => {
    expect(parseVariableValues('"just a string"')).toBeNull();
    expect(parseVariableValues("[1,2,3]")).toBeNull();
    expect(parseVariableValues("42")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseVariableValues("{broken}")).toBeNull();
  });

  it("handles boolean values", () => {
    expect(parseVariableValues('{"featured":true}')).toEqual({ featured: true });
  });
});

describe("interpolateProps", () => {
  it("replaces {{key}} placeholders with values", () => {
    const result = interpolateProps('<div class="card"><h2>{{title}}</h2><p>{{price}}</p></div>', {
      title: "Pro Plan",
      price: "$19/mo",
    });
    expect(result).toBe('<div class="card"><h2>Pro Plan</h2><p>$19/mo</p></div>');
  });

  it("handles numeric values", () => {
    const result = interpolateProps("<span>{{count}} items</span>", { count: 42 });
    expect(result).toBe("<span>42 items</span>");
  });

  it("handles boolean values", () => {
    const result = interpolateProps("<span>Featured: {{featured}}</span>", { featured: true });
    expect(result).toBe("<span>Featured: true</span>");
  });

  it("preserves unmatched placeholders", () => {
    const result = interpolateProps("<span>{{title}} and {{unknown}}</span>", { title: "Hello" });
    expect(result).toBe("<span>Hello and {{unknown}}</span>");
  });

  it("handles whitespace in placeholder keys", () => {
    const result = interpolateProps("<span>{{ title }}</span>", { title: "Hello" });
    expect(result).toBe("<span>Hello</span>");
  });

  it("HTML-escapes values to prevent XSS", () => {
    const result = interpolateProps("<span>{{name}}</span>", {
      name: '<script>alert("xss")</script>',
    });
    expect(result).toBe("<span>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</span>");
  });

  it("escapes ampersands and quotes", () => {
    const result = interpolateProps('<div title="{{label}}">{{text}}</div>', {
      label: 'A & B "quoted"',
      text: "Tom & Jerry",
    });
    expect(result).toContain("A &amp; B &quot;quoted&quot;");
    expect(result).toContain("Tom &amp; Jerry");
  });

  it("returns original html when values is empty", () => {
    const html = "<div>{{title}}</div>";
    expect(interpolateProps(html, {})).toBe(html);
  });

  it("returns original html when html is empty", () => {
    expect(interpolateProps("", { title: "Hello" })).toBe("");
  });

  it("handles multiple occurrences of the same key", () => {
    const result = interpolateProps("{{name}} said {{name}}", { name: "Alice" });
    expect(result).toBe("Alice said Alice");
  });

  it("handles dotted keys", () => {
    const result = interpolateProps("{{card.title}}", { "card.title": "Premium" });
    expect(result).toBe("Premium");
  });

  it("uses default when no value provided", () => {
    const result = interpolateProps("<h2>{{title:Hello World}}</h2>");
    expect(result).toBe("<h2>Hello World</h2>");
  });

  it("uses default when values object is empty", () => {
    const result = interpolateProps("<h2>{{title:Fallback}}</h2>", {});
    expect(result).toBe("<h2>Fallback</h2>");
  });

  it("overrides default with provided value", () => {
    const result = interpolateProps("<h2>{{title:Fallback}}</h2>", { title: "Override" });
    expect(result).toBe("<h2>Override</h2>");
  });

  it("handles default with special characters", () => {
    const result = interpolateProps("<p>{{color:#ff0000}}</p>");
    expect(result).toBe("<p>#ff0000</p>");
  });

  it("handles empty default", () => {
    const result = interpolateProps("<p>{{title:}}</p>");
    expect(result).toBe("<p></p>");
  });

  it("handles default with spaces", () => {
    const result = interpolateProps("<p>{{label:Hello World}}</p>");
    expect(result).toBe("<p>Hello World</p>");
  });

  it("HTML-escapes defaults too", () => {
    const result = interpolateProps("<p>{{val:<b>bold</b>}}</p>");
    expect(result).toBe("<p>&lt;b&gt;bold&lt;/b&gt;</p>");
  });

  it("mixes defaulted and non-defaulted placeholders", () => {
    const result = interpolateProps("{{title:Default}} by {{author}}", { author: "Alice" });
    expect(result).toBe("Default by Alice");
  });

  it("resolves all defaults when called with no values", () => {
    const result = interpolateProps('<div style="color:{{color:#333}}">{{text:Sample}}</div>');
    expect(result).toBe('<div style="color:#333">Sample</div>');
  });
});

describe("interpolateScriptProps", () => {
  it("replaces placeholders without HTML escaping", () => {
    const result = interpolateScriptProps('const title = "{{title}}"; const dur = {{duration}};', {
      title: "My Video",
      duration: 10,
    });
    expect(result).toBe('const title = "My Video"; const dur = 10;');
  });

  it("preserves unmatched placeholders", () => {
    const result = interpolateScriptProps("const x = {{unknown}};", { title: "Hello" });
    expect(result).toBe("const x = {{unknown}};");
  });

  it("does not HTML-escape ampersands in scripts", () => {
    const result = interpolateScriptProps('const s = "{{val}}";', { val: "A & B" });
    expect(result).toBe('const s = "A & B";');
  });

  it("JS-escapes quotes to prevent injection", () => {
    const result = interpolateScriptProps('const s = "{{val}}";', {
      val: 'hello"; alert(1); //',
    });
    expect(result).toBe('const s = "hello\\"; alert(1); //";');
  });

  it("JS-escapes backslashes and backticks", () => {
    const result = interpolateScriptProps("const s = `{{val}}`;", { val: "a\\b`c" });
    expect(result).toBe("const s = `a\\\\b\\`c`;");
  });

  it("JS-escapes </script> to prevent tag breakout", () => {
    const result = interpolateScriptProps('const s = "{{val}}";', {
      val: "</script><script>alert(1)",
    });
    expect(result).not.toContain("</script>");
    expect(result).toContain("<\\/script>");
  });

  it("does not escape numbers and booleans", () => {
    const result = interpolateScriptProps("const n = {{num}}; const b = {{bool}};", {
      num: 42,
      bool: true,
    });
    expect(result).toBe("const n = 42; const b = true;");
  });

  it("preserves $ in regular string contexts", () => {
    const result = interpolateScriptProps('const p = "{{price}}";', { price: "$19/mo" });
    expect(result).toBe('const p = "$19/mo";');
  });

  it("escapes ${ in template literal contexts", () => {
    const result = interpolateScriptProps("const s = `{{val}}`;", { val: "${dangerous}" });
    expect(result).toBe("const s = `\\${dangerous}`;");
  });

  it("uses default when no value provided", () => {
    const result = interpolateScriptProps("const dur = {{duration:10}};");
    expect(result).toBe("const dur = 10;");
  });

  it("overrides default with provided value", () => {
    const result = interpolateScriptProps("const dur = {{duration:10}};", { duration: 5 });
    expect(result).toBe("const dur = 5;");
  });

  it("JS-escapes defaults containing special characters", () => {
    const result = interpolateScriptProps('const s = "{{label:hello\\"world}}";');
    expect(result).toBe('const s = "hello\\\\\\"world";');
  });
});

describe("interpolateCssProps", () => {
  it("replaces placeholders with raw values", () => {
    const result = interpolateCssProps(".card { background: {{bgColor}}; }", {
      bgColor: "#ec4899",
    });
    expect(result).toBe(".card { background: #ec4899; }");
  });

  it("does not HTML-escape values in CSS", () => {
    const result = interpolateCssProps(".card { content: '{{text}}'; }", {
      text: "A & B",
    });
    expect(result).toBe(".card { content: 'A & B'; }");
    expect(result).not.toContain("&amp;");
  });

  it("preserves unmatched placeholders", () => {
    const result = interpolateCssProps(".card { color: {{unknown}}; }", { bg: "red" });
    expect(result).toBe(".card { color: {{unknown}}; }");
  });

  it("returns original content when values is empty and no defaults", () => {
    const css = ".card { color: {{color}}; }";
    expect(interpolateCssProps(css, {})).toBe(css);
  });

  it("uses default when no value provided", () => {
    const result = interpolateCssProps(".card { background: {{bgColor:#6366f1}}; }");
    expect(result).toBe(".card { background: #6366f1; }");
  });

  it("overrides default with provided value", () => {
    const result = interpolateCssProps(".card { background: {{bgColor:#6366f1}}; }", {
      bgColor: "#ec4899",
    });
    expect(result).toBe(".card { background: #ec4899; }");
  });
});
