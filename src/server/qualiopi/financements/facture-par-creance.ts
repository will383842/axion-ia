/**
 * Qualiopi — UNE FACTURE PAR CRÉANCE du dossier de financement.
 *
 * ## Les deux défauts fermés ici, qui n'en faisaient qu'un
 *
 * **1. En subrogation, le reste à charge n'était facturable à personne.**
 * Les deux émetteurs de facture au niveau session portaient :
 *
 * ```ts
 * const destinataireEffectif = opcoSubrogation ? "opco" : destinataire;
 * ```
 *
 * Le destinataire choisi par l'humain était donc **écrasé** dès que la
 * subrogation était cochée : impossible d'émettre la facture du reste à charge
 * à l'entreprise. Le seul contournement était une « facture libre » ressaisie à
 * la main, sans aucun lien avec le dossier.
 *
 * 🔴 Or la règle métier n'a jamais été douteuse — plan console, Lot 8, étape 6 :
 * *« subrogation OPCO : l'OPCO paie sa part, le client le reste à charge »*.
 * **Deux factures par dossier subrogé.** Ce qui manquait n'était pas la
 * décision, c'était le chemin.
 *
 * **2. Aucune facture n'était jamais rattachée à son dossier.**
 * `FactureFormation.dossierFinancementId` existe au schéma et **aucun émetteur
 * ne l'écrivait**. Conséquence en chaîne : `marquerPaiementRecuSiSoldee` était
 * du code mort (sa condition n'était jamais vraie), un dossier n'atteignait
 * jamais `paiement_recu` autrement qu'à la main, et le pilotage ne voyait
 * jamais un euro encaissé. `DossierPayeur.factureFormationId` restait nul lui
 * aussi : on ne savait pas quelle créance avait été facturée.
 *
 * ## 🔑 La clé : c'est le même chantier
 *
 * `DossierPayeur` est multi-payeurs depuis l'origine et porte déjà
 * `factureFormationId`. Le modèle a été conçu pour ceci :
 *
 * > **Une facture par ligne de payeur.** Le dossier subrogé porte deux créances
 * > — OPCO et entreprise — donc deux factures, et chaque ligne pointe vers la
 * > sienne.
 *
 * Émettre par créance résout les deux symptômes d'un coup : le destinataire
 * vient de la ligne (plus besoin de l'écraser), le montant aussi (plus de
 * double comptage), et le rattachement s'écrit au moment de l'émission.
 *
 * ## Ce que ce module ne fait PAS
 *
 * Il ne facture pas : il **choisit la créance** et dit pourquoi quand il refuse.
 * Émettre reste un acte habilité (`requireHabilitation("facturer")`).
 *
 * Aucun import Prisma ni Next : mêmes entrées, mêmes sorties.
 */

import type { FactureFormationDestinataire } from "../../../../prisma/generated/client";
import type { TypePayeur } from "./dossier-payeurs";

/** Une créance du dossier, vue par ce module. */
export interface CreanceFacturable {
  id: string;
  payeurType: TypePayeur;
  payeurNom: string;
  montantAttenduCents: number;
  /** Facture DÉJÀ émise sur cette créance — `null` tant qu'elle ne l'est pas. */
  factureFormationId: string | null;
}

/**
 * Correspondance créance → destinataire de facture.
 *
 * 🔴 Un-pour-un, et c'est ce qui rend l'émission par créance possible : chaque
 * ligne de payeur désigne sans ambiguïté à qui la facture est libellée. Le
 * `destinataire` demandé par l'écran doit correspondre à une créance qui
 * existe — sinon on facturerait quelqu'un que le dossier ne reconnaît pas
 * comme débiteur.
 */
const DESTINATAIRE_DE: Record<TypePayeur, FactureFormationDestinataire> = {
  opco_subroge: "opco",
  entreprise: "entreprise",
  france_travail: "france_travail",
  stagiaire: "stagiaire",
};

export type RefusFacture =
  "aucune_creance" | "destinataire_inconnu" | "deja_facturee" | "montant_nul";

export type ChoixCreance =
  | { ok: true; creance: CreanceFacturable; montantHtCents: number }
  | { ok: false; raison: RefusFacture; message: string };

/**
 * Choisit la créance à facturer pour un destinataire donné.
 *
 * @param creances les lignes `DossierPayeur` du dossier rattaché à la session.
 * @param destinataire celui demandé par l'écran — **plus jamais écrasé**.
 *
 * ⚠️ Rend `aucune_creance` quand le dossier n'en porte pas : l'appelant doit
 * alors retomber sur le comportement historique (facturer le montant de la
 * session au destinataire demandé), et surtout PAS traiter ce cas comme une
 * erreur. Un dossier peut légitimement ne pas exister — financement direct,
 * affaire antérieure au mécanisme — et l'émission doit rester possible.
 */
export function choisirCreancePourFacture(
  creances: ReadonlyArray<CreanceFacturable>,
  destinataire: FactureFormationDestinataire,
): ChoixCreance {
  if (creances.length === 0) {
    return {
      ok: false,
      raison: "aucune_creance",
      message: "Aucun dossier de financement ne porte de créance pour cette session.",
    };
  }

  const correspondantes = creances.filter((c) => DESTINATAIRE_DE[c.payeurType] === destinataire);

  if (correspondantes.length === 0) {
    // 🔴 Le message NOMME les débiteurs réels. Un refus qui dit seulement
    // « destinataire invalide » laisse chercher ; celui-ci dit à qui la facture
    // peut être adressée, et referme du même coup le trou « on peut choisir
    // OPCO sans subrogation » — l'OPCO n'est une créance que s'il en porte une.
    const debiteurs = creances.map((c) => c.payeurNom).join(", ");
    return {
      ok: false,
      raison: "destinataire_inconnu",
      message: `Ce dossier ne reconnaît pas ce destinataire comme débiteur. Créances ouvertes : ${debiteurs}.`,
    };
  }

  const libre = correspondantes.find((c) => c.factureFormationId === null);
  if (libre === undefined) {
    // Même famille de garde que l'anti-double-émission par inscription en
    // inter-entreprises : chaque facture consomme un NUMÉRO LÉGAL, et facturer
    // deux fois la même créance réclame deux fois la même somme.
    return {
      ok: false,
      raison: "deja_facturee",
      message:
        "Cette créance est déjà facturée. Annulez la facture existante avant d'en émettre une nouvelle.",
    };
  }

  if (libre.montantAttenduCents <= 0) {
    // Une créance à 0 € existe (subrogation totale : le reste à charge est nul
    // et la ligne est conservée pour que le dossier ait toujours un débiteur).
    // L'émettre produirait une facture à zéro, que rien ne peut encaisser.
    return {
      ok: false,
      raison: "montant_nul",
      message: `La créance de ${libre.payeurNom} est nulle : il n'y a rien à facturer à ce débiteur.`,
    };
  }

  return { ok: true, creance: libre, montantHtCents: libre.montantAttenduCents };
}

/**
 * Les destinataires réellement facturables sur ce dossier, dans l'ordre des
 * créances — pour que l'écran propose ce qui existe au lieu des quatre valeurs
 * de l'énumération.
 *
 * Une créance déjà facturée ou nulle en sort : proposer un choix qui sera
 * refusé au clic est la définition d'un écran qui ment.
 */
export function destinatairesFacturables(
  creances: ReadonlyArray<CreanceFacturable>,
): FactureFormationDestinataire[] {
  const vus = new Set<FactureFormationDestinataire>();
  for (const c of creances) {
    if (c.factureFormationId !== null || c.montantAttenduCents <= 0) continue;
    vus.add(DESTINATAIRE_DE[c.payeurType]);
  }
  return [...vus];
}
