// @vitest-environment node

/**
 * SEC-1c — une ligne déjà stockée avec un type hors liste (ex. text/html) n'est jamais
 * rendue dans le navigateur : octet-stream + attachment.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ auth: vi.fn(), doc: vi.fn(), lire: vi.fn() }));
vi.mock("@/auth", () => ({ auth: h.auth }));
vi.mock("@/server/societe-documents/queries", () => ({ getSocieteDocForDownload: h.doc }));
vi.mock("@/server/console-documents/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/console-documents/storage")>()),
  readConsoleDoc: h.lire,
}));

import { GET } from "./route";

const PREFIXE = "prefixe-factice-test";
const appel = () =>
  GET(new Request(`https://exemple.invalid/fr/${PREFIXE}/x/fichiers/1`), {
    params: Promise.resolve({ locale: "fr", adminPrefix: PREFIXE, id: "1" }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ADMIN_URL_PREFIX", PREFIXE);
  h.auth.mockResolvedValue({ user: { id: "u1", role: "admin" } });
  h.lire.mockResolvedValue(Buffer.from("<script>1</script>"));
});

describe("type servi", () => {
  it("text/html stocké → application/octet-stream + attachment", async () => {
    h.doc.mockResolvedValue({
      storagePath: "/vol/x.pdf",
      fileName: "x.pdf",
      mimeType: "text/html",
      sensitive: false,
    });
    const res = await appel();
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment/);
  });

  it("application/pdf stocké → servi en ligne avec son type", async () => {
    h.doc.mockResolvedValue({
      storagePath: "/vol/x.pdf",
      fileName: "x.pdf",
      mimeType: "application/pdf",
      sensitive: false,
    });
    const res = await appel();
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toMatch(/^inline/);
  });
});
