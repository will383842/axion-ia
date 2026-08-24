/**
 * PARCOURS 6 — LE STAGIAIRE, sur un téléphone de 360 px.
 *
 * Phase 6 de `_AUDIT/PROMPT-AUDIT-QUALIOPI-E2E-50-AGENTS-2026-08-18.md` :
 * « du lien d'accès à l'attestation ».
 *
 * 360 px n'est pas un cas limite : c'est la largeur d'un Android d'entrée de
 * gamme, et un stagiaire consulte son espace depuis le train, pas depuis un
 * poste de travail. Une console admin qui déborde est un désagrément ; un
 * portail stagiaire qui déborde empêche de signer.
 *
 * ⚠️ Le lien d'accès est généré pour un stagiaire de DÉMONSTRATION
 * (`@demo.axion-ia.invalid`). Aucune personne physique n'est destinataire.
 *
 * ## Ce que la version précédente ne prouvait PAS (audit du 2026-08-22)
 *
 * Le fichier s'arrêtait à trois assertions, et aucune des trois ne pouvait
 * rougir sur ce que le titre annonce :
 *
 *   1. `expect(status).toBe(200)` — TROIS issues opposées partagent ce statut :
 *      l'espace réellement servi, la page `acces-invalide` (200 elle aussi), et
 *      `demander-acces` atteinte via le 307 de `src/proxy.ts` (bloc 0sexies,
 *      :205 et :231-246). Un lien mort et un lien valide rendaient le même verdict ;
 *   2. `texte.length > 80` sur `body` — le refus d'accès de `_coquille.tsx:111-118`
 *      pèse à lui seul plus de cent caractères, et l'écran `acces-invalide`
 *      davantage encore. Une garde qui ne peut pas rougir ne garde rien ;
 *   3. `toMatch(/\/portail\//)` sur un texte issu d'un locator DÉJÀ filtré par
 *      `hasText: /\/portail\//` — tautologie pure.
 *
 * Et le mot « attestation », que l'en-tête annonce, n'apparaissait dans aucune
 * assertion : le parcours s'arrêtait à la porte d'entrée.
 *
 * ## Ce que ce fichier prouve DÉSORMAIS
 *
 *   · l'organisme produit un lien d'accès pour Marie Martin, depuis SA ligne ;
 *   · le lien porte un jeton de 64 hexadécimaux, pas une URL squelette ;
 *   · l'écran SE PRONONCE sur la transmission (le `[role="status"]` existe) ;
 *   · ouvert, le lien rend une 302 vers `…/fr/portail/mon-espace` — lue AVANT
 *     d'être suivie, seule façon de distinguer les trois issues ci-dessus ;
 *   · le cookie de session est réellement enregistré par le navigateur ;
 *   · l'espace servi est celui de MARIE (« Bonjour Marie »), pas un écran de refus ;
 *   · la BASCULE de mise en page est mesurée dans les deux sens, sur le MÊME
 *     sélecteur et dans la MÊME exécution : la barre latérale existe à la largeur
 *     de bureau (1 280 px, `devices["Desktop Chrome"]`, playwright.config.ts:43)
 *     et DISPARAÎT à 360 px, où une barre d'onglets pleine largeur ancrée en bas
 *     prend le relais, avec quatre cibles tactiles d'au moins 44 px ;
 *   · l'onglet « Documents » mène à l'attestation `AXI-ATT-DEMO-001`, dont le
 *     lien « Vérifier » atteint une page qui la déclare AUTHENTIQUE ;
 *   · aucun des deux écrans ne déborde horizontalement ;
 *   · aucune requête du portail ne sort de l'instance mesurée.
 *
 * ## Ce qu'il ne prouve toujours PAS — à dire, pas à taire
 *
 *   · **la transmission n'est pas corroborée.** L'annonce « Lien envoyé au
 *     stagiaire par e-mail. » / « Lien NON transmis… » est un ternaire EXHAUSTIF
 *     sur `result.envoyeAuStagiaire` (GenererPortailAccesButton.tsx:106-108),
 *     rendu dans le MÊME bloc `{result && (…)}` que le `<code>` du lien (:100,
 *     :114-116). Exiger que le texte soit l'un des deux serait une tautologie :
 *     l'assertion serait verte sous exactement la régression qu'elle prétend
 *     garder (le drapeau reposé inconditionnellement à `true`, retiré le
 *     2026-08-19 dans portail.ts:583-594, l'affectation en :588). On garde donc uniquement ce qui peut
 *     rougir — la PRÉSENCE de l'annonce — et on attache son texte. Corréler
 *     l'annonce à un envoi réel demande l'écran de corbeille d'envoi de la
 *     console : c'est un autre parcours, pas une ligne de plus ici ;
 *   · l'e-mail n'est jamais lu : aucun message n'est vérifié quelque part ;
 *   · la section « Documents de ma formation » (programme, règlement intérieur,
 *     livret d'accueil, convocation) n'est pas couverte : le seed n'écrit aucune
 *     de ces pièces, donc `espace.pieces` est vide et la section n'est jamais
 *     rendue (documents/page.tsx:138). Exiger son contenu ici serait inventer
 *     une donnée ;
 *   · le bouton « Télécharger » n'est pas couvert non plus, et pour la même
 *     raison de fond : aucune `pdfUrl` au seed, R2 absent en CI, et le lien est
 *     gaté dessus (documents/page.tsx:105-115) ;
 *   · un débordement vers la GAUCHE reste invisible à l'instrument (voir
 *     `mesurerDebordement`).
 *
 * ## ⚠️ CE FICHIER EST UNE GATE BLOQUANTE — corrigé le 2026-08-23
 *
 * 🔴 Les versions précédentes de cet en-tête affirmaient « ce fichier n'est PAS
 * une gate », en s'appuyant sur un `continue-on-error: true` posé sur le step
 * « Playwright suite ». **C'est faux depuis le 2026-08-23** : le drapeau a été
 * RETIRÉ (`.github/workflows/ci.yml:479`, « CE GATE PEUT ENFIN ROUGIR »), après
 * la trajectoire 0/237 → 206 → 210 → 224 passés qui y est consignée. Et le
 * commentaire qui l'accompagne dit la conséquence en toutes lettres :
 * `Gate B · per-PR` est un contexte EXIGÉ par la protection de `main`, avec
 * `strict: true` — **un rouge ici bloque 100 % des PR, pas seulement la sienne.**
 *
 * 🔑 Conséquence directe sur la façon d'écrire ce fichier : une assertion posée
 * sur un défaut de produit CONNU et NON CORRIGÉ ouvrirait un rouge permanent sur
 * tout le dépôt. C'est le ratchet que `AGENTS.md` interdit explicitement
 * (« Seuil aligné d'abord, blocage ensuite »). Le seul défaut de ce parcours
 * dans ce cas est celui de `NEXT_PUBLIC_APP_URL`, ci-dessous : il est MESURÉ,
 * ANNOTÉ et ATTACHÉ, mais il n'est pas gaté ici.
 *
 * ## ⚠️ CONSTAT OUVERT — `NEXT_PUBLIC_APP_URL` n'est écrite NULLE PART
 *
 * `route.ts:44` et `portail.ts:558` construisent leurs URL sur
 * `process.env["NEXT_PUBLIC_APP_URL"] ?? "https://axion-ia.com"`. Mesuré le
 * 2026-08-23 : la variable a QUATRE occurrences dans le dépôt et les quatre sont
 * LECTRICES (`route.ts:44`, `portail.ts:558`, `features/payment/actions.ts:151`,
 * plus une reprise documentaire dans `_LMS-ELEARNING/`). Aucun fichier SUIVI ne
 * la pose : ni `.env.example`, ni `.env.dev.example`, ni `.env.ci.example`, ni
 * `.github/workflows/ci.yml`.
 *
 * ⚠️ ET C'EST CE QUI REND LE DÉFAUT DIFFICILE À VOIR. Sur un poste de
 * développement, `.env.local` — gitignoré, donc invisible à toute relecture du
 * dépôt — la pose bel et bien : les deux origines coïncident, et l'annotation
 * `constat-ouvert` ci-dessous NE PART JAMAIS. En CI, où aucun fichier ne la
 * pose, le repli `https://axion-ia.com` est CERTAIN et l'annotation part à
 * chaque exécution. Autrement dit : le seul environnement où l'on regarde est
 * le seul où le symptôme est absent. En recette, l'assistante transmet donc au
 * stagiaire un lien qui ouvre l'espace d'un AUTRE environnement : c'est un
 * défaut de PRODUIT avant d'être un défaut de harnais.
 *
 * Ce que ce fichier en fait, faute de pouvoir le gater sans bloquer le dépôt :
 *
 *   · il tolère EXACTEMENT deux origines — celle qui est mesurée, et le repli de
 *     production littéral. Une TROISIÈME valeur rougit : c'est le jour où
 *     quelqu'un aura posé la variable à la mauvaise valeur ;
 *   · quand c'est le repli, il pousse une ANNOTATION nommée dans le rapport et
 *     joint la valeur lue. Le constat reste visible, il ne devient pas muet ;
 *   · il n'utilise JAMAIS l'origine du lien pour naviguer. Le parcours rejoue le
 *     CHEMIN contre l'instance mesurée. Un parcours qui suivrait l'origine
 *     émise mesurerait la production.
 *
 * ⛔ À faire quand la variable sera posée dans Gate B : retirer
 * `REPLI_PRODUCTION` de `ORIGINES_ADMISES` et rendre l'égalité stricte. Tant que
 * les deux valeurs sont admises, cette garde ne prouve pas que le lien pointe au
 * bon endroit — elle prouve seulement qu'il ne pointe pas vers un troisième.
 *
 * ## ⚠️ DÉPEND DU SOCLE `_communs.ts`
 *
 * Ce fichier importe `CONTENU` et `STAGIAIRES_DEMO`. Mesuré le 2026-08-23 sur le
 * worktree : `tests/e2e/qualiopi/parcours/_communs.ts` n'exporte encore que
 * `Modalite`, `ENREGISTREMENT`, `admin`, `horodatage`, `champEtiquete`,
 * `creerSession`, `ouvrirSessionDemo`. Le socle étendu doit atterrir AVANT ce
 * fichier, sans quoi c'est TOUTE la suite e2e qui tombe au typecheck (TS2305),
 * pas seulement ce parcours.
 *
 * ## Comment le jouer
 *
 *     pnpm qualiopi:seed-demo
 *     npx playwright test tests/e2e/qualiopi/parcours/06-stagiaire-mobile.spec.ts \
 *       --project=chromium --workers=1
 */

import { test, expect, type Page, type Request, type TestInfo } from "@playwright/test";
import { loginAsAdmin } from "../../fixtures/admin-auth";
// SSOT du nom de cookie, IMPORTÉE plutôt que recopiée. Ce module est pur et
// Edge-safe (ni `next/headers`, ni Prisma) : c'est exactement pour ça qu'il vit
// sous `src/server/portail/` et non sous `src/server/qualiopi/portail/`.
// 🔑 Un prédicat recopié diverge toujours, et celui-là a un précédent écrit noir
// sur blanc dans le produit : renommer le cookie sans propager rouvrirait le
// constat X3 EN SILENCE (`src/server/qualiopi/portail/cookie.ts:15-19`).
import { PORTAIL_COOKIE_NAME } from "../../../../src/server/portail/routes";
import { ouvrirSessionDemo, ENREGISTREMENT, STAGIAIRES_DEMO, CONTENU } from "./_communs";

/** Pixel 7 est déjà un projet Playwright ; ici on veut le pire cas courant. */
const TELEPHONE = { width: 360, height: 740 };

/**
 * Le repli littéral de `route.ts:44` et `portail.ts:558`.
 *
 * Écrit ici en toutes lettres, et pas déduit : c'est la valeur qui trahit
 * l'absence de `NEXT_PUBLIC_APP_URL`, et la reconnaître est tout l'intérêt de la
 * garde. La déduire d'une variable d'environnement reviendrait à comparer une
 * hypothèse à elle-même — et c'est précisément une variable absente qui est en
 * cause.
 */
const REPLI_PRODUCTION = "https://axion-ia.com";

/**
 * Le stagiaire dont on suit le parcours : celui qui PORTE l'attestation.
 *
 * `demo.ts:788-793` déclare l'attestation avec `stagiaireIndex: 0` (:790), et
 * l'upsert `demo.ts:1459-1475` l'écrit avec
 * `traineeId: traineeIds[data.attestation.stagiaireIndex]` (:1467). Le
 * rattachement à l'inscription, lui, est en dur sur `enrollmentIds[0]` (:1479),
 * `attestationDocumentId` (:1481). L'index 0 — Marie Martin — est donc le seul
 * des deux stagiaires de démonstration dont l'espace ait quoi que ce soit à
 * montrer sous « Mes documents » : prendre Thomas Dubois afficherait « Aucun
 * document disponible » et le parcours perdrait toute sa moitié aval.
 *
 * 🔴 Le renvoi d'une version précédente disait `demo.ts:352`. C'est la ligne de
 * la CONSTANTE `ATTESTATION` (le numéro), pas celle du rattachement au
 * stagiaire : elle envoyait chercher au mauvais endroit qui voulait vérifier à
 * qui la pièce appartient.
 *
 * 🔴 Un second renvoi disait `traineeId: traineeIds[0]`. Ce littéral N'EXISTE
 * PAS dans ce bloc : un `grep` dessus ne trouve rien, et le lecteur conclurait
 * que le seed est écrit autrement qu'il ne l'est.
 */
const STAGIAIRE = STAGIAIRES_DEMO[0];

/** Prénom seul — c'est lui, et pas le nom complet, que porte le titre de l'espace. */
const PRENOM = STAGIAIRE.nom.split(" ")[0] ?? STAGIAIRE.nom;

/** L'attestation du dossier de démonstration (`demo.ts:352`, constante `ATTESTATION`). */
const NUMERO_ATTESTATION = "AXI-ATT-DEMO-001";

/**
 * Le nom accessible des DEUX barres de navigation de l'espace.
 *
 * `EspaceShell.tsx` compose `` `Navigation — ${titreEspace}` `` et
 * `_coquille.tsx:85` passe `titreEspace="Mon espace"`. Le tiret est un CADRATIN
 * (U+2014) entouré d'espaces : un demi-cadratin U+2013 ou un tiret d'union ne
 * matcherait rien, et l'échec accuserait le produit. Même vigilance sur le « À »
 * U+00C0 d'`ONGLETS[0]` (`_coquille.tsx:41`).
 *
 * 🔴 TROIS éléments portent cette étiquette, pas un :
 *   · `<aside aria-label>` (EspaceShell.tsx:131-134) — `hidden … lg:flex` (:132) ;
 *   · le `<nav>` de la barre latérale (:154-157) — DANS cet aside ;
 *   · le `<nav>` de la barre d'onglets du bas (:285-288) — `lg:hidden` (:286).
 *
 * 🔑 On vise donc par RÔLE, jamais par `getByLabel`. Deux raisons, toutes deux
 * mesurées : (1) l'`<aside>` a le rôle `complementary` — il porte un nom
 * accessible, donc HTML-AAM le lui donne quel que soit son parent — et le rôle
 * l'écarte d'une recherche de `navigation` ; (2) le sélecteur de rôle de
 * Playwright ignore ce qui est masqué pour l'accessibilité (`queryRole` →
 * `isElementHiddenForAria`, playwright-core 1.62.1), donc à 360 px le `<nav>` de
 * la barre latérale, pris dans un ancêtre `display:none`, ne matche pas. Il en
 * reste EXACTEMENT un.
 *
 * `getByLabel` n'offre aucune de ces deux protections : il en aurait pris trois,
 * et le test serait tombé sur « strict mode violation » — un message qui n'aurait
 * rien dit du produit. C'est la cinquième fois que ce dépôt croise cette famille
 * (un `nav[aria-label]` posé sur un `aside`, un `[href$=""]` que la spec CSS
 * interdit de matcher, un `data-testid` absent, une union qui prenait le premier
 * du DOM).
 */
const NAV_ESPACE = "Navigation — Mon espace";

/**
 * Les quatre onglets du bas, DANS L'ORDRE de `construireNavigation`
 * (_coquille.tsx:35-67). C'est le `labelCourt` qui s'affiche en bas
 * (EspaceShell.tsx:321), pas le `label` de la barre latérale : « Formations »
 * et non « Mes formations ». Seule l'entrée « À faire » n'a pas de `labelCourt`
 * (:41) — c'est son `label` qui s'affiche.
 */
const ONGLETS = ["À faire", "Formations", "Documents", "Compte"] as const;

/**
 * Hauteur minimale d'une cible tactile, en px CSS.
 *
 * ⚠️ Ce n'est PAS le plancher WCAG 2.2 (SC 2.5.8 « Target Size (Minimum) » exige
 * 24 px). C'est la cible interne, alignée sur les 44 pt d'Apple HIG et les 48 dp
 * de Material : cette barre est manipulée au pouce, d'une main, debout. Mesure
 * attendue à ce jour d'environ 56 px (`py-2.5` = 20, icône `size-5` = 20,
 * `gap-1` = 4, libellé `text-xs leading-none` = 12 — le `<Link>` de la barre du
 * bas court de EspaceShell.tsx:293 à :322, `leading-none` étant en :321). La
 * marge est donc réelle : le seuil n'a pas été ajusté sur la valeur observée.
 */
const CIBLE_TACTILE_MIN_PX = 44;

/**
 * Mesure le débordement horizontal du document et NOMME les coupables.
 *
 * ⚠️ CE QUE CET INSTRUMENT NE VOIT PAS, et il faut le savoir avant de lire son
 * verdict : un débordement vers la GAUCHE n'allonge pas `scrollWidth`. Le dépôt
 * l'a déjà payé — une sonde bâtie sur la seule largeur accusait les pots de miel
 * anti-spam posés à `left:-9999px` et enterrait les vrais coupables sous 10 000 px
 * de faux positif. On mesure donc le bord DROIT, celui qui produit la barre de
 * défilement horizontale qu'un stagiaire subit réellement, et on l'assume au lieu
 * de laisser croire à une couverture totale.
 *
 * ⚠️ SECONDE LIMITE, ET ELLE EST DANS LE MESSAGE. L'assertion porte sur
 * `scrollWidth` ; la liste `debordants` est produite par un filtre DIFFÉRENT —
 * elle écarte tout élément qu'un ancêtre découpe, et tout élément qui ne dépasse
 * pas SON PROPRE parent. Les deux peuvent donc diverger : `coupables: []` sur un
 * débordement bien réel. Un premier jet promettait « NOMMER les coupables » sans
 * le dire ; le message ci-dessous nomme désormais ce silence-là aussi.
 *
 * Extrait en helper parce que les DEUX écrans du parcours doivent être mesurés :
 * une copie dans chacun divergerait, et l'une des deux serait fausse en silence.
 */
async function mesurerDebordement(page: Page, ecran: string, info: TestInfo): Promise<void> {
  const mesure = await page.evaluate(() => {
    const r = document.documentElement;
    const limite = r.clientWidth + 1;
    const debordants: string[] = [];
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      if (b.right <= limite) continue;
      // Ce qu'un ancêtre découpe ne pousse pas la page.
      let p = el.parentElement;
      let decoupe = false;
      while (p !== null && p !== r) {
        const ox = getComputedStyle(p).overflowX;
        if (ox === "hidden" || ox === "clip" || ox === "auto" || ox === "scroll") {
          decoupe = true;
          break;
        }
        p = p.parentElement;
      }
      if (decoupe) continue;
      const pb = el.parentElement?.getBoundingClientRect();
      if (pb === undefined || b.right - pb.right <= 1) continue;
      debordants.push(
        `${el.tagName.toLowerCase()}.${String((el as HTMLElement).className || "").slice(0, 60)} ` +
          `dépasse de ${Math.round(b.right - pb.right)} px`,
      );
    }
    return {
      scrollWidth: r.scrollWidth,
      clientWidth: r.clientWidth,
      debordants: debordants.slice(0, 5),
    };
  });

  await info.attach(`debordement-${ecran}-360.json`, {
    body: JSON.stringify(mesure, null, 2),
    contentType: "application/json",
  });

  const silence =
    mesure.debordants.length === 0
      ? " — liste VIDE, et ce n'est pas une contradiction : aucun élément NON DÉCOUPÉ " +
        "ne dépasse son propre parent. Chercher alors un `100vw` (la barre de défilement " +
        "verticale classique du Chromium headless ampute `clientWidth` d'une quinzaine de " +
        "pixels, et `100vw` ne le sait pas), ou un ancêtre défilant qui pousse la racine."
      : "";

  expect(
    mesure.scrollWidth,
    `l'écran « ${ecran} » du portail stagiaire déborde à 360 px ` +
      `(${mesure.scrollWidth} px de contenu pour ${mesure.clientWidth} px de fenêtre) — ` +
      `coupables : ${JSON.stringify(mesure.debordants)}${silence}`,
  ).toBeLessThanOrEqual(mesure.clientWidth + 1);
}

test.use(ENREGISTREMENT);

test.describe("@parcours-qualiopi 6 — le stagiaire sur téléphone", () => {
  // Budget STRICTEMENT supérieur à 180 000 ms, le plus long délai vivant dans
  // `loginAsAdmin` (admin-auth.ts:141, branche hors CI) et dans `_communs.ts`.
  // Un budget inférieur ou égal rendrait ces messages-là inatteignables : c'est
  // le budget qui trancherait, avec son texte générique — cf. le cliquet
  // `tests/unit/e2e-harness/delai-interne-sous-le-budget.spec.ts`, qui lit AUSSI
  // les aides importées, et le plancher de 90 000 ms de
  // `tests/unit/e2e-harness/budget-des-specs-admin.spec.ts`.
  //
  // ⚠️ CE COMMENTAIRE EST LU PAR LE CLIQUET. `delaiMaximal` (:74-87) ne retire
  // pas les commentaires — contrairement au test `networkidle` de la même suite,
  // qui le fait à :148-154 après s'être trouvé lui-même. Ne jamais recopier ici
  // un littéral de délai, ni une paire de nombres séparés par « ? » et « : » :
  // le cliquet la compterait comme un délai interne et rougirait sur sa propre
  // documentation. Les valeurs s'écrivent en clair, jamais en littéraux.
  //
  // `mode: "serial"` n'est PAS cosmétique ici malgré le test unique : il fixe le
  // contrat du jour où un second test s'ajoutera. Sept parcours qui ouvrent sept
  // sessions admin en parallèle dépassent tous la connexion (cf. l'en-tête de
  // `_communs.ts`).
  // 🔴 2026-08-23 — 300 s était ÉGAL au plus grand délai interne atteignable :
  // `ARRIVEE_ECRAN` de `_communs.ts` vaut 300 s hors CI. Un délai égal à son
  // budget ne peut jamais expirer, et c'est le budget — muet — qui rend le
  // verdict. Le cliquet ne le voyait pas : il cherchait `_communs.ts` au mauvais
  // chemin et se taisait sur l'absence (cf. `delai-interne-sous-le-budget.spec.ts`).
  test.describe.configure({ mode: "serial", timeout: 600_000 });

  test("du lien d'accès à l'attestation, sur un écran de 360 px", async ({ page }, info) => {
    // Dispense assumée, sans zone d'ombre : la CI ne lance QUE chromium
    // (`ci.yml:519` passe `--project=chromium --grep-invert "@baseline"`, et
    // `:299` n'installe que ce navigateur). Ce `skip` ne peut donc pas se
    // déclencher là où il masquerait quelque chose ; il n'existe que pour le run
    // local « tous projets ».
    //
    // 🔴 Le renvoi précédent disait `ci.yml:503`. Cette ligne-là est un
    // COMMENTAIRE qui cite une AUTRE commande (`--grep "@baseline"`, la suite
    // opt-in) : il envoyait lire l'exact contraire de ce qu'il prétendait montrer.
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");
    await loginAsAdmin(page);

    // L'origine réellement servie, LUE et non supposée.
    const ORIGINE = new URL(page.url()).origin;

    /**
     * Les deux seules origines qu'une URL émise par le produit peut porter
     * aujourd'hui. Voir le constat `NEXT_PUBLIC_APP_URL` en tête de fichier :
     * tant que la variable n'est posée nulle part, le repli de production est
     * une valeur ATTENDUE, et la gater bloquerait 100 % des PR.
     */
    const ORIGINES_ADMISES = [ORIGINE, REPLI_PRODUCTION];

    /** Vérifie l'origine d'une URL émise par le produit, et NOMME le constat. */
    const controlerOrigine = (url: string, quoi: string): void => {
      const origine = new URL(url).origin;
      expect(
        ORIGINES_ADMISES,
        `${quoi} porte l'origine ${origine}, qui n'est ni l'instance mesurée (${ORIGINE}) ` +
          `ni le repli littéral de route.ts:44 / portail.ts:558 (${REPLI_PRODUCTION}). ` +
          "Une TROISIÈME valeur ne peut venir que d'un `NEXT_PUBLIC_APP_URL` posé à la " +
          "mauvaise adresse : le stagiaire recevrait un lien vers un environnement tiers.",
      ).toContain(origine);
      if (origine !== ORIGINE) {
        info.annotations.push({
          type: "constat-ouvert",
          description:
            `${quoi} pointe sur ${origine} au lieu de ${ORIGINE} : \`NEXT_PUBLIC_APP_URL\` ` +
            "n'est posée nulle part dans le dépôt (quatre occurrences, toutes lectrices). " +
            "NON GATÉ ICI — voir l'en-tête du fichier. À poser dans Gate B, puis rendre " +
            "l'égalité stricte.",
        });
      }
    };

    const idSession = await ouvrirSessionDemo(page);
    expect(
      idSession,
      "session de démonstration `AXI-SES-DEMO-001` introuvable — jouer " +
        "`pnpm qualiopi:seed-demo`. Sans elle, il n'existe aucun stagiaire inscrit " +
        "portant une attestation, et ce parcours n'a rien à parcourir.",
    ).not.toBeNull();

    // 🔴 2026-08-21 — `waitForLoadState("networkidle")` NE REVENAIT JAMAIS ICI.
    //
    // Sans délai explicite, l'attente hérite du budget du test : elle l'a donc
    // consommé en entier, puis rendu « Test timeout exceeded » — un message qui
    // ne nomme rien. La fiche de session admin ne devient jamais silencieuse
    // côté réseau (revalidations, compteurs), et c'est normal.
    //
    // 🔑 On attend un CONTENU, pas un état de réseau. Le bouton porte sa propre
    // attente, et son absence dit quelque chose d'utile ; le silence du réseau
    // ne dit rien du tout.
    //
    // (Ce cas a fait jurisprudence : un cliquet interdit désormais
    // `waitForLoadState("networkidle")` sans délai dans tout `tests/e2e/`, et il
    // cite CE fichier dans son en-tête.)

    // ── Côté organisme : produire le lien, comme le ferait l'assistante ──────
    //
    // 🔴 NE PAS épingler la ligne par le TEXTE du nom. « Marie Martin » apparaît
    // dans au moins TROIS `<tr>` de cette fiche : sa ligne d'inscription
    // (EnrollmentsSection.tsx:193, nom en :196-198) et ses deux lignes de
    // questionnaire (QuestionnairesSection.tsx:431, nom en :435, alimentées par
    // sessions/[id]/page.tsx:1041). Un `filter({ hasText })` en prendrait trois,
    // et le premier `.click()` tomberait sur une violation de mode strict — un
    // rouge qui accuse le harnais au lieu du produit.
    //
    // 🔑 On ancre sur le seul identifiant unique de la ligne : l'`aria-label` du
    // sélecteur d'état, `Statut de {prénom} {nom}` (EnrollmentsSection.tsx:210).
    // `exact: true` parce que `getByLabel` fait sinon une correspondance par
    // SOUS-CHAÎNE : un homonyme au nom plus long y passerait.
    const selecteurStatut = page.getByLabel(`Statut de ${STAGIAIRE.nom}`, { exact: true });
    const ligne = page.locator("tr").filter({ has: selecteurStatut });

    try {
      await expect(ligne).toHaveCount(1, { timeout: 90_000 });
    } catch (cause) {
      // 🔴 `main` N'EST PLUS UN REPÈRE DANS LA CONSOLE, et `body` ne l'a jamais
      // été : le rail de navigation pèse à lui seul plus de deux mille caractères
      // de libellés, si bien qu'un diagnostic bâti dessus NOIE la cause au lieu
      // de la nommer. Le repère de la zone de contenu est tranché une fois pour
      // toutes dans `CONTENU` (_communs.ts) — on ne le réécrit pas ici.
      const visible = await page
        .locator(CONTENU)
        .innerText()
        .catch(() => "(texte illisible)");
      throw new Error(
        `aucune ligne d'inscription unique pour ${STAGIAIRE.nom} sur la fiche de session ` +
          `${idSession ?? "(id inconnu)"}. Trois causes possibles, et le texte ci-dessous ` +
          "permet de les distinguer : (1) le seed n'a pas inscrit ce stagiaire à " +
          "`AXI-SES-DEMO-001` ; (2) la fiche est rendue en flux et la section " +
          "des stagiaires n'était pas encore arrivée ; (3) deux inscriptions portent le " +
          `même nom. Écran : ${visible.replace(/\s+/g, " ").slice(0, 600)}`,
        { cause },
      );
    }

    const bouton = ligne.getByRole("button", { name: "Générer un accès portail" });
    await expect(
      bouton,
      `aucun bouton de génération d'accès portail dans la ligne de ${STAGIAIRE.nom} — ` +
        "le stagiaire n'a alors AUCUN moyen d'atteindre son espace " +
        "(EnrollmentsSection.tsx:288-291)",
    ).toBeVisible({ timeout: 60_000 });
    await bouton.click();

    // 🔴 2026-08-22 — L'UNION PRENAIT LE PREMIER DANS L'ORDRE DU DOM.
    //
    // `code, a[href*='/portail/']` ne classe pas par pertinence : il prend le
    // premier des deux qui apparaît. Or `PreparationKitSession` est rendu AVANT
    // `EnrollmentsSection` (sessions/[id]/page.tsx:798 vs :850) et affiche
    // `<code>pnpm tsx scripts/kit-formateur/publier-vers-r2.ts</code>` quand le
    // kit est absent. `toBeVisible()` passait donc sur CE bloc, et l'échec
    // tombait deux lignes plus bas en accusant la génération d'accès.
    //
    // 🔑 C'est le CONTENU qui identifie la cible, pas la balise. Le lien généré
    // est affiché en `<code>{result.url}</code>` (GenererPortailAccesButton.tsx:114) ;
    // la branche `a[href]` n'est qu'un repli théorique.
    //
    // ── Ajout du 2026-08-23, EN DESSOUS et sans toucher au bloc ci-dessus ────
    //
    // 🔑 Le correctif de FOND va plus loin que la ligne : on se scope au BLOC DU
    // COMPOSANT, pas au `<tr>`. Le `<tr>` contient TROIS autres `[role="alert"]`
    // qui n'ont rien à voir avec la génération d'accès — `statutError` (:221),
    // `adaptError` (:276) et `revokeError` (:318) — et un sondage bâti sur la
    // ligne annoncerait « REFUS: … » en attribuant à la génération le refus d'une
    // AUTRE action. `blocAcces` est la racine du composant
    // (GenererPortailAccesButton.tsx:86) : le `<code>` du kit formateur, qui vit
    // hors du tableau, et les trois alertes voisines en sont exclus par
    // construction, quel que soit l'ordre du DOM.
    //
    // ⚠️ Le locator passé à `has:` est construit sur `page`, PAS sur `ligne` :
    // Playwright réutilise son sélecteur tel quel et l'évalue RELATIVEMENT au
    // candidat. Un sélecteur qui commencerait par `tr` ne matcherait alors rien
    // sous un `<div>`, et le filtre rendrait zéro élément en silence.
    const blocAcces = ligne
      .locator("div")
      .filter({ has: page.getByRole("button", { name: "Générer un accès portail" }) })
      .last();
    const zoneLien = blocAcces.locator("code");

    /**
     * Valeur sondée : soit le lien affiché, soit le refus de l'action.
     *
     * Un message de sondage est FIGÉ ; la valeur reçue, elle, dit ce que l'écran
     * montrait vraiment. Écrire « le lien n'apparaît pas » mentirait le jour où
     * `genererPortailAccesAction` a précisément écrit pourquoi elle a refusé
     * (`[role="alert"]`, GenererPortailAccesButton.tsx:91-98).
     *
     * ⚠️ La lecture est faite en `allTextContents()`, qui ne lève pas sur zéro
     * élément : un `innerText()` sur un locator vide attendrait le délai d'action
     * de 15 s (playwright.config.ts:36) à CHAQUE itération, et le chemin nominal
     * paierait l'attente d'un cas d'erreur qui ne se produit pas.
     *
     * 🔑 La dernière valeur lue est MÉMORISÉE. Relire après le sondage, comme le
     * faisait un premier jet, peut rendre « REFUS: … » (une alerte apparue
     * entre-temps) : `new URL()` lèverait alors `TypeError: Invalid URL`, un
     * message qui ne nomme rien et qui efface le diagnostic que le sondage
     * venait d'obtenir.
     */
    let derniereValeur = "(sondage jamais exécuté)";
    const etatGeneration = async (): Promise<string> => {
      const alertes = await blocAcces
        .locator('[role="alert"]')
        .allTextContents()
        .catch(() => [] as string[]);
      if (alertes.length > 0) {
        derniereValeur = `REFUS: ${alertes.join(" · ").replace(/\s+/g, " ").trim()}`;
        return derniereValeur;
      }
      const codes = await zoneLien.allTextContents().catch(() => [] as string[]);
      derniereValeur =
        codes.length === 0
          ? "(aucun lien affiché, aucune erreur affichée)"
          : (codes[0] ?? "").replace(/\s+/g, " ").trim();
      return derniereValeur;
    };

    await expect
      .poll(etatGeneration, {
        timeout: 90_000,
        message:
          "la génération d'accès portail n'a produit aucun lien exploitable. La valeur " +
          "reçue dit laquelle des causes s'est produite : « REFUS: … » = l'action serveur " +
          "a refusé et l'a écrit dans le bloc du bouton ; « aucun lien affiché » = l'action " +
          "n'a pas abouti, ou React n'avait pas hydraté la fiche au moment du clic et le " +
          "clic n'a atteint aucun gestionnaire.",
      })
      // 64 hexadécimaux : `genererTokenPortail` vaut `randomBytes(32).toString("hex")`
      // (portail-service.ts:202-203). Un motif plus lâche — `/\/portail\//` par
      // exemple — accepterait l'URL squelette d'un lien SANS jeton, c'est-à-dire
      // exactement ce qu'on veut détecter.
      // ⚠️ ANCRÉ EN TÊTE. Sans `^https?:\/\/`, une valeur RELATIVE
      // (`/fr/portail/acces/<64hex>`) satisferait ce motif — et `new URL(lien)`,
      // quelques lignes plus bas, lèverait un `TypeError: Invalid URL` qui ne
      // nomme rien. Le lien envoyé au stagiaire DOIT être absolu : c'est tout
      // l'objet du contrôle d'origine.
      .toMatch(/^https?:\/\/[^\s]+\/portail\/acces\/[0-9a-f]{64}$/);

    const lien = derniereValeur;

    // ⚠️ ON N'ATTACHE PAS LE JETON, MÊME PARTIELLEMENT. C'est un porteur : 64
    // hexadécimaux valables 90 jours, qui ouvrent l'espace d'une personne nommée
    // et permettent de signer à sa place (cf. l'avertissement de
    // `portail/layout.tsx:25-27`). Les pièces jointes d'un rapport Playwright
    // atterrissent dans les artefacts de CI, téléchargeables par qui a accès au
    // dépôt. Le stagiaire est fictif ici — la règle, elle, ne doit pas dépendre
    // de ça.
    //
    // 🔴 Un premier jet coupait `lien.length - 52` sous le libellé « 52
    // hexadécimaux masqués » : il en laissait DOUZE en clair, dans un bloc
    // intitulé « on n'attache pas le jeton en clair ». Le jeton fait 64
    // caractères, pas 52.
    await info.attach("lien-portail.txt", {
      body: `${lien.slice(0, Math.max(0, lien.length - 64))}…(64 hexadécimaux masqués)`,
      contentType: "text/plain",
    });

    controlerOrigine(lien, "le lien d'accès transmis au stagiaire");

    // L'écran DOIT SE PRONONCER sur la transmission (GenererPortailAccesButton.tsx:102-109).
    //
    // 🔴 CE QU'ON N'ASSERTE PAS, ET POURQUOI. Un premier jet exigeait que le
    // texte soit « Lien envoyé au stagiaire par e-mail. » OU « Lien NON
    // transmis… ». C'est un ternaire EXHAUSTIF sur ces deux seules chaînes
    // (:106-108), rendu dans le MÊME bloc `{result && (…)}` (:100) que le
    // `<code>` que le sondage vient de valider : l'assertion ne pouvait JAMAIS
    // rougir, et serait restée verte sous exactement la régression qu'elle
    // prétendait garder — `envoyeAuStagiaire` reposé inconditionnellement à
    // `true`, le mensonge retiré le 2026-08-19 (portail.ts:583-594,
    // `envoyeAuStagiaire = envoi.enqueued` en :588).
    //
    // 🔑 Ce qui PEUT rougir, c'est la présence de l'annonce : si quelqu'un retire
    // le `<p role="status">` ou lui change de rôle, l'assistante n'a plus aucun
    // moyen de savoir si elle doit transmettre le lien elle-même. C'est cela
    // qu'on garde. Le texte, lui, est ATTACHÉ — pas asserté.
    //
    // ⚠️ PORTÉE EXACTE DE CETTE GARDE, pour qu'on ne la croie pas plus large
    // qu'elle n'est : le `<p role="status">` (GenererPortailAccesButton.tsx:102-109)
    // vit dans le MÊME bloc `{result && (` (:100) que le `<code>` dont le sondage
    // vient d'établir la présence. La présence du bloc étant donc déjà acquise,
    // cette assertion ne peut rougir que si quelqu'un SUPPRIME l'élément ou lui
    // change de rôle. C'est une vraie régression gardée — mais une seule.
    const annonces = await blocAcces.locator('[role="status"]').allTextContents();
    const transmission = (annonces[0] ?? "(aucune annonce de transmission affichée)")
      .replace(/\s+/g, " ")
      .trim();
    await info.attach("transmission.txt", { body: transmission, contentType: "text/plain" });
    expect(
      annonces.length,
      "le bloc de génération d'accès ne porte AUCUN `[role=\"status\"]` : l'écran ne dit " +
        "NI que le lien est parti, NI qu'il faut le transmettre à la main. L'assistante " +
        "n'a alors aucun moyen de savoir quoi faire du lien qu'elle vient de produire " +
        `(GenererPortailAccesButton.tsx:102-109). Texte lu : « ${transmission} »`,
    ).toBe(1);

    // ── La porte d'entrée : lire la 302 AVANT de la suivre ───────────────────
    //
    // 🔴 `expect(status).toBe(200)` NE DISCRIMINE RIEN. Trois issues opposées
    // rendent 200 au bout du chemin : l'espace servi, `acces-invalide` (200 lui
    // aussi), et `demander-acces` atteinte via le 307 de `src/proxy.ts`
    // (bloc 0sexies, :205, déclenché dès que le cookie manque, :231-246). Suivre
    // les redirections, c'est effacer la seule information qui les sépare.
    //
    // 🔑 `maxRedirects: 0` rend la réponse BRUTE. Vérifié dans playwright-core
    // 1.62.1 : la valeur 0 est remappée en -1 (`coreBundle.js:25805-25806`), la
    // garde de suivi teste `options.maxRedirects >= 0` (:25990) et ne s'applique
    // donc pas — la 302 est rendue telle quelle, sans lever « Max redirect count
    // exceeded ». Et `addCookies(cookies)` s'exécute AVANT ce branchement
    // (:25982-25988) : le `Set-Cookie` de la 302 est bien versé au pot de cookies
    // du contexte.
    //
    // 🔑 On rejoue le CHEMIN contre l'instance mesurée, jamais l'URL émise :
    // suivre l'origine du lien reviendrait à mesurer la production le jour où
    // `NEXT_PUBLIC_APP_URL` manque, c'est-à-dire aujourd'hui.
    const chemin = new URL(lien).pathname;
    const reponse = await page.request.get(`${ORIGINE}${chemin}`, {
      maxRedirects: 0,
      timeout: 60_000,
    });

    expect(
      reponse.status(),
      `le lien d'accès rend ${reponse.status()} au lieu d'une 302. Une 200 signifierait ` +
        "qu'on a atterri sur un écran rendu en place au lieu d'être redirigé ; un 5xx, que " +
        "`verifierToken` a levé (portail-service.ts:308).",
    ).toBe(302);

    const destination = reponse.headers()["location"] ?? "";
    expect(
      destination,
      "la 302 du lien d'accès ne porte pas d'en-tête `Location` — le navigateur du " +
        "stagiaire n'irait donc nulle part (route.ts:68-70)",
    ).not.toBe("");
    controlerOrigine(destination, "la redirection émise par le lien d'accès");
    expect(
      new URL(destination).pathname,
      `le lien d'accès redirige vers « ${destination} » au lieu de l'espace stagiaire. ` +
        "`…/portail/acces-invalide` couvre DEUX causes que la route ne distingue pas à " +
        "l'écran : jeton refusé par `verifierToken` — invalide, expiré ou révoqué " +
        "(route.ts:59-62) — ou limitation de débit atteinte, 10 tentatives / 60 s par IP " +
        "(route.ts:48-54).",
    ).toBe("/fr/portail/mon-espace");

    // 🔴 LE COOKIE EST POSÉ AVEC `secure: true`, SANS CONDITION (cookie.ts:30-36).
    //
    // Sur `http://localhost` cela fonctionne — les navigateurs traitent localhost
    // comme une origine sûre, et 127.0.0.1 aussi — mais sur toute AUTRE origine
    // en clair, le cookie serait rejeté. Et le rejet est doublement muet :
    // Playwright avale l'échec cookie par cookie
    // (`addCookies([c]).catch(() => {})`, coreBundle.js:25986-25987).
    //
    // 🔑 Sans cette vérification, la panne ne se manifesterait que plus bas, sous
    // la forme d'un 307 vers `demander-acces` — c'est-à-dire en accusant le jeton
    // alors que le jeton est bon. Un délai, ou un statut, ne dit jamais POURQUOI.
    //
    // ⚠️ ON LIT LE POT COMPLET, SANS FILTRER PAR URL. `context.cookies(url)`
    // passe par `filterCookies` (playwright-core 1.62.1, coreBundle.js:13045-13065),
    // qui ÉCARTE tout cookie `secure` dès que l'origine n'est ni `https:` ni
    // reconnue par `isLocalHostname` — et `isLocalHostname` (:13066-13068) ne
    // connaît QUE `localhost` et `*.localhost`. Avec un `E2E_BASE_URL` en
    // `http://127.0.0.1:3000` — une origine que Chromium juge sûre et pour
    // laquelle il stocke bel et bien le cookie — la liste reviendrait VIDE et
    // l'échec accuserait le produit pour un filtre de l'outil de mesure.
    const cookies = await page.context().cookies();
    // 🔴 ON ASSERTE `nom@domaine`, PAS LE NOM SEUL. Le pot est lu sans filtre
    // d'URL (choix justifié plus haut), et un `portail_session` posé sur
    // N'IMPORTE QUEL domaine satisferait un `toContain(nom)`. Or `route.ts:44`
    // retombe aujourd'hui sur `https://axion-ia.com` : le jour où une navigation
    // atteindrait la production, un cookie de production rendrait cette garde
    // verte alors que l'instance MESURÉE n'en a aucun. Un repère qui englobe ce
    // qu'il devrait exclure — la famille que ce parcours combat.
    const hote = new URL(ORIGINE).hostname;
    expect(
      cookies.map((c) => `${c.name}@${c.domain}`),
      `le cookie « ${PORTAIL_COOKIE_NAME} » n'a pas été enregistré par le navigateur. ` +
        "Il est posé avec `secure: true` sans condition (cookie.ts:32) : sur une origine " +
        "en clair qui n'est ni `localhost` ni une adresse de bouclage, il est rejeté sans " +
        "un mot. Sans lui, la garde Edge de `src/proxy.ts` (bloc 0sexies, :205) répondra " +
        "307 vers `/fr/portail/demander-acces` et l'espace restera fermé. Cookies vus : " +
        `${JSON.stringify(cookies.map((c) => `${c.name}@${c.domain}`))}`,
    ).toContain(`${PORTAIL_COOKIE_NAME}@${hote}`);

    // ── Côté stagiaire : ce qui sort de l'instance mesurée ───────────────────
    //
    /**
     * Garde de fuite : rien de ce portail ne doit sortir de l'instance mesurée.
     * Le jeton vit dans le chemin, reste valable jusqu'à la fin de session + 48 h
     * et n'est pas à usage unique : qui lit l'URL peut signer à la place du
     * stagiaire (`portail/layout.tsx:25-27`).
     *
     * 🔑 On ÉCOUTE, on ne COUPE pas. Un premier jet interceptait tout par
     * `page.route("**\/*")` et abandonnait les requêtes sortantes. Deux raisons de
     * ne plus le faire, et la seconde est décisive :
     *   · couper CHANGE le comportement mesuré : une navigation coupée rend
     *     `net::ERR_FAILED`, un message qui n'apprend rien, et le diagnostic
     *     écrit au-dessus accusait alors systématiquement la fuite — y compris
     *     quand la liste des fuites était vide et la cause tout autre ;
     *   · depuis le 2026-08-23 ce fichier est une GATE BLOQUANTE (ci.yml:479).
     *     Un instrument qui casse la page qu'il mesure ferait rougir 100 % des
     *     PR pour une raison étrangère au produit.
     * Écouter DÉTECTE et NOMME la fuite ; l'EMPÊCHER est le travail du produit,
     * et il est fait ailleurs (`src/lib/analytics/routes-privees.ts`,
     * `urlPorteUnSecret`, appelée par les six composants qui reçoivent l'URL).
     *
     * 🔑 `vues` est le CONTRE-TÉMOIN de `fuites` : une liste de fuites vide ne
     * prouve rien si le collecteur n'a jamais été appelé. On exige donc qu'il ait
     * vu passer du trafic AVANT de tirer la moindre conclusion de son silence.
     */
    const fuites: string[] = [];
    let vues = 0;
    const collecteur = (requete: Request): void => {
      vues += 1;
      const url = requete.url();
      if (url.startsWith(ORIGINE) || /^(?:data|blob|about):/.test(url)) return;
      fuites.push(`${requete.method()} ${requete.resourceType()} ${url}`);
    };
    page.on("request", collecteur);

    /**
     * Navigue en nommant la cause plausible, sans en inventer une.
     *
     * 🔴 Le message de ce `catch` accusait autrefois la garde de fuite en toutes
     * circonstances (« Requêtes COUPÉES parce qu'elles sortaient de … »). Toute
     * autre cause — compilation à la demande sous `next dev`, 500 serveur,
     * navigation abandonnée — produisait ce texte avec une liste VIDE : le
     * lecteur était envoyé vers un vide. Il branche désormais sur ce qui a
     * réellement été observé.
     *
     * ⚠️ Délai explicite : `navigationTimeout` vaut 30 s (playwright.config.ts:37)
     * et sous `next dev` la première ouverture du portail compile la route à la
     * demande. 90 s laissent la marge, tout en restant sous le budget de la suite
     * — donc le message ci-dessous reste ATTEIGNABLE.
     */
    const ouvrir = async (url: string, quoi: string): Promise<void> => {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
      } catch (cause) {
        throw new Error(
          `impossible d'ouvrir ${quoi} (${url}). ` +
            (fuites.length > 0
              ? `Requêtes sortant de ${ORIGINE}, à examiner en premier : ${JSON.stringify(fuites)}`
              : "AUCUNE requête n'est sortie de l'instance mesurée : la cause est ailleurs — " +
                "compilation à la demande sous `next dev`, 500 serveur, ou navigation " +
                `abandonnée. Requêtes vues : ${vues}.`),
          { cause },
        );
      }
    };

    await ouvrir(`${ORIGINE}/fr/portail/mon-espace`, "l'espace stagiaire");

    // 🔑 La garde de fuite se lit IMMÉDIATEMENT, avant toute assertion de
    // contenu. Placée après, l'espace serait déjà servi grâce au cookie, les
    // assertions de contenu passeraient, et l'échec tomberait trop tard — en
    // accusant le dernier geste au lieu de la première fuite.
    expect(
      vues,
      "le collecteur d'événements `request` n'a vu passer AUCUNE requête : la liste des " +
        "fuites est donc vide pour une raison étrangère au produit, et l'assertion " +
        "suivante ne garderait rien",
    ).toBeGreaterThan(0);
    expect(
      fuites,
      `des requêtes du portail stagiaire sortent de ${ORIGINE}. Sur un espace privé dont le ` +
        "jeton vit dans le chemin, toute sortie est un secret qui voyage — c'est la garde " +
        "que `src/lib/analytics/routes-privees.ts` porte côté produit, et qui doit rester " +
        "vraie pour TOUT nouveau tiers. ⚠️ AVANT d'accuser le portail : le `<Header />` et " +
        "le `<Footer />` PUBLICS sont bel et bien rendus ici — un layout imbriqué s'AJOUTE " +
        "au layout racine, il ne le remplace pas (`[locale]/layout.tsx:369` et `:377` ; " +
        "`portail/layout.tsx` n'est qu'un `<div>`, et son propre en-tête documente ce " +
        "faux). Une police ou une image tierce ajoutée au header public sortirait ici sans " +
        "que le portail y soit pour rien : lire l'URL listée avant de conclure.",
    ).toEqual([]);

    // 🔴 `texte.length > 80` NE GARDAIT RIEN. Le refus d'accès de
    // `_coquille.tsx:111-118` pèse plus de cent caractères, l'écran
    // `acces-invalide` davantage, et le formulaire public de demande d'accès bien
    // plus encore : les TROIS franchissaient le seuil. Un lien mort passait donc
    // pour un succès.
    //
    // 🔑 On exige la forme NOMMÉE : le chemin d'arrivée, puis le titre de niveau 1
    // qui porte le PRÉNOM du stagiaire (`Bonjour {prenom}`, mon-espace/page.tsx:62-63).
    // Aucun des trois écrans de refus ne peut le produire — le prénom n'y figure
    // pas, et pour cause : ils sont rendus avant toute identification.
    expect(
      new URL(page.url()).pathname,
      `on n'est pas dans l'espace stagiaire — URL : ${page.url()}. ` +
        "`/fr/portail/demander-acces` = la garde Edge de `src/proxy.ts` n'a pas vu le " +
        "cookie ; `/fr/portail/acces-invalide` = le jeton a été refusé.",
    ).toBe("/fr/portail/mon-espace");

    await expect(
      // Forme NOMMÉE, et jamais `getByRole("heading", { level: 1 })` seul : le
      // layout du portail s'AJOUTE au layout racine, il ne le remplace pas
      // (portail/layout.tsx:37-43, et son en-tête :4-27 documente le faux qui
      // affirmait le contraire). L'en-tête public est donc bien là, et un `h1`
      // non scopé risquerait une violation de mode strict.
      page.getByRole("heading", { level: 1, name: `Bonjour ${PRENOM}` }),
      `l'espace servi n'est pas celui de ${STAGIAIRE.nom} : le titre « Bonjour ${PRENOM} » ` +
        "(mon-espace/page.tsx:62-63) est absent. Soit la page a rendu un refus " +
        "(`_coquille.tsx:104-118`), soit le jeton a ouvert l'espace de quelqu'un d'autre.",
    ).toBeVisible({ timeout: 60_000 });

    // ── LA BASCULE, MESURÉE DANS LES DEUX SENS ──────────────────────────────
    //
    // 🔑 Une assertion NÉGATIVE seule est satisfaite par un DOM vide : « la barre
    // latérale a disparu » est vrai d'une page blanche. Le dépôt a déjà payé un
    // témoin négatif invalide. On observe donc le MÊME sélecteur passer de 1 à 0
    // dans la MÊME exécution, en ne changeant QUE la largeur de la fenêtre.
    //
    // ⚠️ Pourquoi la largeur suffit : `hidden … lg:flex` et `lg:hidden` sont des
    // requêtes de média CSS pures. ⚠️ `lg` vaut **992 px** dans ce projet
    // (`--breakpoint-lg`, globals.css:254, bloc `@theme` :228-255), et NON les
    // 1 024 px du défaut Tailwind : le raisonnement tient dans les deux cas
    // (1 280 ≥ 992 et 360 < 992) mais la valeur écrite doit être la vraie.
    // Redimensionner suffit à les
    // réévaluer — aucun rechargement, donc aucune perte du cookie ni de l'état.
    //
    // ⚠️ CE QUE `setViewportSize` NE FAIT PAS : il ne change que la LARGEUR. Ni
    // `hasTouch`, ni `isMobile`, ni l'agent utilisateur ne bougent. Ce parcours
    // mesure donc des requêtes de média DE LARGEUR — ce qu'il annonce, et rien de
    // plus. Aucune de ses assertions ne repose sur `pointer: coarse` ; le jour où
    // l'une le ferait, il faudrait un projet `mobile-chrome`, pas un
    // redimensionnement.
    //
    // ⚠️ Pourquoi PAS un compte de `navigation` : les DEUX barres portent la même
    // étiquette, et il en reste toujours exactement une de visible. Le compte de
    // `navigation` vaut 1 des deux côtés — il ne distingue rien. C'est le
    // `complementary` (l'`<aside>`, EspaceShell.tsx:131-134) qui bascule.
    const barreLaterale = page.getByRole("complementary", { name: NAV_ESPACE });
    await expect(
      barreLaterale,
      "à la largeur de bureau — la fenêtre n'a pas encore été rétrécie, elle vaut 1 280 px " +
        "(projet `chromium`, préréglage Desktop Chrome, playwright.config.ts:43) — la barre " +
        "latérale doit EXISTER : c'est le contre-témoin de l'assertion négative qui suit. " +
        "Zéro ici signifie que la mesure n'aurait rien prouvé à 360 px non plus — la " +
        "disparition serait celle d'un élément qui n'a jamais été là (EspaceShell.tsx:131-134).",
    ).toHaveCount(1, { timeout: 30_000 });
    await expect(
      barreLaterale.getByRole("navigation", { name: NAV_ESPACE }),
      "la barre latérale de bureau ne contient pas la navigation nommée " +
        `« ${NAV_ESPACE} » (EspaceShell.tsx:154-157) : l'étiquette est portée par le ` +
        "`<nav>`, pas par l'`<aside>` — une version l'avait mise sur l'aside, et la barre " +
        "latérale était alors une navigation ANONYME pour un lecteur d'écran.",
    ).toHaveCount(1, { timeout: 30_000 });

    await page.setViewportSize(TELEPHONE);

    await expect(
      barreLaterale,
      "la barre latérale est encore exposée à 360 px : elle mange la largeur d'un téléphone " +
        "alors qu'elle est censée être `hidden` sous `lg` (EspaceShell.tsx:132). Le compte " +
        "était bien de 1 juste avant le redimensionnement : ce n'est donc pas un DOM vide " +
        "qui rendrait cette assertion verte.",
    ).toHaveCount(0, { timeout: 30_000 });

    const barreBasse = page.getByRole("navigation", { name: NAV_ESPACE });
    await expect(
      barreBasse,
      `à 360 px il doit rester EXACTEMENT une navigation nommée « ${NAV_ESPACE} » : celle du ` +
        "bas (EspaceShell.tsx:285-325). Zéro = le stagiaire n'a aucune navigation sur " +
        "téléphone ; deux ou plus = la barre latérale est restée dans l'arbre " +
        "d'accessibilité et les deux se disputent le pouce.",
    ).toHaveCount(1, { timeout: 30_000 });

    // La barre du bas est `fixed inset-x-0 bottom-0` (EspaceShell.tsx:286) : elle
    // doit occuper toute la largeur UTILE et être ancrée au bas de la fenêtre.
    // C'est ce qui la distingue d'une barre latérale rétrécie — et c'est
    // l'affordance que le pouce attend.
    //
    // ⚠️ On compare aux dimensions LUES dans la page, pas aux 360×740 déclarés :
    // une barre de défilement verticale classique ampute `clientWidth` d'une
    // quinzaine de pixels, et un élément `fixed` s'aligne sur le bloc conteneur
    // initial, scrollbar exclue. Comparer aux valeurs déclarées produirait un
    // rouge qui n'apprend rien.
    const fenetre = await page.evaluate(() => ({
      largeur: document.documentElement.clientWidth,
      hauteur: document.documentElement.clientHeight,
    }));
    const boiteBarre = await barreBasse.boundingBox();
    expect(
      boiteBarre,
      "la barre d'onglets du bas n'a pas de boîte mesurable à 360 px — elle est dans " +
        "l'arbre d'accessibilité mais pas à l'écran",
    ).not.toBeNull();
    expect(
      Math.round(boiteBarre?.width ?? 0),
      `la barre d'onglets ne fait que ${Math.round(boiteBarre?.width ?? 0)} px de large pour ` +
        `${fenetre.largeur} px utiles : ce n'est pas la barre du bas pleine largeur mais un ` +
        "résidu de la barre latérale, ou `inset-x-0` a été perdu (EspaceShell.tsx:286)",
    ).toBeGreaterThanOrEqual(fenetre.largeur - 1);
    expect(
      Math.round((boiteBarre?.y ?? 0) + (boiteBarre?.height ?? 0)),
      "la barre d'onglets n'est pas ancrée au bas de la fenêtre : son bord inférieur tombe " +
        `à ${Math.round((boiteBarre?.y ?? 0) + (boiteBarre?.height ?? 0))} px pour ` +
        `${fenetre.hauteur} px de hauteur utile. Un stagiaire debout, une main sur la barre ` +
        "du métro, ne va pas la chercher en haut de page (`bottom-0`, EspaceShell.tsx:286).",
    ).toBeGreaterThanOrEqual(fenetre.hauteur - 2);

    const onglets = barreBasse.getByRole("link");
    await expect(
      onglets,
      "la barre d'onglets du bas doit porter les quatre destinations de " +
        `\`construireNavigation\` (_coquille.tsx:35-67) : ${ONGLETS.join(", ")}. ` +
        "Au-delà de quatre, la barre devient illisible sur un téléphone — c'est le " +
        "plafond que le composant s'impose (_coquille.tsx:29-34).",
    ).toHaveCount(ONGLETS.length, { timeout: 30_000 });

    for (let rang = 0; rang < ONGLETS.length; rang += 1) {
      const libelle = ONGLETS[rang] as string;
      const onglet = onglets.nth(rang);

      // ⚠️ CONTENANCE, pas égalité, et ce n'est pas une facilité : la pastille
      // de comptage de l'onglet « À faire » porte son propre `aria-label`
      // (« N en attente », EspaceShell.tsx:312-319), qui s'INTÈGRE au nom
      // accessible du lien dès qu'un questionnaire est en attente. Exiger
      // l'égalité rendrait le test dépendant de l'état des questionnaires du
      // seed — vert aujourd'hui (les quatre portent un `reponduAt`,
      // demo.ts:730-783), rouge le jour où l'on sème un questionnaire non
      // répondu, pour une raison qui n'a rien à voir avec la navigation.
      await expect(
        onglet,
        `l'onglet n°${rang + 1} de la barre du bas ne nomme pas « ${libelle} ». L'ordre suit ` +
          "le parcours du bénéficiaire (ce qu'il doit faire, ce qu'il suit, ce qu'il garde, " +
          "ses données) : le changer le désoriente sans le lui dire.",
      ).toHaveAccessibleName(new RegExp(libelle), { timeout: 30_000 });

      const boite = await onglet.boundingBox();
      expect(
        boite,
        `l'onglet « ${libelle} » n'a pas de boîte mesurable — il n'est pas rendu à l'écran`,
      ).not.toBeNull();
      const hauteur = Math.round(boite?.height ?? 0);
      expect(
        hauteur,
        `la cible tactile de l'onglet « ${libelle} » mesure ${hauteur} px de haut, sous les ` +
          `${CIBLE_TACTILE_MIN_PX} px visés. Cette barre est manipulée au pouce, d'une main, ` +
          "debout : sous ce seuil, c'est l'onglet voisin qui se déclenche.",
      ).toBeGreaterThanOrEqual(CIBLE_TACTILE_MIN_PX);
    }

    await mesurerDebordement(page, "accueil", info);

    // ── Jusqu'à l'attestation, en cliquant ──────────────────────────────────
    const versDocuments = onglets.nth(ONGLETS.indexOf("Documents"));
    await versDocuments.click({ timeout: 60_000 }); // cf. `ARRIVEE_ECRAN` (_communs.ts) : le clic paie l'attente de SA navigation.
    // 🔑 Après un clic de navigation, on attend l'URL — pas un état de charge.
    // `waitForLoadState` rend la main avant même qu'une navigation douce ait
    // commencé : une sonde bâtie ainsi mesure l'écran PRÉCÉDENT et le déclare
    // conforme. Le dépôt l'a payé quatre fois dans la même journée.
    await page.waitForURL((u) => u.pathname === "/fr/portail/mon-espace/documents", {
      waitUntil: "domcontentloaded", // défaut = `"load"` ; cf. la note de `creerSession` dans `_communs.ts`.
      timeout: 60_000,
    });

    expect(
      fuites,
      "des requêtes sortent de l'instance mesurée depuis l'écran « Mes documents » — même " +
        "lecture que plus haut : vérifier si l'URL vient du portail ou du header public " +
        "hérité du layout racine",
    ).toEqual([]);
    // On rend la main : la navigation est terminée, et laisser le collecteur
    // branché ne mesurerait plus que le bruit de fin de test.
    page.off("request", collecteur);

    await expect(
      page.getByRole("heading", { level: 1, name: "Mes documents" }),
      "l'onglet « Documents » n'a pas mené à l'écran des documents " +
        `(documents/page.tsx:67-69) — URL : ${page.url()}`,
    ).toBeVisible({ timeout: 60_000 });

    // L'attestation du dossier de démonstration, semée par `demo.ts:1459-1475`,
    // puis rattachée à l'inscription (`attestationDocumentId`, demo.ts:1478-1484).
    // C'est par CE rattachement qu'elle remonte dans l'espace
    // (portail-service.ts:485-511, via `attestationDocument` :388) — une pièce
    // écrite sans lui n'y apparaîtrait jamais.
    await expect(
      page.getByText(NUMERO_ATTESTATION, { exact: true }),
      `l'attestation ${NUMERO_ATTESTATION} n'apparaît pas dans l'espace de ${STAGIAIRE.nom}. ` +
        "Si l'écran affiche « Aucun document disponible » (documents/page.tsx:75-85), c'est " +
        "que `espace.attestations` est vide : soit le seed n'a pas lié la pièce à " +
        "l'inscription, soit ce n'est pas le bon stagiaire.",
    ).toBeVisible({ timeout: 60_000 });

    // ⚠️ ON N'ASSERTE PAS « Télécharger », et ce n'est pas un oubli. Le seed ne
    // pose AUCUNE `pdfUrl`, et la signature fraîche est fail-soft
    // (portail-service.ts:499-504) : sans R2 — le cas en CI — le lien n'est tout
    // simplement pas rendu (documents/page.tsx:105-115). L'exiger reviendrait à
    // exiger une infrastructure, pas un comportement.
    const verifier = page.getByRole("link", { name: "Vérifier" });
    await expect(
      verifier,
      "l'attestation est affichée mais SANS lien « Vérifier » : l'employeur n'a alors aucun " +
        "moyen de contrôler la pièce sans nous appeler — ce qui est exactement la promesse " +
        "écrite deux lignes plus bas à l'écran (documents/page.tsx:131-134). Cause la plus " +
        "probable : `qrToken` absent sur le document (le lien est gaté dessus, " +
        "documents/page.tsx:116).",
    ).toHaveCount(1, { timeout: 60_000 });

    const href = (await verifier.getAttribute("href")) ?? "(attribut href absent)";
    expect(
      href,
      `le lien « Vérifier » pointe sur « ${href} » au lieu de ` +
        "`/fr/verifier-attestation/<jeton>` (documents/page.tsx:118)",
    ).toMatch(/^\/fr\/verifier-attestation\/[^/]+$/);

    await mesurerDebordement(page, "documents", info);

    // ── Le bout de la chaîne : la pièce est-elle VÉRIFIABLE ? ────────────────
    //
    // 🔴 Un lien « Vérifier » qui mène à une pièce annulée est PIRE qu'un lien
    // absent : l'employeur qui le suit lit « Document annulé — ne fait plus foi »
    // (verifier-attestation/[token]/page.tsx:167) et en conclut que le stagiaire
    // lui a présenté un faux. Or le seed ne répare PAS ce cas : son upsert
    // d'attestation porte `update: {}` (demo.ts:1461), donc une annulation
    // laissée par une exécution précédente n'est jamais rattrapée.
    //
    // 🔑 On assert la mention POSITIVE « Document authentique » (page.tsx:213),
    // seule des trois qui discrimine. Les deux autres états sont « Document
    // annulé » (:167) et « Document remplacé » (:196) — et un motif du genre
    // `/introuvable|invalide|expiré/i` n'en matche AUCUN : c'est précisément le
    // trou par lequel une pièce morte passe pour vivante ailleurs dans la suite.
    const verification = await page.request.get(`${ORIGINE}${href}`, { timeout: 60_000 });
    expect(
      verification.status(),
      `la page de vérification de l'attestation rend ${verification.status()} — le QR ` +
        "imprimé sur la pièce mène donc dans le vide, et l'employeur n'a aucun recours. " +
        "Un 404 vient de `notFound()` : page.tsx:144 si le JETON EST INCONNU " +
        "(`if (!doc) notFound()`), page.tsx:104-107 si le build tourne sur les URL " +
        "stub `stub.invalid` (ADR 0026) — auquel cas la page n'a jamais interrogé la " +
        "base. Il n'existe AUCUN `notFound()` lié à un numéro de document.",
    ).toBe(200);

    // ⚠️ On teste des booléens plutôt que `toContain` sur le corps : en cas
    // d'échec, `toContain` recracherait la page HTML entière dans le rapport et
    // noierait le message. La cause est dans le message, pas dans le dump.
    const corpsVerification = await verification.text();
    expect(
      corpsVerification.includes(NUMERO_ATTESTATION),
      `la page de vérification ne nomme pas ${NUMERO_ATTESTATION} ` +
        "(verifier-attestation/[token]/page.tsx:231-232) : le jeton ouvre une autre pièce, " +
        "ou aucune",
    ).toBe(true);
    expect(
      corpsVerification.includes("Document authentique"),
      `l'attestation ${NUMERO_ATTESTATION} n'est PAS déclarée authentique. Les deux autres ` +
        "états portent « Document annulé — ne fait plus foi » (page.tsx:167) et « Document " +
        "remplacé par … » (page.tsx:196). ⚠️ Si c'est « annulé » : rejouer " +
        "`pnpm qualiopi:seed-demo` NE SUFFIT PAS — l'upsert porte `update: {}` " +
        "(demo.ts:1461) et ne ressuscite pas la pièce ; il faut remettre `annuleeAt`, " +
        "`annuleeMotif` et `annuleePar` à `null` (une contrainte CHECK exige le motif dès " +
        "que `annuleeAt` est posé : les trois ensemble, ou aucun).",
    ).toBe(true);
  });
});
