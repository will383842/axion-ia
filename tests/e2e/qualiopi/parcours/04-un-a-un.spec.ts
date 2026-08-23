/**
 * PARCOURS 4 — Prestation 1-À-1 : la bifurcation du wizard de vente.
 *
 * Phase 6 de `_AUDIT/PROMPT-AUDIT-QUALIOPI-E2E-50-AGENTS-2026-08-18.md`.
 *
 * ⚠️ CADRAGE, et il change ce parcours. Le prompt d'audit du 2026-08-18 demande
 * un parcours « 1-to-1 / AFEST ». Or la chaîne AFEST a été RETIRÉE du périmètre
 * Qualiopi le 2026-08-10 — « le 1-to-1 est du conseil, hors Qualiopi », décision
 * du 2026-07-17, inscrite en tête de `scripts/qualiopi/e2e-qualiopi-run.sh` et
 * de `scripts/qualiopi/e2e-formations-verif.ts`.
 *
 * Jouer ici une chaîne documentaire Qualiopi sur du 1-à-1 reviendrait donc à
 * vérifier une exigence que l'organisme a explicitement écartée. Ce que le
 * produit doit garantir, en revanche, c'est que le wizard **bifurque** : une
 * prestation individuelle ne réclame pas de formation Qualiopi publiée, et
 * l'écran ne doit pas présenter un sélecteur qui resterait vide.
 *
 * C'est exactement ce que le composant dit vouloir faire (vente/new/page.tsx:97-99) :
 *
 *     Une formation collective et un accompagnement individuel ne se vendent
 *     pas pareil : le wizard doit bifurquer, pas proposer un sélecteur de
 *     formation qui restera vide.
 *
 * Ce parcours vérifie que l'intention est tenue.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ORDRE D'ATTERRISSAGE — CE FICHIER NE COMPILE PAS SEUL
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Il importe `CONTENU` de `./_communs`. Mesuré le 2026-08-23 sur le worktree :
 * `_communs.ts` n'exporte encore que `Modalite`, `ENREGISTREMENT`, `admin`,
 * `horodatage`, `champEtiquete`, `creerSession`, `ouvrirSessionDemo`. Le patch
 * du socle (qui ajoute `CONTENU`, `STAGIAIRES_DEMO`, `horodatageZoom`,
 * `inscrire`) doit atterrir AVANT ce fichier — sinon TS2305, et c'est la suite
 * e2e ENTIÈRE qui ne se charge plus, pas seulement ce parcours.
 *
 * On ne recopie surtout pas `".admin-main"` en clair ici : un prédicat recopié
 * diverge toujours, et c'est précisément la duplication que le socle supprime.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUE CE FICHIER PROUVE, ET COMMENT — RÉÉCRITURE DU 2026-08-23
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 🔴 La version précédente NE POUVAIT PAS prouver son titre, et se terminait
 * par un `return` après un `console.warn`. Trois défauts, tous de familles déjà
 * payées dans ce dépôt :
 *
 *   1. **Le classement des offres était un prédicat RECOPIÉ.** Elle rangeait
 *      une offre du côté « individuel » avec une expression régulière sur son
 *      LIBELLÉ (`/1-to-1|individuel|dirigeant|accompagnement/i`). Le produit,
 *      lui, décide sur `OffreSite.formatPedagogique`
 *      (famille-prestation.ts:44-54, via vente/new/page.tsx:100). Deux prédicats
 *      concurrents divergent toujours — et celui du test aurait rangé du mauvais
 *      côté toute offre COLLECTIVE dont le titre contiendrait « accompagnement ».
 *   2. **`expect(fautives).toEqual([])` portait sur un ensemble JAMAIS REMPLI.**
 *      Aucune offre 1-à-1 n'étant active, `individuelles` valait `[]`, donc
 *      `fautives` aussi : l'assertion centrale était verte par construction.
 *   3. **Le `return` de la ligne 140 était un TROU NOIR.** Le parcours sortait
 *      sans avoir rien observé du wizard, et laissait un VERT derrière lui.
 *
 * 🔑 La réécriture change de source de vérité : la famille d'une offre est
 * LUE SUR L'ÉCRAN du référentiel (`/qualiopi/offres`), à l'endroit exact où le
 * produit la projette — la colonne « chemin public », qui vaut `/un-a-un` pour
 * la famille individuelle et pour elle seule (famille-prestation.ts:83-93). Le
 * test ne redevine plus rien : il lit la décision du produit, puis vérifie que
 * le wizard s'y conforme.
 *
 * Trois tests, dans cet ordre, et l'ordre est PORTANT (`mode: "serial"`) :
 *
 *   1. LE RÉFÉRENTIEL — la famille 1-à-1 existe-t-elle, et quelles offres sont
 *      actives ? Assertions dures. C'est la mesure dont les deux suivants
 *      partent.
 *   2. LE CONTRE-TÉMOIN — une offre COLLECTIVE présente bien son sélecteur de
 *      formation, et débloque bien l'étape 3. Assertions dures. Sans lui, le
 *      test 3 serait vert dans un wizard qui aurait supprimé le sélecteur
 *      PARTOUT, et son « Suivant désactivé » ne prouverait rien : à l'étape 2,
 *      « Suivant » est DÉJÀ désactivé tant qu'aucune offre n'est choisie
 *      (`offreId !== ""`, VenteWizard.tsx:546, lu par :1309).
 *   3. LA BIFURCATION elle-même — le seul test qui porte un marquage
 *      conditionnel (voir le pavé « POINT DE BASCULE » plus bas).
 *
 * 🔑 POURQUOI `mode: "serial"` EST PORTANT ICI, ET PAS DÉCORATIF. Un
 * `info.fail()` inverse le verdict du test ENTIER : une garde posée dans le même
 * test qu'un marquage `fail` est absorbée elle aussi, où qu'elle soit placée.
 * Les gardes qui doivent VRAIMENT rougir (référentiel semé, wizard peuplé,
 * session admin, passage à l'étape 2) vivent donc dans les tests 1 et 2, qui
 * n'ont aucun marquage. En mode `serial`, leur échec SAUTE le test 3 au lieu de
 * le laisser absorber la cause. Retirer `serial` rouvrirait le trou.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ CE HARNAIS EST UNE GATE BLOQUANTE DEPUIS LE 2026-08-23 — RECTIFICATION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Un premier jet de ce fichier écrivait « ce harnais n'est PAS une gate : le
 * step Playwright porte `continue-on-error: true` ». **C'est faux depuis le
 * 2026-08-23**, et raisonner dessus serait raisonner sur une fausse sécurité —
 * à l'envers de d'habitude, mais tout aussi coûteux. Mesuré ligne par ligne :
 *
 *   · le step « Playwright suite » (ci.yml:443, `run` :519) ne porte PLUS de
 *     `continue-on-error` ; le commentaire :479-499 documente le retrait et la
 *     trajectoire qui l'a permis (0/237 → 224/3 → 0 échec) ;
 *   · le seul `continue-on-error: true` de la zone (ci.yml:558) appartient au
 *     step SUIVANT, « Lighthouse CI » (:535) — c'est lui que l'ancien
 *     commentaire lisait, d'un cran trop bas ;
 *   · `Gate B · per-PR` (ci.yml:133) est un contexte EXIGÉ par la protection de
 *     `main`, en `strict: true` : ci.yml:495-499 le dit en toutes lettres —
 *     **un rouge ici bloque 100 % des PR, pas seulement la sienne.**
 *
 * 🔑 Conséquence directe sur l'écriture de ce fichier, et elle n'est pas
 * cosmétique : un rouge permanent posé ici pour dénoncer un défaut de CATALOGUE
 * mettrait tout le dépôt à l'arrêt, et la pression pousserait quelqu'un à
 * « corriger » le test — ou à activer l'offre — au lieu de trancher la question
 * commerciale. C'est la jurisprudence « un rouge de CI poussait à violer un
 * contrat écrit » : on retire la PRESSION, jamais le contrat. D'où le marquage
 * conditionnel du test 3, et l'escalade écrite plutôt qu'un blocage global.
 *
 * Pré-requis : `pnpm qualiopi:seed` (référentiel des offres) PUIS
 * `pnpm qualiopi:seed-demo` (dossier de démonstration). La CI fait les deux,
 * dans cet ordre (ci.yml:399 et :415).
 */

import { test, expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { loginAsAdmin } from "../../fixtures/admin-auth";
import { admin, CONTENU, ENREGISTREMENT, ouvrir } from "./_communs";

test.use(ENREGISTREMENT);

/**
 * Délai d'une navigation vers un écran de la console.
 *
 * Sous `next dev`, la route se compile à la demande au premier appel : les 30 s
 * du `navigationTimeout` global (playwright.config.ts:37) n'y suffisent pas, et
 * l'échec ressemblerait alors à une page morte. En CI, le build est déjà fait.
 */
const DELAI_ECRAN = process.env["CI"] === "true" ? 60_000 : 120_000;

/**
 * Délai d'une action serveur du wizard (`createVenteBrouillonAction` puis
 * `updateVenteBrouillonAction`, VenteWizard.tsx:290 et :298, enchaînées par
 * `persisterBrouillon` :284-312). Même raison : sous `next dev`, la PREMIÈRE
 * soumission compile l'action à la demande.
 *
 * ⚠️ Reste STRICTEMENT sous le budget de la suite : un délai plus long que le
 * budget qui le contient ne peut jamais expirer — c'est alors le message
 * générique du budget qui rend le verdict, et le message précis écrit ici
 * devient inatteignable. Cliquet :
 * `tests/unit/e2e-harness/delai-interne-sous-le-budget.spec.ts`.
 */
const DELAI_ACTION = process.env["CI"] === "true" ? 60_000 : 180_000;

/** Délai d'un repeint React déjà déclenché : on attend un rendu, pas un serveur. */
const DELAI_REPEINT = 15_000;

/**
 * LE discriminant de famille, et la seule chaîne de classement que ce fichier
 * recopie.
 *
 * 🔑 `cheminPublicOffre()` (famille-prestation.ts:83-93) projette la famille
 * d'une offre sur son chemin public, et l'écran du référentiel l'affiche sous
 * le titre (offres/page.tsx:155-157) :
 *
 *     collectif  → `/formations/<slug>`   (ou « — » si le slug est vide)
 *     un_a_un    → `/un-a-un`             ← page unique, sans fiche par presta
 *     sur_devis  → « — »                  (pas de page vitrine)
 *
 * On lit donc la famille LÀ OÙ LE PRODUIT LA DIT, au lieu de la redéduire d'un
 * libellé. Et le contre-témoin du test 1 (« au moins une ligne collective »)
 * garantit que cette chaîne discrimine vraiment, au lieu de tout prendre ou de
 * ne rien prendre.
 *
 * ⚠️ POURQUOI PAS la colonne « Format » (offres/page.tsx:169-171), l'autre
 * candidat : elle rend `FORMAT_LABELS`, donc DEUX littéraux à recopier ici
 * (« Dirigeant · 1-to-1 » ET « Individuel »), plus un de plus à chaque valeur
 * d'enum rangée un jour du côté individuel (famille-prestation.ts:44-54). Le
 * chemin public, lui, EST déjà l'agrégation des deux.
 */
const CHEMIN_PUBLIC_UN_A_UN = "/un-a-un";

/** Préfixe du chemin public d'une offre COLLECTIVE (famille-prestation.ts:86). */
const CHEMIN_PUBLIC_COLLECTIF = "/formations/";

/**
 * Les deux seules valeurs de la colonne « Statut » (offres/page.tsx:178-184).
 *
 * 🔴 PIÈGE, et il serait fatal en silence : « Inactive » CONTIENT « active ».
 * Un `/active/i`, un `hasText: "Active"` ou un `.includes()` insensible à la
 * casse rangent donc les offres DÉSACTIVÉES parmi les actives — et le parcours
 * conclurait que la bifurcation est vendable alors qu'elle ne l'est pas. On
 * compare la chaîne ENTIÈRE, pastille comprise, et le test 1 refuse toute
 * valeur qu'il ne sait pas lire plutôt que de la ranger par défaut.
 */
const STATUT_ACTIVE = "● Active";
const STATUT_INACTIVE = "○ Inactive";

/**
 * Le client du dossier de démonstration (numéro : demo.ts:346, raison sociale
 * :386). L'`<option>` du wizard compose `{numero} — {raisonSociale}`
 * (VenteWizard.tsx:671), et le filtre de recherche compare AUSSI le numéro
 * (:246-252) : viser le numéro suffit, et il est unique.
 *
 * On désigne un client NOMMÉ plutôt que `selectOption({ index: 1 })` : la liste
 * est triée par raison sociale (vente/new/page.tsx:60) et le parcours 5 y ajoute
 * deux fiches à chaque exécution — l'index 1 ne désigne donc rien de stable.
 */
const CLIENT_DEMO = "AXI-CLI-DEMO-001";

/** Une ligne du référentiel des offres, telle que l'écran l'affiche. */
interface LigneOffre {
  code: string;
  titre: string;
  /** Deuxième `<div>` de la cellule « Titre » : le chemin public, ou « — ». */
  cheminPublic: string;
  format: string;
  /** Texte brut de la colonne « Statut », pastille comprise. */
  statut: string;
  active: boolean;
  unAUn: boolean;
  /**
   * 🔴 « collectif » n'est PAS « tout ce qui n'est pas 1-à-1 ». `sur_devis` est
   * sa PROPRE famille (famille-prestation.ts:53), volontairement : « Sur
   * demande » couvre aussi bien un collectif atypique qu'un accompagnement, et
   * la ranger d'office enverrait l'admin sur un mauvais parcours. Un premier jet
   * balayait « tout sauf 1-à-1 » et appelait « offres COLLECTIVES » un ensemble
   * qui contenait « Sur demande » : le message nommait mal ce qu'il mesurait.
   */
  collectif: boolean;
}

/** Une `<option>` lue avec son texte ET sa valeur, en UNE seule résolution. */
interface OptionLue {
  texte: string;
  valeur: string;
}

/**
 * Le texte de la ZONE DE CONTENU, pour un message d'échec qui nomme la cause.
 *
 * 🔴 Ni `body` ni `main` ne conviennent ici. Depuis le 2026-08-22, le layout
 * admin n'ouvre PLUS son propre `<main>` (il héritait de celui du site et en
 * produisait un SECOND, imbriqué — trois violations axe `moderate` par page,
 * layout.tsx:396-404). Le `<main>` unique est donc celui du site, et il
 * enveloppe le rail de navigation : un diagnostic construit dessus emporterait
 * la barre latérale et la topbar, et NOIERAIT la cause au lieu de la nommer. Le
 * conteneur de contenu est `CONTENU` (`.admin-main`, admin.css:895, posé par
 * layout.tsx:404), tranché une fois dans `_communs.ts` et jamais réécrit ici.
 *
 * `.first()` : la coquille de connexion porte le même conteneur (layout.tsx:418)
 * — si la session a sauté, c'est justement l'écran qu'on veut lire.
 */
async function contenuVisible(page: Page): Promise<string> {
  const texte = await page
    .locator(CONTENU)
    .first()
    .innerText()
    .catch(() => "(texte illisible)");
  return texte.replace(/\s+/g, " ").trim().slice(0, 600);
}

/** Lit `<option>` texte + valeur d'un `<select>` en UNE résolution du DOM. */
async function lireLesOptions(selecteur: Locator): Promise<OptionLue[]> {
  return selecteur.locator("option").evaluateAll((els) =>
    els.map((e) => ({
      texte: (e.textContent ?? "").replace(/\s+/g, " ").trim(),
      valeur: (e as HTMLOptionElement).value,
    })),
  );
}

/**
 * Relève le référentiel des offres depuis `/qualiopi/offres`, vue `toutes`.
 *
 * ⚠️ `?vue=toutes` n'est PAS atteignable par un clic : la décision Will du
 * 2026-07-24 masque les archives de l'interface — sans onglet ni compteur — et
 * l'échappatoire par URL est volontairement non exposée (archive-filter.ts:32-35,
 * `parseArchiveFilter` :49-52). Un parcours qui « joue ce qu'un humain fait » ne
 * peut donc pas voir une offre désactivée autrement. On compose l'URL, et on le
 * DIT : c'est un constat sur la console, pas une commodité de test — une offre
 * désactivée est aujourd'hui invisible, donc non réactivable, au clic.
 */
async function releverLesOffres(page: Page, info: TestInfo): Promise<LigneOffre[]> {
  await ouvrir(page, "qualiopi/offres", `?vue=toutes`);

  // 🔑 On attend un CONTENU, jamais un état de réseau. La console admin ne se
  // tait pas côté réseau : `networkidle` y consomme le budget entier puis rend
  // « Test timeout exceeded », sans nommer la cause. Jurisprudence 2026-08-21,
  // et cliquet dans `tests/unit/e2e-harness/delai-interne-sous-le-budget.spec.ts`.
  try {
    await expect(page.getByRole("heading", { level: 1, name: "Offres (référentiel)" })).toBeVisible(
      { timeout: DELAI_ECRAN },
    );
  } catch (cause) {
    throw new Error(
      "l'écran du référentiel des offres ne s'est pas affiché. Deux causes, et le " +
        "message doit permettre de les distinguer : (1) la session admin n'a pas été " +
        "ouverte, et `offres/page.tsx:65-67` a redirigé vers /login ; (2) la page n'a " +
        `pas fini de rendre (H1 posé par AdminPageHeader, offres/page.tsx:91-95). ` +
        `URL : ${page.url()} — Écran : ${await contenuVisible(page)}`,
      { cause },
    );
  }

  // Le tableau est ancré sur un de ses en-têtes plutôt que sur `table` nu : le
  // jour où l'écran en porte deux, un locator non ancré prendrait le premier du
  // DOM sans rien dire — famille de défaut déjà payée quatre fois ici.
  //
  // ⚠️ Motif INSENSIBLE À LA CASSE : le `<th>` porte la classe `uppercase`
  // (offres/page.tsx:86-87). Le texte du DOM reste « Format », mais exiger cette
  // casse-là ferait dépendre le parcours d'un détail de calcul du nom
  // accessible, pour un gain nul.
  const tableau = page.locator("table", {
    has: page.getByRole("columnheader", { name: /^format$/i }),
  });
  // 🔑 C'est ICI, et nulle part ailleurs, que le cas « référentiel vide » peut
  // se produire : le `<table>` n'est rendu que dans la branche `offres.length
  // !== 0` (offres/page.tsx:109 puis :122-124). Un premier jet ajoutait plus
  // loin un `expect(lignes.length).toBeGreaterThan(0)` avec un beau message :
  // cette assertion-là ne pouvait JAMAIS rougir, le cas étant intercepté deux
  // assertions plus tôt. Le message vit donc là où le défaut vit.
  await expect(
    tableau,
    "aucun tableau d'offres sur l'écran. Soit le référentiel est VIDE — la page " +
      "affiche alors « Aucune offre. Initialisez le référentiel ci-dessous. » " +
      "(offres/page.tsx:113) et il faut lancer `pnpm qualiopi:seed`, qui sème les dix " +
      "offres métier (prisma/seeds/qualiopi/index.ts:86) — soit les en-têtes de " +
      "colonnes ont changé et ce relevé ne sait plus lire la page",
  ).toHaveCount(1);

  // Cinq relevés d'ensemble plutôt que cinq lectures par ligne : ~67 offres
  // × 5 allers-retours coûteraient plus que tout le reste du parcours réuni.
  // Colonnes : Code(1) Titre(2) Gamme(3) Format(4) Durée(5) Prix(6) Statut(7)
  // Action(8) — offres/page.tsx:127-134.
  //
  // 🔑 La cellule « Titre » porte DEUX `<div>` : le titre, puis le chemin public
  // (offres/page.tsx:145-158). On lit les deux SÉPARÉMENT plutôt que de découper
  // un `innerText` sur ses sauts de ligne : le découpage marchait, mais il
  // reposait sur le fait qu'un titre long ne produit pas de `\n` — une propriété
  // de rendu, pas un contrat.
  const corps = tableau.locator("tbody");
  const [codes, titres, cheminsPublics, formats, statuts] = await Promise.all([
    corps.locator("tr td:nth-child(1)").allInnerTexts(),
    corps.locator("tr td:nth-child(2) div:nth-child(1)").allInnerTexts(),
    corps.locator("tr td:nth-child(2) div:nth-child(2)").allInnerTexts(),
    corps.locator("tr td:nth-child(4)").allInnerTexts(),
    corps.locator("tr td:nth-child(7)").allInnerTexts(),
  ]);

  // Un désalignement signifierait qu'une ligne ne porte pas toutes ses cellules :
  // toute lecture par index serait alors décalée, et les conclusions fausses
  // SANS que rien ne rougisse. On refuse plutôt que de composer à l'aveugle.
  expect(
    [titres.length, cheminsPublics.length, formats.length, statuts.length],
    `les colonnes du référentiel ne portent pas toutes ${codes.length} cellules — ` +
      "une ligne n'a pas ses huit `<td>`, ou la cellule « Titre » a perdu l'un de ses " +
      "deux `<div>` (offres/page.tsx:145-158), et toute lecture par index serait décalée",
  ).toEqual([codes.length, codes.length, codes.length, codes.length]);

  const propre = (v: string | undefined): string => (v ?? "").replace(/\s+/g, " ").trim();

  const lignes: LigneOffre[] = codes.map((code, i) => {
    const statut = propre(statuts[i]);
    const cheminPublic = propre(cheminsPublics[i]);
    return {
      code: propre(code),
      titre: propre(titres[i]),
      cheminPublic,
      format: propre(formats[i]),
      statut,
      active: statut === STATUT_ACTIVE,
      unAUn: cheminPublic === CHEMIN_PUBLIC_UN_A_UN,
      collectif: cheminPublic.startsWith(CHEMIN_PUBLIC_COLLECTIF),
    };
  });

  await info.attach("referentiel-offres.json", {
    body: JSON.stringify(lignes, null, 2),
    contentType: "application/json",
  });

  return lignes;
}

/**
 * Ouvre le wizard de vente, choisit le client de démonstration, et passe à
 * l'étape 2. Rend l'identifiant du client retenu.
 *
 * ⚠️ EFFET DE BORD ASSUMÉ, ET NON NETTOYABLE AU CLIC. Passer d'une étape à la
 * suivante SAUVEGARDE un `VenteBrouillon` (`allerEtape` → `persisterBrouillon`,
 * VenteWizard.tsx:314-319). Chaque exécution de ce parcours laisse donc un
 * brouillon de plus dans « Ventes en cours » — et `supprimerVenteBrouillonAction`
 * n'a AUCUN appelant d'interface : vérifié, son unique appelant du dépôt est
 * VenteWizard.tsx:500, automatique, à la conversion en session. Un admin ne peut
 * pas jeter une vente abandonnée. C'est un constat d'audit, pas un défaut de ce
 * test : il est remonté tel quel plutôt que contourné.
 */
async function ouvrirEtape2(page: Page): Promise<string> {
  await ouvrir(page, "qualiopi/vente/new");
  try {
    await expect(page.getByRole("heading", { name: /Étape 1 — Pour quel client/ })).toBeVisible({
      timeout: DELAI_ECRAN,
    });
  } catch (cause) {
    throw new Error(
      "le wizard de vente ne s'est pas affiché. Soit la session admin n'a pas été " +
        "ouverte — `vente/new/page.tsx:44-46` redirige alors vers /login — soit la " +
        `page n'a pas fini de rendre. URL : ${page.url()} — Écran : ${await contenuVisible(page)}`,
      { cause },
    );
  }

  // `modeClient` vaut déjà « existant » au premier rendu (VenteWizard.tsx:197-201) :
  // `check()` ne cliquera donc pas. On le joue quand même — c'est le geste de
  // l'humain, et une dérive future du rendu initial se verrait ici.
  await page.getByRole("radio", { name: "Client existant" }).check();

  const client = page.getByLabel("Client", { exact: true });
  await expect(
    client,
    'le sélecteur de client (`aria-label="Client"`, VenteWizard.tsx:665) est ' +
      "introuvable : le mode « Client existant » n'est pas actif, ou la page n'est " +
      "pas hydratée",
  ).toHaveCount(1);

  // Le champ de recherche filtre EN MÉMOIRE la liste déjà chargée
  // (`clientsFiltres`, VenteWizard.tsx:246-252) : il ne va pas rechercher en base.
  const recherche = page.getByLabel("Rechercher un client");

  // 🔴 DEUX DÉFAUTS DE LA MÊME FAMILLE, REFERMÉS ENSEMBLE ICI.
  //
  //  (a) LIRE PUIS RÉ-RÉSOUDRE PAR INDEX. Un premier jet faisait
  //      `allTextContents()`, cherchait l'index du client, puis relisait
  //      `option.nth(index).getAttribute("value")`. Entre les deux résolutions,
  //      le repeint déclenché par le `fill` peut atterrir : la liste passe de
  //      N+1 options à 2, et `nth(37)` ne désigne plus rien. L'échec dit
  //      « waiting for locator … option >> nth(37) » — un message qui ne
  //      ressemble pas à sa cause. On lit donc texte ET valeur en UNE seule
  //      résolution (`evaluateAll`).
  //
  //  (b) MESURER AVANT QUE LE FILTRE AIT AGI. Sans attente, la liste lue est
  //      encore la liste ENTIÈRE, et le message d'échec qui parlait de « après
  //      filtrage » et du `take: 500` envoyait chercher au mauvais endroit.
  //      On attend donc un ÉTAT OBSERVABLE du filtre : toute option non vide
  //      porte le numéro cherché. Le filtre compare raison sociale ET numéro
  //      (VenteWizard.tsx:246-252), et le numéro est unique — cet état ne peut
  //      pas être celui d'une liste non filtrée DÈS QUE LE CRM COMPTE DEUX
  //      FICHES.
  //
  //      ⚠️ ET C'EST TOUT CE QUE CE SONDAGE PROUVE. Un premier jet écrivait
  //      « c'est en même temps une preuve d'hydratation ». C'est FAUX sur la
  //      base de démonstration : `demo.ts:1166` est le seul `client.upsert` du
  //      dépôt et `prisma/seed.ts` n'en crée aucun, donc la liste non filtrée
  //      porte déjà exactement UNE option non vide — la condition est vraie à la
  //      première itération, avant que la frappe ait produit le moindre effet.
  //      Un témoin dont la valeur est atteinte sans le geste ne garde rien.
  //      L'hydratation, elle, est prouvée par le `toBeEnabled` de « Suivant »
  //      plus bas, qui dépend d'un état React.
  let options: OptionLue[] = [];
  try {
    await expect
      .poll(
        async () => {
          // 🔴 2026-08-23 — LE VIDE PUIS LA VALEUR, ET NON LA VALEUR SEULE.
          //
          // Ces deux lignes ont l'air d'un bégaiement. Elles sont la seule forme
          // qui fonctionne, et la raison ne se devine pas.
          //
          // ## Ce qui a été mesuré, dans cet ordre
          //
          // 1. Le parcours posait `fill(CLIENT_DEMO)` UNE fois, juste après
          //    l'apparition du titre d'étape 1, puis sondait. La liste restait
          //    ENTIÈRE — trente options, aucune filtrée — et le message ci-dessous
          //    accusait ses trois causes. Les trois sont réfutées : la fiche
          //    `AXI-CLI-DEMO-001` EST dans la liste (lue à la trentième option,
          //    « [DEMO] Innovatech Solutions SAS »), le CRM compte trente clients
          //    et non cinq cents, et la page est bel et bien hydratée.
          // 2. Le même `fill`, précédé de vingt-cinq secondes d'attente, filtre :
          //    trente options deviennent deux. Ce n'est donc PAS le geste qui est
          //    faux, c'est son INSTANT.
          // 3. Reposer le MÊME `fill` à chaque tour du sondage — la doctrine de
          //    `inscrire` (_communs.ts) — ne répare RIEN ici : trois re-poses
          //    identiques, largement après l'hydratation, laissent les trente
          //    options. Mesuré.
          // 4. `fill("")` puis `fill(CLIENT_DEMO)` : deux options. Mesuré.
          //
          // ## 🔑 La règle que cela dégage, et qui vaut au-delà de ce fichier
          //
          // `fill` ne réémet rien quand la valeur du DOM est DÉJÀ celle demandée.
          // Or un `fill` posé avant l'hydratation écrit précisément cette valeur
          // dans le DOM sans qu'aucun état React ne la reçoive : le DOM et l'état
          // sont désynchronisés, et TOUTE re-pose à l'identique est un no-op. Le
          // champ affiche le bon texte, la liste ignore tout — et rien ne rougit.
          //
          // ⚠️ La doctrine « reposer le geste à chaque tour » ne suffit donc PAS :
          // elle n'est vraie que pour un geste qui émet inconditionnellement.
          // `selectOption` (inscrire, et `choisirLeType` du parcours 05) en est un.
          // `fill` n'en est pas un. Repasser par le vide rend le changement RÉEL
          // dans les deux sens, et resynchronise l'état sur le DOM.
          await recherche.fill("").catch(() => {
            /* champ momentanément indisponible pendant un repeint : on retentera. */
          });
          await recherche.fill(CLIENT_DEMO).catch(() => {
            /* idem. */
          });
          options = await lireLesOptions(client);
          const reels = options.filter((o) => o.valeur !== "");
          return reels.length > 0 && reels.every((o) => o.texte.includes(CLIENT_DEMO));
        },
        // ⚠️ `DELAI_ECRAN`, et NON `DELAI_REPEINT`. Ce sondage est la PREMIÈRE
        // interaction avec le wizard hydraté : sous `next dev`, la compilation
        // de son bundle client peut dépasser les quinze secondes d'un repeint.
        // Avec la borne courte, l'échec accuserait le filtre — alors que le
        // message ci-dessous nomme déjà l'hydratation comme cause possible.
        { timeout: DELAI_ECRAN },
      )
      .toBe(true);
  } catch (cause) {
    throw new Error(
      `le filtrage sur « ${CLIENT_DEMO} » n'a pas abouti à une liste ne contenant que ` +
        "ce client. Trois causes, et le message doit permettre de les distinguer : " +
        "(1) `pnpm qualiopi:seed-demo` n'a pas tourné, le client n'existe pas " +
        "(demo.ts:346) ; (2) la page n'est pas hydratée — la frappe n'a atteint aucun " +
        "état React et `clientsFiltres` (VenteWizard.tsx:246-252) n'a jamais recalculé ; " +
        "(3) la liste des clients est bornée à `take: 500` (vente/new/page.tsx:57-65) et " +
        "le CRM en compte davantage. ⚠️ AVANT d'accuser (3) : le tri est " +
        "`orderBy: { raisonSociale: asc }` (:60), PAS par date. Une fiche « [DEMO] … » se " +
        "classe tôt dans l'alphabet et ne sort des 500 que s'il existe plus de 500 clients dont " +
        "la raison sociale la précède — à vérifier en comptant la table avant de " +
        `conclure. Options réellement lues : ${options
          .map((o) => o.texte)
          .join(" · ")
          .slice(0, 400)}`,
      { cause },
    );
  }

  // `valeur !== ""` plutôt qu'un `index > 0` : le marque-place
  // « — Choisir un client — » porte `value=""` (VenteWizard.tsx:668), et c'est
  // LUI le critère — pas sa position.
  const choisi = options.find((o) => o.texte.includes(CLIENT_DEMO) && o.valeur !== "");
  if (choisi === undefined) {
    throw new Error(
      `aucune option exploitable pour « ${CLIENT_DEMO} » : le filtre a bien agi, mais ` +
        "aucune option ne porte à la fois le numéro et un `value` non vide. Le wizard " +
        "n'enverrait aucun identifiant de client, et le renvoi vers le parcours 1-to-1 " +
        `ne pourrait pas le transporter (VenteWizard.tsx:822-824). Options : ${JSON.stringify(options)}`,
    );
  }
  await client.selectOption(choisi.valeur);

  const suivant = page.getByRole("button", { name: "Suivant" });
  // 🔑 Cette attente vaut SECONDE PREUVE D'HYDRATATION. « Suivant » est
  // `disabled={(etape === 1 && !peutQuitterEtape1) || …}` (VenteWizard.tsx:1309),
  // et `peutQuitterEtape1` (:540) n'est vrai que si l'état React a reçu le
  // client. Tant que React n'a pas hydraté, le `change` du `<select>` ne va
  // nulle part : cliquer ne ferait RIEN et ne dirait RIEN — l'action mourrait
  // sur l'`actionTimeout` de 15 s (playwright.config.ts:36) avec « element is
  // not enabled », symptôme qui ne ressemble pas à sa cause.
  await expect(
    suivant,
    "« Suivant » ne s'est pas activé après le choix du client : la page n'est pas " +
      "hydratée (le `change` du sélecteur n'a atteint aucun état React), ou " +
      "`peutQuitterEtape1` (VenteWizard.tsx:540) n'a pas vu l'identifiant",
  ).toBeEnabled({ timeout: DELAI_ACTION });
  await suivant.click();

  try {
    await expect(page.getByRole("heading", { name: /Étape 2 — Quelle formation/ })).toBeVisible({
      timeout: DELAI_ACTION,
    });
  } catch (cause) {
    throw new Error(
      "le wizard n'est pas passé à l'étape 2. Le passage d'étape enchaîne DEUX " +
        "actions serveur (`createVenteBrouillonAction` :290 puis " +
        "`updateVenteBrouillonAction` :298, dans `persisterBrouillon`, " +
        "VenteWizard.tsx:284-312) : sous `next dev`, la première les compile à la " +
        "demande. Un refus de sauvegarde s'affiche en `toast` (:292 et :307) — le lire " +
        `avant de conclure à une lenteur. URL : ${page.url()} — Écran : ${await contenuVisible(page)}`,
      { cause },
    );
  }

  return choisi.valeur;
}

/** Le code d'une `<option>` du sélecteur d'offres : « CODE — Titre (prix) ». */
function codeDeLOption(texte: string): string | null {
  // VenteWizard.tsx:778-781 compose `{code} — {titre} ({prix})`, suivi
  // éventuellement de « — tarif à revérifier » (:780). On isole le premier jeton
  // plutôt que de couper sur un littéral « — » : un titre peut parfaitement
  // contenir un tiret cadratin, un code `AXI-OFF-NNN` (offres.ts:192,
  // offres-v2.ts:53) ne le peut pas.
  return /^(\S+)\s+—\s/.exec(texte.replace(/\s+/g, " ").trim())?.[1] ?? null;
}

/**
 * Choisit une offre dans le sélecteur du wizard et ATTEND la preuve que React a
 * repeint la liste des formations pour CETTE offre.
 *
 * 🔴 SANS CETTE PREUVE, TOUTE LECTURE EST PÉRIMÉE D'UNE ITÉRATION — et le défaut
 * est muet. `count()` n'est pas réessayable : il rend le nombre d'un DOM déjà
 * résolu. Or `formationsDeLOffre` rend **toutes** les formations tant que
 * `offreId === ""` (`offreId ? filter : formations`, VenteWizard.tsx:242-245) :
 * juste après la PREMIÈRE sélection, une lecture trop tôt compte le catalogue
 * ENTIER, conclut « cette offre porte 22 formations », et retient une offre qui
 * n'en porte peut-être aucune.
 *
 * 🔑 Le repère d'attente doit être un CONTENU, et il doit être PROPRE à l'offre
 * choisie. On compare donc l'ensemble des `value` du sélecteur de formations à
 * celui lu AVANT : une formation appartient à une seule offre (`offreSiteId`,
 * catalog-import.ts:255), donc deux offres non vides ne peuvent pas rendre le
 * même ensemble. Un simple `toHaveValue` sur le `<select>` des offres ne
 * suffirait PAS : le navigateur pose la valeur immédiatement, avant tout rendu
 * React.
 */
async function choisirOffreEtAttendreLeRepeint(
  offre: Locator,
  formation: Locator,
  valeurOffre: string,
  reference: string,
  quoi: string,
): Promise<OptionLue[]> {
  await offre.selectOption(valeurOffre);
  let apres: OptionLue[] = [];
  await expect
    .poll(
      async () => {
        apres = await lireLesOptions(formation);
        return apres.map((o) => o.valeur).join("|");
      },
      {
        timeout: DELAI_REPEINT,
        message:
          `le sélecteur de formations n'a pas changé après le choix de ${quoi} : React ` +
          "n'a pas repeint, ou cette offre porte exactement les mêmes formations que la " +
          "sélection précédente — ce que le modèle interdit (une formation appartient à " +
          "UNE offre, catalog-import.ts:255). Toute lecture faite ici serait périmée " +
          "d'une itération.",
      },
    )
    .not.toBe(reference);
  return apres;
}

test.describe("@parcours-qualiopi 4 — 1-à-1, le wizard bifurque", () => {
  // Budget : trois connexions admin dans une même suite, plus deux traversées du
  // wizard. `loginAsAdmin` seul peut coûter 120 s de compilation de la route de
  // connexion (admin-auth.ts:79) puis 180 s d'attente d'URL hors CI
  // (admin-auth.ts:141) — Argon2id est délibérément coûteux. Le plancher du
  // cliquet `budget-des-specs-admin.spec.ts` est de 90 s.
  //
  // 🔴 2026-08-23 — CE PAVÉ A AFFIRMÉ 180 s, ET C'ÉTAIT FAUX. Il annonçait que
  // « le plus grand délai interne de cette suite, helpers importés compris, est
  // celui d'admin-auth (180 s) ». Le vrai maximum est `ARRIVEE_ECRAN` de
  // `_communs.ts` : 300 s hors CI. Le budget de 300 s était donc ÉGAL à son plus
  // grand délai interne — aucune place pour le reste, et le message précis de
  // `_communs` inatteignable.
  //
  // 🔑 La croyance venait de l'outil : `delai-interne-sous-le-budget.spec.ts`
  // cherchait `_communs.ts` à `tests/e2e/parcours/`, où il n'est plus. Le
  // `readFileSync` levait, un `catch` avalait, et le cliquet rendait un vert sur
  // un fichier qu'il n'avait jamais ouvert. Les deux sont corrigés ensemble.
  //
  // ⚠️ `mode: "serial"` est PORTANT ici, pas décoratif : voir le pavé « POURQUOI
  // serial EST PORTANT » de l'en-tête. Un échec des tests 1 ou 2 doit SAUTER le
  // test 3, pas le laisser absorber la cause dans son marquage conditionnel.
  test.describe.configure({ mode: "serial", timeout: 600_000 });

  test("le référentiel des offres connaît la famille 1-à-1, et dit son état", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");
    await loginAsAdmin(page);

    const lignes = await releverLesOffres(page, info);

    // ── Garde-fou du LECTEUR, avant toute conclusion sur ce qu'il a lu ───────
    // Une valeur de statut qu'on ne saurait pas lire serait rangée « inactive »
    // par défaut, et le parcours conclurait à un défaut commercial imaginaire.
    // On exige que CHAQUE ligne soit lisible, et on nomme celles qui ne le sont
    // pas.
    const statutsIllisibles = lignes
      .filter((l) => l.statut !== STATUT_ACTIVE && l.statut !== STATUT_INACTIVE)
      .map((l) => `${l.code} → « ${l.statut} »`);
    expect(
      statutsIllisibles,
      `la colonne « Statut » ne rend plus « ${STATUT_ACTIVE} » / « ${STATUT_INACTIVE} » ` +
        "(offres/page.tsx:178-184). Tout ce fichier range les offres sur cette " +
        "comparaison : une valeur inconnue serait comptée « inactive » en silence",
    ).toEqual([]);

    // ── Contre-témoin du DISCRIMINANT ───────────────────────────────────────
    // Si `cheminPublicOffre()` rendait `/un-a-un` pour tout le monde — ou pour
    // personne — le classement de ce fichier serait uniforme, et les tests 2 et
    // 3 mesureraient la même chose. On exige donc les DEUX côtés.
    expect(
      lignes.filter((l) => l.collectif).length,
      "aucune offre ne porte de chemin public `/formations/…` : le discriminant de " +
        `famille de ce parcours (« ${CHEMIN_PUBLIC_UN_A_UN} » contre « ${CHEMIN_PUBLIC_COLLECTIF}… ») ` +
        "ne sépare plus rien, et le classement des tests suivants serait uniforme " +
        "(famille-prestation.ts:83-93)",
    ).toBeGreaterThan(0);

    const individuelles = lignes.filter((l) => l.unAUn);
    expect(
      individuelles.map((l) => l.code),
      "AUCUNE offre de la famille « accompagnement individuel » au référentiel. " +
        "`estOffreUnAUn()` (famille-prestation.ts:68-70) et toute la bifurcation du " +
        "wizard deviennent alors du code que rien ne peut atteindre. Le seed en sème " +
        "pourtant trois — « Dirigeants » (offres.ts:106-121), « Membre d'équipe » " +
        "(:122-132) et « Vision IA stratégique » (:144-155) : leur absence signifie " +
        "que `pnpm qualiopi:seed` n'a pas tourné, ou que le format pédagogique de ces " +
        "lignes a changé de famille",
    ).not.toEqual([]);

    // ── Le constat qui a motivé cette réécriture ────────────────────────────
    //
    // 🔴 TRANCHÉ PAR WILL LE 2026-08-22 : LE 1-À-1 EST BIEN VENDU.
    //
    // `https://axion-ia.com/fr/un-a-un` rend 200, affiche ses tarifs
    // (200 / 390 / 600 / 790 / 900 / 990 € HT) et porte 88 occurrences de
    // « dirigeant ». La page existe bien dans le dépôt
    // (`src/app/[locale]/un-a-un/page.tsx`, routée par `routing.ts:169`) et elle
    // est auditée verte dans notre propre couverture publique
    // (`routes-publiques.json`).
    //
    // Le constat n'est donc PAS « faut-il retirer du code mort ». Il est bien
    // plus sérieux : **une prestation vendue publiquement n'existe pas au
    // catalogue de vente**. Un commercial qui ouvre le wizard ne peut pas la
    // facturer. L'écart n'est pas entre du code et un test — il est entre ce
    // que le site promet et ce que l'outil sait faire.
    //
    // Chaîne mesurée le 2026-08-23, jusqu'à la source :
    //
    //   · `prisma/seeds/qualiopi/offres.ts` crée bien les trois offres 1-à-1,
    //     et l'une d'elles (« Dirigeants ») est de surcroît désactivée en prod
    //     par la migration 20260611170000, ce que le seed documente :106-111 ;
    //   · `runCatalogueCleanup()` (seeds/qualiopi/index.ts:63-64, invoquée depuis `main()` en :97) appelle
    //     `cleanupCatalogue(prisma, { apply: true })` (:64) SANS
    //     `includeLegacyOffres`, donc `includeLegacy` vaut `true` par défaut
    //     (catalogue-cleanup.ts:118) : aucune offre n'est épargnée. Toute offre
    //     active dont le slug est hors du catalogue et qu'aucune formation
    //     vivante ne porte est désactivée (:156-164) ;
    //   · le catalogue de référence est `FORMATIONS_V2` (catalogue-cleanup.ts:100),
    //     qui compte 22 entrées, TOUTES collectives — 4 offres générales (dont
    //     « Bien commencer » 4 h et journée, qui ne portent pas le préfixe
    //     « ia-pour- »), 9 par métier, 8 par secteur, plus le séminaire
    //     (catalog-v2.ts:6949-6976). Zéro individuel.
    //
    // 🔑 C'est exactement le motif « écart contenu servi contre base » : la
    // vérification ne se fait qu'en OUVRANT l'écran, jamais en relisant le code.
    const actives = individuelles.filter((l) => l.active);
    const constat =
      actives.length === 0
        ? "DÉFAUT COMMERCIAL : /fr/un-a-un est en ligne et affiche ses tarifs, mais " +
          `aucune des ${individuelles.length} offres 1-à-1 du référentiel n'est active ` +
          "— le wizard ne peut pas les vendre. Offres concernées : " +
          individuelles.map((l) => `${l.code} « ${l.titre} » (${l.format})`).join(" | ")
        : `${actives.length} offre(s) 1-à-1 active(s) : ` +
          actives.map((l) => `${l.code} « ${l.titre} »`).join(" | ");
    info.annotations.push({ type: "constat", description: constat });
    console.warn(`[parcours-4] ${constat}`);
  });

  test("contre-témoin — une offre COLLECTIVE présente son sélecteur de formation et débloque l'étape 3", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");
    await loginAsAdmin(page);

    // On relit le référentiel DANS ce test plutôt que de le recevoir du
    // précédent : un état partagé entre tests fait dépendre le verdict de
    // l'ordre d'exécution, et le jour où quelqu'un lance ce test seul, il
    // mesurerait un ensemble vide sans rien dire.
    const lignes = await releverLesOffres(page, info);
    const codesCollectifs = new Set(lignes.filter((l) => l.collectif).map((l) => l.code));

    await ouvrirEtape2(page);

    const offre = page.getByLabel("Offre du catalogue");
    // 🔴 2026-08-21 — RÉGRESSION DÉJÀ PAYÉE, ET CE FICHIER EN A FAIT LES FRAIS.
    // `aria-label="Offre"` écrasait le libellé VISIBLE « Offre du catalogue » :
    // le nom accessible ne contenait plus le texte lu à l'écran (WCAG 2.5.3
    // « Label in Name », niveau A), ce parcours — qui visait le BON libellé — ne
    // trouvait rien, et se `test.skip`ait en annonçant « seed incomplet ». On a
    // cherché un défaut de données là où il y avait un défaut d'accessibilité.
    // Le composant porte lui-même la jurisprudence (VenteWizard.tsx:749-764).
    // Cette assertion est le cliquet : viser par le libellé visible doit
    // continuer de fonctionner.
    //
    // ⛔ NE JAMAIS AJOUTER `{ exact: true }` ICI, NI SUR « Formation publiée ».
    // Mesuré dans le moteur de Playwright : pour un `<select>` dont le `<label>`
    // ENVELOPPE le champ, le nom accessible est le texte complet du label —
    // OPTIONS COMPRISES. Il vaut donc « Offre du catalogue — Choisir une offre —
    // AXI-OFF-201 — … », jamais « Offre du catalogue » tout court. Poser `exact`
    // ferait passer ce compte à ZÉRO, et l'échec ressemblerait mot pour mot au
    // faux diagnostic « seed incomplet » du 2026-08-21.
    await expect(
      offre,
      "le sélecteur d'offres n'est pas atteignable par son libellé VISIBLE " +
        "« Offre du catalogue » (VenteWizard.tsx:765-766) : un `aria-label` a de nouveau " +
        "écrasé le nom accessible — c'est la régression WCAG 2.5.3 du 2026-08-21",
    ).toHaveCount(1);

    // ⚠️ GARDE DURE, ET ELLE EST AUSSI CELLE DU TEST 3. En mode `serial`, son
    // échec saute le test suivant : c'est ce qui empêche le marquage conditionnel
    // du test 3 d'absorber un seed cassé et de le rendre VERT.
    const offresProposees = await lireLesOptions(offre);
    expect(
      offresProposees.length,
      "aucune offre ACTIVE en base : `listOffres({ actifOnly: true })` " +
        "(vente/new/page.tsx:49) n'a rien rendu, le wizard ne propose que son " +
        "marque-place « — Choisir une offre — » (VenteWizard.tsx:776) et aucune vente " +
        "n'est possible",
    ).toBeGreaterThanOrEqual(2);

    const formation = page.getByLabel("Formation publiée");

    // ── L'état de départ, et il est PORTANT ─────────────────────────────────
    // Tant qu'aucune offre n'est choisie, `formationsDeLOffre` rend TOUT le
    // catalogue (VenteWizard.tsx:242-245). Cette liste est donc à la fois notre
    // mesure « combien de formations publiées existe-t-il » ET la référence
    // contre laquelle on prouvera qu'un repeint a bien eu lieu.
    const formationsToutes = await lireLesOptions(formation);
    expect(
      formationsToutes.length,
      "le wizard ne propose pas au moins TROIS options — le marque-place plus deux " +
        "formations publiées — alors qu'AUCUNE offre " +
        "n'est encore choisie. Deux causes, et le message doit permettre de les " +
        "distinguer : (1) le `<select>` « Formation publiée » n'est pas rendu du tout — " +
        "le bloc `{offreChoisie?.estUnAUn === true ? null : (` (VenteWizard.tsx:838) " +
        "aurait alors changé de condition, ou la page n'est pas hydratée ; (2) il est " +
        "rendu mais vide — `prisma.formation.findMany({ statut: 'actif', " +
        "statutGeneration: 'publie' })` (vente/new/page.tsx:50-56) n'a rien rendu, alors " +
        "que `pnpm qualiopi:seed` en sème 22 (catalog-import.ts:272-273). Il en faut au " +
        "moins DEUX : c'est cette liste qui sert de RÉFÉRENCE pour prouver le repeint " +
        "d'une offre — avec une seule formation, filtrer ne changerait rien d'observable, " +
        "et toute lecture suivante serait indiscernable d'une lecture périmée",
    ).toBeGreaterThanOrEqual(3);
    const referenceCatalogue = formationsToutes.map((o) => o.valeur).join("|");

    // ── Le candidat collectif ───────────────────────────────────────────────
    // On croise le référentiel (qui DIT la famille) et le wizard (qui DIT ce qui
    // est vendable). On ne balaie pas les ~26 offres : un balayage produirait, à
    // chaque itération, un relevé qu'aucune attente ne peut rendre fiable pour
    // l'offre COURANTE — et un premier jet en tirait pourtant une assertion
    // (`sansSelecteur` vide) qui, la boucle sautant toute offre 1-à-1, ne pouvait
    // par construction jamais se remplir. C'était le défaut de la version
    // précédente déplacé d'un cran. On prend donc UN candidat, et on prouve tout
    // sur lui.
    const candidats = offresProposees
      .map((o) => ({ valeur: o.valeur, code: codeDeLOption(o.texte) }))
      .filter((o): o is { valeur: string; code: string } => o.code !== null && o.valeur !== "")
      .filter((o) => codesCollectifs.has(o.code));

    await info.attach("candidats-collectifs.json", {
      body: JSON.stringify(
        {
          proposeesParLeWizard: offresProposees.map((o) => o.texte),
          collectivesAuReferentiel: [...codesCollectifs],
          candidats,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });

    const collective = candidats[0];
    if (collective === undefined) {
      throw new Error(
        "aucune offre COLLECTIVE parmi les offres proposées par le wizard. Le " +
          "contre-témoin de ce fichier ne peut plus être construit — et le test suivant, " +
          "qui vérifie la DISPARITION du sélecteur de formation, n'aurait plus rien à " +
          `quoi la comparer. Codes collectifs au référentiel (chemin public « ${CHEMIN_PUBLIC_COLLECTIF}… ») : ` +
          `${[...codesCollectifs].join(", ") || "(aucun)"} — codes proposés par le wizard : ` +
          `${offresProposees.map((o) => codeDeLOption(o.texte) ?? "?").join(", ")}. ⚠️ Une ` +
          "offre `sur_devis` n'est PAS comptée collective (famille-prestation.ts:53), et " +
          "une offre collective au slug vide affiche « — » : ni l'une ni l'autre n'est " +
          "candidate ici, et c'est voulu",
      );
    }

    const formationsDeLOffre = await choisirOffreEtAttendreLeRepeint(
      offre,
      formation,
      collective.valeur,
      referenceCatalogue,
      `l'offre collective ${collective.code}`,
    );

    // (1) LE SÉLECTEUR EXISTE POUR UNE OFFRE COLLECTIVE — c'est la moitié du
    //     contre-témoin que le test 3 inverse.
    expect(
      formationsDeLOffre.length,
      `l'offre collective ${collective.code} ne présente pas de sélecteur de formation ` +
        "publiée. Le bloc est pourtant rendu dès que l'offre n'est pas individuelle " +
        "(`{offreChoisie?.estUnAUn === true ? null : (`, VenteWizard.tsx:838) : soit son " +
        "format pédagogique a basculé du côté individuel sans que le référentiel le " +
        "dise, soit la condition de rendu a changé",
    ).toBeGreaterThan(0);

    // (2) ET IL EST ALIMENTÉ. `> 1` : l'option 0 est le marque-place
    //     « — Choisir une formation — » (VenteWizard.tsx:853).
    expect(
      formationsDeLOffre.length,
      `l'offre collective ${collective.code} ne porte AUCUNE formation publiée : le ` +
        "wizard affiche alors l'avertissement « Aucune formation publiée pour cette " +
        "offre » (VenteWizard.tsx:860-863) et l'étape 3 ne peut pas se débloquer — donc " +
        "l'assertion « Suivant est désactivé » du test suivant ne prouverait plus rien. " +
        "`pnpm qualiopi:seed` rattache pourtant 22 formations `actif` + `publie` à leurs " +
        "offres (catalog-import.ts:255 et :272-273) : vérifier ce rattachement. " +
        `Formations lues : ${JSON.stringify(formationsDeLOffre.map((o) => o.texte))}`,
    ).toBeGreaterThan(1);

    // (3) CE QUE CE TEST ACHÈTE VRAIMENT : « Suivant » PEUT s'activer.
    //     Sans cette moitié, l'assertion « Suivant est désactivé » du test suivant
    //     ne prouverait rien : à l'étape 2, « Suivant » est déjà désactivé tant
    //     qu'aucune offre n'est choisie (`offreId !== ""`, VenteWizard.tsx:546).
    const premiereFormation = formationsDeLOffre.find((o) => o.valeur !== "");
    if (premiereFormation === undefined) {
      throw new Error(
        "inatteignable : l'assertion précédente a exigé plus d'une option, or aucune " +
          "ne porte de `value` non vide. Le `<select>` de formations ne rendrait que des " +
          "marque-places (VenteWizard.tsx:853-858).",
      );
    }
    await formation.selectOption(premiereFormation.valeur);
    await expect(
      page.getByRole("button", { name: "Suivant" }),
      `l'offre collective ${collective.code} et sa formation publiée ne débloquent pas ` +
        "l'étape 3. `peutQuitterEtape2` (VenteWizard.tsx:545-548) exige trois choses : " +
        "une offre (:546), une offre NON individuelle (:547), et une formation quand le " +
        "chemin est « telle quelle » (:548 — c'est le défaut, VenteWizard.tsx:212). " +
        "L'une des trois manque, ou la page n'est pas hydratée",
      // `DELAI_ECRAN` et non `DELAI_ACTION` : ce qui est attendu ici est un
      // REPEINT React après un `selectOption`, pas une action serveur. Un nom de
      // délai qui ment sur ce qu'il attend envoie le prochain lecteur chercher
      // une lenteur de serveur là où il n'y en a pas.
    ).toBeEnabled({ timeout: DELAI_ECRAN });
  });

  test("une offre 1-à-1 retire le sélecteur de formation, verrouille l'étape 3 et renvoie au parcours de séances", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "chromium", "Parcours métier : un moteur suffit.");
    await loginAsAdmin(page);

    const lignes = await releverLesOffres(page, info);
    const codesUnAUn = new Set(lignes.filter((l) => l.unAUn).map((l) => l.code));
    const codesUnAUnActifs = new Set(lignes.filter((l) => l.unAUn && l.active).map((l) => l.code));

    const clientId = await ouvrirEtape2(page);

    const offre = page.getByLabel("Offre du catalogue");
    const formation = page.getByLabel("Formation publiée");
    const offresProposees = await lireLesOptions(offre);
    const proposees = offresProposees
      .map((o) => ({ valeur: o.valeur, code: codeDeLOption(o.texte) }))
      .filter((o): o is { valeur: string; code: string } => o.code !== null && o.valeur !== "")
      .filter((o) => codesUnAUn.has(o.code));

    // ─────────────────────────────────────────────────────────────────────────
    // 🔴 LE POINT DE BASCULE DE CE FICHIER — ET CE N'EST PAS UNE DISPENSE
    //
    // Aujourd'hui, le wizard ne propose AUCUNE offre 1-à-1 : elles sont toutes
    // désactivées par le nettoyage de catalogue (chaîne mesurée au test 1). La
    // bifurcation existe dans le code et n'est atteignable par personne — ni par
    // un commercial, ni par ce parcours.
    //
    // 🔑 La version précédente sortait alors en `return` après un `console.warn`
    // et laissait un VERT derrière elle. C'est ce trou noir que la réécriture
    // referme : un test qui se saute sans que ses conditions soient IMPOSSIBLES
    // ne prouve rien, et son vert se lit comme une preuve.
    //
    // Ici, les conditions ne sont PAS réunies, et on peut le MESURER : le
    // référentiel lui-même dit qu'aucune offre 1-à-1 n'est active. On déclare
    // donc le test « doit échouer » — Playwright VÉRIFIE qu'il échoue, et le
    // rapport porte la cause.
    //
    // ⚠️ LA CONDITION EST DOUBLE, ET C'EST TOUT L'ENJEU. Le marquage ne
    // s'applique que si le wizard ne propose rien ET que le référentiel confirme
    // qu'aucune offre 1-à-1 n'est active. Si le référentiel en montrait une
    // ACTIVE que le wizard ne propose pas, ce serait un défaut TOUT AUTRE
    // (divergence `listOffres({ actifOnly: true })` ↔ colonne « Statut ») : le
    // marquage ne s'applique pas, et le rouge est franc. Une garde qui absorbe
    // n'importe quelle cause n'est pas une garde.
    //
    // ⚠️ CE QUE LE MARQUAGE COÛTE, ET IL FAUT LE DIRE : d'ici la fin du test, un
    // échec pour une AUTRE cause serait lui aussi accepté — `info.fail()` inverse
    // le verdict du test entier, pas d'un bloc. C'est pourquoi tout ce qui peut
    // être vérifié sans offre 1-à-1 — la session admin, le référentiel, le
    // wizard, le client, le passage à l'étape 2, le sélecteur de formation d'une
    // offre collective — l'a été AVANT, dans deux tests SANS marquage ; et
    // pourquoi `mode: "serial"` est portant : leur échec saute celui-ci au lieu
    // de le laisser l'absorber.
    //
    // ⚠️ POURQUOI PAS UN ROUGE FRANC, PUISQUE WILL A TRANCHÉ QUE LE 1-À-1 EST
    // VENDU. Parce que depuis le 2026-08-23 ce harnais est une GATE BLOQUANTE
    // (ci.yml:443, :479-499) et que `Gate B · per-PR` est exigé en `strict` par
    // la protection de `main` : un rouge permanent ici arrête 100 % des PR du
    // dépôt pour dénoncer une décision de CATALOGUE. La pression pousserait alors
    // à « corriger » le test ou à activer l'offre — c'est-à-dire à maquiller le
    // défaut. On retire la pression, pas le contrat.
    //
    // ⚠️ La seule issue qui ferait DISPARAÎTRE ce marquage sans corriger quoi
    // que ce soit serait d'activer une offre 1-à-1 depuis ce parcours (bouton
    // « Activer », OffreRowActions.tsx:117). Ce serait un test qui fabrique sa
    // propre prémisse, et surtout qui MAQUILLERAIT le défaut commercial en le
    // rendant vert. On ne le fait pas : c'est une décision de catalogue, elle
    // revient à Will.
    //
    // 🔴 ET IL FAUT L'ÉCRIRE : TANT QUE CE MARQUAGE S'APPLIQUE, LES QUATRE
    // ASSERTIONS DE BIFURCATION CI-DESSOUS NE S'EXÉCUTENT PAS. Ce fichier ressort
    // vert sur une fonctionnalité que personne n'a traversée. Le marquage le dit,
    // l'annotation ci-dessous le NOMME assertion par assertion, et c'est une
    // dette ouverte — pas une couverture.
    // ─────────────────────────────────────────────────────────────────────────
    const bifurcationInatteignable = proposees.length === 0 && codesUnAUnActifs.size === 0;
    if (bifurcationInatteignable) {
      info.annotations.push({
        type: "non-couvert",
        description:
          "Bifurcation 1-à-1 NON TRAVERSÉE. Quatre assertions n'ont pas été jouées : " +
          "(1) le panneau live (role status) annonce « … est un accompagnement individuel » " +
          "(VenteWizard.tsx:805-812) ; (2) le sélecteur « Formation publiée » est ABSENT " +
          "du DOM (:838) ; (3) « Suivant » reste désactivé (:547) ; (4) « Créer le " +
          "parcours 1-to-1 » renvoie vers coaching/parcours/new en transportant le " +
          "client (:819-829). Cause : aucune offre 1-à-1 active au catalogue.",
      });
    }
    info.fail(
      bifurcationInatteignable,
      "DÉFAUT COMMERCIAL CONNU : aucune offre 1-à-1 n'est active au catalogue, la " +
        "bifurcation du wizard est donc inatteignable au clic. ⚠️ 2026-08-23 : ce cas ne " +
        "devrait PLUS se produire — `qualiopi:seed-demo` réactive désormais " +
        "`intervention-membre-equipe`, que `runCatalogueCleanup()` éteignait juste après " +
        "l'avoir créée. Si ce marquage s'applique encore, c'est que le seed de " +
        "démonstration n'a pas tourné, ou que quelqu'un a retiré ce bloc : le vérifier " +
        "AVANT de conclure à une décision commerciale. Le marquage se désarme seul dès " +
        "qu'une offre 1-à-1 est active.",
    );
    expect(
      proposees.map((o) => o.code),
      "le wizard ne propose AUCUNE offre de la famille 1-à-1, alors que `/fr/un-a-un` " +
        "est en ligne et affiche ses tarifs : une prestation vendue publiquement n'est " +
        "pas facturable depuis la console. Codes 1-à-1 au référentiel : " +
        `${[...codesUnAUn].join(", ") || "(aucun)"} — dont ACTIFS : ` +
        `${[...codesUnAUnActifs].join(", ") || "(aucun)"} — codes proposés par le wizard : ` +
        `${offresProposees.map((o) => codeDeLOption(o.texte) ?? "?").join(", ")}. Cause ` +
        "mesurée : `runCatalogueCleanup()` (seeds/qualiopi/index.ts:63-64, invoquée depuis `main()` en :97) désactive toute " +
        "offre hors de `FORMATIONS_V2` (catalogue-cleanup.ts:156-164), et `FORMATIONS_V2` " +
        "est intégralement collectif (catalog-v2.ts:6949-6976). ⚠️ Si la colonne ACTIFS " +
        "ci-dessus n'est PAS vide, la cause est tout autre — `listOffres({ actifOnly: " +
        "true })` (vente/new/page.tsx:49) diverge alors de la colonne « Statut » de " +
        "l'écran des offres, et ce rouge est franc, pas connu.",
    ).not.toEqual([]);

    // ── À partir d'ici : la bifurcation, jouée pour de vrai ─────────────────
    const premiere = proposees[0];
    if (premiere === undefined) {
      // Inatteignable : l'assertion ci-dessus a déjà jeté sur un ensemble vide.
      // On le dit plutôt que d'écrire un `as` qui masquerait une régression du
      // jour où quelqu'un déplacerait l'assertion.
      throw new Error("aucune offre 1-à-1 proposée — l'assertion précédente aurait dû jeter");
    }

    // 🔑 ON CHOISIT, PUIS ON ATTEND UN REPEINT PROUVÉ. Le panneau de bifurcation
    // ci-dessous est rendu par React : l'attendre EST la preuve que l'état a
    // changé. C'est ce qui rend non-périmées les trois lectures qui suivent — et
    // notamment le `toHaveCount(0)`, qui, mesuré trop tôt, verrait encore le
    // sélecteur de l'offre PRÉCÉDENTE et passerait au rouge pour rien (ou, pire,
    // au vert si l'ordre était inversé).
    await offre.selectOption(premiere.valeur);

    // (1) L'écran DIT pourquoi il bifurque, et il l'ANNONCE : le panneau est un
    //     `role="status"` (VenteWizard.tsx:806-807), donc une région live. On le
    //     vise par son rôle PUIS on le filtre par son texte (:811) : viser le
    //     texte seul laisserait le doute entre le `<p>` et son conteneur, et
    //     viser le rôle seul prendrait le premier `role="status"` du DOM.
    await expect(
      page.getByRole("status").filter({ hasText: /est un accompagnement individuel/ }),
      `l'offre 1-à-1 ${premiere.code} a été choisie, mais le wizard n'annonce pas la ` +
        "bifurcation. Le panneau est gardé par `offreChoisie?.estUnAUn === true` " +
        "(VenteWizard.tsx:805) : `estUnAUn` est donc faux pour cette offre — son " +
        "`formatPedagogique` n'est plus rangé « un_a_un » (famille-prestation.ts:44-54, " +
        "projeté par vente/new/page.tsx:100) alors que le référentiel lui affiche encore " +
        `le chemin public « ${CHEMIN_PUBLIC_UN_A_UN} ». Deux projections de la même ` +
        "famille qui divergent",
    ).toBeVisible({ timeout: DELAI_ECRAN });

    // (2) Le sélecteur de formation n'est pas MASQUÉ, il est ABSENT.
    //     `toHaveCount(0)` et non `not.toBeVisible()` : un champ en
    //     `display:none` reste dans le DOM, focusable au clavier et lu par les
    //     lecteurs d'écran. C'est précisément ce que revendique le commentaire
    //     de VenteWizard.tsx:834-837 — « ce qui n'a pas de sens ne doit pas
    //     exister, pas être invisible » — et c'est donc ce qu'on mesure. La
    //     lecture n'est pas périmée : le panneau du point (1) prouve le repeint.
    await expect(
      formation,
      `l'offre 1-à-1 ${premiere.code} présente encore un sélecteur de formation ` +
        "publiée : il restera VIDE — aucune formation ne peut se rattacher à un " +
        "accompagnement individuel — et l'admin conclura à un défaut de données. " +
        "C'est exactement ce que le rendu conditionnel de VenteWizard.tsx:838 existe " +
        "pour empêcher. (Contre-témoin : le test précédent vérifie que ce même " +
        "sélecteur EST bien présent, et alimenté, pour une offre collective.)",
    ).toHaveCount(0);

    // (3) L'étape 3 est verrouillée. Une vente 1-à-1 ne passe pas par
    //     devis + session collective : `peutQuitterEtape2` exige explicitement
    //     `offreChoisie?.estUnAUn !== true` (VenteWizard.tsx:547).
    //
    //     ⚠️ CETTE ASSERTION NE DISCRIMINE RIEN SEULE, et il faut le dire :
    //     « Suivant » est désactivé pour au moins TROIS raisons distinctes —
    //     aucune offre choisie (:546), offre individuelle (:547), ou simplement
    //     `isPending`, `AdminButton` faisant `disabled={disabled || loading}`
    //     (AdminButton.tsx:142) et le wizard passant `loading={isPending}`
    //     (VenteWizard.tsx:1308). Ce qui lui donne son sens, c'est (a) le
    //     contre-témoin du test précédent, où le MÊME bouton est ACTIF pour une
    //     offre collective, et (b) l'ordre : le panneau du point (1) est déjà
    //     apparu, donc une offre EST choisie et le rendu est stabilisé.
    await expect(
      page.getByRole("button", { name: "Suivant" }),
      `« Suivant » reste actif après le choix de l'offre 1-à-1 ${premiere.code} : le ` +
        "wizard mènerait à un formulaire de session qu'aucune formation ne peut " +
        "alimenter. La garde est `offreChoisie?.estUnAUn !== true` (VenteWizard.tsx:547)",
    ).toBeDisabled();

    // (4) La troisième issue est OFFERTE, et elle transporte le client. Sans ce
    //     dernier point, le renvoi ne serait qu'un demi-service : l'admin devrait
    //     re-chercher le client qu'il vient de désigner — ce que la page cible
    //     documente elle-même (coaching/parcours/new/page.tsx:31-36).
    const versParcours = page.getByRole("button", { name: "Créer le parcours 1-to-1" });
    await expect(
      versParcours,
      "le panneau de bifurcation n'offre pas le bouton « Créer le parcours 1-to-1 » " +
        "(VenteWizard.tsx:819-829) : le wizard dit à l'admin que cette offre ne se vend " +
        "pas ici, sans lui dire où elle se vend — une impasse nommée reste une impasse",
    ).toBeVisible();
    await versParcours.click({ timeout: DELAI_ECRAN }); // cf. `ARRIVEE_ECRAN` (_communs.ts) : le clic paie l'attente de SA navigation.

    try {
      await page.waitForURL(
        (url) =>
          url.pathname === admin("coaching/parcours/new") &&
          url.searchParams.get("clientId") === clientId,
        {
          waitUntil: "domcontentloaded",
          // défaut = `"load"` ; cf. la note de `creerSession` dans `_communs.ts`.
          timeout: DELAI_ECRAN,
        },
      );
    } catch (cause) {
      throw new Error(
        "le clic sur « Créer le parcours 1-to-1 » n'a pas mené à " +
          `${admin("coaching/parcours/new")}?clientId=${clientId}. Le bouton fait un ` +
          "`router.push` avec le client courant (VenteWizard.tsx:820-826, ternaire " +
          ":822-824) : soit la navigation n'est pas partie, soit le `clientId` n'a pas " +
          `suivi — et le renvoi perdrait alors la saisie. URL atteinte : ${page.url()}`,
        { cause },
      );
    }

    await expect(
      page.getByRole("heading", { level: 1, name: "Nouveau parcours 1-to-1" }),
      "le renvoi n'a pas abouti sur l'écran de création d'un parcours 1-to-1 " +
        `(coaching/parcours/new/page.tsx:114-117). URL atteinte : ${page.url()}`,
    ).toBeVisible({ timeout: DELAI_ECRAN });

    // Le client a bien suivi. `clientInitialId` n'est posé QUE si l'identifiant
    // existe dans la liste chargée (coaching/parcours/new/page.tsx:95-99) : cette
    // valeur prouve donc à la fois le transport et la résolution du client — un
    // uuid fantôme laisserait le sélecteur sur « — Aucun client — »
    // (CoachingParcoursForm.tsx:320).
    await expect(
      page.locator("#parcours-client"),
      "le client saisi dans le wizard n'est pas pré-sélectionné sur l'écran du " +
        "parcours 1-to-1. Le renvoi n'est alors qu'un demi-service : l'admin doit " +
        "re-chercher un client qu'il venait de désigner (CoachingParcoursForm.tsx:311). " +
        "⚠️ Si le champ est INTROUVABLE plutôt que mal rempli, la cause est ailleurs : " +
        "tout le bloc de rattachement CRM est gardé par `clients.length > 0` (:301)",
    ).toHaveValue(clientId);
  });
});
