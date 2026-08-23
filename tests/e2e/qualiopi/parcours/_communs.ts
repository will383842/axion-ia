/**
 * Briques communes aux sept parcours de la phase 6 de l'audit Qualiopi.
 *
 * Un parcours joue ce qu'un humain fait : il clique. Ces helpers ne court-circuitent
 * jamais l'interface — pas d'écriture directe en base, pas d'appel d'action serveur.
 * Si une étape n'est pas faisable à la souris, c'est un constat d'audit, pas un
 * détail d'implémentation à contourner.
 *
 * ## Comment les jouer
 *
 *     pnpm db:seed                                  # le compte admin de développement
 *     pnpm qualiopi:seed-demo                       # le dossier de démonstration
 *     npx playwright test tests/e2e/qualiopi/parcours --project=chromium --workers=1
 *
 * ⚠️ `--workers=1` n'est pas une précaution de confort **en local**. Sept
 * parcours lancés en parallèle ouvrent sept connexions admin simultanées ; le
 * serveur de `next dev` doit alors hacher sept mots de passe pendant qu'il
 * compile les routes à la demande, et TOUTES les connexions dépassent 90 s.
 * (Ce n'est pas la limitation de débit : elle est à 100 tentatives / 15 min par
 * IP.) Contre un build de production — la CI — le parallélisme passe.
 */

import { expect, type Locator, type Page } from "@playwright/test";
import { ADMIN_PREFIX } from "../../fixtures/admin-auth";

export type Modalite = "presentiel" | "distanciel" | "hybride";

/**
 * Le conteneur de la zone de CONTENU de la console admin.
 *
 * ## Pourquoi ce repère est exporté, et jamais recopié
 *
 * Le motif que ce dépôt a payé le plus cher est celui du repère qui ENGLOBE ce
 * qu'il devrait exclure. Sur la console, `body` et `main` enveloppent tous deux
 * le rail de navigation latéral. Conséquences MESURÉES le 2026-08-23 :
 *
 *   · un seuil du genre « la page n'est pas vide » posé sur `body` est
 *     INATTEIGNABLE : le seul rail pèse **2 207 caractères** de libellés (146
 *     littéraux `label:` dans `src/lib/admin-nav.ts`), auxquels s'ajoutent **15**
 *     intitulés de groupe (`ADMIN_NAV_GROUP_LABELS`, admin-nav.ts:159-180). Un
 *     garde-fou à 200 ou à 400 caractères posé sur `body` est donc vert sur une
 *     page de contenu totalement vide. C'est ce qui rendait le parcours 01 inerte ;
 *   · un message de diagnostic construit sur `body` emporte la barre latérale et
 *     la topbar, et NOIE la cause au lieu de la nommer.
 *
 * 🔑 Le conteneur de contenu est `.admin-main` (admin.css:895 — le dépôt écrit
 * parfois « admin.css:894 », décalage d'une ligne recopié en cinq endroits :
 * admin.css:744, admin.css:759, layout.tsx:403, AdminPageShell.tsx:23, et ce
 * fichier avant sa correction). Il est émis par le LAYOUT, sur chaque page de la
 * console : branche « session ouverte » (layout.tsx:404) et branche « /login »
 * (layout.tsx:418). Les deux branches sont exclusives — le sélecteur résout donc
 * exactement un nœud, jamais deux — et le rail (`<aside>` puis `<nav>`,
 * AdminSidebarNav.tsx:660 et :662) en est le FRÈRE, pas le descendant.
 *
 * ## ⚠️ Pourquoi pas `.admin-page-shell`, l'autre candidat
 *
 * Les deux existent et sont IMBRIQUÉS : `.admin-page-shell` est un `<section>`
 * rendu DANS `.admin-main` (AdminPageShell.tsx:46 pour la balise, :48 pour le
 * littéral de classe). Deux parcours concurrents seraient donc verts séparément
 * en mesurant deux choses différentes.
 *
 * Surtout, il ne couvre pas la console. Mesure du 2026-08-23, union dédupliquée :
 * **132 des 285** `page.tsx` du groupe `(admin)` le rendent — 93 en propre, 29
 * l'héritent de trois layouts (`contacts`, `documents-interventions`, `tunnels`),
 * 10 passent par `AdminStubPageV2` ou `VenteWizard`. Sur les **153** autres, un
 * locator bâti dessus ne matche RIEN.
 *
 * 🔑 PIÈGE DE RE-MESURE : un `grep AdminPageShell` sur les `page.tsx` rend **97**,
 * et ce compte est faux dans les deux sens — il inclut 4 fichiers qui ne citent
 * le nom qu'en commentaire, et il ignore les trois layouts et les deux composants
 * relais. Quiconque re-vérifie par `grep` retrouvera 97 et croira le chiffre bon.
 * C'est pour cette raison que la méthode est écrite ici, pas seulement le résultat.
 *
 * Un prédicat recopié diverge toujours : s'il fallait un jour basculer sur
 * `.admin-page-shell`, la seule ligne à changer serait celle-ci, et ce
 * commentaire avec elle — pas l'un sans l'autre.
 */
export const CONTENU = ".admin-main";

/**
 * Les deux stagiaires du dossier de démonstration, tels que le seed les écrit.
 *
 * Source : `prisma/seeds/qualiopi/demo.ts` — adresses en :350 et :351
 * (`STAGIAIRE_1_EMAIL` / `STAGIAIRE_2_EMAIL`), identités dans le tableau :577-594
 * (Marie :579-580, Thomas :587-588).
 *
 * ⚠️ `nom` est ici le nom AFFICHÉ, prénom compris, parce que c'est sous cette
 * forme que les écrans le rendent : « Marie Martin » (EnrollmentsSection.tsx:197,
 * option du sélecteur :410). Dans le seed, `nom` désigne le patronyme SEUL
 * (`nom: "Martin"`, `prenom: "Marie"`). Deux champs homonymes qui ne veulent pas
 * dire la même chose : le préciser ici évite qu'une spec compose « Martin Marie ».
 *
 * ⚠️ Ces deux fiches sont des STAGIAIRES existants, pas des inscriptions. Elles
 * ne sont rattachées qu'à la session de démonstration `AXI-SES-DEMO-001` ; toute
 * session créée par un parcours part avec ZÉRO inscrit. C'est la raison d'être
 * d'`inscrire()`.
 *
 * 🔴 Un `<tr>` filtré sur « Marie Martin » n'est PAS unique sur la fiche de
 * session : le nom apparait dans la ligne d'inscription
 * (EnrollmentsSection.tsx:193-197) ET dans deux lignes de questionnaire
 * (QuestionnairesSection.tsx:431-435) — soit trois `<tr>`. Une quatrième
 * occurrence vit HORS de tout `<tr>`, dans un `<div>`
 * (InterEntreprisesSection.tsx:94) : un `getByText` non scopé trouverait donc
 * quatre nœuds. Pour épingler UNE ligne, ancrer sur l'`aria-label` du sélecteur
 * d'état (`Statut de Marie Martin`, EnrollmentsSection.tsx:210), jamais sur le
 * texte.
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

/**
 * Horodatage au format d'un `<input type="datetime-local">`, décalé de `jours`.
 *
 * 🔴 Les champs de dates de session sont des `datetime-local`, pas des `date` :
 * une valeur `2026-08-28` y est silencieusement ignorée, et le formulaire part
 * avec un champ vide. Le format exact est `YYYY-MM-DDTHH:mm`.
 */
export function horodatage(jours: number, heure = "09:00"): string {
  const d = new Date();
  d.setDate(d.getDate() + jours);
  return `${d.toISOString().slice(0, 10)}T${heure}`;
}

/**
 * Le MÊME jour que `horodatage(jours)`, au format des dates d'un export Zoom.
 *
 * ## Pourquoi ce convertisseur vit ici, et pas dans les parcours
 *
 * Deux parcours importent un relevé de connexion — le distanciel (02) et
 * l'hybride (03) — et les deux doivent le dater du jour RÉEL de la session. Sans
 * quoi `matchParticipants` n'a aucune journée à rapprocher, l'action RÉUSSIT avec
 * zéro appariement, et l'écran imprime les noms sous « Participants non
 * rapprochés ». C'est exactement l'écran que le parcours 02 lisait comme un
 * succès. Deux copies de ce calcul divergeraient, et l'une des deux serait fausse
 * en silence.
 *
 * 🔑 LE JOUR N'EST PAS RECALCULÉ : il est DÉRIVÉ de `horodatage(jours)`, dont on
 * relit les dix premiers caractères. Un calcul parallèle serait la même famille
 * de défaut qu'un prédicat recopié — et il mordrait pour de bon : `horodatage`
 * décale en heure LOCALE puis relit en UTC, si bien qu'entre minuit et deux
 * heures à Paris il désigne la veille. Un second calcul mené en heure locale
 * daterait le relevé du lendemain de la séance, `creneauxParJour` ne trouverait
 * pas la journée, et le repli sur le premier jour du plan (presence.ts:755)
 * masquerait l'écart sans un mot.
 *
 * Format exigé par `parse-zoom.ts` : `MM/DD/YYYY hh:mm:ss AM/PM`, motif ANCRÉ,
 * secondes obligatoires (parse-zoom.ts:154-172, expression en :158). Une date
 * hors format n'est pas refusée par le produit : elle rend `null`
 * (parse-zoom.ts:159) et le participant est rapproché sans intervalle — un échec
 * silencieux de plus. D'où la garde ci-dessous, qui refuse AVANT d'émettre.
 *
 * `heure` se donne en 24 h (`"09:00"`, `"13:30:00"`), comme pour `horodatage`,
 * pour que les deux helpers se lisent avec la même convention.
 */
export function horodatageZoom(jours: number, heure = "09:00"): string {
  const [annee = "", mois = "", jour = ""] = horodatage(jours).slice(0, 10).split("-");
  const [hhBrut = "", mmBrut = "00", ssBrut = "00"] = heure.split(":");
  const h24 = Number(hhBrut);
  const minutes = Number(mmBrut);
  const secondes = Number(ssBrut);
  // 🔴 `Number("")` vaut 0, et `Number.isInteger(0)` est vrai : sans le test de
  // chaîne vide, `horodatageZoom(0, "")` produirait « 12:00:00 AM » au lieu de
  // nommer sa faute. Et sans les bornes 0-59, « 09:99 » passerait la garde,
  // matcherait le motif `(\d{2})` de parse-zoom.ts:158, puis rendrait `null` —
  // c'est-à-dire le silence même que ce helper existe pour refermer.
  if (
    hhBrut.trim() === "" ||
    !Number.isInteger(h24) ||
    h24 < 0 ||
    h24 > 23 ||
    !Number.isInteger(minutes) ||
    minutes < 0 ||
    minutes > 59 ||
    !Number.isInteger(secondes) ||
    secondes < 0 ||
    secondes > 59
  ) {
    throw new Error(
      `horodatageZoom : heure « ${heure} » illisible — attendu "HH:mm" ou "HH:mm:ss" en 24 h. ` +
        "Émettre quand même produirait une date que `parse-zoom.ts:159` transformerait en " +
        "`null` sans un mot, et le participant serait rapproché sans intervalle.",
    );
  }
  const suffixe = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${mois}/${jour}/${annee} ${pad(h12)}:${pad(minutes)}:${pad(secondes)} ${suffixe}`;
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
 * Ouvre un écran de la console, avec la borne que sa compilation exige.
 *
 * 🔴 2026-08-23 — POURQUOI CE HELPER PLUTÔT QU'UN `page.goto` NU.
 *
 * `playwright.config.ts:37` borne toute navigation à trente secondes. C'est la
 * bonne valeur contre un build de production — et elle est INSUFFISANTE sous
 * `next dev`, où la route se compile À LA DEMANDE au premier appel. Mesuré le
 * 2026-08-23 : `/qualiopi/sessions/new` a dépassé trente secondes juste après
 * qu'un fichier de `src/server/` eut été touché, l'échec ne disant rien d'autre
 * que « Timeout 30000ms exceeded ».
 *
 * 🔑 C'est exactement la raison déjà écrite dans `admin-auth.ts:79` pour l'écran
 * de connexion. La nommer une fois ici évite qu'elle soit recopiée sept fois —
 * ou, pire, oubliée six fois sur sept. On ne relève PAS la borne globale : cela
 * redonnerait un délai trop long à toutes les autres navigations, et un
 * dépassement cesserait d'être lisible.
 */
export async function ouvrir(page: Page, sousChemin: string): Promise<void> {
  const cible = admin(sousChemin);
  await page.goto(cible, { timeout: 180_000 }).catch((cause: unknown) => {
    throw new Error(
      `l'écran ${cible} n'a pas répondu en 180 s. Sous \`next dev\` cette route se compile ` +
        "à la demande au premier appel, et toute modification de `src/` la refroidit ; " +
        `contre un build de production, un tel délai est une panne. Cause : ${String(cause)}`,
      { cause },
    );
  });
}

/**
 * Crée une session depuis l'écran `/qualiopi/sessions/new`, en cliquant.
 *
 * Rend l'identifiant de la session créée, lu dans l'URL d'arrivée — c'est la
 * preuve que l'action serveur a réellement écrit : un formulaire qui échoue reste
 * sur place.
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

  await ouvrir(page, "qualiopi/sessions/new");

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
    // 60 s suffisent contre un build de production. Sous `next dev`, ce qui coûte
    // n'est PAS l'action serveur : c'est la NAVIGATION qui la suit.
    //
    // 🔴 2026-08-23 — MESURÉ, APRÈS DEUX HYPOTHÈSES FAUSSES. `SessionForm` ne
    // redirige pas par le serveur : il appelle `router.push` (SessionForm.tsx:319),
    // et sous l'App Router l'URL ne bascule qu'une fois la charge RSC de la page
    // d'arrivée REÇUE. Or `/qualiopi/sessions/[id]` est l'un des écrans les plus
    // lourds de la console : sa première compilation, après toute modification de
    // `src/`, a dépassé 180 s sur un poste de développement — alors que la session
    // ÉTAIT écrite en base et que l'écran affichait « créée avec succès ».
    // Recompilée, la même page s'ouvre en 8 s.
    //
    // 🔑 On ne double pas un délai avant d'avoir lu l'écran. Ici l'écran a été
    // lu : il porte le message de succès. C'est pourquoi la borne est relevée ET
    // que le message d'échec ci-dessous va CHERCHER ce message avant de conclure.
    await page.waitForURL(/\/qualiopi\/sessions\/[0-9a-f-]{36}/, {
      timeout: process.env["CI"] === "true" ? 60_000 : 300_000,
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
    // document. `CONTENU` (`.admin-main`, admin.css:895) est le conteneur de contenu.
    const visible = await page
      .locator(CONTENU)
      .innerText()
      .catch(() => "(texte illisible)");
    const invalides = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLInputElement>("input, select, textarea"))
        .filter((c) => !c.checkValidity())
        .map((c) => `${c.id || c.name}: ${c.validationMessage}`),
    );

    // 🔴 2026-08-23 — CE QUE LE FORMULAIRE DIT VIT EN BAS, ET LE MESSAGE LE
    // COUPAIT. Les 600 premiers caractères de l'écran sont occupés par le
    // sélecteur de formation et l'avertissement d'habilitation ; le refus, comme
    // le succès, sont rendus APRÈS. Un premier diagnostic a donc lu « la page
    // ressemble au formulaire vide » sur un écran qui portait sa cause en toutes
    // lettres — et une enquête entière est partie de là.
    //
    // 🔑 Un extrait tronqué d'un écran n'est pas un diagnostic. On lit les rôles
    // qui PORTENT le verdict — `status` pour le succès, `alert` pour le refus —
    // et on les met en tête du message.
    //
    // 🔑 Un extrait tronqué d'un écran n'est pas un diagnostic : ce qu'il faut
    // remonter, c'est ce que le produit a DIT. On lit donc le refus d'abord, et
    // on le met en tête du message.
    // 🔑 CE QUE LE PRODUIT A DIT DU SUCCÈS, avant tout autre diagnostic.
    // `SessionForm` pose « Session <numéro> créée avec succès. » dans un
    // `role="status"` (SessionForm.tsx:306, rendu :754-760). S'il est là, la
    // session est ÉCRITE et la seule chose qui manque est l'arrivée sur sa
    // fiche : conclure à un refus serait faux, et enverrait chercher un défaut
    // de validation là où il n'y en a pas.
    const succes = (
      await page
        .locator('[role="status"]')
        .allInnerTexts()
        .catch(() => [])
    )
      .map((t) => t.replace(/\s+/g, " ").trim())
      .filter((t) => /créée avec succès/i.test(t))
      .join(" | ");

    const refus = (
      await page
        .locator('[role="alert"]')
        .allInnerTexts()
        .catch(() => [])
    )
      .map((t) => t.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join(" | ");
    throw new Error(
      // ⚠️ Formulation volontairement prudente. Un premier jet disait « n'a pas
      // été créée » ; vérification faite en base, la session AVAIT été écrite —
      // c'est l'arrivée sur sa fiche qui avait tardé sous `next dev`. Un message
      // d'échec qui affirme plus que ce qu'il a mesuré envoie chercher au mauvais
      // endroit.
      (succes === ""
        ? `on n'est pas arrivé sur la fiche de la session « ${titre} », et l'écran ne porte ` +
          "AUCUN message de succès : la création a probablement été refusée. "
        : `LA SESSION A BIEN ÉTÉ CRÉÉE — l'écran porte « ${succes} ». Ce qui a échoué est ` +
          "l'ARRIVÉE sur sa fiche : `SessionForm` navigue par `router.push` " +
          "(SessionForm.tsx:319) et l'URL ne bascule qu'une fois la charge RSC reçue. " +
          "Sous `next dev`, la première compilation de `/qualiopi/sessions/[id]` — l'un des " +
          "écrans les plus lourds de la console — peut dépasser cette borne. Ce n'est PAS " +
          "un refus de validation, et ce n'est pas non plus un défaut de produit : contre " +
          "un build de production, cette navigation coûte quelques secondes. ") +
        `URL : ${page.url()}. ` +
        `Refus affiché par le formulaire : ${refus === "" ? "(aucun)" : `« ${refus} »`} — ` +
        `Champs refusés par le navigateur : ${JSON.stringify(invalides)} — ` +
        `Écran : ${visible.replace(/\s+/g, " ").slice(0, 600)}`,
      { cause },
    );
  }
  return /\/sessions\/([0-9a-f-]{36})/.exec(page.url())?.[1] as string;
}

/**
 * Inscrit un stagiaire — désigné par son ADRESSE — à la session dont la fiche
 * est ouverte. Rend le nombre d'inscrits après l'opération.
 *
 * Prérequis : `page` est sur `/qualiopi/sessions/<id>` (retour de `creerSession`
 * ou d'`ouvrirSessionDemo`). Le formulaire vit dans la section `#stagiaires`
 * (sessions/[id]/page.tsx:848-860).
 *
 * ## 🔴 Pourquoi ce helper existe — sans inscrit, l'émargement ne prouve RIEN
 *
 * Et il ne prouve rien EN VERT. Chaîne mesurée sur le parcours distanciel : la
 * session créée par l'écran n'a aucun inscrit — `participants` est un nombre
 * PRÉVU, purement déclaratif (SessionForm.tsx:586-590). Donc
 * `importReleveConnexionAction` lit `enrollments = []` (presence.ts:587, propagé
 * dans `matchInputs` en :609), donc `matchParticipants` rend `matched = []`
 * (match.ts:77-80 — le `unmatched.push` étant en :66), donc l'action RÉUSSIT avec
 * `nbMatched: 0 / nbUnmatched: 2`, et le rapport imprime les deux noms sous
 * « Participants non rapprochés » (ImportReleveForm.tsx:238, liste :240-255).
 *
 * 🔑 Un test qui cherchait « Marie Martin » dans la page lisait donc L'AVEU
 * D'ÉCHEC et le certifiait comme un succès. Et il ne pouvait pas faire autrement :
 * le succès n'imprime AUCUN nom. Il n'existe pas de liste des rapprochés,
 * seulement un compteur (ImportReleveForm.tsx:216-219) — la seule liste
 * nominative de ce bloc est celle des échecs. Tout test qui y cherche un nom
 * cherche donc nécessairement dans l'aveu d'échec.
 *
 * Les parcours 02 et 03 en ont besoin à l'identique. Deux copies divergeraient.
 *
 * ## Les trois pièges que ce helper referme
 *
 * 1. **Le bouton est désactivé tant que rien n'est choisi** —
 *    `disabled={isPending || !selectedTraineeId}` (EnrollmentsSection.tsx:416).
 *    Cliquer avant l'hydratation ne fait rien ET ne dit rien : l'action meurt sur
 *    l'`actionTimeout` de quinze secondes (playwright.config.ts:36) avec
 *    « element is not enabled », symptôme qui ne ressemble pas à sa cause. On
 *    EXIGE donc `toBeEnabled` avant le clic, avec un message qui nomme
 *    l'hydratation.
 * 2. **Le message de succès ment sur la seconde inscription** — « Stagiaire
 *    inscrit avec succès » (`role="status"`, EnrollmentsSection.tsx:430) reste
 *    affiché après la première ; l'attendre validerait la seconde à tort. On
 *    vérifie donc le COMPTEUR de la fiche (`N inscrits / M prévus`,
 *    sessions/[id]/page.tsx:621-622, dans la section `#infos` ouverte en :590), et
 *    on exige qu'il ait AVANCÉ d'une unité — une garde qui ne peut être satisfaite
 *    que par ce qu'on vient de faire.
 * 3. **Un refus est silencieux à l'écran** — l'erreur d'action s'affiche dans un
 *    `[role="alert"]` du formulaire (EnrollmentsSection.tsx:420-427, attribut en
 *    :422). Le sondage la remonte donc dans sa VALEUR REÇUE (« REFUS: … ») plutôt
 *    que dans un message figé qui affirmerait « aucun message d'erreur lisible »
 *    alors qu'il y en a précisément un.
 */
export async function inscrire(page: Page, email: string): Promise<number> {
  // Le `<form>` est scopé par le seul champ qui lui appartient en propre. Le
  // titre « Inscrire un stagiaire » est un `<h3>` HORS du formulaire
  // (EnrollmentsSection.tsx:503-505) et le bouton porte le même mot : viser par
  // le texte prendrait l'un pour l'autre.
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
      `l'option « ${email} » n'a pas d'attribut value exploitable — le sélecteur ` +
        "n'enverrait aucun identifiant de stagiaire à `enrollTraineeAction`",
    );
  }
  // « Inscrire » EXACTEMENT : pendant l'action le bouton devient « Inscription… »
  // (EnrollmentsSection.tsx:417), et un motif non ancré matcherait les deux états.
  const bouton = formulaire.getByRole("button", { name: /^Inscrire$/ });

  // 🔑 LA SÉLECTION EST UNE BARRIÈRE D'HYDRATATION, ET ON LA FRANCHIT AU LIEU
  // DE LA CONSTATER. Un `change` émis avant l'attache du gestionnaire racine de
  // React ne pose AUCUN état et n'est jamais rejoué : `selectedTraineeId` reste
  // vide, le bouton reste `disabled` (EnrollmentsSection.tsx:416) à vie, et le
  // clic meurt sur l'`actionTimeout` avec « element is not enabled » — un
  // symptôme qui ne ressemble pas à sa cause. Sélectionner UNE fois puis attendre
  // ne répare rien : cela ne fait que mesurer la panne. On REPOSE donc la
  // sélection à chaque tour, jusqu'à ce que le bouton s'active.
  //
  // ⚠️ `isEnabled()` LÈVE quand le locator ne résout aucun nœud — ce qui arrive
  // si une inscription précédente est encore en vol et que le libellé est passé à
  // « Inscription… ». Le `.catch` rend alors `false` pour que le sondage retente,
  // au lieu d'escamoter le message ci-dessous derrière un « Element not found ».
  await expect
    .poll(
      async () => {
        await select.selectOption(valeur).catch(() => {
          /* champ momentanément désactivé pendant une transition : on retentera. */
        });
        return bouton.isEnabled().catch(() => false);
      },
      {
        timeout: 60_000,
        intervals: [500, 1_000, 2_000],
        message:
          `le bouton « Inscrire » ne s'est jamais activé après avoir choisi ${email} : ` +
          "`EnrollForm` n'a pas hydraté (le `change` du sélecteur n'atteint aucun " +
          "gestionnaire et n'est jamais rejoué, EnrollmentsSection.tsx:403), donc " +
          "`selectedTraineeId` reste vide et le bouton reste `disabled` (:416)",
      },
    )
    .toBe(true);

  // ── Ce qui prouve l'aboutissement : le COMPTEUR de la fiche ────────────────
  const infos = page.locator("#infos");
  const lireInscrits = async (): Promise<number | null> => {
    const texte = await infos.innerText({ timeout: 5_000 }).catch(() => "");
    // La classe d'espace couvre l'espace insécable : le compteur est composé de
    // trois nœuds JSX (`{n} inscrits / {m} prévus`) et `innerText` peut les
    // recoller avec n'importe quelle espace.
    const trouve = /(\d+)\s+inscrits\s*\//.exec(texte.replace(/\s+/g, " "));
    return trouve?.[1] === undefined ? null : Number(trouve[1]);
  };

  const avant = await lireInscrits();
  if (avant === null) {
    throw new Error(
      "le compteur « N inscrits / M prévus » est introuvable dans `#infos` " +
        "(sessions/[id]/page.tsx:590 pour la section, :621-622 pour le compteur) : sans lui, " +
        "on n'a AUCUN moyen de distinguer une inscription réussie d'un refus silencieux — " +
        `URL : ${page.url()}`,
    );
  }

  await bouton.click();

  /**
   * Valeur sondée : soit l'état du compteur, soit le refus affiché. Un message de
   * sondage est FIGÉ ; la valeur reçue, elle, dit ce que l'écran montrait vraiment.
   * Écrire « ni arrivée, ni message d'erreur lisible » dans le message mentirait
   * le jour où il y a précisément un message d'erreur.
   */
  const etat = async (): Promise<string> => {
    // Seul le rôle d'alerte DU FORMULAIRE (EnrollmentsSection.tsx:422) nous
    // concerne : les lignes du tableau en portent trois autres (:221, :276,
    // :318), pour le statut, les adaptations et la révocation d'accès.
    const alerte = formulaire.locator('[role="alert"]');
    if ((await alerte.count()) > 0) {
      const texte = await alerte
        .first()
        .innerText({ timeout: 1_000 })
        .catch((cause: unknown) => `(alerte illisible : ${String(cause).slice(0, 120)})`);
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
        "(`#infos`, sessions/[id]/page.tsx:621-622). La valeur reçue dit laquelle des deux " +
        "causes s'est produite : « REFUS: … » = `enrollTraineeAction` a refusé et l'a écrit " +
        "dans le formulaire ; un compteur inchangé = l'action n'a pas abouti, ou le " +
        "`router.refresh()` d'EnrollmentsSection.tsx:456-458 n'a pas repeint la fiche",
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
  await ouvrir(page, "qualiopi/sessions");

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
    await page.waitForLoadState("domcontentloaded");
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
  // 🔑 On mesure la ZONE DE CONTENU, pas `body` : ce fichier passe trente lignes
  // à démontrer qu'un repère qui englobe le rail ne garde rien, et il employait
  // `body` dans son propre chemin critique. Aucun des 146 libellés du rail ne porte
  // « AXI-SES-DEMO-001 », donc l'assertion était juste — mais le message d'échec,
  // lui, emportait la barre latérale et la topbar, et noyait la cause.
  await expect(
    page.locator(CONTENU),
    "la fiche de session n'a jamais affiché son numéro — elle est restée en cours de rendu",
  ).toContainText("AXI-SES-DEMO-001", { timeout: 90_000 });

  return /\/sessions\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? null;
}
