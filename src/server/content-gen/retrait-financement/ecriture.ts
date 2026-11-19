/**
 * Retrait des mentions de financement — ÉCRITURE et RESTAURATION, sans Prisma : tout passe par un
 * `Depot` (adaptateur écrit dans le script, en mémoire dans les tests). Aucune suppression, aucune
 * sauvegarde existante n'est écrasée : chaque écriture ajoute une ligne de journal.
 */
import {
  ACTION_OVERRIDE,
  ACTION_RESTAURATION,
  ACTION_RESTAURATION_OVERRIDE,
  ACTION_RETRAIT,
  type Champs,
  type Proposition,
  type Table,
  champsARestaurer,
  empreinte,
} from "./plan";

export interface LigneJournal {
  action: string;
  settingKey: string | null;
  oldValue: unknown;
  newValue: unknown;
  createdAt: Date;
}

/** Une transaction : lecture, écriture d'une ligne de contenu, ajout au journal. */
export interface Transaction {
  lire(table: Table, id: string): Promise<Champs | null>;
  ecrire(table: Table, id: string, champs: Champs): Promise<void>;
  journaliser(entree: {
    action: string;
    settingKey: string;
    oldValue: Champs;
    newValue: Champs;
  }): Promise<void>;
}

export interface Depot {
  /** Une ligne de journal de cette action existe-t-elle pour cette clé ? */
  existe(action: string, cle: string): Promise<boolean>;
  /** Une ligne de journal de cette action existe-t-elle pour cette clé, créée APRÈS `apres` ? */
  existeApres(action: string, cle: string, apres: Date): Promise<boolean>;
  lignes(actions: string[]): Promise<LigneJournal[]>;
  transaction<T>(f: (tx: Transaction) => Promise<T>): Promise<T>;
}

const nul = (v: unknown): unknown => (v === null || v === undefined ? null : v);
const memeValeur = (a: unknown, b: unknown): boolean => empreinte(nul(a)) === empreinte(nul(b));

/**
 * Override sur un contenu DÉJÀ traité : seuls les champs surchargés sont réécrits, avec leur propre
 * sauvegarde (action « override », ancienne valeur = valeur courante) écrite dans la même
 * transaction ; la sauvegarde du premier passage n'est jamais touchée.
 */
export async function appliquerOverride(depot: Depot, p: Proposition): Promise<boolean> {
  const champs = (p.surcharges ?? []).filter((c) => c in p.apres);
  if (champs.length === 0) return false;
  const avant: Champs = {};
  const apres: Champs = {};
  for (const c of champs) {
    avant[c] = nul(p.avant[c]);
    apres[c] = p.apres[c];
  }
  return depot.transaction(async (tx) => {
    const courant = await tx.lire(p.table, p.id);
    if (!courant) throw new Error(`${p.cle} : ligne introuvable`);
    // Déjà à la valeur voulue : rien à faire (relance idempotente).
    if (champs.every((c) => memeValeur(courant[c], apres[c]))) return false;
    for (const c of champs)
      if (!memeValeur(courant[c], avant[c]))
        throw new Error(`${p.cle}.${c} : modifié depuis l'essai à blanc, refus`);
    await tx.journaliser({
      action: ACTION_OVERRIDE,
      settingKey: p.cle,
      oldValue: avant,
      newValue: apres,
    });
    await tx.ecrire(p.table, p.id, apres);
    return true;
  });
}

export async function appliquer(
  depot: Depot,
  propositions: Proposition[],
): Promise<{ ecrits: number; deja: string[] }> {
  let ecrits = 0;
  const deja: string[] = [];
  for (const p of propositions) {
    if (Object.keys(p.apres).length === 0) continue;
    // Jamais d'écrasement d'une sauvegarde existante : contenu déjà traité → on s'arrête là pour lui,
    // sauf un override humain, qui est une réécriture ciblée avec sa propre sauvegarde.
    if (await depot.existe(ACTION_RETRAIT, p.cle)) {
      if (await appliquerOverride(depot, p)) ecrits++;
      else deja.push(p.cle);
      continue;
    }
    await depot.transaction(async (tx) => {
      const courant = await tx.lire(p.table, p.id);
      if (!courant) throw new Error(`${p.cle} : ligne introuvable`);
      for (const [champ, ancien] of Object.entries(p.avant))
        if (!memeValeur(courant[champ], ancien))
          throw new Error(`${p.cle}.${champ} : modifié depuis l'essai à blanc, refus`);
      await tx.journaliser({
        action: ACTION_RETRAIT,
        settingKey: p.cle,
        oldValue: p.avant,
        newValue: p.apres,
      });
      await tx.ecrire(p.table, p.id, p.apres);
    });
    ecrits++;
  }
  return { ecrits, deja };
}

/**
 * Restauration : les overrides se défont d'abord (le plus récent d'abord), puis le premier passage ;
 * chaque ligne seulement si la valeur actuelle est celle que le script a écrite.
 */
export async function restaurer(
  depot: Depot,
  only: Set<string> | null,
  urlsDe: (table: Table, ligne: Champs) => Promise<string[]>,
): Promise<{ restaures: number; divergences: string[]; urls: string[]; lignes: string[] }> {
  const lignes = (await depot.lignes([ACTION_OVERRIDE, ACTION_RETRAIT])).sort(
    (a, b) =>
      Number(b.action === ACTION_OVERRIDE) - Number(a.action === ACTION_OVERRIDE) ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );
  let restaures = 0;
  const divergences: string[] = [];
  const urls: string[] = [];
  const restaurees: string[] = [];
  for (const l of lignes) {
    const [table, id] = (l.settingKey ?? "").split(":") as [Table, string];
    if (!table || !id || (only && !only.has(id))) continue;
    const avant = (l.oldValue ?? {}) as Champs;
    const apres = (l.newValue ?? {}) as Champs;
    const actionRestauration =
      l.action === ACTION_OVERRIDE ? ACTION_RESTAURATION_OVERRIDE : ACTION_RESTAURATION;
    if (await depot.existeApres(actionRestauration, l.settingKey ?? "", l.createdAt)) continue;
    await depot.transaction(async (tx) => {
      const courant = await tx.lire(table, id);
      if (!courant) {
        divergences.push(`${l.settingKey} : ligne introuvable`);
        return;
      }
      // Remet l'original SEULEMENT si la valeur actuelle est celle que le script a écrite.
      const diverge = Object.keys(apres).filter((c) => !memeValeur(courant[c], apres[c]));
      if (diverge.length > 0) {
        divergences.push(
          `${l.settingKey} : champs modifiés depuis (${diverge.join(", ")}), non restauré`,
        );
        return;
      }
      const remis = champsARestaurer(avant, apres);
      await tx.ecrire(table, id, remis);
      await tx.journaliser({
        action: actionRestauration,
        settingKey: l.settingKey ?? "",
        oldValue: apres,
        newValue: remis,
      });
      restaures++;
      restaurees.push(`${l.settingKey} : ${Object.keys(remis).join(", ")}`);
      urls.push(...(await urlsDe(table, courant)));
    });
  }
  return { restaures, divergences, urls: [...new Set(urls)].sort(), lignes: restaurees };
}
