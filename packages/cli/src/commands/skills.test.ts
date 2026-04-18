/**
 * Tests for `hyperframes skills` — verifies we set
 * `GIT_CLONE_PROTECTION_ACTIVE=0` on the child env so the upstream
 * `skills` CLI's `git clone` call doesn't trip Git 2.45's clone-hook
 * protection (GH #316).
 *
 * ESM restricts `vi.spyOn` on live module exports, so we mock the
 * `node:child_process` module at the loader level and inspect what
 * our command passed through.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

type SpawnCall = {
  command: string;
  args: ReadonlyArray<string>;
  env: NodeJS.ProcessEnv | undefined;
};

const state: { calls: SpawnCall[] } = { calls: [] };

vi.mock("node:child_process", () => ({
  // `hasNpx()` in skills.ts just needs this to not throw.
  execFileSync: vi.fn(() => Buffer.from("11.0.0")),
  spawn: vi.fn(
    (command: string, args: ReadonlyArray<string>, opts?: { env?: NodeJS.ProcessEnv }) => {
      state.calls.push({ command, args, env: opts?.env });
      const fake = new EventEmitter();
      setImmediate(() => fake.emit("close", 0, null));
      return fake;
    },
  ),
}));

describe("hyperframes skills — git clone hook workaround (GH #316)", () => {
  beforeEach(() => {
    state.calls = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sets GIT_CLONE_PROTECTION_ACTIVE=0 on the spawned skills CLI child", async () => {
    const { default: skillsCmd } = await import("./skills.js");
    await skillsCmd.run?.({ args: {}, rawArgs: [], cmd: skillsCmd } as never);

    expect(state.calls.length).toBeGreaterThan(0);
    for (const call of state.calls) {
      expect(call.command).toBe("npx");
      expect(call.args).toContain("skills");
      expect(call.args).toContain("add");
      // The critical invariant: the child env has the flag set.
      expect(call.env?.GIT_CLONE_PROTECTION_ACTIVE).toBe("0");
    }
  });

  it("still propagates the rest of process.env to the child (not a wiped env)", async () => {
    process.env.TEST_SENTINEL_HF_316 = "sentinel-value";
    try {
      const { default: skillsCmd } = await import("./skills.js");
      await skillsCmd.run?.({ args: {}, rawArgs: [], cmd: skillsCmd } as never);
      expect(state.calls.length).toBeGreaterThan(0);
      expect(state.calls[0].env?.TEST_SENTINEL_HF_316).toBe("sentinel-value");
      expect(state.calls[0].env?.GIT_CLONE_PROTECTION_ACTIVE).toBe("0");
    } finally {
      delete process.env.TEST_SENTINEL_HF_316;
    }
  });
});
