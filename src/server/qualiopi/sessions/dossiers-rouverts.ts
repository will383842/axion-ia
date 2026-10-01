/**
 * 🔴 Lot L4 (2026-09-30) — les dossiers ROUVERTS, là où on les voit.
 *
 * ADR 0060 (D5) : un dossier rouvert ne se reverrouille pas tout seul. Sans
 * signal, il resterait ouvert indéfiniment — c'est-à-dire une preuve modifiable
 * que personne ne regarde. Deux écrans le disent donc :
 *
 *   - « À traiter » : tout dossier rouvert depuis plus de 7 jours, avec le
 *     motif et l'auteur — c'est une tâche (clore à nouveau, ou dire pourquoi) ;
 *   - le Mode auditeur : les sessions rouvertes, avec EXACTEMENT le texte du
 *     manifeste du dossier d'audit (`lignesManifesteReouvertures`), lu dans le
 *     payload même de `manifeste.json` (`reouverturesSessions`). L'écran et le
 *     ZIP lisent la même donnée, avec les mêmes mots : un auditeur qui compare
 *     les deux ne doit trouver aucun écart.
 *
 * Aucune règle nouvelle ici : l'état « rouvert » vient de `chargerEtatsVerrou`
 * (la fonction unique de l'ADR 0060), le registre des réouvertures de
 * `lireReouverturesSessions` (celle du manifeste).
 */

import {
  lignesManifesteReouvertures,
  lireReouverturesSessions,
  type ReouvertureSessionManifeste,
} from "./historique-dossier";
import { chargerEtatsVerrou } from "./verrou-dossier";

/** Au-delà, un dossier rouvert devient une tâche de la page « À traiter ». */
export const DELAI_ALERTE_ROUVERT_JOURS = 7;

const JOUR_MS = 24 * 60 * 60 * 1000;

export interface DossierRouvertAncien {
  readonly sessionId: string;
  readonly numero: string;
  readonly titre: string;
  readonly depuis: Date;
  readonly par: string;
  readonly motif: string;
  /** Jours entiers écoulés depuis la réouverture. */
  readonly jours: number;
}

/**
 * Les candidats : sessions dont le DERNIER événement est une réouverture
 * antérieure au délai. Pur — la confirmation par le verrou se fait ensuite.
 */
export function candidatsRouvertsAnciens(
  sessions: ReadonlyArray<ReouvertureSessionManifeste>,
  maintenant: Date,
  jours: number = DELAI_ALERTE_ROUVERT_JOURS,
): ReouvertureSessionManifeste[] {
  const limite = maintenant.getTime() - jours * JOUR_MS;
  return sessions.filter((s) => {
    if (!s.toujoursRouvert) return false;
    const derniere = s.reouvertures[s.reouvertures.length - 1];
    return derniere !== undefined && new Date(derniere.le).getTime() <= limite;
  });
}

/**
 * Les dossiers rouverts depuis plus de 7 jours, confirmés par le verrou.
 *
 * `null` = le registre n'a pas pu être lu : l'écran doit le DIRE, jamais
 * afficher « aucun dossier rouvert » à la place.
 */
export async function listerDossiersRouvertsAnciens(
  maintenant: Date = new Date(),
): Promise<DossierRouvertAncien[] | null> {
  let registre: ReouvertureSessionManifeste[] | null;
  try {
    registre = await lireReouverturesSessions();
  } catch {
    return null;
  }
  if (registre === null) return null;
  const candidats = candidatsRouvertsAnciens(registre, maintenant);
  if (candidats.length === 0) return [];

  let etats: Awaited<ReturnType<typeof chargerEtatsVerrou>>;
  try {
    etats = await chargerEtatsVerrou(
      candidats.map((c) => c.sessionId),
      maintenant,
    );
  } catch {
    return null;
  }

  const out: DossierRouvertAncien[] = [];
  for (const c of candidats) {
    const e = etats.get(c.sessionId)?.etat;
    // Une session annulée après réouverture sort du parcours : pas une tâche.
    if (e === undefined || e.etat !== "rouvert") continue;
    out.push({
      sessionId: c.sessionId,
      numero: c.numero,
      titre: c.titre,
      depuis: e.depuis,
      par: e.par,
      motif: e.motif,
      jours: Math.floor((maintenant.getTime() - e.depuis.getTime()) / JOUR_MS),
    });
  }
  return out.sort((a, b) => a.depuis.getTime() - b.depuis.getTime());
}

/** Une ligne de l'encart : le numéro (lien vers la fiche) puis la suite, mot pour mot. */
export interface LigneEcranReouverture {
  readonly sessionId: string;
  readonly numero: string;
  /** Le reste de la ligne du manifeste, APRÈS le numéro. */
  readonly suite: string;
}

/**
 * Le texte du manifeste, débarrassé de sa syntaxe Markdown, pour l'écran.
 *
 * On ne RÉÉCRIT pas les phrases : on retire `## `, `**` et la puce `- `. Ainsi
 * un changement de formulation dans le manifeste se propage à l'écran sans
 * qu'aucune seconde version du texte puisse diverger. Les lignes de détail
 * sont appariées aux sessions dans l'ordre même où le manifeste les écrit
 * (session par session, réouverture par réouverture).
 */
export function lignesEcranReouvertures(
  sessions: ReadonlyArray<ReouvertureSessionManifeste> | null,
): { titre: string; resume: string; details: LigneEcranReouverture[] } {
  const lignes = lignesManifesteReouvertures(sessions).filter((l) => l.trim() !== "");
  const nettoyer = (l: string) =>
    l
      .replace(/^##\s+/, "")
      .replace(/^-\s+/, "")
      .replace(/\*\*/g, "")
      .replace(/^\*(.*)\*$/, "$1");
  const [titre = "", resume = "", ...textes] = lignes.map(nettoyer);
  const cles = (sessions ?? []).flatMap((s) =>
    s.reouvertures.map(() => ({ sessionId: s.sessionId, numero: s.numero })),
  );
  const details = textes.map((t, i) => {
    const cle = cles[i] ?? { sessionId: "", numero: "" };
    return {
      sessionId: cle.sessionId,
      numero: cle.numero,
      suite: t.startsWith(cle.numero) ? t.slice(cle.numero.length) : t,
    };
  });
  return { titre, resume, details };
}
