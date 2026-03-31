import type { Hono } from "hono";
import type { Context } from "hono";
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

// ── Shared helpers ──────────────────────────────────────────────────────────

/**
 * Resolve the project and file path from the request, validating safety.
 * Returns null (and sends an error response) if anything is invalid.
 */
async function resolveProjectFile(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: Context<any>,
  adapter: StudioApiAdapter,
  opts?: { mustExist?: boolean },
) {
  const id = c.req.param("id") as string;
  const project = await adapter.resolveProject(id);
  if (!project) {
    return { error: c.json({ error: "not found" }, 404) } as const;
  }

  const filePath = decodeURIComponent(c.req.path.replace(`/projects/${project.id}/files/`, ""));
  if (filePath.includes("\0")) {
    return { error: c.json({ error: "forbidden" }, 403) } as const;
  }

  const absPath = resolve(project.dir, filePath);
  if (!isSafePath(project.dir, absPath)) {
    return { error: c.json({ error: "forbidden" }, 403) } as const;
  }

  if (opts?.mustExist && !existsSync(absPath)) {
    return { error: c.json({ error: "not found" }, 404) } as const;
  }

  return { project, filePath, absPath } as const;
}

/** Ensure the parent directory of a path exists. */
function ensureDir(filePath: string) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Generate a copy name: foo.html → foo (copy).html → foo (copy 2).html
 */
function generateCopyPath(projectDir: string, originalPath: string): string {
  const ext = originalPath.includes(".") ? "." + originalPath.split(".").pop() : "";
  const base = ext ? originalPath.slice(0, -ext.length) : originalPath;

  // If already a copy, increment the number
  const copyMatch = base.match(/ \(copy(?: (\d+))?\)$/);
  const cleanBase = copyMatch ? base.slice(0, -copyMatch[0].length) : base;
  let num = copyMatch ? (copyMatch[1] ? parseInt(copyMatch[1]) + 1 : 2) : 1;

  let candidate = num === 1 ? `${cleanBase} (copy)${ext}` : `${cleanBase} (copy ${num})${ext}`;
  while (existsSync(resolve(projectDir, candidate))) {
    num++;
    candidate = `${cleanBase} (copy ${num})${ext}`;
  }

  return candidate;
}

// ── Route registration ──────────────────────────────────────────────────────

export function registerFileRoutes(api: Hono, adapter: StudioApiAdapter): void {
  // ── Read ──

  api.get("/projects/:id/files/*", async (c) => {
    const res = await resolveProjectFile(c, adapter, { mustExist: true });
    if ("error" in res) return res.error;

    const content = readFileSync(res.absPath, "utf-8");
    return c.json({ filename: res.filePath, content });
  });

  // ── Write (overwrite) ──

  api.put("/projects/:id/files/*", async (c) => {
    const res = await resolveProjectFile(c, adapter);
    if ("error" in res) return res.error;

    ensureDir(res.absPath);
    const body = await c.req.text();
    writeFileSync(res.absPath, body, "utf-8");

    return c.json({ ok: true });
  });

  // ── Create (fail if exists) ──

  api.post("/projects/:id/files/*", async (c) => {
    const res = await resolveProjectFile(c, adapter);
    if ("error" in res) return res.error;

    if (existsSync(res.absPath)) {
      return c.json({ error: "already exists" }, 409);
    }

    ensureDir(res.absPath);
    const body = await c.req.text().catch(() => "");
    writeFileSync(res.absPath, body, "utf-8");

    return c.json({ ok: true, path: res.filePath }, 201);
  });

  // ── Delete ──

  api.delete("/projects/:id/files/*", async (c) => {
    const res = await resolveProjectFile(c, adapter, { mustExist: true });
    if ("error" in res) return res.error;

    const stat = statSync(res.absPath);
    if (stat.isDirectory()) {
      rmSync(res.absPath, { recursive: true });
    } else {
      unlinkSync(res.absPath);
    }

    return c.json({ ok: true });
  });

  // ── Rename / Move ──

  api.patch("/projects/:id/files/*", async (c) => {
    const res = await resolveProjectFile(c, adapter, { mustExist: true });
    if ("error" in res) return res.error;

    const body = (await c.req.json()) as { newPath?: string };
    if (!body.newPath) {
      return c.json({ error: "newPath required" }, 400);
    }

    const newAbs = resolve(res.project.dir, body.newPath);
    if (!isSafePath(res.project.dir, newAbs)) {
      return c.json({ error: "forbidden" }, 403);
    }
    if (existsSync(newAbs)) {
      return c.json({ error: "already exists" }, 409);
    }

    ensureDir(newAbs);
    renameSync(res.absPath, newAbs);

    return c.json({ ok: true, path: body.newPath });
  });

  // ── Duplicate ──

  api.post("/projects/:id/duplicate-file", async (c) => {
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "not found" }, 404);

    const body = (await c.req.json()) as { path: string };
    if (!body.path) {
      return c.json({ error: "path required" }, 400);
    }

    const srcAbs = resolve(project.dir, body.path);
    if (!isSafePath(project.dir, srcAbs) || !existsSync(srcAbs)) {
      return c.json({ error: "not found" }, 404);
    }

    const copyPath = generateCopyPath(project.dir, body.path);
    const destAbs = resolve(project.dir, copyPath);
    if (!isSafePath(project.dir, destAbs)) {
      return c.json({ error: "forbidden" }, 403);
    }

    ensureDir(destAbs);
    writeFileSync(destAbs, readFileSync(srcAbs));

    return c.json({ ok: true, path: copyPath }, 201);
  });
}
