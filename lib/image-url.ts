// lib/image-url.ts
// Turn common "share" links into URLs that work directly in <img src>.

const DRIVE_ID_PATTERNS = [
  /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{10,})/, // /file/d/<id>/view
  /drive\.google\.com\/(?:open|uc|thumbnail)\?(?:.*&)?id=([a-zA-Z0-9_-]{10,})/, // ?id=<id>
  /docs\.google\.com\/uc\?(?:.*&)?id=([a-zA-Z0-9_-]{10,})/,
  /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]{10,})/,
];

/** Extract a Google Drive file id from any Drive link, or null. */
export function getDriveFileId(url: string): string | null {
  for (const re of DRIVE_ID_PATTERNS) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

/**
 * Normalize an image URL for display:
 * - Google Drive share/view links → direct thumbnail image (file must be shared
 *   as "Anyone with the link")
 * - Dropbox share links → raw file
 * - everything else returned unchanged (trimmed)
 */
export function toDisplayImageUrl(raw?: string | null): string | undefined {
  const url = String(raw ?? "").trim();
  if (!url) return undefined;

  const driveId = getDriveFileId(url);
  if (driveId && !url.includes("/thumbnail?")) {
    return `https://drive.google.com/thumbnail?id=${driveId}&sz=w800`;
  }

  if (/^https?:\/\/(www\.)?dropbox\.com\//.test(url)) {
    try {
      const u = new URL(url);
      u.searchParams.delete("dl");
      u.searchParams.set("raw", "1");
      return u.toString();
    } catch {
      return url;
    }
  }

  return url;
}
