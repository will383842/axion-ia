// S6b — La copie conservée d'un e-mail qui porte un code à usage unique masque le code :
// lire « Emails › Envoyés » ne doit jamais permettre de signer à la place du destinataire.
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ ligne: vi.fn(), ecrire: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      findFirst: (...a: unknown[]) => h.ligne(...a),
      update: (...a: unknown[]) => h.ecrire(...a),
    },
    emailLogContent: { upsert: (...a: unknown[]) => h.ecrire(...a) },
  },
}));

import { enregistrerCopieEnvoi } from "../copie-envoi";

beforeEach(() => {
  vi.clearAllMocks();
  h.ligne.mockResolvedValue({ id: "log-1" });
  h.ecrire.mockResolvedValue({});
});

const ecrit = () => JSON.stringify(h.ecrire.mock.calls);

describe("copie d'un e-mail à code", () => {
  it("le code de signature est masqué dans l'objet, le HTML et le texte", async () => {
    await enregistrerCopieEnvoi({
      jobId: "j-1",
      template: "formateur-code-signature",
      subject: "042517 : votre code de signature Axion-IA",
      html: "<p>Votre code de signature : 042517.</p>",
      text: "Votre code de signature : 042517.",
    });
    expect(h.ecrire).toHaveBeenCalled();
    expect(ecrit()).not.toContain("042517");
    expect(ecrit()).toContain("[code masqué]");
  });
  it("les autres e-mails gardent leurs chiffres", async () => {
    await enregistrerCopieEnvoi({
      jobId: "j-2",
      template: "facture-envoi",
      subject: "Facture 123456",
      html: "<p>123456</p>",
      text: "123456",
    });
    expect(ecrit()).toContain("123456");
  });
  it("code collé à un mot (motif aveugle) : masqué par sa valeur exacte", async () => {
    await enregistrerCopieEnvoi({
      jobId: "j-2",
      template: "formateur-code-signature",
      codeAMasquer: "042517",
      subject: "=?UTF-8?Q?042517_:_code?=",
      html: "<p>code_042517x</p>",
      text: "codeA042517",
    });
    expect(ecrit()).not.toContain("042517");
  });
});
