/**
 * PARCOURS 7 — LE FORMATEUR le jour J, puis L'AUDITEUR.
 *
 * Phase 6 de `_AUDIT/PROMPT-AUDIT-QUALIOPI-E2E-50-AGENTS-2026-08-18.md` :
 * « Formateur le jour J, puis auditeur (mode-auditeur, export du manifeste,
 * vérification publique d'attestation) ».
 *
 * Trois regards, trois moments, et c'est la même donnée qui doit tenir :
 *
 *  1. Le formateur ouvre son kit d'animation — sur place, souvent sans réseau
 *     confortable. Une page qui ne rend pas, c'est une journée qui commence mal.
 *  2. L'auditrice ouvre le mode auditeur et exporte le manifeste. C'est la
 *     pièce qu'elle emporte : si le bouton ne produit rien, l'audit s'arrête.
 *  3. N'IMPORTE QUI vérifie une attestation par son jeton public. C'est la
 *     promesse faite au stagiaire et à son financeur.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 2026-08-23 — CE QUE CE FICHIER NE PROUVAIT PAS, ET POURQUOI IL ÉTAIT VERT
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Six de ses douze assertions ne pouvaient pas rougir, et trois contrôles de
 * statut HTTP étaient aveugles aux `redirect()`. Le détail, parce qu'un
 * correctif qui ne dit pas ce qu'il corrige se refait :
 *
 *  (A) `body.innerText().length > 300` sur `/animer` — INATTEIGNABLE. La page
 *      émet des centaines de caractères STATIQUES sans la moindre donnée : le
 *      titre, la description (animer/page.tsx:250) et les 7 libellés de
 *      `TYPES_FORMATEUR` / `TYPES_STAGIAIRES` (:50-56, rendus :336 et :350). Et
 *      `body` emporte en plus tout le rail de la console. Un seuil posé sur
 *      `body` est donc vert sur une page TOTALEMENT VIDE. Le repère de contenu
 *      est tranché une fois pour toutes dans `CONTENU` (`_communs.ts`), avec sa
 *      mesure : on l'IMPORTE, on ne le recopie pas — et on ne recopie pas non
 *      plus son chiffrage, un chiffre recopié se périme (un premier jet écrivait
 *      ici « 146 label: dans admin-nav.ts » ; il y en a 149).
 *
 *  (B) `/animer` composait son URL à la main. Or `getFormationById(id) === null`
 *      déclenche un `redirect()` vers la LISTE (animer/page.tsx:76-78) : le
 *      navigateur suit, `status()` vaut 200, la liste des formations dépasse
 *      300 caractères et ne contient aucun mot du filtre d'erreur. Les trois
 *      assertions passaient sur une page qui n'était PAS le kit. On y arrive
 *      désormais par un CLIC, et on exige l'URL d'arrivée.
 *
 *  (D) Le seul nom de fichier `/manifest|audit/i` ne prouve rien :
 *      `manifeste-audit-qualiopi-${date}` (actions/qualiopi/conformite.ts:58-60)
 *      est IDENTIQUE pour un manifeste complet et pour le manifeste VIDE de
 *      `buildEmptyManifeste()` (audit-dossier.ts:837-852, « Mode build — données
 *      indisponibles »). On OUVRE le fichier.
 *
 *  (E) `toBeEnabled()` sur le bouton d'export est toujours vrai : il n'est
 *      `disabled` que pendant une transition en cours
 *      (ExportManifesteButton.tsx:141). Et les contrôles `status() === 200` des
 *      deux sous-écrans ne voyaient pas leur `redirect()` vers /login
 *      (emargement/page.tsx:194-196, signatures/page.tsx:347-349 — un
 *      `redirect()` rend 200). On y va par un CLIC, et on lit le `<h1>`.
 *
 *  (F) Le motif `/introuvable|invalide|inconnu|expiré/i` ne matche AUCUNE des
 *      chaînes des trois états de `/verifier-attestation/[token]`. Une
 *      attestation ANNULÉE affiche « Document annulé — ne fait plus foi »
 *      (page.tsx:167) et passait donc au VERT sur une pièce morte. Et
 *      `texte.length > 120` est franchi par le seul bandeau statique
 *      (« Document authentique » + sa phrase de 101 caractères, page.tsx:213-217
 *      = 121). On asserte le NUMÉRO, le type, la session et le stagiaire.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ✅ CE HARNAIS EST UNE GATE DEPUIS LE 2026-08-23 — RECTIFICATION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Une version précédente de cet en-tête affirmait : « ce harnais n'est PAS une
 * gate, le step Playwright suite porte `continue-on-error: true` ». C'ÉTAIT VRAI
 * HIER, CE NE L'EST PLUS. Mesuré dans `.github/workflows/ci.yml` :
 *
 *   · le step « Playwright suite » (:443) ne porte plus AUCUN
 *     `continue-on-error` — il a été retiré le 2026-08-23, et le commentaire
 *     :479-499 documente le retrait ainsi que la trajectoire 0 → 224 passés ;
 *   · `Gate B · per-PR` est un contexte EXIGÉ par la protection de `main`, en
 *     `strict: true` : un rouge d'ici bloque 100 % des PR, pas seulement la
 *     sienne.
 *
 * 🔑 Écrire « de toute façon ça ne bloque pas » est exactement la fausse
 * sécurité que le paragraphe « Vérité des gates » d'AGENTS.md interdit — dans
 * les deux sens. Conséquence pratique pour ce fichier : plus aucune assertion
 * ne peut se permettre d'être approximative ou intermittente. La seule qui
 * reste à mesurer avant d'être tenue pour acquise est signalée en clair sur
 * `recolterLesExports`.
 *
 * ⚠️ CONVENTION D'APOSTROPHE, ET ELLE EST VÉRIFIABLE — mais pas comme un premier
 * jet le prétendait.
 *
 * Ce que ce fichier MATCHE emploie l'apostrophe ASCII U+0027 :
 * `SUPPORT_TYPE_LABELS` écrit "Guide d'animation", `emargement/page.tsx:213`
 * écrit "Registre des signatures d'émargement", `animer/page.tsx:267` écrit
 * `n&apos;a pas de kit` (rendu U+0027). Une apostrophe typographique U+2019 dans
 * un sélecteur serait INVISIBLE à la relecture et ne matcherait JAMAIS.
 *
 * 🔴 EN REVANCHE, « le produit n'emploie que U+0027 » est FAUX, et il ne faut pas
 * le recopier : `src/` en porte 267 occurrences dans 53 fichiers, dont la page
 * même que le test 3 vérifie (verifier-attestation/[token]/page.tsx:293-294).
 * L'invariant ne porte donc QUE sur ce fichier-ci, et sur les chaînes qu'il
 * compare — pas sur le dépôt.
 *
 * 🔑 ET IL DOIT POUVOIR ÊTRE VRAI. Écrit `grep -c $'<apostrophe typographique>'`,
 * l'invariant contenait l'apostrophe qu'il interdit : la commande rendait 1 dès
 * l'écriture, jamais 0. C'est `test-statique-trouve-ses-propres-commentaires`,
 * déjà payé ici. On désigne donc le caractère par son CODE :
 *
 *     grep -cP '\x{2019}' 07-formateur-puis-auditeur.spec.ts   # doit rendre 0
 *
 * Prérequis : `pnpm qualiopi:seed-demo`, puis
 *   npx playwright test tests/e2e/qualiopi/parcours/07-formateur-puis-auditeur.spec.ts \
 *     --project=chromium --workers=1
 */

import { readFile } from "node:fs/promises";

import { test, expect, type Download, type Page } from "@playwright/test";

import { loginAsAdmin } from "../../fixtures/admin-auth";
import { CONTENU, ENREGISTREMENT, ouvrir } from "./_communs";

// ─────────────────────────────────────────────────────────────────────────────
// Le dossier de démonstration, tel que le seed l'écrit — jamais deviné
// ─────────────────────────────────────────────────────────────────────────────

/** Numéro stable de la formation de démonstration (demo.ts:348). */
const FORMATION_DEMO = "AXI-FOR-DEMO-001";

/**
 * Slug de la formation de démonstration (demo.ts:425).
 *
 * 🔑 Il n'appartient à AUCUNE prestation du catalogue (vérifié le 2026-08-23 :
 * zéro occurrence de `demo-ia-operationnelle-essentielle` dans `src/`), et le
 * seed n'écrit aucun `InterventionDocument`.
 * `resolveInterventionSlugForFormation` rend donc `null` (kit-formation.ts:45-55)
 * et l'écran « Tout pour animer » bascule sur son encart fail-visible. Ce n'est
 * pas une panne : c'est l'état RÉEL du dossier de démonstration, et le test
 * l'exige explicitement plus bas.
 */
const FORMATION_DEMO_SLUG = "demo-ia-operationnelle-essentielle";

/** Numéro de l'attestation du dossier de démonstration (demo.ts:352). */
const ATTESTATION_DEMO = "AXI-ATT-DEMO-001";

/**
 * Jeton de l'attestation du dossier de démonstration.
 *
 * Valeur STABLE posée par `prisma/seeds/qualiopi/demo.ts` (`DEMO.ATTESTATION_QR`,
 * :353, écrite en :1459-1474) : on la reprend telle quelle plutôt que de la lire
 * en base — un parcours ne doit pas avoir besoin d'un accès SQL pour jouer.
 */
const JETON_DEMO = "DEMO-QR-TOKEN-AXION-IA-2026-001-STABLE-HASH-CHECK-OK";

/**
 * Le stagiaire porteur de l'attestation, TEL QUE LA PAGE PUBLIQUE L'ÉCRIT.
 *
 * L'attestation est celle du stagiaire d'indice 0 (demo.ts:787-794), soit Marie
 * Martin (demo.ts:578-585). La page publique masque le patronyme :
 * `{prenom} {initialeNom(nom)}` → « Marie M. » (verifier-attestation :77-80 et
 * :282). Écrire « Marie Martin » ici ne matcherait jamais.
 */
const STAGIAIRE_ATTESTE = "Marie M.";

/**
 * Les 7 supports que « Tout pour animer » liste, dans l'ordre des deux sections.
 *
 * Source : `TYPES_FORMATEUR` (animer/page.tsx:50) et `TYPES_STAGIAIRES` (:51-56),
 * rendus via `SUPPORT_TYPE_LABELS` (qualiopi/supports/support-builder.ts:54-63).
 *
 * ⚠️ Les trois libellés à apostrophe la portent en U+0027, comme la source
 * (support-builder.ts:59, :60, :62 — zéro U+2019 dans ce fichier, mesuré).
 *
 * ⚠️ `kit_formateur_imprime` N'EST PAS dans cette liste, à dessein : il existe
 * dans l'énumération `SupportType` mais n'est rendu par aucune des deux sections
 * (il n'est pas produit par le Formation Engine — kit-formation.ts:83-88).
 * L'ajouter ici rendrait le test rouge sur une ligne qui n'a jamais été censée
 * s'afficher.
 */
const SUPPORTS_ATTENDUS = [
  "Livret de projection (formateur)",
  "Guide d'animation",
  "Grille d'évaluation",
  "Support de cours (stagiaire)",
  "Livret stagiaire",
  "Mémo récapitulatif",
  "Cahier d'exercices",
] as const;

/**
 * Délai d'ARRIVÉE sur un écran de la console.
 *
 * 🔴 `playwright.config.ts` borne toute navigation à 30 s (`navigationTimeout`,
 * :37). C'est le bon ordre de grandeur contre un build de production — pas sous
 * `next dev`, où CHAQUE route de la console se compile au premier appel. Les
 * attentes d'arrivée déclarent donc leur propre délai.
 *
 * ⚠️ Le budget de cette suite doit rester STRICTEMENT supérieur à cette valeur
 * ET aux 180 s de `loginAsAdmin` : un délai plus long que son budget ne peut
 * jamais expirer — c'est alors le budget qui rend le verdict, avec son message
 * générique, et le message précis écrit ici devient inatteignable. Cliquet :
 * `tests/unit/e2e-harness/delai-interne-sous-le-budget.spec.ts`.
 */
const ARRIVEE = process.env["CI"] === "true" ? 60_000 : 180_000;

// ─────────────────────────────────────────────────────────────────────────────
// Aides locales
// ─────────────────────────────────────────────────────────────────────────────

/** Le `<h1>` de la zone de contenu de la console — jamais celui du site. */
function titreEcran(page: Page) {
  // 🔴 `main` N'EST PLUS UN REPÈRE DANS LA CONSOLE : le layout admin a cessé
  // d'ouvrir son propre `<main>` (layout.tsx:396-404 et :416-418), le `<main>`
  // unique est celui du site et il enveloppe le rail. Le repère est tranché une
  // fois pour toutes dans `CONTENU` (`_communs.ts`) — jamais réécrit en clair
  // ici : un prédicat recopié diverge toujours.
  return page.locator(CONTENU).getByRole("heading", { level: 1 });
}

/**
 * Attend l'arrivée sur une URL, et NOMME la cause quand elle ne vient pas.
 *
 * 🔑 C'est le coeur des correctifs (B) et (E). Les écrans ouverts par ce parcours
 * portent tous un `redirect()` de garde, et un `redirect()` rend un **200** :
 *
 *   · `redirect(.../login)` si la session a expiré ou si le rôle ne suffit pas
 *     (animer/page.tsx:71-73, emargement/page.tsx:194-196, signatures :347-349) ;
 *   · `redirect(.../qualiopi/formations)` si la formation est introuvable
 *     (animer/page.tsx:76-78).
 *
 * Un test qui n'assertait que le statut voyait 200 dans les deux cas. Le `<h1>`,
 * lui, discrimine sans ambiguïté : « Connexion admin » (login/page.tsx:32) contre
 * « Formations » (formations/page.tsx:87) contre le titre attendu.
 */
async function arriverSur(page: Page, motif: RegExp, ceQuOnAttendait: string): Promise<void> {
  try {
    await page.waitForURL(motif, {
      waitUntil: "domcontentloaded", // défaut = `"load"` ; cf. la note de `creerSession` dans `_communs.ts`.
      timeout: ARRIVEE,
    });
  } catch (cause) {
    const titre = await titreEcran(page)
      .first()
      .innerText()
      .catch(() => "(aucun <h1> lisible dans la zone de contenu)");
    throw new Error(
      `${ceQuOnAttendait} — on n'y est pas arrivé. URL atteinte : ${page.url()} · ` +
        `titre de l'écran : « ${titre.replace(/\s+/g, " ").trim()} ». ` +
        "Un titre « Connexion admin » = la page a rendu son `redirect()` vers /login " +
        "(session expirée, ou rôle insuffisant) ; un titre « Formations » = la garde " +
        "`getFormationById(id) === null` a renvoyé vers la liste (animer/page.tsx:76-78) ; " +
        "un titre attendu mais une URL immobile = la navigation douce n'a pas abouti.",
      { cause },
    );
  }
}

/**
 * Déclenche un export et RÉCOLTE les fichiers réellement produits.
 *
 * 🔑 On EXIGE un téléchargement, pas un clic sans conséquence. Un bouton qui ne
 * produit aucun fichier est indiscernable, à l'oeil, d'un bouton qui fonctionne —
 * et c'est précisément le genre d'écart que cet audit cherche.
 *
 * `handleExportManifeste` produit DEUX fichiers (ExportManifesteButton.tsx:76-85) :
 * le JSON puis le Markdown, par deux `triggerBlobDownload` successifs. Attendre
 * un seul événement `download` laisserait passer la moitié de la panne.
 *
 * ⚠️ CE QUI RESTE À MESURER AVANT DE TENIR `attendus = 2` POUR ACQUIS. Les deux
 * `triggerBlobDownload` sont appelés dans le callback asynchrone d'une
 * transition React (:61-86) — donc HORS de l'activation utilisateur du clic.
 * Chromium applique à ce cas une politique « multiple automatic downloads », et
 * je n'ai pas pu trancher en LECTURE SEULE si Playwright la neutralise dans
 * cette version. Deux conduites, et une seule est honnête : si le second fichier
 * n'arrive pas de façon reproductible, NE PAS baisser le nombre attendu — c'est
 * un CONSTAT d'audit (l'auditrice repart avec la moitié du dossier) qu'il faut
 * écrire comme tel. Le message d'échec ci-dessous nomme cette hypothèse pour que
 * personne n'ait à la redécouvrir.
 *
 * ⚠️ L'ORDRE DE LA SONDE COMPTE. On regarde D'ABORD le compte de fichiers, et on
 * ne lit le refus que s'il manque quelque chose : un `[role="alert"]` étranger
 * qui traînerait sur l'écran masquerait sinon un export réussi et rendrait un
 * rouge sur un produit qui marche. Sur refus réel, l'écran affiche un
 * `[role="alert"]` titré « L'export du manifeste a echoue »
 * (ExportManifesteButton.tsx:63-70 → VerdictExportBloc.tsx:39) — sans accent,
 * comme la source. Un message de sondage est FIGÉ ; la valeur reçue, elle, dit
 * ce que l'écran montrait vraiment. Sa lecture est bornée à 1 s, sinon chaque
 * itération hériterait de l'`actionTimeout` de 15 s et le chemin NOMINAL paierait
 * l'attente.
 */
async function recolterLesExports(
  page: Page,
  declencher: () => Promise<void>,
  attendus: number,
): Promise<Map<string, string>> {
  const recus: Download[] = [];
  const collecte = (d: Download): void => {
    recus.push(d);
  };
  page.on("download", collecte);
  try {
    await declencher();

    const etat = async (): Promise<string> => {
      if (recus.length === attendus) return `${attendus} fichier(s)`;
      const alerte = page.locator(CONTENU).locator('[role="alert"]');
      if ((await alerte.count()) > 0) {
        const texte = await alerte
          .first()
          .innerText({ timeout: 1_000 })
          .catch(() => "(alerte illisible)");
        return `REFUS: ${texte.replace(/\s+/g, " ").trim()}`;
      }
      return `${recus.length} fichier(s)`;
    };

    await expect
      .poll(etat, {
        timeout: 90_000,
        message:
          `l'export n'a pas produit ses ${attendus} fichiers. La valeur reçue dit laquelle ` +
          "des trois causes s'est produite : « REFUS: … » = l'action serveur a échoué et " +
          "`VerdictExportBloc` l'a écrit dans la page ; « 0 fichier(s) » = le clic n'a rien " +
          "déclenché du tout ; « 1 fichier(s) » = le premier `triggerBlobDownload` est passé " +
          "et pas le second (ExportManifesteButton.tsx:76-85) — soit l'action a rendu un " +
          "manifeste tronqué, soit Chromium a bloqué le second téléchargement automatique, " +
          "les deux étant émis hors activation utilisateur depuis une transition. Dans le " +
          "second cas l'auditrice repart avec un dossier incomplet sans qu'un mot le lui dise.",
      })
      .toBe(`${attendus} fichier(s)`);
  } finally {
    // La fixture `page` est de portée TEST : aucun écouteur ne survit d'un test
    // à l'autre — un premier jet justifiait ce retrait par une contamination
    // entre tests `serial` qui n'existe pas, et une justification fausse se
    // recopie. Ce retrait borne le collecteur à l'appel en cours, pour qu'un
    // second appel DANS LE MÊME TEST ne recompte pas les fichiers du premier.
    page.off("download", collecte);
  }

  const parNom = new Map<string, string>();
  for (const fichier of recus) {
    // 🔴 `Download.path()` N'ACCEPTE AUCUN DÉLAI et n'hérite d'aucune borne : ni
    // `actionTimeout`, ni `navigationTimeout` ne s'y appliquent. Un téléchargement
    // qui traîne consomme donc le BUDGET du test, puis rend « Test timeout
    // exceeded » — le message muet contre lequel tout ce fichier est écrit. C'était
    // le seul point non borné du parcours.
    //
    // 🔑 On lit d'abord `failure()` : quand le navigateur a refusé ou interrompu le
    // téléchargement, il le DIT, et l'attente ci-dessous n'aboutirait jamais.
    const echec = await fichier.failure();
    if (echec !== null) {
      throw new Error(
        `le téléchargement « ${fichier.suggestedFilename()} » a échoué côté navigateur : ` +
          `${echec}. Cause probable : la politique « multiple automatic downloads », ` +
          "`ExportManifesteButton.tsx:76-85` en déclenchant deux à la suite.",
      );
    }
    const chemin = await Promise.race([
      fichier.path(),
      new Promise<never>((_, rejette) =>
        setTimeout(
          () =>
            rejette(
              new Error(
                `le fichier « ${fichier.suggestedFilename()} » n'a pas été écrit sur le ` +
                  "disque en 60 s. `Download.path()` n'a pas de borne propre : sans ce " +
                  "garde-fou, c'est le budget du test qui rendrait le verdict, sans nommer " +
                  "le téléchargement. ⚠️ `triggerBlobDownload` révoque l'URL objet " +
                  "SYNCHRONIQUEMENT après le clic (ExportManifesteButton.tsx:34-35) — une " +
                  "course connue de Chromium qui peut avorter un téléchargement blob.",
              ),
            ),
          60_000,
        ),
      ),
    ]);
    parNom.set(fichier.suggestedFilename(), await readFile(chemin, "utf8"));
  }
  return parNom;
}

/** Le contenu d'un fichier récolté, ou un échec qui NOMME ce qui manque. */
function contenuDe(fichiers: Map<string, string>, nom: string | undefined, quoi: string): string {
  const contenu = nom === undefined ? undefined : fichiers.get(nom);
  if (contenu === undefined) {
    throw new Error(
      `le fichier ${quoi} n'a pas été récolté — fichiers reçus : ` +
        `${[...fichiers.keys()].join(", ") || "(aucun)"}`,
    );
  }
  return contenu;
}

// ─────────────────────────────────────────────────────────────────────────────

test.use(ENREGISTREMENT);

test.describe("@parcours-qualiopi 7 — formateur le jour J, puis auditeur", () => {
  // 🔴 `mode: "serial"` A ÉTÉ RETIRÉ, ET C'EST UN CORRECTIF, PAS UN RELÂCHEMENT.
  //
  // Les six autres parcours le portent parce qu'ils enchaînent une session créée
  // au premier test. ICI CETTE RAISON N'EXISTE PAS : les trois tests ne partagent
  // aucun état, le test 2 refait son `loginAsAdmin`, et le test 3 ne se connecte
  // pas du tout. En `serial`, un kit d'animation qui ne rend pas SKIPPAIT la
  // vérification publique d'attestation — le seul test du fichier qui prouve la
  // promesse faite au stagiaire et à son financeur, et le seul qui ne dépende ni
  // de la console ni d'un compte. Le rapport affichait « 1 failed, 2 skipped »
  // sans qu'aucun message ne dise pourquoi les deux autres n'avaient rien
  // mesuré : un trou noir, exactement la famille de `identifiants-e2e-jamais-executes`.
  //
  // 🔑 LE CRITÈRE EST LE MAXIMUM, PAS LA SOMME — et un premier jet écrivait
  // l'inverse ici. Une borne atteinte ÉCHOUE et TERMINE le test : au plus UNE est
  // donc consommée en entier, jamais leur addition. Le budget doit dominer la
  // plus longue borne interne (180 s, héritée d'`admin-auth.ts:141` et de
  // `_communs.ts`) avec assez de marge pour que le reste du chemin — connexion,
  // deux navigations, sondage d'export — ait le temps de produire SON message
  // plutôt que de laisser sortir « Test timeout exceeded », le verdict muet que
  // tout ce harnais existe pour éviter. 600 s le font largement.
  test.describe.configure({ timeout: 600_000 });

  test("le formateur atteint le kit d'animation par des clics, et l'écran nomme ce qui manque", async ({
    page,
  }, info) => {
    // Dispense LÉGITIME et bornée : la CI ne lance que chromium
    // (`pnpm test:e2e --project=chromium`, ci.yml:519 ; ci.yml:299 n'installe que
    // lui). Les quatre autres projets n'existent qu'en exécution locale « tous
    // moteurs » — un parcours métier n'y gagne rien, et cinq connexions admin
    // simultanées font toutes dépasser 90 s.
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");
    await loginAsAdmin(page);

    // ── 1. La liste des formations ─────────────────────────────────────────
    await ouvrir(page, "qualiopi/formations");

    // 🔴 `waitForLoadState("networkidle")` a été RETIRÉ d'ici. Il ne dit rien
    // d'utile d'une page de console — elle ne se tait jamais côté réseau — et
    // sans délai propre il consomme le budget entier du test avant de rendre
    // « Test timeout exceeded », message qui ne nomme rien. Un cliquet l'interdit
    // désormais. 🔑 On attend un CONTENU, pas un état de réseau.
    const ligne = page.locator("tr").filter({ hasText: FORMATION_DEMO });
    await expect(
      ligne,
      `la formation de démonstration ${FORMATION_DEMO} n'apparaît pas dans la liste. ` +
        "Deux causes à distinguer : (1) `pnpm qualiopi:seed-demo` n'a pas tourné ; " +
        '(2) elle a dérivé vers `statut: "archive"` et la vue par défaut masque les ' +
        "archives (archive-filter.ts:49-52 — `?vue=toutes` les rouvre). Cette liste " +
        "n'est PAS paginée (formations/page.tsx:176) : l'absence n'est donc jamais " +
        "un défaut de pagination.",
    ).toHaveCount(1, { timeout: ARRIVEE });

    // On suit le lien DE LA LIGNE plutôt que de composer l'URL : composer une
    // URL, c'est tester sa propre construction, pas la navigation du produit.
    // « Éditer » est la première des trois actions de la ligne, et la seule qui
    // ouvre la fiche (formations/page.tsx:260-265).
    await ligne.getByRole("link", { name: "Éditer" }).click({ timeout: ARRIVEE }); // cf. `ARRIVEE_ECRAN` (_communs.ts) : le clic paie l'attente de SA navigation.
    await arriverSur(
      page,
      /\/qualiopi\/formations\/[0-9a-f-]{36}$/,
      `ouverture de la fiche de la formation ${FORMATION_DEMO}`,
    );

    // 🔑 L'identité de la formation ouverte se lit dans la description de
    // l'en-tête : `Formation ${numero} · ${modalité} · ${durée} h`
    // (formations/[id]/page.tsx:102). Sans cette assertion, un lien qui pointerait
    // la mauvaise ligne passerait : l'URL ne porte qu'un UUID, illisible.
    await expect(
      page.locator(CONTENU).locator(".admin-page-header"),
      `la fiche ouverte n'annonce pas « Formation ${FORMATION_DEMO} » : le lien « Éditer » ` +
        "de la ligne filtrée ne mène pas à la formation de démonstration",
    ).toContainText(`Formation ${FORMATION_DEMO}`, { timeout: ARRIVEE });

    // ── 2. Le kit d'animation, ATTEINT PAR UN CLIC ─────────────────────────
    //
    // 🔴 L'URL était composée à la main ici — ce que le commentaire du test
    // s'interdisait deux lignes plus haut. Le lien existe
    // (formations/[id]/page.tsx:269-274), il vit dans la section « Sous-sections »,
    // et c'est par lui que le formateur passe le jour J. Son libellé porte une
    // flèche finale (« Tout pour animer → ») : on ancre le préfixe, pas l'égalité.
    await page
      .locator(CONTENU)
      .getByRole("link", { name: /^Tout pour animer/ })
      .click({ timeout: ARRIVEE }); // cf. `ARRIVEE_ECRAN` (_communs.ts) : le clic paie l'attente de SA navigation.
    await arriverSur(
      page,
      /\/qualiopi\/formations\/[0-9a-f-]{36}\/animer$/,
      "ouverture du kit d'animation « Tout pour animer »",
    );

    // Le titre EST la preuve que la page a rendu — pas un seuil de caractères.
    // `AdminPageHeader` compose `Tout pour animer — ${formation.titre}`
    // (animer/page.tsx:248-251 → AdminPageHeader.tsx:63-73).
    await expect(
      titreEcran(page),
      "le kit d'animation n'a pas rendu son titre. Un `redirect()` vers /login ou vers la " +
        "liste des formations rend un **200** : le statut HTTP ne discrimine pas, le titre si.",
    ).toHaveText(/^Tout pour animer — /, { timeout: ARRIVEE });

    // Le fil d'Ariane porte le numéro (animer/page.tsx:240-246) : c'est ce qui
    // prouve que le kit ouvert est celui de LA formation de démonstration et pas
    // d'une autre — l'URL, elle, n'affiche qu'un UUID.
    await expect(
      page.locator(CONTENU).getByRole("link", { name: new RegExp(`Formation ${FORMATION_DEMO}$`) }),
      `le fil d'Ariane du kit ne renvoie pas vers ${FORMATION_DEMO} : le kit ouvert n'est ` +
        "pas celui de la formation de démonstration",
    ).toBeVisible({ timeout: 30_000 });

    // ── 3. Les trois sections attendues par le formateur ───────────────────
    for (const section of ["Projeté en salle", "Pour le formateur", "Pour les stagiaires"]) {
      await expect(
        page.locator(CONTENU).getByRole("heading", { level: 2, name: section }),
        `la section « ${section} » manque au kit d'animation (animer/page.tsx:255, :331, :345)`,
      ).toBeVisible({ timeout: 30_000 });
    }

    const texteEcran = (await page.locator(CONTENU).innerText()).replace(/\s+/g, " ").trim();
    await info.attach("kit-animation.txt", { body: texteEcran, contentType: "text/plain" });

    // ── 4. « Projeté en salle » ne doit JAMAIS être une section vide ────────
    //
    // 🔴 CE BLOC MESURAIT TOUT L'ÉCRAN EN CROYANT MESURER UNE SECTION. Un premier
    // jet bâtissait son alternance sur l'`innerText` de `.admin-main` ENTIER. Or
    // quand un kit EST résolu, `LigneSupport` écrit « Kit bibliothèque — {slot} :
    // Déposé / Manquant » dans les sections « Pour le formateur » et « Pour les
    // stagiaires » (animer/page.tsx:206-214, via `EtatDepot` :164-186). Le témoin
    // « avecKit » pouvait donc être VRAI alors que « Projeté en salle » n'avait
    // rendu strictement rien, et le message affirmait une portée qu'il ne
    // mesurait pas — la famille `correctif-qui-deplace-le-coupable`.
    //
    // ⚠️ POURQUOI LE DOUBLE FILTRE. `AdminPageShell` est lui-même un `<section>`
    // (AdminPageShell.tsx:46) qui CONTIENT les trois `<h2>` : un filtre sur le
    // seul « Projeté en salle » résout DEUX noeuds, et `innerText()` échoue alors
    // en violation de mode strict, avec un message qui ne nomme ni la page ni la
    // cause. Le `hasNot` sur un titre voisin discrimine la section de sa coquille.
    const sectionSalle = page
      .locator(CONTENU)
      .locator("section")
      .filter({ has: page.getByRole("heading", { level: 2, name: "Projeté en salle" }) })
      .filter({ hasNot: page.getByRole("heading", { level: 2, name: "Pour le formateur" }) });
    await expect(
      sectionSalle,
      "la section « Projeté en salle » n'est pas isolable : le filtre doit résoudre " +
        "exactement le `<section>` de animer/page.tsx:254-327, et pas la coquille " +
        "`AdminPageShell` qui l'enveloppe (AdminPageShell.tsx:46). Zéro noeud = la section " +
        "n'a pas rendu ; deux noeuds = la coquille a cessé d'être discriminée par le `hasNot`.",
    ).toHaveCount(1, { timeout: 30_000 });

    const texteSalle = (await sectionSalle.innerText()).replace(/\s+/g, " ").trim();
    await info.attach("kit-animation-projete-en-salle.txt", {
      body: texteSalle,
      contentType: "text/plain",
    });

    // 🔑 C'est la promesse explicite du produit : « Fail-visible : pas de kit
    // résolvable, on le DIT — jamais une section vide qui laisserait croire que
    // tout est en ordre » (animer/page.tsx:260-261). Deux états possibles, et ils
    // sont mutuellement exclusifs :
    //   · `kitSlug === null` → l'encart `role="status"` (:262-281) ;
    //   · `kitSlug !== null` → deux cartes de slot, chacune avec son lien
    //     « Ouvrir dans la bibliothèque » ou « Déposer le fichier » (:306-310),
    //     et un badge « Déposé » / « Manquant » (:164-186).
    //
    // Cette alternance discrimine LA SECTION ; les deux branches qui suivent
    // vérifient ensuite le contenu propre à l'état constaté. Sans le scoping
    // ci-dessus, « Déposé »/« Manquant » aurait été satisfait par les lignes de
    // supports des deux sections suivantes, et la garde serait verte sur une
    // section vide.
    const sansKit = texteSalle.includes("n'a pas de kit dans la bibliothèque");
    const avecKit = /Déposé|Manquant/.test(texteSalle);
    expect(
      sansKit || avecKit,
      "la section « Projeté en salle » n'annonce NI un kit NI son absence : le formateur " +
        "ne peut pas savoir s'il lui manque un diaporama ou si la page a échoué. " +
        `Texte lu dans la section : « ${texteSalle.slice(0, 400)} »`,
    ).toBe(true);

    if (sansKit) {
      // Un encart fail-visible qui ne nomme pas le slug est inexploitable : c'est
      // le slug qui dit OÙ déposer le fichier (animer/page.tsx:270-271).
      //
      // ⚠️ Si un kit venait à être déposé sous ce slug, cette branche cesserait
      // d'être empruntée — ce n'est pas un faux positif, c'est un changement
      // d'état du dossier de démonstration, et l'autre branche prend le relais.
      expect(
        texteSalle,
        `l'encart « pas de kit » n'écrit pas le slug « ${FORMATION_DEMO_SLUG} » : il annonce ` +
          "un manque sans dire lequel, ni où déposer le fichier",
      ).toContain(FORMATION_DEMO_SLUG);
    } else {
      await expect(
        sectionSalle.getByRole("link", {
          name: /^(Ouvrir dans la bibliothèque|Déposer le fichier)$/,
        }),
        "un kit est résolu, mais les deux slots projetés en salle " +
          "(`SLOTS_PROJETES_EN_SALLE`, kit-formation.ts:105) ne portent pas chacun leur " +
          "lien d'accès",
      ).toHaveCount(2, { timeout: 30_000 });
    }

    // ── 5. Les 7 supports sont listés, et AUCUNE ligne n'est muette ─────────
    //
    // ⚠️ CE QUE CE BLOC NE PROUVE PAS, ET IL FAUT LE DIRE : le seed de
    // démonstration n'écrit AUCUN `SupportFormation` (vérifié le 2026-08-23 :
    // zéro occurrence dans `prisma/seeds/qualiopi/demo.ts`). Les 7 lignes
    // affichent donc toutes « Non généré », et ce parcours ne peut PAS prouver
    // que le formateur repart avec de quoi animer — seulement que l'écran le lui
    // DIT au lieu de rester blanc. Semer ces supports est le patch 3 du plan de
    // phase 6, laissé INDÉTERMINÉ faute d'enquête complète. Le jour où il
    // atterrit, ajouter ici une assertion « au moins un support téléchargeable ».
    //
    // 🔑 Ce qu'on garde en attendant est réel : une ligne qui ne dirait NI
    // « Non généré » NI une version serait un trou silencieux dans l'écran.
    const lues: string[] = [];
    const muettes: string[] = [];
    for (const libelle of SUPPORTS_ATTENDUS) {
      const rangee = page.locator(CONTENU).locator("li").filter({ hasText: libelle });
      const nb = await rangee.count();
      if (nb !== 1) {
        lues.push(`${libelle} → ${nb} ligne(s)`);
        muettes.push(`${libelle} : ${nb} ligne(s) au lieu d'une`);
        continue;
      }
      const texte = (await rangee.innerText()).replace(/\s+/g, " ").trim();
      lues.push(`${libelle} → ${texte.slice(0, 120)}`);
      // `LigneSupport` écrit soit « Non généré » (animer/page.tsx:204), soit
      // « {titre} · v{n} » (:200-202). Rien d'autre n'est un état valide.
      if (!/Non généré|·\s*v\d+/.test(texte)) muettes.push(`${libelle} : « ${texte} »`);
    }
    await info.attach("kit-animation-supports.txt", {
      body: lues.join("\n"),
      contentType: "text/plain",
    });
    // Contre-témoin : sans lui, une boucle qui n'aurait rien parcouru laisserait
    // `muettes` vide, et l'assertion suivante serait verte sans rien garder.
    expect(
      lues.length,
      "la boucle n'a pas examiné les 7 libellés de supports : le contrôle qui suit " +
        "porterait alors sur une liste jamais alimentée, donc vert sans rien vérifier",
    ).toBe(SUPPORTS_ATTENDUS.length);
    expect(
      muettes,
      "des lignes de supports n'annoncent ni leur absence ni leur version : le formateur " +
        "lit une ligne vide et ne sait pas s'il doit générer le document, ou si l'écran " +
        "a échoué à l'afficher",
    ).toEqual([]);
  });

  test("l'auditrice exporte un manifeste QUI PORTE LES 32 INDICATEURS, et atteint les deux registres", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");
    await loginAsAdmin(page);

    // Entrée par l'URL, et c'est assumé : l'entrée de rail « Conformité & mode
    // auditeur » (admin-nav.ts:1113) vit dans un groupe repliable, et la preuve
    // qu'elle s'ouvre au clic est déjà faite ailleurs, sur toutes les entrées à
    // la fois (`tests/e2e/flows/admin-nav-clic.spec.ts`). Ce parcours dépense son
    // budget sur ce que lui seul peut prouver.
    await ouvrir(page, "qualiopi/mode-auditeur");

    await expect(
      titreEcran(page),
      "le mode auditeur n'a pas rendu son titre. Le `redirect()` vers /login rend un 200 : " +
        "un contrôle de statut ne l'aurait pas vu (mode-auditeur/page.tsx:46-48).",
    ).toHaveText("Conformité & mode auditeur", { timeout: ARRIVEE });

    // ── 1. La matrice porte VRAIMENT les 32 indicateurs ────────────────────
    //
    // 🔴 `MatriceIndicateurs` rend « Aucune donnée disponible. Les indicateurs
    // seront affichés une fois les services de conformité déployés » quand la
    // liste est vide (MatriceIndicateurs.tsx:335-344). Cet écran-là répond 200,
    // affiche un titre, et ne garde RIEN. Les deux assertions ci-dessous ne
    // peuvent être satisfaites que par une matrice réellement peuplée : les
    // sections par critère ne sont émises qu'en présence de lignes (:348-366),
    // et les 32 `<tr>` viennent de `INDICATEURS_RNQ` (indicateurs-registre.ts:68 —
    // 32 entrées, comptées le 2026-08-23).
    await expect(
      page.locator(CONTENU).locator('section[aria-labelledby^="critere-"]'),
      "la matrice n'affiche pas ses 7 critères : l'écran servi à l'auditrice est celui de " +
        "`indicateurs.length === 0` (« Aucune donnée disponible »), qui répond 200 et " +
        "n'apprend rien — ou bien `genererManifesteAudit()` a rendu le manifeste vide de " +
        "`buildEmptyManifeste()` (audit-dossier.ts:301-303, magic string `stub.invalid`).",
    ).toHaveCount(7, { timeout: ARRIVEE });

    await expect(
      page.locator(CONTENU).locator("table tbody tr"),
      "la matrice n'aligne pas 32 lignes : le RNQ V9 en compte 32 (`INDICATEURS_RNQ`, " +
        "indicateurs-registre.ts:68) et `evaluerConformite()` les rend TOUTES, applicables " +
        "ou non (conformite-service.ts:1235-1256). Un compte différent signale une donnée " +
        "tronquée, pas un écran lent.",
    ).toHaveCount(32, { timeout: ARRIVEE });

    // La tuile de bilan mesure une COUVERTURE DOCUMENTAIRE, pas un verdict
    // d'audit (mode-auditeur/page.tsx:107-113). On vérifie qu'elle est là.
    await expect(
      page.locator(CONTENU).getByText("Couverture documentaire"),
      "la tuile « Couverture documentaire » manque : l'auditrice n'a aucun repère chiffré",
    ).toBeVisible({ timeout: 30_000 });

    // ── 2. L'export du manifeste — ON OUVRE LES FICHIERS ───────────────────
    //
    // On vise le PRÉFIXE, commun à l'`aria-label` (« Exporter le manifeste
    // d'audit au format JSON et Markdown », ExportManifesteButton.tsx:143) et au
    // texte visible (« Exporter le manifeste (JSON + MD) », :145) : le nom
    // accessible reste le premier, mais aucun des deux ne peut faire diverger le
    // sélecteur. Un premier jet affirmait « viser le texte ne matcherait pas » —
    // c'était faux, et une justification fausse se recopie. L'ancrage `^` reste
    // nécessaire pour ne pas attraper le second bouton, « Télécharger le dossier
    // ZIP » (:148-156).
    //
    // 🔴 `toBeEnabled()` a été RETIRÉ : le bouton n'est `disabled` que pendant
    // une transition en cours (:141), donc l'assertion était vraie par
    // construction avant tout clic. Elle avait l'air d'un soin ; elle ne gardait
    // rien.
    const bouton = page.locator(CONTENU).getByRole("button", { name: /^Exporter le manifeste/ });
    await expect(
      bouton,
      "aucun bouton d'export du manifeste — l'auditrice repart sans pièce",
    ).toBeVisible({ timeout: 60_000 });

    const fichiers = await recolterLesExports(page, () => bouton.click(), 2);
    const noms = [...fichiers.keys()];
    await info.attach("manifeste-fichiers.txt", {
      body: noms.join("\n"),
      contentType: "text/plain",
    });

    const nomJson = noms.find((n) => n.endsWith(".json"));
    const nomMd = noms.find((n) => n.endsWith(".md"));
    expect(
      nomJson ?? "(aucun fichier .json)",
      "l'export n'a pas produit le manifeste JSON — c'est la pièce que l'auditrice archive " +
        `(ExportManifesteButton.tsx:76-79). Fichiers reçus : ${noms.join(", ") || "(aucun)"}`,
    ).toMatch(/^manifeste-audit-qualiopi-\d{4}-\d{2}-\d{2}\.json$/);
    expect(
      nomMd ?? "(aucun fichier .md)",
      "l'export n'a pas produit le manifeste Markdown — c'est la pièce que l'auditrice LIT " +
        `(ExportManifesteButton.tsx:81-85). Fichiers reçus : ${noms.join(", ") || "(aucun)"}`,
    ).toMatch(/^manifeste-audit-qualiopi-\d{4}-\d{2}-\d{2}\.md$/);

    // 🔴 NE PAS S'ARRÊTER AU NOM DE FICHIER. `manifeste-audit-qualiopi-${date}`
    // (actions/qualiopi/conformite.ts:58-60) est RIGOUREUSEMENT LE MÊME pour un
    // manifeste complet et pour le manifeste vide de `buildEmptyManifeste()`
    // (audit-dossier.ts:837-852). Un dossier vide remis à l'auditrice porterait
    // exactement le nom que l'ancienne assertion validait.
    const manifeste = JSON.parse(contenuDe(fichiers, nomJson, "manifeste JSON")) as {
      meta?: { version?: string; nbApplicables?: number; nbCouverts?: number };
      indicateurs?: Array<{
        numero: number;
        statut: string;
        documents?: Array<{ type: string; count: number }>;
      }>;
    };

    expect(
      manifeste.meta?.version ?? "(absent)",
      "le manifeste exporté ne déclare pas son référentiel : sans « RNQ-V9 », l'auditrice " +
        "ne sait pas contre quelle version du référentiel elle le lit (audit-dossier.ts:496)",
    ).toBe("RNQ-V9");

    expect(
      manifeste.indicateurs?.length ?? 0,
      "le manifeste exporté ne porte pas les 32 indicateurs. `buildEmptyManifeste()` en " +
        "rend ZÉRO, sous le même nom de fichier et avec le même statut d'action " +
        "(audit-dossier.ts:837-852) : c'est très exactement le dossier vide qui pouvait " +
        "partir chez l'auditrice sans qu'aucun test s'en aperçoive.",
    ).toBe(32);

    expect(
      manifeste.meta?.nbApplicables ?? 0,
      "le manifeste ne déclare AUCUN indicateur applicable : le dénominateur du score est " +
        "nul, et `scorePct` vaut alors 0 par convention (conformite-service.ts:1258-1260) — " +
        "un « 0 % » qui ne veut rien dire",
    ).toBeGreaterThan(0);

    // 🔑 LA DONNÉE, PAS SEULEMENT LA GRILLE. L'attestation du dossier de
    // démonstration est une pièce du registre : elle doit apparaître au manifeste
    // sous le type `attestation`, rattachée à l'indicateur 11
    // (`INDICATEUR_DOCUMENT_TYPES`, audit-dossier.ts:230 — indicateur sans clause
    // `conditionnel`, donc TOUJOURS applicable, indicateurs-registre.ts:137-141 ;
    // les pièces d'un indicateur non applicable seraient masquées, :464-465, et
    // une rubrique à compte nul est retirée, :472).
    const attestationsAuManifeste = (manifeste.indicateurs ?? [])
      .flatMap((i) => i.documents ?? [])
      .filter((d) => d.type === "attestation")
      .reduce((max, d) => Math.max(max, d.count), 0);
    expect(
      attestationsAuManifeste,
      `le manifeste ne compte AUCUNE attestation, alors que ${ATTESTATION_DEMO} existe au ` +
        "seed (demo.ts:1459-1474). Deux causes à distinguer : (1) `pnpm qualiopi:seed-demo` " +
        "n'a pas tourné ; (2) la pièce a été ANNULÉE par une exécution précédente — " +
        "`pieceAdmissibleAuDossier()` exige `annuleeAt: null` (audit-dossier.ts:56-64), et " +
        "relancer le seed NE LA RÉPARE PAS : l'upsert porte `update: {}` (demo.ts:1461), il " +
        "ne ramène pas la pièce à l'état voulu. C'est le patch 1 du plan de phase 6.",
    ).toBeGreaterThanOrEqual(1);

    // Le Markdown est ce que l'auditrice LIT ; le JSON, ce qu'elle archive.
    const markdown = contenuDe(fichiers, nomMd, "manifeste Markdown");
    expect(
      markdown,
      "le Markdown exporté est celui du mode build (« Mode build — données indisponibles », " +
        "audit-dossier.ts:851) : le fichier existe, il ne contient rien d'opposable",
    ).not.toContain("Mode build");
    expect(
      markdown,
      "le Markdown exporté ne va pas jusqu'au critère 7 : le rendu s'est interrompu, ou la " +
        "matrice ne portait pas les sept critères (`buildMarkdown`, audit-dossier.ts:772-778)",
    ).toContain("## Critère 7");

    // ── 3. Les deux registres, ATTEINTS PAR UN CLIC ────────────────────────
    //
    // 🔴 L'ancienne version faisait `page.goto()` puis lisait `status()`. Les deux
    // pages portent un `redirect()` vers /login qui rend **200**
    // (emargement/page.tsx:194-196, signatures/page.tsx:347-349) : le contrôle
    // était aveugle à la seule panne qu'il prétendait garder. On clique le lien
    // que l'écran offre (mode-auditeur/page.tsx:81-97) et on lit le titre.
    await page
      .locator(CONTENU)
      .getByRole("link", { name: /^Registre des signatures d'émargement/ })
      .click({ timeout: ARRIVEE }); // cf. `ARRIVEE_ECRAN` (_communs.ts) : le clic paie l'attente de SA navigation.
    await arriverSur(
      page,
      /\/qualiopi\/mode-auditeur\/emargement$/,
      "ouverture du registre des signatures d'émargement",
    );
    await expect(
      titreEcran(page),
      "le registre d'émargement n'a pas rendu son titre — un `redirect()` vers /login " +
        "aurait rendu 200 et affiché « Connexion admin »",
    ).toHaveText("Registre des signatures d'émargement", { timeout: ARRIVEE });

    // La ligne de compte est rendue INCONDITIONNELLEMENT (emargement/page.tsx:240-245) :
    // sa présence prouve que la page est allée au bout de son rendu, et sa valeur
    // dit à l'auditrice ce qu'elle regarde.
    //
    // ⚠️ CONSTAT, et non défaut de test : le seed de démonstration n'écrit AUCUN
    // `EmargementSignature` (vérifié le 2026-08-23 : zéro occurrence dans
    // `demo.ts`), et `listerRegistreEmargement` ne retient que les inscriptions
    // qui en portent une vivante (registre-emargement.ts:100). Ce registre est
    // donc VIDE avec le dossier de démonstration : ON NE PEUT PAS PROUVER ICI
    // qu'une chaîne de signatures tient, et il serait malhonnête de l'écrire. Le
    // compte, lui, doit être affiché — et c'est ce qu'on exige.
    const registreEmargement = (await page.locator(CONTENU).innerText())
      .replace(/\s+/g, " ")
      .trim();
    await info.attach("registre-emargement.txt", {
      body: registreEmargement.slice(0, 2000),
      contentType: "text/plain",
    });
    expect(
      registreEmargement,
      "le registre d'émargement n'écrit pas son compte « N inscriptions · M chaînes " +
        "altérées » (emargement/page.tsx:241) : l'auditrice ne sait pas si elle lit un " +
        "registre vide ou un rendu interrompu",
    ).toMatch(/\d+ inscriptions? · \d+ chaînes? altérées?/);

    // Retour au point de départ pour atteindre l'autre registre. La page a déjà
    // été prouvée atteignable ET rendue plus haut dans ce même test : y revenir
    // par l'URL ne masque rien.
    await ouvrir(page, "qualiopi/mode-auditeur");
    await page
      .locator(CONTENU)
      .getByRole("link", { name: /^Registre des signatures de pièces/ })
      .click({ timeout: ARRIVEE }); // cf. `ARRIVEE_ECRAN` (_communs.ts) : le clic paie l'attente de SA navigation.
    await arriverSur(
      page,
      /\/qualiopi\/mode-auditeur\/signatures$/,
      "ouverture du registre des signatures de pièces",
    );
    await expect(
      titreEcran(page),
      "le registre des signatures n'a pas rendu son titre — un `redirect()` vers /login " +
        "aurait rendu 200 et affiché « Connexion admin »",
    ).toHaveText("Registre des signatures", { timeout: ARRIVEE });

    // Les cinq compteurs de tête (signatures/page.tsx:403-413) sont le résumé que
    // l'auditrice lit en premier. « Pièces suivies » est le dénominateur de tous
    // les autres : sans lui, aucun des quatre chiffres d'alerte ne se lit.
    await expect(
      page.locator(CONTENU).getByText("Pièces suivies"),
      "le registre des signatures n'affiche pas son compteur « Pièces suivies » : le rendu " +
        "s'est arrêté avant le résumé (signatures/page.tsx:404)",
    ).toBeVisible({ timeout: 30_000 });
  });

  test("n'importe qui vérifie l'attestation de démonstration par son jeton public", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");

    // Aucune connexion : c'est tout l'objet d'une vérification publique. Et
    // l'URL directe EST le geste réel — le porteur scanne un QR imprimé
    // (documents/qr.ts, templates/attestation.tsx), il ne navigue pas dans un
    // menu.
    const reponse = await page.goto(`/fr/verifier-attestation/${JETON_DEMO}`, {
      waitUntil: "domcontentloaded",
      timeout: ARRIVEE,
    });
    // 🔑 CE MESSAGE PORTE TOUT LE DIAGNOSTIC DU TEST. Si le document est absent,
    // la page rend `notFound()` (page.tsx:143-145) et RIEN de ce qui suit ne
    // s'exécute : c'est le seul texte que quelqu'un lira. Il doit donc orienter.
    expect(
      reponse?.status(),
      `la vérification publique d'attestation répond ${reponse?.status()} au lieu de 200 — ` +
        "c'est la promesse faite au stagiaire et à son financeur. Un 404 signifie que la " +
        "pièce est ABSENTE, PAS qu'elle est morte : le jeton d'une attestation annulée est " +
        "délibérément conservé (page.tsx:20-23), et une pièce annulée répond 200 avec un " +
        "bandeau rouge. Deux causes, donc : (1) `pnpm qualiopi:seed-demo` n'a pas tourné ; " +
        "(2) `DEMO.ATTESTATION_QR` (demo.ts:353) a changé sans que la constante " +
        "`JETON_DEMO` de ce fichier suive.",
    ).toBe(200);

    // La page publique vit sous la coquille `[locale]`, qui porte l'unique
    // `<main id="main">` (layout.tsx:370). On y scope tout : la bannière de
    // consentement (`role="dialog"`) et le pied de page restent dehors.
    const verif = page.locator("main#main");
    await expect(
      page.getByRole("heading", { level: 1, name: "Vérification de document" }),
      "la page de vérification n'a pas rendu son titre " +
        "(verifier-attestation/[token]/page.tsx:222)",
    ).toBeVisible({ timeout: ARRIVEE });

    const texte = (await verif.innerText()).replace(/\s+/g, " ").trim();
    await info.attach("verification-attestation.txt", {
      body: texte.slice(0, 3000),
      contentType: "text/plain",
    });

    // ── Le BANDEAU de validité ─────────────────────────────────────────────
    //
    // 🔴 L'ancienne version cherchait `/introuvable|invalide|inconnu|expiré/i`
    // dans le corps de la page. AUCUNE de ces quatre chaînes n'existe dans les
    // trois états rendus (page.tsx:164-219). Conséquence mesurée : une
    // attestation ANNULÉE affiche « Document annulé — ne fait plus foi » (:167)
    // et passait au VERT. Le test certifiait une pièce morte.
    //
    // 🔑 Les trois états sont mutuellement exclusifs (`resolveStatut`, :90-99) et
    // chacun rend exactement un noeud `role="status"` ou `role="alert"`. On exige
    // donc qu'il y en ait UN SEUL — deux bandeaux voudraient dire que deux
    // verdicts coexistent — puis on lit CE noeud : la valeur reçue nomme l'état
    // réel quand ce n'est pas celui qu'on attend.
    const bandeau = verif.locator('[role="status"], [role="alert"]');
    await expect(
      bandeau,
      "la page de vérification n'affiche pas exactement UN bandeau de validité : les trois " +
        "états (annulé / remplacé / authentique) sont mutuellement exclusifs (page.tsx:164-219) " +
        "et il en faut toujours un. Zéro = un document sans verdict, qui ne vérifie rien ; " +
        "deux = deux verdicts contradictoires sur la même pièce.",
    ).toHaveCount(1, { timeout: 30_000 });
    const verdict = (await bandeau.innerText()).replace(/\s+/g, " ").trim();
    expect(
      verdict,
      "le jeton de démonstration désigne une pièce qui ne fait plus foi. " +
        "« Document annulé — ne fait plus foi » (page.tsx:167) veut dire qu'une exécution " +
        "précédente l'a annulée : relancer `pnpm qualiopi:seed-demo` NE LA RÉPARE PAS, " +
        "l'upsert porte `update: {}` (demo.ts:1461) — c'est le patch 1 du plan de phase 6. " +
        "« Document remplacé par … » (page.tsx:196) veut dire qu'une version rectifiée lui " +
        "a succédé, et que c'est l'autre numéro qui fait foi.",
    ).toContain("Document authentique");

    // ── La FICHE : ce que la page prétend certifier ────────────────────────
    //
    // 🔴 `texte.length > 120` était franchi par le seul bandeau statique
    // (« Document authentique » + sa phrase de 101 caractères, page.tsx:213-217 =
    // 121) : le seuil était vert sur une fiche entièrement vide. On asserte les
    // QUATRE champs que le financeur regarde, un par un, pour que l'échec dise
    // lequel manque.
    const fiche = verif.locator("dl").first();
    await expect(
      fiche,
      "la fiche ne nomme pas le TYPE de la pièce — `DOC_TYPE_LABELS.attestation` " +
        "(page.tsx:56) : le porteur ne sait pas ce qu'il tient",
    ).toContainText("Attestation de fin de formation", { timeout: 30_000 });
    await expect(
      fiche,
      `la fiche ne porte pas le numéro ${ATTESTATION_DEMO} : le jeton a résolu une AUTRE ` +
        "pièce que celle du dossier de démonstration (demo.ts:352, écrit en :1463)",
    ).toContainText(ATTESTATION_DEMO, { timeout: 30_000 });
    await expect(
      fiche,
      "la fiche ne nomme pas la session : sans elle, l'attestation ne se rattache à aucune " +
        "action de formation (page.tsx:266-276 ; titre posé au seed, demo.ts:551)",
    ).toContainText("Innovatech Solutions", { timeout: 30_000 });
    await expect(
      fiche,
      `la fiche ne nomme pas le stagiaire « ${STAGIAIRE_ATTESTE} ». Le patronyme est ` +
        "volontairement réduit à son initiale (page.tsx:77-80) — chercher « Marie Martin » " +
        "ne matcherait jamais — mais l'absence totale du nom signifie que la relation " +
        "`trainee` n'a pas été résolue.",
    ).toContainText(STAGIAIRE_ATTESTE, { timeout: 30_000 });

    // ── CONTRE-TÉMOIN : un jeton bidon doit être REFUSÉ ────────────────────
    //
    // Sans lui, une page qui validerait tout passerait tous les contrôles
    // ci-dessus.
    //
    // 🔴 Un premier jet cherchait le mot « introuvable » dans le corps de la
    // page. Il lisait le corps d'une page 404, souvent vide au moment de la
    // mesure, et concluait que le jeton inventé était ACCEPTÉ. Or le produit
    // fait exactement ce qu'il faut : il répond **404**.
    //
    // 🔑 Sur un refus, le statut HTTP est le signal fort et non ambigu ; le
    // texte n'est qu'un confort. On assertait le confort.
    const refusee = await page.goto("/fr/verifier-attestation/JETON-QUI-NEXISTE-PAS-0000", {
      waitUntil: "domcontentloaded",
      timeout: ARRIVEE,
    });
    expect(
      refusee?.status(),
      "un jeton inventé doit être refusé par la vérification publique — " +
        `elle répond ${refusee?.status()}. Un 200 ici signifierait que les assertions ` +
        "positives ci-dessus ne discriminent rien : la page accepterait n'importe quoi.",
    ).toBe(404);
  });
});
