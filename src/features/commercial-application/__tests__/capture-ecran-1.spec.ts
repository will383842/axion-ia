// La capture à l'écran 1 du dossier.
//
// ── Ce qu'elle change, et ce que ces tests protègent ──────────────────────
// Le dossier fait neuf écrans et sauvegarde DANS LE NAVIGATEUR du visiteur.
// Quelqu'un qui s'arrêtait à l'écran 5 ne laissait rien : ni nom, ni numéro,
// ni même une trace à compter. Désormais, la sortie de l'écran 1 enregistre le
// contact côté serveur.
//
// Trois propriétés font toute la valeur du dispositif, et chacune a son test :
//
//   1. L'ACCORD PRÉCÈDE L'ÉCRITURE. Sans consentement, rien n'est écrit —
//      c'est pour ça que la case a été remontée à l'écran 1.
//   2. L'IDEMPOTENCE. Quelqu'un venu du tunnel a déjà une ligne ; capturer une
//      seconde fois lui vaudrait DEUX séries de rappels.
//   3. LA CLÉ DE PERSONNE est posée — sans elle la ligne est introuvable par
//      son adresse, donc ni exportable (art. 15) ni effaçable (art. 17).

import { describe, it, expect, vi, beforeEach } from "vitest";

const creer = vi.fn(async (_a: unknown) => ({
  id: "22222222-2222-4222-8222-222222222222",
  submittedAt: new Date("2026-09-04T10:00:00Z"),
}));
const chercher = vi.fn(async (_a: unknown) => null as { id: string } | null);
const notifier = vi.fn(async (_a: unknown) => ({ ok: true }));
const consentement = vi.fn(async (_a: unknown) => true);
const enfiler = vi.fn(async (..._a: unknown[]) => ({ enqueued: true }));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: async () => ({ allowed: true, panne: false }),
}));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.9" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submission: { create: (a: unknown) => creer(a), findFirst: (a: unknown) => chercher(a) },
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "vitest" }),
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("@/server/notifications", () => ({ notify: (a: unknown) => notifier(a) }));
vi.mock("@/lib/consents", () => ({
  CONSENT_FORM_REFS: { leadApporteur: "lead-apporteur" },
  recordConsentEvent: (a: unknown) => consentement(a),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enfiler(...a),
  emailsQueue: { remove: async () => 0 },
}));
vi.mock("@/lib/pii-crypto", () => ({ encryptPii: (v: string) => `chiffre(${v})` }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash-ip" }));

const { capturerContactDossierAction } = await import("../capture-actions");

const valide = {
  prenom: "Camille",
  nom: "Durand",
  email: "Camille.Durand@Example.COM",
  telephone: "0612345678",
  consent: true as const,
};

beforeEach(() => {
  creer.mockClear();
  chercher.mockClear();
  chercher.mockResolvedValue(null);
  notifier.mockClear();
  consentement.mockClear();
  enfiler.mockClear();
});

describe("capturerContactDossierAction", () => {
  it("écrit le contact AVEC sa clé de personne, et l'origine qui le distingue du tunnel", async () => {
    const r = await capturerContactDossierAction(valide, "fr");
    expect(r).toMatchObject({ ok: true, deja: false });
    expect(creer).toHaveBeenCalledTimes(1);

    const args = creer.mock.calls[0]?.[0] as {
      data: { contactEmailHash?: string | null; details: Record<string, unknown> };
    };
    // 🔑 Sans cette clé, la ligne est INTROUVABLE par son adresse : l'export
    // art. 15 et l'effacement art. 17 la rateraient en silence.
    expect(args.data.contactEmailHash, "clé de personne absente").toBeTruthy();
    // Le marqueur d'origine : sans lui, impossible de compter combien de gens
    // s'arrêtent DANS le dossier — le chiffre pour lequel la capture existe.
    expect(args.data.details["origine"]).toBe("ecran-1-du-dossier");
    expect(args.data.details["etape"]).toBe("premier-contact");
  });

  it("REFUSE d'écrire sans consentement — l'accord précède l'écriture", async () => {
    // C'est la raison d'être du déplacement de la case à l'écran 1. Prendre des
    // coordonnées ici et demander l'accord huit écrans plus loin serait un
    // traitement sans base.
    const r = await capturerContactDossierAction({ ...valide, consent: false }, "fr");
    expect(r).toMatchObject({ ok: false });
    expect(creer, "rien ne doit être écrit sans accord").not.toHaveBeenCalled();
    expect(consentement).not.toHaveBeenCalled();
  });

  it("REFUSE d'écrire sans e-mail, sans téléphone ou sans prénom", async () => {
    for (const champ of ["prenom", "nom", "email", "telephone"]) {
      creer.mockClear();
      const { [champ]: _retire, ...ampute } = valide as Record<string, unknown>;
      const r = await capturerContactDossierAction(ampute, "fr");
      expect(r, `sans ${champ}`).toMatchObject({ ok: false });
      expect(creer, `sans ${champ}, rien ne doit être écrit`).not.toHaveBeenCalled();
    }
  });

  it("IDEMPOTENT : une personne déjà connue ne crée pas de seconde ligne", async () => {
    // 🔑 Le cas réel : quelqu'un vient du tunnel, a déjà une ligne « premier
    // contact », puis ouvre le dossier. Une seconde ligne lui vaudrait DEUX
    // séries de rappels J+2 / J+7.
    chercher.mockResolvedValue({ id: "ligne-existante" });
    const r = await capturerContactDossierAction(valide, "fr");
    expect(r).toEqual({ ok: true, submissionId: "ligne-existante", deja: true });
    expect(creer, "aucune écriture ne doit avoir lieu").not.toHaveBeenCalled();
    expect(enfiler, "et surtout aucune seconde série de rappels").not.toHaveBeenCalled();
  });

  it("la recherche d'idempotence porte sur l'EMPREINTE, jamais sur l'adresse en clair", async () => {
    // Une requête par adresse en clair ne rendrait jamais rien : la colonne est
    // chiffrée avec un IV aléatoire. Le bug serait SILENCIEUX — des doublons,
    // sans erreur.
    await capturerContactDossierAction(valide, "fr");
    const where = (chercher.mock.calls[0]?.[0] as { where: Record<string, unknown> })?.where;
    expect(where).toHaveProperty("contactEmailHash");
    expect(JSON.stringify(where)).not.toContain("Camille.Durand");
  });

  it("programme les rappels et prévient — mais N'ENVOIE PAS l'e-mail « c'est noté »", async () => {
    await capturerContactDossierAction(valide, "fr");
    expect(notifier).toHaveBeenCalledTimes(1);

    const gabarits = enfiler.mock.calls.map((c) => c[0]);
    // Les rappels « ton dossier t'attend » : exactement ce qu'il faut à un
    // dossier abandonné.
    expect(gabarits).toContain("lead-apporteur-relance");
    // ⛔ Mais pas la confirmation : écrire « c'est noté, on t'appelle » au
    // milieu du formulaire dit à la personne qu'elle peut s'arrêter.
    expect(gabarits, "l'e-mail de confirmation ne doit PAS partir ici").not.toContain(
      "lead-apporteur-recu",
    );
  });

  it("un échec d'écriture rend ok:false sans lever — candidater doit rester possible", async () => {
    creer.mockRejectedValueOnce(new Error("base indisponible"));
    const r = await capturerContactDossierAction(valide, "fr");
    expect(r).toMatchObject({ ok: false });
    // L'appelant ne doit jamais voir d'exception : la navigation continue.
  });
});
