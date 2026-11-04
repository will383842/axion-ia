import type { BaseAudit } from "../../base-audit-schema";
import type { PropositionFiche, ResumeRapport } from "../contrat";
import type { FicheActuelle } from "../logique";

export const CLIENT = "11111111-1111-4111-8111-111111111111";
export const AUTRE_CLIENT = "22222222-2222-4222-8222-222222222222";
/** Identifiant de rapport par défaut (un UUID, comme en base). */
export const RAPPORT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

export function resume(p: Partial<ResumeRapport> = {}): ResumeRapport {
  return {
    id: RAPPORT,
    version: 1,
    statut: "termine",
    etape: "Terminé",
    progression: 100,
    jetonsEntree: 12_000,
    jetonsSortie: 3_000,
    lanceLe: new Date("2026-11-01T10:00:00Z"),
    termineLe: new Date("2026-11-01T10:20:00Z"),
    lancePar: "Will",
    reponsesJusquau: null,
    erreur: null,
    versionSchema: "base-audit/2",
    ...p,
  };
}

export function proposition(p: Partial<PropositionFiche> = {}): PropositionFiche {
  return {
    champ: "Secteur d'activité",
    valeur: "Confection textile",
    confiance: "etabli",
    sources: [{ type: "registre", reference: "Annuaire des entreprises" }],
    application: "a_cocher",
    ...p,
  };
}

export function ficheVide(
  p: Partial<Record<keyof FicheActuelle, string | null>> = {},
): FicheActuelle {
  return {
    siren: null,
    secteur: null,
    nafCode: null,
    conventionCollective: null,
    idcc: null,
    adresseRue: null,
    adresseCodePostal: null,
    adresseVille: null,
    tvaIntracom: null,
    contactNom: null,
    contactTelephone: null,
    contactFonction: null,
    ...p,
  };
}

/** Une base réduite à ce que l'écran lit (le contrat complet est testé ailleurs). */
export function base(propositions: ReadonlyArray<PropositionFiche>): BaseAudit {
  return {
    meta: { raisonSociale: "Atelier Exemple" },
    propositions_fiche: propositions,
  } as unknown as BaseAudit;
}
