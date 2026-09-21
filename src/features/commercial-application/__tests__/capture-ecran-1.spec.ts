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

// ── Une mini-table en mémoire pour la recherche d'idempotence ─────────────
// Un simple `mockResolvedValue` rendrait la même ligne QUEL QUE SOIT le filtre
// — et c'est précisément le filtre qu'il faut éprouver : une ligne /contact
// ordinaire, ou une ligne apporteur en corbeille, ne doit PAS être prise pour
// « déjà capturée ». L'évaluateur ci-dessous applique le `where` réellement
// envoyé, et REFUSE toute clause qu'il ne sait pas lire : une clause ignorée en
// silence ferait passer le test pour une raison fausse.
type LigneTable = {
  id: string;
  contactEmailHash: string;
  type: string;
  deletedAt: Date | null;
  details: Record<string, unknown>;
};
let table: LigneTable[] = [];

function satisfait(ligne: LigneTable, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([cle, valeur]) => {
    switch (cle) {
      case "contactEmailHash":
      case "type":
        return ligne[cle] === valeur;
      case "deletedAt":
        if (valeur !== null) throw new Error("clause deletedAt non prise en charge");
        return ligne.deletedAt === null;
      case "AND":
        return (valeur as Record<string, unknown>[]).every((c) => satisfait(ligne, c));
      case "details": {
        const { path, equals } = valeur as { path: string[]; equals: unknown };
        if (path.length !== 1) throw new Error("chemin JSON profond non pris en charge");
        return ligne.details[path[0] as string] === equals;
      }
      default:
        throw new Error(`clause « ${cle} » non prise en charge par la table de test`);
    }
  });
}

function chercherDansLaTable(a: unknown): { id: string } | null {
  const { where } = a as { where: Record<string, unknown> };
  const trouvee = table.find((l) => satisfait(l, where));
  return trouvee ? { id: trouvee.id } : null;
}
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
  CONSENT_FORM_REFS: {
    leadApporteur: "lead-apporteur",
    commercialApplication: "commercial-tunnel",
  },
  recordConsentEvent: (a: unknown) => consentement(a),
}));
vi.mock("@/server/queue/queues", () => ({
  enqueueEmail: (...a: unknown[]) => enfiler(...a),
  emailsQueue: { remove: async () => 0 },
}));
vi.mock("@/lib/pii-crypto", () => ({ encryptPii: (v: string) => `chiffre(${v})` }));
vi.mock("@/lib/security/ip-hash", () => ({ hashIp: () => "hash-ip" }));

const { capturerContactDossierAction } = await import("../capture-actions");
const { hashEmailForLookup } = await import("@/lib/security/email-hash");

const valide = {
  prenom: "Camille",
  nom: "Durand",
  email: "Camille.Durand@Example.COM",
  telephone: "0612345678",
  consent: true as const,
};

const APPORTEUR = { unifiedType: "recrutement", subType: "candidature-commerciale" };

/** Une ligne de la table, à l'adresse de `valide` sauf mention contraire. */
function ligne(l: Partial<LigneTable> & Pick<LigneTable, "id" | "details">): LigneTable {
  return {
    contactEmailHash: hashEmailForLookup(valide.email) ?? "",
    type: "contact",
    deletedAt: null,
    ...l,
  };
}

beforeEach(() => {
  creer.mockClear();
  chercher.mockClear();
  table = [];
  chercher.mockImplementation(async (a: unknown) => chercherDansLaTable(a));
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
    table = [ligne({ id: "ligne-existante", details: APPORTEUR })];
    const r = await capturerContactDossierAction(valide, "fr");
    expect(r).toEqual({ ok: true, submissionId: "ligne-existante", deja: true });
    expect(creer, "aucune écriture ne doit avoir lieu").not.toHaveBeenCalled();
    expect(enfiler, "et surtout aucune seconde série de rappels").not.toHaveBeenCalled();
  });

  // 🔴 2026-09-19 — LE CANDIDAT PERDU À L'ÉCRAN 1. La garde cherchait « une
  // ligne /contact à cette adresse », sans regarder ce qu'elle était. Quelqu'un
  // qui avait un jour écrit par /contact (une question, une demande de devis),
  // ou dont la candidature précédente avait été mise à la corbeille, était pris
  // pour « déjà capturé » : aucune ligne, aucun kit, aucune relance — et rien
  // dans la console pour le rappeler.
  it("une ligne /contact ordinaire à la même adresse n'est PAS une capture : nouvelle ligne, kit et relances", async () => {
    table = [ligne({ id: "message-contact", details: { unifiedType: "audit" } })];
    const r = await capturerContactDossierAction(valide, "fr");
    expect(r).toMatchObject({ ok: true, deja: false });
    expect(creer, "le candidat doit avoir SA ligne").toHaveBeenCalledTimes(1);
    const gabarits = enfiler.mock.calls.map((c) => c[0]);
    expect(gabarits).toContain("lead-apporteur-recu");
    expect(gabarits).toContain("lead-apporteur-relance");
  });

  it("une ligne apporteur EN CORBEILLE n'est pas une capture : nouvelle ligne, kit et relances", async () => {
    table = [ligne({ id: "ancienne-candidature", details: APPORTEUR, deletedAt: new Date() })];
    const r = await capturerContactDossierAction(valide, "fr");
    expect(r).toMatchObject({ ok: true, deja: false });
    expect(creer).toHaveBeenCalledTimes(1);
    const gabarits = enfiler.mock.calls.map((c) => c[0]);
    expect(gabarits).toContain("lead-apporteur-recu");
    expect(gabarits).toContain("lead-apporteur-relance");
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

  it("programme le kit DIFFÉRÉ et les rappels, et prévient — mais n'écrit RIEN tout de suite", async () => {
    await capturerContactDossierAction(valide, "fr");
    expect(notifier).toHaveBeenCalledTimes(1);

    const appels = enfiler.mock.calls as unknown as Array<
      [string, string, string, Record<string, unknown>, { delayMs?: number } | undefined]
    >;
    const gabarits = appels.map((c) => c[0]);
    // Les rappels « ton dossier t'attend » : exactement ce qu'il faut à un
    // dossier abandonné.
    expect(gabarits).toContain("lead-apporteur-relance");
    // Le KIT (décision Will 2026-09-19 : tout le monde le reçoit dès qu'on a
    // son adresse) — variante « dossier commencé », sans promesse d'appel.
    const kit = appels.find((c) => c[0] === "lead-apporteur-recu");
    expect(kit, "le kit du dossier commencé doit être programmé").toBeDefined();
    expect(kit?.[3]["variante"]).toBe("dossier-commence");
    // ⛔ Mais RIEN d'immédiat : écrire « c'est noté » au milieu du formulaire
    // dit à la personne qu'elle peut s'arrêter. Chaque envoi est différé.
    for (const c of appels) {
      expect(c[4]?.delayMs ?? 0, `${c[0]} ne doit pas partir tout de suite`).toBeGreaterThan(0);
    }
  });

  it("consigne le consentement du texte AFFICHÉ à l'écran 1, pas celui du tunnel Facebook", async () => {
    // 🔴 Correction RGPD du 19/09. L'écran 1 affiche « J'accepte que mes
    // informations soient utilisées pour l'étude de ma candidature » — le texte
    // du dossier. Il consignait pourtant la version du formulaire court
    // Facebook, un autre texte : la preuve ne correspondait pas à ce que la
    // personne avait lu. Une preuve de consentement vaut par ce texte-là.
    await capturerContactDossierAction(valide, "fr");
    expect(consentement).toHaveBeenCalledTimes(1);
    expect(consentement.mock.calls[0]?.[0]).toMatchObject({
      formRef: "commercial-tunnel",
      consentVersion: "memo-v3-2026-09-19",
      action: "optin",
    });
  });

  it("un échec d'écriture rend ok:false sans lever — candidater doit rester possible", async () => {
    creer.mockRejectedValueOnce(new Error("base indisponible"));
    const r = await capturerContactDossierAction(valide, "fr");
    expect(r).toMatchObject({ ok: false });
    // L'appelant ne doit jamais voir d'exception : la navigation continue.
  });
});
