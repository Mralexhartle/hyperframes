#!/usr/bin/env tsx

import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "..");
const PACKAGES_DIR = join(ROOT, "packages");
const DEP_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

type DepField = (typeof DEP_FIELDS)[number];
type PackageJson = {
  name: string;
  version: string;
  [key: string]: unknown;
} & Partial<Record<DepField, Record<string, string>>>;

function listPackageJsonPaths() {
  return readdirSync(PACKAGES_DIR).map((dir) => join(PACKAGES_DIR, dir, "package.json"));
}

function loadPackageJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
}

function resolveWorkspaceSpec(spec: string, version: string) {
  const workspaceSpec = spec.slice("workspace:".length);

  if (workspaceSpec === "" || workspaceSpec === "*") return version;
  if (workspaceSpec === "^") return `^${version}`;
  if (workspaceSpec === "~") return `~${version}`;
  if (workspaceSpec.startsWith("^")) return `^${version}`;
  if (workspaceSpec.startsWith("~")) return `~${version}`;

  return workspaceSpec;
}

function main() {
  const packageJsonPaths = listPackageJsonPaths();
  const packageVersions = new Map(
    packageJsonPaths.map((path) => {
      const pkg = loadPackageJson(path);
      return [pkg.name, pkg.version] as const;
    }),
  );

  let rewrites = 0;

  for (const path of packageJsonPaths) {
    const pkg = loadPackageJson(path);
    let changed = false;

    for (const field of DEP_FIELDS) {
      const deps = pkg[field];
      if (!deps) continue;

      for (const [depName, spec] of Object.entries(deps)) {
        if (!spec.startsWith("workspace:")) continue;

        const depVersion = packageVersions.get(depName);
        if (!depVersion) {
          throw new Error(`Cannot resolve workspace dependency ${depName} in ${path}`);
        }

        const resolvedSpec = resolveWorkspaceSpec(spec, depVersion);
        if (resolvedSpec === spec) continue;

        deps[depName] = resolvedSpec;
        rewrites += 1;
        changed = true;
        console.log(`${pkg.name} ${field} ${depName}: ${spec} -> ${resolvedSpec}`);
      }
    }

    if (changed) {
      writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
    }
  }

  console.log(`Rewrote ${rewrites} workspace dependency reference(s) for publish.`);
}

main();
