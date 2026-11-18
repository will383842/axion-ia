/**
 * Gabarits d'e-mail adressés au fondateur (alertes internes), jamais au client.
 *
 * Certains portent un `entityType` Devis, DocumentGenere ou FactureFormation, donc le journal les
 * rattache à la fiche client. La fiche ne doit pas les compter comme des e-mails envoyés au
 * client (bandeau « Dernier e-mail », fil des échanges). Le journal admin, lui, les garde : y voir
 * l'alerte reliée au client est voulu.
 *
 * Liste unique : tout nouveau gabarit adressé à `destinataireAlertesInternes()` s'ajoute ici.
 */

export const GABARITS_INTERNES = [
  "qualiopi-alerte-interne",
  "devis-signe-a-contresigner",
  "apporteur-dossier-a-verifier",
  "apporteur-declaration-recue",
] as const;

const INTERNES: ReadonlySet<string> = new Set(GABARITS_INTERNES);

export function estGabaritInterne(gabarit: string | null | undefined): boolean {
  return gabarit != null && INTERNES.has(gabarit);
}
