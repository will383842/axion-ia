/**
 * E-invoicing (Phase 6) — adaptateur Plateforme Agréée (pattern adapter).
 *
 * La PA n'est PAS encore choisie (décision Will, Phase 0 du plan — offres
 * gratuites : Tiime, Indy…). Ce module fige l'INTERFACE que l'intégration
 * réelle implémentera début 2027 (échéance émission : 1/9/2027) : le reste du
 * code programme contre `PlateformeAgreeeAdapter`, le jour venu on ajoute un
 * `TiimeAdapter`/`IndyAdapter` sans toucher aux appelants.
 *
 * `PA_PROVIDER` (raw env, convention flag.ts) sélectionne l'implémentation ;
 * absent → stub explicite (dépôt refusé avec message actionnable).
 */

export interface DepotFactureInput {
  /** XML EN 16931 (CII) généré par cii.ts. */
  xml: string;
  numero: string;
  /** SIRET de l'acheteur (routage annuaire). */
  acheteurSiret: string;
}

export interface DepotFactureResult {
  depotId: string;
  /** Cycle de vie PA : deposee → (rejetee | refusee | encaissee). */
  statut: "deposee" | "rejetee";
  message?: string;
}

export interface PlateformeAgreeeAdapter {
  readonly nom: string;
  deposerFacture(input: DepotFactureInput): Promise<DepotFactureResult>;
}

/** Stub tant que la PA n'est pas choisie — échec EXPLICITE, jamais silencieux. */
class StubPaAdapter implements PlateformeAgreeeAdapter {
  readonly nom = "stub";
  deposerFacture(input: DepotFactureInput): Promise<DepotFactureResult> {
    return Promise.resolve({
      depotId: "",
      statut: "rejetee",
      message: `Plateforme Agréée non configurée (PA_PROVIDER absent) — choisir la PA (Tiime/Indy…) et implémenter son adaptateur avant l'échéance du 1/9/2027. Facture ${input.numero} NON déposée.`,
    });
  }
}

/** Résout l'adaptateur PA depuis l'env. Défaut sécurisé : stub explicite. */
export function resolvePaAdapter(): PlateformeAgreeeAdapter {
  const provider = process.env.PA_PROVIDER;
  switch (provider) {
    // case "tiime": return new TiimeAdapter(); — à implémenter au choix de la PA.
    default:
      return new StubPaAdapter();
  }
}
