/**
 * R7 · Éditeur : style, lisibilité, structure citable (conception § 3, addendum § 8.4 ; PR C9).
 * Modèle : Sonnet. Passe finale sur la FORME, sans changer le fond ni les chiffres.
 *
 * « Le modèle propose, le code vérifie » : l'édition est ACCEPTÉE seulement si
 *  - les chiffres sont identiques, section par section (comparaison avant/après) ;
 *  - les liens sortants sont les mêmes ; un lien interne n'est ajouté que s'il est prévu au brief ;
 *    jamais de lien vers /appel ;
 *  - l'appariement avec le plan tient toujours, et l'édition n'introduit aucun problème nouveau
 *    (réponse directe, ouvertures, texte caché, « relu par »…) ;
 *  - aucune règle de marque n'est violée.
 * Sinon le texte d'origine est conservé et le motif du rejet est rendu. Ce qui relève du fond
 * (section trop courte, redite, longueur hors fourchette) est renvoyé à R4 en corrections localisées,
 * dans le compteur unique de 2 réécritures. Aucune entrée-sortie ici.
 */

import { z } from "zod";
import {
  CONSIGNE_DONNEES,
  REGLES_MARQUE_PROMPT,
  appelerRole,
  encadrerDonnees,
  lireJson,
  verifierReglesMarque,
  type AppelModele,
  type CompteurCout,
  type Correction,
} from "./commun";
import { nombresDe } from "./nombres";
import { normaliserTitre } from "./structure-hn";
import { mesurerEquilibre } from "./equilibre-sections";
import {
  analyserArticle,
  decouperSections,
  type ArticleRedige,
  type EntreeRedaction,
} from "./redacteur";

export type EntreeEdition = EntreeRedaction & { readonly article: ArticleRedige };

export type MotifRejetEdition =
  | "chiffres_modifies"
  | "faq_modifiee"
  | "liens_modifies"
  | "regle_de_marque"
  | "probleme_introduit";

export type ResultatEdition =
  | {
      readonly verdict: "edite" | "inchange";
      /** Article retenu : édité, ou d'origine si l'édition a été rejetée. */
      readonly article: ArticleRedige;
      readonly motifRejet: MotifRejetEdition | null;
      /** Fond à renvoyer à R4 (section courte, redite, longueur). */
      readonly renvoiR4: ReadonlyArray<Correction>;
      /** Problèmes de contrat restants (marque, chiffre hors dossier, plan…) : à renvoyer aussi. */
      readonly problemesResiduels: ReadonlyArray<Correction>;
      readonly avertissements: ReadonlyArray<string>;
    }
  | { readonly verdict: "illisible"; readonly raison: string };

const sortieSchema = z
  .object({
    directAnswer: z.string(),
    bodyHtml: z.string(),
    faq: z
      .array(z.object({ question: z.string(), answer: z.string() }).strict())
      .max(20)
      .optional(),
  })
  .strict();

const SYSTEM = [
  "Tu es l'éditeur d'une équipe éditoriale. Tu corriges la FORME d'un article pour des dirigeants de PME et de TPE : phrases courtes, voix active, vouvoiement, titres informatifs (3 à 14 mots, jamais « Introduction » ni « Conclusion »), ouvertures de section autonomes (sans pronom de reprise en tête), pas de formule creuse, pas de faux titre en gras.",
  "Tu ne changes NI le fond, NI le sens d'une réponse, NI aucun chiffre, NI aucun lien source. Tu n'ajoutes ni ne retires aucun H2 et tu gardes leur ordre. Pas de <h1>. Tu peux ajouter un lien interne seulement s'il figure dans la liste fournie. Jamais de lien /appel.",
  "Règles de marque :\n- " + REGLES_MARQUE_PROMPT,
  CONSIGNE_DONNEES,
  'Réponds uniquement par un objet JSON : {"directAnswer":"...","bodyHtml":"...","faq":[{"question":"...","answer":"..."}]}.',
].join("\n\n");

const sansBalises = (h: string) =>
  h
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Chiffres par segment (réponse directe, avant le premier H2, chaque H2, FAQ), triés. */
function chiffresParSegment(a: ArticleRedige): string[][] {
  const { avant, sections } = decouperSections(a.bodyHtml);
  const cles = (t: string) =>
    nombresDe(t)
      .map((n) => n.cle)
      .sort();
  return [
    cles(a.directAnswer),
    cles(sansBalises(avant)),
    ...sections.map((s) => cles(sansBalises(s))),
    cles(a.faq.map((f) => `${f.question} ${f.answer}`).join(" ")),
  ];
}

const hrefsDe = (h: string) =>
  [...h.matchAll(/<a\s[^>]*?href\s*=\s*["']?([^"'\s>]+)/gi)].map((m) => m[1]!);

function liensConformes(
  avant: ArticleRedige,
  apres: ArticleRedige,
  internesPermis: ReadonlyArray<string>,
): boolean {
  const ext = (h: string) =>
    hrefsDe(h)
      .filter((u) => /^https?:/i.test(u))
      .sort()
      .join("|");
  if (ext(avant.bodyHtml) !== ext(apres.bodyHtml)) return false;
  const interne = (h: string) => hrefsDe(h).filter((u) => !/^https?:/i.test(u));
  const anciens = new Set(interne(avant.bodyHtml));
  return interne(apres.bodyHtml).every(
    (u) => !/\/appel(?![\p{L}-])/iu.test(u) && (anciens.has(u) || internesPermis.includes(u)),
  );
}

const cleProbleme = (c: Correction) => `${c.probleme}|${c.section}`;

export async function editerForme(
  e: EntreeEdition,
  appel: AppelModele,
  compteur: CompteurCout,
): Promise<ResultatEdition> {
  const { article } = e;
  const avant = analyserArticle(e, article);
  const reponse = await appelerRole(appel, compteur, "editeur", {
    system: SYSTEM,
    user: [
      encadrerDonnees("reponse-directe", article.directAnswer),
      encadrerDonnees("article", article.bodyHtml),
      encadrerDonnees(
        "faq",
        article.faq.map((f) => `Q : ${f.question}\nR : ${f.answer}`).join("\n\n") || "(aucune)",
      ),
      `Plan à respecter : ${e.structure.planHn.map((p) => p.intitule).join(" / ")}`,
      `Liens internes permis : ${e.structure.liensInternes.join(", ") || "(aucun)"}`,
    ].join("\n\n"),
    maxTokens: 9000,
  });
  const lu = lireJson(reponse.texte, sortieSchema);
  if (!lu.ok) return { verdict: "illisible", raison: `Édition illisible (${lu.raison})` };

  const h1 = /<h1[\s>]/i.test(lu.valeur.bodyHtml);
  const propose: ArticleRedige = {
    directAnswer: lu.valeur.directAnswer.trim(),
    bodyHtml: lu.valeur.bodyHtml.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "<p>$1</p>"),
    faq: lu.valeur.faq ?? article.faq,
    h1DansSortieBrute: article.h1DansSortieBrute || h1,
  };

  const rejeter = (motif: MotifRejetEdition): ResultatEdition => ({
    verdict: "inchange",
    article,
    motifRejet: motif,
    renvoiR4: fondRenvoye(e, article),
    problemesResiduels: residuels(e, article),
    avertissements: avertissements(article),
  });

  if (JSON.stringify(chiffresParSegment(article)) !== JSON.stringify(chiffresParSegment(propose))) {
    return rejeter("chiffres_modifies");
  }
  const questions = (a: ArticleRedige) =>
    JSON.stringify(a.faq.map((f) => normaliserTitre(f.question)));
  if (questions(article) !== questions(propose)) return rejeter("faq_modifiee");
  const tousHtml = (a: ArticleRedige): ArticleRedige => ({
    ...a,
    bodyHtml: `${a.directAnswer}\n${a.bodyHtml}\n${a.faq.map((f) => f.answer).join("\n")}`,
  });
  if (!liensConformes(tousHtml(article), tousHtml(propose), e.structure.liensInternes)) {
    return rejeter("liens_modifies");
  }
  const tout = `${propose.directAnswer}\n${propose.bodyHtml}\n${propose.faq.map((f) => `${f.question} ${f.answer}`).join("\n")}`;
  const marqueAvant = new Set(
    verifierReglesMarque(
      `${article.directAnswer}\n${article.bodyHtml}\n${article.faq.map((f) => `${f.question} ${f.answer}`).join("\n")}`,
    ),
  );
  if (verifierReglesMarque(tout).some((m) => !marqueAvant.has(m)))
    return rejeter("regle_de_marque");
  const dejaLa = new Set(avant.map(cleProbleme));
  const apres = analyserArticle(e, propose);
  if (apres.some((c) => !dejaLa.has(cleProbleme(c)) && c.probleme !== "longueur_hors_fourchette")) {
    return rejeter("probleme_introduit");
  }
  const identique = JSON.stringify(propose) === JSON.stringify(article);
  return {
    verdict: identique ? "inchange" : "edite",
    article: propose,
    motifRejet: null,
    renvoiR4: fondRenvoye(e, propose),
    problemesResiduels: residuels(e, propose),
    avertissements: avertissements(propose),
  };
}

/** Problèmes de contrat encore présents après l'édition (marque, chiffre hors dossier, plan…). */
function residuels(e: EntreeRedaction, a: ArticleRedige): Correction[] {
  return analyserArticle(e, a).filter((c) => c.probleme !== "longueur_hors_fourchette");
}

function fondRenvoye(e: EntreeRedaction, a: ArticleRedige): Correction[] {
  const types = e.structure.planHn.map((p) => p.type);
  const fond = mesurerEquilibre(a.bodyHtml, types, e.structure.gabaritCible);
  const longueur = analyserArticle(e, a).filter((c) => c.probleme === "longueur_hors_fourchette");
  return [...fond, ...longueur];
}

/** H-15 : paragraphe de moins de 12 mots tout en gras, suivi d'un paragraphe = faux titre. */
function avertissements(a: ArticleRedige): string[] {
  const w: string[] = [];
  for (const m of a.bodyHtml.matchAll(/<p>\s*<strong>([^<]+)<\/strong>\s*<\/p>\s*<p/gi)) {
    if (m[1]!.trim().split(/\s+/).length < 12) {
      w.push("faux_titre");
      break;
    }
  }
  return w;
}
