/**
 * Encoding Worker
 *
 * Receives ImageBitmap frames from the main thread, encodes via
 * WebCodecs VideoEncoder, and muxes into MP4/WebM via MediaBunny.
 */

import {
  Output,
  Mp4OutputFormat,
  WebMOutputFormat,
  BufferTarget,
  EncodedVideoPacketSource,
  EncodedPacket,
  AudioSampleSource,
  AudioSample,
} from "mediabunny";
import type { WorkerInMessage, WorkerOutMessage } from "./types.js";

let output: Output | null = null;
let videoSource: EncodedVideoPacketSource | null = null;
let audioSource: AudioSampleSource | null = null;
let encoder: VideoEncoder | null = null;
let target: BufferTarget | null = null;
let isFirstPacket = true;
let framesEncoded = 0;
let outputFormat: "mp4" | "webm" = "mp4";

function post(msg: WorkerOutMessage, transfer?: Transferable[]): void {
  self.postMessage(msg, { transfer: transfer ?? [] });
}

async function handleInit(config: WorkerInMessage & { type: "init" }): Promise<void> {
  const { width, height, fps, codec, bitrate, format } = config.config;

  outputFormat = format;
  target = new BufferTarget();
  const formatObj = format === "webm" ? new WebMOutputFormat() : new Mp4OutputFormat();
  output = new Output({ format: formatObj, target });

  // Map WebCodecs codec string to MediaBunny VideoCodec identifier
  const mbVideoCodec = codec.startsWith("avc") ? "avc" : "vp9";
  videoSource = new EncodedVideoPacketSource(mbVideoCodec);
  output.addVideoTrack(videoSource, { frameRate: fps });

  audioSource = new AudioSampleSource({ codec: "aac", bitrate: 128_000 });
  output.addAudioTrack(audioSource);

  const encoderConfig: VideoEncoderConfig = {
    codec,
    width,
    height,
    bitrate,
    hardwareAcceleration: "prefer-hardware",
  };

  encoder = new VideoEncoder({
    output: async (chunk, meta) => {
      const packet = EncodedPacket.fromEncodedChunk(chunk);
      if (isFirstPacket) {
        await videoSource!.add(packet, meta);
        isFirstPacket = false;
      } else {
        await videoSource!.add(packet);
      }
      framesEncoded++;
      post({ type: "frame-encoded", index: framesEncoded - 1 });
    },
    error: (e) => {
      post({ type: "error", message: e.message });
    },
  });

  encoder.configure(encoderConfig);
  await output.start();

  post({ type: "ready" });
}

async function handleFrame(msg: WorkerInMessage & { type: "frame" }): Promise<void> {
  if (!encoder) {
    post({ type: "error", message: "Encoder not initialized" });
    return;
  }

  const frame = new VideoFrame(msg.bitmap, {
    timestamp: msg.timestamp,
  });

  const isKeyFrame = msg.index % 150 === 0;
  encoder.encode(frame, { keyFrame: isKeyFrame });
  frame.close();
  msg.bitmap.close();
}

async function handleSetAudio(msg: WorkerInMessage & { type: "set-audio" }): Promise<void> {
  if (!audioSource) return;

  const planar = concatPlanarChannels(msg.channelData);
  const sample = new AudioSample({
    data: planar,
    format: "f32-planar",
    numberOfChannels: msg.channelData.length,
    sampleRate: msg.sampleRate,
    timestamp: 0,
  });
  await audioSource.add(sample);
  sample[Symbol.dispose]();
}

async function handleFinalize(): Promise<void> {
  if (!encoder || !output || !target || !videoSource || !audioSource) {
    post({ type: "error", message: "Cannot finalize — not initialized" });
    return;
  }

  await encoder.flush();
  encoder.close();
  videoSource.close();
  audioSource.close();
  await output.finalize();

  const buffer = target.buffer;
  if (!buffer) {
    post({ type: "error", message: "No output buffer after finalize" });
    return;
  }

  const mimeType = outputFormat === "webm" ? "video/webm" : "video/mp4";
  const blob = new Blob([buffer], { type: mimeType });
  post({ type: "done", blob });
}

function concatPlanarChannels(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0]!;
  const totalLength = channels.reduce((sum, ch) => sum + ch.length, 0);
  const result = new Float32Array(totalLength);
  let offset = 0;
  for (const ch of channels) {
    result.set(ch, offset);
    offset += ch.length;
  }
  return result;
}

self.onmessage = async (e: MessageEvent<WorkerInMessage>) => {
  try {
    switch (e.data.type) {
      case "init":
        await handleInit(e.data);
        break;
      case "frame":
        await handleFrame(e.data);
        break;
      case "set-audio":
        await handleSetAudio(e.data);
        break;
      case "finalize":
        await handleFinalize();
        break;
    }
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
