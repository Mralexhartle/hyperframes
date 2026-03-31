import type { Hono } from "hono";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  rmSync,
  statSync,
  renameSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import type { StudioApiAdapter } from "../types.js";
import { isSafePath } from "../helpers/safePath.js";

function extractFilePath(reqPath: string, projectId: string): string | null {
  const filePath = decodeURIComponent(reqPath.replace(`/projects/${projectId}/files/`, ""));
  if (filePath.includes("\0")) return null;
  return filePath;
}

export function registerFileRoutes(api: Hono, adapter: StudioApiAdapter): void {
  // Read file content
  api.get("/projects/:id/files/*", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const filePath = extractFilePath(c.req.path, project.id);
    if (!filePath) return c.json({ error: "forbidden" }, 403);
    const file = resolve(project.dir, filePath);
    if (!isSafePath(project.dir, file) || !existsSync(file)) {
      return c.text("not found", 404);
    }
    const content = readFileSync(file, "utf-8");
    return c.json({ filename: filePath, content });
  });

  // Write file content
  api.put("/projects/:id/files/*", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const filePath = extractFilePath(c.req.path, project.id);
    if (!filePath) return c.json({ error: "forbidden" }, 403);
    const file = resolve(project.dir, filePath);
    if (!isSafePath(project.dir, file)) {
      return c.json({ error: "forbidden" }, 403);
    }
    const dir = dirname(file);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const body = await c.req.text();
    writeFileSync(file, body, "utf-8");
    return c.json({ ok: true });
  });

  // Create a new file (empty or with content)
  api.post("/projects/:id/files/*", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const filePath = extractFilePath(c.req.path, project.id);
    if (!filePath) return c.json({ error: "forbidden" }, 403);
    const file = resolve(project.dir, filePath);
    if (!isSafePath(project.dir, file)) return c.json({ error: "forbidden" }, 403);
    if (existsSync(file)) return c.json({ error: "already exists" }, 409);
    const dir = dirname(file);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const body = await c.req.text().catch(() => "");
    writeFileSync(file, body, "utf-8");
    return c.json({ ok: true, path: filePath }, 201);
  });

  // Delete a file or directory
  api.delete("/projects/:id/files/*", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const filePath = extractFilePath(c.req.path, project.id);
    if (!filePath) return c.json({ error: "forbidden" }, 403);
    const file = resolve(project.dir, filePath);
    if (!isSafePath(project.dir, file) || !existsSync(file)) {
      return c.json({ error: "not found" }, 404);
    }
    const stat = statSync(file);
    if (stat.isDirectory()) {
      rmSync(file, { recursive: true });
    } else {
      unlinkSync(file);
    }
    return c.json({ ok: true });
  });

  // Rename / move a file or directory
  api.patch("/projects/:id/files/*", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const filePath = extractFilePath(c.req.path, project.id);
    if (!filePath) return c.json({ error: "forbidden" }, 403);
    const file = resolve(project.dir, filePath);
    if (!isSafePath(project.dir, file) || !existsSync(file)) {
      return c.json({ error: "not found" }, 404);
    }
    const body = (await c.req.json()) as { newPath?: string };
    if (!body.newPath) return c.json({ error: "newPath required" }, 400);
    const newFile = resolve(project.dir, body.newPath);
    if (!isSafePath(project.dir, newFile)) return c.json({ error: "forbidden" }, 403);
    if (existsSync(newFile)) return c.json({ error: "already exists" }, 409);
    const newDir = dirname(newFile);
    if (!existsSync(newDir)) mkdirSync(newDir, { recursive: true });
    renameSync(file, newFile);
    return c.json({ ok: true, path: body.newPath });
  });

  // Duplicate a file
  api.post("/projects/:id/duplicate-file", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);
    const body = (await c.req.json()) as { path: string };
    if (!body.path) return c.json({ error: "path required" }, 400);
    const file = resolve(project.dir, body.path);
    if (!isSafePath(project.dir, file) || !existsSync(file)) {
      return c.json({ error: "not found" }, 404);
    }
    // Generate copy name: foo.html -> foo (copy).html, foo (copy).html -> foo (copy 2).html
    const ext = body.path.includes(".") ? "." + body.path.split(".").pop() : "";
    const base = ext ? body.path.slice(0, -ext.length) : body.path;
    let copyNum = 1;
    const copyMatch = base.match(/ \(copy(?: (\d+))?\)$/);
    let copyPath: string;
    if (copyMatch) {
      const baseWithoutCopy = base.slice(0, -copyMatch[0].length);
      copyNum = copyMatch[1] ? parseInt(copyMatch[1]) + 1 : 2;
      copyPath = `${baseWithoutCopy} (copy ${copyNum})${ext}`;
    } else {
      copyPath = `${base} (copy)${ext}`;
    }
    while (existsSync(resolve(project.dir, copyPath))) {
      copyNum++;
      const cleanBase = copyMatch ? base.slice(0, -copyMatch[0].length) : base;
      copyPath = `${cleanBase} (copy ${copyNum})${ext}`;
    }
    const dest = resolve(project.dir, copyPath);
    if (!isSafePath(project.dir, dest)) return c.json({ error: "forbidden" }, 403);
    const content = readFileSync(file);
    const destDir = dirname(dest);
    if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
    writeFileSync(dest, content);
    return c.json({ ok: true, path: copyPath }, 201);
  });
}
