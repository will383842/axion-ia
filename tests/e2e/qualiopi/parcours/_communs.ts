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
    // document. `.admin-main` (admin.css:894) est le conteneur de contenu.
    const visible = await page
      .locator(".admin-main")
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
  await expect(
    page.locator("body"),
    "la fiche de session n'a jamais affiché son numéro — elle est restée en cours de rendu",
  ).toContainText("AXI-SES-DEMO-001", { timeout: 90_000 });

  return /\/sessions\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? null;
}
