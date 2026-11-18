// Bloc « référence » commun à `llms.txt` et `llms-full.txt` (lot GEO V1-14).
//
// Tout est LU dans les sources du dépôt, rien n'est recopié : offres (`services.ts`,
// `journee-ia-commun.ts`, `faits-communs.ts`), glossaire (`glossaire-reference`), questions-réponses
// de référence (`questions-reference.ts`), Observatoire (`observatoire/study.ts`).
// Aucune base de données : le bloc est identique au build (base factice `stub.invalid`) et en
// production. Toutes les URL sont absolues, en `/fr`.
//
// Une offre dont la route n'existe pas (clé absente de `routing.pathnames`) n'est PAS listée :
// la page « Cartographie » apparaît donc d'elle-même à la fusion de sa route.
//
// Branchement : voir `sectionReferenceLlms` — à appeler depuis les deux routes.

import {
  DESCRIPTION_ENTITE_FR,
  DESCRIPTION_SERVICE_JOURNEE_IA,
  remplacerJetons,
} from "@/content/journee-ia-commun";
import { DESCRIPTION_AUDIT_LLMS, MOTS_INTERDITS_LLMS } from "@/app/_llms/faits-communs";
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

interface OffreLlms {
  /** Clé de `routing.pathnames` (chemin FR sans préfixe de langue). */
  readonly cle: string;
  readonly nom: string;
  /** Définition courte (une ou deux phrases), lue dans une source du dépôt. */
  readonly definition: () => string;
  /** Question de référence dont la réponse développe l'offre (llms-full). */
  readonly questionId?: string;
}

const reponse = (id: string): string => remplacerJetons(QUESTIONS_REFERENCE[id]?.reponse ?? "");

const OFFRES: readonly OffreLlms[] = [
  {
    cle: "/journee-ia",
    nom: "La Journée IA",
    definition: () => remplacerJetons(DESCRIPTION_SERVICE_JOURNEE_IA),
    questionId: "ref-journee-prix",
  },
  {
    cle: "/audit",
    nom: "Audit IA",
    definition: () => DESCRIPTION_AUDIT_LLMS,
    questionId: "ref-audit-contenu",
  },
  {
    cle: "/formations",
    nom: "Formations IA",
    definition: () =>
      `Formations IA pour les équipes d’une entreprise, sur site ou à distance, de 4 heures à 2 jours, en groupe (${EFFECTIF_PLAGE_FR}) : elles changent les pratiques des équipes sur leurs propres dossiers.`,
  },
  {
    cle: "/un-a-un",
    nom: "Coaching IA individuel",
    definition: () => reponse("ref-coaching").split(". ")[0] + ".",
    questionId: "ref-coaching",
  },
  {
    cle: "/implementation",
    nom: "Automatisations et mise en place",
    definition: () => reponse("ref-automatiser-premier").split(". ")[0] + ".",
    questionId: "ref-automatiser-premier",
  },
  {
    cle: "/cartographie",
    nom: "Cartographie de l’entreprise",
    definition: () => DEFINITION_CARTOGRAPHIE,
  },
];

/** Vrai si la clé est une route déclarée (donc servie). */
export function routeExiste(cle: string): boolean {
  return Object.prototype.hasOwnProperty.call(routing.pathnames, cle);
}

/** Les offres dont la route existe, avec leur URL absolue `/fr`. */
export function offresLlms(siteUrl: string) {
  return OFFRES.filter((o) => routeExiste(o.cle)).map((o) => ({
    nom: o.nom,
    url: `${siteUrl}/fr${o.cle}`,
    definition: o.definition(),
    developpement: o.questionId ? reponse(o.questionId) : "",
  }));
}

/** Les routes (clés) que ce bloc cite, pour le test de garde. */
export const ROUTES_CITEES_LLMS = [
  ...OFFRES.map((o) => o.cle),
  "/glossaire",
  "/faq",
  "/connaissances",
  "/observatoire-ia",
  "/contact",
  "/presse",
] as const;

/**
 * Le bloc, en Markdown. `complet = false` → `llms.txt` (liens et définitions d'une phrase) ;
 * `complet = true` → `llms-full.txt` (réponses développées, liste des termes du glossaire).
 */
export function sectionReferenceLlms(siteUrl: string, complet: boolean): string {
  const fr = (cle: string) => `${siteUrl}/fr${cle}`;
  const offres = offresLlms(siteUrl);
  const l: string[] = [];
  l.push("## Qui est Axion-IA", "", DESCRIPTION_ENTITE_FR, "");
  l.push("## Nos offres (pages de référence)", "");
  for (const o of offres) {
    l.push(`- [${o.nom}](${o.url}) — ${o.definition}`);
    if (complet && o.developpement) l.push("", `  ${o.developpement}`, "");
  }
  l.push("", "## Glossaire", "");
  l.push(
    `- [Glossaire de l’IA en entreprise](${fr("/glossaire")}) — ${TERMES_GLOSSAIRE.length} termes définis en clair (définition, exemple en PME, limite). Mis à jour le ${GLOSSAIRE_DATE_MISE_A_JOUR.split("-").reverse().join("/")}. Chaque terme : ${fr("/glossaire")}/{slug}.`,
  );
  if (complet) {
    for (const t of TERMES_GLOSSAIRE) {
      l.push(`  - [${t.term}](${fr("/glossaire")}/${t.slug}) — ${t.definition}`);
    }
  }
  l.push("", "## Questions-réponses de référence", "");
  l.push(
    `- [FAQ](${fr("/faq")}) — questions fréquentes des dirigeants de PME ; [base de connaissances](${fr("/connaissances")}) — fiches citables.`,
  );
  for (const q of Object.values(QUESTIONS_REFERENCE)) {
    l.push(complet ? `- **${q.question}** ${remplacerJetons(q.reponse)}` : `- ${q.question}`);
  }
  l.push("", "## Observatoire", "");
  l.push(
    `- [${STUDY_NAME_FR}](${fr("/observatoire-ia")}) — étude Axion-IA auprès de dirigeants répondants, échantillon volontaire, questionnaire de ${STUDY_QUESTION_COUNT} questions, données ouvertes ${STUDY_LICENSE_LABEL}.`,
  );
  l.push("", "## Contact", "");
  l.push(`- [Contact](${fr("/contact")}) · [Presse](${fr("/presse")})`);
  return l.join("\n") + "\n";
}
