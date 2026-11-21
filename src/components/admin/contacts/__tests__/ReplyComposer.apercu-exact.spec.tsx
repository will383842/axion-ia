/**
 * Fiche I2-1 — ReplyComposer : « Envoyer » reste verrouillé jusqu'à l'aperçu exact (rendu par le
 * serveur) du contenu en cours, et se verrouille de nouveau dès que le corps change. Le second
 * moteur de mise en forme du navigateur n'existe plus.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

const apercuMock = vi.fn();
vi.mock("@/features/admin-submissions/reply-actions", () => ({
  apercuReponseDemandeAction: (...a: unknown[]) => apercuMock(...a),
  replyToSubmissionAction: vi.fn(),
  getReplyDeliveryStatusAction: vi.fn(),
  retryFailedReplyAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

import { ReplyComposer } from "../ReplyComposer";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function ouvrir(): void {
  render(
    <ReplyComposer
      submissionId="11111111-1111-1111-1111-111111111111"
      contactName="Jean Dupont"
      contactEmail="jean@example.com"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Répondre" }));
}
const corps = () => document.getElementById("reply-body") as HTMLTextAreaElement;
const envoyer = () => screen.getByRole("button", { name: "Envoyer" });

describe("ReplyComposer — aperçu exact et verrou", () => {
  it("6) « Envoyer » désactivé avant l'aperçu, actif après, désactivé de nouveau si le corps change", async () => {
    apercuMock.mockResolvedValue({
      ok: true,
      apercu: {
        html: "<p>Bonjour <strong>Jean</strong></p>",
        objet: "Re: x",
        a: "jean@example.com",
      },
    });
    ouvrir();
    fireEvent.change(corps(), { target: { value: "Bonjour" } });
    expect(envoyer()).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Voir l'aperçu exact" }));
    await waitFor(() => expect(envoyer()).toBeEnabled());
    const cadre = document.querySelector("iframe") as HTMLIFrameElement;
    expect(cadre.getAttribute("sandbox")).toBe("");
    expect(cadre.getAttribute("srcdoc")).toContain("<strong>Jean</strong>");

    fireEvent.change(corps(), { target: { value: "Bonjour, un ajout" } });
    expect(envoyer()).toBeDisabled();
  });

  it("6) le second moteur de mise en forme est absent du source", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/admin/contacts/ReplyComposer.tsx"),
      "utf8",
    );
    expect(src).not.toContain("renderMarkdownPreview");
  });
});
