// Score IA TPE-PME — construction des 15 questions (libellés, options, ordre), côté serveur.
// Données pures passées en props au composant client : aucun JSON i18n dans le JavaScript.

import { KB_SECTOR_TAGS } from "@/content/knowledge/sector-tags";
import { STUDY_REGIONS } from "@/content/observatoire/study";
import { BARRIERS_MAX_SELECTIONS } from "@/content/observatoire/questions";
import { LIBELLES_SCORE, ORDRE_AFFICHAGE } from "@/lib/score-ia-pme/libelles";
import { ECRANS } from "@/content/score-ia-pme/textes";
import { ORDRE_QUESTIONS, type CleQuestion } from "@/content/score-ia-pme/ordre";
import type { OptionProps, QuestionProps } from "./types";

const FAMILLES: Readonly<Record<string, string>> = {
  tertiaire: "Services",
  industrie: "Industrie",
  sante: "Santé",
  agroalimentaire: "Agroalimentaire",
  commerce: "Commerce",
  mode_luxe: "Mode et luxe",
  culture_creatif: "Culture et création",
  public_recherche: "Secteur public et recherche",
};

const MULTIPLES: ReadonlySet<CleQuestion> = new Set(["useCases", "tools", "barriers"]);
const SANS_EFFET_SUR_SCORE: ReadonlySet<CleQuestion> = new Set(["region", "respondentRole"]);

/** Options d'une question, dans l'ordre d'affichage du Score (échelle du plus faible au plus fort). */
export function optionsDe(id: CleQuestion): OptionProps[] {
  const libelles = LIBELLES_SCORE[id]?.options ?? {};
  if (id === "sector") {
    const ordreFamilles = [...new Set(KB_SECTOR_TAGS.map((s) => s.categorie))];
    const tries = ordreFamilles.flatMap((f) =>
      KB_SECTOR_TAGS.filter((s) => s.categorie === f).map((s) => ({
        value: s.slug,
        label: s.labelFr,
        groupe: FAMILLES[f] ?? f,
      })),
    );
    return [...tries, { value: "autre", label: libelles["autre"] ?? "Autre secteur" }];
  }
  if (id === "region") {
    return [
      ...STUDY_REGIONS.map((r) => ({ value: r.slug, label: r.nameFr })),
      ...["outre-mer", "non-precisee"].map((v) => ({ value: v, label: libelles[v] ?? v })),
    ];
  }
  return (ORDRE_AFFICHAGE[id] ?? []).map((v) => ({ value: v, label: libelles[v] ?? v }));
}

export function construireQuestions(): QuestionProps[] {
  return ORDRE_QUESTIONS.map((id) => {
    const multi = MULTIPLES.has(id);
    const note = SANS_EFFET_SUR_SCORE.has(id) ? ECRANS.noteSansEffetSurScore : undefined;
    return {
      id,
      type: multi ? "multi" : "single",
      label: LIBELLES_SCORE[id]?.label ?? id,
      options: optionsDe(id),
      ...(multi ? { exclusif: "none", melanger: true } : {}),
      ...(id === "barriers" ? { max: BARRIERS_MAX_SELECTIONS } : {}),
      ...(note ? { note } : {}),
    };
  });
}
