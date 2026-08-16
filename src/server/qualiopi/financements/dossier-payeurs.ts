/**
 * Qualiopi — les PAYEURS d'un dossier de financement (T4a + décisions du financeur).
 *
 * ## Les défauts fermés ici
 *
 * **1. Le dossier ne connaissait qu'un payeur.** `creerDossierDepuisSession` ne
 * lisait que les champs de la SESSION : un financement, un client, un montant.
 * En **inter-entreprises**, c'est faux — chaque inscription porte son financeur,
 * son payeur et son prix de siège. Six entreprises relevant de six OPCO ne
 * faisaient donc qu'**une seule créance**, alors que `DossierPayeur` est
 * multi-payeurs depuis l'origine : ce n'est pas le schéma qui manquait, c'est le
 * constructeur qui ne s'en servait pas.
 *
 * **2. Rien ne se recalculait quand le financeur décidait autre chose.**
 * Constat du 16/08 (question de Will) : que se passe-t-il si l'OPCO ne prend
 * qu'une **partie** en charge, s'il **change** son montant après coup, ou s'il
 * **annule** ? Réponse d'alors : rien. Les lignes de créance étaient écrites une
 * fois à la création et **jamais mises à jour** — aucun code du dépôt n'écrivait
 * dans `DossierPayeur` après le `create`. Le reste à charge du client restait
 * donc faux, et personne n'était prévenu qu'il devenait débiteur du tout.
 *
 * ## La règle qui résout les trois cas d'un coup
 *
 * > **La ventilation est une fonction PURE de trois choses : les inscriptions,
 * > la session, et le montant que le financeur retient.**
 *
 * Il n'y a donc pas trois mécanismes (partiel / révisé / annulé) mais **un
 * seul plafond**, dont la valeur change :
 *
 * | Situation | Plafond financeur |
 * |---|---|
 * | Prise en charge déclarée à la création | `priseEnChargeMontantCents` |
 * | Accord reçu, éventuellement révisé | `montantAccordeCents` |
 * | **Refus, ou annulation de la prise en charge** | **0** |
 * | Aucun montant connu | `null` — le financeur couvre ce qui le concerne |
 *
 * Ce que le plafond retire au financeur **retombe sur l'entreprise du siège
 * concerné**, jamais dans le vide : c'est précisément ce que dit le contrat —
 * le client demeure débiteur du prix.
 *
 * 🔴 D'où la structure interne : on calcule d'abord une créance **par siège**,
 * qui garde le lien financeur ↔ entreprise, et on n'agrège qu'à la fin. Agréger
 * d'abord perdrait ce lien, et on ne saurait plus à QUELLE entreprise rendre la
 * part refusée — en inter-entreprises, il y en a plusieurs.
 *
 * ## Ce que ce module ne fait PAS
 *
 * Il ne facture pas et n'engage rien : il calcule **qui devra combien**. Déposer
 * la demande et facturer restent les actes habilités du Lot 10.
 * Produire ≠ remettre.
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

/** Identité d'un client, réduite à ce dont la ventilation a besoin. */
export interface ClientPayeur {
  id: string;
  raisonSociale: string | null;
  opcoIdentifie: string | null;
}

/** Une inscription, vue par ce module : son financement et son payeur. */
export interface InscriptionPayeur extends EnrollmentFinancementFields {
  /** Identité du client rattaché à CETTE inscription (null → celui de la session). */
  client: ClientPayeur | null;
}

/** Le contexte de session : repli de financement + identité du client porteur. */
export interface ContexteSessionPayeurs extends SessionFinancementFallback {
  opcoSubrogation: boolean;
  /**
   * Montant déclaré comme pris en charge par le financeur (centimes), à la
   * création du dossier. Sert de plafond par défaut.
   */
  priseEnChargeMontantCents: number | null;
  client: ClientPayeur | null;
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
 * jamais. Même distinction que celle qui décide du destinataire de la facture.
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
 * Un payeur verse-t-il à l'organisme au titre d'un financement EXTERNE ?
 *
 * C'est cette famille que le plafond du financeur borne. L'entreprise et le
 * bénéficiaire n'en font pas partie : ils ne « prennent pas en charge », ils
 * doivent — et c'est sur eux que retombe ce que le financeur ne couvre pas.
 */
function estFinanceur(type: TypePayeur): boolean {
  return type === "opco_subroge" || type === "france_travail";
}

/** Identité d'un payeur, et clé de regroupement. */
function identitePayeur(
  type: TypePayeur,
  client: ClientPayeur | null,
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
      // bénéficiaires d'un même employeur se suit ensemble.
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
 * Une créance de siège AVANT plafond : qui devrait payer, et à défaut qui doit.
 *
 * 🔴 `retombeeSur` est le cœur du mécanisme. C'est l'identité qui récupère la
 * part que le financeur ne couvre pas. Sans elle, on saurait qu'il manque de
 * l'argent sans savoir à qui le réclamer — et en inter-entreprises il y a
 * plusieurs candidats.
 */
interface CreanceSiege {
  financeur: { type: TypePayeur; cle: string; nom: string } | null;
  retombeeSur: { type: TypePayeur; cle: string; nom: string };
  montantCents: number;
}

/** Traduit une inscription (ou la session entière) en créance de siège. */
function creanceDeSiege(
  financementType: string | null,
  montantCents: number,
  client: ClientPayeur | null,
  opcoSubrogation: boolean,
): CreanceSiege {
  const type = typePayeurDe(financementType, opcoSubrogation);
  const identite = identitePayeur(type, client);

  if (!estFinanceur(type)) {
    // Personne d'externe ne paie : le débiteur est déjà le bon.
    return {
      financeur: null,
      retombeeSur: { type, ...identite },
      montantCents: Math.max(0, montantCents),
    };
  }

  // Ce que le financeur ne couvre pas revient à l'EMPLOYEUR du siège — pas au
  // bénéficiaire, et pas au client porteur de la session quand l'inscription en
  // désigne un autre.
  const entreprise = identitePayeur("entreprise", client);
  return {
    financeur: { type, ...identite },
    retombeeSur: { type: "entreprise", ...entreprise },
    montantCents: Math.max(0, montantCents),
  };
}

/** Options de ventilation. */
export interface OptionsVentilation {
  /**
   * Montant TOTAL que le financeur retient, en centimes.
   *
   * - `null` / absent → aucun plafond connu : le financeur couvre les sièges
   *   qui le concernent (c'est la demande, pas encore la réponse) ;
   * - un nombre → ce que le financeur prend réellement en charge. **`0` = refus
   *   ou annulation** : tout retombe sur les entreprises.
   */
  plafondFinanceurCents?: number | null;
}

/**
 * Construit les créances d'un dossier.
 *
 * Retourne une liste **triée par montant décroissant** : la plus grosse créance
 * en tête, c'est celle qu'on relance en premier.
 *
 * 🔴 Sur une session SANS inscription, la ventilation porte sur un siège unique
 * au montant de la session — le comportement historique, à l'identique. Un
 * dossier ouvert à la déclaration du financement précède souvent les
 * inscriptions : rendre une liste vide effacerait le montant attendu, et le
 * cockpit afficherait une affaire à 0 €.
 */
export function construireLignesPayeurs(
  inscriptions: ReadonlyArray<InscriptionPayeur>,
  session: ContexteSessionPayeurs,
  options: OptionsVentilation = {},
): LignePayeur[] {
  const creances: CreanceSiege[] =
    inscriptions.length === 0
      ? [
          creanceDeSiege(
            session.financementType,
            session.montantHtCents,
            session.client,
            session.opcoSubrogation,
          ),
        ]
      : inscriptions.map((inscription) => {
          const resolu = resolveEnrollmentFinancement(inscription, session);
          // L'identité suit l'inscription quand elle en porte une (inter),
          // sinon celle de la session (intra).
          return creanceDeSiege(
            resolu.financementType,
            resolu.montantHtCents,
            inscription.client ?? session.client,
            session.opcoSubrogation,
          );
        });

  const plafond =
    options.plafondFinanceurCents !== undefined
      ? options.plafondFinanceurCents
      : session.priseEnChargeMontantCents;

  return agreger(appliquerPlafondFinanceur(creances, plafond));
}

/**
 * Répartit le plafond du financeur sur les sièges qu'il concerne, au prorata.
 *
 * 🔴 Au prorata, et pas « au premier arrivé » : servir les premiers sièges à
 * 100 % et laisser les derniers à 0 ferait porter tout le reste à charge à une
 * ou deux entreprises, choisies par l'ordre de la requête. Personne ne pourrait
 * expliquer au client pourquoi c'est lui.
 *
 * L'arrondi en centimes est donné au siège le plus gros : le total ventilé est
 * ainsi rigoureusement égal au plafond, sans centime perdu ni inventé.
 */
function appliquerPlafondFinanceur(
  creances: ReadonlyArray<CreanceSiege>,
  plafondCents: number | null | undefined,
): Array<{ cle: string; type: TypePayeur; nom: string; montantCents: number }> {
  const lignes: Array<{ cle: string; type: TypePayeur; nom: string; montantCents: number }> = [];

  const avecFinanceur = creances.filter((c) => c.financeur !== null);
  const brutFinanceur = avecFinanceur.reduce((n, c) => n + c.montantCents, 0);

  // Aucun plafond connu, ou plafond couvrant tout : chaque siège va à son payeur.
  const sansPlafond = plafondCents === null || plafondCents === undefined;
  const plafond = sansPlafond ? brutFinanceur : Math.max(0, Math.min(plafondCents, brutFinanceur));

  // Part de chaque siège financé, au prorata du plafond.
  const parts = new Map<CreanceSiege, number>();
  if (brutFinanceur > 0) {
    let cumul = 0;
    // Le plus gros siège en dernier : c'est lui qui absorbe l'arrondi.
    const ordonnes = [...avecFinanceur].sort((a, b) => a.montantCents - b.montantCents);
    ordonnes.forEach((c, i) => {
      const dernier = i === ordonnes.length - 1;
      const part = dernier
        ? plafond - cumul
        : Math.floor((c.montantCents * plafond) / brutFinanceur);
      parts.set(c, Math.max(0, Math.min(part, c.montantCents)));
      cumul += part;
    });
  }

  for (const creance of creances) {
    const partFinanceur = creance.financeur !== null ? (parts.get(creance) ?? 0) : 0;
    const reste = creance.montantCents - partFinanceur;

    if (creance.financeur !== null && partFinanceur > 0) {
      lignes.push({
        cle: creance.financeur.cle,
        type: creance.financeur.type,
        nom: creance.financeur.nom,
        montantCents: partFinanceur,
      });
    }
    if (reste > 0 || creance.financeur === null) {
      lignes.push({
        cle: creance.retombeeSur.cle,
        type: creance.retombeeSur.type,
        nom: creance.retombeeSur.nom,
        montantCents: Math.max(0, reste),
      });
    }
  }

  return lignes;
}

/** Regroupe par identité de payeur et trie par montant décroissant. */
function agreger(
  lignes: ReadonlyArray<{ cle: string; type: TypePayeur; nom: string; montantCents: number }>,
): LignePayeur[] {
  const parPayeur = new Map<string, LignePayeur>();
  for (const l of lignes) {
    const existant = parPayeur.get(l.cle);
    if (existant) {
      existant.montantAttenduCents += l.montantCents;
    } else {
      parPayeur.set(l.cle, {
        payeurType: l.type,
        payeurNom: l.nom,
        montantAttenduCents: l.montantCents,
      });
    }
  }

  // ⚠️ Une créance à 0 € est conservée si elle est SEULE : la retirer rendrait
  // un dossier sans aucun payeur, donc un dossier qu'aucune relance ne peut
  // viser. À plusieurs, une ligne à 0 est du bruit.
  const toutes = [...parPayeur.values()];
  const nonNulles = toutes.filter((l) => l.montantAttenduCents > 0);
  const retenues = nonNulles.length > 0 ? nonNulles : toutes.slice(0, 1);

  return retenues.sort(
    (a, b) =>
      b.montantAttenduCents - a.montantAttenduCents || a.payeurNom.localeCompare(b.payeurNom),
  );
}

/**
 * Montant réellement DEMANDÉ à un financeur, dérivé des créances.
 *
 * Ne compte que les payeurs qui versent à l'organisme. L'entreprise et le
 * bénéficiaire ne « demandent » rien : ils doivent.
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
    .filter((l) => estFinanceur(l.payeurType))
    .reduce((n, l) => n + l.montantAttenduCents, 0);
  if (duFinanceur > 0) return duFinanceur;
  return repli.priseEnCharge > 0 ? repli.priseEnCharge : repli.montantSessionCents;
}
