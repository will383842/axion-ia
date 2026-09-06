/**
 * ❌ UNE PAGE DE LA CONSOLE QUI NE CONSULTE AUCUNE SESSION.
 *
 * ═══ LE DÉFAUT QUE CETTE GARDE EXISTE POUR EMPÊCHER ═══
 *
 * Le 2026-09-05, une URL d'administration finissant par une extension de
 * fichier (`…/contacts/clients.png`) sortait du filtre du proxy — donc de la
 * SEULE vérification d'authentification du périmètre. Le trou lui-même est
 * fermé (#1000). Ce qui reste est sa leçon : **48 écrans ne tenaient qu'à cette
 * unique couche transverse.** Un seul défaut dedans les ouvrait tous d'un coup.
 *
 * Mesuré le 2026-09-06 sur les 311 pages de `(admin)` : **26 écrans** rendaient
 * des données sans jamais appeler `auth()` ni aucune garde. `contacts/clients`,
 * par exemple, servait la liste des messages clients à quiconque atteignait
 * l'URL. Ils sont corrigés dans la même PR — cette garde est là pour que le
 * 27ᵉ ne puisse pas être écrit.
 *
 * ═══ CE QUE CETTE GARDE PROUVE, ET CE QU'ELLE NE PROUVE PAS ═══
 *
 * ✅ Elle prouve qu'une page de la console **consulte la session côté serveur et
 *    refuse quelqu'un**. C'est exactement le défaut mesuré : des pages qui ne
 *    regardaient rien du tout.
 *
 * ❌ Elle ne prouve PAS que le refus est le bon, ni qu'il porte sur le bon rôle.
 *    Une page qui appellerait `auth()` puis `redirect()` pour une raison sans
 *    rapport passerait. Le dire ici plutôt que de laisser croire le contraire :
 *    une garde dont on surestime la portée est pire que pas de garde, parce
 *    qu'on cesse de regarder ce qu'elle ne couvre pas.
 *
 * 🔑 **Et surtout : un garde CÔTÉ CLIENT ne compte pas.** React 19 ne répare pas
 *    une divergence serveur/client — « This won't be patched up ». Ce que le
 *    serveur a écrit dans la réponse est parti ; un `return null` monté ensuite
 *    ne le retire pas. D'où l'exigence d'un appel dans un composant SERVEUR.
 *
 * ═══ LES DEUX FAMILLES ACCEPTÉES ═══
 *
 * 1. `gardePage()` (ou un enrobage `garde…()`) — l'idiome SSOT
 *    (`src/server/auth/garde-page.ts`). C'est celui à écrire aujourd'hui.
 * 2. `auth()` **suivi d'un refus** — `redirect()`, `notFound()` ou `AccesRefuse`.
 *    Idiome historique de 167 pages ; on ne le refuse pas, on ne l'étend pas.
 *
 * ═══ LA FAMILLE EXEMPTÉE, ET POURQUOI ═══
 *
 * Une page de **simple redirection** (un `permanentRedirect` vers l'écran qui
 * l'a remplacée, gardé, lui) ne rend rien et ne lit rien : elle n'a aucune
 * donnée à protéger. 21 adresses héritées sont dans ce cas, gardées vivantes
 * pour les favoris. Les inclure poserait un rouge que personne ne peut fermer
 * utilement — et la doctrine d'`AGENTS.md` interdit de poser un cliquet sur un
 * seuil déjà dépassé. L'exemption porte sur la FORME du fichier, jamais sur une
 * liste de chemins : une page qui cesse d'être une simple redirection retombe
 * automatiquement sous la garde.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// `process.cwd()` et non `__dirname` : le dépôt est en modules ES, où
// `__dirname` n'existe pas. Même résolution que `check-admin-nav-routes.ts`.
const RACINE = resolve(process.cwd());
const ADMIN_ROOT = join(RACINE, "src/app/[locale]/(admin)");

/**
 * La page de connexion, et elle seule.
 *
 * ⚠️ SEULE exemption par chemin de ce fichier, et elle est structurelle : c'est
 *    l'écran qui EXISTE pour la session absente. Lui demander une session serait
 *    verrouiller tout le monde dehors. Toute autre exemption doit passer par la
 *    forme du fichier, pas par cette liste — une liste de chemins grandit sans
 *    que personne ne s'en aperçoive.
 */
const EXEMPTION_STRUCTURELLE = ["[adminPrefix]/login/page.tsx"];

interface Verdict {
  chemin: string;
  famille: "helper" | "auth+refus" | "redirection" | "connexion" | "SANS GARDE";
}

/** Retire les commentaires : une garde citée dans un commentaire n'en est pas une. */
function sansCommentaires(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !(t.startsWith("//") || t.startsWith("*"));
    })
    .join("\n");
}

function pagesDeLaConsole(dir: string): string[] {
  let out: string[] = [];
  for (const nom of readdirSync(dir)) {
    // Next ignore les dossiers privés `_x` ; la garde doit les ignorer aussi,
    // sinon elle réclamerait une garde à des fragments qui ne sont pas des routes.
    if (nom.startsWith("_") || nom === "__tests__" || nom === "components") continue;
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) {
      out = out.concat(pagesDeLaConsole(chemin));
    } else if (nom === "page.tsx") {
      out.push(chemin);
    }
  }
  return out;
}

function classer(chemin: string): Verdict["famille"] {
  const relatif = chemin.slice(RACINE.length + 1).replace(/\\/g, "/");
  if (EXEMPTION_STRUCTURELLE.some((e) => relatif.endsWith(e))) return "connexion";

  const brut = readFileSync(chemin, "utf8");
  const code = sansCommentaires(brut);

  // 🔑 Un composant CLIENT ne peut pas porter la garde du périmètre : ce que le
  //    serveur a déjà écrit est parti. On ne le classe donc jamais comme gardé.
  const estClient = /^\s*["']use client["']/m.test(code);

  if (!estClient && /\bgarde[A-Z]\w*\s*\(/.test(code)) return "helper";
  if (
    !estClient &&
    /\bauth\(\)/.test(code) &&
    /\b(redirect|notFound)\s*\(|AccesRefuse/.test(code)
  ) {
    return "auth+refus";
  }

  // Simple redirection : renvoie ailleurs, ne rend aucun JSX, ne lit aucune donnée.
  // ⚠️ Le JSX se reconnaît à une balise FERMANTE ou auto-fermante. Un premier jet
  //    testait `<[A-Z]` et prenait `Promise<Record<…>>` pour du JSX — deux pages
  //    de simple redirection étaient alors comptées comme des écrans à corriger.
  const rendDuJsx = /<\/[A-Za-z]/.test(code) || /\/>/.test(code);
  const litDesDonnees = /prisma\.|await\s+(list|get|fetch|compter|charger)/.test(code);
  const renvoieAilleurs = /\b(permanentRedirect|redirect)\s*\(/.test(code);
  if (renvoieAilleurs && !rendDuJsx && !litDesDonnees) return "redirection";

  return "SANS GARDE";
}

const verdicts: Verdict[] = pagesDeLaConsole(ADMIN_ROOT).map((chemin) => ({
  chemin,
  famille: classer(chemin),
}));

const compte = (f: Verdict["famille"]): number => verdicts.filter((v) => v.famille === f).length;
const sansGarde = verdicts.filter((v) => v.famille === "SANS GARDE");

console.log(
  `[admin-gardes] ${verdicts.length} page(s) de la console — ` +
    `${compte("helper")} par gardePage, ${compte("auth+refus")} par auth()+refus, ` +
    `${compte("redirection")} simple(s) redirection(s), ${compte("connexion")} connexion.`,
);

/**
 * 🔴 ZÉRO ET VIDE SONT CE QU'UN INSTRUMENT REND QUAND IL N'A RIEN REGARDÉ.
 *
 * Un balayage qui ne trouve plus aucune page — dossier déplacé, `page.tsx`
 * renommé, filtre trop large — rendrait « 0 violation » et le vert serait
 * indiscernable d'un vrai succès. On refuse donc explicitement le vide, et on
 * exige que les deux familles de gardes soient PEUPLÉES : c'est le témoin
 * positif, sans lequel l'absence de violation ne prouve rien.
 */
if (verdicts.length < 200) {
  console.error(
    `❌ [admin-gardes] la garde ne mesure plus ce qu'elle croit : ` +
      `${verdicts.length} page(s) trouvée(s) sous ${ADMIN_ROOT} (plus de 300 attendues).`,
  );
  process.exit(1);
}
if (compte("helper") === 0 || compte("auth+refus") === 0) {
  console.error(
    `❌ [admin-gardes] aucune page reconnue dans une famille gardée ` +
      `(gardePage : ${compte("helper")}, auth()+refus : ${compte("auth+refus")}). ` +
      `Le classement ne marche plus — un « 0 violation » ne voudrait rien dire.`,
  );
  process.exit(1);
}

if (sansGarde.length > 0) {
  console.error(
    `❌ [admin-gardes] ${sansGarde.length} page(s) de la console ne consultent AUCUNE session :`,
  );
  for (const v of sansGarde) {
    const route = (v.chemin.split("[adminPrefix]").pop() ?? v.chemin)
      .replace(/\\/g, "/")
      .replace(/\/page\.tsx$/, "");
    console.error(`  - ${route || "/"}`);
  }
  console.error(
    "\n  Le périmètre admin ne doit jamais tenir au seul proxy : une URL qui en sort\n" +
      "  (c'est arrivé le 2026-09-05 avec une extension de fichier) ouvre alors tout.\n" +
      "  Pose la garde SSOT en tête du composant serveur :\n\n" +
      '    import { gardePage } from "@/server/auth/garde-page";\n' +
      '    import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";\n\n' +
      '    const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);\n' +
      "    if (!acces.autorise) {\n" +
      "      return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;\n" +
      "    }\n",
  );
  process.exit(1);
}

console.log(`✅ [admin-gardes] aucune page de la console sans garde de session.`);
