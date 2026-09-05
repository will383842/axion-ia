/**
 * Les payloads du contrat, construits depuis le PRODUCTEUR RÉEL.
 *
 * REQ-INT-005 (`paiement.recu`), REQ-INT-006 (`devis.signe`), REQ-INT-032 (les payloads
 * manquants + les deux formes de remboursement), REQ-DM-018 (le HT fourni),
 * REQ-DM-039 (`destinataire` + `echeanceFinanceurAt`), REQ-DM-040 (les lignes de devis),
 * REQ-ARG-005 (multi-payeurs, résolution du bénéficiaire), REQ-DM-021 (jamais de silence),
 * REQ-CPL-015 (`source`, `utm`, `campagneId` du transfert candidat).
 *
 * 🔑 CE QUE CE FICHIER NE FAIT PAS, ET C'EST LE POINT. Il ne décrit aucun payload « à la
 * main » : chaque cas part d'une LIGNE au format du modèle Prisma réel, et lit ce que le
 * constructeur de production en fait. Les types d'entrée sont des `Pick<>` des modèles
 * générés — une colonne supprimée dans `schema.prisma` casse la COMPILATION de ce
 * fichier, elle ne le laisse pas passer au vert sur une forme périmée.
 */
import { describe, expect, it } from "vitest";

import { champsInterditsSelonFrontiere } from "../frontiere";
import {
  MOTIFS_REMBOURSEMENT,
  payloadAvoirEmis,
  payloadCandidatureRecue,
  payloadClientCree,
  payloadDevisSigne,
  payloadFactureAnnulee,
  payloadFactureEmise,
  payloadFinancementMisAJour,
  payloadPaiementRecu,
  payloadPaiementRembourse,
  resoudreClientBeneficiaire,
} from "../payloads";

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const FACTURE_ID = "22222222-2222-4222-8222-222222222222";

const clientEntreprise = {
  id: CLIENT_ID,
  numero: "AXI-CLI-001",
  type: "entreprise" as const,
  raisonSociale: "Fournitures Girard SAS",
  siren: "111222333",
  nafCode: "6201Z",
  secteur: "Informatique",
  taille: "pme_10_49" as never,
  createdAt: new Date("2026-01-02T10:00:00.000Z"),
  updatedAt: new Date("2026-01-02T10:00:00.000Z"),
};

const factureBase = {
  id: FACTURE_ID,
  numero: "AXI-FACT-2026-014",
  activite: "formation" as const,
  clientId: CLIENT_ID,
  sessionId: null,
  enrollmentId: null,
  coachingContractId: null,
  dossierFinancementId: null,
  destinataire: "opco" as const,
  destinataireSiret: "99988877700011",
  montantHtCents: 100_000,
  montantTvaCents: 20_000,
  montantTtcCents: 120_000,
  regimeTva: "assujetti",
  subrogation: true,
  avoirDeId: null,
  statut: "emise" as never,
  emiseAt: new Date("2026-03-01T09:00:00.000Z"),
  echeanceAt: new Date("2026-03-31T09:00:00.000Z"),
  paidAt: null,
  createdAt: new Date("2026-03-01T09:00:00.000Z"),
  updatedAt: new Date("2026-03-01T09:00:00.000Z"),
};

describe("REQ-ARG-005 / REQ-DM-021 — la résolution du client BÉNÉFICIAIRE", () => {
  it("prend le client de la FACTURE quand il est là", () => {
    expect(resoudreClientBeneficiaire({ ...factureBase }).clientId).toBe(CLIENT_ID);
  });

  it("remonte la chaîne facture -> session -> enrollment -> dossier, dans CET ordre", () => {
    const parLaSession = resoudreClientBeneficiaire({
      ...factureBase,
      clientId: null,
      session: { clientId: "aaaa1111-1111-4111-8111-111111111111" },
    });
    expect(parLaSession.clientId).toBe("aaaa1111-1111-4111-8111-111111111111");
    expect(parLaSession.origine).toBe("session");

    const parLeDossier = resoudreClientBeneficiaire({
      ...factureBase,
      clientId: null,
      dossierFinancement: { clientId: "dddd4444-4444-4444-8444-444444444444" },
    });
    expect(parLeDossier.origine).toBe("dossier");
  });

  it("🔴 n'utilise JAMAIS `destinataireSiret` — le destinataire n'est pas le bénéficiaire", () => {
    // C'est le cœur de REQ-ARG-005 : sur une facture subrogée, le destinataire est
    // l'OPCO. Commissionner l'OPCO au lieu de l'entreprise formée serait attribuer la
    // vente au FINANCEUR. La facture porte bien un SIRET de destinataire ici, et il ne
    // doit apparaître nulle part dans la résolution.
    const r = resoudreClientBeneficiaire({ ...factureBase, clientId: null });
    expect(r.clientId).toBeNull();
    expect(JSON.stringify(r)).not.toContain("99988877700011");
  });

  it("un bénéficiaire introuvable rend `null` et le DIT — l'événement n'est jamais ignoré", () => {
    // REQ-DM-021 : « jamais un silence ». La résolution rend un verdict explicite que
    // le récepteur transforme en ligne `non_resolue` alertée, pas un rejet muet.
    const r = resoudreClientBeneficiaire({ ...factureBase, clientId: null });
    expect(r.clientId).toBeNull();
    expect(r.origine).toBe("non_resolue");
  });
});

describe("REQ-INT-005 + REQ-DM-018 — `paiement.recu`", () => {
  const paiement = {
    id: "33333333-3333-4333-8333-333333333333",
    factureFormationId: FACTURE_ID,
    provider: "stripe" as never,
    amountCents: 40_000,
    currency: "EUR",
    status: "succeeded" as never,
    type: "deposit" as never,
    paidAt: new Date("2026-03-10T12:00:00.000Z"),
    createdAt: new Date("2026-03-10T12:00:00.000Z"),
  };

  it("porte les ONZE champs que REQ-INT-005 énumère", () => {
    const p = payloadPaiementRecu({
      paiement,
      facture: { ...factureBase, client: clientEntreprise },
      totalEncaisseTtcCents: 40_000,
    });

    for (const champ of [
      "paymentId",
      "factureId",
      "clientId",
      "siren",
      "montantEncaisseTtcCents",
      "factureMontantHtCents",
      "factureMontantTtcCents",
      "regimeTva",
      "totalEncaisseTtcCents",
      "paidAt",
      "provider",
    ]) {
      expect(p, `champ manquant : ${champ}`).toHaveProperty(champ);
    }
  });

  it("REQ-DM-018 — le HT encaissé est FOURNI par axionia, pas laissé à déduire", () => {
    const p = payloadPaiementRecu({
      paiement,
      facture: { ...factureBase, client: clientEntreprise },
      totalEncaisseTtcCents: 40_000,
    });
    expect(p.amountHtCents).toBe(33_333);
  });

  it("le `clientId` est le BÉNÉFICIAIRE, jamais le destinataire de la facture", () => {
    const p = payloadPaiementRecu({
      paiement,
      facture: { ...factureBase, client: clientEntreprise },
      totalEncaisseTtcCents: 40_000,
    });
    expect(p.clientId).toBe(CLIENT_ID);
    expect(p.siren).toBe("111222333");
  });

  it("un paiement SANS facture ne se devine pas : il lève", () => {
    // Un encaissement orphelin ne peut porter ni HT ni bénéficiaire. Fabriquer un
    // payload à trous serait exactement le « helper qui complète » que l'acceptation
    // de la tâche interdit.
    expect(() =>
      payloadPaiementRecu({
        paiement: { ...paiement, factureFormationId: null },
        facture: null,
        totalEncaisseTtcCents: 40_000,
      }),
    ).toThrow(/facture/i);
  });

  it("un paiement sans `paidAt` lève — `occurred_at` ne s'invente pas", () => {
    expect(() =>
      payloadPaiementRecu({
        paiement: { ...paiement, paidAt: null },
        facture: { ...factureBase, client: clientEntreprise },
        totalEncaisseTtcCents: 40_000,
      }),
    ).toThrow(/paidAt/i);
  });
});

describe("REQ-INT-032 — `paiement.rembourse` couvre les DEUX formes, et six motifs", () => {
  it("l'énumération des motifs est celle de l'exigence, mot pour mot", () => {
    expect([...MOTIFS_REMBOURSEMENT]).toEqual([
      "remboursement",
      "avoir",
      "litige_tranche",
      "rejet_prelevement",
      "virement_rappele",
      "autre",
    ]);
  });

  it("FORME 1 — un `Payment` de type `refund` (une ligne neuve, négative)", () => {
    const p = payloadPaiementRembourse({
      paiement: {
        id: "44444444-4444-4444-8444-444444444444",
        factureFormationId: FACTURE_ID,
        provider: "stripe" as never,
        amountCents: 12_000,
        currency: "EUR",
        status: "succeeded" as never,
        type: "refund" as never,
        paidAt: new Date("2026-04-01T09:00:00.000Z"),
        createdAt: new Date("2026-04-01T09:00:00.000Z"),
      },
      facture: { ...factureBase, client: clientEntreprise },
      totalEncaisseTtcCents: 12_000,
      motif: "remboursement",
    });
    expect(p.forme).toBe("payment_type_refund");
    expect(p.montantHtCents).toBe(10_000);
    expect(p.motif).toBe("remboursement");
  });

  it("FORME 2 — un `Payment` existant passé au statut `refunded`", () => {
    // AFF-02 : le remboursement n'est PAS un modèle dans ce dépôt, c'est une valeur
    // d'enum. Il en existe donc exactement deux formes, et pas une de plus.
    const p = payloadPaiementRembourse({
      paiement: {
        id: "55555555-5555-4555-8555-555555555555",
        factureFormationId: FACTURE_ID,
        provider: "stripe" as never,
        amountCents: 12_000,
        currency: "EUR",
        status: "refunded" as never,
        type: "deposit" as never,
        paidAt: new Date("2026-04-01T09:00:00.000Z"),
        createdAt: new Date("2026-04-01T09:00:00.000Z"),
      },
      facture: { ...factureBase, client: clientEntreprise },
      totalEncaisseTtcCents: 12_000,
      motif: "rejet_prelevement",
    });
    expect(p.forme).toBe("payment_status_refunded");
    expect(p.motif).toBe("rejet_prelevement");
  });

  it("🔴 un rejet bancaire EST un remboursement au sens du contrat", () => {
    // REQ-INT-032 : « l'événement couvre TOUTE annulation d'encaissement, pas seulement
    // un remboursement volontaire ; axionia doit donc l'émettre aussi sur un rejet
    // bancaire ou un litige tranché ».
    for (const motif of ["rejet_prelevement", "virement_rappele", "litige_tranche"] as const) {
      expect(MOTIFS_REMBOURSEMENT).toContain(motif);
    }
  });

  it("un motif hors énumération lève — jamais un repli sur « autre »", () => {
    expect(() =>
      payloadPaiementRembourse({
        paiement: {
          id: "66666666-6666-4666-8666-666666666666",
          factureFormationId: FACTURE_ID,
          provider: "stripe" as never,
          amountCents: 1_200,
          currency: "EUR",
          status: "refunded" as never,
          type: "deposit" as never,
          paidAt: new Date("2026-04-01T09:00:00.000Z"),
          createdAt: new Date("2026-04-01T09:00:00.000Z"),
        },
        facture: { ...factureBase, client: clientEntreprise },
        totalEncaisseTtcCents: 1_200,
        motif: "geste_commercial" as never,
      }),
    ).toThrow(/motif/i);
  });
});

describe("REQ-INT-006 + REQ-DM-040 — `devis.signe`", () => {
  const devis = {
    id: "77777777-7777-4777-8777-777777777777",
    numero: "AXI-DEV-2026-009",
    activite: "formation" as const,
    clientId: CLIENT_ID,
    montantTotalHtCents: 500_000,
    statut: "accepte" as never,
    acceptedAt: new Date("2026-02-14T15:00:00.000Z"),
    createdAt: new Date("2026-02-01T15:00:00.000Z"),
    updatedAt: new Date("2026-02-14T15:00:00.000Z"),
    lignes: [
      {
        designation: "Formation IA 2 jours",
        quantite: 2,
        prixUnitaireHtCents: 250_000,
        offreCode: "AXI-OFF-004",
      },
    ],
  };

  it("porte par ligne les quatre champs de REQ-INT-006 et ceux de REQ-DM-040", () => {
    const p = payloadDevisSigne({ devis, client: clientEntreprise });
    const ligne = p.lignes[0];

    expect(ligne).toBeDefined();
    for (const champ of [
      "commissionId",
      "montantHtCents",
      "activite",
      "designation",
      "jours",
      "offreCode",
    ]) {
      expect(ligne, `champ manquant : ${champ}`).toHaveProperty(champ);
    }
  });

  it("🔴 `jours` identifie le palier et n'est JAMAIS un multiplicateur", () => {
    const p = payloadDevisSigne({ devis, client: clientEntreprise });
    const ligne = p.lignes[0];
    expect(ligne?.jours).toBe(2);
    expect(ligne?.commissionId).toBe("com-formation-2j");
    expect(ligne?.commission.montantCents).toBe(100_000); // le forfait du palier, UNE fois
  });

  it("le montant HT de la ligne est celui du devis, pas un produit recalculé de travers", () => {
    const p = payloadDevisSigne({ devis, client: clientEntreprise });
    expect(p.lignes[0]?.montantHtCents).toBe(500_000); // 2 × 250 000
    expect(p.montantTotalHtCents).toBe(500_000);
  });

  it("une ligne hors grille part quand même, en `bloquee` — jamais supprimée du payload", () => {
    const siteWeb = {
      ...devis,
      activite: "site_web" as const,
      lignes: [{ designation: "Site vitrine", quantite: 1, prixUnitaireHtCents: 300_000 }],
    };
    const p = payloadDevisSigne({ devis: siteWeb, client: clientEntreprise });
    expect(p.lignes).toHaveLength(1);
    expect(p.lignes[0]?.commission.statut).toBe("bloquee");
    expect(p.lignes[0]?.commission.motifBlocage).toBe("a_qualifier");
  });

  it("un devis NON signé lève : `devis.signe` n'est pas `devis.envoye`", () => {
    expect(() =>
      payloadDevisSigne({ devis: { ...devis, acceptedAt: null }, client: clientEntreprise }),
    ).toThrow(/sign/i);
  });

  it("une ligne au format inattendu lève — elle n'est pas silencieusement ignorée", () => {
    // `Devis.lignes` est du JSON libre : rien en base ne garantit sa forme. Une ligne
    // sans montant lisible ferait disparaître une commission si on la sautait.
    expect(() =>
      payloadDevisSigne({
        devis: { ...devis, lignes: [{ designation: "???" }] as never },
        client: clientEntreprise,
      }),
    ).toThrow(/ligne/i);
  });
});

describe("REQ-DM-039 — `facture.emise` porte le destinataire et l'échéance financeur", () => {
  it("transporte `destinataire` tel que l'enum d'axionia le définit", () => {
    const p = payloadFactureEmise({
      facture: { ...factureBase, client: clientEntreprise },
      payeurs: [],
      echeanceFinanceurAt: null,
    });
    expect(p.destinataire).toBe("opco");
    expect(p.subrogation).toBe(true);
  });

  it("transporte `echeanceFinanceurAt` pour la ventilation B13", () => {
    const p = payloadFactureEmise({
      facture: { ...factureBase, client: clientEntreprise },
      payeurs: [],
      echeanceFinanceurAt: new Date("2026-05-15T00:00:00.000Z"),
    });
    expect(p.echeanceFinanceurAt).toBe("2026-05-15T00:00:00.000Z");
  });

  it("K-18 — `payers[]` porte la ventilation multi-payeurs", () => {
    const p = payloadFactureEmise({
      facture: { ...factureBase, client: clientEntreprise },
      payeurs: [
        { payeurType: "opco_subroge" as never, montantAttenduCents: 90_000 },
        { payeurType: "entreprise" as never, montantAttenduCents: 30_000 },
      ],
      echeanceFinanceurAt: null,
    });
    expect(p.payers).toHaveLength(2);
    expect(p.payers[0]).toEqual({ payeurType: "opco_subroge", montantAttenduCents: 90_000 });
  });

  it("🔴 aucun NOM de payeur ne traverse : `payeurNom` reste côté axionia", () => {
    // `DossierPayeur.payeurNom` existe en base. C'est le nom d'une personne morale, mais
    // la frontière de REQ-INT-029 échoue FERMÉ sur tout ce qui ressemble à une identité :
    // la ventilation a besoin du TYPE et du MONTANT, pas d'un nom.
    const p = payloadFactureEmise({
      facture: { ...factureBase, client: clientEntreprise },
      payeurs: [{ payeurType: "opco_subroge" as never, montantAttenduCents: 90_000 }],
      echeanceFinanceurAt: null,
    });
    expect(JSON.stringify(p)).not.toMatch(/payeurNom/);
  });

  it("le HT, le TTC et le régime voyagent ensemble — Partners n'infère aucun taux", () => {
    const p = payloadFactureEmise({
      facture: { ...factureBase, client: clientEntreprise },
      payeurs: [],
      echeanceFinanceurAt: null,
    });
    expect(p.montantHtCents).toBe(100_000);
    expect(p.montantTtcCents).toBe(120_000);
    expect(p.regimeTva).toBe("assujetti");
  });
});

describe("`avoir.emis` et `facture.annulee`", () => {
  it("un avoir DÉCLARE la facture qu'il rectifie", () => {
    const p = payloadAvoirEmis({
      avoir: {
        ...factureBase,
        id: "88888888-8888-4888-8888-888888888888",
        numero: "AXI-AV-2026-003",
        avoirDeId: FACTURE_ID,
        montantHtCents: -40_000,
        montantTvaCents: -8_000,
        montantTtcCents: -48_000,
        client: clientEntreprise,
      },
    });
    expect(p.avoirDeFactureId).toBe(FACTURE_ID);
    expect(p.montantHtCents).toBe(-40_000);
  });

  it("une facture sans `avoirDeId` n'est PAS un avoir : elle lève", () => {
    expect(() => payloadAvoirEmis({ avoir: { ...factureBase, client: clientEntreprise } })).toThrow(
      /avoir/i,
    );
  });

  it("REQ-INT-032 — `facture.annulee` porte `{factureId, motif}`", () => {
    const p = payloadFactureAnnulee({
      facture: { ...factureBase, client: clientEntreprise },
      motif: "doublon",
    });
    expect(p).toMatchObject({ factureId: FACTURE_ID, motif: "doublon" });
  });
});

describe("REQ-INT-032 — `financement.mis_a_jour` porte `{factureId, payers[], echeanceFinanceurAt}`", () => {
  it("porte exactement ces trois clés", () => {
    const p = payloadFinancementMisAJour({
      factureId: FACTURE_ID,
      payeurs: [{ payeurType: "france_travail" as never, montantAttenduCents: 50_000 }],
      echeanceFinanceurAt: new Date("2026-06-01T00:00:00.000Z"),
    });
    expect(Object.keys(p).sort()).toEqual(["echeanceFinanceurAt", "factureId", "payers"]);
  });
});

describe("REQ-INT-032 + REQ-CPL-015 — `candidature.recue`", () => {
  const details = {
    unifiedType: "recrutement",
    subType: "candidature-commerciale",
    score: 72,
    scorePriorite: "haute",
    scoreParts: {
      carnet: 25,
      b2bAnnees: 25,
      statut: 12,
      typesClients: 10,
      deplacement: 0,
      ia: 0,
      informatique: 0,
      zone: 0,
    },
    source: "/devenir-commercial-ia/candidature",
    funnel: { utm: { utm_source: "linkedin", utm_campaign: "apporteurs-q1" } },
    candidature: { version: 1, ville: "Grenoble", codePostal: "38000", pitch: "…" },
  };

  // 🔑 `submittedAt`, PAS `createdAt` : le modèle `Submission` ne porte AUCUNE colonne
  // `createdAt` (vérifié dans `schema.prisma` le 2026-09-05). Cette fixture disait
  // `createdAt` — elle décrivait ce que son auteur croyait du producteur, pas le
  // producteur. Le `Pick<Submission, …>` de `payloads.ts` fait désormais rougir `tsc`
  // sur cette confusion, ce qu'aucun test à l'exécution n'aurait attrapé.
  const submission = {
    id: "99999999-9999-4999-8999-999999999999",
    type: "contact" as never,
    submittedAt: new Date("2026-08-20T08:30:00.000Z"),
    details,
  };

  it("porte le score, ses PARTS et le canal — la note reste explicable chez le récepteur", () => {
    const p = payloadCandidatureRecue({ submission });
    expect(p.candidatureId).toBe(submission.id);
    expect(p.scoreInitial).toBe(72);
    expect(p.scorePartsJson).toEqual(details.scoreParts);
    expect(p.sourceCanal).toBe("/devenir-commercial-ia/candidature");
    expect(p.utm).toEqual({ utm_source: "linkedin", utm_campaign: "apporteurs-q1" });
  });

  it("🔴 `campagneId` est `null` : AUCUN producteur n'existe dans axionia", () => {
    // REQ-CPL-015 exige `campagneId` et un modèle `CampagneRecrutement {canal, coût,
    // période}`. Mesuré le 2026-09-05 : ce modèle n'existe pas dans `schema.prisma`, et
    // la chaîne « campagne » n'apparaît nulle part dans `src/`. Le champ est donc
    // explicitement NUL, jamais rempli avec `utm_campaign` — qui est une étiquette
    // publicitaire déclarative, pas l'identifiant d'une campagne budgétée. Les
    // confondre rendrait le « € / actif » de l'exigence faux sans que rien ne le dise.
    expect(payloadCandidatureRecue({ submission }).campagneId).toBeNull();
  });

  it("🔴 `parrainCodeCapture` est `null` : aucun producteur non plus", () => {
    expect(payloadCandidatureRecue({ submission }).parrainCodeCapture).toBeNull();
  });

  it("`scoreBaremeVersion` est DÉRIVÉ des poids du barème, pas un numéro tapé", () => {
    expect(payloadCandidatureRecue({ submission }).scoreBaremeVersion).toMatch(/^[0-9a-f]{12}$/);
  });

  it("🔴 AUCUNE donnée personnelle ne traverse : ni nom, ni e-mail, ni téléphone", () => {
    const p = payloadCandidatureRecue({ submission });
    const serialise = JSON.stringify(p);
    expect(serialise).not.toMatch(/@/);
    expect(champsInterditsSelonFrontiere("candidature.recue", p)).toEqual([]);
  });

  it("une submission qui n'est PAS une candidature commerciale lève", () => {
    expect(() =>
      payloadCandidatureRecue({
        submission: { ...submission, details: { unifiedType: "contact" } },
      }),
    ).toThrow(/candidature/i);
  });

  it("un score ABSENT lève — il n'est pas remplacé par 0", () => {
    // Un score à zéro se lit « candidat sans aucun atout » et l'envoie au vivier. Un
    // score absent veut dire « on ne sait pas ». Les confondre trie un vrai candidat
    // dans la mauvaise file, en silence.
    const sansScore = { ...details } as Record<string, unknown>;
    delete sansScore.score;
    expect(() =>
      payloadCandidatureRecue({ submission: { ...submission, details: sansScore } }),
    ).toThrow(/score/i);
  });
});

describe("REQ-INT-029 — la frontière tient sur les payloads RÉELS", () => {
  it("`client.cree` ne porte AUCUN montant : la phase d'avant-signature n'en a pas", () => {
    const p = payloadClientCree({ client: clientEntreprise });
    expect(champsInterditsSelonFrontiere("client.cree", p)).toEqual([]);
    expect(JSON.stringify(p)).not.toMatch(/[Cc]ents/);
  });

  it("🔴 la raison sociale d'un PARTICULIER ne traverse pas : c'est un nom de personne", () => {
    // `schema.prisma` l'écrit : « Pour un particulier, raisonSociale = "Prénom Nom" ».
    // Le champ n'est donc pas une donnée d'entreprise selon la ligne, mais selon le
    // TYPE de la ligne. Émettre sans regarder `type` ferait traverser une identité.
    const particulier = {
      ...clientEntreprise,
      type: "particulier" as const,
      raisonSociale: "Jean Dupont",
    };
    const p = payloadClientCree({ client: particulier });
    expect(JSON.stringify(p)).not.toContain("Jean Dupont");
    expect(p.raisonSociale).toBeNull();
  });

  it("la raison sociale d'une ENTREPRISE traverse — sinon le récepteur ne sait rien afficher", () => {
    // Témoin positif : sans lui, on aurait pu tout couper et croire la frontière tenue.
    expect(payloadClientCree({ client: clientEntreprise }).raisonSociale).toBe(
      "Fournitures Girard SAS",
    );
  });

  it("le détecteur de frontière SAIT rougir sur un payload fautif", () => {
    // Contre-témoin du détecteur lui-même. Une garde qu'on n'a pas vue refuser n'est
    // qu'une intention.
    expect(
      champsInterditsSelonFrontiere("client.cree", { contacts: ["jean.dupont@exemple.fr"] }),
    ).not.toEqual([]);
    expect(champsInterditsSelonFrontiere("client.cree", { montantHtCents: 1 })).not.toEqual([]);
  });
});
