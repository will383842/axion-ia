/**
 * Scénario FICTIF « Menuiserie Fictive » (aucune donnée réelle) — sert de base
 * aux tests du circuit visio sans réseau : des segments de transcription et
 * une sortie d'extraction (P1) ENREGISTRÉE, cohérente avec eux (citations
 * exactes). Les tests piégés en dérivent des variantes fautives.
 *
 * Date de l'échange : mardi 6 octobre 2026, 10 h (UTC).
 */

import type { SegmentStocke } from "@/server/visio/dialogue";
import type { ExtractionV1, FaitExtrait } from "@/server/visio/schemas/extraction";
import { RUBRIQUES_COUVERTURE } from "@/server/visio/schemas/communs";

export const DATE_ECHANGE = new Date("2026-10-06T10:00:00Z");

const L: ReadonlyArray<[string, "client" | "axion", number, string]> = [
  [
    "S0001",
    "axion",
    4_000,
    "Bonjour Madame, je vous annonce que j'enregistre notre échange pour le compte rendu, êtes-vous d'accord ?",
  ],
  ["S0002", "client", 11_000, "Oui, pas de souci, vous pouvez enregistrer."],
  ["S0003", "axion", 20_000, "Parfait. Combien de personnes voulez-vous former ?"],
  ["S0004", "client", 25_000, "On serait douze commerciaux à former sur l'IA générative."],
  ["S0005", "axion", 40_000, "Et côté budget, vous aviez une idée ?"],
  [
    "S0006",
    "client",
    45_000,
    "On avait prévu autour de trois mille euros hors taxes pour tout ça.",
  ],
  ["S0007", "axion", 60_000, "Donc vous êtes bien douze personnes ?"],
  ["S0008", "client", 65_000, "Oui c'est bien ça, douze personnes au total."],
  ["S0009", "client", 80_000, "Il faudrait que ce soit fait avant le 15 décembre si possible."],
  ["S0010", "axion", 100_000, "Je vous envoie le programme de la formation vendredi."],
  [
    "S0011",
    "client",
    120_000,
    "Aujourd'hui tout est sur Excel et on perd des heures sur les relances clients.",
  ],
];

/** Les segments tels que stockés (texte déchiffré). */
export const SEGMENTS: readonly SegmentStocke[] = L.map(([, piste, debutMs, texte], i) => ({
  ordre: (piste === "client" ? 0 : 10_000_000) + i,
  piste,
  debutMs,
  finMs: debutMs + 4_000,
  locuteurBrut: piste === "client" ? "A" : null,
  texte,
  horsAccord: false,
  apresRefus: false,
}));

const VALEUR_VIDE: FaitExtrait["valeur"] = {
  montant_min_cents: null,
  montant_max_cents: null,
  base_montant: null,
  periode_montant: null,
  date_cible: null,
  precision_date: null,
  expression_temporelle: null,
  quantite: null,
  unite: null,
  ref_catalogue: null,
  texte_court: null,
};

export function fait(
  p: Partial<FaitExtrait> & Pick<FaitExtrait, "ref" | "type" | "enonce" | "preuves">,
): FaitExtrait {
  return {
    cle: "global",
    valeur: VALEUR_VIDE,
    certitude: "dit_explicitement",
    confiance: "haute",
    locuteur_declare: "client",
    confirmation_client: null,
    portee: "projet",
    projet_ref: "J1",
    personne_sujet_ref: null,
    ambiguite: null,
    ...p,
  };
}

export const FAITS: readonly FaitExtrait[] = [
  fait({
    ref: "F01",
    type: "nb_participants",
    enonce: "La gérante veut former 12 commerciaux.",
    valeur: { ...VALEUR_VIDE, quantite: 12, unite: "personnes" },
    preuves: [{ segment_ids: ["S0004"], citation: "On serait douze commerciaux à former" }],
  }),
  fait({
    ref: "F02",
    type: "budget",
    enonce: "Le budget prévu est d'environ 3 000 € HT.",
    valeur: {
      ...VALEUR_VIDE,
      montant_min_cents: 300000,
      montant_max_cents: 300000,
      base_montant: "ht",
      periode_montant: "total",
    },
    preuves: [
      { segment_ids: ["S0006"], citation: "On avait prévu autour de trois mille euros hors taxes" },
    ],
  }),
  fait({
    ref: "F03",
    type: "echeance",
    enonce: "La formation doit avoir lieu avant le 15 décembre.",
    valeur: {
      ...VALEUR_VIDE,
      date_cible: "2026-12-15",
      precision_date: "avant_le",
      expression_temporelle: "avant le 15 décembre",
    },
    preuves: [{ segment_ids: ["S0009"], citation: "que ce soit fait avant le 15 décembre" }],
  }),
  fait({
    ref: "F04",
    type: "engagement_axion",
    cle: "programme",
    enonce: "Williams envoie le programme de la formation vendredi.",
    locuteur_declare: "axion",
    preuves: [
      { segment_ids: ["S0010"], citation: "Je vous envoie le programme de la formation vendredi" },
    ],
  }),
  fait({
    ref: "F05",
    type: "probleme",
    cle: "relances",
    enonce: "L'équipe perd des heures sur les relances clients, tout est sur Excel.",
    preuves: [
      {
        segment_ids: ["S0011"],
        citation: "tout est sur Excel et on perd des heures sur les relances clients",
      },
    ],
  }),
];

function couverture(): ExtractionV1["couverture"] {
  const c = Object.fromEntries(
    RUBRIQUES_COUVERTURE.map((r) => [r, { statut: "non_aborde", faits_refs: [], remarque: null }]),
  ) as unknown as Record<string, { statut: string; faits_refs: string[]; remarque: string | null }>;
  c["perimetre"] = { statut: "aborde", faits_refs: ["F01"], remarque: null };
  c["budget_financement"] = { statut: "aborde", faits_refs: ["F02"], remarque: null };
  c["calendrier"] = { statut: "aborde", faits_refs: ["F03"], remarque: null };
  c["engagements"] = { statut: "aborde", faits_refs: ["F04"], remarque: null };
  c["problemes"] = { statut: "aborde", faits_refs: ["F05"], remarque: null };
  return c as unknown as ExtractionV1["couverture"];
}

export function extraction(
  faits: readonly FaitExtrait[] = FAITS,
  surcharge: Partial<ExtractionV1> = {},
): ExtractionV1 {
  return {
    version_schema: "extraction.v1",
    nature_echange: { nature: "echange_complet", explication: "Rendez-vous diagnostic complet." },
    consentement: {
      segment_ids: ["S0002"],
      citation: "Oui, pas de souci, vous pouvez enregistrer",
    },
    demande_arret_enregistrement: null,
    participants: [
      { etiquette: "AXION", personne_ref: null },
      { etiquette: "CLIENT_1", personne_ref: "P1" },
    ],
    personnes: [],
    projets_evoques: [
      {
        ref: "J1",
        intitule: "Former les commerciaux à l'IA",
        activite: "formation",
        projet_connu_ref: null,
        preuves: [],
      },
    ],
    faits: [...faits],
    suivi_du_connu: [],
    couverture: couverture(),
    passages_ecartes: [],
    ...surcharge,
  };
}
