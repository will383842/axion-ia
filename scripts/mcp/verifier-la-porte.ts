/**
 * `pnpm mcp:verifier-la-porte [base-url]` — **LA MESURE D'EXPLOITATION DU LOT 4a.**
 *
 * Critère (b) du lot 4a, mot pour mot : « POST /api/mcp sans secret rend 401/503,
 * vérifié depuis un autre réseau ». Un test unitaire ne peut pas le prouver — il
 * exerce le handler en processus, jamais la route telle qu'Internet la voit.
 * Ce script fait l'appel réel et transcrit ce qu'il a reçu.
 *
 * ═══ CE QU'IL MESURE, ET CE QU'IL NE MESURE PAS ═══
 *
 * ✅ Il mesure : ce que rend la route **publiée**, à travers Cloudflare, le proxy
 *    Next et le conteneur — donc la chaîne entière, pas une fonction.
 * ⚠️ Il ne mesure PAS « depuis un autre réseau » au sens strict. Il mesure
 *    « depuis la machine qui le lance ». Lancé depuis le poste de Will, c'est
 *    bien un réseau distinct du VPS ; lancé depuis le VPS lui-même, ce serait un
 *    appel en boucle locale et le résultat ne vaudrait rien. **Le script dit
 *    depuis où il a appelé** — c'est au lecteur de juger, pas au script de
 *    prétendre.
 * ⚠️ Un `403` de Cloudflare (Access, challenge) n'est PAS un succès : la porte
 *    n'aurait alors jamais été atteinte, et le contrôle qu'on croit avoir mesuré
 *    serait celui de quelqu'un d'autre. Ce cas est nommé, et il échoue.
 *
 * ═══ POURQUOI IL N'ENVOIE JAMAIS LE VRAI SECRET ═══
 *
 * Le seul verdict qui compte ici est un REFUS. Envoyer le secret de production
 * depuis un poste de travail le ferait transiter, et surtout : un 200 ne
 * prouverait rien de plus qu'un 401 bien rendu. Le script n'accepte aucun
 * secret, et n'en lit aucun dans l'environnement.
 */

// ⚠️ **CE `export {}` N'EST PAS DÉCORATIF.** Ce fichier n'a aucun `import` : sans
//    lui, TypeScript le traite comme un SCRIPT GLOBAL, et sa fonction `main()`
//    entre en collision avec celle d'un autre script du dépôt. Mesuré le
//    2026-09-02 : le typecheck rougissait sur
//    `src/scripts/backfill-hero-images.ts` — « Duplicate function
//    implementation » —, c'est-à-dire sur un fichier que personne n'avait
//    touché. L'erreur ne désigne jamais le nouveau venu.
export {};

const BASE_PAR_DEFAUT = "https://axion-ia.com";
const CHEMIN = "/api/mcp";
const DELAI_MS = 15_000;

/** Les codes que la porte a le droit de rendre à un appel sans secret valide. */
const CODES_DE_REFUS_ADMIS = [401, 503] as const;

interface Sonde {
  readonly nom: string;
  readonly attendu: readonly number[];
  readonly requete: (url: string) => Promise<Response>;
}

const CORPS = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" });

function poster(url: string, entetes: Record<string, string>): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...entetes },
    body: CORPS,
    signal: AbortSignal.timeout(DELAI_MS),
    redirect: "manual",
  });
}

const SONDES: readonly Sonde[] = [
  {
    nom: "POST sans aucun en-tête de secret",
    attendu: CODES_DE_REFUS_ADMIS,
    requete: (url) => poster(url, {}),
  },
  {
    nom: "POST avec un secret FAUX",
    attendu: CODES_DE_REFUS_ADMIS,
    requete: (url) => poster(url, { "x-mcp-secret": "ceci-n-est-pas-le-secret" }),
  },
  {
    nom: "POST avec un secret vide",
    attendu: CODES_DE_REFUS_ADMIS,
    requete: (url) => poster(url, { "x-mcp-secret": "" }),
  },
  {
    // ⚠️ Le bon nom d'en-tête compte. Une garde qui lirait « le premier en-tête
    //    qui ressemble » accepterait un porteur d'`Authorization`.
    nom: "POST avec un jeton en Authorization (mauvais en-tête)",
    attendu: CODES_DE_REFUS_ADMIS,
    requete: (url) => poster(url, { authorization: "Bearer ceci-n-est-pas-le-secret" }),
  },
  {
    nom: "GET (verbe interdit)",
    attendu: [405],
    requete: (url) =>
      fetch(url, { method: "GET", signal: AbortSignal.timeout(DELAI_MS), redirect: "manual" }),
  },
];

/**
 * La sonde du piège n° 1 : `/mcp` à la racine est redirigé en 301 vers `/fr/mcp`,
 * qui n'existe pas. On le VÉRIFIE, au lieu de le croire — le jour où le proxy
 * changerait, un socle mal configuré recevrait une redirection au lieu de JSON.
 */
async function sonderLaRacine(base: string): Promise<string> {
  try {
    const res = await poster(`${base}/mcp`, {});
    const emplacement = res.headers.get("location");
    return `HTTP ${String(res.status)}${emplacement ? ` → ${emplacement}` : ""}`;
  } catch (erreur) {
    return `injoignable (${erreur instanceof Error ? erreur.name : "erreur"})`;
  }
}

async function main(): Promise<void> {
  const base = (process.argv[2] ?? BASE_PAR_DEFAUT).replace(/\/+$/, "");
  const url = `${base}${CHEMIN}`;

  // D'où l'appel part-il ? Le critère parle d'« un autre réseau » : sans cette
  // ligne, la transcription ne permettrait pas de juger si c'en était un.
  let origine = "inconnue";
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(DELAI_MS),
    });
    if (res.ok) {
      const corps = (await res.json()) as { ip?: unknown };
      if (typeof corps.ip === "string") origine = corps.ip;
    }
  } catch {
    // Pas de réseau sortant vers ce service : on le dit, on ne bloque pas.
    origine = "non déterminée (service d'écho injoignable)";
  }

  console.log(`[mcp·porte] cible ${url}`);
  console.log(`[mcp·porte] appel émis depuis l'adresse publique : ${origine}`);
  console.log(`[mcp·porte] date : ${new Date().toISOString()}`);
  console.log("");

  let echecs = 0;
  let mesurees = 0;

  for (const sonde of SONDES) {
    let verdict: string;
    let ok = false;
    try {
      const res = await sonde.requete(url);
      const corps = (await res.text()).slice(0, 120).replace(/\s+/g, " ").trim();
      const serveur = res.headers.get("server") ?? "—";
      ok = (sonde.attendu as readonly number[]).includes(res.status);

      // ⚠️ UN 403 DE CLOUDFLARE N'EST PAS UN SUCCÈS. La porte n'aurait pas été
      //    atteinte : on mesurerait le contrôle de quelqu'un d'autre.
      if (res.status === 403) {
        ok = false;
        verdict = `403 — refus en AMONT (${serveur}) : la route n'a pas été atteinte`;
      } else if (res.status === 404) {
        // ⚠️ NOMMER CE CAS, sinon il se lit comme une panne. Un 404 ici veut dire
        //    que la route n'est pas (encore) servie par la version déployée —
        //    c'est le résultat NORMAL tant que la PR du lot 4a n'a pas atterri.
        //    Le distinguer d'un refus est tout l'objet de ce script : une porte
        //    absente et une porte qui refuse ne se ressemblent que dans un
        //    tableau de codes.
        ok = false;
        verdict = "404 — la route n'est pas servie par la version déployée (PR non fusionnée ?)";
      } else {
        verdict =
          `HTTP ${String(res.status)}` +
          (corps.length > 0 ? ` · corps « ${corps} »` : " · corps vide") +
          ` · server ${serveur}`;
      }
    } catch (erreur) {
      verdict = `échec réseau (${erreur instanceof Error ? erreur.name : "erreur"})`;
    }

    mesurees += 1;
    if (!ok) echecs += 1;
    const attendu = sonde.attendu.map(String).join(" ou ");
    console.log(`${ok ? "✅" : "❌"} ${sonde.nom}\n   attendu ${attendu} · reçu ${verdict}`);
  }

  console.log("");
  console.log(`[mcp·porte] piège n° 1 — POST ${base}/mcp : ${await sonderLaRacine(base)}`);
  console.log(`   (attendu : une redirection ou un 404 — c'est POURQUOI la route est /api/mcp)`);
  console.log("");
  console.log(
    `[mcp·porte] ${String(mesurees)} sonde(s) émise(s), ${String(echecs)} en échec — ` +
      `${echecs === 0 ? "la porte refuse tout appel sans secret valide" : "VÉRIFIER"}`,
  );
  if (echecs === mesurees) {
    console.log(
      "[mcp·porte] toutes les sondes ont échoué de la MÊME façon : lire le verdict ci-dessus " +
        "avant de conclure à un défaut de la garde — une route absente rend 404 partout.",
    );
  }

  if (echecs > 0) process.exit(1);
}

void main();
