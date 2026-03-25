import { execSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, createWriteStream, chmodSync } from "node:fs";
import { homedir, platform, arch } from "node:os";
import { join } from "node:path";
import { get as httpsGet } from "node:https";
import { pipeline } from "node:stream/promises";

const WHISPER_VERSION = "1.7.3";
const CACHE_DIR = join(homedir(), ".cache", "hyperframes", "whisper");
const BIN_DIR = join(CACHE_DIR, "bin");
const MODELS_DIR = join(CACHE_DIR, "models");
const DEFAULT_MODEL = "base.en";

export type WhisperSource = "env" | "cache" | "system" | "download";

export interface WhisperResult {
  executablePath: string;
  source: WhisperSource;
}

export interface EnsureWhisperOptions {
  onProgress?: (message: string) => void;
}

// --- Download helpers -------------------------------------------------------

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

function getWhisperBinaryUrl(): string | undefined {
  const os = platform();
  const cpuArch = arch();

  // whisper.cpp releases provide pre-built binaries
  const base = `https://github.com/ggerganov/whisper.cpp/releases/download/v${WHISPER_VERSION}`;

  if (os === "darwin" && cpuArch === "arm64") {
    return `${base}/whisper-cli-v${WHISPER_VERSION}-bin-apple-arm64.zip`;
  }
  if (os === "darwin" && cpuArch === "x64") {
    return `${base}/whisper-cli-v${WHISPER_VERSION}-bin-apple-x86_64.zip`;
  }
  if (os === "linux" && cpuArch === "x64") {
    return `${base}/whisper-cli-v${WHISPER_VERSION}-bin-linux-x86_64.zip`;
  }

  return undefined;
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

function findFromCache(): WhisperResult | undefined {
  const binaryName = platform() === "win32" ? "whisper-cli.exe" : "whisper-cli";
  const cached = join(BIN_DIR, binaryName);
  if (existsSync(cached)) {
    return { executablePath: cached, source: "cache" };
  }
  return undefined;
}

function findFromSystem(): WhisperResult | undefined {
  try {
    const result = execSync("which whisper-cli", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    }).trim();
    if (result) return { executablePath: result, source: "system" };
  } catch {
    // not found
  }

  // Also check for whisper (older name)
  try {
    const result = execSync("which whisper", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 5000,
    }).trim();
    if (result) return { executablePath: result, source: "system" };
  } catch {
    // not found
  }

  return undefined;
}

// --- Public API -------------------------------------------------------------

export function findWhisper(): WhisperResult | undefined {
  return findFromEnv() ?? findFromCache() ?? findFromSystem();
}

export async function ensureWhisper(options?: EnsureWhisperOptions): Promise<WhisperResult> {
  const existing = findWhisper();
  if (existing) return existing;

  const url = getWhisperBinaryUrl();
  if (!url) {
    throw new Error(`No pre-built whisper binary for ${platform()} ${arch()}`);
  }

  mkdirSync(BIN_DIR, { recursive: true });

  const zipPath = join(CACHE_DIR, "whisper-cli.zip");
  options?.onProgress?.("Downloading whisper.cpp...");
  await downloadFile(url, zipPath);

  // Extract zip
  options?.onProgress?.("Extracting...");
  execFileSync("unzip", ["-o", "-j", zipPath, "-d", BIN_DIR], { stdio: "ignore" });

  // Make executable
  const binaryName = platform() === "win32" ? "whisper-cli.exe" : "whisper-cli";
  const binaryPath = join(BIN_DIR, binaryName);
  if (existsSync(binaryPath)) {
    chmodSync(binaryPath, 0o755);
  }

  // Clean up zip
  try {
    execSync(`rm ${zipPath}`, { stdio: "ignore" });
  } catch {
    // ignore
  }

  if (!existsSync(binaryPath)) {
    throw new Error("whisper binary not found after extraction");
  }

  return { executablePath: binaryPath, source: "download" };
}

export async function ensureModel(
  model: string = DEFAULT_MODEL,
  options?: EnsureWhisperOptions,
): Promise<string> {
  const modelPath = join(MODELS_DIR, `ggml-${model}.bin`);
  if (existsSync(modelPath)) return modelPath;

  mkdirSync(MODELS_DIR, { recursive: true });

  options?.onProgress?.(`Downloading model ${model}...`);
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

export { CACHE_DIR, MODELS_DIR, BIN_DIR, DEFAULT_MODEL, WHISPER_VERSION };
