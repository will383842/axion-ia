/**
 * **L'ÉTAT DU DÉPLOIEMENT — LA COUCHE SERVICE.**
 *
 * Décision W-9 du cahier des charges `axion-ops` : « `deploiement.etat` :
 * GitHub seul (recommandé), Coolify avec un jeton dédié, ou pas d'outil ».
 * Non tranchée à ce jour ⇒ **le défaut écrit s'applique : GitHub seul.**
 *
 * ═══ CE QUE CE MODULE SAIT, ET CE QU'IL NE SAIT PAS ═══
 *
 * ✅ Il sait ce que GitHub Actions a **construit et déployé** : le dernier run
 *    du workflow de déploiement, sa conclusion, son commit, sa date.
 * ✅ Il sait quel commit **le processus courant exécute** (`BUILD_SHA`, injecté
 *    en `ENV` du Dockerfile depuis `github.sha`).
 * 🔑 **C'est la comparaison des deux qui répond à la vraie question** — « ma
 *    dernière modification est-elle en ligne ? ». Aucune des deux valeurs seule
 *    n'y répond : un run vert dit qu'une image a été poussée, pas qu'elle est
 *    servie. La route `deploy-notify` du dépôt porte exactement cet
 *    avertissement : « l'application n'a aucun moyen de savoir si le conteneur
 *    qui répond est l'ancien ou le nouveau ». Ici, elle l'a — pour elle-même.
 * ⚠️ Il ne sait RIEN de l'état du conteneur (santé, redémarrages) : c'est
 *    Coolify, et la décision W-9 ne l'a pas ouvert. Ne pas l'inventer.
 * ⚠️ En développement, `BUILD_SHA` vaut `dev` : la comparaison est alors sans
 *    objet, et c'est dit plutôt que rendu faux.
 *
 * ═══ 🔴 LE DÉPÔT EST PUBLIC. LE JETON N'A JAMAIS ÉTÉ NÉCESSAIRE. ═══
 *
 * Ce bloc a affirmé jusqu'au 2026-09-24 : « LE DÉPÔT EST PRIVÉ — SANS JETON,
 * L'API REND 404 ». **C'est faux.** Mesuré, sans le moindre en-tête
 * d'autorisation :
 *
 *     GET /repos/will383842/axion-ia/actions/workflows/deploy-coolify.yml/runs
 *     → HTTP 200, total_count 1675
 *
 * `gh repo view --json isPrivate` rend `false`. La croyance s'était propagée
 * à quatre endroits — ici trois fois, et sur l'écran d'infra, qui laissait
 * DEUX cartes GitHub en « non vérifié automatiquement (repo privé) » pour
 * cette raison-là. Elle coûtait un blocage : on attendait de Will qu'il crée
 * un jeton pour une lecture qui ne demandait rien.
 *
 * ⚠️ Le jeton garde une utilité, et une seule : le **quota**. Anonyme, GitHub
 * concède 60 requêtes par heure et par IP ; authentifié, 5 000. Le jeton est
 * donc un confort de débit, jamais une condition d'accès — et c'est pourquoi
 * son absence ne rend plus « non-configure » d'emblée.
 *
 * 🔑 CE QU'UN 404 SIGNIFIE MAINTENANT, et c'est l'inverse d'avant : sur un
 * dépôt public, il dit que le workflow n'existe pas. Il ne redevient « je
 * n'ai pas le droit de le voir » que si le dépôt repasse en privé — cas que
 * le message nomme, puisqu'il n'est plus déductible du contexte.
 */

const HOTE_API = "https://api.github.com";
const DEPOT_PAR_DEFAUT = "will383842/axion-ia";
const WORKFLOW = "deploy-coolify.yml";
const DELAI_MS = 8_000;

/** Le SHA que le build hors-ligne injecte quand rien n'est fourni (Dockerfile). */
const SHA_DE_DEVELOPPEMENT = "dev";

export const ETATS = [
  /** Le dernier run a réussi ET son commit est celui qui tourne. */
  "a-jour",
  /** Le dernier run a réussi, mais le processus courant exécute un autre commit. */
  "en-retard",
  "en-cours",
  "echec",
  /**
   * On ne peut pas savoir, et ce n'est PAS une panne : le quota des lectures
   * ANONYMES est épuisé (60/h par IP) et aucun jeton n'est posé. Poser un
   * jeton porte la limite à 5 000/h. ⚠️ Ce n'est plus « aucun jeton » — sans
   * jeton, la lecture marche, le dépôt étant public.
   */
  "non-configure",
  /** L'API n'a pas répondu, ou a répondu ce qu'on ne sait pas lire. */
  "indisponible",
] as const;

export type EtatDeploiement = (typeof ETATS)[number];

export interface DernierDeploiement {
  readonly etat: EtatDeploiement;
  /** Ce que dit GitHub, en clair et en français. */
  readonly resume: string;
  /** Le commit du dernier run terminé, ou `null`. */
  readonly commit: string | null;
  readonly titreDuCommit: string | null;
  readonly branche: string | null;
  /** Fin du run, en ISO 8601. `null` s'il n'est pas terminé. */
  readonly termineLe: string | null;
  /** Durée du run en secondes, quand elle est calculable. */
  readonly dureeSecondes: number | null;
  /** Le commit que le processus qui répond exécute — `null` hors production. */
  readonly commitEnService: string | null;
  /** Le numéro du run, pour retrouver le journal. Jamais une URL de jeton. */
  readonly numeroDeRun: number | null;
}

interface RunGitHub {
  readonly id?: unknown;
  readonly run_number?: unknown;
  readonly head_sha?: unknown;
  readonly head_branch?: unknown;
  readonly status?: unknown;
  readonly conclusion?: unknown;
  readonly created_at?: unknown;
  readonly updated_at?: unknown;
  readonly display_title?: unknown;
}

function chaine(valeur: unknown): string | null {
  return typeof valeur === "string" && valeur.length > 0 ? valeur : null;
}

/**
 * Le jeton de lecture. **Deux noms acceptés, dans cet ordre**, et la raison
 * tient en une phrase : `GITHUB_READ_TOKEN` est le jeton du moindre privilège
 * qu'on souhaite (lecture seule) ; `GH_DISPATCH_TOKEN` existe déjà dans la
 * production pour déclencher l'exercice de restauration, et il sait lire. Se
 * rabattre dessus évite d'exiger un geste de plus pour une lecture — mais le
 * jeton de lecture reste le bon, et il gagne quand il est là.
 */
function jetonDeLecture(): { readonly valeur: string; readonly nom: string } | null {
  const dedie = process.env["GITHUB_READ_TOKEN"];
  if (dedie !== undefined && dedie.length > 0) return { valeur: dedie, nom: "GITHUB_READ_TOKEN" };
  const repli = process.env["GH_DISPATCH_TOKEN"];
  if (repli !== undefined && repli.length > 0) return { valeur: repli, nom: "GH_DISPATCH_TOKEN" };
  return null;
}

/** Le commit que CE processus exécute. `null` en développement. */
export function commitEnService(): string | null {
  const sha = process.env["BUILD_SHA"];
  if (sha === undefined || sha.length === 0 || sha === SHA_DE_DEVELOPPEMENT) return null;
  return sha;
}

function memeCommit(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return false;
  // GitHub rend le SHA complet ; `BUILD_SHA` peut être abrégé selon l'appelant.
  const court = Math.min(a.length, b.length);
  return court >= 7 && a.slice(0, court) === b.slice(0, court);
}

function nonConfigure(): DernierDeploiement {
  return {
    etat: "non-configure",
    resume:
      "quota des lectures anonymes de l'API GitHub épuisé (60 requêtes/h par IP). " +
      "Poser GITHUB_READ_TOKEN (lecture seule) côté Coolify porte la limite à 5 000/h. " +
      "Le dépôt est public : ce n'est pas un défaut d'autorisation.",
    commit: null,
    titreDuCommit: null,
    branche: null,
    termineLe: null,
    dureeSecondes: null,
    commitEnService: commitEnService(),
    numeroDeRun: null,
  };
}

function indisponible(motif: string): DernierDeploiement {
  return {
    etat: "indisponible",
    resume: motif,
    commit: null,
    titreDuCommit: null,
    branche: null,
    termineLe: null,
    dureeSecondes: null,
    commitEnService: commitEnService(),
    numeroDeRun: null,
  };
}

/**
 * Lit le dernier run du workflow de déploiement et le confronte au commit en
 * service. Ne lève JAMAIS : toute panne devient un état nommé, parce qu'un
 * outil de pilotage qui jette une exception ne dit pas ce qui se passe.
 */
export async function lireEtatDuDeploiement(): Promise<DernierDeploiement> {
  // 🔑 `null` n'est plus un motif d'abandon : le dépôt est public, la lecture
  //    anonyme fonctionne. Le jeton, quand il est là, n'achète que du quota.
  const jeton = jetonDeLecture();

  const depot = process.env["GITHUB_REPOSITORY"] ?? DEPOT_PAR_DEFAUT;
  const url =
    `${HOTE_API}/repos/${depot}/actions/workflows/${WORKFLOW}/runs` +
    // ⚠️ `per_page=1` SUFFIT ICI, et c'est délibéré : on veut le run le plus
    //    récent du workflow de DÉPLOIEMENT, pas « le dernier run du dépôt ».
    //    Interroger le workflow par son nom de fichier est ce qui épingle la
    //    cible — un `gh run list --limit 1` global rendrait le run d'un autre
    //    workflow et annoncerait un atterrissage qui n'a pas eu lieu.
    "?per_page=1";

  let reponse: Response;
  try {
    reponse = await fetch(url, {
      headers: {
        // L'en-tête d'autorisation n'est posé QUE s'il y a quelque chose à
        // poser. `Bearer undefined` vaudrait un 401 — un refus fabriqué là où
        // l'anonyme aurait obtenu un 200.
        ...(jeton === null ? {} : { Authorization: `Bearer ${jeton.valeur}` }),
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(DELAI_MS),
      cache: "no-store",
    });
  } catch (erreur) {
    const nom = erreur instanceof Error ? erreur.name : "erreur";
    return indisponible(`l'API GitHub n'a pas répondu (${nom}).`);
  }

  // 🔑 QUOTA ÉPUISÉ — la seule panne que le jeton réparerait vraiment. GitHub
  //    rend 403 (et parfois 429) quand les 60 lectures anonymes horaires sont
  //    consommées. Sans jeton, c'est « non-configure » : actionnable, et ce
  //    n'est pas une panne. Avec jeton, c'est une vraie indisponibilité — 5 000
  //    requêtes par heure ne s'épuisent pas par accident.
  if (reponse.status === 403 || reponse.status === 429) {
    if (jeton === null) return nonConfigure();
    return indisponible(
      `l'API GitHub a rendu HTTP ${String(reponse.status)} avec le jeton ${jeton.nom} : ` +
        "quota dépassé, ou jeton révoqué.",
    );
  }
  if (reponse.status === 404) {
    // ⚠️ Le sens de ce code s'est INVERSÉ le 2026-09-24. Sur le dépôt public
    //    qu'est celui-ci, un 404 dit ce qu'il dit. Il ne redevient un défaut
    //    d'autorisation que si le dépôt repasse en privé — d'où les deux
    //    hypothèses nommées plutôt qu'une seule devinée.
    return indisponible(
      `le workflow « ${WORKFLOW} » est introuvable` +
        (jeton === null
          ? " en lecture anonyme. Le dépôt est public : soit le fichier a été renommé, " +
            "soit le dépôt est repassé en privé — dans ce cas, poser GITHUB_READ_TOKEN."
          : ` avec le jeton ${jeton.nom}. Soit le fichier a été renommé, soit le jeton ` +
            "n'a pas la portée « actions: read »."),
    );
  }
  if (!reponse.ok) {
    return indisponible(`l'API GitHub a rendu HTTP ${String(reponse.status)}.`);
  }

  let charge: { workflow_runs?: unknown };
  try {
    charge = (await reponse.json()) as { workflow_runs?: unknown };
  } catch {
    return indisponible("l'API GitHub a rendu un corps illisible.");
  }

  const runs = Array.isArray(charge.workflow_runs) ? (charge.workflow_runs as RunGitHub[]) : [];
  const run = runs[0];
  if (run === undefined) {
    return indisponible(`aucun run trouvé pour le workflow « ${WORKFLOW} ».`);
  }

  const statut = chaine(run.status);
  const conclusion = chaine(run.conclusion);
  const commit = chaine(run.head_sha);
  const debut = chaine(run.created_at);
  const fin = chaine(run.updated_at);
  const enService = commitEnService();

  const dureeSecondes =
    debut !== null && fin !== null
      ? Math.max(0, Math.round((Date.parse(fin) - Date.parse(debut)) / 1000))
      : null;

  const commun = {
    commit,
    titreDuCommit: chaine(run.display_title),
    branche: chaine(run.head_branch),
    commitEnService: enService,
    numeroDeRun: typeof run.run_number === "number" ? run.run_number : null,
  };

  if (statut !== "completed") {
    return {
      ...commun,
      etat: "en-cours",
      resume: `un déploiement est ${statut === "queued" ? "en file" : "en cours"}.`,
      termineLe: null,
      dureeSecondes: null,
    };
  }

  if (conclusion !== "success") {
    return {
      ...commun,
      etat: "echec",
      resume: `le dernier déploiement s'est terminé en « ${conclusion ?? "inconnu"} ».`,
      termineLe: fin,
      dureeSecondes,
    };
  }

  // Réussi. Reste la seule question qui compte : est-ce CE commit qui tourne ?
  if (enService === null) {
    return {
      ...commun,
      etat: "a-jour",
      resume:
        "le dernier déploiement a réussi. Le commit en service n'est pas connu de ce " +
        "processus (BUILD_SHA absent ou « dev ») : la concordance n'est pas vérifiée.",
      termineLe: fin,
      dureeSecondes,
    };
  }

  const concorde = memeCommit(commit, enService);
  return {
    ...commun,
    etat: concorde ? "a-jour" : "en-retard",
    resume: concorde
      ? "le dernier déploiement a réussi, et c'est bien ce commit qui est servi."
      : "le dernier déploiement a réussi, mais le processus qui répond exécute encore " +
        "un autre commit : l'atterrissage n'est pas terminé, ou le conteneur n'a pas " +
        "redémarré.",
    termineLe: fin,
    dureeSecondes,
  };
}
