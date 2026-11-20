// GEO V2-05 / V2-06 : les quatre offres « de la suite » de la Journée IA. Source unique des
// noms, des définitions d'une phrase (page, JSON-LD, llms*.txt) et des dates de mise à jour.
//
// Décision de Williams (20/11/2026) : le SEUL montant affiché sur le site est celui de la Journée
// IA. Ces offres sont « sur devis, après un Diagnostic IA gratuit de 45 minutes » : AUCUN montant,
// aucun « à partir de » dans ce fichier ni dans les pages (verrouillé par le test des pages).
// Aucun chiffre de résultat, aucun témoignage, aucune note.

export const DATE_MISE_A_JOUR_OFFRES_SUITE = "2026-11-20";

export type CleOffreSuite =
  "formation-ia-1-plus-30" | "premier-gain-en-service" | "programme-90-jours" | "suivi-ia-mensuel";

export interface OffreSuiteBase {
  readonly cle: CleOffreSuite;
  /** Clé de route (`routing.pathnames`). */
  readonly path: string;
  readonly nom: string;
  readonly definition: string;
}

export const OFFRES_SUITE: readonly OffreSuiteBase[] = [
  {
    cle: "formation-ia-1-plus-30",
    path: "/formation-ia-1-plus-30",
    nom: "Formation IA 1+30",
    definition:
      "La Formation IA 1+30 d’Axion-IA est une Formation d’une journée en entreprise, sur les vrais dossiers des participants, suivie de 30 jours d’accompagnement, où chaque participant repart avec son propre kit d’assistants IA et où le temps gagné sur une tâche réelle est mesuré avant et après.",
  },
  {
    cle: "premier-gain-en-service",
    path: "/premier-gain-en-service",
    nom: "Premier gain en service",
    definition:
      "Le Premier gain en service d’Axion-IA est la mise en service au forfait, par Axion-IA, de la tâche prioritaire identifiée pendant la Journée IA, avec 30 jours de support.",
  },
  {
    cle: "programme-90-jours",
    path: "/programme-90-jours",
    nom: "Programme 90 jours",
    definition:
      "Le Programme 90 jours d’Axion-IA est le plan d’action à 90 jours remis à l’issue de la Journée IA, exécuté par Axion-IA chez le client : gains mis en service, équipe formée et relevé chiffré avant et après.",
  },
  {
    cle: "suivi-ia-mensuel",
    path: "/suivi-ia-mensuel",
    nom: "Suivi IA mensuel",
    definition:
      "Le Suivi IA mensuel d’Axion-IA est un accompagnement récurrent : une session par mois, la maintenance des outils livrés et un bilan trimestriel.",
  },
] as const;

export function offreSuite(cle: CleOffreSuite): OffreSuiteBase {
  const o = OFFRES_SUITE.find((x) => x.cle === cle);
  if (!o) throw new Error(`Offre inconnue : ${cle}`);
  return o;
}

/** Phrase unique de prix : la même sur les quatre pages, dans le JSON-LD et dans llms.txt. */
export const PHRASE_SUR_DEVIS =
  "Cette prestation est sur devis, après un Diagnostic IA gratuit de 45 minutes.";
