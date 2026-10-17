// @vitest-environment node

/**
 * Formulaire de contact unifié — les pièces jointes dans l'ACTION (2026-10-15,
 * envoi direct vers R2 : le formulaire n'annonce que nom et taille).
 *
 * Ce qui est verrouillé :
 *   · sans fichier, RIEN ne change : même charge utile d'accusé, même alerte,
 *     même retour, aucune URL, aucune ligne de pièce ;
 *   · une URL d'envoi n'est délivrée qu'APRÈS la limite de fréquence, le
 *     leurre, Turnstile et l'écriture de la demande ;
 *   · Turnstile en échec : aucune URL, mais la demande est enregistrée avec la
 *     mention « pièces non reçues » ;
 *   · la clé de stockage est tirée par le serveur : rien de ce qu'envoie le
 *     navigateur n'y entre ;
 *   · un stockage indisponible ne perd JAMAIS la demande ;
 *   · avec fichiers, l'accusé attend la fin de l'envoi (il dira combien sont reçus).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  submissionCreate: vi.fn(),
  attachmentCreateMany: vi.fn(),
  signerEnvoiDirectR2: vi.fn(),
  isR2Configured: vi.fn(() => true),
  notify: vi.fn(),
  enqueueEmail: vi.fn(),
  checkRateLimit: vi.fn(),
  verifyTurnstile: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "vitest" }),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { create: h.submissionCreate },
    submissionAttachment: {
      createMany: h.attachmentCreateMany,
      aggregate: async () => ({ _sum: { tailleOctets: 0 } }),
    },
  },
}));
vi.mock("@/lib/redis", () => ({ redis: { set: async () => "OK" } }));
vi.mock("@/lib/r2-storage", () => ({
  signerEnvoiDirectR2: h.signerEnvoiDirectR2,
  isR2Configured: h.isR2Configured,
}));
vi.mock("@/server/careers/clamav", () => ({ analyserFlux: vi.fn() }));
vi.mock("@/server/notifications", () => ({ notify: h.notify }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: h.enqueueEmail }));
vi.mock("@/server/crm-sync", () => ({ syncFormSubmissionToCrm: vi.fn() }));
vi.mock("@/lib/consents", () => ({
  CONSENT_FORM_REFS: { unifiedContact: "unified-contact" },
  recordConsentEvent: vi.fn(),
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: h.checkRateLimit }));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: h.verifyTurnstile }));
vi.mock("@/lib/pii-crypto", () => ({
  encryptPii: (v: string) => `enc:${v}`,
  decryptPii: (v: string) => v,
  isDecryptedEmailUsable: () => true,
}));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "iphash" }));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "emailhash" }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));
vi.mock("@/lib/security/honeypot-observable", () => ({ signalerHoneypot: vi.fn() }));

import { submitUnifiedContactAction } from "../actions";

function formulaire(annonce?: unknown): FormData {
  const fd = new FormData();
  fd.set("type", "formation");
  fd.set("nom", "Camille Exemple");
  fd.set("email", "camille@example.invalid");
  fd.set("telephone", "+33 6 39 98 12 34");
  fd.set("ville", "Lyon");
  fd.set("message", "Demande de formation, voir le cahier des charges joint.");
  fd.set("locale", "fr");
  fd.set("consent", "true");
  fd.set("cf-turnstile-response", "jeton-turnstile");
  if (annonce !== undefined) fd.set("piecesAnnoncees", JSON.stringify(annonce));
  return fd;
}

const DEUX_PIECES = [
  { nom: "Cahier des charges.pdf", taille: 18 * 1024 * 1024 },
  { nom: "plans.zip", taille: 22 * 1024 * 1024 },
];

const ETAT = { ok: false as const, error: "" };

beforeEach(() => {
  vi.clearAllMocks();
  h.isR2Configured.mockReturnValue(true);
  h.checkRateLimit.mockResolvedValue({ allowed: true });
  h.verifyTurnstile.mockResolvedValue(true);
  h.submissionCreate.mockResolvedValue({ id: "sub-1", submittedAt: new Date() });
  h.attachmentCreateMany.mockResolvedValue({ count: 2 });
  h.signerEnvoiDirectR2.mockImplementation(
    async (cle: string, taille: number) => `https://r2.invalid/${cle}?len=${taille}`,
  );
  h.notify.mockResolvedValue({ ok: true });
  h.enqueueEmail.mockResolvedValue({ enqueued: true });
});

describe("sans pièce jointe, rien ne change", () => {
  it("même retour, même alerte, même accusé, aucune URL ni ligne de pièce", async () => {
    const r = await submitUnifiedContactAction(ETAT, formulaire());
    expect(r).toEqual({ ok: true, submissionId: "sub-1" });
    expect(h.signerEnvoiDirectR2).not.toHaveBeenCalled();
    expect(h.attachmentCreateMany).not.toHaveBeenCalled();
    const details = h.submissionCreate.mock.calls[0]![0].data.details;
    expect(Object.keys(details).some((k) => /pieces|accuse/i.test(k))).toBe(false);
    expect(h.notify.mock.calls[0]![0].payload).not.toHaveProperty("piecesJointes");
    // La charge utile d'AVANT, au champ près.
    expect(h.enqueueEmail).toHaveBeenCalledTimes(1);
    expect(h.enqueueEmail.mock.calls[0]![3]).toEqual({
      contactName: "Camille Exemple",
      submissionId: "sub-1",
      type: "formation",
      subType: undefined,
      size: undefined,
      industry: undefined,
      auditType: undefined,
    });
    expect(h.enqueueEmail.mock.calls[0]![4]).toEqual({
      entityType: "Submission",
      entityId: "sub-1",
    });
  });

  it("une annonce vide ne change rien non plus", async () => {
    const r = await submitUnifiedContactAction(ETAT, formulaire([]));
    expect(r).toEqual({ ok: true, submissionId: "sub-1" });
    expect(h.signerEnvoiDirectR2).not.toHaveBeenCalled();
  });
});

describe("les URL d'envoi ne sont délivrées qu'après les contrôles", () => {
  it("contrôles passés : une URL par fichier, APRÈS l'écriture de la demande", async () => {
    const r = await submitUnifiedContactAction(ETAT, formulaire(DEUX_PIECES));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.envoiPieces?.envois).toHaveLength(2);
    expect(r.envoiPieces?.jeton).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(r).not.toHaveProperty("piecesNonRecues");
    // Ordre : la demande d'abord, les URL ensuite.
    expect(h.submissionCreate.mock.invocationCallOrder[0]).toBeLessThan(
      h.signerEnvoiDirectR2.mock.invocationCallOrder[0]!,
    );
    // La longueur annoncée est celle que l'URL signe.
    expect(h.signerEnvoiDirectR2.mock.calls.map((c) => c[1])).toEqual([
      18 * 1024 * 1024,
      22 * 1024 * 1024,
    ]);
    // Les lignes : attendues, sous l'empreinte du jeton (jamais le jeton).
    const lignes = h.attachmentCreateMany.mock.calls[0]![0].data;
    expect(lignes.map((l: { statut: string }) => l.statut)).toEqual(["attendue", "attendue"]);
    expect(lignes[0].jetonHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(lignes)).not.toContain(r.envoiPieces!.jeton);
  });

  it("limite de fréquence atteinte : ni demande, ni URL", async () => {
    h.checkRateLimit.mockResolvedValue({ allowed: false });
    const r = await submitUnifiedContactAction(ETAT, formulaire(DEUX_PIECES));
    expect(r.ok).toBe(false);
    expect(h.submissionCreate).not.toHaveBeenCalled();
    expect(h.signerEnvoiDirectR2).not.toHaveBeenCalled();
  });

  it("leurre rempli : succès silencieux, aucune URL", async () => {
    const fd = formulaire(DEUX_PIECES);
    fd.set("website", "http://robot.invalid");
    const r = await submitUnifiedContactAction(ETAT, fd);
    expect(r).toEqual({ ok: true, submissionId: "" });
    expect(h.signerEnvoiDirectR2).not.toHaveBeenCalled();
  });

  it("Turnstile en échec : aucune URL, mais la demande est enregistrée, pièces « non reçues »", async () => {
    h.verifyTurnstile.mockResolvedValue(false);
    const r = await submitUnifiedContactAction(ETAT, formulaire(DEUX_PIECES));
    expect(r).toEqual({ ok: true, submissionId: "sub-1", piecesNonRecues: 2 });
    expect(h.signerEnvoiDirectR2).not.toHaveBeenCalled();
    expect(h.attachmentCreateMany).not.toHaveBeenCalled();
    const details = h.submissionCreate.mock.calls[0]![0].data.details;
    expect(details).toMatchObject({
      turnstilePassed: false,
      piecesJointesAnnoncees: 2,
      piecesJointesNonRecues: "turnstile",
    });
    expect(details).not.toHaveProperty("accuseDiffere");
    // Aucun fichier n'arrivera : l'accusé part tout de suite, sans « pièces reçues ».
    expect(h.enqueueEmail).toHaveBeenCalledTimes(1);
    expect(h.enqueueEmail.mock.calls[0]![3]).not.toHaveProperty("piecesJointesRecues");
  });

  it("une annonce hors limites (26 Mo) : aucune URL, la demande reste", async () => {
    const r = await submitUnifiedContactAction(
      ETAT,
      formulaire([{ nom: "plans.pdf", taille: 26 * 1024 * 1024 }]),
    );
    expect(r).toEqual({ ok: true, submissionId: "sub-1", piecesNonRecues: 1 });
    expect(h.signerEnvoiDirectR2).not.toHaveBeenCalled();
  });

  it("un .docm annoncé : aucune URL", async () => {
    const r = await submitUnifiedContactAction(
      ETAT,
      formulaire([{ nom: "cdc.docm", taille: 2048 }]),
    );
    expect(r).toMatchObject({ ok: true, piecesNonRecues: 1 });
    expect(h.signerEnvoiDirectR2).not.toHaveBeenCalled();
  });
});

describe("la clé n'est pas contrôlable par le navigateur", () => {
  it("clé tirée par le serveur, dans le préfixe temporaire ; ni nom, ni chemin, ni champ fourni", async () => {
    const r = await submitUnifiedContactAction(
      ETAT,
      formulaire([
        {
          nom: "../../invoices/2026/AXION-2026-0001.pdf",
          taille: 4096,
          cle: "invoices/2026/AXION-2026-0001.pdf",
          cleStockage: "invoices/x",
          bucket: "autre",
        },
      ]),
    );
    expect(r.ok).toBe(true);
    const [cle] = h.signerEnvoiDirectR2.mock.calls[0]!;
    expect(cle).toMatch(
      /^contact\/pieces-temporaires\/\d{4}-\d{2}-\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(cle).not.toMatch(/invoices|AXION|\.\./);
    const ligne = h.attachmentCreateMany.mock.calls[0]![0].data[0];
    expect(ligne.cleStockage).toBe(cle);
    // Le nom affiché est assaini (aucun chemin).
    expect(ligne.nomFichier).toBe("AXION-2026-0001.pdf");
  });
});

describe("aucune demande perdue à cause d'un fichier", () => {
  it("lignes impossibles à écrire : la demande reste, pièces non reçues, accusé immédiat", async () => {
    h.attachmentCreateMany.mockRejectedValue(new Error("relation does not exist"));
    const r = await submitUnifiedContactAction(ETAT, formulaire(DEUX_PIECES));
    expect(r).toEqual({ ok: true, submissionId: "sub-1", piecesNonRecues: 2 });
    expect(h.enqueueEmail).toHaveBeenCalledTimes(1);
  });

  it("R2 non configuré : la demande reste, pièces non reçues", async () => {
    h.isR2Configured.mockReturnValue(false);
    const r = await submitUnifiedContactAction(ETAT, formulaire(DEUX_PIECES));
    expect(r).toEqual({ ok: true, submissionId: "sub-1", piecesNonRecues: 2 });
    expect(h.submissionCreate.mock.calls[0]![0].data.details).toMatchObject({
      piecesJointesNonRecues: "stockage",
    });
  });

  it("annonce illisible : la demande reste", async () => {
    const fd = formulaire();
    fd.set("piecesAnnoncees", "{pas du json");
    const r = await submitUnifiedContactAction(ETAT, fd);
    expect(r).toMatchObject({ ok: true, submissionId: "sub-1", piecesNonRecues: 1 });
  });
});

describe("avec fichiers, l'alerte part tout de suite et l'accusé attend", () => {
  it("alerte : le NOMBRE annoncé ; accusé : différé, gabarit rangé dans la demande", async () => {
    await submitUnifiedContactAction(ETAT, formulaire(DEUX_PIECES));
    const payload = h.notify.mock.calls[0]![0].payload;
    expect(payload.piecesJointes).toBe(2);
    // Noms annoncés et assainis, en fin de payload (salon « Clients », #1553) ;
    // le texte Telegram actuel ne les affiche pas (garde de `format.ts`).
    expect(payload.piecesJointesNoms).toEqual(["Cahier des charges.pdf", "plans.zip"]);
    expect(h.enqueueEmail).not.toHaveBeenCalled();
    expect(h.submissionCreate.mock.calls[0]![0].data.details).toMatchObject({
      piecesJointesAnnoncees: 2,
      accuseDiffere: "contact-confirmed",
    });
  });
});
