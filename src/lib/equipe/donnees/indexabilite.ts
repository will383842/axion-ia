/**
 * Règle d'indexation d'une fiche collaborateur : un CALCUL, pas une colonne stockée.
 *
 * Une fiche publiée n'est INDEXÉE que si elle a (a) une vraie photo (`photoKind = "reelle"` ET
 * consentement photo) ET (b) au moins `SEUIL_ELEMENTS_PROPRES` éléments propres à la personne. Sinon :
 * `noindex, follow` ; la fiche reste visible sur le hub et par son URL.
 *
 * Fonction pure : aucune lecture de base, aucun accès réseau. Elle sert aux métadonnées robots, au
 * sitemap et à la pastille de la console. Les constantes ci-dessous s'ajustent sans migration.
 */
import { estCategorieEquipe } from "./categories";
import {
  getQuestionnaire,
  QUESTIONNAIRE_VERSION_COURANTE,
  type QuestionIndexabilite,
} from "./questionnaires";

export const SEUIL_ELEMENTS_PROPRES = 3;
export const PRESENTATION_MIN_CARACTERES = 300;
export const COMPETENCES_MIN = 3;
export const EXEMPLE_MIN_CARACTERES = 120;
export const PARCOURS_MIN_CARACTERES = 20;

/** Ce que la fonction lit d'une fiche : un sous-ensemble de `TeamMember`, sans identité ni contact. */
export interface MembreIndexable {
  readonly category: string;
  readonly questionnaireVersion: string | null;
  readonly photoKind: string;
  readonly photoConsentAt: Date | null;
  readonly bioMd: string | null;
  readonly skills: readonly string[];
  readonly languages: readonly string[];
  readonly categoryAnswers: unknown;
  readonly linkedinUrl: string | null;
  readonly linkedinConsentAt: Date | null;
  readonly websiteUrl: string | null;
}

export type ElementPropre =
  "presentation" | "competences" | "exemple" | "parcours" | "lien_public" | "langues";

export interface ResultatIndexabilite {
  readonly indexable: boolean;
  readonly elementsPropres: number;
  /** Les éléments obtenus. */
  readonly elements: readonly ElementPropre[];
  /** Ce qu'il manque, en français, pour la pastille de la console. */
  readonly manque: readonly string[];
}

const LIBELLES_ELEMENTS: Record<ElementPropre, string> = {
  presentation: `une présentation personnelle d'au moins ${PRESENTATION_MIN_CARACTERES} caractères`,
  competences: `au moins ${COMPETENCES_MIN} compétences`,
  exemple: `un exemple concret ou une réalisation (${EXEMPLE_MIN_CARACTERES} caractères au moins)`,
  parcours: "un parcours ou des certifications",
  lien_public: "un lien LinkedIn affiché (avec accord) ou un site personnel",
  langues: "une langue parlée autre que le français",
};

function longueur(valeur: unknown): number {
  return typeof valeur === "string" ? valeur.trim().length : 0;
}

function reponsesMarquees(membre: MembreIndexable, marque: QuestionIndexabilite): string[] {
  if (!estCategorieEquipe(membre.category)) return [];
  const brut = membre.categoryAnswers;
  if (brut === null || typeof brut !== "object" || Array.isArray(brut)) return [];
  const questionnaire = getQuestionnaire(
    membre.category,
    membre.questionnaireVersion ?? QUESTIONNAIRE_VERSION_COURANTE,
  );
  if (questionnaire === null) return [];
  const reponses = brut as Record<string, unknown>;
  return questionnaire.questions
    .filter((question) => question.indexabilite === marque)
    .map((question) => reponses[question.id])
    .filter((v): v is string => typeof v === "string");
}

function estUrlHttps(valeur: string | null): boolean {
  if (valeur === null) return false;
  try {
    return new URL(valeur.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

const EST_FRANCAIS = /^(fr|français|francais|french)$/i;

export function evaluerIndexabilite(membre: MembreIndexable): ResultatIndexabilite {
  const elements: ElementPropre[] = [];

  if (longueur(membre.bioMd) >= PRESENTATION_MIN_CARACTERES) elements.push("presentation");
  if (membre.skills.filter((s) => s.trim() !== "").length >= COMPETENCES_MIN)
    elements.push("competences");
  if (reponsesMarquees(membre, "exemple").some((r) => longueur(r) >= EXEMPLE_MIN_CARACTERES)) {
    elements.push("exemple");
  }
  if (reponsesMarquees(membre, "parcours").some((r) => longueur(r) >= PARCOURS_MIN_CARACTERES)) {
    elements.push("parcours");
  }
  const linkedinAffiche = membre.linkedinConsentAt !== null && estUrlHttps(membre.linkedinUrl);
  if (linkedinAffiche || estUrlHttps(membre.websiteUrl)) elements.push("lien_public");
  if (membre.languages.some((l) => l.trim() !== "" && !EST_FRANCAIS.test(l.trim()))) {
    elements.push("langues");
  }

  const vraiePhoto = membre.photoKind === "reelle" && membre.photoConsentAt !== null;
  const manque: string[] = [];
  if (!vraiePhoto) manque.push("une vraie photo avec l'accord de la personne");
  if (elements.length < SEUIL_ELEMENTS_PROPRES) {
    const reste = SEUIL_ELEMENTS_PROPRES - elements.length;
    const restants = (Object.keys(LIBELLES_ELEMENTS) as ElementPropre[])
      .filter((e) => !elements.includes(e))
      .map((e) => LIBELLES_ELEMENTS[e])
      .join(" ; ");
    manque.push(
      `${reste} élément${reste > 1 ? "s" : ""} propre${reste > 1 ? "s" : ""} à la personne parmi : ${restants}`,
    );
  }

  return { indexable: manque.length === 0, elementsPropres: elements.length, elements, manque };
}
