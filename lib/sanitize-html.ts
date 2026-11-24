// lib/sanitize-html.ts
// Shared sanitizer for user-entered rich text rendered with dangerouslySetInnerHTML.
// Keeps normal formatting (bold, links, lists, headings), strips scripts and
// event-handler attributes. Same settings as the client bio view.
import DOMPurify from "dompurify";

export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return "";
  return DOMPurify.sanitize(String(html), { USE_PROFILES: { html: true } });
}
