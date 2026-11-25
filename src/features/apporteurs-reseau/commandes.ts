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
}

export interface CommandeSoldee {
  /** Clé de la commission (contrainte d'unicité facture/apporteur) : la dernière facture émise. */
  factureCleId: string;
  /** Toutes les factures de la commande, hors avoirs. */
  factureIds: string[];
  /** Total HT facturé net des avoirs (affichage ; ce n'est PAS la base de la commission). */
  totalHtCents: number;
  /**
   * BASE DE LA COMMISSION (règle du 25/11) : le net HT arrêté à la signature du devis, calculé une
   * seule fois. Total du devis quand il est connu, sinon HT des factures à leur émission, avoirs
   * non déduits. Un avoir ou une modification du devis après la signature ne la change plus.
   */
  baseSignatureCents: number;
  /**
   * Décision du 25/11 : la commission suit l'argent réellement GARDÉ. Base de signature moins ce
   * que les avoirs rendent au client (0 si tout est rendu). Un avoir avant ou après le passage
   * donne ainsi le même résultat.
   */
  baseApresAvoirsCents: number;
  devisId: string | null;
}

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
