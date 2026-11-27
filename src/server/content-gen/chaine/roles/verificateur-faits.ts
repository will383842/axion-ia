/**
 * R6 · Vérificateur de faits (conception § 3 ; PR C9). Modèle : Sonnet + web.
 *
 * Reprend CHAQUE affirmation vérifiable du texte final (chiffre, année, texte de loi) et la
 * rapproche du dossier de preuves, puis, si absente, de la source rouverte. « En cas de doute,
 * a_retirer ». Le modèle remplit le tableau ; le CODE :
 *  - extrait lui-même les phrases vérifiables : une phrase chiffrée que le modèle n'a pas
 *    examinée est À RETIRER (fail-closed) ;
 *  - rétrograde tout « confirme » dont la source n'est ni au dossier ni lue par l'outil, ou dont
 *    l'extrait est introuvable dans la source ;
 *  - teste les liens sortants (réponse 200, pas de redirection vers un autre domaine) ; une erreur
 *    de test = lien mort. Les liens internes ne sont pas testés.
 * Toute affirmation non confirmée retourne en réécriture ciblée (corrections localisées).
 * L'appel au modèle et le test de lien sont injectés : aucune entrée-sortie ici.
 */

import { z } from "zod";
import type { FaitSource } from "./collecteur-faits";
import {
  CONSIGNE_DONNEES,
  appelerRole,
  encadrerDonnees,
  lireJson,
  type AppelModele,
  type CompteurCout,
  type Correction,
} from "./commun";
import { nombresDe } from "./redacteur";
import { normaliserTitre } from "./structure-hn";

export const PLAFOND_RECHERCHES_VERIFICATION = 6;
export const MAX_LECTURES_VERIFICATION = 6;

export type CodeRefusVerif = "fait_non_source" | "chiffre_retire" | "lien_mort";

export interface ResultatLien {
  readonly statut: number;
  readonly urlFinale: string;
}

export interface EntreeVerification {
  readonly directAnswer: string;
  readonly bodyHtml: string;
  readonly faq: ReadonlyArray<{ readonly question: string; readonly answer: string }>;
  readonly faits: ReadonlyArray<FaitSource>;
  /** Suit les redirections et rend le statut final et l'URL finale ; lève en cas d'erreur réseau. */
  readonly testerLien: (url: string) => Promise<ResultatLien>;
}

export type VerdictAffirmation = "confirme" | "a_retirer" | "a_nuancer";
export type MotifVerif =
  "non_examinee" | "source_non_reconnue" | "extrait_introuvable" | "jugement_modele";

export interface LigneVerification {
  readonly affirmation: string;
  readonly section: Correction["section"];
  readonly verdict: VerdictAffirmation;
  readonly sourceUrl: string | null;
  readonly motif: MotifVerif | null;
}

export type ResultatVerification =
  | {
      readonly verdict: "verifie" | "a_corriger";
      readonly tableau: ReadonlyArray<LigneVerification>;
      readonly corrections: ReadonlyArray<Correction>;
      readonly liensMorts: ReadonlyArray<string>;
      readonly codeRefus: CodeRefusVerif | null;
    }
  | { readonly verdict: "illisible"; readonly raison: string };

const sortieSchema = z
  .object({
    affirmations: z
      .array(
        z
          .object({
            affirmation: z.string().trim().min(1),
            section: z.union([
              z.number().int().min(0),
              z.literal("directAnswer"),
              z.literal("faq"),
              z.literal("global"),
            ]),
            verdict: z.enum(["confirme", "a_retirer", "a_nuancer"]),
            sourceUrl: z.string().nullable().optional(),
            extrait: z.string().nullable().optional(),
          })
          .strict(),
      )
      .max(80),
  })
  .strict();

const SYSTEM = [
  "Tu es le vérificateur de faits d'une équipe éditoriale. Tu reprends CHAQUE affirmation vérifiable de l'article (chiffre, date, nom propre, texte de loi) et tu la rapproches du dossier de preuves ; si elle n'y est pas, tu rouvres la source avec web_search et web_fetch.",
  "Pour chaque affirmation : affirmation (copie de la phrase), section (index du H2 en partant de 0, ou directAnswer, faq, global), verdict (confirme, a_retirer, a_nuancer), sourceUrl et extrait (copie exacte d'une phrase de la source) quand tu confirmes. En cas de doute : a_retirer.",
  CONSIGNE_DONNEES,
  'Réponds uniquement par un objet JSON : {"affirmations":[...]}.',
].join("\n\n");

const sansBalises = (h: string) =>
  h
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const phrases = (t: string) =>
  t
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
const LOI = /\b(loi|décret|règlement|directive|ordonnance)\b|\barticle\s+[LRD]\.?\s?\d/i;

function estVerifiable(phrase: string): boolean {
  return nombresDe(phrase).some((n) => n.notable || n.annee) || LOI.test(phrase);
}

interface Phrase {
  readonly texte: string;
  readonly section: Correction["section"];
}

function phrasesVerifiables(e: EntreeVerification): Phrase[] {
  const sortie: Phrase[] = [];
  const ajouter = (t: string, s: Correction["section"]) => {
    for (const p of phrases(t)) if (estVerifiable(p)) sortie.push({ texte: p, section: s });
  };
  ajouter(e.directAnswer, "directAnswer");
  const positions = [...e.bodyHtml.matchAll(/<h2[\s>]/gi)].map((m) => m.index ?? 0);
  ajouter(sansBalises(e.bodyHtml.slice(0, positions[0] ?? e.bodyHtml.length)), "global");
  positions.forEach((d, i) =>
    ajouter(sansBalises(e.bodyHtml.slice(d, positions[i + 1] ?? e.bodyHtml.length)), i),
  );
  for (const f of e.faq) ajouter(`${f.question} ${f.answer}`, "faq");
  return sortie;
}

const correspond = (phrase: string, affirmation: string) => {
  const a = normaliserTitre(phrase);
  const b = normaliserTitre(affirmation);
  return b.length >= 15 && (a.includes(b) || b.includes(a));
};

function hote(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function verifierFaits(
  e: EntreeVerification,
  appel: AppelModele,
  compteur: CompteurCout,
): Promise<ResultatVerification> {
  const reponse = await appelerRole(appel, compteur, "verificateur", {
    system: SYSTEM,
    user: [
      encadrerDonnees(
        "article",
        `${e.directAnswer}\n\n${e.bodyHtml}\n\n${e.faq.map((f) => `${f.question} ${f.answer}`).join("\n")}`,
      ),
      encadrerDonnees(
        "dossier-de-preuves",
        e.faits.map((f) => `- ${f.enonce} [${f.url}] « ${f.extrait} »`).join("\n") ||
          "(aucun fait)",
      ),
    ].join("\n\n"),
    maxTokens: 6000,
    outils: ["web_search", "web_fetch"],
    maxRecherches: PLAFOND_RECHERCHES_VERIFICATION,
    maxLectures: MAX_LECTURES_VERIFICATION,
  });
  const lu = lireJson(reponse.texte, sortieSchema);
  if (!lu.ok) return { verdict: "illisible", raison: `Vérification illisible (${lu.raison})` };

  const pages = new Map<string, string>([
    ...e.faits.map((f) => [f.url, f.extrait] as const),
    ...(reponse.sources ?? []).map((s) => [s.url, s.texte ?? ""] as const),
  ]);
  const textePage = (url: string) =>
    normaliserTitre(
      [pages.get(url) ?? "", ...e.faits.filter((f) => f.url === url).map((f) => f.extrait)].join(
        " ",
      ),
    );

  const tableau: LigneVerification[] = lu.valeur.affirmations.map((a) => {
    let verdict: VerdictAffirmation = a.verdict;
    let motif: MotifVerif | null = a.verdict === "confirme" ? null : "jugement_modele";
    if (a.verdict === "confirme") {
      const url = a.sourceUrl ?? "";
      if (!url || !pages.has(url)) {
        verdict = "a_retirer";
        motif = "source_non_reconnue";
      } else if (!a.extrait || !textePage(url).includes(normaliserTitre(a.extrait))) {
        verdict = "a_retirer";
        motif = "extrait_introuvable";
      }
    }
    return {
      affirmation: a.affirmation,
      section: a.section,
      verdict,
      sourceUrl: a.sourceUrl ?? null,
      motif,
    };
  });

  // Fail-closed : toute phrase vérifiable que le modèle n'a pas examinée est à retirer.
  for (const p of phrasesVerifiables(e)) {
    if (!tableau.some((l) => correspond(p.texte, l.affirmation))) {
      tableau.push({
        affirmation: p.texte,
        section: p.section,
        verdict: "a_retirer",
        sourceUrl: null,
        motif: "non_examinee",
      });
    }
  }

  const corrections: Correction[] = tableau
    .filter((l) => l.verdict !== "confirme")
    .map((l) => ({
      section: l.section,
      probleme: `${l.verdict === "a_nuancer" ? "affirmation à nuancer" : "affirmation non confirmée"} : « ${l.affirmation} »`,
      attendu:
        l.verdict === "a_nuancer"
          ? "Nuancer selon la source"
          : "Retirer l'affirmation, ou la réécrire avec une source du dossier",
    }));

  // Liens sortants.
  const liensMorts: string[] = [];
  const hrefs = [
    ...new Set([...e.bodyHtml.matchAll(/<a\s[^>]*href="(https?:\/\/[^"]+)"/gi)].map((m) => m[1]!)),
  ];
  for (const url of hrefs) {
    try {
      const r = await e.testerLien(url);
      if (r.statut !== 200 || hote(r.urlFinale) !== hote(url)) liensMorts.push(url);
    } catch {
      liensMorts.push(url);
    }
  }
  for (const url of liensMorts) {
    corrections.push({
      section: "global",
      probleme: `lien mort ou détourné : ${url}`,
      attendu: "Remplacer par une source valide du dossier ou retirer le lien",
    });
  }

  const chiffreRetire = tableau.some(
    (l) =>
      l.verdict === "a_retirer" &&
      estVerifiable(l.affirmation) &&
      nombresDe(l.affirmation).some((n) => n.notable),
  );
  const codeRefus: CodeRefusVerif | null =
    corrections.length === 0
      ? null
      : tableau.some((l) => l.verdict !== "confirme")
        ? chiffreRetire
          ? "chiffre_retire"
          : "fait_non_source"
        : "lien_mort";
  return {
    verdict: corrections.length === 0 ? "verifie" : "a_corriger",
    tableau,
    corrections,
    liensMorts,
    codeRefus,
  };
}
