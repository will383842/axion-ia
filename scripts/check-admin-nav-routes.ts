// Vérifie que CHAQUE entrée de la navigation admin pointe sur une route qui
// existe réellement sur le disque (refonte « Boîte de réception » 2026-07-29).
//
// Pourquoi : `buildAdminNav()` est un SSOT de chaînes de caractères. Rien, ni le
// compilateur ni les tests d'origine, ne relie ces chaînes aux fichiers
// `page.tsx` correspondants — un renommage de dossier laisse donc une entrée de
// menu qui mène à un 404, en silence. C'est exactement le risque qu'introduit un
// déplacement de routes ; ce script le ferme.
//
// Résolution : on retire le préfixe `/fr/<adminPrefix>` puis on cherche, sous
// `src/app/[locale]/(admin)/[adminPrefix]/`, un `page.tsx` dont le chemin
// correspond segment à segment — un segment dynamique `[x]` acceptant n'importe
// quel segment concret.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { ADMIN_LIENS_EPINGLES, ADMIN_ROUTES_EPINGLEES, buildAdminNav } from "../src/lib/admin-nav";

const ADMIN_ROOT = resolve(process.cwd(), "src/app/[locale]/(admin)/[adminPrefix]");
const PREFIX = "test-prefix";

/** Le composant qui rend la barre latérale — SECONDE source de destinations. */
const FICHIER_BARRE_LATERALE = resolve(
  process.cwd(),
  "src/components/admin/ui/AdminSidebarNav.tsx",
);

/**
 * 🔴 LES TROISIÈME ET QUATRIÈME SOURCES DE NAVIGATION (2026-09-06).
 *
 * La console n'a jamais eu DEUX sources de destinations, elle en a QUATRE. Deux
 * sont gardées depuis le 2026-09-05 — `buildAdminNav()` et les liens épinglés du
 * pied de barre. Les deux autres écrivent leurs adresses EN DUR, dans du JSX :
 *
 *   · `AdminUserMenu`  → `/2fa/setup`, `/settings`
 *   · le layout admin  → `/alerts`, `/content-gen/costs`, `/content-gen/jobs`
 *                        (destinations des pastilles et des notifications)
 *
 * ⚠️ CE QUI N'ÉTAIT GARDÉ PAR RIEN, ET QUI EST LE DÉFAUT EXACT QUE CE SCRIPT
 *    EXISTE POUR FERMER. Ces cinq adresses ne sont vérifiées par personne :
 *    renommer le dossier `2fa/setup/` ferait pointer l'entrée « Sécurité (2FA) »
 *    du menu utilisateur sur un 404, et TOUT serait resté vert. C'est mot pour
 *    mot le raisonnement qui avait fait entrer les liens épinglés dans cette
 *    passe : « une destination n'est pas moins une destination parce qu'elle est
 *    écrite dans un composant plutôt que dans le menu. »
 *
 * 🔑 Aujourd'hui ces cinq routes figurent AUSSI dans `buildAdminNav()`. C'est
 *    une coïncidence, pas une garantie : rien n'oblige un lien écrit en dur à
 *    doubler une entrée de menu, et la prochaine pastille ajoutée au layout
 *    n'aura aucune raison d'en avoir une. La garde porte donc sur la FORME du
 *    lien, pas sur la liste d'aujourd'hui.
 */
const SOURCES_DE_LIENS_EN_DUR: ReadonlyArray<string> = [
  "src/components/admin/ui/AdminUserMenu.tsx",
  "src/app/[locale]/(admin)/[adminPrefix]/layout.tsx",
];

/** Segments concrets d'un chemin épinglé (`/console-editoriale` → ["console-editoriale"]). */
function segmentsEpingles(chemin: string): string[] {
  return chemin.split("/").filter(Boolean);
}

/** Segments concrets d'une route de nav (`/fr/p/a/b` → ["a","b"]). */
function navSegments(href: string): string[] {
  const withoutBase = href.replace(`/fr/${PREFIX}`, "");
  return withoutBase.split("/").filter(Boolean);
}

/**
 * Vrai s'il existe un `page.tsx` atteignable pour ces segments.
 * Les dossiers de groupe `(x)` sont transparents ; `[x]` matche tout segment.
 */
function routeExists(dir: string, segments: string[]): boolean {
  if (segments.length === 0) return existsSync(join(dir, "page.tsx"));
  const [head, ...tail] = segments as [string, ...string[]];

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return false;
  }

  for (const entry of entries) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    // Groupe de route « (admin) » : invisible dans l'URL, on descend sans
    // consommer de segment.
    if (entry.startsWith("(") && entry.endsWith(")")) {
      if (routeExists(full, segments)) return true;
      continue;
    }
    const isDynamic = entry.startsWith("[") && entry.endsWith("]");
    if (entry === head || isDynamic) {
      if (routeExists(full, tail)) return true;
    }
  }
  return false;
}

const items = buildAdminNav(PREFIX);
const missing: string[] = [];
const externesInvalides: string[] = [];

// 🔴 2026-08-24 — cette garde a rougi à l'ajout du premier lien EXTERNE (Tiime,
// notre plateforme agréée de facturation). Elle n'avait pas tort : jusque-là,
// toute entrée de nav était une route de cette application, et une entrée sans
// fichier de route était forcément un lien mort.
//
// On ne l'affaiblit donc pas en excluant simplement le cas. On lui apprend les
// DEUX natures, et on exige de chacune ce qui lui correspond :
//   · une entrée INTERNE doit avoir son fichier de route ;
//   · une entrée EXTERNE doit être une URL absolue en https, et ne peut pas
//     être une route interne déguisée — ce qui produirait un `target="_blank"`
//     sur notre propre console.
const internes = items.filter((it) => it.external !== true);
const externes = items.filter((it) => it.external === true);

for (const item of internes) {
  if (!routeExists(ADMIN_ROOT, navSegments(item.href))) {
    missing.push(`${item.label} → ${item.href}`);
  }
}

for (const item of externes) {
  if (!item.href.startsWith("https://")) {
    externesInvalides.push(`${item.label} → ${item.href} (doit être une URL absolue https)`);
  }
}

// 🔴 2026-09-05 — LES LIENS ÉPINGLÉS PASSENT PAR LA MÊME EXIGENCE.
//
// La passe réciproque, plus bas, les accepte comme DESTINATIONS : elles blanchissent
// `/console-editoriale`, ses dix écrans et `/agenda`. Mais elle ne peut pas dire si
// la destination existe — une route absente n'y produit aucune erreur, elle n'est
// simplement jamais appariée. Autrement dit : renommer le dossier `agenda/` ferait
// pointer le lien du pied de barre sur un 404, et TOUT serait resté vert.
//
// C'est le défaut EXACT que cette première passe existe pour fermer, et il rentrait
// par la porte que la troisième venait d'ouvrir. Une destination n'est pas moins une
// destination parce qu'elle est écrite dans un composant plutôt que dans le menu.
for (const chemin of ADMIN_ROUTES_EPINGLEES) {
  if (!routeExists(ADMIN_ROOT, segmentsEpingles(chemin))) {
    missing.push(`(épinglé en pied de barre latérale) → ${chemin}`);
  }
}

/**
 * Les adresses écrites en dur dans les deux sources restantes.
 *
 * On accepte les deux formes que le dépôt emploie :
 *   · `${adminBase}/x/y`            — menu utilisateur, pastilles du layout
 *   · `/${locale}/${adminPrefix}/x` — la forme longue, quand `adminBase` n'est
 *                                     pas sous la main
 *
 * ⚠️ La chaîne de requête est retirée : `/content-gen/jobs?status=failed` et
 *    `/content-gen/jobs` désignent la MÊME route. La garder ferait chercher un
 *    dossier `jobs?status=failed` et rendrait un faux rouge.
 */
function liensEnDur(source: string): string[] {
  const trouves = new Set<string>();
  for (const m of source.matchAll(/\$\{adminBase\}(\/[^`"'\s{}]*)/g)) {
    trouves.add((m[1] ?? "").split("?")[0] ?? "");
  }
  for (const m of source.matchAll(/\/\$\{locale\}\/\$\{adminPrefix\}(\/[^`"'\s{}]*)/g)) {
    trouves.add((m[1] ?? "").split("?")[0] ?? "");
  }
  // `${adminBase}` seul (la racine de la console) n'est pas une sous-route.
  return [...trouves].filter((c) => c.length > 1);
}

let liensEnDurExamines = 0;
for (const fichier of SOURCES_DE_LIENS_EN_DUR) {
  const chemin = resolve(process.cwd(), fichier);
  const source = readFileSync(chemin, "utf8");
  for (const lien of liensEnDur(source)) {
    liensEnDurExamines++;
    if (!routeExists(ADMIN_ROOT, segmentsEpingles(lien))) {
      missing.push(`(lien écrit en dur dans ${fichier}) → ${lien}`);
    }
  }
}

/**
 * 🔴 CONTRE-TÉMOIN. Une extraction qui ne trouve plus rien rendrait « 0 lien
 *    invalide » — indiscernable d'un vrai succès. C'est le piège qui a déjà
 *    coûté une garde ce matin même, ailleurs dans le dépôt : le motif cherché
 *    avait cessé de correspondre au code, et le vert n'avait plus de sens.
 *
 *    Les deux fichiers portent cinq adresses au 2026-09-06. Le seuil est posé
 *    à quatre pour tolérer qu'une pastille disparaisse sans rougir à tort,
 *    mais pas qu'elles disparaissent toutes.
 */
if (liensEnDurExamines < 4) {
  console.error(
    `❌ [admin-nav:routes] seulement ${liensEnDurExamines} lien(s) écrit(s) en dur trouvé(s) ` +
      `dans ${SOURCES_DE_LIENS_EN_DUR.join(" et ")} : l'extraction ne reconnaît plus la ` +
      `forme des liens, et un « aucun lien invalide » ne voudrait plus rien dire.`,
  );
  process.exit(1);
}

// 🔴 2026-09-05 — ET DANS L'AUTRE SENS : le composant doit RENDRE ce que la
//    constante déclare.
//
// `ADMIN_LIENS_EPINGLES` est un couplage manuel entre `admin-nav.ts` et
// `AdminSidebarNav.tsx`. Le test de garde prouve qu'en VIDANT la constante on
// rougit. L'inverse n'était gardé par rien : retirer les deux `<Link>` du composant
// en laissant la constante intacte, et la passe réciproque continue de classer les
// douze écrans « au menu » — douze écrans redevenus inaccessibles, garde verte.
//
// Une garde qui ne surveille qu'un sens d'un couplage à deux sens ne surveille pas
// le couplage : elle surveille une de ses moitiés.
const sourceBarre = readFileSync(FICHIER_BARRE_LATERALE, "utf8");
const epingleesNonRendues = Object.keys(ADMIN_LIENS_EPINGLES).filter(
  (cle) => !sourceBarre.includes(`ADMIN_LIENS_EPINGLES.${cle}`),
);
if (epingleesNonRendues.length > 0) {
  console.error(
    `❌ [admin-nav:routes] ${epingleesNonRendues.length} lien(s) épinglé(s) déclaré(s) dans ` +
      `ADMIN_LIENS_EPINGLES mais plus rendu(s) par ${relative(process.cwd(), FICHIER_BARRE_LATERALE)} :`,
  );
  for (const cle of epingleesNonRendues) {
    console.error(
      `  - ${cle} → ${ADMIN_LIENS_EPINGLES[cle as keyof typeof ADMIN_LIENS_EPINGLES]} ` +
        `(la passe réciproque le compte comme une destination : les écrans qu'il ` +
        `justifie seraient devenus inatteignables sans que rien ne rougisse)`,
    );
  }
  process.exit(1);
}

// Contre-témoin : si `external` était posé en masse par erreur, la boucle
// ci-dessus n'examinerait presque plus rien et la garde passerait au vert en
// n'ayant rien vérifié.
if (internes.length < items.length - 10) {
  console.error(
    `❌ [admin-nav:routes] ${externes.length} entrées marquées \`external\` sur ${items.length} : ` +
      `beaucoup trop. Cette garde ne vérifierait plus rien.`,
  );
  process.exit(1);
}

if (missing.length > 0 || externesInvalides.length > 0) {
  if (missing.length > 0) {
    console.error(`❌ [admin-nav:routes] ${missing.length} entrée(s) sans route :`);
    for (const m of missing) console.error(`  - ${m}`);
  }
  if (externesInvalides.length > 0) {
    console.error(
      `❌ [admin-nav:routes] ${externesInvalides.length} lien(s) externe(s) invalide(s) :`,
    );
    for (const m of externesInvalides) console.error(`  - ${m}`);
  }
  process.exit(1);
}

// ═════════════════════════════════════════════════════════════════════════════
//  DEUXIÈME PASSE — L'ADAPTATEUR MCP NE DOIT JAMAIS RENDRE UN LIEN D'ADMIN
// ═════════════════════════════════════════════════════════════════════════════
//
// ⚠️ `ADMIN_URL_PREFIX` EST UN SEGMENT DE SÉCURITÉ, pas un chemin ordinaire.
//    En production il vaut quelque chose comme `admin-xxxxxxxx` : c'est ce qui
//    fait qu'un balayeur ne trouve pas la console. Un outil MCP qui rendrait un
//    `detailHref` le recopierait dans une réponse — donc, un jour, dans une
//    transcription, un journal, ou l'écran de quelqu'un d'autre.
//
//    Le cahier des charges le tranche en une phrase : « AUCUN outil ne rend de
//    detailHref ». Cette passe le REND VÉRIFIABLE, au lieu de compter sur la
//    relecture.
//
// ⚠️ ELLE ANNONCE COMBIEN DE FICHIERS ELLE A LUS. Sans ce compte, un adaptateur
//    rangé ailleurs rendrait la garde muette sans un mot — le défaut mesuré sur
//    `surface-server-actions.spec.ts`.

// ⚠️ DEUX RACINES, PAS UNE. La porte HTTP vit sous `src/app/api/mcp` (route
//    Next), la couche outils vivra sous `src/server/mcp` (lot 4b). Une garde qui
//    ne lirait que la seconde serait verte aujourd'hui en n'ayant rien lu — et
//    resterait aveugle au fichier qui, précisément, rend la réponse au socle.
const RACINES_MCP: readonly string[] = [
  resolve(process.cwd(), "src/app/api/mcp"),
  resolve(process.cwd(), "src/server/mcp"),
];

/** Ce qu'un fichier de l'adaptateur ne doit pas contenir, et pourquoi. */
const INTERDITS_DANS_MCP: readonly { readonly motif: RegExp; readonly quoi: string }[] = [
  { motif: /\badminPath\s*\(/, quoi: "adminPath() construit une URL de console" },
  { motif: /ADMIN_URL_PREFIX/, quoi: "le préfixe d'administration est un segment de sécurité" },
  { motif: /detailHref/, quoi: "aucun outil ne rend de detailHref (§ 28)" },
  { motif: /["'`]\/(?:fr|en)\/admin/, quoi: "un chemin de console écrit en dur" },
];

function fichiersDeLAdaptateur(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const nom of readdirSync(dir)) {
    const chemin = join(dir, nom);
    if (statSync(chemin).isDirectory()) {
      if (nom === "__tests__" || nom === "node_modules") continue;
      out.push(...fichiersDeLAdaptateur(chemin));
      continue;
    }
    if (!/\.tsx?$/.test(nom)) continue;
    if (/\.(?:test|spec)\.tsx?$/.test(nom)) continue;
    out.push(chemin);
  }
  return out;
}

const fichiersMcp = RACINES_MCP.flatMap((racine) => fichiersDeLAdaptateur(racine));
const violationsMcp: string[] = [];

for (const chemin of fichiersMcp) {
  const source = readFileSync(chemin, "utf8");
  for (const { motif, quoi } of INTERDITS_DANS_MCP) {
    if (motif.test(source)) {
      violationsMcp.push(`${relative(process.cwd(), chemin)} → ${quoi}`);
    }
  }
}

if (violationsMcp.length > 0) {
  console.error(
    `❌ [admin-nav:routes] ${violationsMcp.length} fuite(s) de chemin d'administration ` +
      `dans l'adaptateur MCP (${fichiersMcp.length} fichier(s) lu(s)) :`,
  );
  for (const v of violationsMcp) console.error(`  - ${v}`);
  process.exit(1);
}

console.log(
  `✅ [admin-nav:routes] OK — ${internes.length} routes internes résolues, ` +
    `${externes.length} lien(s) externe(s) valides, ` +
    // Annoncé, et pas seulement vérifié : un compte qui n'apparaît nulle part ne
    // se surveille pas. Le jour où il tombe à zéro, on doit le LIRE.
    `${liensEnDurExamines} lien(s) écrit(s) en dur résolu(s) · ` +
    `${fichiersMcp.length} fichier(s) d'adaptateur MCP lu(s), ` +
    `${INTERDITS_DANS_MCP.length} motif(s) interdit(s) confronté(s).`,
);

// ═════════════════════════════════════════════════════════════════════════════
//  TROISIÈME PASSE — LA RÉCIPROQUE : UNE ROUTE ADMIN SANS ENTRÉE DE MENU
//                    N'EST GARDÉE PAR RIEN
// ═════════════════════════════════════════════════════════════════════════════
//
// Les deux passes ci-dessus ne vérifient qu'UN SENS : chaque entrée de menu mène
// quelque part. L'autre sens n'était gardé par rien — une route admin livrée
// sans entrée de menu existe, répond, expose des données, et personne ne la
// voit. C'est un écran qu'on paye à maintenir sans jamais l'ouvrir, ou pire : un
// écran qu'on croit retiré et qui répond encore.
//
// 🔴 CE QU'UN AUDIT NAÏF RENVOIE, ET POURQUOI C'EST FAUX. Comparer bêtement
//    « routes sur le disque » à « entrées de menu » rend 157 orphelines sur 308.
//    Presque toutes sont légitimes, et pour QUATRE raisons distinctes qui se
//    reconnaissent mécaniquement. Une garde qui ne les distingue pas rend une
//    liste que personne ne peut lire, donc que personne ne lira — et le seul
//    vrai défaut s'y noie. Les quatre familles sont donc nommées, comptées et
//    affichées à chaque exécution : c'est ce qui rend le résidu exploitable.
//
// 🔑 ET LA LISTE D'EXCEPTIONS EST MINUSCULE, PAR CONSTRUCTION. Chaque fois qu'on
//    est tenté d'y ajouter une ligne, la bonne question est « quelle famille
//    ai-je oubliée ? ». La réponse a été « les liens épinglés » le 2026-09-05 :
//    douze écrans vivants passaient pour orphelins parce que leur lien était
//    écrit en dur dans `AdminSidebarNav.tsx`, hors du SSOT. Le correctif n'a pas
//    été douze exceptions, mais `ADMIN_LIENS_EPINGLES`.

/** Une route admin telle qu'elle existe sur le disque, et son dossier. */
interface RouteDisque {
  readonly route: string;
  readonly dossier: string;
}

function routesDuDisque(dir: string, segments: string[] = []): RouteDisque[] {
  const out: RouteDisque[] = [];
  if (existsSync(join(dir, "page.tsx"))) {
    out.push({ route: "/" + segments.join("/"), dossier: dir });
  }
  for (const nom of readdirSync(dir)) {
    const full = join(dir, nom);
    if (!statSync(full).isDirectory()) continue;
    // `_x` (dossier privé Next), `__tests__`, `components` : jamais des routes.
    if (nom.startsWith("_") || nom === "__tests__" || nom === "components") continue;
    // Groupe `(x)` : transparent dans l'URL, on descend sans consommer de segment.
    if (nom.startsWith("(") && nom.endsWith(")")) {
      out.push(...routesDuDisque(full, segments));
      continue;
    }
    // Slot parallèle `@x` : rendu par un layout, ce n'est pas une adresse.
    if (nom.startsWith("@")) continue;
    out.push(...routesDuDisque(full, [...segments, nom]));
  }
  return out;
}

// ⚠️ CHAQUE EXCEPTION PORTE SON MOTIF. Une liste de chemins nus deviendrait un
//    dépotoir : on y ajoute une ligne pour faire passer la garde, et six mois
//    plus tard personne ne sait si la route est vivante ou oubliée.
const EXCEPTIONS_RECIPROQUES: Readonly<Record<string, string>> = {
  "/login":
    "L'écran de connexion. Il ne PEUT pas figurer au menu : on l'atteint " +
    "précisément quand on n'a pas de session, donc quand aucun menu ne " +
    "s'affiche. Toutes les autres routes y renvoient par redirection.",
};

const routesAdmin = routesDuDisque(ADMIN_ROOT).filter((r) => r.route !== "/");

// Les destinations DÉCLARÉES : le menu construit, PLUS les liens épinglés en
// pied de barre latérale. Les deux sources, pas une seule — c'est le défaut
// trouvé le 2026-09-05.
const destinations = new Set<string>([
  ...items.filter((it) => it.external !== true).map((it) => "/" + navSegments(it.href).join("/")),
  ...ADMIN_ROUTES_EPINGLEES,
]);

const famDeclaree: string[] = [];
const famDynamique: string[] = [];
const famSousEcran: string[] = [];
const famRedirection: string[] = [];
const famException: string[] = [];
const sansJustification: string[] = [];

for (const { route, dossier } of routesAdmin) {
  // E — exception écrite et motivée. TESTÉE EN PREMIER, et c'est délibéré.
  //
  // 🔴 2026-09-05 — elle était testée en DERNIER, donc une famille automatique
  //    pouvait l'absoudre avant qu'on la lise. Les quatre stubs d'`image-bank`
  //    tombaient ainsi en famille C — « sous-écran d'une section au menu » — par
  //    le seul fait que `/image-bank` est au menu, et le rapport les comptait
  //    parmi les 69 sous-écrans légitimes. Une exception qu'une automatique
  //    recouvre n'est pas une exception : c'est un motif écrit que personne ne
  //    lira jamais, sur une route que la garde a cessé de surveiller.
  //
  //    Placée ici, la liste est un REGISTRE : ce qui y figure est compté comme
  //    exception, se voit dans le rapport, et reste sous les contre-témoins de
  //    famille qui plafonnent son nombre.
  if (EXCEPTIONS_RECIPROQUES[route] != null) {
    famException.push(route);
    continue;
  }

  // A — une entrée de menu (ou un lien épinglé) pointe exactement dessus.
  if (destinations.has(route)) {
    famDeclaree.push(route);
    continue;
  }

  // B — la route porte un segment dynamique : c'est un écran de DÉTAIL, ouvert
  //     depuis une liste. Aucun menu ne peut pointer sur `/x/[id]`.
  if (/\[[^\]]+\]/.test(route)) {
    famDynamique.push(route);
    continue;
  }

  // C — un ANCÊTRE de la route est une destination : sous-écran d'une section
  //     déjà au menu (`/blog/new` sous `/blog`).
  const segs = route.split("/").filter(Boolean);
  let ancetre = false;
  for (let i = segs.length - 1; i >= 1; i--) {
    if (destinations.has("/" + segs.slice(0, i).join("/"))) {
      ancetre = true;
      break;
    }
  }
  if (ancetre) {
    famSousEcran.push(route);
    continue;
  }

  // D — la page ne fait QUE rediriger : adresse héritée gardée en vie pour les
  //     favoris et les liens déjà écrits ailleurs, délibérément hors du menu.
  //
  // 🔴 Le marqueur de JSX est la balise FERMANTE (`</` ou `/>`). Une première
  //    version disqualifiait toute page contenant `<[A-Za-z]` : `Promise<never>`
  //    matchait, la famille rendait ZÉRO, et ses 17 routes tombaient au résidu.
  //    Un critère trop large ne rend pas une garde plus stricte — il la rend
  //    aveugle à la famille même qu'il devait reconnaître.
  const brut = readFileSync(join(dossier, "page.tsx"), "utf8");
  const corps = brut.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const rendDuJsx = /<\//.test(corps) || /\/>/.test(corps);
  const redirige = /(?:permanentRedirect|redirect)\s*\(/.test(corps);
  if (!rendDuJsx && redirige) {
    famRedirection.push(route);
    continue;
  }

  sansJustification.push(route);
}

// ⚠️ CONTRE-TÉMOINS. Chaque famille peut, en s'élargissant, avaler tout le
//    résidu et rendre cette passe verte en n'ayant rien vérifié. On mesure donc
//    les familles elles-mêmes, avant de conclure sur le résidu.
const alertesDeFamille: string[] = [];

if (routesAdmin.length < 100) {
  alertesDeFamille.push(
    `seulement ${routesAdmin.length} route(s) admin trouvée(s) sur le disque : ` +
      `l'arborescence a bougé, ou ADMIN_ROOT ne pointe plus au bon endroit — ` +
      `cette passe ne vérifie plus rien.`,
  );
}
if (famDeclaree.length === 0 || famDynamique.length === 0 || famRedirection.length === 0) {
  alertesDeFamille.push(
    `une famille est VIDE (déclarées ${famDeclaree.length}, dynamiques ` +
      `${famDynamique.length}, redirections ${famRedirection.length}) : chacune ` +
      `avait des membres au 2026-09-05, un zéro dit qu'elle a cessé de mesurer.`,
  );
}
if (famRedirection.length > routesAdmin.length / 3) {
  alertesDeFamille.push(
    `${famRedirection.length} routes classées « simple redirection » sur ` +
      `${routesAdmin.length} : le critère est devenu trop large et absorbe de ` +
      `vrais écrans.`,
  );
}
// 🔴 2026-09-05 — LA FAMILLE C N'ÉTAIT PLAFONNÉE PAR RIEN, et c'est la seule dont
//    le critère soit purement lexical : « un ancêtre est une destination ». Elle
//    absout 69 routes, 22 % du total, sans jamais vérifier qu'un lien y mène. D,
//    qui lit le CONTENU des pages, était plafonnée ; C, qui ne lit qu'un chemin,
//    ne l'était pas — le contre-témoin manquait exactement là où le critère est
//    le plus faible. Une seule section ajoutée au menu peut blanchir toute une
//    arborescence morte sous elle.
if (famSousEcran.length > routesAdmin.length / 3) {
  alertesDeFamille.push(
    `${famSousEcran.length} routes classées « sous-écran d'une section au menu » sur ` +
      `${routesAdmin.length} : cette famille absout par simple préfixe de chemin, sans ` +
      `vérifier aucun lien entrant. Au-delà du tiers, elle blanchit des arborescences ` +
      `entières et cette passe ne mesure plus grand-chose.`,
  );
}
// 🔴 CLIQUET RESSERRÉ DE 5 À 1 LE 2026-09-06, PARCE QUE LA MESURE L'A PERMIS.
//
// Le seuil valait 5 : c'était `/login` plus les quatre stubs `image-bank` sans
// entrée de menu. Ces quatre-là ont reçu leur entrée (masquée par `parent`,
// comme leurs cinq frères), donc l'exception n'a plus d'objet et le cliquet
// descend AVEC la mesure — jamais avant elle. Il ne reste que `/login`, dont
// l'exception est structurelle : c'est l'écran qu'on atteint sans session, donc
// sans menu.
//
// ⚠️ Ne PAS relever ce seuil pour faire passer une nouvelle route. Une exception
//    de plus veut dire qu'une famille manque au classement, pas qu'un cas
//    particulier est apparu — c'est le raisonnement qui avait laissé quatre
//    écrans vivre sans lien entrant.
if (Object.keys(EXCEPTIONS_RECIPROQUES).length > 1) {
  alertesDeFamille.push(
    `${Object.keys(EXCEPTIONS_RECIPROQUES).length} exceptions réciproques : ` +
      `au-delà d'une (l'écran de connexion), c'est une famille qui manque, ` +
      `pas des cas particuliers.`,
  );
}

if (alertesDeFamille.length > 0) {
  console.error(`❌ [admin-nav:reciproque] la garde ne mesure plus ce qu'elle croit :`);
  for (const a of alertesDeFamille) console.error(`  - ${a}`);
  process.exit(1);
}

if (sansJustification.length > 0) {
  console.error(
    `❌ [admin-nav:reciproque] ${sansJustification.length} route(s) admin sans ` +
      `aucune entrée de menu :`,
  );
  for (const r of sansJustification) console.error(`  - ${r}`);
  console.error(
    `\n  Une route livrée sans entrée de menu n'est ouverte par personne. Trois ` +
      `sorties, dans cet ordre :\n` +
      `    1. poser une entrée dans buildAdminNav() — le cas normal ;\n` +
      `    2. si l'écran est mort, supprimer la route, ou la remplacer par une\n` +
      `       redirection vers l'écran qui l'a remplacée (famille D) ;\n` +
      `    3. en dernier recours seulement, une ligne MOTIVÉE dans\n` +
      `       EXCEPTIONS_RECIPROQUES, en haut de cette passe.`,
  );
  process.exit(1);
}

// 🔴 2026-09-05 — CE COMPTEUR ANNONÇAIT `ADMIN_ROUTES_EPINGLEES.length`, c'est-à-dire
//    la longueur de la CONSTANTE. Il aurait dit « dont 2 épinglées » même si les deux
//    écrans avaient disparu du disque : un compteur qui lit sa propre déclaration ne
//    mesure rien, et rassure exactement là où il faudrait alerter. On compte désormais
//    les appariements RÉELS — les chemins épinglés qui ont vraiment justifié une route.
const epingleesAppariees = ADMIN_ROUTES_EPINGLEES.filter((chemin) => famDeclaree.includes(chemin));

console.log(
  `✅ [admin-nav:reciproque] OK — ${routesAdmin.length} routes admin, toutes ` +
    `justifiées : ${famDeclaree.length} au menu (dont ` +
    `${epingleesAppariees.length} épinglée(s) appariée(s) sur ` +
    `${ADMIN_ROUTES_EPINGLEES.length} déclarée(s)), ${famDynamique.length} écrans ` +
    `de détail, ${famSousEcran.length} sous-écrans, ${famRedirection.length} ` +
    `redirections héritées, ${famException.length} exception(s) motivée(s).`,
);
