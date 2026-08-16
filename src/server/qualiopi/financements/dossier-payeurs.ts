/**
 * Qualiopi — les PAYEURS d'un dossier de financement (chantier T4a).
 *
 * ## Le défaut fermé ici
 *
 * `creerDossierDepuisSession` ne lit que les champs de la SESSION : un
 * financement, un client, un montant. En **inter-entreprises**, c'est faux —
 * chaque inscription porte son propre financeur, son propre payeur et son
 * propre prix de siège (`resolveEnrollmentFinancement` existe depuis R-INTER et
 * n'était pas consommé ici).
 *
 * 🔴 Conséquence : six entreprises inscrites, six OPCO différents → **une seule
 * créance** au dossier, au nom d'un seul client, pour le montant de la session.
 * Le modèle est pourtant déjà multi-payeurs (`DossierPayeur`, N lignes par
 * dossier) : ce n'est pas le schéma qui manquait, c'est le constructeur qui ne
 * s'en servait pas.
 *
 * ## La règle
 *
 * > **Un payeur = une identité qui doit de l'argent.** Deux inscriptions du même
 * > employeur au même titre font UNE créance ; deux employeurs différents en
 * > font deux, même montant, même formation.
 *
 * D'où le regroupement par `(type de payeur, identité)` et non par inscription :
 * envoyer six factures à la même entreprise parce qu'elle a inscrit six
 * salariés serait le défaut symétrique, et celui-là se voit tout de suite.
 *
 * ## Ce que ce module ne fait PAS
 *
 * Il ne facture pas et n'engage rien : il calcule **qui devra combien**. Le
 * dossier reste `a_monter` ; déposer la demande et facturer restent les actes
 * habilités qu'ils sont depuis le Lot 10. Produire ≠ remettre.
 *
 * Aucun import Prisma ni Next : mêmes entrées, mêmes sorties.
 */

import { opcoLabel } from "./opco-referentiel";
import {
  resolveEnrollmentFinancement,
  type EnrollmentFinancementFields,
  type SessionFinancementFallback,
} from "./inter-entreprises";

/** Miroir de l'enum Prisma `DossierPayeurType` — ce module ne dépend pas du client. */
export type TypePayeur = "entreprise" | "opco_subroge" | "france_travail" | "stagiaire";

/** Une inscription, vue par ce module : son financement et son payeur. */
export interface InscriptionPayeur extends EnrollmentFinancementFields {
  /** Identité du client rattaché à CETTE inscription (null → celui de la session). */
  client: { id: string; raisonSociale: string | null; opcoIdentifie: string | null } | null;
}

/** Le contexte de session : repli de financement + identité du client porteur. */
export interface ContexteSessionPayeurs extends SessionFinancementFallback {
  opcoSubrogation: boolean;
  /**
   * Montant déclaré comme pris en charge par le financeur (centimes).
   *
   * ⚠️ N'a de sens QUE pour la ventilation au niveau session : dès qu'il y a des
   * inscriptions, le montant de chaque payeur se dérive des prix de siège, et ce
   * champ n'est plus consulté. Le garder comme repli général ferait cohabiter
   * deux vérités de montant sur le même dossier.
   */
  priseEnChargeMontantCents: number | null;
  client: { id: string; raisonSociale: string | null; opcoIdentifie: string | null } | null;
}

/** Une créance à créer sur le dossier — directement consommable par Prisma. */
export interface LignePayeur {
  payeurType: TypePayeur;
  payeurNom: string;
  montantAttenduCents: number;
}

/**
 * Type de payeur d'un financement donné.
 *
 * ⚠️ `opco` ne devient `opco_subroge` que **s'il y a subrogation**. Sans elle,
 * l'OPCO rembourse le client : c'est donc l'ENTREPRISE qui doit à l'organisme,
 * et inscrire l'OPCO comme payeur ferait attendre un virement qui n'arrivera
 * jamais. C'est la même distinction que celle qui décide du destinataire de la
 * facture (`destinataire-facture.ts`) — deux endroits, une seule idée.
 */
export function typePayeurDe(
  financementType: string | null | undefined,
  opcoSubrogation: boolean,
): TypePayeur {
  switch ((financementType ?? "").trim().toLowerCase()) {
    case "opco":
      return opcoSubrogation ? "opco_subroge" : "entreprise";
    case "cpf":
      // La part CPF transite par la Caisse des Dépôts ; ce qui reste dû à
      // l'organisme est le reste à charge du bénéficiaire.
      return "stagiaire";
    case "france_travail":
      return "france_travail";
    default:
      // `direct`, `mixte`, inconnu, absent : l'employeur paie.
      return "entreprise";
  }
}

/**
 * Identité affichée du payeur, et clé de regroupement.
 *
 * 🔴 La clé n'est PAS le nom : deux entreprises peuvent porter la même raison
 * sociale, et une raison sociale peut manquer. On regroupe sur l'identifiant
 * quand il existe, et le nom n'est qu'un libellé.
 */
function identitePayeur(
  type: TypePayeur,
  client: { id: string; raisonSociale: string | null; opcoIdentifie: string | null } | null,
): { cle: string; nom: string } {
  switch (type) {
    case "opco_subroge": {
      const slug = client?.opcoIdentifie?.trim();
      // Deux entreprises relevant du MÊME OPCO ne font qu'un débiteur : c'est
      // l'OPCO qui paie, et il paiera une fois.
      return slug != null && slug !== ""
        ? { cle: `opco:${slug}`, nom: opcoLabel(slug) }
        : { cle: "opco:inconnu", nom: "OPCO (à préciser)" };
    }
    case "france_travail":
      return { cle: "france_travail", nom: "France Travail" };
    case "stagiaire":
      // Regroupé par entreprise d'appartenance : le reste à charge des
      // bénéficiaires d'un même employeur se suit ensemble. Nominatif ici
      // n'aurait pas de sens — la créance se règle au niveau du dossier.
      return {
        cle: `stagiaire:${client?.id ?? "sans-client"}`,
        nom: "Bénéficiaires (reste à charge)",
      };
    case "entreprise":
      return client?.id != null
        ? { cle: `entreprise:${client.id}`, nom: client.raisonSociale ?? "Entreprise" }
        : { cle: "entreprise:sans-client", nom: "Entreprise" };
  }
}

/**
 * Construit les créances d'un dossier à partir des inscriptions.
 *
 * Retourne une liste **triée par montant décroissant** : la plus grosse créance
 * en tête, c'est celle qu'on relance en premier.
 *
 * 🔴 Sur une session SANS inscription, rend une créance unique au niveau
 * session — le comportement historique, à l'identique. Un dossier ouvert à la
 * déclaration du financement précède souvent les inscriptions : rendre une
 * liste vide effacerait le montant attendu, et le cockpit afficherait une
 * affaire à 0 €.
 */
export function construireLignesPayeurs(
  inscriptions: ReadonlyArray<InscriptionPayeur>,
  session: ContexteSessionPayeurs,
): LignePayeur[] {
  if (inscriptions.length === 0) {
    return lignesAuNiveauSession(session);
  }

  const parPayeur = new Map<string, LignePayeur>();
  for (const inscription of inscriptions) {
    const resolu = resolveEnrollmentFinancement(inscription, session);
    const type = typePayeurDe(resolu.financementType, session.opcoSubrogation);
    // L'identité suit l'inscription quand elle en porte une (inter), sinon
    // celle de la session (intra).
    const client = inscription.client ?? session.client;
    const { cle, nom } = identitePayeur(type, client);

    const montant = Math.max(0, resolu.montantHtCents);
    const existant = parPayeur.get(cle);
    if (existant) {
      existant.montantAttenduCents += montant;
    } else {
      parPayeur.set(cle, { payeurType: type, payeurNom: nom, montantAttenduCents: montant });
    }
  }

  // ⚠️ Une créance à 0 € est conservée si elle est SEULE : la retirer rendrait
  // un dossier sans aucun payeur, donc un dossier qu'aucune relance ne peut
  // viser. À plusieurs, une ligne à 0 est du bruit.
  const lignes = [...parPayeur.values()];
  const nonNulles = lignes.filter((l) => l.montantAttenduCents > 0);
  const retenues = nonNulles.length > 0 ? nonNulles : lignes;

  return retenues.sort(
    (a, b) =>
      b.montantAttenduCents - a.montantAttenduCents || a.payeurNom.localeCompare(b.payeurNom),
  );
}

/**
 * Montant réellement DEMANDÉ à un financeur, dérivé des créances.
 *
 * Ne compte que les payeurs qui versent à l'organisme — `opco_subroge` et
 * `france_travail`. L'entreprise et le bénéficiaire ne « demandent » rien : ils
 * doivent.
 *
 * 🔴 Repli sur l'ancienne formule quand aucune ligne financeur n'existe. Sans
 * lui, un dossier en financement direct — ou un OPCO SANS subrogation, où
 * personne ne verse à l'organisme — afficherait « 0 € demandé », ce qui se lit
 * comme une erreur de génération plutôt que comme l'absence de demande.
 */
export function montantDemandeFinanceurCents(
  lignes: ReadonlyArray<LignePayeur>,
  repli: { priseEnCharge: number; montantSessionCents: number },
): number {
  const duFinanceur = lignes
    .filter((l) => l.payeurType === "opco_subroge" || l.payeurType === "france_travail")
    .reduce((n, l) => n + l.montantAttenduCents, 0);
  if (duFinanceur > 0) return duFinanceur;
  return repli.priseEnCharge > 0 ? repli.priseEnCharge : repli.montantSessionCents;
}

/**
 * Comportement historique : une session sans inscription porte une créance
 * unique, éventuellement scindée entre l'OPCO subrogé et le reste à charge.
 */
function lignesAuNiveauSession(session: ContexteSessionPayeurs): LignePayeur[] {
  const type = typePayeurDe(session.financementType, session.opcoSubrogation);
  const { nom } = identitePayeur(type, session.client);
  const total = Math.max(0, session.montantHtCents);

  if (type !== "opco_subroge") {
    return [{ payeurType: type, payeurNom: nom, montantAttenduCents: total }];
  }

  // En subrogation, le montant pris en charge est celui déclaré sur la session ;
  // le solde reste dû par l'entreprise. C'est la ventilation que portait déjà
  // `creerDossierDepuisSession`, conservée mot pour mot.
  const priseEnCharge = Math.max(0, Math.min(total, session.priseEnChargeMontantCents ?? 0));
  const resteACharge = total - priseEnCharge;
  const entreprise = identitePayeur("entreprise", session.client);

  return [
    { payeurType: "opco_subroge", payeurNom: nom, montantAttenduCents: priseEnCharge },
    ...(resteACharge > 0
      ? [
          {
            payeurType: "entreprise" as const,
            payeurNom: entreprise.nom,
            montantAttenduCents: resteACharge,
          },
        ]
      : []),
  ];
}
