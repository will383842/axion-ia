/**
 * Qualiopi — Calcul de l'acompte et de l'échéancier (audit certification 2026-07-26).
 *
 * ## Pourquoi ce module est pur
 *
 * Trois règles de droit se croisent ici, et chacune a une conséquence financière
 * directe. Les isoler de Prisma permet de les éprouver une par une, sans base :
 * une erreur d'arrondi ou un plafond mal appliqué ne se voit pas à l'écran, il
 * se voit sur un relevé bancaire six semaines plus tard.
 *
 * ## Les règles, dans l'ordre de priorité
 *
 * 1. **CPF** — la Caisse des Dépôts règle l'organisme après service fait, sur
 *    pièces déposées dans EDOF. Le titulaire ne verse rien à l'organisme :
 *    aucun acompte n'a de sens, et en réclamer un serait irrégulier.
 *
 * 2. **Subrogation totale** — l'OPCO paie directement l'organisme pour la
 *    totalité. Demander un acompte à l'entreprise reviendrait à réclamer de
 *    l'argent à quelqu'un qui n'est pas le payeur.
 *
 * 3. **Particulier** — art. L6353-6 du code du travail. Aucune somme ne peut
 *    être exigée ni versée avant l'expiration du délai de rétractation de dix
 *    jours ; à l'issue, 30 % du prix au maximum ; le solde est OBLIGATOIREMENT
 *    échelonné au fur et à mesure du déroulement de l'action. Ces trois points
 *    ne sont pas négociables — on peut demander moins, jamais plus, et jamais
 *    en une fois.
 *
 * 4. **Entreprise** — aucune limite légale. L'acompte s'applique au RESTE À
 *    CHARGE, pas au montant total : si un OPCO couvre 60 %, l'acompte porte sur
 *    les 40 % restants. Le confondre avec le total reviendrait à réclamer à
 *    l'entreprise une part que son OPCO va payer.
 *
 * Montants en CENTIMES. Aucun flottant : un arrondi sur un acompte se retrouve
 * en écart de trésorerie.
 */

/** Délai de rétractation d'un contrat de formation individuel (art. L6353-5). */
export const DELAI_RETRACTATION_PARTICULIER_JOURS = 10;

/** Plafond légal de l'acompte d'un particulier (art. L6353-6). */
export const PLAFOND_ACOMPTE_PARTICULIER_PCT = 30;

/**
 * Première date à laquelle une somme peut être appelée à un particulier.
 *
 * L'article L6353-6 pose TROIS obligations cumulatives, et le dépôt n'en
 * appliquait qu'une : (1) aucune somme ne peut être **exigée NI VERSÉE** avant
 * l'expiration du délai de rétractation ; (2) à l'issue, 30 % maximum ; (3) le
 * solde s'échelonne au fur et à mesure du déroulement de l'action.
 *
 * Seul le point (2) était contrôlé. Le point (1) était **calculé et jamais lu** —
 * `encaissableAPartirDu` n'était consommé nulle part dans `src/`.
 */
export function dateEncaissablePartir(dateEngagement: Date): Date {
  return new Date(
    dateEngagement.getTime() + DELAI_RETRACTATION_PARTICULIER_JOURS * 24 * 60 * 60 * 1000,
  );
}

/**
 * L'appel de fonds est-il autorisé à cette date ?
 *
 * 🔴 `null` ⇒ **refus**, et c'est délibéré. Sans date d'engagement, le délai de
 * rétractation est incalculable ; autoriser « faute de savoir » reviendrait à
 * faire de l'absence de donnée un laissez-passer, alors que c'est précisément le
 * cas où l'on ne peut rien prouver devant un contrôle.
 */
export function encaissementAutorise(dateEngagement: Date | null, maintenant: Date): boolean {
  if (dateEngagement === null) return false;
  return maintenant.getTime() >= dateEncaissablePartir(dateEngagement).getTime();
}

// ─────────────────────────────────────────────────────────────────────────────
// Quelle date fait courir le délai — art. L6353-5
// ─────────────────────────────────────────────────────────────────────────────

/**
 * D'où vient la date d'engagement retenue. Le refus serveur l'affiche : dire
 * « ce devis a été accepté le … » quand on a en réalité lu une signature de
 * contrat produirait un message que l'admin ne peut pas recouper avec le
 * dossier — et un garde-fou qu'on ne peut pas recouper n'est pas auditable.
 */
export type SourceDateEngagement =
  /** Signature du contrat de formation — l'intrant que la loi désigne. */
  | "signature_contrat"
  /** Repli documenté : acceptation du devis, faute de contrat signé. */
  | "acceptation_devis"
  /** Rien d'exploitable ⇒ refus. */
  | "aucune";

/**
 * Une ligne `DocumentSignature` réduite à ce que la règle légale consomme.
 *
 * Volontairement structurelle et non importée de Prisma : ce module reste PUR
 * (aucun client, aucune horloge), ce qui permet d'éprouver la règle sans base.
 */
export interface SignatureContratLue {
  signeAt: Date;
  /** Non nul ⇒ la preuve a été retirée du dossier. */
  revokedAt: Date | null;
}

export interface DateEngagementParticulier {
  /** `null` ⇒ refus. Jamais un laissez-passer. */
  date: Date | null;
  source: SourceDateEngagement;
}

/**
 * Date à partir de laquelle courent les dix jours de rétractation d'un particulier.
 *
 * ## Pourquoi cette fonction existe
 *
 * Le garde-fou d'encaissement faisait courir le délai depuis `Devis.acceptedAt`.
 * C'était l'intrant le plus fiable DISPONIBLE à l'époque, et il était documenté
 * comme provisoire. Il ne l'est plus : l'article L6353-5 fait courir le délai à
 * compter de la **conclusion du CONTRAT de formation** (L6353-3), pas de
 * l'acceptation d'un devis — laquelle n'a aucune existence dans le code du
 * travail. Depuis que le registre `DocumentSignature` existe, cette date est
 * lisible ; continuer à raisonner sur `acceptedAt` reviendrait à appliquer une
 * règle légale sur un intrant que la loi ne mentionne pas.
 *
 * ## 🔴 Quelle signature fait foi, sur un contrat à DEUX parties
 *
 * Le circuit `contrat` déclare `["beneficiaire", "axionia"]` : le particulier
 * signe, l'organisme contresigne. On retient **la signature NON RÉVOQUÉE la plus
 * TARDIVE**, quelle que soit la partie. Trois raisons, dans cet ordre :
 *
 *  1. **La loi parle de la conclusion du contrat.** Un contrat bilatéral n'est
 *     conclu qu'à la dernière signature : tant que l'organisme n'a pas
 *     contresigné, il n'y a pas de contrat, donc rien dont se rétracter.
 *  2. **C'est la lecture la plus protectrice.** Retenir la signature du
 *     bénéficiaire ferait partir le délai PLUS TÔT, donc expirer la protection
 *     plus tôt. Entre deux lectures défendables, un garde-fou dont la doctrine
 *     est « dans le doute, refuser » prend la plus tardive.
 *  3. **Elle n'est pas manipulable au détriment du particulier.** Retarder sa
 *     propre contresignature ne fait que retarder le droit de facturer de
 *     l'organisme : personne n'a intérêt à en jouer contre le client.
 *
 * ⚠️ Contrat encore PARTIELLEMENT signé (bénéficiaire seul) : on retient sa
 * signature, la plus tardive posée à ce stade. On ne refuse pas sèchement, car
 * cela ferait dépendre le droit de facturer d'un acte purement interne à
 * l'organisme, et le résultat reste au moins aussi strict qu'une date
 * d'acceptation de devis, toujours antérieure en pratique.
 *
 * ## 🔴 Une signature RÉVOQUÉE ne fait courir aucun délai
 *
 * `revokedAt` non nul = preuve retirée du dossier. La laisser démarrer le
 * compteur reviendrait à faire courir une protection légale depuis un acte dont
 * on affirme par ailleurs qu'il n'a plus de valeur — et, concrètement, une vieille
 * signature révoquée ferait expirer le délai bien avant la signature valable qui
 * l'a remplacée. On ignore donc les lignes révoquées, ici et pas seulement dans
 * la requête SQL de l'appelant : la règle doit vivre à UN endroit.
 *
 * ## 🔴 L'absence de date reste un REFUS
 *
 * `date: null` ⇒ `encaissementAutorise` rend `false`. C'est la doctrine déjà
 * posée : autoriser « faute de savoir » ferait de l'absence de donnée un
 * passe-droit, précisément là où l'on ne peut rien prouver devant un contrôle.
 */
export function dateEngagementParticulier(input: {
  /** TOUTES les signatures du/des contrat(s) rattaché(s), révoquées comprises. */
  signaturesContrat: readonly SignatureContratLue[];
  /** Repli : acceptation du devis. Sans valeur légale, mais mieux que rien. */
  devisAcceptedAt: Date | null;
}): DateEngagementParticulier {
  const valides = input.signaturesContrat.filter((s) => s.revokedAt === null);

  if (valides.length > 0) {
    // ⚠️ On reste dans la branche « signature » dès qu'une signature valable
    // existe, MÊME si sa date est illisible. Basculer alors sur le repli
    // choisirait une date ANTÉRIEURE, donc plus permissive, sur la foi d'une
    // donnée corrompue : le refus est la seule issue défendable.
    let plusTardive = Number.NEGATIVE_INFINITY;
    for (const s of valides) {
      const t = s.signeAt.getTime();
      if (Number.isFinite(t) && t > plusTardive) plusTardive = t;
    }
    return {
      date: Number.isFinite(plusTardive) ? new Date(plusTardive) : null,
      source: "signature_contrat",
    };
  }

  // Repli DOCUMENTÉ, pas un équivalent. `acceptedAt` n'est pas la date que
  // L6353-5 désigne ; elle en est l'approximation la plus proche tant qu'aucun
  // contrat n'est signé. Le message de refus doit le dire, pour que l'admin
  // sache que la date affichée n'est pas celle du contrat.
  if (input.devisAcceptedAt !== null && Number.isFinite(input.devisAcceptedAt.getTime())) {
    return { date: input.devisAcceptedAt, source: "acceptation_devis" };
  }

  return { date: null, source: "aucune" };
}

export type NatureClient = "entreprise" | "particulier";

export interface ContexteAcompte {
  /** Prix total de l'action, hors taxes, en centimes. */
  montantTotalHtCents: number;
  /** Part prise en charge par un financeur (OPCO, France Travail), en centimes. */
  priseEnChargeCents: number;
  /** Vrai si le financeur règle DIRECTEMENT l'organisme (subrogation). */
  subrogation: boolean;
  /** Vrai si le financement passe par le CPF. */
  cpf: boolean;
  nature: NatureClient;
  /** Taux d'acompte souhaité (%), issu du client ou du réglage global. */
  tauxAcomptePct: number;
  /** Date de signature — sert à calculer la première échéance d'un particulier. */
  dateSignature?: Date;
  /**
   * Bornes CONTRACTUELLES de l'action — pas le rythme réel du stagiaire.
   *
   * 🔴 C'est sur elles que le solde s'échelonne, et ce choix est structurant.
   * L'article L6353-6 impose l'échelonnement « au fur et à mesure du déroulement
   * de l'action », et la doctrine administrative impose que « les modalités de
   * règlement, notamment l'échéancier, figurent dans le contrat de formation ».
   *
   * Un échéancier doit donc être CONNU À LA SIGNATURE. Un échelonnement calculé
   * au prorata des heures réellement consommées serait par construction
   * inconnaissable d'avance — donc impossible à écrire au contrat. Il rendrait de
   * surcroît le paiement dépendant de la diligence du stagiaire, ce qui est
   * inexploitable en e-learning asynchrone : l'accès est livré, la personne
   * progresse à son rythme ou pas du tout.
   *
   * Pour une formation en salle, ce sont les dates de session. Pour du
   * e-learning, c'est la FENÊTRE D'ACCÈS accordée : c'est elle qui « se
   * déroule », indépendamment du rythme d'apprentissage.
   */
  dateDebutAction?: Date;
  dateFinAction?: Date;
  /** Nombre d'échéances de solde souhaité — « en 2 fois », « en 3 fois ». */
  nbEcheancesSolde?: number;
}

export interface Echeance {
  /** Libellé lisible, destiné au contrat et à l'échéancier. */
  libelle: string;
  montantCents: number;
  /** `null` quand l'échéance suit le déroulement de l'action, sans date fixe. */
  dueLe: Date | null;
}

export interface ResultatAcompte {
  /** Montant à demander à la signature. `0` = aucun acompte. */
  acompteCents: number;
  /** Reste à charge du client, avant acompte. */
  resteAChargeCents: number;
  /** Solde dû après versement de l'acompte. */
  soldeCents: number;
  /** Raison retenue — affichée à l'admin, pour qu'il comprenne le montant. */
  motif: string;
  /** Vrai si le plafond légal a rogné le taux demandé. */
  plafonne: boolean;
  /** Première date à laquelle une somme peut être encaissée. */
  encaissableAPartirDu: Date | null;
  echeancier: Echeance[];
}

/** Un mois calendaire, en préservant la fin de mois (31 janv. → 28/29 févr.). */
function moisSuivant(d: Date, n: number): Date {
  const r = new Date(d.getTime());
  const jour = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + n);
  const dernier = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(jour, dernier));
  return r;
}

/**
 * Découpe le solde en échéances MENSUELLES sur la durée contractuelle de l'action.
 *
 * ## Les trois règles, et leur raison
 *
 * 1. **Chaque échéance tombe au DÉBUT de sa période.** L'obligation légale porte
 *    sur l'étalement (« au fur et à mesure du déroulement »), pas sur un paiement
 *    après livraison — et la doctrine interdit seulement d'encaisser le solde
 *    d'avance, par exemple sous forme de chèques pré-remplis. Payer en amont de
 *    chaque segment est la pratique courante et reste étalé.
 *
 * 2. **La première échéance ne précède jamais la fin du délai de rétractation.**
 *    Aucune somme ne peut être exigée ni versée avant (L6353-5, L6353-6 point 1).
 *
 * 3. **La dernière échéance absorbe le reste de la division.** On ne réclame
 *    jamais plus tôt que prévu : les arrondis vont à la FIN, pas au début.
 *
 * ⚠️ Une action trop courte pour être découpée (moins d'un mois) produit UNE
 * échéance. C'est dit explicitement dans le libellé plutôt que présenté comme un
 * échelonnement qui n'en est pas : l'échelonnement d'une action d'une journée est
 * matériellement impossible, et le prétendre serait une affirmation fausse sur
 * une pièce contractuelle.
 */
export function echelonnerSolde(arg: {
  soldeCents: number;
  /** Première date encaissable (fin du délai de rétractation). */
  encaissableAPartirDu: Date | null;
  dateDebutAction?: Date | undefined;
  dateFinAction?: Date | undefined;
  /**
   * Nombre d'échéances SOUHAITÉ — « en 2 fois », « en 3 fois ».
   *
   * 🔴 C'est une donnée COMMERCIALE, pas une déduction de la durée. La pratique
   * du secteur est de proposer un paiement en une, deux ou trois fois ; déduire
   * mécaniquement le nombre d'échéances des mois de l'action produirait douze
   * échéances sur une formation d'un an, ce que personne ne propose.
   *
   * Non renseigné → une échéance par mois entamé (comportement par défaut).
   *
   * ⚠️ BORNÉ dans les deux sens :
   *  · plafonné au nombre de mois disponibles — on ne case pas trois échéances
   *    mensuelles distinctes dans une action de trois jours ;
   *  · pour un PARTICULIER, plancher de 2 dès que l'action le permet. Une seule
   *    échéance, c'est le solde en une fois — précisément ce que le point (3) de
   *    L6353-6 interdit. Ce plancher n'est pas un réglage, c'est la loi.
   */
  nbEcheancesSouhaite?: number | undefined;
  /** `true` pour un particulier : active le plancher légal de 2 échéances. */
  plancherLegal?: boolean | undefined;
}): Echeance[] {
  const solde = Math.max(0, entierSur(arg.soldeCents));
  if (solde === 0) return [];

  const debutBrut = arg.dateDebutAction ?? arg.encaissableAPartirDu;
  const fin = arg.dateFinAction;

  // 🔴 Sans bornes, on NE FABRIQUE PAS de dates. Une échéance datée à tort serait
  // annoncée au client et opposable — pire qu'une échéance sans date, qui dit
  // honnêtement que le rythme suit l'action.
  if (debutBrut == null || fin == null || fin.getTime() < debutBrut.getTime()) {
    return [
      {
        libelle:
          "Solde échelonné au fur et à mesure du déroulement de l'action (art. L6353-6) — dates à préciser au contrat",
        montantCents: solde,
        dueLe: null,
      },
    ];
  }

  // La première échéance ne peut pas précéder la fin du délai de rétractation.
  const premiere =
    arg.encaissableAPartirDu != null && arg.encaissableAPartirDu.getTime() > debutBrut.getTime()
      ? arg.encaissableAPartirDu
      : debutBrut;

  // Mois ENTAMÉS entre la première échéance et la fin de l'action : nombre
  // maximal d'échéances mensuelles distinctes que l'action peut porter.
  const moisDisponibles =
    Math.max(
      0,
      (fin.getFullYear() - premiere.getFullYear()) * 12 + (fin.getMonth() - premiere.getMonth()),
    ) + 1;

  const souhaite =
    arg.nbEcheancesSouhaite != null && Number.isFinite(arg.nbEcheancesSouhaite)
      ? Math.max(1, Math.trunc(arg.nbEcheancesSouhaite))
      : moisDisponibles;

  let nb = Math.min(souhaite, moisDisponibles);
  if (arg.plancherLegal === true && moisDisponibles >= 2) nb = Math.max(2, nb);

  if (nb <= 1) {
    return [
      {
        libelle:
          moisDisponibles >= 2
            ? "Solde — paiement en une fois (échéancier convenu)"
            : "Solde — l'action est trop courte pour un échelonnement mensuel (art. L6353-6, échelonnement matériellement impossible)",
        montantCents: solde,
        dueLe: premiere,
      },
    ];
  }

  // 🔴 Les échéances sont RÉPARTIES sur toute la durée de l'action, pas collées
  // aux premiers mois. « En 3 fois » sur six mois donne les mois 1, 3 et 5 —
  // sinon on encaisserait tout dans le premier tiers, ce qui viderait
  // l'échelonnement de son sens protecteur.
  const pas = moisDisponibles / nb;

  // Arrondi à l'euro inférieur par échéance, le reste à la DERNIÈRE : on ne
  // réclame jamais plus tôt que prévu.
  const parEcheance = arrondirCentimes(Math.floor(solde / nb));
  const echeances: Echeance[] = [];
  let cumul = 0;
  for (let i = 0; i < nb - 1; i++) {
    echeances.push({
      libelle: `Solde — échéance ${i + 1}/${nb} (art. L6353-6)`,
      montantCents: parEcheance,
      dueLe: moisSuivant(premiere, Math.floor(i * pas)),
    });
    cumul += parEcheance;
  }
  echeances.push({
    libelle: `Solde — échéance ${nb}/${nb} (art. L6353-6)`,
    montantCents: solde - cumul,
    dueLe: moisSuivant(premiere, Math.floor((nb - 1) * pas)),
  });
  return echeances;
}

/** Arrondi à l'euro inférieur : on ne réclame jamais plus que le taux prévu. */
function arrondirCentimes(cents: number): number {
  return Math.floor(cents / 100) * 100;
}

/**
 * Ramene une entree numerique a un entier sur.
 *
 * VERIF E2E 2026-07-26. Le JSDoc promettait qu'« un contexte incoherent est
 * ramene a des bornes sures », mais `Math.max(0, Math.trunc(NaN))` vaut `NaN` :
 * un montant, une prise en charge ou un taux non numerique traversait tout le
 * calcul en silence. `if (acompte > 0)` etant faux pour NaN, l'echeancier
 * ressortait VIDE et l'unique invariante testee (somme = reste a charge) ne
 * detectait rien — le devis partait avec des montants NaN.
 */
function entierSur(valeur: number): number {
  return Number.isFinite(valeur) ? Math.trunc(valeur) : 0;
}

/**
 * Calcule l'acompte, le solde et l'échéancier.
 *
 * Ne lève jamais : un contexte incohérent (prise en charge supérieure au total,
 * taux négatif) est ramené à des bornes sûres. Une exception ici bloquerait la
 * création d'un devis, ce qui est pire qu'un acompte à zéro.
 */
export function calculerAcompte(ctx: ContexteAcompte): ResultatAcompte {
  const total = Math.max(0, entierSur(ctx.montantTotalHtCents));
  const priseEnCharge = Math.min(total, Math.max(0, entierSur(ctx.priseEnChargeCents)));
  const resteACharge = total - priseEnCharge;

  const aucun = (motif: string): ResultatAcompte => ({
    acompteCents: 0,
    resteAChargeCents: resteACharge,
    soldeCents: resteACharge,
    motif,
    plafonne: false,
    encaissableAPartirDu: null,
    echeancier:
      resteACharge > 0
        ? [{ libelle: "Solde à l'issue de la formation", montantCents: resteACharge, dueLe: null }]
        : [],
  });

  // 1. CPF — la Caisse des Dépôts règle l'organisme, pas le titulaire.
  //
  // 🔴 Vérification E2E 2026-07-26. Cette branche s'exécutait AVANT le test sur
  // `nature`, donc un titulaire particulier gardant un reste à charge (cas réel :
  // `qualiopi.cpf_reste_a_charge = 103,20 €` est configuré en production)
  // ressortait avec un règlement UNIQUE, sans délai de rétractation, sans
  // échelonnement et sans mention L6353-6. Le CPF supprime l'acompte ; il ne
  // supprime pas les protections dues au particulier sur ce qu'il paie lui-même.
  if (ctx.cpf) {
    if (ctx.nature === "particulier" && resteACharge > 0) {
      return resultatParticulier({
        resteACharge,
        tauxSaisi: 0,
        dateSignature: ctx.dateSignature ?? null,
        dateDebutAction: ctx.dateDebutAction,
        dateFinAction: ctx.dateFinAction,
        nbEcheancesSolde: ctx.nbEcheancesSolde,
        motif:
          "Financement CPF : la Caisse des Dépôts règle l'organisme après service fait, aucun acompte ne peut être demandé au titulaire. Le reste à charge suit le régime du particulier : encaissable après le délai de rétractation et obligatoirement échelonné (art. L6353-6).",
      });
    }
    return aucun(
      "Financement CPF : la Caisse des Dépôts règle l'organisme après service fait. Aucun acompte ne peut être demandé au titulaire.",
    );
  }

  // 2. Subrogation totale — l'entreprise n'est pas le payeur.
  if (ctx.subrogation && resteACharge === 0) {
    return aucun(
      "Prise en charge à 100 % avec subrogation : le financeur règle directement l'organisme. Aucun acompte à demander au client.",
    );
  }

  if (resteACharge === 0) {
    return aucun("Prise en charge intégrale : aucun reste à charge, donc aucun acompte.");
  }

  const tauxSaisi = entierSur(ctx.tauxAcomptePct);
  const tauxDemande = Math.max(0, Math.min(100, tauxSaisi));

  // 3. Particulier — plafond dur et échelonnement obligatoire.
  if (ctx.nature === "particulier") {
    return resultatParticulier({
      resteACharge,
      tauxSaisi,
      dateSignature: ctx.dateSignature ?? null,
      dateDebutAction: ctx.dateDebutAction,
      dateFinAction: ctx.dateFinAction,
      nbEcheancesSolde: ctx.nbEcheancesSolde,
    });
  }

  // 4. Entreprise — le taux porte sur le RESTE À CHARGE.
  const acompte = arrondirCentimes((resteACharge * tauxDemande) / 100);
  const solde = resteACharge - acompte;
  const echeancier: Echeance[] = [];
  if (acompte > 0) {
    echeancier.push({
      libelle: `Acompte (${tauxDemande} % du reste à charge) — à la signature`,
      montantCents: acompte,
      dueLe: ctx.dateSignature ?? null,
    });
  }
  if (solde > 0) {
    echeancier.push({
      libelle: "Solde à l'issue de la formation",
      montantCents: solde,
      dueLe: null,
    });
  }

  return {
    acompteCents: acompte,
    resteAChargeCents: resteACharge,
    soldeCents: solde,
    motif:
      priseEnCharge > 0
        ? `Acompte de ${tauxDemande} % calculé sur le reste à charge, une fois déduite la prise en charge du financeur.`
        : `Acompte de ${tauxDemande} % du montant total.`,
    plafonne: false,
    encaissableAPartirDu: ctx.dateSignature ?? null,
    echeancier,
  };
}

/**
 * Régime du particulier — appliqué à tout reste à charge qu'il paie lui-même,
 * y compris sous financement CPF.
 *
 * Trois obligations, non négociables : plafond d'acompte (30 %), délai de
 * rétractation avant tout encaissement (L6353-5), et échelonnement du solde
 * (L6353-6). Aucune n'est une facilité commerciale.
 */
function resultatParticulier(arg: {
  resteACharge: number;
  tauxSaisi: number;
  dateSignature: Date | null;
  /** Bornes contractuelles de l'action — voir `ContexteAcompte`. */
  dateDebutAction?: Date | undefined;
  dateFinAction?: Date | undefined;
  nbEcheancesSolde?: number | undefined;
  motif?: string;
}): ResultatAcompte {
  const { resteACharge, dateSignature } = arg;
  const tauxSaisi = Math.max(0, entierSur(arg.tauxSaisi));
  const plafonne = tauxSaisi > PLAFOND_ACOMPTE_PARTICULIER_PCT;
  const taux = Math.min(tauxSaisi, PLAFOND_ACOMPTE_PARTICULIER_PCT);
  const acompte = arrondirCentimes((resteACharge * taux) / 100);
  const solde = resteACharge - acompte;

  // SSOT : la même fonction que celle qui REFUSE l'appel de fonds au serveur.
  // Dupliquer le calcul ici, c'est laisser l'échéancier proposé au client et le
  // garde-fou serveur diverger — un contrat qui annonce une date que le serveur
  // n'applique pas.
  const encaissableAPartirDu = dateSignature ? dateEncaissablePartir(dateSignature) : null;

  const echeancier: Echeance[] = [];
  if (acompte > 0) {
    echeancier.push({
      libelle: `Acompte (${taux} %) — encaissable après le délai de rétractation de ${DELAI_RETRACTATION_PARTICULIER_JOURS} jours`,
      montantCents: acompte,
      dueLe: encaissableAPartirDu,
    });
  }
  if (solde > 0) {
    // L'échelonnement est une OBLIGATION (L6353-6 point 3), pas une facilité : on
    // ne propose jamais un solde en une fois pour un particulier — sauf quand
    // l'action est trop courte pour être découpée, et le libellé le DIT alors.
    //
    // 🔴 Jusqu'au 2026-07-30, cette branche posait une échéance unique sans date.
    // Le point (3) était donc annoncé sans être appliqué, et l'échéancier que la
    // doctrine exige AU CONTRAT restait vide de dates.
    echeancier.push(
      ...echelonnerSolde({
        soldeCents: solde,
        encaissableAPartirDu,
        dateDebutAction: arg.dateDebutAction,
        dateFinAction: arg.dateFinAction,
        nbEcheancesSouhaite: arg.nbEcheancesSolde,
        // Particulier → plancher légal de 2 échéances dès que l'action le permet.
        plancherLegal: true,
      }),
    );
  }

  // Le message affiche le taux RÉELLEMENT saisi. Il annonçait auparavant
  // « le taux de 100 % a été ramené à 30 % » quand on avait demandé 500, parce
  // qu'il lisait la valeur déjà bornée à 100.
  const motifDefaut = plafonne
    ? `Contrat avec un particulier : l'acompte est plafonné à ${PLAFOND_ACOMPTE_PARTICULIER_PCT} % par l'article L6353-6, le taux de ${tauxSaisi} % a été ramené à ${taux} %.`
    : `Contrat avec un particulier : acompte de ${taux} %, ${
        dateSignature
          ? "encaissable après le délai de rétractation"
          : "encaissable après le délai de rétractation — date de signature à renseigner"
      }, solde obligatoirement échelonné.`;

  return {
    acompteCents: acompte,
    resteAChargeCents: resteACharge,
    soldeCents: solde,
    motif: arg.motif ?? motifDefaut,
    plafonne,
    encaissableAPartirDu,
    echeancier,
  };
}
