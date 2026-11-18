/**
 * Lot I2-2, test 6 — « Envoyer » ne s'active qu'après l'aperçu exact du contenu en cours.
 * Le faux aperçu du navigateur (`Apercu`, seconde mise en forme) a disparu.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, fireEvent, screen, act } from "@testing-library/react";

const repondre = vi.fn();
const apercu = vi.fn();
vi.mock("@/features/admin-job-applications/reply-actions", () => ({
  repondreAuCandidatAction: (...a: unknown[]) => repondre(...a),
  apercuReponseCandidatAction: (...a: unknown[]) => apercu(...a),
  rejouerReponseEchoueeAction: vi.fn(),
  etatLivraisonReponseAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { ComposerReponse } from "../ComposerReponse";

beforeEach(() => {
  repondre.mockReset().mockResolvedValue({ ok: true, replyId: "r1" });
  apercu.mockReset().mockResolvedValue({
    ok: true,
    apercu: {
      html: "<p>Corps rendu par le serveur</p>",
      objet: "Votre candidature",
      a: "candidat@exemple.test",
    },
  });
});
afterEach(cleanup);

function ouvrirEtRemplir(): void {
  render(
    <ComposerReponse
      applicationId="11111111-1111-1111-1111-111111111111"
      prenom="Amina"
      poste="Monteur"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Répondre au candidat" }));
  fireEvent.change(screen.getByLabelText("Objet"), { target: { value: "Votre candidature" } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Bonjour" } });
}
const envoyer = (): HTMLButtonElement =>
  screen.getByRole("button", { name: "Envoyer" }) as HTMLButtonElement;

async function voirApercu(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: "Voir l’aperçu exact" }));
  await act(async () => {
    await Promise.resolve();
  });
}

describe("ComposerReponse — aperçu exact avant envoi", () => {
  it("🔴 « Envoyer » est désactivé avant l'aperçu", () => {
    ouvrirEtRemplir();
    expect(envoyer().disabled).toBe(true);
    fireEvent.click(envoyer());
    expect(repondre).not.toHaveBeenCalled();
  });

  it("🔴 actif après l'aperçu, qui montre le HTML du serveur dans le lecteur isolé", async () => {
    ouvrirEtRemplir();
    await voirApercu();
    expect(apercu).toHaveBeenCalledTimes(1);
    expect(apercu.mock.calls[0]?.[0]).toMatchObject({
      applicationId: "11111111-1111-1111-1111-111111111111",
      subject: "Votre candidature",
      bodyMarkdown: "Bonjour",
    });
    const cadre = document.querySelector("iframe");
    expect(cadre?.getAttribute("sandbox")).toBe("");
    expect(cadre?.getAttribute("srcdoc")).toContain("Corps rendu par le serveur");
    expect(envoyer().disabled).toBe(false);
  });

  it("🔴 désactivé de nouveau si le corps change après l'aperçu", async () => {
    ouvrirEtRemplir();
    await voirApercu();
    expect(envoyer().disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Bonjour Amina" } });
    expect(envoyer().disabled).toBe(true);
  });

  it("🔴 désactivé de nouveau si l'objet change après l'aperçu", async () => {
    ouvrirEtRemplir();
    await voirApercu();
    fireEvent.change(screen.getByLabelText("Objet"), { target: { value: "Autre objet" } });
    expect(envoyer().disabled).toBe(true);
  });

  it("un aperçu refusé par le serveur n'active pas « Envoyer »", async () => {
    apercu.mockResolvedValue({ ok: false, error: "invalid_recipient" });
    ouvrirEtRemplir();
    await voirApercu();
    expect(envoyer().disabled).toBe(true);
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("l'envoi part après l'aperçu", async () => {
    ouvrirEtRemplir();
    await voirApercu();
    fireEvent.click(envoyer());
    await act(async () => {
      await Promise.resolve();
    });
    expect(repondre).toHaveBeenCalledTimes(1);
  });

  it("🔴 le second moteur de mise en forme du navigateur a disparu", () => {
    const source = readFileSync(join(__dirname, "..", "ComposerReponse.tsx"), "utf8");
    expect(source).not.toMatch(/function Apercu\b/);
    expect(source).not.toMatch(/from "@\/lib\/email\/markdown-leger"/);
    expect(source).toContain("LecteurEmail");
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });
});
