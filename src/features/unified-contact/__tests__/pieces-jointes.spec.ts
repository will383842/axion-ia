// @vitest-environment node

/**
 * Formulaire de contact unifié — les pièces jointes, de bout en bout dans
 * l'action (stockage R2 SIMULÉ).
 *
 * Ce qui est verrouillé :
 *   · sans fichier, RIEN ne change : aucune écriture R2, aucune ligne de pièce,
 *     ni notification ni accusé ne portent de champ nouveau ;
 *   · un fichier refusé (exécutable déguisé, .docm, virus) revient au
 *     formulaire AVANT toute écriture de la demande ;
 *   · un fichier accepté part dans R2 (clé aléatoire), puis sa ligne ;
 *   · un stockage indisponible ne perd JAMAIS la demande.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  submissionCreate: vi.fn(),
  attachmentCreate: vi.fn(),
  uploadToR2: vi.fn(),
  deleteFromR2: vi.fn(),
  isR2Configured: vi.fn(() => true),
  analyserOctets: vi.fn(),
  notify: vi.fn(),
  enqueueEmail: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "vitest" }),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { create: h.submissionCreate },
    submissionAttachment: { create: h.attachmentCreate },
  },
}));
vi.mock("@/lib/r2-storage", () => ({
  uploadToR2: h.uploadToR2,
  deleteFromR2: h.deleteFromR2,
  isR2Configured: h.isR2Configured,
}));
vi.mock("@/server/careers/clamav", () => ({ analyserOctets: h.analyserOctets }));
vi.mock("@/server/notifications", () => ({ notify: h.notify }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: h.enqueueEmail }));
vi.mock("@/server/crm-sync", () => ({ syncFormSubmissionToCrm: vi.fn() }));
vi.mock("@/lib/consents", () => ({
  CONSENT_FORM_REFS: { unifiedContact: "unified-contact" },
  recordConsentEvent: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: async () => ({ allowed: true }) }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: async () => true }));
vi.mock("@/lib/pii-crypto", () => ({ encryptPii: (v: string) => `enc:${v}` }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "iphash" }));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "emailhash" }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));
vi.mock("@/lib/security/honeypot-observable", () => ({ signalerHoneypot: vi.fn() }));

import { submitUnifiedContactAction } from "../actions";

const PDF = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");
const EXE = Buffer.concat([Buffer.from([0x4d, 0x5a, 0x90, 0x00]), Buffer.from("DOS mode")]);
const DOCX = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from("....[Content_Types].xml....word/document.xml"),
]);

function formulaire(fichiers: File[] = []): FormData {
  const fd = new FormData();
  fd.set("type", "formation");
  fd.set("nom", "Camille Exemple");
  fd.set("email", "camille@example.invalid");
  fd.set("telephone", "+33 6 39 98 12 34");
  fd.set("ville", "Lyon");
  fd.set("message", "Demande de formation, voir le cahier des charges joint.");
  fd.set("locale", "fr");
  fd.set("consent", "true");
  for (const f of fichiers) fd.append("piecesJointes", f, f.name);
  return fd;
}

const fichier = (nom: string, contenu: Buffer) =>
  new File([new Uint8Array(contenu)], nom, { type: "application/pdf" });

const ETAT = { ok: false as const, error: "" };

beforeEach(() => {
  vi.clearAllMocks();
  h.isR2Configured.mockReturnValue(true);
  h.submissionCreate.mockResolvedValue({ id: "sub-1", submittedAt: new Date() });
  h.attachmentCreate.mockResolvedValue({});
  h.uploadToR2.mockImplementation(async (key: string, buf: Uint8Array) => ({
    key,
    etag: null,
    sizeBytes: buf.byteLength,
  }));
  h.analyserOctets.mockResolvedValue({ issue: "sain" });
  h.notify.mockResolvedValue({ ok: true });
  h.enqueueEmail.mockResolvedValue(undefined);
});

describe("sans pièce jointe, rien ne change", () => {
  it("la demande est enregistrée, sans R2, sans ligne de pièce, sans champ nouveau", async () => {
    const r = await submitUnifiedContactAction(ETAT, formulaire());
    expect(r).toEqual({ ok: true, submissionId: "sub-1" });
    expect(h.submissionCreate).toHaveBeenCalledTimes(1);
    expect(h.uploadToR2).not.toHaveBeenCalled();
    expect(h.attachmentCreate).not.toHaveBeenCalled();
    expect(h.analyserOctets).not.toHaveBeenCalled();
    const payload = h.notify.mock.calls[0]![0].payload;
    expect(payload).not.toHaveProperty("piecesJointes");
    expect(payload).not.toHaveProperty("piecesJointesNoms");
    expect(h.enqueueEmail.mock.calls[0]![3]).not.toHaveProperty("piecesJointesRecues");
  });

  it("un champ fichier laissé vide (fichier sans nom, 0 octet) est ignoré", async () => {
    const fd = formulaire();
    fd.append("piecesJointes", new File([], ""), "");
    const r = await submitUnifiedContactAction(ETAT, fd);
    expect(r).toEqual({ ok: true, submissionId: "sub-1" });
    expect(h.uploadToR2).not.toHaveBeenCalled();
  });
});

describe("pièces acceptées", () => {
  it("chaque fichier part dans R2 sous une clé aléatoire, puis sa ligne", async () => {
    const r = await submitUnifiedContactAction(
      ETAT,
      formulaire([fichier("Cahier des charges.pdf", PDF), fichier("../annexe.docx", DOCX)]),
    );
    expect(r).toEqual({ ok: true, submissionId: "sub-1" });
    expect(h.uploadToR2).toHaveBeenCalledTimes(2);
    const [cle, , mime] = h.uploadToR2.mock.calls[0]!;
    expect(cle).toMatch(/^contact\/pieces-jointes\/\d{4}\/sub-1\/[0-9a-f-]{36}\.pdf$/);
    expect(cle).not.toContain("Cahier");
    expect(mime).toBe("application/pdf");
    expect(h.attachmentCreate.mock.calls[1]![0].data).toMatchObject({
      submissionId: "sub-1",
      nomFichier: "annexe.docx",
      format: "docx",
      antivirus: "sain",
    });

    const payload = h.notify.mock.calls[0]![0].payload;
    expect(payload.piecesJointes).toBe(2);
    expect(payload.piecesJointesNoms).toEqual(["Cahier des charges.pdf", "annexe.docx"]);
    expect(h.enqueueEmail.mock.calls[0]![3].piecesJointesRecues).toBe(2);
  });

  it("antivirus muet : la pièce est gardée, marquée non vérifiée", async () => {
    h.analyserOctets.mockResolvedValue({ issue: "indisponible", raison: "connexion" });
    const r = await submitUnifiedContactAction(ETAT, formulaire([fichier("a.pdf", PDF)]));
    expect(r.ok).toBe(true);
    expect(h.attachmentCreate.mock.calls[0]![0].data.antivirus).toBe("non_verifie");
  });
});

describe("pièces refusées — avant toute écriture", () => {
  it.each([
    ["un exécutable déguisé en .pdf", fichier("cahier.pdf", EXE), /ne correspond pas/],
    ["un .docm", fichier("cahier.docm", DOCX), /macros/],
    ["un .html", fichier("page.html", Buffer.from("<html></html>")), /format non accepté/],
  ])("%s", async (_libelle, f, message) => {
    const r = await submitUnifiedContactAction(ETAT, formulaire([f]));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(message);
    expect(h.submissionCreate).not.toHaveBeenCalled();
    expect(h.uploadToR2).not.toHaveBeenCalled();
  });

  it("un fichier signalé par l'antivirus", async () => {
    h.analyserOctets.mockResolvedValue({ issue: "infecte", signature: "Eicar-Test" });
    const r = await submitUnifiedContactAction(ETAT, formulaire([fichier("a.pdf", PDF)]));
    expect(r.ok === false && r.error).toMatch(/antivirus/);
    expect(h.submissionCreate).not.toHaveBeenCalled();
  });

  it("quatre fichiers", async () => {
    const f = () => fichier("a.pdf", PDF);
    const r = await submitUnifiedContactAction(ETAT, formulaire([f(), f(), f(), f()]));
    expect(r.ok === false && r.error).toMatch(/3 fichiers au maximum/);
    expect(h.submissionCreate).not.toHaveBeenCalled();
  });

  it("un fichier de plus de 10 Mo", async () => {
    const gros = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]);
    const r = await submitUnifiedContactAction(ETAT, formulaire([fichier("gros.pdf", gros)]));
    expect(r.ok === false && r.error).toMatch(/dépasse 10 Mo/);
    expect(h.submissionCreate).not.toHaveBeenCalled();
  });
});

describe("stockage indisponible — la demande n'est jamais perdue", () => {
  it("R2 non configuré : demande enregistrée, pièces signalées non reçues", async () => {
    h.isR2Configured.mockReturnValue(false);
    const r = await submitUnifiedContactAction(ETAT, formulaire([fichier("a.pdf", PDF)]));
    expect(r).toEqual({ ok: true, submissionId: "sub-1", piecesNonRecues: 1 });
    expect(h.submissionCreate).toHaveBeenCalledTimes(1);
    expect(h.notify.mock.calls[0]![0].payload).not.toHaveProperty("piecesJointes");
  });

  it("envoi R2 en échec : idem", async () => {
    h.uploadToR2.mockRejectedValue(new Error("réseau"));
    const r = await submitUnifiedContactAction(ETAT, formulaire([fichier("a.pdf", PDF)]));
    expect(r).toEqual({ ok: true, submissionId: "sub-1", piecesNonRecues: 1 });
    expect(h.attachmentCreate).not.toHaveBeenCalled();
  });

  it("table absente (migration pas jouée) : l'objet écrit est retiré, la demande reste", async () => {
    h.attachmentCreate.mockRejectedValue(Object.assign(new Error("P2021"), { code: "P2021" }));
    const r = await submitUnifiedContactAction(ETAT, formulaire([fichier("a.pdf", PDF)]));
    expect(r).toEqual({ ok: true, submissionId: "sub-1", piecesNonRecues: 1 });
    expect(h.deleteFromR2).toHaveBeenCalledTimes(1);
  });
});
