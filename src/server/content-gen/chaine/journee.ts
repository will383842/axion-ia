/**
 * Rythme de la chaîne éditoriale (C10, § 11 de `CONCEPTION-CHAINE-EDITORIALE-IA.md`).
 *
 * Module PUR, injecté. ÉTEINT par défaut : le réglage console (clé `chaine_editoriale` de
 * `ContentGenConfig`, lu par un port) vaut `actif: false` tant que Will ne l'allume pas, et
 * toute valeur illisible vaut « éteint ». L'interrupteur général d'environnement doit AUSSI
 * être allumé (`lancerContenu` l'exige). Aucun objectif de volume : 3 par jour est une limite
 * haute de sécurité, bornée aussi par la file de relecture et par le budget du jour.
 */

import { z } from "zod";
import { PLAFOND_COUT_CONTENU_USD } from "./roles/commun";
import { chaineAllumee } from "./roles/interrupteur";
import type { Besoin, IssueContenu } from "./orchestrateur";

export const CLE_REGLAGE_CHAINE = "chaine_editoriale";
export const SUJETS_PAR_JOUR_MAX = 3;
/** On ne produit pas plus vite qu'on ne relit : file arrêtée à 10 contenus en attente. */
export const FILE_RELECTURE_MAX = 10;
/** Part du plafond jour réservée au pilotage SEO/GEO (§ 6.2 : 2 $/jour partagés). */
export const RESERVE_PILOTAGE_JOUR_USD = 2;

const reglageSchema = z
  .object({
    actif: z.boolean(),
    sujetsParJour: z.number().int().min(0).max(SUJETS_PAR_JOUR_MAX),
  })
  .strict();
export type ReglageChaine = z.infer<typeof reglageSchema>;

export const REGLAGE_CHAINE_DEFAUT: ReglageChaine = { actif: false, sujetsParJour: 3 };

/** Valeur stockée → réglage ; absente, partielle ou invalide = éteint (échec fermé). */
export function lireReglageChaine(brut: unknown): ReglageChaine {
  const lu = reglageSchema.safeParse({ ...REGLAGE_CHAINE_DEFAUT, ...(isObjet(brut) ? brut : {}) });
  return lu.success ? lu.data : { ...REGLAGE_CHAINE_DEFAUT, actif: false };
}

function isObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export interface EtatJournee {
  readonly reglage: ReglageChaine;
  readonly lancesAujourdhui: number;
  readonly enAttenteRelecture: number;
  /** Plafond du jour moins ce qui est déjà dépensé, tous postes confondus. */
  readonly budgetJourRestantUsd: number;
}

/**
 * Combien de sujets lancer maintenant. Chaque contenu réserve son coût maximal (3 $) et le
 * pilotage garde ses 2 $ : avec un plafond jour de 10 $, deux contenus au plus.
 */
export function sujetsAutorises(e: EtatJournee): number {
  if (!e.reglage.actif) return 0;
  const nombres = [e.lancesAujourdhui, e.enAttenteRelecture, e.budgetJourRestantUsd];
  if (nombres.some((n) => !Number.isFinite(n) || n < 0)) return 0;
  if (e.enAttenteRelecture >= FILE_RELECTURE_MAX) return 0;
  const parLimite = Math.min(e.reglage.sujetsParJour, SUJETS_PAR_JOUR_MAX) - e.lancesAujourdhui;
  const parFile = FILE_RELECTURE_MAX - e.enAttenteRelecture;
  const parBudget = Math.floor(
    (e.budgetJourRestantUsd - RESERVE_PILOTAGE_JOUR_USD) / PLAFOND_COUT_CONTENU_USD,
  );
  return Math.max(0, Math.min(parLimite, parFile, parBudget));
}

export interface PortsJournee {
  readonly lireReglage: () => Promise<unknown>;
  readonly compterLancesAujourdhui: () => Promise<number>;
  readonly compterEnAttenteRelecture: () => Promise<number>;
  readonly budgetJourRestantUsd: () => Promise<number>;
  readonly prendreBesoins: (n: number) => Promise<ReadonlyArray<Besoin>>;
  readonly lancer: (besoin: Besoin) => Promise<IssueContenu>;
}

export interface BilanJournee {
  readonly lances: number;
  readonly issues: ReadonlyArray<IssueContenu>;
  readonly raisonArret: "eteint" | "interrupteur" | "aucun_autorise" | "termine";
}

/** Passage du jour : séquentiel (le coût d'un contenu compte avant de lancer le suivant). */
export async function lancerJournee(ports: PortsJournee): Promise<BilanJournee> {
  if (!chaineAllumee()) return { lances: 0, issues: [], raisonArret: "interrupteur" };
  const reglage = lireReglageChaine(await ports.lireReglage());
  if (!reglage.actif) return { lances: 0, issues: [], raisonArret: "eteint" };
  const issues: IssueContenu[] = [];
  const maxPassage = Math.min(reglage.sujetsParJour, SUJETS_PAR_JOUR_MAX);
  for (let i = 0; i < maxPassage; i++) {
    // L'état est relu avant CHAQUE sujet : budget et file bougent pendant le passage.
    const n = sujetsAutorises({
      reglage,
      lancesAujourdhui: await ports.compterLancesAujourdhui(),
      enAttenteRelecture: await ports.compterEnAttenteRelecture(),
      budgetJourRestantUsd: await ports.budgetJourRestantUsd(),
    });
    if (n < 1) return { lances: issues.length, issues, raisonArret: "aucun_autorise" };
    const [besoin] = await ports.prendreBesoins(1);
    if (!besoin) break;
    issues.push(await ports.lancer(besoin));
  }
  return { lances: issues.length, issues, raisonArret: "termine" };
}
