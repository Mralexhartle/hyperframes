import { execSync } from "node:child_process";
import { existsSync, mkdirSync, createWriteStream } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { get as httpsGet } from "node:https";
import { pipeline } from "node:stream/promises";

const MODELS_DIR = join(homedir(), ".cache", "hyperframes", "whisper", "models");
const DEFAULT_MODEL = "base.en";

export type WhisperSource = "env" | "system" | "brew";

export interface WhisperResult {
  executablePath: string;
  source: WhisperSource;
}

// --- Download helper --------------------------------------------------------

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const follow = (u: string) => {
      httpsGet(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const location = res.headers.location;
          if (location) {
            follow(location);
            return;
          }
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode}`));
          return;
        }
        const file = createWriteStream(dest);
        pipeline(res, file).then(resolve).catch(reject);
      }).on("error", reject);
    };
    follow(url);
  });
}

function getModelUrl(model: string): string {
  return `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${model}.bin`;
}

// --- Find helpers -----------------------------------------------------------

function findFromEnv(): WhisperResult | undefined {
  const envPath = process.env["HYPERFRAMES_WHISPER_PATH"];
  if (envPath && existsSync(envPath)) {
    return { executablePath: envPath, source: "env" };
  }
  return undefined;
}

function whichBinary(name: string): string | undefined {
  try {
    const result = execSync(`which ${name}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    }).trim();
    return result || undefined;
  } catch {
    return undefined;
  }
}

function findFromSystem(): WhisperResult | undefined {
  // whisper-cli is the name from brew install whisper-cpp
  const whisperCli = whichBinary("whisper-cli");
  if (whisperCli) return { executablePath: whisperCli, source: "system" };

  // Older versions or manual builds
  const whisper = whichBinary("whisper");
  if (whisper) return { executablePath: whisper, source: "system" };

  // Also check brew prefix directly on macOS
  if (platform() === "darwin") {
    const brewPath = "/opt/homebrew/bin/whisper-cli";
    if (existsSync(brewPath)) return { executablePath: brewPath, source: "system" };
    const intelBrewPath = "/usr/local/bin/whisper-cli";
    if (existsSync(intelBrewPath)) return { executablePath: intelBrewPath, source: "system" };
  }

  return undefined;
}

function hasBrew(): boolean {
  return whichBinary("brew") !== undefined;
}

// --- Public API -------------------------------------------------------------

export function findWhisper(): WhisperResult | undefined {
  return findFromEnv() ?? findFromSystem();
}

export async function ensureWhisper(options?: {
  onProgress?: (message: string) => void;
}): Promise<WhisperResult> {
  const existing = findWhisper();
  if (existing) return existing;

  // Try to install via brew on macOS
  if (platform() === "darwin" && hasBrew()) {
    options?.onProgress?.("Installing whisper.cpp via Homebrew...");
    try {
      execSync("brew install whisper-cpp", { stdio: "ignore", timeout: 300_000 });
      const installed = findFromSystem();
      if (installed) return { ...installed, source: "brew" };
    } catch {
      // brew install failed
    }
  }

  // On Linux, suggest apt/package manager
  if (platform() === "linux") {
    throw new Error(
      "whisper-cpp not found. Install: sudo apt install whisper.cpp (or build from source)",
    );
  }

  throw new Error(
    platform() === "darwin"
      ? "whisper-cpp not found. Install: brew install whisper-cpp"
      : "whisper-cpp not found. See: https://github.com/ggml-org/whisper.cpp",
  );
}

export async function ensureModel(
  model: string = DEFAULT_MODEL,
  options?: { onProgress?: (message: string) => void },
): Promise<string> {
  const modelPath = join(MODELS_DIR, `ggml-${model}.bin`);
  if (existsSync(modelPath)) return modelPath;

  mkdirSync(MODELS_DIR, { recursive: true });

  options?.onProgress?.(`Downloading model ${model} (~148MB)...`);
  await downloadFile(getModelUrl(model), modelPath);

  if (!existsSync(modelPath)) {
    throw new Error(`Model download failed: ${model}`);
  }

  return modelPath;
}

export function hasFFmpeg(): boolean {
  try {
    execSync("ffmpeg -version", { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export { MODELS_DIR, DEFAULT_MODEL };
