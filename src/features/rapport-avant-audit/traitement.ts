/**
 * Traitement d'UN lancement du rapport avant audit par le worker (2026-11-02).
 *
 * Le worker ne reçoit que `{ rapportId }` : tout le reste est relu en base. Déroulé :
 *   1. interrupteur éteint → la ligne passe en `erreur` (message lisible), rien n'est appelé ;
 *   2. prise atomique `en_attente` → `en_cours` (`prendreRapport`) : un doublon de file ne fait
 *      jamais tourner deux fois le même lancement ;
 *   3. collecte (`lireCollecteDuClient`), roster des attendus sans réponse
 *      (`lireSuiviParPersonne`), fournisseur d'IA (`obtenirFournisseur`, injecté) ;
 *   4. `executerRapport`, progression notée en base au fil des étapes ;
 *   5. résultat chiffré et scellé (`enregistrerResultat`).
 *
 * ARRÊT (SIGTERM) : `arretDemande()` devient vrai, le fournisseur refuse l'appel suivant
 * (`InterruptionArret`) et la ligne repasse `en_attente` SANS erreur : la reprise est dans l'état
 * en base, le balayage du worker la remet en file (`lancementsEnSuspens`). Un appel déjà parti
 * va au bout : si c'était le dernier, le rapport est enregistré (`termine`).
 *
 * PROPRIÉTAIRE : `prendreRapport` rend un jeton (`debut_le`) ; toutes les écritures suivantes le
 * portent, si bien qu'une prise périmée ne peut plus écrire sur une ligne reprise ailleurs.
 *
 * BATTEMENT DE CŒUR : `maj_le` ne bougeait qu'entre deux étapes, or un seul appel d'IA peut durer
 * bien plus que `SILENCE_ABANDON_MS` (600 s × 3 essais × relances). Le balayage aurait alors remis
 * en file un rapport VIVANT : résultat perdu au premier passage, travail refait au second. Toutes
 * les `BATTEMENT_MS`, la dernière progression est donc ré-écrite (ce qui touche `maj_le`) ; le
 * battement s'arrête dans un `finally` — fin, erreur ou arrêt. Un worker planté ne bat plus : sa
 * prise est libérée au bout de `SILENCE_ABANDON_MS`, comme avant.
 *
 * Aucune écriture sur `clients` (la raison sociale est LUE). Aucun contenu dans les journaux.
 */

import { prisma } from "@/lib/prisma";
import type { PrismaClient } from "../../../prisma/generated/client";

import { lireSuiviParPersonne } from "../questionnaire-preaudit/suivi-par-personne";
import { MESSAGE_INTERRUPTEUR_ETEINT, rapportAvantAuditActif } from "./config";
import { ErreurRapport, executerRapport, type FournisseurIA } from "./executer";
import { FournisseurNonBranche, obtenirFournisseur } from "./fournisseur";
import { AucunQuestionnaireEnvoye, lireCollecteDuClient } from "./lire-collecte";
import {
  enregistrerResultat,
  lireEtatRapport,
  marquerErreur,
  noterProgression,
  prendreRapport,
  remettreEnAttente,
  type BaseRapports,
} from "./persistance";
import { rosterAttendusSansReponse } from "./roster";

/** Période du battement de cœur : bien en deçà de `SILENCE_ABANDON_MS` (30 min). */
export const BATTEMENT_MS = 5 * 60_000;

export class InterruptionArret extends Error {
  constructor() {
    super("Arrêt du worker demandé : le lancement sera repris.");
    this.name = "InterruptionArret";
  }
}

export interface DepsTraitement {
  readonly base: BaseRapports & Pick<PrismaClient, "client">;
  readonly actif: () => boolean;
  readonly lireCollecte: typeof lireCollecteDuClient;
  readonly lireSuivi: (ids: ReadonlyArray<string>) => ReturnType<typeof lireSuiviParPersonne>;
  readonly obtenirFournisseur: () => Promise<FournisseurIA>;
  readonly arretDemande: () => boolean;
  readonly maintenant: () => Date;
}

export const depsParDefaut = (arretDemande: () => boolean): DepsTraitement => ({
  base: prisma,
  actif: rapportAvantAuditActif,
  lireCollecte: lireCollecteDuClient,
  lireSuivi: (ids) => lireSuiviParPersonne(ids),
  obtenirFournisseur,
  arretDemande,
  maintenant: () => new Date(),
});

export type IssueTraitement =
  "eteint" | "introuvable" | "deja_pris" | "termine" | "erreur" | "interrompu";

/**
 * Le message enregistré en cas d'échec : écrit pour Will, BORNÉ, et jamais le message d'une
 * erreur inconnue (qui pourrait porter un extrait de réponse ou de base) — son nom seulement.
 */
export function messageDEchec(e: unknown): string {
  if (e instanceof FournisseurNonBranche || e instanceof AucunQuestionnaireEnvoye) return e.message;
  if (e instanceof ErreurRapport) {
    // JAMAIS `e.message` : pour une sortie d'IA refusée, il porte le détail zod, qui cite les
    // valeurs reçues (des extraits de réponses). L'étape seule (un nom d'étape du moteur) et un
    // texte fixe.
    const etape = e.etape.replace(/\s+/g, " ").trim().slice(0, 80);
    return `Rapport avant audit — étape « ${etape} » : réponse de l'IA invalide après une réparation, ou donnée manquante. Détail dans les journaux du worker.`;
  }
  const nom = e instanceof Error ? e.name : "inconnue";
  return `Erreur technique (${nom}) : voir les journaux du worker.`;
}

export async function traiterRapport(
  rapportId: string,
  deps: DepsTraitement,
): Promise<IssueTraitement> {
  const { base } = deps;
  if (!deps.actif()) {
    await marquerErreur(rapportId, MESSAGE_INTERRUPTEUR_ETEINT, deps.maintenant(), base);
    return "eteint";
  }
  const etat = await lireEtatRapport(rapportId, base);
  if (etat === null) return "introuvable";
  const jeton = await prendreRapport(rapportId, deps.maintenant(), base);
  if (jeton === null) return "deja_pris";

  // Notées en série, jamais bloquantes : une progression perdue n'arrête pas le rapport.
  let derniere: Promise<void> = Promise.resolve();
  let derniereEtape = "Démarrage";
  let dernierPct = 0;
  const noter = (etape: string, pct: number): void => {
    derniere = derniere
      .then(() => noterProgression(rapportId, jeton, etape, pct, base))
      .catch(() => undefined);
  };
  const battement = setInterval(() => noter(derniereEtape, dernierPct), BATTEMENT_MS);

  try {
    const client = await base.client.findUnique({
      where: { id: etat.clientId },
      select: { raisonSociale: true },
    });
    if (client === null) throw new ErreurRapport("fiche", "la fiche client est introuvable.");

    // Seulement les questionnaires photographiés au lancement (jamais un envoyé depuis).
    const { collecte } = await deps.lireCollecte(etat.clientId, etat.questionnaireIds);
    const suivis = await deps.lireSuivi(collecte.questionnaires.map((q) => q.id));
    const attendus = rosterAttendusSansReponse([...suivis.values()].map((s) => s.suivi));

    const brut = await deps.obtenirFournisseur();
    const fournisseur: FournisseurIA = async (appel) => {
      if (deps.arretDemande()) throw new InterruptionArret();
      return brut(appel);
    };

    const resultat = await executerRapport(collecte, {
      clientId: etat.clientId,
      raisonSociale: client.raisonSociale,
      genereLe: deps.maintenant(),
      genereePar: "Axion IA — rapport avant audit",
      fournisseur,
      attenduesSansReponse: attendus,
      surProgression: (p) => {
        const pct = p.total > 0 ? (p.fait / p.total) * 100 : 0;
        derniereEtape = p.etape;
        dernierPct = Math.min(pct, 99);
        noter(derniereEtape, dernierPct);
      },
    });
    clearInterval(battement);
    await derniere;
    // Un résultat complet est enregistré même si l'arrêt vient d'être demandé : rien n'est jeté.
    await enregistrerResultat(rapportId, jeton, resultat, deps.maintenant(), base);
    return "termine";
  } catch (e) {
    clearInterval(battement);
    // Seule l'interruption VOULUE (appel refusé après SIGTERM) remet en attente : une vraie
    // erreur survenue pendant l'arrêt reste une erreur, écrite pour Will.
    if (e instanceof InterruptionArret) {
      await remettreEnAttente(rapportId, jeton, base);
      return "interrompu";
    }
    await marquerErreur(rapportId, messageDEchec(e), deps.maintenant(), base, jeton);
    return "erreur";
  } finally {
    clearInterval(battement);
  }
}
