// Bloc « référence » commun à `llms.txt` et `llms-full.txt` : les offres, les questions de
// dirigeants et le glossaire (lot GEO V1-14, refonte du 20/11/2026).
//
// Tout est LU dans les sources du dépôt, rien n'est recopié : offres (`journee-ia-commun.ts`,
// navigation, `questions-reference.ts`), glossaire (`glossaire-reference`), Observatoire
// (`observatoire/study.ts`). Aucune base de données : le bloc est identique au build (base
// factice `stub.invalid`) et en production. Toutes les URL sont absolues, en `/fr`.
//
// Une offre dont la route n'existe pas (clé absente de `routing.pathnames`) n'est PAS listée.
//
// ⛔ Aucune phrase n'est écrite deux fois dans `llms.txt` : une offre ne reprend donc jamais les
// deux premières phrases d'une question de la liste courte (`QUESTIONS_COURTES`).

import { DESCRIPTION_SERVICE_JOURNEE_IA, remplacerJetons } from "@/content/journee-ia-commun";
import {
  LIBELLE_SITES_WEB_FR,
  MOTS_INTERDITS_LLMS,
  accrocheNav,
  dateFr,
  propreLlms,
} from "@/app/_llms/faits-communs";
import { GLOSSAIRE_DATE_MISE_A_JOUR, TERMES_GLOSSAIRE } from "@/content/glossaire-reference";
import { QUESTIONS_REFERENCE } from "@/content/questions-reference";
import {
  STUDY_LICENSE_LABEL,
  STUDY_NAME_FR,
  STUDY_QUESTION_COUNT,
} from "@/content/observatoire/study";
import { DEFINITION_CARTOGRAPHIE } from "@/content/cartographie-date";
import { EFFECTIF_PLAGE_FR } from "@/content/formations/effectif";
import { routing } from "@/i18n/routing";

export { MOTS_INTERDITS_LLMS };

/** Découpe un texte en phrases (fin de phrase suivie d'une majuscule ou d'un guillemet ouvrant). */
export function phrasesDe(texte: string): string[] {
  return texte
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý«])/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Les deux premières phrases d'un texte : la réponse courte d'une question de référence. */
export function deuxPremieresPhrases(texte: string): string {
  return phrasesDe(texte).slice(0, 2).join(" ");
}

const reponse = (id: string): string => remplacerJetons(QUESTIONS_REFERENCE[id]?.reponse ?? "");
const phrase = (id: string, rang: number): string => phrasesDe(reponse(id))[rang] ?? "";

interface OffreLlms {
  /** Clé de `routing.pathnames` (chemin FR sans préfixe de langue). */
  readonly cle: string;
  readonly nom: string;
  /** « journee » : section de la Journée IA ; « prestations » : section des offres sur devis. */
  readonly section: "journee" | "prestations";
  /** Définition courte (une ou deux phrases), lue dans une source du dépôt. */
  readonly definition: () => string;
  /** Question de référence dont la réponse développe l'offre (llms-full). */
  readonly questionId?: string;
}

const OFFRES: readonly OffreLlms[] = [
  {
    cle: "/journee-ia",
    nom: "La Journée IA",
    section: "journee",
    definition: () => remplacerJetons(DESCRIPTION_SERVICE_JOURNEE_IA),
    questionId: "ref-journee-prix",
  },
  {
    cle: "/cartographie",
    nom: "Cartographie de l’entreprise",
    section: "journee",
    definition: () => DEFINITION_CARTOGRAPHIE,
  },
  {
    cle: "/formations",
    nom: "Formations IA",
    section: "prestations",
    definition: () =>
      `Formations IA pour les équipes d’une entreprise, sur site ou à distance, de 4 heures à 2 jours, en groupe (${EFFECTIF_PLAGE_FR}) : elles changent les pratiques des équipes sur leurs propres dossiers.`,
    questionId: "ref-formation-prix",
  },
  {
    cle: "/implementation",
    nom: "Automatisations et mise en place",
    section: "prestations",
    definition: () => `${accrocheNav("implementation")} ${phrase("ref-automatiser-premier", 2)}`,
    questionId: "ref-automatiser-premier",
  },
  {
    cle: "/implementation/integrations",
    nom: "Intégration à vos logiciels",
    section: "prestations",
    definition: () =>
      `L’IA se branche sur les logiciels que l’entreprise utilise déjà. ${phrase("ref-outils-existants", 2)}`,
    questionId: "ref-outils-existants",
  },
  {
    cle: "/audit",
    nom: "Audit IA",
    section: "prestations",
    definition: () => `${accrocheNav("audit")} ${phrase("ref-audit-contenu", 0)}`,
    questionId: "ref-audit-contenu",
  },
  {
    cle: "/un-a-un",
    nom: "Coaching IA individuel",
    section: "prestations",
    definition: () => phrase("ref-coaching", 0),
    questionId: "ref-coaching",
  },
  {
    cle: "/sites-web-augmentes",
    nom: LIBELLE_SITES_WEB_FR,
    section: "prestations",
    definition: () =>
      `${accrocheNav("sitesWeb")} Développement sur mesure, hébergement dans l’Union européenne.`,
  },
];

/**
 * Les questions de dirigeants servies par `llms.txt`, dans l'ordre, avec la page qui y répond
 * (clé de `routing.pathnames` ; « / » = l'accueil) et les deux phrases retenues (par défaut les
 * deux premières). `ref-audit-prix` saute sa 2e phrase, qui parle du règlement : rien sur le
 * paiement dans ces fichiers tant que la décision du dirigeant est en cours.
 */
const QUESTIONS_COURTES: ReadonlyArray<{
  readonly id: string;
  readonly cle: string;
  readonly rangs?: readonly [number, number];
}> = [
  { id: "ref-commencer", cle: "/" },
  { id: "ref-journee-prix", cle: "/journee-ia" },
  { id: "ref-audit-prix", cle: "/prix-audit-ia", rangs: [0, 2] },
  { id: "ref-formation-prix", cle: "/formations" },
  { id: "ref-automatisation-prix", cle: "/implementation" },
  { id: "ref-automatiser-premier", cle: "/implementation" },
  { id: "ref-outils-existants", cle: "/implementation/integrations" },
  { id: "ref-audit-vs-formation", cle: "/journee-ia" },
  { id: "ref-remplacer", cle: "/faq" },
  { id: "ref-donnees", cle: "/faq" },
  { id: "ref-partout-france", cle: "/contact" },
];

/**
 * Questions de référence que ces deux fichiers ne servent pas : celles qui expliquent l'AI Act.
 * Décision du dirigeant du 20/11/2026 : dans ce canal, la seule formule sur l'AI Act est « s'inscrit
 * dans l'article 4 du règlement européen sur l'IA ». Elles restent servies par leurs pages ; la page
 * de référence sur l'article 4 est liée dans « Ressources de référence ».
 */
const QUESTIONS_HORS_LLMS: ReadonlySet<string> = new Set([
  "ref-ai-act-pme",
  "ref-ai-act-formation",
]);

/** La page qui répond à une question de référence (pour `llms-full.txt`), si elle est connue. */
const PAGE_DE_LA_QUESTION: Readonly<Record<string, string>> = {
  ...Object.fromEntries(QUESTIONS_COURTES.map((q) => [q.id, q.cle])),
  "ref-audit-contenu": "/prix-audit-ia",
  "ref-audit-vs-info": "/prix-audit-ia",
  "ref-coaching": "/un-a-un",
  "ref-coaching-vs-formation": "/un-a-un",
};

/** Vrai si la clé est une route déclarée (donc servie). « / » est l'accueil. */
export function routeExiste(cle: string): boolean {
  return Object.prototype.hasOwnProperty.call(routing.pathnames, cle);
}

const urlFr = (siteUrl: string, cle: string) => `${siteUrl}/fr${cle === "/" ? "" : cle}`;

/** Les offres dont la route existe, avec leur URL absolue `/fr`. */
export function offresLlms(siteUrl: string, section?: OffreLlms["section"]) {
  return OFFRES.filter((o) => routeExiste(o.cle) && (!section || o.section === section)).map(
    (o) => ({
      nom: o.nom,
      url: urlFr(siteUrl, o.cle),
      definition: o.definition(),
      developpement: o.questionId ? reponse(o.questionId) : "",
    }),
  );
}

/** Les routes (clés) que ce bloc cite, pour le test de garde. */
export const ROUTES_CITEES_LLMS = [
  ...OFFRES.map((o) => o.cle),
  ...QUESTIONS_COURTES.map((q) => q.cle),
  "/glossaire",
] as const;

/** Les questions courtes de `llms.txt` : question, adresse de la page, réponse en deux phrases. */
export function questionsCourtesLlms(siteUrl: string) {
  return QUESTIONS_COURTES.filter((q) => routeExiste(q.cle)).flatMap((q) => {
    const ref = QUESTIONS_REFERENCE[q.id];
    if (!ref) return [];
    const toutes = phrasesDe(remplacerJetons(ref.reponse));
    const [a, b] = q.rangs ?? [0, 1];
    const texte = [toutes[a], toutes[b]].filter(Boolean).join(" ");
    return propreLlms(`${ref.question} ${texte}`)
      ? [{ id: q.id, question: ref.question, url: urlFr(siteUrl, q.cle), reponse: texte }]
      : [];
  });
}

/** Section « offres sur devis », identique de titre dans les deux fichiers. */
export const TITRE_PRESTATIONS_LLMS = "## Formation, mise en place, intégration (sur devis)";

/** `llms.txt` : une ligne par prestation, au format de la norme. */
export function sectionPrestationsLlms(siteUrl: string): string {
  const fr = (cle: string) => urlFr(siteUrl, cle);
  const l: string[] = [TITRE_PRESTATIONS_LLMS, ""];
  for (const o of offresLlms(siteUrl, "prestations")) {
    const suite =
      o.url === fr("/formations")
        ? ` Par métier : ${fr("/formations/metiers")}. Par secteur : ${fr("/formations/secteurs")}.`
        : "";
    l.push(`- [${o.nom}](${o.url}): ${o.definition}${suite}`);
  }
  return l.join("\n");
}

/** `llms-full.txt` : chaque prestation, sa définition puis la réponse de référence complète. */
export function sectionPrestationsCompleteLlms(siteUrl: string): string {
  const l: string[] = [TITRE_PRESTATIONS_LLMS, ""];
  for (const o of offresLlms(siteUrl, "prestations")) {
    const developpement = o.developpement && propreLlms(o.developpement) ? o.developpement : "";
    // La définition courte reprend parfois une phrase de la réponse complète : on ne l'écrit pas deux fois.
    const definition = phrasesDe(o.definition)
      .filter((p) => !developpement.includes(p))
      .join(" ");
    l.push(`### ${o.nom}`, "");
    if (definition) l.push(definition, "");
    if (developpement) l.push(developpement, "");
    l.push(`Page : ${o.url}`, "");
  }
  return l.join("\n").trimEnd();
}

/** `llms.txt` : les questions de dirigeants, réponse en deux phrases et lien de la page. */
export function sectionQuestionsCourtesLlms(siteUrl: string): string {
  return [
    "## Questions de dirigeants : réponses courtes",
    "",
    ...questionsCourtesLlms(siteUrl).map((q) => `- [${q.question}](${q.url}): ${q.reponse}`),
  ].join("\n");
}

/**
 * `llms-full.txt` : toutes les questions de référence, réponse complète. Une réponse qui porte
 * un mot proscrit dans ce canal (« certification » même niée) est rendue dans sa version courte
 * si celle-ci est propre, sinon écartée ; elle reste servie par sa page.
 */
export function sectionQuestionsCompletesLlms(siteUrl: string): string {
  const courtes = new Map(questionsCourtesLlms(siteUrl).map((q) => [q.id, q.reponse]));
  const l: string[] = ["## Questions de dirigeants : réponses complètes", ""];
  for (const q of Object.values(QUESTIONS_REFERENCE)) {
    if (QUESTIONS_HORS_LLMS.has(q.id)) continue;
    const complete = remplacerJetons(q.reponse);
    const texte = propreLlms(`${q.question} ${complete}`) ? complete : courtes.get(q.id);
    if (!texte) continue;
    const cle = PAGE_DE_LA_QUESTION[q.id];
    l.push(`### ${q.question}`, "", texte, "");
    if (cle && routeExiste(cle)) l.push(`Page : ${urlFr(siteUrl, cle)}`, "");
  }
  return l.join("\n").trimEnd();
}

/** La ligne du glossaire (`llms.txt`, section « Ressources de référence »). */
export function ligneGlossaireLlms(siteUrl: string): string {
  return `- [Glossaire de l’IA en entreprise](${siteUrl}/fr/glossaire): ${TERMES_GLOSSAIRE.length} termes définis en clair (définition, exemple en PME, limite), mis à jour le ${dateFr(GLOSSAIRE_DATE_MISE_A_JOUR)}. Version texte de chaque terme : ${siteUrl}/api/markdown/glossaire/{slug}.`;
}

/**
 * `llms-full.txt` : la liste des termes. Les définitions qui portent un mot proscrit dans ce
 * canal restent servies par /glossaire : seul le lien est omis ici.
 */
export function sectionGlossaireLlms(siteUrl: string): string {
  const base = `${siteUrl}/fr/glossaire`;
  return [
    "## Glossaire de l’IA en entreprise",
    "",
    `${TERMES_GLOSSAIRE.length} termes définis en clair (définition, exemple en PME, limite), mis à jour le ${dateFr(GLOSSAIRE_DATE_MISE_A_JOUR)}. Page : ${base}`,
    "",
    ...TERMES_GLOSSAIRE.filter((t) => propreLlms(`${t.term} ${t.definition}`)).map(
      (t) => `- [${t.term}](${base}/${t.slug}): ${t.definition}`,
    ),
  ].join("\n");
}

/**
 * La ligne de l'Observatoire. Aucun chiffre de réponses : la page publique porte les siens, et
 * rien n'est ajouté ici. Les deux exports sont ceux que la page déclare en `DataDownload`.
 */
export function ligneObservatoireLlms(siteUrl: string): string {
  return `- [${STUDY_NAME_FR}](${siteUrl}/fr/observatoire-ia): étude Axion-IA auprès de dirigeants répondants, échantillon volontaire, questionnaire de ${STUDY_QUESTION_COUNT} questions, données ouvertes ${STUDY_LICENSE_LABEL}. Export CSV : ${siteUrl}/api/observatoire/export-csv. Export JSON : ${siteUrl}/api/observatoire/export-json.`;
}
