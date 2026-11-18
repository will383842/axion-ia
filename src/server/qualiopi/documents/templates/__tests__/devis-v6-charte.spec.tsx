// @vitest-environment node

/**
 * Devis v6 (charte 2027) — mise en page et libellés nouveaux, SANS rien changer de ce qui
 * engage : les montants et les phrases juridiques sont ceux de la v5 archivée.
 *
 * Ce fichier compare la v6 courante à la v5 archivée (`archives/devis.v5.tsx`) sur trois
 * devis : classique, classique avec conditions particulières, à formules.
 */

import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/r2-storage", () => ({
  getSignedUrlR2: vi.fn(),
  isR2Configured: () => false,
  uploadToR2: vi.fn(),
}));

import { collectPdfTextNormalized } from "../../collect-pdf-text";
import { registerPdfTestFontsFallback } from "../../register-pdf-test-fonts";
import { DevisPdf, type DevisData } from "../devis";
import { DevisPdf as DevisPdfV5 } from "../archives/devis.v5";
import { offreFictive } from "@/server/qualiopi/devis/offre-fixtures.spec-util";
import { vueFormules } from "@/server/qualiopi/devis/vue-formules";
import { mentionTva } from "@/server/qualiopi/legal/tva";
import type { OrganismeIdentite } from "../../organisme";

beforeAll(() => {
  registerPdfTestFontsFallback();
});

const IDENTITE: OrganismeIdentite = {
  raisonSociale: "Axion-IA SAS",
  nda: "84421234567",
  qualiopi: "",
  siret: "12345678901234",
  adresseSiege: "1 rue de la Paix, 42000 Saint-Étienne",
  adresseExercice: "1 rue de la Paix, 42000 Saint-Étienne",
  email: "contact@axion-ia.com",
  telephone: "",
  site: "https://www.axion-ia.com",
};

const BASE: DevisData = {
  numero: "AXI-DEV-2026-014",
  dateEmission: "05/11/2026",
  dateValidite: "05/12/2026",
  identite: IDENTITE,
  client: {
    raisonSociale: "SCI Invest Sun",
    siret: "98765432100011",
    adresse: "10 avenue du Client",
  },
  lignes: [
    { designation: "Atelier IA — 2 jours", quantite: 1, prixUnitaireHtCents: 280000 },
    { designation: "Audit de maturité IA", quantite: 2, prixUnitaireHtCents: 90000 },
  ],
  regimeTva: "assujetti",
  tauxTvaStandardPercent: 20,
};

const offre = () => {
  const o = offreFictive();
  o.achat!.phases = [
    { rang: 1, libelle: "Acompte", pourcentage: 30, declencheur: "signature" },
    { rang: 2, libelle: "Solde", pourcentage: 70, declencheur: "livraison" },
  ];
  o.achat!.lignes = [{ libelle: "Ligne A", quantite: 1, prixHtCents: 100000, tauxTvaBps: 2000 }];
  o.abonnement!.preavisMois = 2;
  o.abonnement!.engagementMois = 12;
  o.servicesTiers = [
    { nom: "Serveur dédié", obligatoire: true, estimationHtCents: 1500, rythme: "mensuel" },
  ];
  o.plafondAConfirmer = { montantHtCents: 50000, texte: "Frais d'infrastructure" };
  return o;
};

const CONDITIONS = {
  conditionsParticulieres:
    "Les ateliers ont lieu chez le client.\n\nLe client fournit un accès réseau.",
  phrasePrimaute: "En cas de contradiction, les conditions particulières priment sur les CGV.",
};

const CAS: ReadonlyArray<readonly [string, DevisData]> = [
  ["classique", BASE],
  ["classique avec conditions particulières", { ...BASE, ...CONDITIONS }],
  ["formules", { ...BASE, lignes: [], formules: vueFormules(offre()) }],
];

const texteV6 = (d: DevisData) =>
  collectPdfTextNormalized(React.createElement(DevisPdf, { data: d }));
const texteV5 = (d: DevisData) =>
  collectPdfTextNormalized(React.createElement(DevisPdfV5, { data: d }));

/** Tous les montants en euros d'un texte, triés (multi-ensemble). */
function montants(t: string): string[] {
  return (t.match(/\d[\d\s]*,\d{2}\s*€/g) ?? []).map((m) => m.replace(/\s+/g, "")).sort();
}

describe("v6 — les montants sont ceux de la v5", () => {
  for (const [nom, data] of CAS) {
    it(`${nom} : mêmes montants, mêmes occurrences`, () => {
      const v5 = montants(texteV5(data));
      const v6 = montants(texteV6(data));
      expect(v5.length).toBeGreaterThan(3);
      expect(v6).toEqual(v5);
    });
  }

  it("le Total TTC en grand est le même nombre que la ligne : 5 520,00 € une seule fois", () => {
    const t = texteV6(BASE);
    // 2 800 + 2 × 900 = 4 600 HT ; TVA 920 ; TTC 5 520.
    expect(montants(t).filter((m) => m === "5520,00€")).toHaveLength(1);
    expect(t).toContain("Total TTC");
  });
});

describe("v6 — montants identiques à la v5 : cas limites (audit argent-données)", () => {
  /** Même nombre d'apparitions de chaque montant, v5 contre v6. */
  const memesMontants = (data: DevisData) => {
    const v5 = montants(texteV5(data));
    const v6 = montants(texteV6(data));
    expect(v5.length).toBeGreaterThan(0);
    expect(v6).toEqual(v5);
    return { v5: texteV5(data), v6: texteV6(data) };
  };

  it("plusieurs taux de TVA : même ventilation « base … » en v5 et en v6", () => {
    const data: DevisData = {
      ...BASE,
      lignes: [
        { designation: "Atelier", quantite: 1, prixUnitaireHtCents: 100000, tauxTvaPercent: 20 },
        { designation: "Support", quantite: 3, prixUnitaireHtCents: 5000, tauxTvaPercent: 5.5 },
        { designation: "Livre", quantite: 2, prixUnitaireHtCents: 2000, tauxTvaPercent: 10 },
      ],
    };
    const { v5, v6 } = memesMontants(data);
    for (const t of [v5, v6]) {
      expect(t).toContain("TVA 20 % (base 1 000,00 €)");
      expect(t).toContain("TVA 5.5 % (base 150,00 €)");
      expect(t).toContain("TVA 10 % (base 40,00 €)");
    }
    expect(v6.split("(base ").length).toBe(v5.split("(base ").length);
  });

  for (const regime of ["exoneration_261", "franchise_293b"] as const) {
    it(`régime ${regime} : mêmes montants, même mention de TVA, aucune ligne de TVA chiffrée`, () => {
      const data: DevisData = { ...BASE, regimeTva: regime };
      const { v5, v6 } = memesMontants(data);
      const mention = (mentionTva(regime) ?? "").replace(/\s+/g, " ");
      expect(mention).not.toBe("");
      expect(v5).toContain(mention);
      expect(v6).toContain(mention);
      expect(v6.split(mention).length).toBe(v5.split(mention).length);
      // 2 800 + 2 × 900 = 4 600 € : HT = TTC.
      expect(montants(v6).filter((m) => m === "4600,00€").length).toBe(
        montants(v5).filter((m) => m === "4600,00€").length,
      );
    });
  }

  it("arrondi limite : 3 × 3,33 € à 20 % (9,99 HT, TVA 2,00, TTC 11,99)", () => {
    const data: DevisData = {
      ...BASE,
      lignes: [{ designation: "Fascicule", quantite: 3, prixUnitaireHtCents: 333 }],
    };
    const { v6 } = memesMontants(data);
    expect(v6).toContain("Total TTC");
    expect(montants(v6)).toContain("9,99€");
  });

  it("montant à 0 € : même rendu des montants en v5 et en v6", () => {
    const data: DevisData = {
      ...BASE,
      lignes: [{ designation: "Séance offerte", quantite: 1, prixUnitaireHtCents: 0 }],
    };
    const { v6 } = memesMontants(data);
    expect(montants(v6)).toContain("0,00€");
  });
});

describe("v6 — les phrases qui engagent sont reprises MOT POUR MOT", () => {
  const CGV = (site: string, opposabilite: boolean) =>
    `L'acceptation du présent devis emporte acceptation des Conditions générales de vente d'Axion-IA SAS, consultables sur ${site}/conditions-generales et communiquées sur simple demande.` +
    (opposabilite
      ? " Elles prévalent sur toutes conditions d'achat du client, sauf dérogation écrite et signée des deux parties."
      : "");
  const COMMUNES = [
    "Conditions du devis",
    "Devis gratuit, valable jusqu'au 05/12/2026. Au-delà de cette date, les conditions (tarifs, disponibilités) sont susceptibles d'être révisées.",
    CGV("https://www.axion-ia.com", true),
    "Situation de handicap : notre référent handicap étudie avec vous, avant la formation, les adaptations possibles (supports, rythme, accès, modalités). Contact : handicap@axion-ia.com.",
    "Bon pour accord",
    "Le client accepte le présent devis dans son intégralité : désignations, quantités, prix unitaires, taux de TVA et totaux ci-dessus, ainsi que les Conditions générales de vente rappelées ci-dessus, dont il reconnaît avoir pris connaissance.",
    "Pour le client",
    "Pour l'organisme",
    "Nom, qualité, signature — précédée de la mention « Bon pour accord »",
    "Nom, qualité, signature et cachet",
    "Total HT",
    "Total TTC",
    "Axion-IA SAS — 1 rue de la Paix, 42000 Saint-Étienne",
    "SIRET 12345678901234  ·  NDA 84421234567",
    "contact@axion-ia.com  ·  https://www.axion-ia.com",
  ];

  const verifie = (nom: string, data: DevisData, phrases: string[]) => {
    it(nom, () => {
      const v5 = texteV5(data);
      const v6 = texteV6(data);
      for (const p of phrases) {
        const attendu = p.replace(/\s+/g, " ");
        expect(v5, `absente de la v5 (liste fausse) : ${p}`).toContain(attendu);
        expect(v6, `changée en v6 : ${p}`).toContain(attendu);
      }
    });
  };

  verifie("devis classique assujetti", BASE, [...COMMUNES, "TVA (20 %)"]);
  verifie("exonération 261-4-4°", { ...BASE, regimeTva: "exoneration_261" }, [
    ...COMMUNES,
    mentionTva("exoneration_261") ?? "",
  ]);
  verifie("franchise 293 B", { ...BASE, regimeTva: "franchise_293b" }, [
    ...COMMUNES,
    mentionTva("franchise_293b") ?? "",
  ]);
  verifie(
    "personne physique : pas de clause d'opposabilité",
    { ...BASE, client: { ...BASE.client, estPersonnePhysique: true } },
    [CGV("https://www.axion-ia.com", false)],
  );
  verifie(
    "sans site : renvoi sur simple demande",
    { ...BASE, identite: { ...IDENTITE, site: "" } },
    [
      "L'acceptation du présent devis emporte acceptation des Conditions générales de vente, communiquées sur simple demande. Elles prévalent sur toutes conditions d'achat du client, sauf dérogation écrite et signée des deux parties.",
    ],
  );
  verifie("conditions particulières", { ...BASE, ...CONDITIONS }, [
    "Conditions particulières",
    "Les ateliers ont lieu chez le client.",
    "Le client fournit un accès réseau.",
    CONDITIONS.phrasePrimaute,
    "Le client accepte le présent devis dans son intégralité : désignations, quantités, prix unitaires, taux de TVA et totaux ci-dessus, les conditions particulières ainsi que les Conditions générales de vente rappelées ci-dessus, dont il reconnaît avoir pris connaissance.",
  ]);
  verifie(
    "estimation de financement",
    {
      ...BASE,
      montantOpcoEstimeCents: 100000,
      resteAChargeCents: 80000,
      financementSuggere: "OPCO",
    },
    [
      "Estimation de financement",
      "Financement suggéré : OPCO. Prise en charge estimée : 1 000,00 €. Reste à charge estimé : 800,00 €. Estimation indicative, non contractuelle — sous réserve de l'accord de prise en charge du financeur.",
    ],
  );
  verifie("formules : garantie, services tiers, engagement, préavis, indemnité", CAS[2]![1], [
    ...COMMUNES.slice(0, 5),
    "Garantie",
    "Corrections gratuites pendant 30 jours après la livraison.",
    "Services tiers et frais d'infrastructure (hors total, réglés à leurs fournisseurs)",
    "Serveur dédié — obligatoire, mensuel",
    "Engagement",
    "Préavis de résiliation",
    "Indemnité de sortie anticipée (maximum)",
    "Total HT",
    "TVA",
    "Total TTC",
  ]);
  verifie(
    "formule retenue par le client",
    {
      ...CAS[2]![1],
      choixRetenu: {
        formuleLibelle: "Formule B · Mise en place + abonnement",
        automatisations: ["Automatisation un"],
        totalPonctuelHtLisible: "300,00 €",
        totalPonctuelTtcLisible: "360,00 €",
        recurrent: ["Abonnement : 90,00 € HT / mois"],
        empreinteChoix: "ab".repeat(32),
      } as never,
    },
    [
      "Formule retenue par le client",
      "Formule B · Mise en place + abonnement",
      "Automatisations retenues : Automatisation un",
      "Total ponctuel : 300,00 € HT — 360,00 € TTC",
      "Abonnement : 90,00 € HT / mois",
      "Choix scellé avec la signature du client - empreinte " + "ab".repeat(32),
    ],
  );
});

describe("v6 — libellés simplifiés (sens inchangé)", () => {
  it("les nouveaux libellés sont là, les anciens ont disparu", () => {
    const t = texteV6({ ...BASE, refClient: "BC-1", activiteLabel: "Formation" });
    for (const l of [
      "Votre devis",
      "Numéro du devis",
      "Établi le",
      "Valable jusqu'au",
      "Votre référence",
      "Type de prestation",
      "Proposé par",
      "Société",
      "Adresse",
      "SIRET",
      "N° de déclaration d'activité",
      "Pour",
      "Ce que nous ferons pour vous",
      "Prestation",
      "Quantité",
      "Prix unitaire HT",
    ]) {
      expect(t, l).toContain(l);
    }
    for (const ancien of [
      "Informations du devis",
      "N° de devis",
      "Date d'émission",
      "Référence client / commande",
      "Émetteur",
      "Raison sociale",
      "Adresse du siège",
      "SIRET de l'organisme",
      "Détail des prestations",
      "Désignation",
      "Qté",
      "P.U. HT",
    ]) {
      expect(t, ancien).not.toContain(ancien);
    }
  });

  it("formules : libellés simplifiés", () => {
    const t = texteV6(CAS[2]![1]);
    for (const l of [
      "Nos formules au choix",
      "Ce qui est compris",
      "En option (en plus du total)",
      "Calendrier de paiement, hors abonnement (HT)",
      "Prix par mois",
    ]) {
      expect(t, l).toContain(l);
    }
    for (const ancien of [
      "Nos formules, côte à côte",
      "Options (non comprises dans le total)",
      "Paiement de la partie ponctuelle (HT)",
      "Mensualité",
      "Informations complémentaires",
    ]) {
      expect(t, ancien).not.toContain(ancien);
    }
  });
});

describe("v6 — ESSAI, COPIE et SPÉCIMEN", () => {
  const occ = (t: string, f: string) => t.split(f).length - 1;

  it("ESSAI : détecté au numéro, comme en v5 (mêmes bandeaux, mêmes occurrences)", () => {
    const d = { ...BASE, numero: "AXI-DEV-ESSAI-2026-001" };
    const v6 = texteV6(d);
    expect(v6).toContain("ESSAI — pièce sans valeur");
    expect(v6).toContain(
      "Pièce d'une session d'essai interne : numéro hors suite légale, jamais remise à un client ou un auditeur comme pièce réelle.",
    );
    // numéro (en-tête, tuile) + filigrane + titre du bandeau : le nombre est celui de la v5 + 1
    // (le numéro apparaît aussi dans la tuile « Numéro du devis »).
    expect(occ(v6, "ESSAI")).toBe(occ(texteV5(d), "ESSAI"));
    expect(occ(v6, "ESSAI — pièce sans valeur")).toBe(1);
  });

  it("COPIE : un seul filigrane quand estCopie, aucun sinon", () => {
    expect(occ(texteV6({ ...BASE, estCopie: true }), "COPIE")).toBe(1);
    expect(texteV6(BASE)).not.toContain("COPIE");
    expect(occ(texteV5({ ...BASE, estCopie: true }), "COPIE")).toBe(1);
  });

  it("SPÉCIMEN : le devis n'en imprime jamais (comme la v5)", () => {
    expect(texteV5(BASE)).not.toContain("SPÉCIMEN");
    expect(texteV6(BASE)).not.toContain("SPÉCIMEN");
  });
});

describe("v6 — aucun mot interdit", () => {
  const INTERDITS = ["certification", "conforme ai act", "conforme à l'ai act", "label"];

  for (const [nom, data] of CAS) {
    it(`${nom} : ni certification, ni Qualiopi ajouté, ni « conforme AI Act »`, () => {
      const t = texteV6(data).toLowerCase();
      for (const mot of INTERDITS) expect(t, mot).not.toContain(mot);
      // Identité sans numéro Qualiopi : le mot ne doit apparaître nulle part dans le texte visible.
      expect(t).not.toContain("qualiopi");
    });
  }

  it("avec un numéro Qualiopi saisi, il n'est jamais PLUS imprimé qu'en v5 (l'en-tête allégé le répète moins)", () => {
    const d = { ...BASE, identite: { ...IDENTITE, qualiopi: "FR-2024-001" } };
    const dedans = (t: string) => t.split("Qualiopi").length - 1;
    expect(dedans(texteV6(d))).toBeGreaterThanOrEqual(1);
    expect(dedans(texteV6(d))).toBeLessThanOrEqual(dedans(texteV5(d)));
  });
});

describe("v6 — un nombre de pages raisonnable", () => {
  const pages = (buf: Buffer) =>
    (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;

  for (const [nom, data] of CAS) {
    it(`${nom} : au plus 3 pages, et pas plus que la v5 + 1`, async () => {
      const v6 = pages(await renderToBuffer(<DevisPdf data={data} />));
      const v5 = pages(await renderToBuffer(<DevisPdfV5 data={data} />));
      expect(v6).toBeGreaterThanOrEqual(1);
      expect(v6).toBeLessThanOrEqual(3);
      expect(v6).toBeLessThanOrEqual(v5 + 1);
    }, 60_000);
  }
});
