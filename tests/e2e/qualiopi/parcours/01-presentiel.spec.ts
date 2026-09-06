/**
 * PARCOURS 1 — Formation en PRÉSENTIEL, du devis à la facture, en cliquant.
 *
 * Phase 6 de `_AUDIT/PROMPT-AUDIT-QUALIOPI-E2E-50-AGENTS-2026-08-18.md`.
 *
 * Trois volets, et c'est délibéré :
 *
 *  - **On crée** une session présentielle par l'écran, pour prouver que la
 *    création fonctionne, que la modalité choisie est bien celle rendue, et
 *    qu'elle survit à un rechargement.
 *  - **On parcourt** les sous-pages OFFERTES PAR LE HUB de la session de
 *    démonstration `AXI-SES-DEMO-001`, seule à porter un cycle complet.
 *  - **On suit la chaîne commerciale** : devis accepté → attestation de
 *    réalisation → facture OPCO subrogée. C'est ce que le titre du fichier
 *    promet, et c'est ce qu'il ne faisait pas.
 *
 * ── 🔴 2026-08-23 — CE QUE CE FICHIER NE PROUVAIT PAS ─────────────────────
 *
 * Jusqu'à cette réécriture, le fichier s'appelait « du devis à la facture »
 * et ne portait AUCUNE occurrence de « Devis », « Facture » ou
 * « Attestation » hors commentaires. Ses deux tests mesuraient :
 *
 *   · `toContainText(/Présentiel/i)` sur `body` — vrai sur TOUTE session,
 *     quelle que soit sa modalité : `SessionLieuForm` est monté sans
 *     condition (sessions/[id]/page.tsx:763) et `LieuFieldset` propose
 *     l'option « Distanciel (visioconférence) » (LieuFieldset.tsx:29). Les
 *     trois mots sont dans la page avant même qu'on regarde la session ;
 *   · `texte.length < 200` sur `body` — un seuil INATTEIGNABLE : le rail de
 *     navigation vit dans `body` sur chaque page de la console
 *     (layout.tsx:383-404) et pèse à lui seul **2 207 caractères** de
 *     libellés — mesuré le 2026-08-23 : 146 littéraux `label: "…"` dans
 *     `src/lib/admin-nav.ts`, somme des longueurs = 2 207. (Un `grep -c`
 *     nu en compte 149 : les trois autres ne sont pas des libellés —
 *     admin-nav.ts:114 est une déclaration de type, :1466 et :1495 sont
 *     calculés.) S'y ajoutent **15** intitulés de groupe
 *     (`ADMIN_NAV_GROUP_LABELS`, admin-nav.ts:159-180 — le premier jet
 *     annonçait 17, ils sont 15, comptés un à un). Le garde-fou était vert
 *     sur une page totalement vide.
 *
 * ── CONSTAT D'AUDIT CONSERVÉ : `/kit` est un écran SANS PORTE ────────────
 *
 * 🔴 Et ce garde-fou inerte MASQUAIT un vrai défaut. L'ancienne liste de
 * sous-pages était écrite à la main, comptait `kit`, et se présentait comme
 * « les quatre écrans que le formateur et l'auditeur ouvrent réellement » —
 * formule retirée, parce qu'elle était fausse pour l'un des quatre.
 *
 * Pour `AXI-SES-DEMO-001` (`statut: "realisee"`, demo.ts:562), la chaîne est
 * mécanique : `terminee = true` (kit-session/preparation.ts:127) ⇒
 * `aPreparer = false` (:132) ⇒ la section `#preparation-kit` n'est pas rendue
 * (sessions/[id]/page.tsx:793) ⇒ son SEUL lien, `hrefRelecture`
 * (page.tsx:806), n'existe nulle part ailleurs dans l'application — la seule
 * autre occurrence est `kit/page.tsx:79`, où l'écran se pointe LUI-MÊME.
 * `/kit` n'est donc atteignable qu'en tapant son URL, et il rend « Aucune
 * sortie produite pour l'instant. » (kit/page.tsx:89).
 *
 * L'ancien parcours composait justement cette URL à la main, mesurait un
 * `body` que le rail remplissait, et déclarait l'écran sain.
 *
 * 🔑 On ne visite plus que ce que le hub OFFRE. `/kit` redevient donc NON
 * TESTÉ, et c'est le point : le parcours cesse de le maquiller en écran
 * sain. C'est un défaut de la console — pas du parcours — et il est écrit
 * ici pour qu'on le retrouve.
 *
 * ── DÉCISION AMENDÉE (elle datait du premier jet de ce fichier) ──────────
 *
 * L'ancien en-tête proscrivait les assertions par mot-clé, au motif qu'un
 * premier jet cherchait « Émargement », « Évaluation »… sans les avoir lus
 * dans le code, et rougissait sur sa propre supposition.
 *
 * 🔑 Cette décision visait la SUPPOSITION, pas la lecture. Chaque chaîne
 * exigée ci-dessous est relevée dans le code ou dans le seed, référence à
 * l'appui, ligne par ligne, et toutes les références de ce fichier ont été
 * RECOMPTÉES sur le worktree le 2026-08-23. Une chaîne qu'on a lue n'est pas
 * une chaîne qu'on devine : la proscrire reviendrait à s'interdire d'asserter
 * quoi que ce soit.
 *
 * ── 🔴 2026-08-23 — CE HARNAIS EST DEVENU UNE GATE. LE DIRE À L'ENVERS ────
 * ── AURAIT ÉTÉ LA PIRE ERREUR DE CE FICHIER. ─────────────────────────────
 *
 * Le premier jet de cette réécriture portait, en toutes lettres :
 *
 *     « Ce harnais n'est PAS une gate. Le step "Playwright suite" porte
 *       `continue-on-error: true` (ci.yml:519). »
 *
 * C'était vrai la veille. Ça ne l'est plus. Mesuré dans le worktree :
 * `.github/workflows/ci.yml:479` porte « ✅ 2026-08-23 — `continue-on-error`
 * RETIRÉ. CE GATE PEUT ENFIN ROUGIR. », et son propre commentaire précise que
 * `Gate B · per-PR` est un contexte EXIGÉ par la protection de `main`, en
 * `strict: true` : **un rouge d'ici bloque 100 % des PR, pas seulement la
 * sienne.** Le step s'appelle « Playwright suite » (ci.yml:443) ; sa commande
 * est `pnpm test:e2e --project=chromium --grep-invert "@baseline"`
 * (ci.yml:519) ; les navigateurs sont installés en ci.yml:299 ; et la CI
 * exécute bien `pnpm qualiopi:seed-demo` (ci.yml:415) avant de lancer la
 * suite, donc le dossier de démonstration est là.
 *
 * ⚠️ CONSÉQUENCES, ET ELLES CHANGENT LA NATURE DU FICHIER :
 *
 *  1. Ce parcours ne porte pas le tag `@baseline` : rien ne l'exclut. Il
 *     TOURNE en CI, et il BLOQUE.
 *  2. Une assertion fantôme ici n'est plus « du bruit dans un rapport » :
 *     c'est un rouge permanent sur toutes les PR du dépôt. C'est la raison
 *     pour laquelle chaque négation de ce fichier est adossée à un témoin
 *     positif, et pour laquelle aucune n'est posée sur un ensemble qu'on n'a
 *     pas rempli.
 *  3. Inversement, un vert d'ici est désormais lu comme une garantie. Il ne
 *     doit donc rien affirmer qu'il n'ait mesuré — d'où les réserves écrites
 *     en clair aux endroits où ce parcours ne PEUT pas prouver ce qu'on
 *     aimerait lui faire dire (voir « CE QUE CE PARCOURS NE PROUVE PAS »).
 *
 * (Rappel de l'ordre de grandeur, toujours vrai ailleurs : les gates de
 * BUDGET — size-limit, Lighthouse PR-time — restent `continue-on-error`.
 * Cf. « Vérité des gates », AGENTS.md. Ce n'est pas le cas de celle-ci.)
 *
 * ── CE QUE CE PARCOURS NE PROUVE PAS (et pourquoi c'est écrit ici) ───────
 *
 *  · **`/kit`** : non visité, voir plus haut. Écran sans porte.
 *  · **L'attestation vue du PUBLIC** : ce fichier lit le badge « Annulée »
 *    du registre interne (DocumentsSection.tsx:1513-1517). Il ne sait rien de
 *    ce que la page publique `/verifier-attestation/[token]` affiche — c'est
 *    l'objet du parcours 07.
 *  · **Une liste de devis vide n'est pas expliquée** : `listDevis`
 *    (src/server/qualiopi/crm/devis.ts:23-33) enveloppe son `findMany` dans un
 *    `try/catch` qui rend `[]` en cas d'erreur (:30-32). Une base injoignable
 *    et un seed absent produisent donc le MÊME écran. Le message d'échec du
 *    devis le dit plutôt que de choisir une cause.
 *  · **L'écran d'émargement d'une session SANS stagiaire n'a aucun repère
 *    APRÈS la garde `isDistanciel`** : le récapitulatif des taux
 *    (emargement/page.tsx:278-280) est lui-même conditionné par
 *    `enrollments.length > 0`. La négation du test 1 s'appuie donc sur le
 *    DERNIER nœud inconditionnel AVANT la garde, pas sur un nœud d'après.
 *    C'est plus faible, c'est dit, et c'est le maximum disponible.
 *
 * ── Précautions d'emploi ─────────────────────────────────────────────────
 *
 * ⚠️ Ce parcours ne saute jamais en silence. Quand une pièce manque, il le
 * DIT et rougit : c'est un audit, pas une suite de fumée.
 *
 *     pnpm qualiopi:seed-demo
 *     npx playwright test tests/e2e/qualiopi/parcours/01-presentiel.spec.ts \
 *       --project=chromium --workers=1
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { LIBELLES_TYPE_DOCUMENT } from "@/server/qualiopi/documents/libelles-type-document";
import { loginAsAdmin } from "../../fixtures/admin-auth";
import { CONTENU, creerSession, ENREGISTREMENT, ouvrir, ouvrirSessionDemo } from "./_communs";

test.use(ENREGISTREMENT);

// ── Les repères du dossier de démonstration, lus dans le seed ─────────────
//
// Source unique : `prisma/seeds/qualiopi/demo.ts`, bloc `DEMO` (:345-368).
// Aucun de ces numéros n'est deviné ; chacun porte sa ligne, recomptée le
// 2026-08-23.
const SESSION_DEMO = "AXI-SES-DEMO-001"; // demo.ts:349
const FORMATION_DEMO = "AXI-FOR-DEMO-001"; // demo.ts:348
const DEVIS_DEMO = "AXI-DEV-2026-DEMO-001"; // demo.ts:347
const ATTESTATION_DEMO = "AXI-ATT-DEMO-001"; // demo.ts:352
const FACTURE_DEMO = "AXI-FAC-2026-DEMO-001"; // demo.ts:354

/**
 * 2 900,00 € — le montant qui traverse TOUT le dossier de démonstration :
 * devis (`montantTotalHtCents: 290000`, demo.ts:412), session (:557) et
 * facture (:801). C'est lui qui fait du « devis → facture » une chaîne, et
 * non trois pièces sans rapport.
 *
 * 🔑 `\s` et non une espace tapée au clavier : `Intl.NumberFormat("fr-FR")`
 * sépare les milliers par une ESPACE FINE INSÉCABLE (U+202F) depuis ICU 72.
 * `\s` couvre U+202F en JavaScript ; un littéral « 2 900,00 » écrit à la
 * main ne matcherait rien, et l'échec accuserait le montant au lieu de
 * l'espace. (Playwright normalise par ailleurs les blancs avant de comparer :
 * les deux chemins passent, et on ne dépend d'aucun des deux.)
 */
const MONTANT_DEMO = /2\s*900,00/;

/**
 * Les libellés des sous-pages, FIGÉS ICI — c'est le cliquet.
 *
 * 🔑 Répartition des rôles, et elle est volontaire : les URLS visitées sont
 * LUES dans `#sous-pages` (sessions/[id]/page.tsx:814-836 ; les quatre
 * `<Link>` occupent 817-834) au lieu d'être composées à la main ; la LISTE
 * DES LIBELLÉS, elle, est écrite ici. Ajouter ou retirer une sous-page dans
 * la console doit donc faire ROUGIR ce parcours — c'est ce qui empêche un
 * écran d'apparaître, ou de disparaître, sans que personne ne le remarque.
 *
 * Écrire les URLs à la main faisait exactement l'inverse : le parcours
 * visitait `/kit`, que le hub n'offre pas, et n'aurait pas vu qu'un lien
 * avait été retiré.
 */
const LIBELLES_SOUS_PAGES = [
  "Émargement", // page.tsx:817-819
  "Évaluations", // page.tsx:820-822
  "Financement", // page.tsx:823-825
  "Tout pour animer (formation)", // page.tsx:829-834
] as const;

/**
 * Attend qu'une page de la console ait RENDU, et rend le texte de sa zone de
 * contenu, espaces normalisées.
 *
 * 🔴 2026-08-22, corrigé le 2026-08-23 — NI `main` NI `body` NE SONT DES
 * REPÈRES DANS LA CONSOLE.
 *
 * L'ancien commentaire de ce fichier concluait « le repère reste `body` ». Il
 * avait raison sur `main` — la console n'ouvre plus de `<main>` propre depuis
 * qu'elle en produisait un SECOND, imbriqué dans celui du site (trois
 * violations axe `moderate` par page ; le `<div className="admin-main">` qui
 * l'a remplacé est en layout.tsx:404, et le commentaire qui l'explique en
 * :396-403) — et tort sur `body`, qui n'a JAMAIS été un repère : le rail y
 * pèse 2 207 caractères. Un seuil de vacuité posé dessus ne peut pas rougir,
 * et un message de diagnostic bâti dessus emporte la barre latérale et la
 * topbar, donc NOIE la cause au lieu de la nommer.
 *
 * 🔑 Le repère est `CONTENU` (`.admin-main`, admin.css:895), tranché une fois
 * dans `_communs.ts` et jamais réécrit ici — un prédicat recopié diverge
 * toujours. (Le commentaire de layout.tsx:403 cite « admin.css:894 » : c'est
 * une coquille d'un cran, la règle est bien déclarée en 895. Ne pas la
 * recopier.)
 *
 * 🔴 On n'attend pas davantage un ÉTAT DE RÉSEAU. L'ancienne version
 * chargeait ces pages en attendant le silence du réseau ; une page de la
 * console ne se tait jamais tout à fait, et l'attente consommait le budget
 * avant de rendre un verdict muet. On attend un CONTENU : le `<h1>` qu'émet
 * `AdminPageHeader` (AdminPageHeader.tsx:63) sur chacun de ces écrans.
 */
async function texteDuContenu(page: Page, quoi: string): Promise<string> {
  const zone = page.locator(CONTENU);
  await expect(
    zone.getByRole("heading", { level: 1 }),
    `${quoi} : aucun titre de niveau 1 n'est apparu dans « ${CONTENU} ». Sous \`next dev\` la ` +
      "route se compile à la demande et l'écran est rendu EN FLUX : mesurer sans attendre " +
      "revient à mesurer le squelette. Si cette attente expire, la page n'a jamais fini de " +
      "rendre — ce n'est pas la même panne qu'un contenu absent.",
  ).toBeVisible({ timeout: 90_000 });
  return (await zone.innerText()).replace(/\s+/g, " ").trim();
}

/**
 * La cellule « Modalité » de l'encadré d'identité de la session.
 *
 * 🔑 On vise LA CELLULE, pas la page. `#infos` (sessions/[id]/page.tsx:590)
 * est une grille (:592) dont chaque enfant direct est une cellule
 * `<p>libellé</p><p>valeur</p>` ; `#infos > div > div` les désigne toutes, et
 * le filtre ancré `^Modalité` en retient exactement une (page.tsx:610-615,
 * valeur rendue en :613 par `MODALITE_LABELS`, page.tsx:97-101).
 *
 * 🔴 POURQUOI PAS LA SECTION ENTIÈRE. Un `not.toContainText(/Distanciel/)`
 * posé sur `#infos` rougirait le jour où la formation retenue par
 * `creerSession` porte ce mot dans son titre — le titre de la formation est
 * affiché dans la cellule IMMÉDIATEMENT précédente (page.tsx:594-607, titre
 * en :605). Une panne fantôme, dans un parcours qui bloque désormais toutes
 * les PR du dépôt, coûte beaucoup plus cher que l'assertion qu'elle prétend
 * garder.
 */
function celluleModalite(page: Page): Locator {
  return page.locator("#infos > div > div").filter({ hasText: /^Modalité/ });
}

test.describe("@parcours-qualiopi 1 — présentiel, du devis à la facture", () => {
  // ⚠️ BUDGET — 600 000 ms, et le nombre est écrit EN LITTÉRAL, pas en
  // ternaire. Trois raisons, toutes mesurées :
  //
  //  1. Le cliquet `tests/unit/e2e-harness/delai-interne-sous-le-budget.spec.ts`
  //     exige que le budget soit STRICTEMENT supérieur au plus grand délai qui
  //     vit dans la suite, helpers importés compris. Ce plafond vaut ici
  //     180 000 ms : `loginAsAdmin` (admin-auth.ts:141) et l'attente d'arrivée
  //     de `creerSession` (_communs.ts) le portent toutes les deux hors CI.
  //  2. `tests/unit/e2e-harness/budget-des-specs-admin.spec.ts` impose en
  //     outre un PLANCHER de 90 000 ms à toute suite qui appelle
  //     `loginAsAdmin`. 600 000 satisfait les deux.
  //  3. Ce cliquet lit le budget par une expression RÉGULIÈRE ancrée sur
  //     `describe.configure` (delai-interne-sous-le-budget.spec.ts:91). Un
  //     budget écrit en TERNAIRE — « en CI tant, sinon tant » — ne lui rend
  //     AUCUN chiffre : il retomberait sur le défaut global de 30 s
  //     (playwright.config.ts:7) et déclarerait cette suite en faute. Le
  //     littéral n'est pas de la paresse, c'est ce que l'outil sait lire.
  //
  // 🔴 ET CE COMMENTAIRE LUI-MÊME EN A ÉTÉ LA PREUVE. Un premier jet écrivait
  // le ternaire proscrit en toutes lettres, chiffres compris. Or `delaiMaximal`
  // (:74-87) ne retire PAS les commentaires avant de balayer — contrairement au
  // test `networkidle` de la même suite, qui le fait explicitement (:148-154,
  // après s'être trouvé lui-même). Il a compté 600 000 comme un délai interne,
  // égal au budget, et fait rougir la suite sur sa propre documentation. Même
  // famille que « un test statique trouve ses propres commentaires » : ne
  // JAMAIS écrire ici un motif que le cliquet cherche — ni une paire de
  // nombres séparés par « ? » et « : », ni le mot-clé de délai suivi de deux
  // points et d'un nombre.
  //
  // 🔴 CE QUE LE BUDGET NE GARANTIT PAS, ET IL FAUT LE SAVOIR. Le cliquet ne
  // compare que le MAXIMUM, jamais la SOMME. Sur le chemin nominal hors CI, le
  // test 3 enchaîne une connexion (jusqu'à 180 000 ms) puis une douzaine
  // d'attentes. Toutes les bornes propres de ce fichier sont donc plafonnées à
  // 90 000 ms : après une connexion au pire de sa forme, les QUATRE premières
  // attentes du parcours peuvent encore expirer et rendre LEUR message
  // (180 000 + 4 × 90 000 = 540 000 < 600 000). Au-delà, c'est le budget qui
  // parle, avec son message générique. Une étape ajoutée en tête de test
  // repousse d'autant les suivantes hors de portée : refaire ce calcul.
  //
  // 🔴 `mode: "default"` et NON `"serial"`, contrairement à la version
  // précédente. Les trois tests sont indépendants : chacun ouvre sa propre
  // session admin et ne consomme rien de ce que le précédent a écrit. En
  // `serial`, un échec du test 1 ferait SAUTER les tests 2 et 3 — deux
  // diagnostics perdus pour une panne qui ne les concerne pas, et deux
  // « skipped » que le rapport présentera sans jamais dire pourquoi. Un
  // parcours d'audit doit rapporter tout ce qu'il sait, pas s'arrêter au
  // premier bruit.
  //
  // ⚠️ EXCEPTION ASSUMÉE, ET IL FAUT L'ÉCRIRE : à l'intérieur du test 2, la
  // boucle sur les sous-pages ne suit PAS ce principe. `texteDuContenu` LÈVE au
  // lieu d'alimenter `pannes`, donc une sous-page qui ne rend jamais son `<h1>`
  // interrompt le relevé — pas de pièce jointe, pas de contre-témoin, écrans
  // suivants non mesurés. C'est délibéré : un écran qui n'a pas fini de rendre
  // est une panne de HARNAIS, pas un constat d'audit, et le relever comme tel
  // ferait passer une compilation lente pour un défaut du produit.
  test.describe.configure({ mode: "default", timeout: 600_000 });

  test("une session présentielle se crée, et sa fiche rend la modalité choisie", async ({
    page,
  }, info) => {
    // Dispense assumée et bornée : la CI n'installe QUE chromium (ci.yml:299)
    // et ne lance QUE `--project=chromium` (ci.yml:519). Ce `skip` ne se
    // déclenche donc jamais là où le parcours est censé garder quelque chose —
    // il n'existe que pour un run local « tous moteurs », où rejouer sept
    // parcours métier sur cinq navigateurs n'apprend rien de plus. Le message
    // porte la cause : un `skip` muet est un trou noir.
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");
    await loginAsAdmin(page);

    // 🔑 « PRESENTIEL » SANS ACCENT, ET C'EST VOULU. Le témoin de l'étape 4
    // cherche « Présentiel » accentué dans l'en-tête de l'écran d'émargement.
    // Un titre de session contenant le mot accentué satisferait ce témoin sans
    // que la MODALITÉ y soit pour quoi que ce soit : l'assertion deviendrait
    // vraie par construction. Le titre est donc écrit en capitales non
    // accentuées, et il ne peut pas matcher.
    const titre = `E2E PRESENTIEL ${Date.now()}`;
    const id = await creerSession(page, {
      modalite: "presentiel",
      titre,
      debutDansJours: 7,
      participants: 6,
      montantHt: 2400,
    });

    // ── 1. La fiche porte le titre saisi ───────────────────────────────────
    //
    // Arriver sur une URL ne prouve pas qu'un champ a été lu : le `<h1>` rend
    // `titreSession ?? formation.titre` (sessions/[id]/page.tsx:566). S'il
    // porte notre titre, c'est que la saisie a traversé l'action serveur.
    await expect(
      page.locator(CONTENU).getByRole("heading", { level: 1, name: titre }),
      `la fiche de la session créée ne porte pas le titre saisi « ${titre} ». Soit ` +
        "`titreSession` n'a pas été enregistré et le `<h1>` retombe sur le titre de la " +
        "FORMATION (sessions/[id]/page.tsx:566), soit la fiche n'a pas fini de rendre.",
    ).toBeVisible({ timeout: 90_000 });

    // ── 2. La modalité rendue est celle choisie ────────────────────────────
    //
    // ⚠️ DÉLAI EXPLICITE SUR UN `toHaveCount`. Sans lui, cette assertion hérite
    // des 5 000 ms par défaut de `expect` (playwright.config.ts:8) dans un
    // fichier qui déclare 90 000 partout ailleurs AU MOTIF que la fiche arrive
    // en flux. `#infos` (page.tsx:590) est rendu APRÈS le `<h1>` (:566) : le
    // témoin précédent ne prouve donc pas que la grille est là.
    const cellule = celluleModalite(page);
    await expect(
      cellule,
      "la cellule « Modalité » est introuvable dans `#infos` (sessions/[id]/page.tsx:610-615). " +
        "Sans elle, ce parcours n'a AUCUN moyen de vérifier que la modalité saisie est celle " +
        "qui est rendue — et c'est la seule chose que la création de session prouve ici.",
    ).toHaveCount(1, { timeout: 90_000 });
    await expect(
      cellule,
      "la session a été créée en « presentiel » mais sa fiche n'affiche pas « Présentiel ». " +
        "`MODALITE_LABELS` (sessions/[id]/page.tsx:97-101) ne connaît que trois valeurs : si " +
        "la colonne portait autre chose, la cellule afficherait la valeur brute de la base.",
    ).toContainText("Présentiel", { timeout: 90_000 });
    await expect(
      cellule,
      "la cellule « Modalité » d'une session PRÉSENTIELLE annonce une autre modalité : le " +
        "formulaire a envoyé une valeur, la fiche en rend une autre",
    ).not.toContainText(/Distanciel|Hybride/, { timeout: 30_000 });

    // ── 3. Ce qui n'est pas persisté disparaît au rechargement ─────────────
    //
    // 🔑 Une assertion posée juste après la soumission peut lire un état
    // optimiste. On relit la fiche PAR SON URL, dans une requête neuve : ce
    // qui survit là a été écrit.
    await ouvrir(page, `qualiopi/sessions/${id}`);
    await expect(
      page.locator(CONTENU).getByRole("heading", { level: 1, name: titre }),
      `le titre « ${titre} » n'a pas survécu au rechargement de la fiche : il n'a donc pas ` +
        "été persisté, quoi qu'ait affiché l'écran juste après la soumission",
    ).toBeVisible({ timeout: 90_000 });
    await expect(
      celluleModalite(page),
      "la modalité n'a pas survécu au rechargement de la fiche : elle n'a pas été persistée",
    ).toContainText("Présentiel", { timeout: 60_000 });

    // ── 4. LE discriminant : l'écran d'émargement d'une session en salle ───
    //
    // 🔴 CE QUI DISCRIMINE, ET CE QUI NE DISCRIMINE PAS. Le `<h2>` « Feuille
    // d'émargement présentiel » (emargement/page.tsx:244) est rendu
    // INCONDITIONNELLEMENT, hors de tout test de modalité : il s'affiche à
    // l'identique pour une session distancielle. L'exiger COMME PREUVE DE
    // MODALITÉ reviendrait à écrire une assertion qui ne peut pas rougir sur
    // ce qu'elle prétend garder. (Il sert ici à tout autre chose : voir le
    // témoin 2.)
    //
    // 🔑 Le seul nœud de cet écran réellement gaté par la modalité est la
    // section « Relevé de connexion distanciel », sous `{isDistanciel && (`
    // (prédicat emargement/page.tsx:126, garde :262, titre :264). Son ABSENCE
    // est donc une vraie information.
    //
    // ⚠️ MAIS UNE NÉGATION EST SATISFAITE PAR UN DOM INCOMPLET, et le premier
    // jet de ce fichier s'est fait prendre : son unique témoin était
    // `.admin-page-header`, c'est-à-dire le PREMIER nœud du flux
    // (AdminPageHeader monté en :138-141), alors que la garde est en :262, en
    // fin de page. Un écran qui n'a pas fini d'arriver satisfaisait le témoin
    // ET la négation. Le commentaire affirmait pourtant « si le témoin est
    // vert, la page a rendu » — c'était faux.
    //
    // 🔑 DEUX TÉMOINS, DEUX RÔLES DISTINCTS, et il faut les deux.
    await ouvrir(page, `qualiopi/sessions/${id}/emargement`);

    // TÉMOIN 1 — la page a COMMENCÉ à rendre, ET elle porte la modalité RÉELLE
    // de la session. Il atteste la modalité, pas l'achèvement du rendu.
    //
    // ⚠️ Rectification du premier jet : ce n'est PAS « le seul endroit de cet
    // écran où la modalité réelle est écrite ». L'encadré d'identité en porte
    // une seconde copie (emargement/page.tsx:153-160). On vise l'en-tête parce
    // qu'il arrive le premier, pas parce qu'il serait unique — et le message
    // ne dit plus qu'il l'est.
    await expect(
      page.locator(".admin-page-header"),
      "l'en-tête de l'écran d'émargement n'annonce pas « · Présentiel · ». C'est là que la " +
        "modalité réelle de la session est écrite en premier (emargement/page.tsx:140, " +
        "copie dans l'encadré d'identité :153-160) ; sans ce témoin, la négation vérifiée " +
        "plus bas ne prouverait rien — un DOM vide la satisferait tout autant.",
    ).toContainText(/·\s*Présentiel\s*·/, { timeout: 90_000 });

    // TÉMOIN 2 — IL NE DISCRIMINE RIEN, c'est son rôle. Ce `<h2>` est rendu
    // inconditionnellement (emargement/page.tsx:244), à l'identique pour une
    // session distancielle. Il sert de BORNE DE RENDU : c'est le dernier titre
    // inconditionnel émis avant la garde `isDistanciel` (:262). Tant qu'il
    // n'est pas là, la page n'a pas atteint la zone que la négation suivante
    // prétend inspecter.
    //
    // ⚠️ RÉSERVE ASSUMÉE, et c'est le mieux disponible : il n'existe AUCUN
    // repère APRÈS la garde pour une session sans stagiaire. Le récapitulatif
    // des taux (:278-280) est lui-même conditionné par `enrollments.length > 0`
    // et notre session vient d'être créée, donc vide. La négation s'appuie
    // donc sur le dernier nœud d'AVANT la garde, pas sur un nœud d'APRÈS.
    await expect(
      page.getByRole("heading", { name: "Feuille d'émargement présentiel" }),
      "l'écran d'émargement n'a jamais rendu sa section de feuille de présence " +
        "(emargement/page.tsx:244, inconditionnelle) : la page n'a pas fini d'arriver, et " +
        "l'absence vérifiée juste après ne prouverait rien.",
    ).toBeVisible({ timeout: 90_000 });

    // LA NÉGATION, maintenant qu'elle veut dire quelque chose.
    await expect(
      page.getByRole("heading", { name: "Relevé de connexion distanciel" }),
      "une session PRÉSENTIELLE propose l'import d'un relevé de connexion visio. La garde " +
        "`isDistanciel` (emargement/page.tsx:126, appliquée :262) laisse donc passer une " +
        "modalité en salle — ou bien la session n'a pas été enregistrée en « presentiel ».",
    ).toHaveCount(0, { timeout: 30_000 });
  });

  // 🔑 LE NOM DE CE TEST A ÉTÉ CORRIGÉ : il promettait « nomment la session ».
  // C'était faux pour un écran sur quatre — « Tout pour animer » est la page
  // d'une FORMATION et porte le numéro de la formation, jamais celui de la
  // session. Un nom de test qui sur-promet est un message d'échec qui ment
  // avant même d'avoir échoué.
  test("les sous-pages offertes par le hub répondent, nomment leur dossier et ne sont pas vides", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");
    await loginAsAdmin(page);

    const id = await ouvrirSessionDemo(page);
    expect(
      id,
      `session ${SESSION_DEMO} introuvable dans la liste des sessions ET dans les archives — ` +
        "`pnpm qualiopi:seed-demo` n'a pas tourné sur cette base (la CI l'exécute en " +
        "ci.yml:415 ; en local, c'est à faire à la main)",
    ).not.toBeNull();

    // ── Ce que le hub OFFRE réellement ────────────────────────────────────
    const liens = page.locator("#sous-pages a");
    await expect(
      liens.first(),
      "la section `#sous-pages` du hub de session (sessions/[id]/page.tsx:814) ne porte aucun " +
        "lien : soit la fiche n'a pas fini de rendre, soit la navigation vers les sous-pages a " +
        "disparu de la console",
    ).toBeVisible({ timeout: 90_000 });

    const offertes = await liens.evaluateAll((noeuds) =>
      noeuds.map((n) => ({
        // 🔑 `null` PLUTÔT QUE `""`. Un premier jet écrivait `?? ""`, ce qui
        // envoyait `page.goto("")` : l'échec accusait alors la navigation, pas
        // le lien sans destination qui l'avait causée. Aucun des quatre liens
        // actuels n'est concerné — rien ne le garantit pour le prochain.
        href: n.getAttribute("href"),
        libelle: (n.textContent ?? "").replace(/\s+/g, " ").trim(),
      })),
    );

    // LE CLIQUET : la liste des libellés est figée dans ce fichier. Une
    // sous-page ajoutée ou retirée doit rougir ICI, et nulle part ailleurs.
    expect(
      offertes.map((o) => o.libelle),
      "la liste des sous-pages offertes par le hub a changé. Ce n'est pas forcément une " +
        "panne — c'est une décision de produit qui doit être VUE : si un écran a été ajouté, " +
        "il doit entrer dans ce parcours ; s'il a été retiré, il faut savoir qui s'appuyait " +
        "dessus. Liste attendue relevée dans sessions/[id]/page.tsx:817-834.",
    ).toEqual([...LIBELLES_SOUS_PAGES]);

    // ── Chaque écran répond, se nomme, et n'est pas vide ───────────────────
    const pannes: string[] = [];
    const releve: Record<string, string[]> = {};

    for (const { href, libelle } of offertes) {
      if (href === null || href === "") {
        pannes.push(
          `${libelle} : lien SANS destination — le hub rend un <a> dépourvu de \`href\` ` +
            "(sessions/[id]/page.tsx:817-834). L'écran est annoncé au formateur et ne " +
            "s'ouvrira jamais.",
        );
        continue;
      }

      // 🔴 `domcontentloaded` mesure trop tôt sous `next dev` : la route
      // compile à la demande et le corps arrive après. La version précédente
      // en concluait qu'il fallait attendre le silence du réseau — mais une
      // page de console ne se tait jamais tout à fait, et l'attente consommait
      // le budget avant de rendre un verdict muet. (Le cliquet
      // `delai-interne-sous-le-budget.spec.ts:136-166` interdit d'ailleurs
      // cette attente sans borne.) On navigue sans attendre d'état de charge,
      // puis on attend un CONTENU (`texteDuContenu`).
      const reponse = await page.goto(href, { waitUntil: "domcontentloaded", timeout: 90_000 });

      const statut = reponse?.status() ?? 0;
      if (statut !== 200) {
        pannes.push(`${libelle} : HTTP ${statut} sur ${href}`);
        continue;
      }

      // 🔴 UN 200 NE DIT PAS QU'ON EST ARRIVÉ. Ces pages appellent `redirect()`
      // quand leur objet est introuvable (p. ex. animer/page.tsx:76-78, vers la
      // liste des formations) ; le navigateur suit, la réponse finale vaut 200,
      // la page d'atterrissage est longue et ne contient aucun mot d'erreur.
      // Trois assertions passeraient alors sur un écran qui n'est PAS celui
      // demandé.
      const arrivee = new URL(page.url()).pathname;
      if (arrivee !== href) {
        pannes.push(
          `${libelle} : redirigé — demandé ${href}, atterri sur ${arrivee}. La ressource est ` +
            "probablement introuvable côté serveur ; la réponse reste 200 parce que le " +
            "navigateur a suivi la redirection.",
        );
        continue;
      }

      const zone = page.locator(CONTENU);
      const texte = await texteDuContenu(page, libelle);
      const titres = (await zone.locator("h1, h2").allInnerTexts())
        .map((t) => t.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      releve[libelle] = titres;

      // 🔑 Les titres réellement rendus sont ATTACHÉS au rapport, jamais
      // devinés : c'est la matière de l'audit. Ce qu'on EXIGE, en revanche,
      // c'est ce qui doit être vrai de toute page d'audit.
      //
      // 🔴 UNE GARDE `if (titres.length === 0)` A ÉTÉ RETIRÉE D'ICI. Elle ne
      // pouvait JAMAIS rougir : `texteDuContenu`, appelé neuf lignes plus haut,
      // exige déjà un `<h1>` VISIBLE dans la même zone et LÈVE s'il manque. À ce
      // point du code, `zone.locator("h1, h2")` porte donc toujours au moins une
      // entrée non vide. Une garde qui ne peut pas rougir n'est pas une garde :
      // c'est une ligne qui rassure.

      // Seuil mesuré sur `CONTENU`, jamais sur `body` : 400 caractères de
      // contenu réel. Sur `body`, le seul rail en pèse 2 207 et le seuil était
      // franchi par une page entièrement vide.
      if (texte.length < 400) {
        pannes.push(
          `${libelle} : contenu quasi vide (${texte.length} car.) — « ${texte.slice(0, 200)} »`,
        );
      }

      // 🔴 « 500 » A ÉTÉ RETIRÉ DE CETTE ALTERNANCE. C'était un sous-motif nu :
      // il matche « 1 500,00 € », et le plafond OPCO « 3 500,00 € » que l'écran
      // de financement affiche légitimement. Une panne fantôme en dormance —
      // et le statut HTTP est déjà vérifié vingt lignes plus haut.
      //
      // ⚠️ `introuvable` relève de la MÊME famille et n'a eu que de la chance sur
      // ce périmètre : la console écrit « Client introuvable » (devis/page.tsx:146)
      // et « Formation introuvable » ailleurs. Il est donc ANCRÉ sur une phrase
      // de page d'erreur, jamais sur le mot nu.
      if (
        /(page|ressource|session|document)\s+introuvable|Une erreur est survenue|Erreur serveur/i.test(
          texte,
        )
      ) {
        pannes.push(`${libelle} : la page annonce une erreur — « ${texte.slice(0, 160)} »`);
      }

      // ── Contrôle d'identité : cette page parle-t-elle du BON dossier ? ───
      //
      // ⚠️ EXEMPTION EXPLICITE, et ce n'est pas un contournement : « Tout pour
      // animer » est la page d'une FORMATION, pas d'une session — le lien du
      // hub pointe vers `/qualiopi/formations/<id>/animer`
      // (sessions/[id]/page.tsx:829-834). Elle ne porte donc pas le numéro de
      // session, mais elle porte celui de la formation (animer/page.tsx:244),
      // et c'est ce numéro-là qu'on exige d'elle. Aucun des quatre écrans
      // n'échappe au contrôle ; seul le repère change. (Les trois autres
      // écrivent le numéro de session dans leur en-tête : emargement:140,
      // evaluations:135, financement:222.)
      const attendu = href.includes("/qualiopi/formations/") ? FORMATION_DEMO : SESSION_DEMO;
      if (!texte.includes(attendu)) {
        pannes.push(
          `${libelle} : la page ne nomme pas ${attendu}. Elle a répondu et elle est remplie, ` +
            "mais rien ne dit qu'elle parle du dossier de démonstration.",
        );
      }
    }

    await info.attach("titres-sous-pages.json", {
      body: JSON.stringify(releve, null, 2),
      contentType: "application/json",
    });

    // 🔴 CONTRE-TÉMOIN, ET IL N'EST PAS DÉCORATIF. `expect(pannes).toEqual([])`
    // est VERT quand la boucle n'a rien parcouru : c'est la famille de défaut
    // « asserter sur un ensemble vide qu'on n'a jamais rempli ». On exige donc
    // d'abord que les quatre écrans aient été RÉELLEMENT mesurés — un écran
    // qui n'a pas répondu, ou qui a redirigé, n'entre pas dans `releve`.
    //
    // 🔑 ET LES PANNES SONT INJECTÉES DANS CE MESSAGE-CI. Le premier jet
    // promettait « lire les pannes listées ci-dessous » — or cette assertion
    // LANCE avant celle qui les imprime : le diagnostic promis était
    // inatteignable. Une promesse de message qu'on ne peut pas tenir est un
    // faux diagnostic de plus.
    expect(
      Object.keys(releve).sort(),
      "toutes les sous-pages n'ont pas été mesurées : la boucle s'est arrêtée avant la fin " +
        "sur au moins l'une d'elles (lien sans href, HTTP ≠ 200, ou redirection). Le verdict " +
        "rendu ensuite sur `pannes` porterait sur un relevé incomplet. Pannes relevées : " +
        (pannes.length > 0 ? pannes.join(" | ") : "(aucune)"),
    ).toEqual([...LIBELLES_SOUS_PAGES].sort());

    expect(pannes, "sous-pages de session inaccessibles, vides, redirigées ou hors sujet").toEqual(
      [],
    );
  });

  test("du devis accepté à la facture OPCO : les trois pièces du dossier existent et s'ouvrent", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");
    await loginAsAdmin(page);

    // ══ 1. LE DEVIS — accepté, 2 900,00 € HT, financement OPCO ════════════
    //
    // 🔑 C'est la moitié qui manquait à ce fichier : le titre annonçait « du
    // devis à la facture » et aucune des trois pièces n'y était nommée.
    await ouvrir(page, "qualiopi/devis");
    await texteDuContenu(page, "liste des devis");

    // La liste n'est PAS paginée : `listDevis()`
    // (src/server/qualiopi/crm/devis.ts:23-33) fait un `findMany` sans `take`,
    // trié par numéro (:27). Le devis de démonstration est donc toujours sur
    // cet écran — contrairement à la liste des SESSIONS, où la pagination avait
    // déjà fait conclure à tort « le seed n'a pas tourné ».
    //
    // ⚠️ CE QUE CE MESSAGE NE PEUT PAS TRANCHER, et il ne le prétend pas :
    // `listDevis` avale ses erreurs (`catch { return []; }`, devis.ts:30-32).
    // Une base injoignable rend le MÊME écran vide qu'un seed absent.
    const ligneDevis = page.locator("tbody tr").filter({ hasText: DEVIS_DEMO });
    await expect(
      ligneDevis,
      `aucune ligne « ${DEVIS_DEMO} » dans la liste des devis. Trois causes possibles, et cet ` +
        "écran ne permet PAS de les départager : `pnpm qualiopi:seed-demo` n'a pas tourné ; " +
        "le devis de démonstration a été supprimé ; ou la base est injoignable et `listDevis` " +
        "a rendu une liste vide sans le dire (devis.ts:30-32). Vérifier la base avant de " +
        "conclure au seed.",
    ).toHaveCount(1, { timeout: 90_000 });

    // On vise les CELLULES, pas la ligne entière : sur la ligne, « OPCO »
    // pourrait aussi bien provenir de la sous-ligne « OPCO : … » du montant
    // (devis/page.tsx:152-157), rendue dès que `montantOpcoEstimeCents` est
    // renseigné. Le seed ne le renseigne pas — mais une assertion ne doit pas
    // dépendre d'un champ qu'elle n'a pas vérifié.
    //
    // Colonnes, dans l'ordre du `<thead>` (devis/page.tsx:115-125) :
    // 0 Numéro · 1 Client · 2 Montant HT · 3 Financement · 4 Statut ·
    // 5 Validité · 6 Action.
    const cellulesDevis = ligneDevis.locator("td");
    await expect(
      cellulesDevis.nth(2),
      `le devis ${DEVIS_DEMO} n'affiche pas 2 900,00 € HT. C'est le montant que le seed écrit ` +
        "(`montantTotalHtCents: 290000`, demo.ts:412) et celui que la facture reprend " +
        "(demo.ts:801) : s'ils divergent, la chaîne devis → facture ne se tient plus.",
    ).toContainText(MONTANT_DEMO, { timeout: 30_000 });
    await expect(
      cellulesDevis.nth(3),
      "le financement suggéré du devis de démonstration n'est pas « OPCO » — le seed pose " +
        "`financementSuggere: opco` (demo.ts:415), rendu par `FINANCEMENT_LABELS` " +
        "(devis/page.tsx:160-161), et c'est ce qui justifie la subrogation vérifiée en fin " +
        "de parcours",
    ).toHaveText("OPCO", { timeout: 30_000 });
    await expect(
      cellulesDevis.nth(4),
      `le devis ${DEVIS_DEMO} n'est pas au statut « Accepté ». Le seed l'écrit ` +
        "`statut: accepte` (demo.ts:416) — mais son upsert porte `update: {}` " +
        "(demo.ts:1187-1201, la branche vide est en :1189) : un statut modifié par une " +
        "exécution précédente n'est JAMAIS rattrapé par un nouveau seed.",
    ).toContainText("Accepté", { timeout: 30_000 });

    // On OUVRE la pièce, on ne se contente pas de la voir listée : un lien qui
    // ne mène nulle part est un défaut que ce dépôt a déjà trouvé trois fois.
    // Le bouton est un `AdminButton` avec `href` (devis/page.tsx:201-209), donc
    // un vrai `<a>` (AdminButton.tsx:117-121) : `getByRole("link")` le voit.
    // ⚠️ BUDGET EXPLICITE — un clic qui navigue ATTEND sa navigation.
    //
    // 🔴 2026-08-23 — Ce clic était le seul de ce fichier sans délai déclaré :
    // il héritait donc de `playwright.config.ts:36 actionTimeout: 15_000`,
    // alors que la ligne suivante accorde 90 s à la MÊME navigation. Mesuré :
    // « click action done / waiting for scheduled navigations to finish »
    // puis `Timeout 15000ms exceeded` — le clic avait abouti, et il mourait en
    // attendant ce que sa propre ligne suivante avait le droit d'attendre.
    //
    // 🔑 Ce n'est pas un budget gonflé, c'est un budget ALIGNÉ sur son voisin :
    // au-delà, c'est bien `waitForURL` qui rend le verdict, et lui nomme l'URL.
    await ligneDevis.getByRole("link", { name: "Ouvrir" }).click({ timeout: 90_000 });
    await page.waitForURL(/\/qualiopi\/devis\/[0-9a-f-]{36}/, {
      waitUntil: "domcontentloaded", // défaut = `"load"` ; cf. la note de `creerSession` dans `_communs.ts`.
      timeout: 90_000,
    });
    await expect(
      page.locator(CONTENU).getByRole("heading", { level: 1, name: `Devis ${DEVIS_DEMO}` }),
      `la fiche ouverte depuis la ligne ${DEVIS_DEMO} ne porte pas le titre « Devis ` +
        `${DEVIS_DEMO} » (devis/[id]/page.tsx:204-205) : le bouton « Ouvrir » de cette ligne ` +
        "mène donc ailleurs, ou la fiche n'a pas fini de rendre",
    ).toBeVisible({ timeout: 90_000 });

    // ══ 2. L'ATTESTATION — la pièce qui clôt la réalisation ═══════════════
    const id = await ouvrirSessionDemo(page);
    expect(
      id,
      `session ${SESSION_DEMO} introuvable — sans elle, ni l'attestation ni la facture ne sont ` +
        "atteignables : `pnpm qualiopi:seed-demo` n'a pas tourné sur cette base",
    ).not.toBeNull();
    await texteDuContenu(page, "hub de la session de démonstration");

    // `#documents` (sessions/[id]/page.tsx:872) monte `DocumentsSection`, un
    // composant client — mais le tableau des pièces existantes
    // (DocumentsSection.tsx:1467-1621) est alimenté PAR SES PROPS : il est donc
    // présent dans le HTML initial et lisible sans attendre l'hydratation. Le
    // délai reste large parce que, sous `next dev`, la fiche arrive en flux.
    const ligneAttestation = page.locator("#documents tr").filter({ hasText: ATTESTATION_DEMO });
    await expect(
      ligneAttestation,
      `aucune ligne « ${ATTESTATION_DEMO} » dans la section Documents de la session. Le seed ` +
        "l'écrit avec son `sessionId` (demo.ts:1459-1475, `sessionId` en :1466) : si elle " +
        "manque, soit le seed n'a pas tourné, soit la pièce a été détachée de la session.",
    ).toHaveCount(1, { timeout: 90_000 });
    // 🔴 2026-09-06 — CETTE ASSERTION ÉTAIT PÉRIMÉE, ET RIEN NE POUVAIT LE DIRE.
    //
    // Elle exigeait « Attestation de réalisation ». Or ce libellé est le défaut
    // qui a été CORRIGÉ le 2026-09-05 : « réalisation » est le vocabulaire du
    // CERTIFICAT, dû au FINANCEUR, tandis que l'attestation est due au
    // STAGIAIRE — un auditeur lisant deux lignes voisines ne pouvait pas les
    // distinguer. L'écran dit désormais ce que la PIÈCE imprime déjà
    // (`docTitle` de `templates/attestation.tsx`), et deux témoins unitaires le
    // verrouillent : `docs-section-libelles-derivent.spec.ts` interdit à
    // `DOC_LABELS.attestation` de dériver de la source ET d'employer le mot
    // « réalisation », `libelles-vs-titres-pdf.spec.ts` tient l'écran sur le PDF.
    //
    // Le correctif est donc parti VERT : la suite E2E ne tournait plus. L'étape
    // de budget du bundle était placée AVANT elle et la faisait `skipped` sur un
    // dépassement de quelques kilo-octets (cf. ADR 0049). Cette assertion est le
    // premier défaut que la remise en ordre a rendu visible.
    //
    // ⚠️ DÉRIVÉE, jamais recopiée. Une chaîne écrite ici en toutes lettres
    // serait exactement ce qui vient de se produire : elle survivrait au
    // prochain arbitrage de vocabulaire sans que personne ne la relie à sa
    // source. `LIBELLES_TYPE_DOCUMENT` est LA table, et l'écran lui est adossé
    // par le témoin cité plus haut — donc lire la table ici, c'est lire l'écran.
    await expect(
      ligneAttestation,
      `la pièce n'est pas libellée « ${LIBELLES_TYPE_DOCUMENT.attestation} ». Ce libellé vient ` +
        "de `DOC_LABELS.attestation` (DocumentsSection.tsx:196), que " +
        "`docs-section-libelles-derivent.spec.ts` tient égal à " +
        "`LIBELLES_TYPE_DOCUMENT.attestation` : un autre libellé signifie que le `type` en " +
        "base n'est plus `attestation` (demo.ts:791).",
    ).toContainText(LIBELLES_TYPE_DOCUMENT.attestation, { timeout: 30_000 });

    // 🔴 UNE PIÈCE ANNULÉE EST INDISCERNABLE D'UNE PIÈCE VALABLE — SAUF ICI.
    //
    // L'upsert de l'attestation porte `update: {}` (demo.ts:1461) : le seed
    // n'est donc PAS réparateur. Une attestation annulée par une exécution
    // précédente n'est jamais remise en état, et la page publique
    // `/verifier-attestation/[token]` affiche alors qu'elle ne fait plus foi —
    // ce que le parcours 07 ne reconnaît pas : ce parcours-là resterait vert
    // sur une pièce morte.
    //
    // 🔑 Ici, le registre le dit : la ligne porte le badge « Annulée »
    // (DocumentsSection.tsx:1513-1517, avec le détail « Annulée le … » en
    // :1518-1522). Aucun autre texte de la ligne ne contient cette chaîne — le
    // bouton d'annulation écrit « Annuler cette pièce » (:330), « Annulation… »
    // et « Confirmer l'annulation » (:358), jamais « Annulée ».
    //
    // L'assertion est une NÉGATION, mais elle est adossée aux deux assertions
    // positives qui précèdent — la ligne existe et porte son libellé — donc
    // aucun DOM vide ne peut la satisfaire.
    await expect(
      ligneAttestation,
      `l'attestation ${ATTESTATION_DEMO} est ANNULÉE au registre : elle ne fait plus foi. Un ` +
        "nouveau `pnpm qualiopi:seed-demo` ne la réparera pas — son upsert porte " +
        "`update: {}` (demo.ts:1461). Correctif connu : remettre `annuleeAt`, `annuleeMotif` " +
        "et `annuleePar` à `null` dans la branche `update`.",
    ).not.toContainText("Annulée", { timeout: 30_000 });

    // ══ 3. LA FACTURE — OPCO, subrogée, 2 900,00 € HT ═════════════════════
    //
    // 🔑 On y va PAR UN CLIC depuis le hub, et non en composant l'URL. Deux
    // raisons : un parcours joue ce qu'un humain fait ; et cliquer prouve en
    // plus que le lien « Financement » du hub mène bien à l'écran de
    // financement DE CETTE session — ce qu'une URL fabriquée ne prouve jamais.
    const lienFinancement = page.locator("#sous-pages").getByRole("link", { name: "Financement" });
    await expect(
      lienFinancement,
      "le lien « Financement » a disparu de `#sous-pages` (sessions/[id]/page.tsx:823-825) : " +
        "l'écran qui porte les factures de la session n'est plus atteignable depuis son hub",
    ).toHaveCount(1, { timeout: 60_000 });
    await lienFinancement.click({ timeout: 90_000 }); // cf. `ARRIVEE_ECRAN` (_communs.ts) : le clic paie l'attente de SA navigation.
    await page.waitForURL(/\/qualiopi\/sessions\/[0-9a-f-]{36}\/financement$/, {
      waitUntil: "domcontentloaded", // défaut = `"load"` ; cf. la note de `creerSession` dans `_communs.ts`.
      timeout: 90_000,
    });
    const texteFinancement = await texteDuContenu(page, "écran de financement de la session");

    const ligneFacture = page.locator("tbody tr").filter({ hasText: FACTURE_DEMO });
    await expect(
      ligneFacture,
      `aucune ligne « ${FACTURE_DEMO} » dans « Factures générées » ` +
        "(financement/page.tsx:418-422 — toute la section est conditionnée par " +
        "`facturesFormation.length > 0`, :418). Le seed l'écrit avec son `sessionId` " +
        "(demo.ts:1487-1503, `sessionId` en :1492) — sans elle, ce parcours s'arrête au devis " +
        `et son titre ment. Écran réellement lu : « ${texteFinancement.slice(0, 300)} »`,
    ).toHaveCount(1, { timeout: 90_000 });

    // Colonnes du `<thead>` (financement/page.tsx:425-443) :
    // 0 Numéro · 1 Destinataire · 2 Montant HT · 3 Statut · 4 Émise le.
    const cellulesFacture = ligneFacture.locator("td");
    // 🔴 ON VISE LE PREMIER `<div>`, PAS LA CELLULE — et c'est un correctif, pas
    // un raffinement. La cellule « Destinataire » rend TROIS `<div>` :
    // le libellé (financement/page.tsx:456), `destinataireNom` (:458) et, sous
    // condition, « Subrogation » (:462). Or le seed pose `destinataireNom` à
    // « [DEMO] ATLAS – OPCO des entreprises de croissance » (demo.ts:800) : un
    // `toContainText("OPCO")` sur la CELLULE est donc satisfait par le nom de
    // l'organisme, même si le libellé bascule sur « Entreprise », « Stagiaire »
    // ou « France Travail » (financement/page.tsx:68-71). Le témoin ne pouvait
    // pas rougir sur ce qu'il prétendait garder.
    //
    // `toHaveText` (égalité) plutôt que `toContainText` : ce `<div>` ne porte
    // QUE le libellé.
    await expect(
      cellulesFacture.nth(1).locator("div").first(),
      "la facture de démonstration n'est pas adressée à l'OPCO (`destinataire: opco`, " +
        "demo.ts:799 ; libellé rendu par `DESTINATAIRE_LABELS`, financement/page.tsx:456) — " +
        "or c'est tout l'objet du dossier : une formation financée par ATLAS",
    ).toHaveText("OPCO", { timeout: 30_000 });
    await expect(
      cellulesFacture.nth(1),
      "la mention « Subrogation » manque sur la facture. Elle est rendue sous " +
        "`{f.subrogation && (` (financement/page.tsx:460-464) et le seed pose " +
        "`subrogation: true` (demo.ts:810) : sans elle, l'organisme facturerait le client au " +
        "lieu de l'OPCO — ce n'est pas le montage de ce dossier.",
    ).toContainText("Subrogation", { timeout: 30_000 });
    await expect(
      cellulesFacture.nth(2),
      "le montant de la facture ne vaut pas 2 900,00 € HT. Le devis accepté, la session et la " +
        "facture portent tous les trois `290000` centimes (demo.ts:412, :557, :801) : une " +
        "divergence ici casse la chaîne que ce parcours prétend suivre.",
    ).toContainText(MONTANT_DEMO, { timeout: 30_000 });
    await expect(
      cellulesFacture.nth(3),
      `la facture ${FACTURE_DEMO} n'est pas au statut « Émise » (\`statut: emise\`, ` +
        "demo.ts:811 ; libellé rendu par `STATUT_FACTURE_LABELS`, financement/page.tsx:485). " +
        "Comme pour l'attestation, l'upsert porte `update: {}` (demo.ts:1489) : un statut " +
        "modifié par une exécution précédente n'est pas rattrapé par un nouveau seed.",
    ).toContainText("Émise", { timeout: 30_000 });

    // Le relevé de ce qu'on a réellement lu — matière d'audit, pas supposition.
    await info.attach("chaine-devis-facture.json", {
      body: JSON.stringify(
        {
          devis: DEVIS_DEMO,
          session: SESSION_DEMO,
          attestation: ATTESTATION_DEMO,
          facture: FACTURE_DEMO,
          financementLu: texteFinancement.slice(0, 1200),
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  });
});
