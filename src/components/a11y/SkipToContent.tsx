import { getTranslations } from "next-intl/server";

// First focusable element. Visually hidden until focus, then jumps to <main>.
// WCAG 2.4.1 Bypass Blocks (axionia-a11y).
export async function SkipToContent() {
  const t = await getTranslations("common");
  return (
    <a
      href="#main"
      className="bg-fg text-bg focus-visible:ring-primary sr-only z-50 rounded-sm px-4 py-2 text-sm font-medium focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:ring-2 focus-visible:ring-offset-2"
    >
      {t("skipToContent")}
    </a>
  );
}
