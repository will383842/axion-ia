/**
 * Qualiopi — Pénalités de retard : CALCUL PUR, application OPT-IN par client.
 *
 * ## Ce que ce module fait, et surtout ce qu'il ne fait PAS
 *
 * Il calcule ce qui SERAIT dû au titre de l'article L.441-10 du code de
 * commerce. Il n'écrit rien, ne crée aucune ligne de facture et ne modifie
 * aucun montant. Sa sortie n'a qu'un usage : enrichir le TEXTE d'une relance,
 * et s'afficher sur la fiche client.
 *
 * ## 🔴 Désactivé par défaut — décision produit, pas un oubli
 *
 * Exigence explicite du propriétaire : facturer des pénalités par défaut est
 * commercialement catastrophique. Le calcul n'est donc appelé QUE si
 * `client.penalitesRetardActives === true`, un drapeau à `false` par défaut que
 * l'on coche client par client. Ne JAMAIS l'appeler inconditionnellement, et ne
 * jamais dériver son activation d'autre chose que ce champ.
 *
 * ## ⚠️ À ne pas confondre avec la MENTION légale
 *
 * L'affichage des mentions de pénalités en pied de facture est OBLIGATOIRE sur
 * toute facture entre professionnels (art. L.441-9 / L.441-10 / D.441-5), sans
 * condition et quel que soit ce drapeau. Elles sont imprimées par
 * `documents/templates/facture.tsx` depuis `legal/legal-mentions.ts`, et n'ont
 * rien à voir avec ce module : le drapeau gouverne l'APPLICATION des frais,
 * jamais leur mention. Ne pas conditionner l'impression des mentions à ce
 * réglage — ce serait une facture non conforme.
 *
 * Module PUR : aucun accès Prisma, aucune horloge lue (`now` est injecté).
 * Montants en CENTIMES entiers de bout en bout, jamais de division par 100.
 */

/**
 * Indemnité forfaitaire pour frais de recouvrement (art. D.441-5 C. com.).
 * 40 € par facture, montant fixé par décret — pas un paramètre commercial.
 */
export const INDEMNITE_FORFAITAIRE_RECOUVREMENT_CENTS = 4_000;

/**
 * Taux annuel retenu à défaut de taux BCE connu, en points de pourcentage.
 *
 * Le taux légal est « refinancement BCE le plus récent + 10 points » — le
 * libellé exact vit dans `TAUX_PENALITES_RETARD_FR` (`legal/legal-mentions.ts`),
 * SEULE source du texte, partagée avec les CGV publiées. NE PAS y recopier une
 * valeur chiffrée : la clause imprimée sur la facture et le nombre utilisé au
 * calcul doivent rester distincts, sans quoi un taux affiché finirait par
 * diverger de celui appliqué.
 *
 * 12,15 % = 2,15 % (taux de refinancement BCE) + 10 points. Valeur de repli
 * seulement : l'appelant passe le taux en vigueur dès qu'il le connaît.
 */
export const TAUX_PENALITES_ANNUEL_DEFAUT_PCT = 12.15;

export interface CalculPenalitesInput {
  /** Reste dû NET en centimes (TTC + avoirs − encaissements). */
  resteDuCents: number;
  /** Échéance de la facture. `null` → aucun retard calculable. */
  echeanceAt: Date | null;
  /** Référence temporelle (injectée : le module reste pur et déterministe). */
  now: Date;
  /** Taux annuel en points de pourcentage. Défaut : BCE + 10 points. */
  tauxAnnuelPct?: number;
}

export interface CalculPenalitesResult {
  /** Jours de retard pleins (0 si non échue). */
  joursRetard: number;
  /** Intérêts de retard courus, en centimes (arrondi au centime inférieur). */
  interetsCents: number;
  /** Indemnité forfaitaire de recouvrement, en centimes (0 ou 40 €). */
  indemniteForfaitaireCents: number;
  /** Somme des deux. */
  totalCents: number;
}

const RESULTAT_NUL: CalculPenalitesResult = {
  joursRetard: 0,
  interetsCents: 0,
  indemniteForfaitaireCents: 0,
  totalCents: 0,
};

/**
 * Pénalités de retard dues sur une facture échue.
 *
 * Règles appliquées :
 *  - intérêts = reste dû × taux annuel × (jours de retard / 365), prorata
 *    quotidien conforme à l'usage — arrondi au centime INFÉRIEUR (`floor`) :
 *    en cas de doute, on réclame moins, jamais plus ;
 *  - indemnité forfaitaire de 40 € due dès le PREMIER jour de retard, une seule
 *    fois par facture (art. D.441-5) — elle ne se proratise pas ;
 *  - créance éteinte ou non échue → tout à zéro, y compris l'indemnité : rien
 *    n'est dû tant que rien n'est en retard.
 *
 * Toute entrée aberrante (montant négatif, date invalide, taux non fini) rend
 * un résultat nul plutôt qu'un NaN : ce chiffre finit dans un e-mail au client.
 */
export function calculerPenalitesRetard(input: CalculPenalitesInput): CalculPenalitesResult {
  const { resteDuCents, echeanceAt, now } = input;
  const tauxAnnuelPct = input.tauxAnnuelPct ?? TAUX_PENALITES_ANNUEL_DEFAUT_PCT;

  if (echeanceAt === null) return RESULTAT_NUL;
  if (!Number.isFinite(resteDuCents) || resteDuCents <= 0) return RESULTAT_NUL;
  if (!Number.isFinite(tauxAnnuelPct) || tauxAnnuelPct <= 0) return RESULTAT_NUL;

  const echeanceMs = echeanceAt.getTime();
  const nowMs = now.getTime();
  if (Number.isNaN(echeanceMs) || Number.isNaN(nowMs)) return RESULTAT_NUL;

  const joursRetard = Math.floor((nowMs - echeanceMs) / 86_400_000);
  if (joursRetard < 1) return RESULTAT_NUL;

  const interetsCents = Math.floor((resteDuCents * (tauxAnnuelPct / 100) * joursRetard) / 365);
  const indemniteForfaitaireCents = INDEMNITE_FORFAITAIRE_RECOUVREMENT_CENTS;

  return {
    joursRetard,
    interetsCents,
    indemniteForfaitaireCents,
    totalCents: interetsCents + indemniteForfaitaireCents,
  };
}
