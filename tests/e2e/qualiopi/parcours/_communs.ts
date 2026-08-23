/**
 * Briques communes aux sept parcours de la phase 6 de l'audit Qualiopi.
 *
 * Un parcours joue ce qu'un humain fait : il clique. Ces helpers ne court-circuitent
 * jamais l'interface — pas d'écriture directe en base, pas d'appel d'action serveur.
 * Si une étape n'est pas faisable à la souris, c'est un constat d'audit, pas un
 * détail d'implémentation à contourner.
 *
 * ## Ce que ce fichier tranche, une fois, pour les sept parcours
 *
 *   · `CONTENU`          — le repère de la zone de contenu de la console ;
 *   · `STAGIAIRES_DEMO`  — les deux stagiaires du dossier de démonstration ;
 *   · `inscrire()`       — le geste « inscrire un stagiaire à une session ».
 *
 * 🔑 **Un prédicat recopié diverge toujours.** Ces trois-là étaient sur le point
 * d'être réécrits dans trois specs à la fois (01 pour le repère, 02 et 03 pour
 * l'inscription). Ils sont exportés ici, jamais réécrits ailleurs — et le jour où
 * l'un d'eux change, il change à UN seul endroit.
 *
 * ## Comment les jouer
 *
 *     pnpm qualiopi:seed-demo                       # le dossier de démonstration
 *     npx playwright test tests/e2e/qualiopi/parcours --project=chromium --workers=1
 *
 * ⚠️ `--workers=1` n'est pas une précaution de confort **en local**. Sept
 * parcours lancés en parallèle ouvrent sept connexions admin simultanées ; le
 * serveur de `next dev` doit alors hacher sept mots de passe pendant qu'il
 * compile les routes à la demande, et TOUTES les connexions dépassent 90 s.
 * (Ce n'est pas la limitation de débit : elle est à 100 tentatives / 15 min par
 * IP.) Contre un build de production — la CI — le parallélisme passe.
 *
 * ⚠️ **Ce harnais n'est PAS une gate.** Le step « Playwright suite » porte
 * `continue-on-error: true` (ci.yml:519) : aucun rouge d'un parcours ne fera
 * rougir une PR. Ce que ces fichiers achètent, c'est du DIAGNOSTIC lisible, pas
 * un blocage. Écrire l'inverse dans un commentaire — plusieurs enquêtes l'ont
 * fait — raisonne sur une fausse sécurité (cf. « Vérité des gates », AGENTS.md).
 *
 * ⚠️ **Budget des suites.** Tout délai déclaré ici est HÉRITÉ par les specs qui
 * importent ce fichier : le cliquet `tests/unit/e2e-harness/delai-interne-sous-le-budget.spec.ts`
 * exige que le budget d'une suite soit STRICTEMENT supérieur au plus grand délai
 * qui vit dedans, helpers compris. Le plus long d'ici vaut 180 s (l'attente
 * d'arrivée de `creerSession` hors CI), autant que `loginAsAdmin` : une suite qui
 * importe l'un ou l'autre doit donc déclarer davantage. Ne pas relever ce
 * plafond sans relever les sept budgets.
 */

import { expect, type Locator, type Page } from "@playwright/test";
import { ADMIN_PREFIX } from "../../fixtures/admin-auth";

export type Modalite = "presentiel" | "distanciel" | "hybride";

/**
 * LE repère de la zone de contenu de la console d'administration.
 *
 * 🔴 2026-08-22 — `main` N'EST PLUS UN REPÈRE DANS LA CONSOLE, et `body` ne l'a
 * JAMAIS été.
 *
 * Depuis que le layout admin a cessé d'ouvrir son propre `<main>` (il héritait de
 * celui du site et en produisait un SECOND, imbriqué — trois violations axe
 * `moderate` par page), le `<main>` unique est celui du site public : il enveloppe
 * le rail de navigation. Conséquences mesurées :
 *
 *   · un seuil « la page n'est pas vide » posé sur `body` ou sur `main` est
 *     INATTEIGNABLE. Le seul rail pèse **2 207 caractères** de libellés (146
 *     `label:` littéraux dans `src/lib/admin-nav.ts`, remesurés le 2026-08-23 —
 *     l'enquête annonçait 2 353), plus 17 intitulés de groupe
 *     (`ADMIN_NAV_GROUP_LABELS`, admin-nav.ts:159-180). Un garde-fou à 200 ou à
 *     400 caractères posé sur `body` est vert sur une page totalement vide ;
 *   · un message de diagnostic construit sur `body` emporte la barre latérale et
 *     la topbar, et NOIE la cause au lieu de la nommer.
 *
 * 🔑 Le conteneur de contenu est `.admin-main` (admin.css:895 — le dépôt cite
 * parfois « admin.css:894 », décalage d'une ligne, remesuré le 2026-08-23), émis
 * par le layout admin sur CHAQUE page de la console : branche « session ouverte »
 * (layout.tsx:404) et branche « /login » (layout.tsx:418). Les deux branches sont
 * exclusives — le sélecteur résout donc exactement un nœud, jamais deux.
 *
 * ⚠️ POURQUOI PAS `.admin-page-shell` (AdminPageShell.tsx:46), l'autre candidat.
 * Les deux existent et sont IMBRIQUÉS (`.admin-page-shell` est un `<section>`
 * rendu DANS `.admin-main`), donc deux parcours concurrents seraient verts
 * séparément en mesurant deux choses différentes. Mesure du 2026-08-23 :
 * `.admin-page-shell` n'est rendu que par **97 des 285** `page.tsx` du groupe
 * `(admin)` — sur les 188 autres, un locator bâti dessus ne matche RIEN. C'est
 * exactement la famille de défaut que ce dépôt a déjà payée quatre fois (un
 * `nav[aria-label]` sur un `aside`, un `[href$=""]` que la spec CSS interdit de
 * matcher, un `data-testid` absent, une union qui prenait le premier du DOM).
 * `.admin-main`, lui, est émis par le layout : il existe partout.
 *
 * 🔑 Repère EXPORTÉ, jamais réécrit dans une spec — un prédicat recopié diverge
 * toujours. S'il devait un jour devenir `.admin-page-shell`, la seule ligne à
 * changer est celle-ci, et ce commentaire avec elle : pas l'un sans l'autre.
 */
export const CONTENU = ".admin-main";

/**
 * Les deux stagiaires du dossier de démonstration, tels que le seed les écrit.
 *
 * Source : `prisma/seeds/qualiopi/demo.ts` — adresses en :350-351
 * (`DEMO.STAGIAIRE_1_EMAIL` / `STAGIAIRE_2_EMAIL`), identités en :577-593.
 *
 * ⚠️ `nom` est ici le nom **affiché** (prénom + nom), parce que c'est sous cette
 * forme que les écrans le rendent : « Marie Martin » (EnrollmentsSection.tsx:196-198,
 * option du sélecteur :410). Dans le seed, `nom` désigne le patronyme seul
 * (`nom: "Martin"`, `prenom: "Marie"`). Deux champs homonymes qui ne veulent pas
 * dire la même chose : le préciser ici évite qu'une spec compose « Martin Marie ».
 *
 * ⚠️ Ces deux fiches sont des STAGIAIRES existants, pas des inscriptions. Elles
 * ne sont rattachées qu'à la session de démonstration `AXI-SES-DEMO-001` ; toute
 * session créée par un parcours part avec zéro inscrit, d'où `inscrire()`.
 *
 * 🔴 Un `<tr>` filtré sur « Marie Martin » n'est PAS unique sur la fiche de
 * session : le nom apparaît dans la ligne d'inscription (EnrollmentsSection.tsx:193-197)
 * ET dans deux lignes de questionnaire (QuestionnairesSection.tsx:431-435). Pour
 * épingler UNE ligne, ancrer sur l'`aria-label` du sélecteur d'état
 * (`Statut de Marie Martin`, EnrollmentsSection.tsx:210), jamais sur le texte.
 */
export const STAGIAIRES_DEMO = [
  { nom: "Marie Martin", email: "marie.martin@demo.axion-ia.invalid" },
  { nom: "Thomas Dubois", email: "thomas.dubois@demo.axion-ia.invalid" },
] as const;

/**
 * Enregistrement vidéo des parcours — la « trace filmée » que réclame la phase 6.
 *
 * Playwright produit du `.webm`, pas du GIF : c'est ce que l'outil sait faire
 * nativement, et convertir exigerait ffmpeg sur le poste. Le fichier atterrit
 * dans `test-results/<nom-du-parcours>/video.webm`, donc sous un nom parlant.
 *
 * Éteint par défaut : filmer sept parcours à chaque exécution de CI coûterait
 * du temps et de l'espace pour des vidéos que personne ne regarde quand tout
 * est vert. Pour les produire :
 *
 *     PARCOURS_VIDEO=1 npx playwright test tests/e2e/qualiopi/parcours --project=chromium
 */
export const ENREGISTREMENT =
  process.env["PARCOURS_VIDEO"] === "1" ? ({ video: "on" } as const) : ({} as const);

/** Préfixe de l'espace admin, avec la langue — jamais reconstruit à la main. */
export function admin(sousChemin = ""): string {
  const propre = sousChemin.replace(/^\/+/, "");
  return `/fr/${ADMIN_PREFIX}${propre === "" ? "" : `/${propre}`}`;
}

/** Deux chiffres, sans dépendance : `9` → `"09"`. */
function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Le jour civil **local** décalé de `jours`, en composants séparés.
 *
 * 🔴 2026-08-23 — CORRECTIF : la version précédente d'`horodatage` décalait la
 * date en heure LOCALE (`setDate`) puis la relisait en UTC
 * (`toISOString().slice(0, 10)`). Entre minuit et 02 h à Paris (UTC+2 l'été), les
 * deux ne désignent pas le même jour : `new Date()` du 23 août à 01 h donne
 * `2026-08-22` en UTC. Le parcours visait donc la veille de ce qu'il annonçait —
 * deux heures par jour, sans rien dire. Une CI tourne à toute heure.
 *
 * 🔑 Ça pèse au-delà d'un décalage cosmétique : le parcours hybride doit poser
 * une signature en salle ET importer un relevé de connexion **sur la même
 * journée** pour éprouver la protection M1 (`protegePresentiel`). Deux helpers
 * qui ne s'accordent pas sur « aujourd'hui + N » rendent ce test muet sans jamais
 * rougir.
 *
 * On se place à midi avant de décaler : aucun changement d'heure d'été ne peut
 * alors faire basculer `setDate` d'un jour.
 */
function jourDecale(jours: number): { annee: number; mois: number; jour: number } {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + jours);
  return { annee: d.getFullYear(), mois: d.getMonth() + 1, jour: d.getDate() };
}

/**
 * Horodatage au format d'un `<input type="datetime-local">`, décalé de `jours`.
 *
 * 🔴 Les champs de dates de session sont des `datetime-local`, pas des `date` :
 * une valeur `2026-08-28` y est silencieusement ignorée, et le formulaire part
 * avec un champ vide. Le format exact est `YYYY-MM-DDTHH:mm`.
 */
export function horodatage(jours: number, heure = "09:00"): string {
  const { annee, mois, jour } = jourDecale(jours);
  return `${annee}-${deuxChiffres(mois)}-${deuxChiffres(jour)}T${heure}`;
}

/**
 * Le MÊME jour que `horodatage(jours)`, au format des dates d'un export Zoom.
 *
 * 🔑 Deux parcours importent un relevé de connexion — le distanciel (02) et
 * l'hybride (03) — et les deux doivent le dater du jour RÉEL de la session, sans
 * quoi `matchParticipants` n'a aucune journée à rapprocher et l'écran affiche
 * l'aveu d'échec (« Participants non rapprochés ») qu'un test mal écrit lit
 * comme un succès. Le convertisseur vit donc ici : deux copies divergeraient, et
 * l'une des deux serait fausse en silence.
 *
 * Format exigé par `parse-zoom.ts` : `MM/DD/YYYY hh:mm:ss AM/PM` (motif ancré,
 * parse-zoom.ts:154-172). Une date hors format n'est pas refusée : elle rend
 * `null`, et le participant est simplement rapproché sans intervalle — un échec
 * silencieux de plus.
 *
 * `heure` est donnée en 24 h (`"09:00"`, `"13:30:00"`), comme pour `horodatage`,
 * pour que les deux helpers se lisent avec la même convention.
 */
export function horodatageZoom(jours: number, heure = "09:00"): string {
  const { annee, mois, jour } = jourDecale(jours);
  const [hhBrut = "09", mmBrut = "00", ssBrut = "00"] = heure.split(":");
  const h24 = Number(hhBrut);
  const minutes = Number(mmBrut);
  const secondes = Number(ssBrut);
  if (
    !Number.isInteger(h24) ||
    h24 < 0 ||
    h24 > 23 ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(secondes)
  ) {
    // On refuse plutôt que d'émettre une date que `parse-zoom` transformerait en
    // `null` sans un mot : un helper doit nommer sa propre faute.
    throw new Error(`horodatageZoom : heure « ${heure} » illisible — attendu "HH:mm" en 24 h`);
  }
  const suffixe = h24 < 12 ? "AM" : "PM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return (
    `${deuxChiffres(mois)}/${deuxChiffres(jour)}/${annee} ` +
    `${deuxChiffres(h12)}:${deuxChiffres(minutes)}:${deuxChiffres(secondes)} ${suffixe}`
  );
}

/**
 * Vérifie qu'un champ porte bien un nom accessible, et le rend.
 *
 * 🔑 On cible par identifiant — ces `id` sont explicites et liés par `htmlFor`,
 * donc stables — MAIS on refuse de s'en contenter : un champ sans nom accessible
 * est un défaut d'accessibilité, et un parcours qui le contourne en le masquerait.
 * Les libellés portent un astérisque `aria-hidden`, d'où le motif ancré plutôt
 * qu'une égalité.
 */
export async function champEtiquete(page: Page, id: string, libelle: RegExp): Promise<Locator> {
  const champ = page.locator(`#${id}`);
  await expect(champ, `champ #${id} absent de l'écran`).toBeVisible({ timeout: 30_000 });
  const nom = await champ.evaluate((el) => {
    const etiquette = el.id === "" ? null : document.querySelector(`label[for="${el.id}"]`);
    const texte = etiquette?.textContent ?? "";
    // On retire ce que `aria-hidden` retire au nom accessible.
    const masque = Array.from(etiquette?.querySelectorAll('[aria-hidden="true"]') ?? [])
      .map((n) => n.textContent ?? "")
      .join("");
    return texte.replace(masque, "").replace(/\s+/g, " ").trim();
  });
  expect(nom, `#${id} n'a pas de nom accessible conforme (lu : « ${nom} »)`).toMatch(libelle);
  return champ;
}

/**
 * Crée une session depuis l'écran `/qualiopi/sessions/new`, en cliquant.
 *
 * Rend l'identifiant de la session créée, lu dans l'URL d'arrivée — c'est la
 * preuve que l'action serveur a réellement écrit : un formulaire qui échoue reste
 * sur place.
 *
 * ⚠️ La session naît avec ZÉRO inscrit. `participants` renseigne
 * « Nb participants PRÉVUS » (SessionForm.tsx:586), un nombre déclaratif : il ne
 * crée aucune inscription. Un parcours qui enchaîne sur l'émargement sans appeler
 * `inscrire()` mesure une grille vide — c'est précisément le défaut qui rendait le
 * parcours 02 vert avec zéro appariement.
 */
export async function creerSession(
  page: Page,
  options: {
    modalite: Modalite;
    titre: string;
    /** Décalage en jours du début. Négatif = session passée. */
    debutDansJours: number;
    /** Durée en jours. 1 = une journée. */
    dureeJours?: number;
    participants?: number;
    montantHt?: number;
  },
): Promise<string> {
  const { modalite, titre, debutDansJours, dureeJours = 1 } = options;

  await page.goto(admin("qualiopi/sessions/new"));

  const formation = await champEtiquete(page, "session-formation", /^Formation$/);
  // Une session sans formation n'existe pas : le bouton de soumission reste
  // désactivé tant que la liste est vide. On le DIT, plutôt que de laisser le
  // parcours mourir sur un clic sans effet.
  expect(
    await formation.locator("option").count(),
    "aucune formation disponible — `pnpm qualiopi:seed-demo` n'a pas produit de formation " +
      "`statut=actif` + `statutGeneration=publie`",
  ).toBeGreaterThanOrEqual(2);
  await formation.selectOption({ index: 1 });

  await (await champEtiquete(page, "session-titre", /^Titre de la session/)).fill(titre);
  await (await champEtiquete(page, "session-modalite", /^Modalité/)).selectOption(modalite);
  await (
    await champEtiquete(page, "session-date-debut", /^Date de début/)
  ).fill(horodatage(debutDansJours));
  await (
    await champEtiquete(page, "session-date-fin", /^Date de fin/)
  ).fill(horodatage(debutDansJours + dureeJours - 1, "17:00"));

  if (options.participants !== undefined) {
    await (
      await champEtiquete(page, "session-participants", /participants/i)
    ).fill(String(options.participants));
  }
  if (options.montantHt !== undefined) {
    await (
      await champEtiquete(page, "session-montant", /^Montant HT/)
    ).fill(String(options.montantHt));
  }

  await page.getByRole("button", { name: "Créer la session" }).click();

  // L'arrivée sur la fiche porte l'identifiant : c'est ce qui distingue « le
  // serveur a écrit » de « le formulaire a affiché une erreur ». Le message
  // d'échec emporte le texte de l'écran, sinon un refus de validation est
  // indiscernable d'une lenteur.
  try {
    // 60 s suffisent contre un build de production. Sous `next dev`, la PREMIÈRE
    // soumission compile l'action serveur à la demande et dépasse régulièrement
    // ce délai — un échec qui ressemble à un refus de validation.
    await page.waitForURL(/\/qualiopi\/sessions\/[0-9a-f-]{36}/, {
      timeout: process.env["CI"] === "true" ? 60_000 : 180_000,
    });
  } catch (cause) {
    // 🔴 2026-08-22 — `main` N'EST PLUS UN REPÈRE DANS LA CONSOLE.
    //
    // Depuis que le layout admin a cessé d'ouvrir son propre `<main>` (il
    // héritait de celui du site et en produisait un SECOND, imbriqué — trois
    // violations axe `moderate` par page), `page.locator("main").last()`
    // résoudrait le `<main>` PUBLIC unique : le texte d'échec emporterait la
    // barre latérale et la topbar au lieu du formulaire, et noierait la cause.
    //
    // 🔑 Un message de diagnostic doit viser la zone qui a échoué, pas le
    // document. Ce repère est tranché une fois pour toutes dans `CONTENU`
    // (ci-dessus) : il n'est jamais réécrit en clair, ici pas plus qu'ailleurs.
    const visible = await page
      .locator(CONTENU)
      .innerText()
      .catch(() => "(texte illisible)");
    const invalides = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLInputElement>("input, select, textarea"))
        .filter((c) => !c.checkValidity())
        .map((c) => `${c.id || c.name}: ${c.validationMessage}`),
    );
    throw new Error(
      // ⚠️ Formulation volontairement prudente. Un premier jet disait « n'a pas
      // été créée » ; vérification faite en base, la session AVAIT été écrite —
      // c'est l'arrivée sur sa fiche qui avait tardé sous `next dev`. Un message
      // d'échec qui affirme plus que ce qu'il a mesuré envoie chercher au mauvais
      // endroit.
      `on n'est pas arrivé sur la fiche de la session « ${titre} » — URL : ${page.url()}. ` +
        `La session peut malgré tout avoir été écrite : vérifier la liste avant de conclure. ` +
        `Champs refusés par le navigateur : ${JSON.stringify(invalides)} — ` +
        `Écran : ${visible.replace(/\s+/g, " ").slice(0, 600)}`,
      { cause },
    );
  }
  return /\/sessions\/([0-9a-f-]{36})/.exec(page.url())?.[1] as string;
}

/**
 * Inscrit un stagiaire — désigné par son ADRESSE — à la session dont la fiche est
 * ouverte. Rend le nombre d'inscrits après l'opération.
 *
 * Prérequis : `page` est sur `/qualiopi/sessions/<id>` (retour de `creerSession`
 * ou d'`ouvrirSessionDemo`). Le formulaire vit dans la section `#stagiaires`
 * (sessions/[id]/page.tsx:848-860).
 *
 * ## Pourquoi ce helper existe
 *
 * 🔴 SANS INSCRIT, L'ÉMARGEMENT NE PROUVE RIEN — et il le prouve en VERT. Chaîne
 * mesurée sur le parcours distanciel : la session créée n'a aucun inscrit, donc
 * `importReleveConnexionAction` lit `enrollments = []` (presence.ts:565-577),
 * `matchParticipants` rend `matched = []` (match.ts:66), l'action RÉUSSIT avec
 * `nbMatched: 0 / nbUnmatched: 2`, et le rapport imprime les deux noms sous
 * « Participants non rapprochés » (ImportReleveForm.tsx:241-254). Un test qui
 * cherchait « Marie Martin » dans la page lisait donc l'aveu d'échec et le
 * certifiait comme succès.
 *
 * 🔑 Les parcours 02 et 03 en ont besoin à l'identique (même garde `isDistanciel`,
 * emargement/page.tsx:126). Deux copies divergeraient.
 *
 * ## Les trois pièges que ce helper referme
 *
 * 1. **Le bouton est désactivé tant que rien n'est choisi** —
 *    `disabled={isPending || !selectedTraineeId}` (EnrollmentsSection.tsx:416).
 *    Cliquer avant l'hydratation ne fait rien ET ne dit rien : l'action meurt sur
 *    l'`actionTimeout` de 15 s (playwright.config.ts:36) avec « element is not
 *    enabled », symptôme qui ne ressemble pas à sa cause. On EXIGE donc
 *    `toBeEnabled` avant le clic, avec un message qui nomme l'hydratation.
 * 2. **Le message de succès ment sur la seconde inscription** — « Stagiaire
 *    inscrit avec succès » (`role="status"`, :430) reste affiché après la
 *    première ; l'attendre validerait la seconde à tort. On vérifie donc le
 *    COMPTEUR de la fiche (`N inscrits / M prévus`, sessions/[id]/page.tsx:621,
 *    dans `#infos`), et on exige qu'il ait AVANCÉ d'une unité — une garde qui ne
 *    peut être satisfaite que par ce qu'on vient de faire.
 * 3. **Un refus est silencieux à l'écran** — l'erreur d'action s'affiche dans un
 *    `[role="alert"]` du formulaire (:420-427). Le sondage la remonte donc dans
 *    sa VALEUR REÇUE (« REFUS: … ») plutôt que dans un message figé qui
 *    affirmerait « aucun message d'erreur lisible » alors qu'il y en a un.
 *    Sa lecture est bornée à 1 s : sans cela, chaque itération hériterait de
 *    l'`actionTimeout` de 15 s et le chemin NOMINAL paierait l'attente.
 */
export async function inscrire(page: Page, email: string): Promise<number> {
  // Le `<form>` est scopé par le seul champ qui lui appartient en propre. Le
  // titre « Inscrire un stagiaire » est un `<h3>` hors du formulaire (:503-505) et le
  // bouton porte le même mot : viser par le texte prendrait l'un pour l'autre.
  const formulaire = page.locator("form", { has: page.locator("#enroll-trainee-select") });

  await expect(
    formulaire,
    "le formulaire d'inscription n'est pas apparu sur la fiche de session — trois causes " +
      "possibles, et le message doit permettre de les distinguer : (1) la page n'est pas " +
      "hydratée (fiche rendue en flux) ; (2) TOUS les stagiaires sont déjà inscrits, auquel " +
      "cas l'écran affiche « Tous les stagiaires disponibles sont déjà inscrits à cette " +
      "session » et le `<form>` n'existe pas du tout (EnrollmentsSection.tsx:386-392) ; " +
      `(3) on n'est pas sur une fiche de session — URL : ${page.url()}`,
  ).toBeVisible({ timeout: 90_000 });

  // On réutilise la garde d'accessibilité partagée plutôt que de recopier un
  // `page.locator("#…")` : un champ sans nom accessible est un défaut, et un
  // parcours qui le contourne le masquerait.
  const select = await champEtiquete(page, "enroll-trainee-select", /^Stagiaire$/);

  // L'option porte « Prénom Nom (email) » (EnrollmentsSection.tsx:408-412) :
  // l'adresse est le seul discriminant sûr — deux homonymes sont possibles, deux
  // adresses non.
  const option = select.locator("option").filter({ hasText: email });
  const proposees = (await select.locator("option").allTextContents())
    .map((t) => t.replace(/\s+/g, " ").trim())
    .join(" · ")
    .slice(0, 500);
  expect(
    await option.count(),
    `aucune option « ${email} » dans le sélecteur de stagiaires. Soit ` +
      "`pnpm qualiopi:seed-demo` n'a pas créé les stagiaires de démonstration, soit cette " +
      "personne est DÉJÀ inscrite à cette session (les inscrits sont retirés de la liste, " +
      `EnrollmentsSection.tsx:357). Options réellement proposées : ${proposees}`,
  ).toBe(1);

  // On sélectionne par la VALEUR lue dans le DOM, jamais par le libellé : un
  // `selectOption({ label })` exige une égalité exacte, et le libellé change dès
  // qu'on touche à la mise en forme du prénom ou de l'adresse.
  const valeur = await option.getAttribute("value");
  if (valeur === null || valeur === "") {
    throw new Error(
      `l'option « ${email} » n'a pas d'attribut \`value\` exploitable — le sélecteur ` +
        "n'enverrait aucun identifiant de stagiaire à `enrollTraineeAction`",
    );
  }
  await select.selectOption(valeur);

  // « Inscrire » exactement : pendant l'action le bouton devient « Inscription… »
  // (:417), et un motif non ancré matcherait les deux états.
  const bouton = formulaire.getByRole("button", { name: /^Inscrire$/ });
  await expect(
    bouton,
    "le bouton « Inscrire » ne s'est pas activé après sélection du stagiaire — il est " +
      "`disabled={isPending || !selectedTraineeId}` (EnrollmentsSection.tsx:416), donc soit " +
      "React n'a pas encore hydraté la page et le `change` n'a atteint aucun état, soit une " +
      "inscription précédente est encore en vol",
  ).toBeEnabled({ timeout: 30_000 });

  // ── Ce qui prouve l'aboutissement : le compteur de la fiche ─────────────────
  const infos = page.locator("#infos");
  const lireInscrits = async (): Promise<number | null> => {
    const texte = await infos.innerText({ timeout: 5_000 }).catch(() => "");
    // `\s` couvre l'espace insécable : le compteur est composé de trois nœuds
    // JSX (`{n} inscrits / {m} prévus`) et `innerText` peut les recoller avec
    // n'importe quelle espace.
    const trouve = /(\d+)\s+inscrits\s*\//.exec(texte.replace(/\s+/g, " "));
    return trouve?.[1] === undefined ? null : Number(trouve[1]);
  };

  const avant = await lireInscrits();
  if (avant === null) {
    throw new Error(
      "le compteur « N inscrits / M prévus » est introuvable dans `#infos` " +
        "(sessions/[id]/page.tsx:621) : sans lui, on n'a AUCUN moyen de distinguer une " +
        `inscription réussie d'un refus silencieux — URL : ${page.url()}`,
    );
  }

  await bouton.click();

  /**
   * Valeur sondée : soit l'état du compteur, soit le refus affiché. Un message
   * de sondage est FIGÉ ; la valeur reçue, elle, dit ce que l'écran montrait
   * vraiment. Écrire « ni arrivée, ni message d'erreur lisible » dans le message
   * mentirait le jour où il y a précisément un message d'erreur.
   */
  const etat = async (): Promise<string> => {
    // Seul le `[role="alert"]` DU FORMULAIRE (:422) nous concerne : les lignes du
    // tableau en portent trois autres (:221, :276, :318), pour le statut, les
    // adaptations et la révocation d'accès.
    const alerte = formulaire.locator('[role="alert"]');
    if ((await alerte.count()) > 0) {
      const texte = await alerte
        .first()
        .innerText({ timeout: 1_000 })
        .catch(() => "(alerte illisible)");
      return `REFUS: ${texte.replace(/\s+/g, " ").trim()}`;
    }
    const n = await lireInscrits();
    return n === null ? "(compteur introuvable dans #infos)" : `${n} inscrits`;
  };

  await expect
    .poll(etat, {
      timeout: 60_000,
      message:
        `l'inscription de ${email} n'a pas fait avancer le compteur de la fiche ` +
        "(`#infos`, sessions/[id]/page.tsx:621). La valeur reçue dit laquelle des deux " +
        "causes s'est produite : « REFUS: … » = `enrollTraineeAction` a refusé et l'a écrit " +
        "dans le formulaire ; un compteur inchangé = l'action n'a pas abouti, ou le " +
        "`router.refresh()` d'EnrollmentsSection.tsx:457 n'a pas repeint la fiche",
    })
    .toBe(`${avant + 1} inscrits`);

  return avant + 1;
}

/**
 * Ouvre la fiche de la session de démonstration (`AXI-SES-DEMO-001`), la seule
 * qui porte un cycle complet : présences, évaluations, attestation, facture.
 *
 * Rend `null` si elle est absente — l'appelant décide. On ne saute JAMAIS en
 * silence.
 */
export async function ouvrirSessionDemo(page: Page): Promise<string | null> {
  await page.goto(admin("qualiopi/sessions"));

  // 🔴 Le numéro de session vit dans un `<span>`, pas dans le lien : chercher un
  // `link` qui le porte ne trouve rien, et le parcours conclut à tort que le seed
  // n'a pas tourné. On repère la LIGNE par son numéro, puis on clique le bouton
  // « Ouvrir » de cette ligne — exactement le geste d'un humain.
  // 🔴 La liste est PAGINÉE (25 par page) et triée par date. Le dossier de
  // démonstration date de mars ; dès que quelques sessions récentes existent —
  // celles que ces parcours créent eux-mêmes, par exemple — il bascule en page 2
  // et « disparaît ». Un premier jet concluait « le seed n'a pas tourné ».
  //
  // 🔑 Un parcours ne doit pas supposer qu'une ligne est sur le premier écran.
  // On tourne les pages, comme un humain, et on ne rend `null` qu'après avoir
  // épuisé la pagination ET les archives.
  const trouverLigne = () => page.locator("tr").filter({ hasText: "AXI-SES-DEMO-001" }).first();

  /**
   * 🔴 La LISTE est rendue en flux, elle aussi. Fouillée trop tôt, elle ne porte
   * ni ligne ni pagination — et la recherche conclut « introuvable » alors qu'il
   * n'y avait encore rien à trouver. C'est le troisième endroit de la journée où
   * ce même piège s'est refermé.
   */
  const attendreLaListe = async (): Promise<void> => {
    await expect(
      page
        .locator("tr")
        .filter({ hasText: /AXI-SES/ })
        .first(),
      "la liste des sessions n'a jamais affiché de ligne — elle est restée en cours de rendu",
    ).toBeVisible({ timeout: 90_000 });
  };
  await attendreLaListe();

  const chercherEnTournantLesPages = async (): Promise<boolean> => {
    for (let garde = 0; garde < 20; garde += 1) {
      if ((await trouverLigne().count()) > 0) return true;
      const suivant = page.getByRole("link", { name: /Suivant/i }).first();
      if ((await suivant.count()) === 0) return false;
      // 🔴 Le lien « Suivant » est TOUJOURS rendu : sur la dernière page il porte
      // `href="#"` et `aria-disabled`. Cliquer dessus ne change rien, et une
      // boucle qui ne le vérifie pas tourne vingt fois sur place avant de
      // conclure — à tort — que la ligne n'existe pas.
      if ((await suivant.getAttribute("aria-disabled")) === "true") return false;

      // 🔴 QUATRIÈME FOIS AUJOURD'HUI. `waitForLoadState` ne dit RIEN d'une
      // navigation douce : il rend la main avant même qu'elle ait commencé. Une
      // sonde bâtie ainsi voyait les mêmes 25 lignes sur quatre « pages »
      // successives, et j'ai failli rapporter que la pagination de la console
      // était inerte. Elle fonctionne : `?page=2` rend bien les 9 lignes
      // suivantes, dossier de démonstration compris. C'est la MESURE qui était
      // prise trop tôt.
      //
      // 🔑 Après un clic de navigation, attendre l'URL — pas un état de charge.
      const cible = await suivant.getAttribute("href");
      await suivant.click();
      if (cible !== null) {
        await page.waitForURL((u) => u.pathname + u.search === cible, { timeout: 60_000 });
      }
      await attendreLaListe();
    }
    return false;
  };

  if (!(await chercherEnTournantLesPages())) {
    // Les sessions de plus de douze mois passent aux archives (cf.
    // `FENETRE_SESSIONS_MOIS`). On suit le lien plutôt que de deviner l'URL.
    const archives = page.getByRole("link", { name: /archives?/i }).first();
    if ((await archives.count()) === 0) return null;
    await archives.click();
    // Borné : une attente d'état de chargement sans délai hérite du budget du
    // test, puis rend « Test timeout exceeded » sans nommer l'étape. C'est la
    // même famille de défaut que l'`actionTimeout` non déclaré.
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
    if (!(await chercherEnTournantLesPages())) return null;
  }

  await trouverLigne().getByRole("link", { name: "Ouvrir" }).click();
  await page.waitForURL(/\/qualiopi\/sessions\/[0-9a-f-]{36}/, { timeout: 60_000 });

  // 🔴 `networkidle` NE SUFFIT PAS sur la fiche de session : elle est rendue en
  // flux, et la zone utile arrive après. Sondée à ce moment-là, la page ne
  // portait qu'un bouton « Rendering . . . » et le texte « Chargement de la
  // liste des sessions » — de quoi conclure à tort qu'une fonctionnalité
  // n'existe pas alors qu'elle n'était pas encore arrivée.
  //
  // 🔑 Le repère d'attente doit être un CONTENU, pas un état réseau.
  //
  // ⚠️ Mesuré sur `CONTENU` et non sur `body` : le numéro n'est écrit que dans la
  // zone de contenu, et le rail de navigation qui pèse dans `body` n'a rien à
  // faire dans le texte d'échec de cette attente.
  await expect(
    page.locator(CONTENU),
    "la fiche de session n'a jamais affiché son numéro — elle est restée en cours de rendu",
  ).toContainText("AXI-SES-DEMO-001", { timeout: 90_000 });

  return /\/sessions\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? null;
}
