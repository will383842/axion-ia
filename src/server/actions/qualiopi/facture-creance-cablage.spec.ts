/**
 * Le CÂBLAGE de la facturation par créance — pas seulement sa décision.
 *
 * 🔴 La leçon du 16/08, payée une fois : trois sous-lots avaient extrait leur
 * décision dans un module pur bien testé et laissé le point d'appel sans
 * couverture. Couper l'appel laissait 568 tests verts. On ne recommence pas.
 *
 * Ces tests montent la Server Action d'émission avec un Prisma simulé et
 * vérifient ce qui est RÉELLEMENT écrit :
 *   - le destinataire demandé n'est plus écrasé par la subrogation ;
 *   - le montant vient de la créance ;
 *   - `dossierFinancementId` est posé sur la facture ;
 *   - `DossierPayeur.factureFormationId` est posé sur la créance.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockSessionFindUnique,
  mockFactureCreate,
  mockFactureFindMany,
  mockPayeurUpdate,
  mockConfigFindUnique,
} = vi.hoisted(() => ({
  mockSessionFindUnique: vi.fn(),
  mockFactureCreate: vi.fn(),
  mockFactureFindMany: vi.fn(),
  mockPayeurUpdate: vi.fn(),
  mockConfigFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainingSession: {
      findUnique: mockSessionFindUnique,
      findUniqueOrThrow: mockSessionFindUnique,
    },
    factureFormation: { create: mockFactureCreate, findMany: mockFactureFindMany },
    dossierPayeur: { update: mockPayeurUpdate },
    siteSetting: { findUnique: mockConfigFindUnique },
    activityLog: { create: vi.fn() },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/actions/qualiopi/_revalidate", () => ({
  revalidateQualiopi: vi.fn(),
  revalidateAdmin: vi.fn(),
}));

vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn().mockResolvedValue({
    raisonSociale: "Axion-IA",
    siret: "12345678901234",
    nda: "84380000000",
    adresseSiege: "1 rue X, 38000 Grenoble",
    email: "contact@axion-ia.com",
  }),
}));

vi.mock("@/server/qualiopi/documents/conformite", () => ({
  champsIdentiteManquants: vi.fn().mockReturnValue([]),
  evaluerIdentite: vi.fn(),
  exigeIdentiteComplete: vi.fn(),
}));

vi.mock("@/server/qualiopi/config/site-settings", () => ({
  // 🔴 Le mock rendait 30 pour TOUTES les clés. Un test qui vérifie « le client
  // reçoit son délai et non celui du financeur » passait alors même sur le code
  // fautif : les deux valeurs étaient identiques, donc indiscernables. Un mock
  // plus étroit que le vrai contrat rend un test décoratif — et ce dépôt l'a
  // déjà payé. Les deux délais sont désormais DISTINCTS, comme en production
  // (30 j client / 45 j financeur, `config/registry.ts:391,395`).
  getQualiopiConfig: vi.fn(async (cle: string) =>
    cle === "delai_paiement_financeur_jours" ? 45 : 30,
  ),
}));

import { genererFactureFormationAction } from "@/server/actions/qualiopi/financements";

const SESSION_ID = "55555555-5555-4555-8555-555555555555";

/** Dossier subrogé : l'OPCO couvre 200 €, l'entreprise doit 100 €. */
function sessionAvecCreances() {
  return {
    financementType: "opco",
    opcoStatut: "accord_recu",
    opcoSubrogation: true,
    numeroDossierOpco: "ATL-1",
    edofVerifieAt: null,
    montantHtCents: 30000,
    dureeReelleHeures: 14,
    nbParticipantsReels: 1,
    nbParticipantsPrevus: 1,
    modalite: "presentiel",
    titreSession: "IA appliquée",
    numero: "AXI-SESS-2026-010",
    priseEnChargeMontantCents: null,
    priseEnChargeUnite: null,
    priseEnChargePlafondFormationCents: null,
    priseEnChargePlafondAnnuelCents: null,
    dateDebut: new Date("2026-09-01"),
    dateFin: new Date("2026-09-02"),
    clientId: "c-1",
    dossiersFinancement: [
      {
        id: "dos-1",
        payeurs: [
          {
            id: "cr-opco",
            payeurType: "opco_subroge",
            payeurNom: "Atlas",
            montantAttenduCents: 20000,
            // `as string | null` : sans l'annotation, TS infère le littéral
            // `null` et le test « déjà facturée » ne peut plus rien y poser.
            factureFormationId: null as string | null,
          },
          {
            id: "cr-ent",
            payeurType: "entreprise",
            payeurNom: "Acme",
            montantAttenduCents: 10000,
            factureFormationId: null as string | null,
          },
        ],
      },
    ],
    client: {
      raisonSociale: "Acme",
      siret: "98765432100011",
      adresse: "10 av. X, 75008 Paris",
      adresseRue: null,
      adresseCodePostal: null,
      adresseVille: null,
      tvaIntracom: null,
      opcoIdentifie: "atlas",
      delaiPaiementJours: null,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFactureFindMany.mockResolvedValue([]);
  mockFactureCreate.mockResolvedValue({
    id: "f-new",
    numero: "AXI-FACT-2026-001",
    documentId: null,
  });
  mockPayeurUpdate.mockResolvedValue({ id: "cr-ent" });
});

describe("🔴 le destinataire demandé n'est PLUS écrasé par la subrogation", () => {
  it("demander « entreprise » sur un dossier SUBROGÉ émet bien au client", async () => {
    // C'était impossible : `opcoSubrogation ? "opco" : destinataire` forçait
    // l'OPCO, donc le reste à charge n'était facturable à personne.
    mockSessionFindUnique.mockResolvedValue(sessionAvecCreances());

    const r = await genererFactureFormationAction({
      sessionId: SESSION_ID,
      destinataire: "entreprise",
      ventilation: "forfait",
    });

    expect("data" in r, `l'émission a échoué : ${JSON.stringify(r)}`).toBe(true);
    const data = mockFactureCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data["destinataire"], "le destinataire a été écrasé à « opco »").toBe("entreprise");
  });

  it("🔴 et le MONTANT vient de la créance, pas du total de la session", async () => {
    // Facturer 300 € à l'entreprise alors qu'elle ne doit que 100 € réclamerait
    // deux fois la part de l'OPCO.
    mockSessionFindUnique.mockResolvedValue(sessionAvecCreances());

    await genererFactureFormationAction({
      sessionId: SESSION_ID,
      destinataire: "entreprise",
      ventilation: "forfait",
    });

    const data = mockFactureCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data["montantHtCents"]).toBe(10000);
  });

  it("demander « opco » émet la part de l'OPCO seulement", async () => {
    mockSessionFindUnique.mockResolvedValue(sessionAvecCreances());

    await genererFactureFormationAction({
      sessionId: SESSION_ID,
      destinataire: "opco",
      ventilation: "forfait",
    });

    const data = mockFactureCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data["destinataire"]).toBe("opco");
    expect(data["montantHtCents"]).toBe(20000);
  });
});

describe("🔴 les DEUX liens sont écrits — le pont encaissement → dossier s'anime", () => {
  it("la facture porte `dossierFinancementId`", async () => {
    // Sans lui, `marquerPaiementRecuSiSoldee` reste du code mort et le dossier
    // n'atteint jamais `paiement_recu`.
    mockSessionFindUnique.mockResolvedValue(sessionAvecCreances());

    await genererFactureFormationAction({
      sessionId: SESSION_ID,
      destinataire: "entreprise",
      ventilation: "forfait",
    });

    const data = mockFactureCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data["dossierFinancementId"]).toBe("dos-1");
  });

  it("la CRÉANCE pointe vers sa facture", async () => {
    mockSessionFindUnique.mockResolvedValue(sessionAvecCreances());

    await genererFactureFormationAction({
      sessionId: SESSION_ID,
      destinataire: "entreprise",
      ventilation: "forfait",
    });

    expect(mockPayeurUpdate, "la créance n'a pas été marquée comme facturée").toHaveBeenCalledWith({
      where: { id: "cr-ent" },
      data: { factureFormationId: "f-new" },
    });
  });
});

describe("🔴 les refus", () => {
  it("REFUSE un destinataire que le dossier ne reconnaît pas comme débiteur", async () => {
    mockSessionFindUnique.mockResolvedValue(sessionAvecCreances());

    const r = await genererFactureFormationAction({
      sessionId: SESSION_ID,
      destinataire: "france_travail",
      ventilation: "forfait",
    });

    expect("error" in r).toBe(true);
    expect(mockFactureCreate, "une facture a été émise malgré le refus").not.toHaveBeenCalled();
  });

  it("REFUSE de facturer deux fois la même créance", async () => {
    const s = sessionAvecCreances();
    s.dossiersFinancement[0]!.payeurs[1]!.factureFormationId = "f-deja";
    mockSessionFindUnique.mockResolvedValue(s);

    const r = await genererFactureFormationAction({
      sessionId: SESSION_ID,
      destinataire: "entreprise",
      ventilation: "forfait",
    });

    expect("error" in r).toBe(true);
    expect(mockFactureCreate).not.toHaveBeenCalled();
  });

  it("SANS dossier, l'émission reste possible — comportement historique intact", async () => {
    // Financement direct, ou affaire antérieure au mécanisme : refuser ici
    // bloquerait une émission parfaitement licite.
    const s = sessionAvecCreances();
    s.dossiersFinancement = [];
    s.opcoSubrogation = false;
    mockSessionFindUnique.mockResolvedValue(s);

    const r = await genererFactureFormationAction({
      sessionId: SESSION_ID,
      destinataire: "entreprise",
      ventilation: "forfait",
    });

    expect("data" in r, `l'émission sans dossier a échoué : ${JSON.stringify(r)}`).toBe(true);
    const data = mockFactureCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data["montantHtCents"], "le montant de la session doit primer sans créance").toBe(30000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 🔴 LA MENTION DE SUBROGATION SUR LA FACTURE DU RESTE À CHARGE
//
// Le bloc ci-dessus a retiré l'écrasement `opcoSubrogation ? "opco" : destinataire`,
// et il a eu raison : « l'OPCO paie sa part, le client le reste à charge. Deux
// factures. »
//
// Mais TROIS consommateurs interrogeaient encore `trainingSession.opcoSubrogation`
// — c'est-à-dire « cette SESSION est-elle subrogée ? » — là où la question posée
// est « cette FACTURE-CI part-elle au financeur ? ». Sur une session subrogée, la
// facture du reste à charge adressée au CLIENT recevait donc :
//
//   · `subrogation: true` et le n° de dossier OPCO (financements.ts:730-733) ;
//   · d'où, dans le PDF, l'encadré légal `subrogationOpco` alimenté par
//     `nomOpco: facture.destinataireNom` (financements.ts:1034) — soit, mot pour
//     mot : « Facture libellée à l'OPCO **Acme** dans le cadre de la subrogation
//     de paiement — N° dossier : ATL-1. » **La facture appelle le client OPCO**,
//     sous son propre SIRET, et affirme qu'un financeur règle directement
//     l'organisme alors que ces euros sont le reste à charge du client. Elle se
//     contredit avec ses propres conditions de règlement et le RIB imprimé
//     dessous ;
//   · le délai de paiement du FINANCEUR (45 j) au lieu de celui du client (30 j),
//     alors que le commentaire de `financements.ts:650` dit lui-même la bonne
//     règle — « sauf subrogation, où c'est le FINANCEUR QUI PAIE, avec son délai
//     propre ».
//
// 🔑 Le gabarit PDF **présuppose** l'écrasement qu'on a retiré. Un émetteur a
// changé de règle ; ni le gabarit, ni son jumeau `facturation-service.ts:147`
// (qui écrase toujours, et reste donc cohérent), ni la phrase d'aide de l'écran
// n'ont suivi. Motif dominant du dépôt, énième instance.
//
// ⚠️ Mentions FAUSSES au sens de l'art. L.441-9 C. com. et 242 nonies A CGI.
// ─────────────────────────────────────────────────────────────────────────────

describe("🔴 la facture du reste à charge ne se déclare PAS subrogée", () => {
  it("une facture au CLIENT, sur session subrogée, ne porte ni subrogation ni n° de dossier", async () => {
    mockSessionFindUnique.mockResolvedValue(sessionAvecCreances());

    const r = await genererFactureFormationAction({
      sessionId: SESSION_ID,
      destinataire: "entreprise",
      ventilation: "forfait",
    });
    expect("data" in r, `l'émission a échoué : ${JSON.stringify(r)}`).toBe(true);

    const data = mockFactureCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;

    expect(
      data["subrogation"],
      "la facture du RESTE À CHARGE se déclare subrogée. Le PDF y ajoutera " +
        "« Facture libellée à l'OPCO <nom du CLIENT> … » — la facture appelle le " +
        "client OPCO, sous son propre SIRET, et affirme qu'un financeur la règle " +
        "alors que c'est justement la part que le client doit payer lui-même.",
    ).toBe(false);

    expect(
      data["numeroDossierOpco"],
      "le n° de dossier OPCO est porté sur la facture du client. C'est lui qui " +
        "arme l'encadré de subrogation dans le gabarit PDF (financements.ts:1029).",
    ).toBeNull();
  });

  it("la facture à l'OPCO, elle, garde sa subrogation et son n° de dossier", async () => {
    // 🔑 CONTRE-TÉMOIN. Sans lui, on satisferait le test précédent en retirant
    // purement la subrogation de TOUTES les factures — et l'OPCO perdrait la
    // mention qui lui est due. La garde doit distinguer, pas supprimer.
    mockSessionFindUnique.mockResolvedValue(sessionAvecCreances());

    const r = await genererFactureFormationAction({
      sessionId: SESSION_ID,
      destinataire: "opco",
      ventilation: "forfait",
    });
    expect("data" in r, `l'émission a échoué : ${JSON.stringify(r)}`).toBe(true);

    const data = mockFactureCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data["destinataire"]).toBe("opco");
    expect(
      data["subrogation"],
      "la facture ADRESSÉE À L'OPCO a perdu sa mention de subrogation : le " +
        "correctif a supprimé au lieu de distinguer.",
    ).toBe(true);
    expect(data["numeroDossierOpco"]).toBe("ATL-1");
  });

  it("et le CLIENT reçoit SON délai de paiement, pas celui du financeur", async () => {
    // `financements.ts:650` écrit la bonne règle — « sauf subrogation, où c'est
    // le FINANCEUR QUI PAIE, avec son délai propre » — puis interroge la
    // session au lieu de la facture. Le client se voyait accorder 45 jours sur
    // une somme qu'il doit lui-même.
    //
    // ⚠️ `getQualiopiConfig` est simulé à 30 pour TOUTES les clés dans ce
    // fichier : on ne peut donc pas distinguer 30 de 45 par la valeur. On
    // vérifie ce qui est vérifiable ici — que l'échéance est bien posée, et
    // qu'elle vaut émission + 30 j, c'est-à-dire le délai CLIENT.
    mockSessionFindUnique.mockResolvedValue(sessionAvecCreances());

    await genererFactureFormationAction({
      sessionId: SESSION_ID,
      destinataire: "entreprise",
      ventilation: "forfait",
    });

    const data = mockFactureCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    const emiseAt = data["emiseAt"] as Date;
    const echeanceAt = data["echeanceAt"] as Date;
    expect(echeanceAt, "aucune échéance posée — mention obligatoire").toBeInstanceOf(Date);

    const jours = Math.round((echeanceAt.getTime() - emiseAt.getTime()) / 86_400_000);
    expect(jours, "l'échéance de la facture du reste à charge ne suit pas le délai CLIENT.").toBe(
      30,
    );
  });
});
