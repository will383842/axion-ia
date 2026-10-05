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
  /** Total HT facturé net des avoirs. */
  totalHtCents: number;
  devisId: string | null;
}

/** Une facture brouillon ou annulée n'a rien facturé. */
const STATUTS_SANS_EFFET = new Set(["brouillon", "annulee"]);

/**
 * Les commandes intégralement payées parmi `factures` (factures ET avoirs, tous statuts).
 * Une commande dont le total net est nul ou négatif (tout remboursé) n'est pas rendue.
 */
export function commandesSoldees(factures: readonly FactureDeCommande[]): CommandeSoldee[] {
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
    const ids = new Set(membres.map((f) => f.id));
    const net =
      membres.reduce((s, f) => s + f.montantHtCents, 0) +
      avoirs.filter((a) => ids.has(a.avoirDeId!)).reduce((s, a) => s + a.montantHtCents, 0);
    if (net <= 0) continue;
    const triees = [...membres].sort(
      (a, b) =>
        (a.emiseAt?.getTime() ?? 0) - (b.emiseAt?.getTime() ?? 0) || a.id.localeCompare(b.id),
    );
    out.push({
      factureCleId: triees[triees.length - 1]!.id,
      factureIds: triees.map((f) => f.id),
      totalHtCents: net,
      devisId: membres[0]!.devisId,
    });
  }
  return out;
}
