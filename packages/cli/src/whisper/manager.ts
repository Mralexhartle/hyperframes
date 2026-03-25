import { execSync } from "node:child_process";
import { existsSync, mkdirSync, createWriteStream } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { get as httpsGet } from "node:https";
import { pipeline } from "node:stream/promises";

const MODELS_DIR = join(homedir(), ".cache", "hyperframes", "whisper", "models");
const DEFAULT_MODEL = "base.en";

export type WhisperSource = "env" | "system";

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

function findFromEnv(): WhisperResult | undefined {
  const envPath = process.env["HYPERFRAMES_WHISPER_PATH"];
  if (envPath && existsSync(envPath)) {
    return { executablePath: envPath, source: "env" };
  }
  return undefined;
}

function findFromSystem(): WhisperResult | undefined {
  for (const name of ["whisper-cli", "whisper"]) {
    const path = whichBinary(name);
    if (path) return { executablePath: path, source: "system" };
  }

  // Check brew paths directly on macOS
  if (platform() === "darwin") {
    for (const p of ["/opt/homebrew/bin/whisper-cli", "/usr/local/bin/whisper-cli"]) {
      if (existsSync(p)) return { executablePath: p, source: "system" };
    }
  }

  return undefined;
}

// --- Public API -------------------------------------------------------------

export function findWhisper(): WhisperResult | undefined {
  return findFromEnv() ?? findFromSystem();
}

export function getInstallInstructions(): string {
  if (platform() === "darwin") {
    return "brew install whisper-cpp";
  }
  if (platform() === "linux") {
    return "See https://github.com/ggml-org/whisper.cpp#building";
  }
  return "See https://github.com/ggml-org/whisper.cpp";
}

export async function ensureWhisper(): Promise<WhisperResult> {
  const existing = findWhisper();
  if (existing) return existing;

  throw new Error(`whisper-cpp not found. Install: ${getInstallInstructions()}`);
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
