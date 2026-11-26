/**
 * Réseau d'apporteurs — la COMMANDE soldée (module PUR, aucun import serveur).
 *
 * Contrat v2 (art. 4) : la commission n'est due que lorsque le client a payé la commande
 * à 100 %. Avec le mode « acompte + solde », un acompte payé ne solde pas la commande :
 * on regroupe donc les factures par devis, et la commission n'est créée que si TOUTES les
 * factures de la commande (hors avoirs) sont payées. Une facture sans devis est sa propre
 * commande. Les avoirs viennent en déduction du total HT facturé.
 */

export interface FactureDeCommande {
  id: string;
  devisId: string | null;
  statut: string;
  /** Renseigné pour un avoir (montants négatifs) : id de la facture rectifiée. */
  avoirDeId: string | null;
  montantHtCents: number;
  emiseAt: Date | null;
  /**
   * Facture d'ACOMPTE (`factureEstUnAcompte`, lu dans ses lignes). Sans total de devis connu, une
   * commande qui en contient une n'est jamais soldée (art. 4.3 du contrat 2.8 : un acompte ne
   * déclenche aucune commission). Absent = pas un acompte (comportement d'avant).
   */
  estAcompte?: boolean;
}

/** Une ligne de facture, telle que stockée (`FactureFormation.lignes`, JSON). */
interface LigneDeFacture {
  designation?: unknown;
  quantite?: unknown;
  prixUnitaireHtCents?: unknown;
}

function lignesLisibles(brut: unknown): LigneDeFacture[] {
  return Array.isArray(brut)
    ? brut.filter((l): l is LigneDeFacture => !!l && typeof l === "object")
    : [];
}

/** Désignation normalisée : minuscules, sans accents, apostrophes droites, espaces simples. */
function normaliser(designation: unknown): string {
  return typeof designation === "string"
    ? designation
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\u2019\u2018`]/g, "'")
        .replace(/\s+/g, " ")
        .toLowerCase()
        .trim()
    : "";
}

/** Montant HT d'une ligne (quantité × prix unitaire) ; 0 si illisible. */
function montantDeLigne(l: LigneDeFacture): number {
  const q = typeof l.quantite === "number" ? l.quantite : Number(l.quantite);
  const p = typeof l.prixUnitaireHtCents === "number" ? l.prixUnitaireHtCents : NaN;
  return Number.isFinite(q) && Number.isFinite(p) ? q * p : 0;
}

/**
 * Facture d'ACOMPTE : une de ses lignes POSITIVES commence par « Acompte » (libellé posé par
 * `planifierFacturationDevis` : « Acompte de 30 % — devis … »). La déduction portée par une facture
 * de solde (« Acompte déjà facturé — facture … », montant négatif) n'en fait pas un acompte.
 */
export function factureEstUnAcompte(lignes: unknown): boolean {
  return lignesLisibles(lignes).some(
    (l) => montantDeLigne(l) > 0 && /^acompte\b/.test(normaliser(l.designation)),
  );
}

/** « Journée IA », « journée d'IA », « JOURNEE IA » (accents et casse ignorés). */
const MOTIF_JOURNEE_IA = /\bjournee (d'|de )?ia\b/;

/**
 * La commande porte-t-elle une JOURNÉE IA (annexe 1 du contrat 2.8, A1.1) ?
 *
 *   · `devisJourneeIa === true` (colonne `devis.journee_ia`, seule source qui fait foi) : reconnue ;
 *     le nombre de journées est la somme des quantités des lignes POSITIVES « Journée IA » des
 *     factures de la commande, 1 à défaut ;
 *   · sinon, si une ligne POSITIVE d'une facture de la commande s'appelle « Journée IA » (critère
 *     prudent : jamais une ligne négative, qui est la déduction de l'art. 4.1 ter sur une commande
 *     suivante) : SUSPECTE. Le passage ne devine rien : ligne « à qualifier » et alerte interne ;
 *   · sinon : `null` (la commande suit sa propre activité).
 *
 * `devisJourneeIa === null` : la colonne n'a pas pu être lue (ou pas de devis) ; seule la mention
 * dans les lignes compte, et elle ne rend la commande que suspecte.
 */
export function journeeIaDeLaCommande(e: {
  devisJourneeIa: boolean | null;
  /** Les lignes de CHAQUE facture de la commande (hors avoirs). */
  lignes: readonly unknown[];
}): { reconnue: true; quantite: number } | { suspecte: true } | null {
  const mentions = e.lignes
    .flatMap(lignesLisibles)
    .filter((l) => montantDeLigne(l) > 0 && MOTIF_JOURNEE_IA.test(normaliser(l.designation)));
  if (e.devisJourneeIa === true) {
    const q = mentions.reduce((s, l) => {
      const n = typeof l.quantite === "number" ? l.quantite : Number(l.quantite);
      return s + (Number.isInteger(n) && n > 0 ? n : 1);
    }, 0);
    return { reconnue: true, quantite: q > 0 ? q : 1 };
  }
  return mentions.length > 0 ? { suspecte: true } : null;
}

/** La ligne a-t-elle un montant lisible (quantité et prix unitaire numériques) ? */
function ligneLisible(l: LigneDeFacture): boolean {
  const q = typeof l.quantite === "number" ? l.quantite : Number(l.quantite);
  return (
    Number.isFinite(q) &&
    typeof l.prixUnitaireHtCents === "number" &&
    Number.isFinite(l.prixUnitaireHtCents)
  );
}

/** Ligne d'acompte (« Acompte de 30 % — devis … ») ou sa déduction sur le solde (« Acompte déjà facturé — … »). */
function ligneDAcompte(l: LigneDeFacture): boolean {
  return /^acompte\b/.test(normaliser(l.designation));
}

/**
 * VENTILATION d'une commande qui porte une Journée IA (art. 4.1 bis : « à défaut de prix public pour
 * l'une d'elles, selon la ventilation du devis »), lue sur les lignes de ses factures (hors avoirs) :
 * HT des lignes POSITIVES « Journée IA », HT des autres lignes positives, nombre de journées.
 * Les lignes d'acompte et leurs déductions sur le solde sont ignorées (la facture de solde reprend
 * toutes les lignes du devis, `planifierFacturationDevis`).
 *
 * Commande MIXTE (autre HT > 0) : rien n'est deviné. La ventilation est « incertaine » dès qu'une
 * ligne est illisible, qu'une autre ligne négative existe (remise globale, déduction : à répartir
 * selon un prorata que le devis ne donne pas), ou que les lignes ne retombent pas sur le total du
 * devis (facture refaite, lignes modifiées), qu'une autre ligne ressemble à une somme non
 * commissionnée (A1.6) ou à une activité différente de celle de la facture. Une commande sans autre
 * ligne n'est jamais incertaine : son forfait se calcule sur la base de la commande, remises comprises.
 * Devis marqué sans ligne « Journée IA » : une seule ligne positive en tient lieu, plusieurs sont
 * incertaines.
 */
export function ventilerJourneeIa(e: {
  /** Les lignes de CHAQUE facture de la commande (hors avoirs). */
  lignes: readonly unknown[];
  /** Base de signature de la commande (total du devis, sinon HT des factures). */
  baseSignatureCents: number;
  /**
   * Activité des factures de la commande (une seule) : les autres lignes doivent lui ressembler.
   * Absente ou `null` : la cohérence n'est pas vérifiée ici (l'appelant met la commande « à
   * qualifier » faute d'activité).
   */
  activiteAutre?: string | null;
}): { journeeIaHtCents: number; autreHtCents: number; journees: number } | { incertaine: string } {
  const toutes = e.lignes.flatMap(lignesLisibles).filter((l) => !ligneDAcompte(l));
  let journeeIa = 0;
  let autre = 0;
  let journees = 0;
  let illisible = false;
  let negative = false;
  const autres: LigneDeFacture[] = [];
  for (const l of toutes) {
    if (!ligneLisible(l)) {
      illisible = true;
      continue;
    }
    const m = Math.round(montantDeLigne(l));
    if (m < 0) negative = true;
    if (m <= 0) continue;
    if (MOTIF_JOURNEE_IA.test(normaliser(l.designation))) {
      journeeIa += m;
      const n = typeof l.quantite === "number" ? l.quantite : Number(l.quantite);
      journees += Number.isInteger(n) && n > 0 ? n : 1;
    } else {
      autre += m;
      autres.push(l);
    }
  }
  if (illisible) return { incertaine: "une ligne de facture est illisible" };
  // Devis marqué « Journée IA » sans ligne qui en porte le nom (libellé libre : « Atelier IA sur
  // site ») : une seule ligne positive, c'est la Journée IA (jamais 0 €) ; plusieurs, rien n'est deviné.
  if (journeeIa === 0 && autres.length === 1)
    return { journeeIaHtCents: autre, autreHtCents: 0, journees: 1 };
  if (journeeIa === 0 && autres.length > 1)
    return {
      incertaine: `le devis est marqué « Journée IA » mais aucune ligne ne s'appelle « Journée IA » (${autres.map((x) => `« ${String(x.designation)} »`).join(", ")}) : la part de la Journée IA n'est pas connue`,
    };
  const base = {
    journeeIaHtCents: journeeIa,
    autreHtCents: autre,
    journees: Math.max(1, journees),
  };
  if (autre === 0) return base;
  // A1.6 : hébergement, maintenance, licence, abonnement ne sont jamais commissionnés, et le code ne
  // sait pas les retirer avec certitude d'une commande mixte : « à qualifier », quelle que soit
  // l'activité de la facture.
  const recurrentes = autres.filter((l) => MOTIF_RECURRENT.test(normaliser(l.designation)));
  if (recurrentes.length > 0)
    return {
      incertaine: `annexe 1, A1.6 : ${recurrentes.map((x) => `« ${String(x.designation)} »`).join(", ")} ressemble à une somme non commissionnée (abonnement, maintenance, hébergement, licence)`,
    };
  // La part « autre » suit l'activité de la facture : seulement si chacune de ses lignes est
  // cohérente avec elle (jamais 30 % d'audit sur une automatisation, jamais un taux sur du coaching).
  if (e.activiteAutre) {
    const discordantes = autres.filter((l) =>
      activitesRessemblantes(l.designation).some((a) => a !== e.activiteAutre),
    );
    if (discordantes.length > 0)
      return {
        incertaine: `${discordantes.map((x) => `« ${String(x.designation)} »`).join(", ")} ne ressemble pas à l'activité de la facture (${e.activiteAutre}) : la commission de l'autre partie ne peut pas être calculée avec certitude`,
      };
  }
  if (negative)
    return {
      incertaine: "une remise ou une déduction globale porte sur l'ensemble de la commande",
    };
  if (journeeIa + autre !== e.baseSignatureCents)
    return {
      incertaine: `les lignes des factures (${journeeIa + autre} centimes) ne retombent pas sur le total du devis (${e.baseSignatureCents} centimes)`,
    };
  return base;
}

/** Hébergement, maintenance, licence, abonnement (A1.6 : sommes non commissionnées). */
const MOTIF_RECURRENT = /\b(hebergement|maintenance|licences?|abonnements?)\b/;

/**
 * Activités auxquelles une ligne RESSEMBLE (désignation) : coaching, conférence, formation, audit,
 * automatisation/intégration, site web. Une ligne neutre (« Atelier d'idéation ») n'en a aucune.
 */
const MOTIFS_ACTIVITE: ReadonlyArray<readonly [string, RegExp]> = [
  ["un_a_un", /\b(coaching|one to one|one-to-one|accompagnement individuel)\b/],
  ["conference", /\b(conferences?|keynote)\b/],
  ["formation", /\bformations?\b/],
  ["audit", /\baudits?\b/],
  ["implementation", /\b(automatisations?|integrations?|implementations?|agents? ia|chatbots?)\b/],
  ["site_web", /\b(sites? (web|internet|vitrine)|developpement web)\b/],
];

function activitesRessemblantes(designation: unknown): string[] {
  const d = normaliser(designation);
  return MOTIFS_ACTIVITE.filter(([, re]) => re.test(d)).map(([a]) => a);
}

/**
 * Lignes POSITIVES d'une commande qui RESSEMBLENT à des sommes non commissionnées (A1.6). Rien n'est
 * exclu sur cette seule ressemblance : l'appelant alerte Williams, qui tranche.
 */
export function lignesRecurrentesSuspectes(lignes: readonly unknown[]): string[] {
  return lignes
    .flatMap(lignesLisibles)
    .filter((l) => montantDeLigne(l) > 0 && MOTIF_RECURRENT.test(normaliser(l.designation)))
    .map((l) => String(l.designation));
}

export interface CommandeSoldee {
  /** Clé de la commission (contrainte d'unicité facture/apporteur) : la dernière facture émise. */
  factureCleId: string;
  /** Toutes les factures de la commande, hors avoirs. */
  factureIds: string[];
  /** Total HT facturé net des avoirs (affichage ; ce n'est PAS la base de la commission). */
  totalHtCents: number;
  /**
   * BASE DE LA COMMISSION (règle du 25/11) : le total HT du devis tel qu'il est LU au passage
   * (`Devis.montantTotalHtCents`), sinon le HT des factures, avoirs non déduits. Ce module ne la
   * FIGE PAS : il relit le devis à chaque passage. Elle est stable parce que le devis l'est en
   * amont : un devis classique ne se modifie qu'en brouillon (`devis-classique-modifier.ts`), et
   * le total d'un devis à formules est recopié une fois, à l'acceptation. Un avoir, lui, ne la
   * change jamais (il ne joue que sur `baseApresAvoirsCents`).
   */
  baseSignatureCents: number;
  /**
   * Décision du 25/11 : la commission suit l'argent réellement GARDÉ. Base de signature moins ce
   * que les avoirs rendent au client (0 si tout est rendu). Un avoir APRÈS le passage est rattrapé
   * par `avoir-client.ts`, qui ramène la ligne existante à la même cible (`etatDeLaCommande`),
   * à la baisse comme à la hausse : un avoir avant ou après le passage donne le même résultat.
   */
  baseApresAvoirsCents: number;
  devisId: string | null;
}

/**
 * Ligne de COMPLÉMENT (palier `complement-de:<id d'origine>`) : quand le net payé d'une commande
 * revient (facture refaite ou complément payé) après une reprise, ou après une réduction faite
 * avant la facturation de la ligne, la différence est rendue à l'apporteur par une ligne « due »
 * qui renvoie à la ligne d'origine. Rien n'est supprimé ; jamais plus que la cible.
 */
export const PREFIXE_PALIER_COMPLEMENT = "complement-de:";

/**
 * Suspension AUTOMATIQUE (colonne `litigeDepuis`, même effet qu'une contestation : ni autofacture
 * ni virement) tant qu'une facture de la commande est émise sans être payée et que le payé ne
 * couvre plus la base. Le préfixe du motif la distingue d'une contestation saisie par Williams :
 * seul le passage la lève, et jamais il ne lève une contestation.
 */
export const PREFIXE_MOTIF_COMMANDE_NON_SOLDEE = "[commande non soldée]";

/** Une facture brouillon ou annulée n'a rien facturé. */
const STATUTS_SANS_EFFET = new Set(["brouillon", "annulee"]);

/**
 * Le prix HT NET d'une commande (ses factures + leurs avoirs, montants négatifs), brouillons et
 * pièces annulées écartés. SOURCE UNIQUE (RM-01) : `commandesSoldees` et la reprise après avoir
 * du client (`avoir-client.ts`) la lisent toutes deux. `avoirs` : ceux qui ont effet.
 */
export function netDeLaCommande(
  membres: readonly FactureDeCommande[],
  toutes: readonly FactureDeCommande[] = membres,
): { brutCents: number; netCents: number; avoirs: FactureDeCommande[] } {
  const actifs = membres.filter((f) => !STATUTS_SANS_EFFET.has(f.statut) && f.avoirDeId === null);
  const ids = new Set(actifs.map((f) => f.id));
  const avoirs = toutes.filter(
    (f) => !STATUTS_SANS_EFFET.has(f.statut) && f.avoirDeId !== null && ids.has(f.avoirDeId),
  );
  const brut = actifs.reduce((s, f) => s + f.montantHtCents, 0);
  return {
    brutCents: brut,
    netCents: brut + avoirs.reduce((s, a) => s + a.montantHtCents, 0),
    avoirs,
  };
}

/**
 * Les commandes intégralement payées parmi `factures` (factures ET avoirs, tous statuts).
 * Une commande dont le total net est nul ou négatif (tout remboursé) n'est pas rendue.
 */
export function commandesSoldees(
  factures: readonly FactureDeCommande[],
  /**
   * Total HT du devis accepté, par id de devis. Quand il est connu, la commande n'est soldée que
   * si le facturé (hors avoirs, brouillons et annulées) atteint ce total : un acompte payé seul,
   * solde pas encore facturé, ne solde rien (même règle que `devisSigneNonFacture`).
   */
  totauxDevis?: ReadonlyMap<string, number>,
): CommandeSoldee[] {
  const actives = factures.filter((f) => !STATUTS_SANS_EFFET.has(f.statut));
  const factures0 = actives.filter((f) => f.avoirDeId === null);
  const avoirs = actives.filter((f) => f.avoirDeId !== null);

  const groupes = new Map<string, FactureDeCommande[]>();
  for (const f of factures0) {
    const cle = f.devisId ? `devis:${f.devisId}` : `facture:${f.id}`;
    groupes.set(cle, [...(groupes.get(cle) ?? []), f]);
  }

  const out: CommandeSoldee[] = [];
  for (const [, membres] of groupes) {
    if (membres.length === 0 || membres.some((f) => f.statut !== "payee")) continue;
    const devisId = membres[0]!.devisId;
    const totalDevis = devisId ? totauxDevis?.get(devisId) : undefined;
    // Art. 4.3 (contrat 2.8) : un acompte ne prouve jamais le paiement à 100 %. Sans total de devis
    // pour le comparer (facture sans devis, devis disparu), un acompte gardé ne rapporte rien.
    if (totalDevis === undefined && membres.some((f) => f.estAcompte === true)) continue;
    if (totalDevis !== undefined && membres.reduce((s, f) => s + f.montantHtCents, 0) < totalDevis)
      continue;
    const { brutCents, netCents: net } = netDeLaCommande(membres, avoirs);
    if (net <= 0) continue;
    const triees = [...membres].sort(
      (a, b) =>
        (a.emiseAt?.getTime() ?? 0) - (b.emiseAt?.getTime() ?? 0) || a.id.localeCompare(b.id),
    );
    out.push({
      factureCleId: triees[triees.length - 1]!.id,
      factureIds: triees.map((f) => f.id),
      totalHtCents: net,
      baseSignatureCents: totalDevis !== undefined ? totalDevis : brutCents,
      // min(base, net) : jamais plus que ce qui est réellement gardé, jamais déduit deux fois
      // (facture refaite sous le même devis, facturé au-delà du devis).
      baseApresAvoirsCents: Math.max(
        0,
        Math.min(totalDevis !== undefined ? totalDevis : brutCents, net),
      ),
      devisId: membres[0]!.devisId,
    });
  }
  return out;
}

/**
 * L'ÉTAT FINAL d'une commande, d'où se déduit la commission CIBLE (décision du 25/11) : elle ne
 * dépend que de l'argent PAYÉ et gardé, jamais du moment où le passage horaire l'a vu. Un avoir
 * avant ou après le passage, une facture refaite ou un complément payé plus tard donnent le même
 * résultat que si tout avait été vu d'un coup par `commandesSoldees`.
 *
 *   · `baseCents` : la base de signature (total du devis, sinon HT des factures, avoirs non déduits) ;
 *   · `netPayeCents` : le HT des factures PAYÉES, net de leurs avoirs ;
 *   · `netCibleCents` : min(base, net payé), jamais négatif : l'assiette de la commission cible ;
 *   · `enAttente` : une facture de la commande est émise mais pas payée ET le payé ne couvre plus
 *     la base (facture refaite ou complément en cours) : la commande n'est plus soldée par du payé.
 *     Tant que c'est vrai, la commission ne part ni en autofacture ni en virement.
 */
export interface EtatDeLaCommande {
  baseCents: number;
  netPayeCents: number;
  netCibleCents: number;
  enAttente: boolean;
  /** Au moins un avoir actif sur la commande. */
  avecAvoir: boolean;
}

export function etatDeLaCommande(
  membres: readonly FactureDeCommande[],
  avoirs: readonly FactureDeCommande[],
  totalDevisCents?: number,
): EtatDeLaCommande {
  const actifs = membres.filter((f) => !STATUTS_SANS_EFFET.has(f.statut) && f.avoirDeId === null);
  const payees = actifs.filter((f) => f.statut === "payee");
  const brut = actifs.reduce((s, f) => s + f.montantHtCents, 0);
  const tous = netDeLaCommande(actifs, avoirs);
  const { netCents: netPaye } = netDeLaCommande(payees, avoirs);
  const base = totalDevisCents !== undefined ? totalDevisCents : brut;
  const netCible = Math.max(0, Math.min(base, netPaye));
  return {
    baseCents: base,
    netPayeCents: netPaye,
    netCibleCents: netCible,
    // Défaut 3 (tour 2/2) : une facture émise mais pas payée n'est « en attente » que si ses avoirs
    // ne l'annulent pas déjà (net propre > 0) ; une refaite entièrement annulée ne bloque plus rien.
    enAttente:
      actifs.some(
        (f) =>
          f.statut !== "payee" &&
          f.montantHtCents +
            avoirs
              .filter((a) => a.avoirDeId === f.id && !STATUTS_SANS_EFFET.has(a.statut))
              .reduce((s, a) => s + a.montantHtCents, 0) >
            0,
      ) && netCible < base,
    avecAvoir: tous.avoirs.length > 0,
  };
}

/**
 * Les factures « RENDUES » au sens de la recréation d'une commission : toutes les factures de la
 * commande qui existaient quand la ligne a été créée, si les avoirs actifs (où qu'ils soient
 * rattachés dans la commande) couvrent leur total. Un avoir total rattaché à l'acompte alors que la
 * ligne porte sur le solde rend donc bien la commande entière (jamais de blocage à vie).
 */
export function commandeRenduePourLaLigne(
  membres: readonly FactureDeCommande[],
  avoirs: readonly FactureDeCommande[],
  ligneCreeeAt: Date | null | undefined,
): boolean {
  // Date de création inconnue : toutes les factures de la commande comptent.
  const borne = ligneCreeeAt ? ligneCreeeAt.getTime() : Number.POSITIVE_INFINITY;
  const anciens = membres.filter(
    (f) =>
      !STATUTS_SANS_EFFET.has(f.statut) &&
      f.avoirDeId === null &&
      (!f.emiseAt || f.emiseAt.getTime() <= borne),
  );
  if (anciens.length === 0) return false;
  return netDeLaCommande(anciens, avoirs).netCents <= 0;
}

/**
 * Une ligne de commission est-elle RÉELLEMENT neutralisée ? Annulée avant facturation, retenue
 * (neutralisée par un avoir d'autofacture), ou versée dont les reprises couvrent tout le montant.
 * Seule une telle ligne peut cesser de bloquer une commission sur une facture refaite sous le même
 * devis : sinon (due, à qualifier, versée sans reprise complète) l'argent est encore en jeu et une
 * seconde commission le paierait deux fois.
 */
export function ligneNeutralisee(
  ligne: { statut: string; montantCents: number | null },
  reprisesCents: number,
): boolean {
  if (ligne.statut === "annulee" || ligne.statut === "retenue") return true;
  if (ligne.statut === "versee") return reprisesCents >= (ligne.montantCents ?? 0);
  return false;
}

/** Une ligne de reprise ou de complément liée à une commission d'origine (champ `palier`). */
export interface LigneLiee {
  id?: string;
  palier: string | null;
  montantCents: number | null;
  statut?: string | null;
}

export interface SoldeDesLignesLiees {
  /** Reprises (valeur absolue) portées par la ligne d'origine elle-même. */
  reprisCents: number;
  /** Compléments encore VIVANTS : montant des compléments ni annulés ni retenus, moins leurs reprises. */
  complementsCents: number;
  /** Les compléments, avec les reprises déjà faites sur chacun (plafond propre à sa ligne). */
  complements: Array<{ id: string; statut: string; montantCents: number; reprisCents: number }>;
}

/**
 * Le SOLDE d'une ligne d'origine (tour 2/2, défauts 1 et 4) : ses reprises et ses compléments
 * vivants, chaque complément net de ses PROPRES reprises (`<prefixeReprise><id du complément>`).
 * Source unique du passage (création d'une ligne neuve) et de la reprise après avoir : une ligne
 * reprise puis complétée n'est plus neutralisée, et un complément repris n'est plus vivant.
 */
export function soldeDesLignesLiees(
  origineId: string,
  liees: readonly LigneLiee[],
  prefixeReprise: string,
): SoldeDesLignesLiees {
  const complements = liees
    .filter((x) => x.palier === `${PREFIXE_PALIER_COMPLEMENT}${origineId}`)
    .map((x) => ({
      id: x.id ?? "",
      statut: x.statut ?? "due",
      montantCents: Math.max(0, x.montantCents ?? 0),
      reprisCents: liees
        .filter((r) => !!x.id && r.palier === `${prefixeReprise}${x.id}`)
        .reduce((s, r) => s + Math.abs(r.montantCents ?? 0), 0),
    }));
  const reprisCents = liees
    .filter((r) => r.palier === `${prefixeReprise}${origineId}`)
    .reduce((s, r) => s + Math.abs(r.montantCents ?? 0), 0);
  const complementsCents = complements
    .filter((c) => c.statut !== "annulee" && c.statut !== "retenue")
    .reduce((s, c) => s + Math.max(0, c.montantCents - c.reprisCents), 0);
  return { reprisCents, complementsCents, complements };
}
