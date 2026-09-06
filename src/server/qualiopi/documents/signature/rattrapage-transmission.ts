/**
 * Qualiopi — le RATTRAPAGE automatique des exemplaires signés non transmis.
 *
 * ## Ce que ce module ferme
 *
 * `transmettreExemplaireSigne` (voisin) remet l'exemplaire intégralement signé aux
 * parties. Elle n'avait qu'UN appelant : `consequenceSignatureComplete`, le hook de
 * complétion de signature, qui ne se déclenche qu'à l'INSTANT où la dernière
 * signature tombe. Toute pièce dont ce moment est passé restait hors d'atteinte.
 *
 * Un bouton « Relancer la remise » a été livré d'abord (#1008), et il fonctionne.
 * Mais un bouton suppose que quelqu'un sache qu'il faut cliquer — et c'est
 * précisément ce qui ne peut pas arriver ici : une pièce COMPLÈTE disparaît de
 * toutes les surfaces de rattrapage (`listerPiecesEnAttente` filtre sur
 * `en_attente | partielle`, `partieARelancer` rend `null` dès `signee`, l'écran
 * « À traiter » et le compteur de navigation lisent la même liste). Le défaut se
 * cache dans son propre succès. Le cron est l'instrument qui regarde là où plus
 * aucun écran ne montre rien.
 *
 * ⚠️ Il ne REMPLACE pas le bouton, qui reste le seul moyen d'agir sur le stock
 * antérieur au seuil ci-dessous. Cf. ADR 0050.
 *
 * ## Pourquoi ce module n'implémente RIEN
 *
 * Il sélectionne et il appelle. `transmettreExemplaireSigne` porte déjà ses gardes
 * (`pas_complete`, `annulee`, `aucun_destinataire`), son idempotence par
 * revendication atomique sur `exemplaireSigneEnvoyeAt`, le relâchement de cette
 * revendication en cas d'échec, et l'absence de levée. La doubler ici ferait
 * diverger deux implémentations — c'est mot pour mot le défaut d'origine décrit
 * chez le voisin, où le canal jeton notifiait et le canal contresignature non. Ce
 * module est le TROISIÈME appelant et passe par la même porte que les deux autres.
 *
 * ## 🔴 LA BORNE BASSE — et la raison qui n'est PAS la bonne
 *
 * Ne pas écrire, ni croire, que les pièces antérieures seraient « d'état inconnu »
 * parce que `exemplaireSigneEnvoyeAt` est une colonne neuve. La migration
 * `20260905040000_exemplaire_signe_transmission` dit l'inverse, et l'a écrit exprès :
 *
 *     « Aucun backfill : toutes les pièces déjà signées passent donc pour non
 *       transmises — ce qui est exactement vrai, et ce que l'alerte
 *       `exemplaire_signe_non_transmis` doit faire remonter. »
 *
 * Elles n'ont réellement JAMAIS été remises. La borne se justifie autrement :
 * écrire aujourd'hui, sans prévenir, à quelqu'un au sujet d'un contrat signé il y a
 * cinq semaines n'est pas le même acte que remettre sous 24 h une pièce fraîchement
 * signée. Le premier mérite qu'un humain regarde d'abord.
 *
 * ⚠️ Donc : le stock antérieur au seuil est DU VRAI DÛ. La borne l'écarte de
 * l'automate, elle ne l'absout pas. Il reste cliquable (bouton #1008) et visible
 * (la règle d'alerte n'a, elle, aucune borne basse). D'où `ignoreesAvantSeuil`,
 * compté à chaque passage : sans ce nombre, la borne cacherait exactement ce
 * qu'elle est censée rendre décidable.
 *
 * ⚠️ Ne pas confondre avec la borne HAUTE (`DELAI_GRACE_MINUTES`), qui a un tout
 * autre rôle : ne pas courir après le chemin nominal. Une pièce signée il y a deux
 * minutes est probablement déjà en cours de remise par le hook ; la revendication
 * atomique empêcherait le doublon, mais le journal afficherait un `deja_transmis`
 * trompeur à chaque passage.
 */

import { prisma } from "@/lib/prisma";
import { transmettreExemplaireSigne, type MotifNonTransmission } from "./transmission-exemplaire";

/**
 * Borne basse du rattrapage automatique (ADR 0050, accord explicite de Will).
 *
 * Assez tôt pour couvrir `AXI-DOC-2026-039` (contresignée le 04/09), assez tard
 * pour ne pas réveiller l'historique sans qu'un humain regarde. Le déplacer, c'est
 * décider d'écrire à des clients plus anciens : une décision, pas un réglage.
 */
export const SEUIL_RATTRAPAGE = new Date("2026-09-01T00:00:00.000Z");

/** Miroir de `DELAI_GRACE_TRANSMISSION_MINUTES` (évaluateur d'alertes). */
export const DELAI_GRACE_MINUTES = 30;

/**
 * Plafond par passage (ADR 0050).
 *
 * Le cron est horaire et la sélection est un ÉTAT (`exemplaireSigneEnvoyeAt: null`),
 * pas une fenêtre : ce qui déborde d'un passage est repris au suivant. Ce n'est donc
 * pas une perte, c'est un débit. Il existe pour qu'un défaut de masse — un R2 muet
 * toute une journée, une file d'e-mails bloquée — se rattrape en plusieurs vagues
 * plutôt qu'en une rafale d'e-mails vers des clients réels.
 */
export const PLAFOND_PAR_PASSAGE = 25;

export interface ResultatRattrapage {
  /** Pièces examinées dans ce passage (après seuil, grâce et plafond). */
  readonly examinees: number;
  /** Exemplaires effectivement remis. */
  readonly transmises: number;
  /** Appels qui n'ont rien remis, `deja_transmis` COMPRIS. */
  readonly nonTransmises: number;
  /** Décompte par motif, pour que le journal dise POURQUOI. */
  readonly motifs: Readonly<Partial<Record<MotifNonTransmission, number>>>;
  /** Pièces éligibles en tout point SAUF le seuil — le stock encore dû. */
  readonly ignoreesAvantSeuil: number;
  /**
   * Numéros des pièces effectivement remises.
   *
   * Rendus plutôt que journalisés ici : ce module vit sous `src/server/qualiopi`,
   * où `console.log` est interdit (seuls `warn` et `error` passent), et une remise
   * réussie n'est ni un avertissement ni une erreur. La trace nominale appartient
   * donc à l'appelant. La perdre serait pire que le bruit : sans les numéros, un
   * journal qui dit « 3 remis » ne permet pas de savoir À QUI.
   */
  readonly numerosRemis: readonly string[];
}

/**
 * Balaie les pièces intégralement signées dont l'exemplaire n'est jamais parti, et
 * les remet en passant par le chemin nominal.
 *
 * Ne lève jamais : une erreur sur une pièce ne doit pas priver les suivantes de leur
 * remise, et un cron qui casse emporterait avec lui tout ce qu'il surveille.
 */
export async function rattraperExemplairesNonTransmis(
  maintenant: Date = new Date(),
): Promise<ResultatRattrapage> {
  const limiteHaute = new Date(maintenant.getTime() - DELAI_GRACE_MINUTES * 60_000);

  // Le `where` reproduit celui de `regleExemplaireSigneNonTransmis`
  // (`alertes/evaluateur.ts`) — À DESSEIN, et à une seule différence près : le seuil.
  // Les deux doivent voir le même monde, sinon l'alerte crierait sur des pièces que
  // le rattrapage ne peut pas prendre, ou l'inverse.
  const commun = {
    statutSignature: "signee" as const,
    exemplaireSigneEnvoyeAt: null,
    // Une pièce annulée au registre ne fait plus foi : il n'y a rien à remettre.
    annuleeAt: null,
  };

  // Compté AVANT la sélection bornée. C'est le seul endroit d'où le stock encore dû
  // reste mesurable — et ce n'est pas un chiffre décoratif : il dit combien de
  // clients attendent encore un exemplaire que l'automate ne leur enverra pas.
  const ignoreesAvantSeuil = await prisma.documentGenere.count({
    where: { ...commun, updatedAt: { lte: limiteHaute, lt: SEUIL_RATTRAPAGE } },
  });

  const pieces = await prisma.documentGenere.findMany({
    where: { ...commun, updatedAt: { lte: limiteHaute, gte: SEUIL_RATTRAPAGE } },
    select: { id: true, numero: true },
    orderBy: { updatedAt: "asc" },
    take: PLAFOND_PAR_PASSAGE,
  });

  const motifs: Partial<Record<MotifNonTransmission, number>> = {};
  const numerosRemis: string[] = [];
  let nonTransmises = 0;

  for (const piece of pieces) {
    try {
      const res = await transmettreExemplaireSigne(piece.id);
      if (res.ok) {
        // Le numéro plutôt qu'un compteur : « 3 remis » ne dit pas À QUI, et c'est
        // la seule question qu'on se pose en relisant un journal d'envoi.
        numerosRemis.push(piece.numero);
        continue;
      }
      nonTransmises += 1;
      motifs[res.motif] = (motifs[res.motif] ?? 0) + 1;
      // `deja_transmis` n'est pas une anomalie : c'est la course normale avec le hook
      // nominal, et la revendication atomique a fait son travail.
      if (res.motif !== "deja_transmis") {
        console.warn(
          `[rattrapage-exemplaire] ${piece.numero} NON REMIS — ${res.motif}` +
            (res.detail === undefined ? "" : ` (${res.detail})`),
        );
      }
    } catch (err) {
      // `transmettreExemplaireSigne` promet de ne pas lever. Ce `catch` garde la
      // promesse au cas où elle cesserait d'être tenue : une pièce ne doit pas
      // emporter les suivantes.
      nonTransmises += 1;
      console.error(
        `[rattrapage-exemplaire] ${piece.numero} — erreur inattendue:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return {
    examinees: pieces.length,
    transmises: numerosRemis.length,
    nonTransmises,
    motifs,
    ignoreesAvantSeuil,
    numerosRemis,
  };
}
