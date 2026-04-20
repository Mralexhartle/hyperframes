import { resolve } from "path";
import { describe, expect, it } from "vitest";
import { extractVideoMetadata } from "./ffprobe.js";

describe("extractVideoMetadata", () => {
  it("reads HDR PNG cICP metadata when ffprobe color fields are absent", async () => {
    const fixturePath = resolve(
      __dirname,
      "../../../producer/tests/hdr-image-only/src/hdr-photo.png",
    );

    const metadata = await extractVideoMetadata(fixturePath);

    expect(metadata.colorSpace).toEqual({
      colorPrimaries: "bt2020",
      colorTransfer: "smpte2084",
      colorSpace: "gbr",
    });
  });
});
