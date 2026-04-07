import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { ExtractedLinkContent } from "../content/index.js";
import { extractYouTubeVideoId, isYouTubeUrl } from "../content/index.js";
import { buildDirectSourceId, buildYoutubeSourceId } from "./source-id.js";
import type { SlideSource } from "./types.js";

const DIRECT_VIDEO_EXTENSIONS = new Set([
  "mp4",
  "mov",
  "m4v",
  "mkv",
  "webm",
  "mpeg",
  "mpg",
  "avi",
  "wmv",
  "flv",
]);

function normalizePathForExtension(value: string): string {
  try {
    return new URL(value).pathname;
  } catch {
    return value.split(/[?#]/, 1)[0];
  }
}

export function isDirectVideoInput(value: string): boolean {
  const ext = path
    .extname(normalizePathForExtension(value))
    .trim()
    .replace(/^\./, "")
    .toLowerCase();
  return DIRECT_VIDEO_EXTENSIONS.has(ext);
}

function resolveLocalDirectVideoSource(raw: string): SlideSource | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.startsWith("file://")) {
      const parsed = new URL(trimmed);
      parsed.search = "";
      parsed.hash = "";
      const filePath = fileURLToPath(parsed);
      const stat = statSync(filePath);
      if (!stat.isFile()) return null;
      const normalizedUrl = parsed.href;
      if (!isDirectVideoInput(normalizedUrl) && !isDirectVideoInput(filePath)) return null;
      return {
        url: normalizedUrl,
        kind: "direct",
        sourceId: buildDirectSourceId(
          `${normalizedUrl}#mtime=${Math.round(stat.mtimeMs).toString()}`,
        ),
      };
    }
  } catch {
    return null;
  }

  try {
    const filePath = path.resolve(trimmed);
    const stat = statSync(filePath);
    if (!stat.isFile()) return null;
    if (!isDirectVideoInput(filePath)) return null;
    const normalizedUrl = pathToFileURL(filePath).href;
    return {
      url: normalizedUrl,
      kind: "direct",
      sourceId: buildDirectSourceId(
        `${normalizedUrl}#mtime=${Math.round(stat.mtimeMs).toString()}`,
      ),
    };
  } catch {
    return null;
  }
}

export function resolveSlideSource({
  url,
  extracted,
}: {
  url: string;
  extracted: ExtractedLinkContent;
}): SlideSource | null {
  const directUrl = extracted.video?.url ?? extracted.url;
  const youtubeCandidate =
    extractYouTubeVideoId(extracted.video?.url ?? "") ??
    extractYouTubeVideoId(extracted.url) ??
    extractYouTubeVideoId(url);
  if (youtubeCandidate) {
    return {
      url: `https://www.youtube.com/watch?v=${youtubeCandidate}`,
      kind: "youtube",
      sourceId: buildYoutubeSourceId(youtubeCandidate),
    };
  }

  if (
    extracted.video?.kind === "direct" ||
    isDirectVideoInput(directUrl) ||
    isDirectVideoInput(url)
  ) {
    const normalized = directUrl || url;
    return (
      resolveLocalDirectVideoSource(normalized) ?? {
        url: normalized,
        kind: "direct",
        sourceId: buildDirectSourceId(normalized),
      }
    );
  }

  if (isYouTubeUrl(url)) {
    const fallbackId = extractYouTubeVideoId(url);
    if (fallbackId) {
      return {
        url: `https://www.youtube.com/watch?v=${fallbackId}`,
        kind: "youtube",
        sourceId: buildYoutubeSourceId(fallbackId),
      };
    }
  }

  return null;
}

export function resolveSlideSourceFromUrl(url: string): SlideSource | null {
  const youtubeCandidate = extractYouTubeVideoId(url);
  if (youtubeCandidate) {
    return {
      url: `https://www.youtube.com/watch?v=${youtubeCandidate}`,
      kind: "youtube",
      sourceId: buildYoutubeSourceId(youtubeCandidate),
    };
  }

  const localSource = resolveLocalDirectVideoSource(url);
  if (localSource) return localSource;

  if (isDirectVideoInput(url)) {
    return {
      url,
      kind: "direct",
      sourceId: buildDirectSourceId(url),
    };
  }

  if (isYouTubeUrl(url)) {
    const fallbackId = extractYouTubeVideoId(url);
    if (fallbackId) {
      return {
        url: `https://www.youtube.com/watch?v=${fallbackId}`,
        kind: "youtube",
        sourceId: buildYoutubeSourceId(fallbackId),
      };
    }
  }

  return null;
}
