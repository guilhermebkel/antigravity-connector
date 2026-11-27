import type { MediaDescriptor, MediaKind } from "@antigravity-connector/core/Protocols/MediaProtocol.ts";
import { ImageInputUtil } from "@antigravity-connector/core/Utils/ImageInputUtil.ts";

type SignaturePart = {
  offset: number;
  hex: string;
};

type SignatureRule = {
  parts: readonly SignaturePart[];
  descriptor: MediaDescriptor;
};

type MediaFileKind = Exclude<MediaKind, "image">;

const BYTES_PER_MIB = 1048576;
const HEX_CHARS_PER_BYTE = 2;
const AUDIO_MAX_MIB = 20;
const VIDEO_MAX_MIB = 30;
const FTYP_PART: SignaturePart = { offset: 4, hex: "66747970" };
const RIFF_PART: SignaturePart = { offset: 0, hex: "52494646" };
const EBML_PART: SignaturePart = { offset: 0, hex: "1a45dfa3" };

const MP3_DESCRIPTOR: MediaDescriptor = { mime: "audio/mpeg", extension: "mp3" };
const AAC_DESCRIPTOR: MediaDescriptor = { mime: "audio/aac", extension: "aac" };
const M4A_DESCRIPTOR: MediaDescriptor = { mime: "audio/mp4", extension: "m4a" };

const buildStartRule = (hex: string, descriptor: MediaDescriptor): SignatureRule => ({
  parts: [{ offset: 0, hex }],
  descriptor,
});

const buildBrandRule = (brandHex: string, descriptor: MediaDescriptor): SignatureRule => ({
  parts: [FTYP_PART, { offset: 8, hex: brandHex }],
  descriptor,
});

const KIND_TO_RULES: Readonly<Record<MediaFileKind, readonly SignatureRule[]>> = {
  audio: [
    buildStartRule("494433", MP3_DESCRIPTOR),
    buildStartRule("fffb", MP3_DESCRIPTOR),
    buildStartRule("fff3", MP3_DESCRIPTOR),
    buildStartRule("fff2", MP3_DESCRIPTOR),
    buildStartRule("fff1", AAC_DESCRIPTOR),
    buildStartRule("fff9", AAC_DESCRIPTOR),
    { parts: [RIFF_PART, { offset: 8, hex: "57415645" }], descriptor: { mime: "audio/wav", extension: "wav" } },
    buildStartRule("4f676753", { mime: "audio/ogg", extension: "ogg" }),
    buildStartRule("664c6143", { mime: "audio/flac", extension: "flac" }),
    { parts: [FTYP_PART], descriptor: M4A_DESCRIPTOR },
    { parts: [EBML_PART], descriptor: { mime: "audio/webm", extension: "webm" } },
  ],
  video: [
    buildBrandRule("71742020", { mime: "video/quicktime", extension: "mov" }),
    { parts: [FTYP_PART], descriptor: { mime: "video/mp4", extension: "mp4" } },
    { parts: [EBML_PART], descriptor: { mime: "video/webm", extension: "webm" } },
    { parts: [RIFF_PART, { offset: 8, hex: "41564920" }], descriptor: { mime: "video/x-msvideo", extension: "avi" } },
  ],
};

export class MediaInputUtil {
  static readonly KIND_TO_MAX_BYTES: Readonly<Record<MediaKind, number>> = {
    image: ImageInputUtil.MAX_IMAGE_BYTES,
    audio: AUDIO_MAX_MIB * BYTES_PER_MIB,
    video: VIDEO_MAX_MIB * BYTES_PER_MIB,
  };

  static readonly MAX_BYTES = Math.max(...Object.values(MediaInputUtil.KIND_TO_MAX_BYTES));

  static readonly KIND_TO_ACCEPTED_TEXT: Readonly<Record<MediaKind, string>> = {
    image: "PNG, JPEG or WebP picture",
    audio: "MP3, WAV, M4A, AAC, OGG, FLAC or WebM audio file",
    video: "MP4, MOV, WebM or AVI video file",
  };

  static formatLimit(kind: MediaKind): string {
    return `${MediaInputUtil.KIND_TO_MAX_BYTES[kind] / BYTES_PER_MIB} MiB`;
  }

  static detect(bytes: Uint8Array, kind: MediaKind): MediaDescriptor | undefined {
    if (kind === "image") {
      return MediaInputUtil.detectImage(bytes);
    }
    const buffer = Buffer.from(bytes);
    return KIND_TO_RULES[kind].find((rule) => MediaInputUtil.isRuleMatched(buffer, rule))?.descriptor;
  }

  static detectImage(bytes: Uint8Array): MediaDescriptor | undefined {
    const mime = ImageInputUtil.detectMime(bytes);
    return mime === undefined ? undefined : { mime, extension: ImageInputUtil.MIME_TO_EXTENSION[mime] };
  }

  static isRuleMatched(buffer: Buffer, rule: SignatureRule): boolean {
    return rule.parts.every((part) => {
      const length = part.hex.length / HEX_CHARS_PER_BYTE;
      return buffer.subarray(part.offset, part.offset + length).toString("hex") === part.hex;
    });
  }
}
