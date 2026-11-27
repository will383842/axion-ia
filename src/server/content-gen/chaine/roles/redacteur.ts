/**
 * R4 · Rédacteur sous contrat de faits (conception § 3, addendum § 8.2 ; PR C7). Modèle : Opus.
 *
 * Entrée : brief + plan figé + dossier de preuves. Il n'a le droit d'énoncer un chiffre que s'il
 * est dans le dossier, AVEC son lien. Le modèle écrit, le CODE contrôle chaque contrat :
 *  - jamais de `<h1>` (le gabarit le rend) : retiré, drapeau `h1DansSortieBrute` levé ;
 *  - autant de H2 que le plan, dans l'ordre (`ordre_plan`) ;
 *  - réponse directe de 40 à 60 mots ; ouverture `<p data-aeo="answer">` sous au moins 70 % des H2 ;
 *  - aucun chiffre hors dossier, chaque chiffre sourcé dans son paragraphe ;
 *  - FAQ tirée du seul brief (jamais comblée), texte jamais caché, règles de marque, pas de « relu » ;
 *  - longueur dans la fourchette du brief (signalée, non bloquante à la lecture).
 * Le prompt de la voie « chaîne » ne reprend PAS les consignes de l'ancien générateur : « 8 questions
 * People-Also-Ask réelles » (inventées), « longueur déterminante », dernière section imposée.
 *
 * La réécriture ciblée ne reprend QUE les sections en cause (les autres restent identiques, octet
 * pour octet) et ne change jamais un titre H2 (ancres déjà citées). Aucune entrée-sortie ici.
 */

import { z } from "zod";
import type { Brief } from "../../equipe/brief";
import type { FaitSource } from "./collecteur-faits";
import {
  CONSIGNE_DONNEES,
  REGLES_MARQUE_PROMPT,
  appelerRole,
  encadrerDonnees,
  hrefInterdit,
  hrefsDe,
  lireJson,
  verifierReglesMarque,
  type AppelModele,
  type CompteurCout,
  type Correction,
} from "./commun";
import { nombresDe } from "./nombres";
import {
  compterMotsContenu,
  motsSignificatifs,
  normaliserTitre,
  verifierTitres,
} from "./structure-hn";
import type { StructureBrief } from "./strateg-brief";

export interface EntreeRedaction {
  readonly brief: Brief;
  readonly structure: StructureBrief;
  readonly faits: ReadonlyArray<FaitSource>;
  readonly maintenant: Date;
}

export interface ArticleRedige {
  /** Réponse directe de 40 à 60 mots (champ rendu sous le H1). */
  readonly directAnswer: string;
  /** Corps HTML : H2, paragraphes, listes, tableaux. Jamais de `<h1>`. */
  readonly bodyHtml: string;
  readonly faq: ReadonlyArray<{ readonly question: string; readonly answer: string }>;
  /** Un `<h1>` figurait dans la sortie brute du modèle (lu par B18 de la porte). */
  readonly h1DansSortieBrute: boolean;
}

export type ResultatRedaction =
  | {
      readonly verdict: "redige";
      readonly article: ArticleRedige;
      /** Vide = conforme. Sinon : corrections localisées pour la réécriture ciblée. */
      readonly problemes: ReadonlyArray<Correction>;
    }
  | { readonly verdict: "illisible"; readonly raison: string };

export const PROMPT_REDACTEUR_SYSTEME = [
  "Tu es le rédacteur d'une équipe éditoriale. Tu écris pour des dirigeants de PME (environ 80 %) et de TPE (environ 20 %) : phrases courtes, voix active, vocabulaire d'un dirigeant, zéro jargon, zéro remplissage.",
  "Tu suis le PLAN du brief : exactement les H2 donnés, dans l'ordre, sans en ajouter ni en retirer. Pas de <h1>. Pas de numéro d'étape écrit.",
  'Réponse directe (directAnswer) : 40 à 60 mots, qui répond tout de suite à la question du titre. Sous chaque H2 informatif : un premier paragraphe <p data-aeo="answer"> de 40 à 60 mots qui répond à la question du titre, compréhensible seul, sans pronom de reprise en tête. Rien de caché (pas de <details>).',
  'CONTRAT DE FAITS : tu n\'énonces aucun chiffre hors du dossier de preuves. Un chiffre du dossier se cite avec son année et un lien <a href="URL du dossier">éditeur</a> dans le même paragraphe. Sinon, écris sans chiffre. Les petits décomptes (3 étapes) restent permis.',
  "FAQ : seulement des questions du brief marquées pour la FAQ, avec une réponse de 25 à 200 mots. Si le brief n'en fournit pas 4, laisse la FAQ vide : n'invente jamais une question.",
  "Longueur : vise le milieu de la fourchette du brief ; écris moins si les questions sont couvertes. Définis les termes, utilise une liste ou un tableau quand c'est le bon format.",
  "Honnêteté : n'écris jamais « relu par » ni aucun nom d'auteur. Aucune persona.",
  "Règles de marque :\n- " + REGLES_MARQUE_PROMPT,
  CONSIGNE_DONNEES,
  'Réponds uniquement par un objet JSON : {"directAnswer": "...", "bodyHtml": "...", "faq": [{"question": "...", "answer": "..."}]}.',
].join("\n\n");

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

const sortieReecritureSchema = z
  .object({
    sections: z
      .array(z.object({ index: z.number().int().min(0), html: z.string() }).strict())
      .optional(),
    directAnswer: z.string().optional(),
    faq: z
      .array(z.object({ question: z.string(), answer: z.string() }).strict())
      .max(20)
      .optional(),
  })
  .strict();

// ── Utilitaires HTML (lecture seule, sans interprétation du DOM) ───────────

const sansBalises = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Coupe le corps avant chaque `<h2` : `avant` = ce qui précède, `sections` = H2 + son contenu. */
export function decouperSections(bodyHtml: string): { avant: string; sections: string[] } {
  const positions: number[] = [];
  const re = /<h2[\s>]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bodyHtml)) !== null) positions.push(m.index);
  if (positions.length === 0) return { avant: bodyHtml, sections: [] };
  const sections = positions.map((debut, i) =>
    bodyHtml.slice(debut, positions[i + 1] ?? bodyHtml.length),
  );
  return { avant: bodyHtml.slice(0, positions[0]), sections };
}

const titreH2 = (section: string) =>
  sansBalises(/<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(section)?.[1] ?? "");

// ── Contrôles ───────────────────────────────────────────────────────────────

const PRONOMS_DE_REPRISE = /^(elle|elles|cela|ce dernier|celle-ci|celui-ci|ces derniers|ils)\b/i;
const IL_PERMIS = /^il\s+(faut|existe|y a|est|s'agit|suffit|reste)\b/i;

export function analyserArticle(e: EntreeRedaction, a: ArticleRedige): Correction[] {
  const pb: Correction[] = [];
  const { sections, avant } = decouperSections(a.bodyHtml);
  const plan = e.structure.planHn;

  // Structure : appariement avec le plan.
  const titres = sections.map(titreH2);
  const apparie =
    titres.length === plan.length &&
    titres.every((t, i) => {
      const prevu = new Set(motsSignificatifs(plan[i]!.intitule));
      return motsSignificatifs(t).some((m) => prevu.has(m));
    });
  if (!apparie) {
    pb.push({
      section: "global",
      probleme: "ordre_plan",
      attendu: `Exactement ${plan.length} H2, dans l'ordre du plan : ${plan.map((p) => p.intitule).join(" / ")}`,
    });
  }

  // Réponse directe.
  const motsDirect = compterMotsContenu(a.directAnswer);
  if (motsDirect < 40 || motsDirect > 60) {
    pb.push({
      section: "directAnswer",
      probleme: "reponse_directe_longueur",
      attendu: "40 à 60 mots",
    });
  }

  // Ouvertures (R-2, R-3) : au moins 70 % des H2 informatifs ou phase, 25 à 80 mots.
  const eligibles = sections
    .map((s, i) => ({ s, i, type: plan[i]?.type ?? "informatif" }))
    .filter((x) => x.type === "informatif" || x.type === "phase");
  const conformes = eligibles.filter((x) => {
    const ouv = /<\/h2>\s*<p[^>]*data-aeo="answer"[^>]*>([\s\S]*?)<\/p>/i.exec(x.s)?.[1];
    if (ouv === undefined) return false;
    const n = compterMotsContenu(sansBalises(ouv));
    return n >= 25 && n <= 80;
  });
  if (eligibles.length > 0 && conformes.length / eligibles.length < 0.7) {
    const premier = eligibles.find((x) => !conformes.includes(x));
    pb.push({
      section: premier?.i ?? "global",
      probleme: "ouverture_absente",
      attendu: 'Ouvrir chaque H2 par <p data-aeo="answer"> de 40 à 60 mots (25 à 80 tolérés)',
    });
  }
  for (const x of eligibles) {
    const ouv = /<\/h2>\s*<p[^>]*data-aeo="answer"[^>]*>([\s\S]*?)<\/p>/i.exec(x.s)?.[1];
    const t = ouv ? sansBalises(ouv) : "";
    if (t && (PRONOMS_DE_REPRISE.test(t) || (/^il\b/i.test(t) && !IL_PERMIS.test(t)))) {
      pb.push({
        section: x.i,
        probleme: "ouverture_non_autonome",
        attendu: "Ouverture compréhensible seule, sans pronom de reprise",
      });
    }
  }

  // Chiffres : contrat de faits.
  const nombresDossier = new Map<string, FaitSource[]>();
  const anneesDossier = new Set<number>([e.maintenant.getUTCFullYear()]);
  for (const f of e.faits) {
    anneesDossier.add(Number(f.datePublication.slice(0, 4)));
    for (const n of nombresDe(`${f.valeur ?? ""} ${f.extrait}`)) {
      nombresDossier.set(n.cle, [...(nombresDossier.get(n.cle) ?? []), f]);
      if (n.annee) anneesDossier.add(n.valeur);
    }
  }
  const verifierSegment = (texte: string, html: string | null, section: Correction["section"]) => {
    for (const n of nombresDe(texte)) {
      if (n.annee) {
        if (!anneesDossier.has(n.valeur)) {
          pb.push({
            section,
            probleme: "chiffre_hors_dossier",
            attendu: `Année ${n.valeur} absente du dossier`,
          });
        }
        continue;
      }
      if (!n.notable) continue;
      if (n.minutes && n.valeur === 45 && /diagnostic/i.test(texte)) continue;
      const proprietaires = nombresDossier.get(n.cle);
      if (!proprietaires) {
        pb.push({
          section,
          probleme: "chiffre_hors_dossier",
          attendu: `Retirer le chiffre « ${n.cle} » ou le sourcer dans le dossier`,
        });
        continue;
      }
      const cite =
        html === null
          ? proprietaires.some(
              (f) => f.editeur && texte.toLowerCase().includes(f.editeur.toLowerCase()),
            )
          : proprietaires.some((f) => html.includes(f.url));
      if (!cite) {
        pb.push({
          section,
          probleme: "chiffre_sans_source",
          attendu: "Citer l'éditeur (lien) et l'année dans le même paragraphe",
        });
      }
    }
  };
  verifierSegment(a.directAnswer, null, "directAnswer");
  for (const f of a.faq) verifierSegment(`${f.question} ${f.answer}`, null, "faq");
  const segmenter = (html: string) => html.split(/(?=<(?:p|li|td|h2|h3)[\s>])/i);
  sections.forEach((s, i) =>
    segmenter(s).forEach((seg) => verifierSegment(sansBalises(seg), seg, i)),
  );
  segmenter(avant).forEach((seg) => verifierSegment(sansBalises(seg), seg, "global"));

  // FAQ : réponses de 25 à 200 mots.
  for (const f of a.faq) {
    const n = compterMotsContenu(f.answer);
    if (n < 25 || n > 200)
      pb.push({
        section: "faq",
        probleme: "faq_reponse_longueur",
        attendu: "Réponse de 25 à 200 mots",
      });
  }

  // Texte caché, HTML interdit, « relu par », marque : localisés à la section fautive.
  const CACHE =
    /<details|\shidden[\s>=]|display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|opacity\s*:\s*0|sr-only|aria-hidden|<!--/i;
  const INTERDIT =
    /<(script|iframe|style|object|embed|form|input)\b|\s(?:on\w+|style|class|title|alt)\s*=/i;
  const RELU = /\brelu(?:e|s|es)?\s+par\b/i;
  const controlerForme = (html: string, texte: string, section: Correction["section"]) => {
    if (CACHE.test(html)) {
      pb.push({
        section,
        probleme: "texte_cache",
        attendu: "Aucune réponse cachée (pas de <details> ni d'élément masqué)",
      });
    }
    if (INTERDIT.test(html)) {
      pb.push({
        section,
        probleme: "html_interdit",
        attendu: "HTML éditorial seulement (titres, paragraphes, listes, tableaux, liens)",
      });
    }
    if (RELU.test(texte)) {
      pb.push({
        section,
        probleme: "relu_sans_relecture",
        attendu: "Jamais « relu par » sans relecture humaine réelle",
      });
    }
    const marque = verifierReglesMarque(html);
    if (marque.length > 0) {
      pb.push({ section, probleme: "regle_de_marque", attendu: `Retirer : ${marque.join(", ")}` });
    }
  };
  const urlsDossier = new Set(e.faits.map((f) => f.url));
  const controlerLiens = (html: string, section: Correction["section"]) => {
    for (const href of hrefsDe(html)) {
      const permis = /^https?:/i.test(href)
        ? urlsDossier.has(href)
        : e.structure.liensInternes.includes(href);
      if (hrefInterdit(href) || !permis) {
        pb.push({
          section,
          probleme: "lien_non_autorise",
          attendu: `Lien « ${href} » non prévu : seuls les liens du dossier et du brief sont permis`,
        });
      }
    }
  };
  controlerLiens(a.directAnswer, "directAnswer");
  controlerLiens(avant, "global");
  sections.forEach((s, i) => controlerLiens(s, i));
  for (const f of a.faq) controlerLiens(f.answer, "faq");
  // Titres H2 écrits (H-7, H-8, H-11) : longueur, générique, doublon, identique au H1.
  const vusH2 = new Set<string>();
  sections.forEach((s, i) => {
    const t = titreH2(s);
    const k = normaliserTitre(t);
    const pbT = verifierTitres({
      h1: e.structure.h1,
      motCle: e.brief.motCle,
      plan: [{ type: "informatif", intitule: t, question: null, blocAttendu: null }],
      gabarit: "analyse",
    }).filter((x) => x === "h2_longueur" || x === "h2_generique" || x === "h2_egal_h1");
    if (vusH2.has(k)) pbT.push("h2_egal_h1");
    vusH2.add(k);
    for (const x of new Set(pbT)) {
      pb.push({
        section: i,
        probleme: x === "h2_egal_h1" ? "h2_doublon" : x,
        attendu: "Titre H2 de 3 à 14 mots, informatif, unique, différent du H1",
      });
    }
  });
  controlerForme(a.directAnswer, a.directAnswer, "directAnswer");
  controlerForme(avant, sansBalises(avant), "global");
  sections.forEach((s, i) => controlerForme(s, sansBalises(s), i));
  for (const f of a.faq)
    controlerForme(`${f.question} ${f.answer}`, `${f.question} ${f.answer}`, "faq");

  // Longueur.
  const total =
    motsDirect +
    compterMotsContenu(sansBalises(a.bodyHtml)) +
    a.faq.reduce((n, f) => n + compterMotsContenu(f.question) + compterMotsContenu(f.answer), 0);
  const { min, max } = e.structure.fourchetteMots;
  if (total < min || total > max) {
    pb.push({
      section: "global",
      probleme: "longueur_hors_fourchette",
      attendu: `Entre ${min} et ${max} mots (actuel : ${total})`,
    });
  }
  return pb;
}

function filtrerFaq(
  e: EntreeRedaction,
  brute: ReadonlyArray<{ question: string; answer: string }>,
): { faq: Array<{ question: string; answer: string }>; inventee: boolean } {
  const permises = new Set(
    e.structure.faqPrevue
      .map((i) => e.brief.questions[i]?.question)
      .filter((q): q is string => typeof q === "string")
      .map((q) => normaliserTitre(q)),
  );
  const gardees = brute.filter((f) => permises.has(normaliserTitre(f.question)));
  const inventee = gardees.length < brute.length;
  // Sous 4 questions réelles, la FAQ est omise (sauf gabarit Questions-réponses) : jamais comblée.
  if (gardees.length < 4 && e.structure.gabaritCible !== "faq") return { faq: [], inventee };
  return { faq: gardees, inventee };
}

function userRedaction(e: EntreeRedaction): string {
  const plan = e.structure.planHn
    .map(
      (p, i) =>
        `${i}. [${p.type}] ${p.intitule}${p.blocAttendu ? ` (bloc : ${p.blocAttendu})` : ""}`,
    )
    .join("\n");
  const faits = e.faits
    .map((f) => `- ${f.enonce} [${f.editeur ?? "?"}, ${f.datePublication}, ${f.url}]`)
    .join("\n");
  const faq = e.structure.faqPrevue
    .map((i) => e.brief.questions[i]?.question)
    .filter(Boolean)
    .join("\n");
  const { min, max } = e.structure.fourchetteMots;
  return [
    `Titre (H1, rendu par la page) : ${e.structure.h1}`,
    `Angle unique : ${e.structure.angleUnique}`,
    encadrerDonnees("plan", plan),
    encadrerDonnees("dossier-de-preuves", faits || "(aucun fait)"),
    encadrerDonnees("questions-faq", faq || "(aucune : FAQ vide)"),
    `Fourchette de longueur : ${min} à ${max} mots. Date du jour : ${e.maintenant.toISOString().slice(0, 10)}.`,
  ].join("\n\n");
}

export async function redigerArticle(
  e: EntreeRedaction,
  appel: AppelModele,
  compteur: CompteurCout,
): Promise<ResultatRedaction> {
  const reponse = await appelerRole(appel, compteur, "redacteur", {
    system: PROMPT_REDACTEUR_SYSTEME,
    user: userRedaction(e),
    maxTokens: 9000,
  });
  const lu = lireJson(reponse.texte, sortieSchema);
  if (!lu.ok) return { verdict: "illisible", raison: `Article illisible (${lu.raison})` };

  const h1DansSortieBrute = /<h1[\s>]/i.test(lu.valeur.bodyHtml);
  const bodyHtml = lu.valeur.bodyHtml.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "<p>$1</p>");
  const { faq, inventee } = filtrerFaq(e, lu.valeur.faq ?? []);
  const article: ArticleRedige = {
    directAnswer: lu.valeur.directAnswer.trim(),
    bodyHtml,
    faq,
    h1DansSortieBrute,
  };
  const problemes = analyserArticle(e, article);
  if (inventee) {
    problemes.push({
      section: "faq",
      probleme: "faq_question_inventee",
      attendu: "N'utiliser que les questions du brief",
    });
  }
  return { verdict: "redige", article, problemes };
}

/**
 * Réécriture ciblée : ne reprend que les sections listées dans `corrections`. Les autres restent
 * identiques ; un titre H2 modifié est refusé (les ancres publiées ne bougent pas).
 */
export async function reecrireSections(
  e: EntreeRedaction,
  article: ArticleRedige,
  corrections: ReadonlyArray<Correction>,
  appel: AppelModele,
  compteur: CompteurCout,
): Promise<ResultatRedaction> {
  const { avant, sections } = decouperSections(article.bodyHtml);
  const cibles = new Set(
    corrections.map((c) => c.section).filter((s): s is number => typeof s === "number"),
  );
  const visees = [...cibles].filter((i) => i >= 0 && i < sections.length);
  const aReecrire = visees
    .map(
      (i) =>
        `Section ${i}\nProblème(s) : ${corrections
          .filter((c) => c.section === i)
          .map((c) => `${c.probleme} (${c.attendu})`)
          .join(" ; ")}\n${sections[i]}`,
    )
    .join("\n\n");
  const autres = corrections
    .filter((c) => typeof c.section !== "number")
    .map((c) => `${c.section} : ${c.probleme} (${c.attendu})`)
    .join("\n");

  const reponse = await appelerRole(appel, compteur, "redacteur", {
    system:
      PROMPT_REDACTEUR_SYSTEME +
      '\n\nMODE RÉÉCRITURE CIBLÉE : réécris UNIQUEMENT les sections données, sans changer leur titre H2. Réponds par {"sections":[{"index":N,"html":"<h2>…</h2>…"}], "directAnswer":"(seulement si demandé)", "faq":[...] (seulement si demandé)}.',
    user: [
      userRedaction(e),
      encadrerDonnees("sections-a-reecrire", aReecrire),
      encadrerDonnees("autres-corrections", autres),
    ].join("\n\n"),
    maxTokens: 6000,
  });
  const lu = lireJson(reponse.texte, sortieReecritureSchema);
  if (!lu.ok) return { verdict: "illisible", raison: `Réécriture illisible (${lu.raison})` };

  const nouvelles = [...sections];
  let h1 = false;
  for (const s of lu.valeur.sections ?? []) {
    if (!visees.includes(s.index))
      return { verdict: "illisible", raison: `Section ${s.index} non demandée` };
    if ((s.html.match(/<h2[\s>]/gi) ?? []).length !== 1) {
      return { verdict: "illisible", raison: `La section ${s.index} doit contenir un seul H2` };
    }
    if (normaliserTitre(titreH2(s.html)) !== normaliserTitre(titreH2(sections[s.index]!))) {
      return { verdict: "illisible", raison: `Le titre H2 de la section ${s.index} a changé` };
    }
    h1 = h1 || /<h1[\s>]/i.test(s.html);
    nouvelles[s.index] = s.html.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "<p>$1</p>");
  }
  const vise = (c: Correction["section"]) => corrections.some((x) => x.section === c);
  const refaq = vise("faq") && lu.valeur.faq ? filtrerFaq(e, lu.valeur.faq) : null;
  const faqNouvelle = refaq && refaq.faq.length > 0 ? refaq.faq : article.faq;
  const suivant: ArticleRedige = {
    ...article,
    directAnswer:
      vise("directAnswer") && lu.valeur.directAnswer
        ? lu.valeur.directAnswer.trim()
        : article.directAnswer,
    faq: faqNouvelle,
    h1DansSortieBrute: article.h1DansSortieBrute || h1,
    bodyHtml: avant + nouvelles.join(""),
  };
  const problemes = analyserArticle(e, suivant);
  if (refaq?.inventee) {
    problemes.push({
      section: "faq",
      probleme: "faq_question_inventee",
      attendu: "N'utiliser que les questions du brief",
    });
  }
  return { verdict: "redige", article: suivant, problemes };
}
