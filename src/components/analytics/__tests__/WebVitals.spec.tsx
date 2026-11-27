import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";

const onINP = vi.fn();
vi.mock("web-vitals/attribution", () => ({ onINP }));
vi.mock("next/web-vitals", () => ({ useReportWebVitals: () => undefined }));
vi.mock("next/navigation", () => ({ usePathname: () => "/fr/a-propos" }));
vi.mock("next-intl", () => ({ useLocale: () => "fr" }));

beforeEach(() => {
  onINP.mockClear();
  // Hors sujet ici : jsdom n'a ni matchMedia ni PerformanceObserver.
  vi.stubGlobal("PerformanceObserver", undefined);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WebVitals — onINP chargé après montage", () => {
  it("appelle onINP une fois avec { reportAllChanges: false }", async () => {
    const { WebVitals } = await import("../WebVitals");
    render(<WebVitals />);
    await new Promise((r) => setTimeout(r, 0));
    expect(onINP).toHaveBeenCalledTimes(1);
    expect(onINP.mock.calls[0]?.[1]).toEqual({ reportAllChanges: false });
  });
  it("n'appelle jamais onINP si démonté avant la résolution de l'import", async () => {
    const { WebVitals } = await import("../WebVitals");
    const { unmount } = render(<WebVitals />);
    unmount();
    await new Promise((r) => setTimeout(r, 0));
    expect(onINP).not.toHaveBeenCalled();
  });
});
