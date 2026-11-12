/**
 * Jeux d'essai de l'assistant (fiche E01) : les cas T1 à T6 de DECISIONS-D1-D2-ARCHITECTE §4,
 * en SAISIES (chaînes d'euros). Aucun résultat chiffré ici : les montants attendus vivent dans
 * les tests de calcul et de conversion. Le serveur (C3) prouve son schéma miroir avec ce fichier.
 */
import { etatInitial, ligneVide, reducteur } from "./etat";
import type { EtatAssistant, PhaseAssistant } from "./types";

const PARAMS = { validiteParDefaut: "2026-12-08", formulesActives: true } as const;

/** Lignes L de l'étape 1 (T1, T3, T5). */
export const LIGNES_L: EtatAssistant["lignes"] = [
  {
    ...ligneVide("l1", "automatisation"),
    libelle: "Assistant de réponse",
    quantite: "1",
    prixEur: "2400",
  },
  {
    ...ligneVide("l2", "automatisation"),
    libelle: "Relance des factures",
    quantite: "1",
    prixEur: "1800",
  },
  { ...ligneVide("l3", "formation"), libelle: "Formation", quantite: "2.3", prixEur: "123,45" },
];

const phase = (id: string, pourcentage: string, libelle = `Phase ${id}`): PhaseAssistant => ({
  id,
  libelle,
  pourcentage,
  declencheur: "signature",
  livrable: "",
  delaiSemaines: "",
});

function base(modele: EtatAssistant["modele"]): EtatAssistant {
  return reducteur(
    reducteur(etatInitial(PARAMS), { type: "client", id: "client-test", clientType: "entreprise" }),
    { type: "modele", modele },
  );
}

/** T1 : A seule, phases 30/30/40, maintenance 190 €/mois facultative, périodes 1 et 12. */
export function etatT1(): EtatAssistant {
  const e = reducteur(base("implementation"), {
    type: "champs",
    patch: { intitule: "Assistant IA", proposition: "A", lignes: LIGNES_L },
  });
  return reducteur(e, {
    type: "achat",
    patch: {
      phases: [phase("a1", "30"), phase("a2", "30"), phase("a3", "40")],
      maintenance: {
        regle: "facultative",
        mensuelEur: "190",
        periodes: [1, 12],
        dureeMinimale: "",
        moisOfferts: "0",
      },
    },
  });
}

/** T2 : B seule, mise en service = 1 ligne de 1 900 €, phases 50/50, mensuel 199,99 €. */
export function etatT2(): EtatAssistant {
  const e = reducteur(base("implementation"), {
    type: "champs",
    patch: {
      intitule: "Abonnement IA",
      proposition: "B",
      lignes: [
        { ...ligneVide("l1", "automatisation"), libelle: "Mise en service", prixEur: "1900" },
      ],
    },
  });
  return reducteur(e, {
    type: "abonnement",
    patch: {
      phases: [phase("b1", "50"), phase("b2", "50")],
      mensuelCatalogueEur: "199,99",
      periodes: [
        { mois: 1, remisePct: "0" },
        { mois: 12, remisePct: "5" },
      ],
      engagementMois: 12,
      indemniteTauxPct: "50",
    },
  });
}

/** T3 : A + B. A = T1 ; B = mise en service saisie « 1 900 » + paramètres de T2. */
export function etatT3(): EtatAssistant {
  const a = etatT1();
  const b = etatT2();
  return reducteur(reducteur(a, { type: "proposer", proposition: "AB" }), {
    type: "abonnement",
    patch: { ...b.abonnement, miseEnServiceSaisie: "1 900" },
  });
}

/** T4 : prix unique (formation) : 3 lignes 1 × 10,03 € + 1 ligne 2,3 × 123,45 €. */
export function etatT4(): EtatAssistant {
  return reducteur(base("formation"), {
    type: "champs",
    patch: {
      intitule: "Formation IA",
      proposition: "prix_unique",
      lignes: [
        ...["a", "b", "c"].map((k) => ({
          ...ligneVide(`p-${k}`, "formation"),
          libelle: `Module ${k}`,
          prixEur: "10,03",
        })),
        {
          ...ligneVide("p-d", "formation"),
          libelle: "Formation",
          quantite: "2.3",
          prixEur: "123,45",
        },
      ],
    },
  });
}

/** T5 : T3 puis passage en B seule (« 1 900 » reste dans le brouillon). */
export function etatT5(): EtatAssistant {
  return reducteur(etatT3(), { type: "proposer", proposition: "B" });
}

/** T6 : saisies d'euros. `cents` = attendu, `null` = refusé avec message. */
export const SAISIES_EUROS: ReadonlyArray<{ saisie: string; cents: number | null }> = [
  { saisie: "2 400", cents: 240000 },
  { saisie: "2 400", cents: 240000 },
  { saisie: "2 400", cents: 240000 },
  { saisie: "1 190,50", cents: 119050 },
  { saisie: "2.400", cents: null },
  { saisie: "1 190,505", cents: null },
  { saisie: "-5", cents: null },
  { saisie: "12 €", cents: null }, // price-exempt: saisie invalide du cas T6, pas un prix
];

export const FIXTURES = { T1: etatT1, T2: etatT2, T3: etatT3, T4: etatT4, T5: etatT5 } as const;
