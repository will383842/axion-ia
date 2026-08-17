/**
 * T0 — La garde qui empêche la fixture volumétrique de toucher la production.
 *
 * La fixture écrit 1 200 sessions, 8 000 inscriptions et 6 000 documents. Lancée
 * une seule fois contre la base de production, elle noie les données réelles
 * d'un organisme certifié sous des dizaines de milliers de lignes fictives —
 * dont des **pièces Qualiopi**, qui font foi devant un auditeur. Il n'existe pas
 * de « annuler » : c'est la seule opération de ce dépôt dont une exécution
 * accidentelle serait irréparable sans restauration de sauvegarde.
 *
 * 🔴 RÈGLE INVERSÉE, ET C'EST LE POINT. On n'énumère pas les hôtes INTERDITS —
 * une liste noire laisse passer tout hôte de production qu'on aura oublié d'y
 * inscrire, et c'est précisément le jour où l'on ajoute un serveur qu'on oublie
 * de mettre à jour la liste. On énumère les hôtes AUTORISÉS. Un hôte inconnu est
 * refusé par défaut. La garde échoue fermée.
 *
 * ⚠️ Ce que cette garde ne peut PAS voir, et qui reste le risque résiduel : un
 * tunnel SSH qui expose la base de production sur `localhost:5432`. Pour cette
 * raison précise, elle n'est que le PREMIER verrou. Le second est dans
 * l'écrivain (`fixture-volumetrique.ts`) : avant d'écrire, il compte les lignes
 * qui ne portent PAS le préfixe de la fixture, et refuse si la base contient
 * déjà des données métier. Une base de production échoue ce second test même à
 * travers un tunnel.
 */

/** Ce que la fixture accepte comme cible. Tout le reste est refusé. */
const HOTES_AUTORISES = new Set(["localhost", "127.0.0.1", "::1", "postgres", "db"]);

/**
 * Marqueurs d'un environnement de préproduction explicitement nommé. Ils sont
 * additionnels à la liste d'hôtes : un hôte distant n'est accepté que s'il se
 * DÉCLARE préproduction dans son nom de base ou son hôte.
 */
const MARQUEURS_PREPROD = ["preprod", "staging", "recette", "sandbox"];

export type RefusCible =
  "url_absente" | "url_illisible" | "stub" | "node_env_production" | "hote_non_autorise";

export type VerdictCible =
  { ok: true; hote: string; base: string } | { ok: false; raison: RefusCible; message: string };

export interface EnvironnementCible {
  DATABASE_URL?: string | undefined;
  NODE_ENV?: string | undefined;
}

/**
 * La cible décrite par `env` accepte-t-elle la fixture volumétrique ?
 *
 * Fonction PURE : mêmes entrées, même verdict. C'est ce qui permet de la tester
 * sans base, et donc de VOIR la garde refuser — une garde de destruction qu'on
 * n'a jamais vue refuser n'est qu'une intention.
 */
export function cibleAutorisee(env: EnvironnementCible): VerdictCible {
  const url = env.DATABASE_URL;
  if (url == null || url.trim() === "") {
    return {
      ok: false,
      raison: "url_absente",
      message:
        "DATABASE_URL n'est pas définie. La fixture volumétrique refuse de deviner sa cible.",
    };
  }

  // `NODE_ENV=production` est testé AVANT l'hôte : une préproduction lancée en
  // mode production reste refusée. Le mode dit l'intention ; on ne parie pas
  // dessus quand l'erreur est irréparable.
  if (env.NODE_ENV === "production") {
    return {
      ok: false,
      raison: "node_env_production",
      message:
        "NODE_ENV=production. La fixture volumétrique ne s'exécute jamais en mode production, " +
        "quelle que soit la base visée.",
    };
  }

  let hote: string;
  let base: string;
  try {
    const u = new URL(url);
    hote = u.hostname;
    base = u.pathname.replace(/^\//, "");
  } catch {
    return {
      ok: false,
      raison: "url_illisible",
      message: `DATABASE_URL n'est pas une URL exploitable — cible indéterminable, donc refusée.`,
    };
  }

  if (hote.includes("stub.invalid")) {
    return {
      ok: false,
      raison: "stub",
      message:
        "DATABASE_URL pointe sur le stub de build (ADR 0026) : il n'y a aucune base à peupler.",
    };
  }

  const declarePreprod = MARQUEURS_PREPROD.some(
    (m) => hote.toLowerCase().includes(m) || base.toLowerCase().includes(m),
  );

  if (!HOTES_AUTORISES.has(hote) && !declarePreprod) {
    return {
      ok: false,
      raison: "hote_non_autorise",
      message:
        `Hôte « ${hote} » inconnu de la liste blanche. La fixture volumétrique n'écrit que sur ` +
        `${[...HOTES_AUTORISES].join(", ")}, ou sur un hôte/base qui se déclare ` +
        `préproduction (${MARQUEURS_PREPROD.join(", ")}). ` +
        `Un hôte non listé est refusé par défaut : la garde échoue fermée, exprès.`,
    };
  }

  return { ok: true, hote, base };
}
