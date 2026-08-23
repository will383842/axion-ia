/**
 * PARCOURS 5 — Client ENTREPRISE puis client PARTICULIER, joués côte à côte.
 *
 * Phase 6 de `_AUDIT/PROMPT-AUDIT-QUALIOPI-E2E-50-AGENTS-2026-08-18.md` :
 * « joués côte à côte pour exposer les divergences ».
 *
 * ⚠️ CADRAGE — le B2C n'est pas pratiqué par l'organisme (décision Will). Ce
 * parcours vérifie donc que l'écran ne MENT pas sur ce qu'il propose : si le
 * type « Particulier (B2C — CPF perso) » existe dans le formulaire
 * (ClientForm.tsx:142), il doit mener quelque part. Il ne conclut RIEN sur la
 * couverture réglementaire du B2C — contrat de formation professionnelle
 * (C. trav. L6353-3), délai de rétractation, absence d'OPCO : cette question se
 * pose à Will AVANT d'être rapportée, pas après.
 *
 * ## Ce que ce fichier prouve DÉSORMAIS
 *
 *  1. **Le formulaire adapte sa saisie au type, ET React l'a bien pris.** Les
 *     cinq champs qui n'identifient qu'un EMPLOYEUR (SIRET, NAF, taille, IDCC,
 *     fonction du contact) disparaissent pour un particulier, et le champ
 *     principal cesse de s'appeler « Raison sociale ».
 *  2. **Le serveur ÉCRIT le type.** La colonne « Type » de la liste
 *     (clients/page.tsx:214-216) relit `Client.type` depuis la base : c'est la
 *     seule preuve que le choix a survécu à l'action serveur.
 *  3. **La divergence voyage jusqu'à l'ÉDITION DE BRANCHE.** Le sélecteur
 *     d'OPCO y est masqué pour un particulier (ClientBrancheForm.tsx:163-182,
 *     alimenté par clients/page.tsx:279) — un particulier n'a pas d'opérateur
 *     de compétences, lui en proposer un inviterait à saisir un financeur
 *     inexistant, qui remonterait ensuite sur la convention et le dossier de
 *     financement.
 *  4. **Le type Particulier MÈNE QUELQUE PART.** Le tunnel de vente accepte la
 *     fiche B2C comme point de départ, exactement comme la fiche B2B.
 *
 * ## Ce qu'il ne prouve TOUJOURS pas — à ne pas sur-déclarer
 *
 *  · La chaîne B2C au-delà de l'étape 1 du tunnel (devis, session, convention,
 *    facture) n'est pas jouée. « Mène quelque part » s'arrête au seuil.
 *  · La garde serveur `refuserChampsEntreprisePourParticulier`
 *    (server/actions/qualiopi/clients.ts:65-81) refuse SIRET/NAF/IDCC/OPCO sur
 *    un particulier. Elle est INATTEIGNABLE à la souris, puisque le formulaire
 *    masque précisément ces champs : aucun geste humain ne peut la déclencher.
 *    C'est un constat d'audit, pas un trou à combler en appelant l'action
 *    serveur en direct — ce parcours ne court-circuite jamais l'interface.
 *
 * ## ⚠️ CE HARNAIS EST UNE GATE DEPUIS LE 2026-08-23 — la phrase inverse était
 * ##    écrite ici, et elle est PÉRIMÉE
 *
 * Un premier jet de ce fichier portait, en toutes lettres : « Le step
 * “Playwright suite” porte `continue-on-error: true` (ci.yml:519). Aucun rouge
 * de ce fichier ne fera rougir une PR. » C'était vrai jusqu'au 2026-08-22.
 * Vérifié dans le dépôt : `.github/workflows/ci.yml:479` porte désormais
 * « ✅ 2026-08-23 — `continue-on-error` RETIRÉ. CE GATE PEUT ENFIN ROUGIR »,
 * et `Gate B · per-PR` est un contexte EXIGÉ par la protection de `main`, avec
 * `strict: true` (ci.yml:495-499).
 *
 * 🔑 Conséquence pratique, à lire avant d'ajouter quoi que ce soit ici : un
 * rouge de ce fichier bloque 100 % des PR, pas seulement la sienne. Une
 * assertion approximative ne coûte plus « un journal illisible », elle coûte le
 * dépôt entier. C'est aussi pourquoi chaque zéro de ce fichier porte son
 * contre-témoin : un faux rouge et un faux vert se paient maintenant au même
 * guichet.
 *
 * ⚠️ Une affirmation sur l'état d'un gate se REMESURE, elle ne se recopie pas :
 * celle-ci avait migré jusque dans `AGENTS.md` avant d'être corrigée.
 *
 * ## ⚠️ DÉRIVE ASSUMÉE — deux fiches clients permanentes par exécution
 *
 * Ce parcours crée deux clients et ne les supprime pas : la console n'offre pas
 * de suppression de client à la souris, et purger en base contredirait la règle
 * du dossier (un parcours clique, il n'écrit pas). Conséquences connues, à
 * arbitrer (aucune décision prise à ce jour) :
 *
 *   · la liste `/qualiopi/clients` grossit d'un couple par exécution ;
 *   · le tunnel de vente charge les clients avec `take: 500`
 *     (vente/new/page.tsx:57-64), triés `raisonSociale asc`. Le message d'échec
 *     de l'étape 4 nomme cette cause AVEC sa condition exacte, plutôt que
 *     d'accuser la pré-sélection.
 *
 * ## ⚠️ Budget de la suite — le bon critère, et pourquoi ce n'est PAS une somme
 *
 * Un premier jet posait ici un tableau d'additions se concluant par « il reste
 * quinze secondes sous le budget ». Ce tableau était FAUX, et il se présentait
 * comme vérifiable ligne à ligne — la pire combinaison. Mesuré : `loginAsAdmin`
 * n'est pas borné à 180 secondes. Son `goto` propre vaut 120 000
 * (admin-auth.ts:79), ses trois actions héritent de l'`actionTimeout` de 15 000
 * (playwright.config.ts:36), et son `waitForURL` vaut 60 000 en CI, 180 000
 * hors CI (admin-auth.ts:141) — soit un pire cas local d'environ 345 secondes à
 * lui seul. Le tableau omettait en outre la vingtaine de bornes de 30 secondes
 * portées par les assertions.
 *
 * 🔑 LE BON CRITÈRE N'EST PAS LA SOMME, C'EST LE MAXIMUM. Une borne atteinte
 * ÉCHOUE et termine le test : au plus UNE est donc consommée en entier. Le
 * budget doit dominer la plus longue borne interne — `loginAsAdmin`, au pire
 * environ 345 secondes hors CI — avec assez de marge pour que le reste du
 * chemin ait le temps de produire son message. Sept minutes le font ; c'est ce
 * qui est déclaré plus bas.
 *
 * ⚠️ ET LE BUDGET DOIT AUSSI TENIR SOUS LE PLAFOND DU JOB. `playwright.config.ts:11`
 * porte `retries: isCI ? 2 : 0` : un échec dur rejoue TROIS fois. À dix minutes
 * de budget, cela faisait exactement les trente minutes de `timeout-minutes`
 * (ci.yml:534) — le job expirait, et la gate devenait MUETTE au lieu de rouge.
 * C'est le défaut même que ce harnais combat.
 *
 * 🔴 Un premier jet déclarait cinq minutes. Sous ce budget, la connexion à elle
 * seule pouvait en consommer trois : AUCUN des messages d'étape ne pouvait plus
 * sortir, et le test mourait sur « Test timeout exceeded » — précisément le
 * défaut que tout ce harnais a été bâti pour éliminer. Le cliquet ne l'avait
 * pas vu parce qu'il ne compare que le MAXIMUM d'une borne au budget, jamais
 * leur somme : `tests/unit/e2e-harness/delai-interne-sous-le-budget.spec.ts`.
 *
 * ⚠️ Ce cliquet lit les LITTÉRAUX du fichier, COMMENTAIRES COMPRIS. Les paliers
 * ci-dessus sont donc écrits en milliers, jamais sous la forme d'un littéral de
 * délai : recopier ici la syntaxe exacte d'une option de délai ferait compter
 * dix minutes comme un « délai interne », égal au budget, et le cliquet
 * rougirait sur sa propre documentation. Jurisprudence : « un test statique
 * trouve ses propres commentaires ».
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { loginAsAdmin } from "../../fixtures/admin-auth";
import { admin, champEtiquete, CONTENU, ENREGISTREMENT } from "./_communs";

type TypeClient = "entreprise" | "particulier";

/**
 * Les cinq champs que le formulaire réserve à un EMPLOYEUR.
 *
 * Tous sont enveloppés par `{!isParticulier && …}` — le bloc de quatre
 * (ClientForm.tsx:160-244) et la fonction du contact (ClientForm.tsx:285-299).
 */
const CHAMPS_EMPLOYEUR = [
  { id: "c-siret", source: "ClientForm.tsx:174" },
  { id: "c-naf", source: "ClientForm.tsx:204" },
  { id: "c-taille", source: "ClientForm.tsx:217" },
  { id: "c-idcc", source: "ClientForm.tsx:235" },
  { id: "c-contact-fonction", source: "ClientForm.tsx:291" },
] as const;

/** Ce que la colonne « Type » doit afficher (clients/page.tsx:214-216). */
const TYPE_AFFICHE: Record<TypeClient, string> = {
  entreprise: "Entreprise",
  particulier: "Particulier",
};

/**
 * Le libellé accessible du champ principal, tel qu'un lecteur d'écran l'entend.
 *
 * On le lit à la main plutôt que par `champEtiquete()` parce que sa valeur est
 * précisément l'objet du test : le helper partagé exige un motif, ce qui
 * reviendrait à décider d'avance de la réponse.
 */
async function libelleChampPrincipal(page: Page): Promise<string> {
  // 🔴 `page.evaluate` N'ATTEND RIEN : ni visibilité, ni attachement, ni rendu.
  // Si `label[for="c-raison"]` n'est pas encore là — ou plus là parce que
  // quelqu'un a renommé l'`id` — cette fonction rend « » IMMÉDIATEMENT et en
  // silence. Les trois assertions de divergence accuseraient alors `isParticulier`
  // (« le formulaire demande «  » à un PARTICULIER — même libellé que pour une
  // entreprise ») alors que la cause est un identifiant renommé.
  //
  // 🔑 Rien, sur la branche PARTICULIER, n'ancre positivement ce champ : les cinq
  // assertions y sont des `toHaveCount(0)`. Le dernier contenu PROUVÉ présent est
  // `#c-type`. On exige donc le libellé lui-même avant de le lire.
  await expect(
    page.locator('label[for="c-raison"]'),
    'le champ principal n\'a pas de `<label for="c-raison">` (ClientForm.tsx:146-148) — ' +
      "sans lui la lecture du libellé rend « » sans un mot, et les trois assertions de " +
      "divergence accuseraient le composant à tort",
  ).toBeVisible({ timeout: 30_000 });
  return page.evaluate(() => {
    const l = document.querySelector('label[for="c-raison"]');
    return (l?.textContent ?? "").replace(/\s+/g, " ").trim();
  });
}

/**
 * Bascule le type de client et EXIGE que la saisie s'y soit adaptée.
 *
 * 🔴 Le libellé du champ principal DÉPEND du type, et React le recalcule au
 * rendu SUIVANT. Le lire immédiatement après `selectOption` renvoyait celui de
 * l'état PRÉCÉDENT : le parcours accusait le formulaire de demander une
 * « Raison sociale » à un particulier alors qu'il ne le fait pas.
 *
 * 🔑 Lire une valeur dérivée d'un état React juste après l'avoir changé, c'est
 * lire l'ancien état. Il faut une barrière de rendu — ici, la disparition des
 * champs employeur, qui dérivent du même `isParticulier`.
 *
 * 🔴 2026-08-23 — LA BARRIÈRE PRÉCÉDENTE ÉTAIT INERTE POUR UNE ENTREPRISE, ET
 * LE COMMENTAIRE AFFIRMAIT L'INVERSE.
 *
 * Le formulaire naît « entreprise » : `useState<ClientType>(iv.type ?? "entreprise")`
 * (ClientForm.tsx:56). Les cinq champs employeur sont donc déjà dans le HTML
 * SERVEUR. Attendre `toHaveCount(1)` sur eux après avoir choisi « entreprise »
 * était satisfait par le SSR SEUL, hydraté ou non — rien ne prouvait que le
 * `change` avait atteint un état React avant que le `fill` puis le clic ne
 * partent. Chemin d'échec réel : React hydrate APRÈS le `fill`, l'état
 * `raisonSociale` reste vide, `z.string().min(1)` (clients.ts:87) refuse, et on
 * paie tout le sondage de création pour lire « REFUS: … ».
 *
 * 🔑 D'où l'ALLER-RETOUR, quel que soit le type demandé : on passe d'abord en
 * « Particulier » et on exige la DISPARITION de `#c-siret`. Aucun rendu serveur
 * ne peut produire ce zéro — seule une réaction de React le peut. Puis on pose
 * le type voulu. Le même sélecteur est ainsi observé à 1 → 0 → 1 dans une seule
 * exécution pour une entreprise, 1 → 0 pour un particulier.
 *
 * 🔑 CONTRE-TÉMOIN INTÉGRÉ. `toHaveCount(0)` sur un sélecteur est le genre
 * d'assertion qui reste verte quand le sélecteur est simplement faux — le dépôt
 * l'a payé quatre fois (`nav[aria-label]` sur un `aside`, `[href$=""]` que la
 * spec CSS interdit de matcher, un `data-testid` absent, une union qui prenait
 * le premier du DOM). Le témoin d'état initial et la branche « entreprise »
 * exigent donc, sur EXACTEMENT les mêmes sélecteurs, `toHaveCount(1)` ET la
 * visibilité.
 */
async function choisirLeType(page: Page, type: TypeClient): Promise<void> {
  const selecteur = await champEtiquete(page, "c-type", /^Type de client$/);

  // Témoin d'ÉTAT INITIAL, avant tout geste : le formulaire naît « entreprise »
  // (ClientForm.tsx:56), donc `#c-siret` est là — SSR compris. Sans lui, le zéro
  // exigé juste après ne prouverait que la nullité du sélecteur.
  await expect(
    page.locator("#c-siret"),
    "« #c-siret » (ClientForm.tsx:174) est absent de `/qualiopi/clients/new` AVANT toute " +
      "interaction, alors que le formulaire naît « entreprise » (ClientForm.tsx:56) et rend ce " +
      "champ dès le HTML serveur. L'identifiant a changé, ou l'écran n'a pas rendu le " +
      "formulaire — dans les deux cas, TOUTES les mesures qui suivent sont sans valeur.",
  ).toHaveCount(1, { timeout: 30_000 });

  // Aller : la barrière d'hydratation proprement dite.
  await selecteur.selectOption("particulier");
  await expect(
    page.locator("#c-siret"),
    "le formulaire n'a jamais réagi au passage en « Particulier » : « #c-siret » " +
      "(ClientForm.tsx:174) est toujours là. Aucun rendu SERVEUR ne peut produire ce champ " +
      "absent — c'est donc React qui n'a pas hydraté la page, le `change` n'a atteint aucun " +
      "état, et tout ce qui suivrait (remplir le nom, cliquer « Créer le client ») serait tout " +
      "aussi inerte, SANS le dire. Autre cause possible : la garde `{!isParticulier && …}` " +
      "(ClientForm.tsx:160) a sauté.",
  ).toHaveCount(0, { timeout: 60_000 });

  // Retour (ou maintien) : le type réellement demandé. Appelé sans condition —
  // une garde `if (type !== "particulier")` ne garderait rien et cacherait le
  // fait que le geste final est TOUJOURS le même.
  await selecteur.selectOption(type);

  const attendu = type === "particulier" ? 0 : 1;
  for (const champ of CHAMPS_EMPLOYEUR) {
    await expect(
      page.locator(`#${champ.id}`),
      type === "particulier"
        ? `« #${champ.id} » (${champ.source}) est encore dans le DOM après avoir choisi ` +
            "« Particulier ». Ce champ n'identifie qu'un EMPLOYEUR — établissement, branche, " +
            "opérateur de compétences — et le serveur le REFUSE pour un particulier " +
            "(refuserChampsEntreprisePourParticulier, clients.ts:65-81). L'hydratation est " +
            "déjà prouvée plus haut : chercher du côté de la garde `{!isParticulier && …}` " +
            "(ClientForm.tsx:160 et :285), pas du côté de React."
        : `« #${champ.id} » (${champ.source}) est introuvable pour une ENTREPRISE, alors qu'il ` +
            "était présent avant l'aller-retour. C'est le contre-témoin du test : sans lui, le " +
            "`toHaveCount(0)` posé sur le même sélecteur pour un particulier prouverait " +
            "seulement que le sélecteur est faux.",
    ).toHaveCount(attendu, { timeout: 30_000 });
  }

  if (type !== "particulier") {
    // Présent dans le DOM ne suffit pas : un champ masqué par CSS serait
    // « compté » sans être saisissable. On exige la visibilité sur le témoin.
    await expect(
      page.locator("#c-siret"),
      "« #c-siret » existe mais n'est pas visible pour une entreprise — le contre-témoin " +
        "du test ne vaut plus rien s'il porte sur un champ que personne ne peut remplir",
    ).toBeVisible({ timeout: 30_000 });
  }
}

/**
 * Crée un client depuis `/qualiopi/clients/new`, en cliquant, et rend le
 * libellé accessible du champ principal tel qu'il était AU MOMENT DE LA SAISIE.
 *
 * 🔴 2026-08-22 — L'ATTENTE D'ARRIVÉE PRÉCÉDENTE ÉTAIT MÉCANIQUEMENT INERTE.
 *
 *     await page.waitForURL(/\/qualiopi\/clients(\/[0-9a-f-]{36})?/, …)
 *
 * Le groupe UUID est optionnel et le motif n'est pas ancré : l'URL de DÉPART,
 * `/qualiopi/clients/new`, le satisfait déjà. Or `waitForURL` teste l'URL
 * courante d'abord, puis rend la main (playwright-core 1.62.1,
 * coreBundle.js:59990-59994 + `urlMatches` 4534-4541). Conséquences :
 *
 *   · un refus Zod passait pour un succès — le parcours croyait avoir créé un
 *     client qui n'existait pas ;
 *   · l'appelant enchaînait un `page.goto` PAR-DESSUS une action serveur en
 *     vol, ce qui pouvait annuler l'écriture elle-même.
 *
 * 🔑 On exige donc l'égalité du `pathname` avec la liste — `router.push(baseHref)`
 * n'est appelé QUE dans la branche de succès (ClientForm.tsx:104-108), et
 * `baseHref` vaut exactement `/fr/<prefix>/qualiopi/clients`
 * (clients/new/page.tsx:33 et :69).
 *
 * 🔑 La valeur sondée porte AUSSI le refus. Un message de sondage est FIGÉ ; la
 * valeur reçue, elle, dit ce que l'écran montrait vraiment. Écrire « ni arrivée,
 * ni message d'erreur lisible » mentirait le jour où il y a précisément un
 * message d'erreur — c'est-à-dire le seul jour où on lira ce message.
 *
 * ⚠️ La lecture de l'alerte est BORNÉE à une seconde. Sans cela, chaque
 * itération du sondage hériterait de l'`actionTimeout` de quinze secondes
 * (playwright.config.ts:36) et le chemin NOMINAL paierait l'attente à chaque
 * tour.
 */
async function creerClient(page: Page, type: TypeClient, marqueur: string): Promise<string> {
  // 🔑 `domcontentloaded`, pas `networkidle` : on attend un CONTENU, pas un état
  // de réseau. Une page admin ne se tait jamais côté réseau, et une attente
  // réseau consomme le budget du test avant de nommer quoi que ce soit.
  // Le délai propre couvre la compilation à la demande de `next dev` : la borne
  // globale de navigation est à trente secondes (playwright.config.ts:37).
  await page.goto(admin("qualiopi/clients/new"), {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  await choisirLeType(page, type);
  const libelle = await libelleChampPrincipal(page);

  await page.locator("#c-raison").fill(marqueur);

  // « Créer le client » exactement : pendant l'action le bouton devient
  // « Création… » (ClientForm.tsx:325), et un motif non ancré matcherait les
  // deux états.
  await page.getByRole("button", { name: /^Créer le client$/ }).click();

  const listePath = admin("qualiopi/clients");

  /**
   * Soit le chemin atteint, soit le refus affiché.
   *
   * 🔑 Le `[role="alert"]` est cherché DANS le formulaire de création lui-même
   * (`form:has(#c-raison)`, ClientForm.tsx:314-321) et non dans « un `form` » :
   * la console porte d'autres formulaires (recherche, déconnexion), et un
   * `[role="alert"]` étranger ferait préfixer « REFUS: » à un texte sans rapport
   * — une accusation portée contre la mauvaise action.
   */
  const etat = async (): Promise<string> => {
    const alerte = page.locator('form:has(#c-raison) [role="alert"]');
    if ((await alerte.count()) > 0) {
      const texte = await alerte
        .first()
        .innerText({ timeout: 1_000 })
        .catch(() => "(alerte illisible)");
      return `REFUS: ${texte.replace(/\s+/g, " ").trim()}`;
    }
    return new URL(page.url()).pathname;
  };

  await expect
    .poll(etat, {
      timeout: 90_000,
      message:
        `après « Créer le client » pour « ${marqueur} » (type ${type}), on n'est pas revenu ` +
        `sur la liste ${listePath}. La valeur reçue dit laquelle des causes s'est produite : ` +
        "« REFUS: … » = `createClientAction` a refusé et l'a écrit dans le formulaire " +
        "(premierMessageZod, clients.ts:211) ; un chemin resté sur `/new` = l'action n'a pas " +
        "abouti. ⚠️ L'hydratation, elle, est DÉJÀ prouvée par l'aller-retour de " +
        "`choisirLeType` : ne pas la chercher ici. " +
        "⚠️ Formulation prudente et volontaire : une fiche PEUT malgré tout avoir été écrite " +
        "— vérifier la liste avant de conclure.",
    })
    .toBe(listePath);

  return libelle;
}

/**
 * L'identifiant du client porté par une ligne de la liste.
 *
 * 🔴 On vise le LIEN par son nom accessible, qui vaut exactement la raison
 * sociale (clients/page.tsx:190-194). Le bouton « Éditer » de la même cellule
 * porte `aria-label="Modifier <raison sociale>"` (:198) : un motif non exact
 * prendrait les deux et violerait le mode strict.
 */
async function idDuClient(ligne: Locator, marqueur: string): Promise<string> {
  const lien = ligne.getByRole("link", { name: marqueur, exact: true });
  await expect(
    lien,
    `la ligne de « ${marqueur} » ne porte pas de lien vers sa fiche — sans lui, on ne peut ` +
      "pas récupérer l'identifiant du client, et la suite du parcours (tunnel de vente) est " +
      "impossible. Le nom du client EST ce lien (clients/page.tsx:190-194).",
  ).toHaveCount(1, { timeout: 30_000 });

  const href = (await lien.getAttribute("href")) ?? "";
  const id = /\/qualiopi\/clients\/([0-9a-f-]{36})$/.exec(href)?.[1];
  if (id === undefined) {
    throw new Error(
      `le lien de « ${marqueur} » pointe sur « ${href} », d'où aucun identifiant de client ` +
        "ne se lit. Attendu : /fr/<prefix>/qualiopi/clients/<uuid> (clients/page.tsx:191).",
    );
  }
  return id;
}

/**
 * Le tunnel de vente accepte-t-il cette fiche comme point de départ ?
 *
 * 🔑 On passe par la PRÉ-SÉLECTION `?clientId=` (vente/new/page.tsx:104-107)
 * plutôt que de balayer les `<option>` du combobox à la recherche du bon
 * libellé : c'est le chemin réel des boutons « Nouvelle vente » du CRM, et cela
 * évite un `selectOption` par le texte, qui casserait à la première retouche de
 * mise en forme.
 *
 * ⚠️ Quatre assertions, et l'ordre compte : chacune isole une cause différente.
 *   1. le combobox existe (l'écran a bien rendu l'étape 1) ;
 *   2. il porte PLUS que son seul placeholder (la liste est arrivée) ;
 *   3. NOTRE client y est (il n'est pas tombé hors du `take: 500`) ;
 *   4. il est PRÉ-SÉLECTIONNÉ (la résolution serveur `?clientId=` fonctionne).
 * Puis « Suivant » doit être actionnable : `disabled={(etape === 1 && !peutQuitterEtape1) || …}`
 * (VenteWizard.tsx:1306-1312, via `peutQuitterEtape1` :540). C'est là toute la
 * portée du mot « MÈNE QUELQUE PART » — le seuil, pas la traversée.
 *
 * ⚠️ HONNÊTETÉ SUR L'ASSERTION 4 : `clientId` naît de
 * `brouillon?.clientId ?? clientInitialId ?? ""` (VenteWizard.tsx:202) et le
 * `<select>` est rendu côté serveur. `toHaveValue` est donc satisfait par le
 * HTML serveur seul. C'est VOULU — ce qu'on garde ici est la résolution
 * SERVEUR de `?clientId=`, pas une réaction du navigateur. L'hydratation, elle,
 * a déjà été prouvée sur le formulaire de création.
 *
 * On ne CLIQUE PAS « Suivant » : `persisterBrouillon` (VenteWizard.tsx:284-312,
 * `createVenteBrouillonAction` :290 et `updateVenteBrouillonAction` :298) écrit
 * un `VenteBrouillon`, donc une ligne de plus en base à chaque exécution, pour
 * une preuve que l'état du bouton donne déjà.
 */
async function leTunnelDeVenteAccepte(page: Page, id: string, marqueur: string): Promise<void> {
  await page.goto(`${admin("qualiopi/vente/new")}?clientId=${id}`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });

  // `<select>` ⇒ rôle `combobox`. Nom accessible « Client » EXACT
  // (VenteWizard.tsx:665). ⚠️ La raison n'est PAS celle qu'un premier jet
  // écrivait : « Rechercher un client » (:656) est un `<input type="search">`,
  // donc un `searchbox`, et « Mode de sélection du client » (:621) un
  // `role="radiogroup"` — aucun des deux n'est un `combobox`, ils ne pouvaient
  // pas « entrer aussi ». `exact` reste juste, et sa vraie raison est qu'il n'y
  // a qu'UN `combobox` à l'étape 1 : un nom non ancré se relâcherait le jour où
  // un second s'ajoute.
  const combo = page.getByRole("combobox", { name: "Client", exact: true });
  await expect(
    combo,
    `l'étape 1 du tunnel de vente n'a pas rendu son sélecteur de client pour « ${marqueur} » — ` +
      `URL : ${page.url()}. Soit l'écran a redirigé (session admin perdue), soit le mode de ` +
      "sélection n'est plus « Client existant » par défaut (VenteWizard.tsx:197-200, le " +
      '`<select>` vit sous `modeClient === "existant"` :649), soit le nom accessible du ' +
      "`<select>` (VenteWizard.tsx:665) a changé.",
  ).toHaveCount(1, { timeout: 30_000 });

  // 🔴 ATTENDRE AVANT DE COMPTER. Un premier jet lisait `count()` immédiatement
  // après l'assertion ci-dessus, sans attente propre : si les `<option>`
  // arrivaient au rendu suivant, le message annonçait « 1 option listée » et
  // envoyait chercher un dépassement du `take: 500` qui n'avait pas eu lieu.
  //
  // 🔑 Le placeholder « — Choisir un client — » est rendu SANS CONDITION
  // (VenteWizard.tsx:668). « Strictement plus d'une option » signifie donc
  // exactement « au moins un client est proposé » — et ce contre-témoin rougit
  // si la liste entière manque, avant qu'on n'accuse NOTRE fiche.
  await expect
    .poll(() => combo.locator("option").count(), {
      timeout: 30_000,
      message:
        "le sélecteur de client n'offre que son placeholder « — Choisir un client — » " +
        "(VenteWizard.tsx:668) : AUCUN client n'est proposé. La liste vient du serveur " +
        "(vente/new/page.tsx:57-64) ; c'est elle qui manque, pas notre fiche. Ne pas lire " +
        "l'assertion suivante comme un défaut de ce parcours.",
    })
    .toBeGreaterThan(1);

  const nbOptions = await combo.locator("option").count();
  await expect(
    combo.locator("option").filter({ hasText: marqueur }),
    `« ${marqueur} » n'est pas proposé par le tunnel de vente (${nbOptions} options listées, ` +
      "placeholder « — Choisir un client — » compris). ⚠️ AVANT d'accuser le produit : la " +
      "liste est bornée à `take: 500` et triée par raison sociale ASC " +
      "(vente/new/page.tsx:57-64), et ce parcours crée DEUX fiches permanentes par exécution " +
      "sans nettoyage. Un nom « E2E-… » se classe TÔT dans l'alphabet : il ne sort des 500 " +
      "que s'il existe plus de 500 clients dont la raison sociale le précède — cause " +
      "étrangère au défaut gardé, à vérifier en COMPTANT la table avant de conclure. " +
      "(La formulation « un client récent sort de la liste » a été retirée : le tri n'est " +
      "pas chronologique, et elle affirmait plus que ce qui avait été mesuré.)",
  ).toHaveCount(1, { timeout: 30_000 });

  await expect(
    combo,
    `le tunnel de vente n'a pas pré-sélectionné « ${marqueur} » alors que l'URL portait ` +
      `?clientId=${id}. La résolution est SERVEUR (vente/new/page.tsx:104-107) : elle rend ` +
      "`undefined` si l'identifiant n'est pas trouvé DANS la liste bornée à 500. L'option " +
      "vient d'être vue juste au-dessus, donc ici la cause est la pré-sélection elle-même — " +
      "ou la reprise d'un brouillon, qui la court-circuite (`sp.brouillon === undefined`, :105).",
  ).toHaveValue(id, { timeout: 30_000 });

  // 🔴 `toBeEnabled` échoue AUSSI quand le locator résout ZÉRO nœud — bouton
  // renommé, `AdminButton` refactoré en `<div role="button">`, ou étape ≠ 1
  // parce qu'un brouillon a été repris. Sans cette cardinalité, le message
  // ci-dessous accuserait le tunnel de refuser la fiche B2C alors que le bouton
  // n'existait simplement plus. C'était la seule assertion de ce fichier sans
  // contre-témoin capable de séparer ses deux causes.
  await expect(
    page.getByRole("button", { name: "Suivant", exact: true }),
    "le bouton « Suivant » de l'étape 1 est INTROUVABLE (VenteWizard.tsx:1306-1312, rendu " +
      "par AdminButton.tsx:139-149) — ce n'est pas un refus du tunnel, c'est un repère cassé",
  ).toHaveCount(1, { timeout: 30_000 });

  await expect(
    page.getByRole("button", { name: "Suivant", exact: true }),
    `« Suivant » reste désactivé alors que « ${marqueur} » est sélectionné. Le tunnel de vente ` +
      "refuse donc cette fiche comme point de départ : le type existe dans le formulaire de " +
      'création mais ne mène nulle part. `peutQuitterEtape1 = clientId !== ""` ' +
      "(VenteWizard.tsx:540, bouton :1306-1312). ⚠️ Le bouton est un vrai `<button disabled>` " +
      "(AdminButton.tsx:139-142) : `toBeEnabled` mesure bien l'attribut, pas une classe.",
  ).toBeEnabled({ timeout: 30_000 });
}

test.use(ENREGISTREMENT);

// 🔑 Pas de `mode: "serial"` : le describe ne porte QU'UN test, et le mot ferait
// croire à un enchaînement de tests dépendants qui n'existe pas. Si un second
// test s'ajoute un jour et dépend de l'état laissé par celui-ci, c'est ce
// jour-là qu'il faudra le remettre — avec la phrase qui dit pourquoi.
test.describe("@parcours-qualiopi 5 — entreprise et particulier, côte à côte", () => {
  test.describe.configure({ timeout: 420_000 });

  test("les deux types divergent à la saisie, en base, dans la liste et au tunnel de vente", async ({
    page,
  }, info) => {
    // Dispense DÉCLARATIVE, dont la condition est vérifiable et nommée : un
    // parcours métier ne mesure pas le moteur de rendu. En CI la question ne se
    // pose pas, seul chromium est installé (ci.yml:299) et lancé (ci.yml:519,
    // `pnpm test:e2e --project=chromium --grep-invert "@baseline"`).
    test.skip(
      info.project.name !== "chromium",
      `Parcours métier joué sur un seul moteur ; projet courant : ${info.project.name}.`,
    );
    await loginAsAdmin(page);

    // Marqueur horodaté : il doit être IMPRONONÇABLE par le reste de la base,
    // puisqu'il sert ensuite de filtre serveur.
    //
    // 🔑 « E2E-B2B- » / « E2E-B2C- » et non « E2E ENTREPRISE » / « E2E Particulier » :
    // avec l'ancien nommage, exiger « Particulier » dans la colonne Type d'une
    // ligne intitulée « E2E Particulier … » aurait été TAUTOLOGIQUE — le mot
    // cherché était dans le nom qu'on venait d'écrire soi-même.
    //
    // ⚠️ `filtreRecherche` (crm/clients.ts:51-71) interroge AUSSI `siret` et
    // `siren` en `startsWith` dès que le terme porte trois chiffres. Un
    // horodatage à treize chiffres ne peut pas préfixer un SIRET à quatorze
    // rempli : la recherche ne ramènera donc que nos deux raisons sociales.
    const marque = Date.now();
    const marqueurs: Record<TypeClient, string> = {
      entreprise: `E2E-B2B-${marque}`,
      particulier: `E2E-B2C-${marque}`,
    };

    // ── 1. Création à la souris, et lecture du libellé du champ principal ────
    const libelleEntreprise = await creerClient(page, "entreprise", marqueurs.entreprise);
    const libelleParticulier = await creerClient(page, "particulier", marqueurs.particulier);

    await info.attach("libelles-par-type.json", {
      body: JSON.stringify({ marque, libelleEntreprise, libelleParticulier }, null, 2),
      contentType: "application/json",
    });

    // 🔑 La divergence attendue : on ne demande pas une « raison sociale » à une
    // personne physique. Si les deux libellés sont identiques, l'écran traite un
    // particulier comme une entreprise — et cette confusion voyage jusqu'à la
    // convention et la facture.
    //
    // ⚠️ Cette première assertion est SUBSUMÉE par les deux suivantes (les deux
    // motifs sont disjoints, donc les satisfaire implique la différence). Elle
    // est gardée en TÊTE pour son message : c'est elle qui rougit d'abord le
    // jour où le composant cesse d'adapter quoi que ce soit, et c'est le bon
    // diagnostic à lire en premier. Les deux suivantes sont strictement plus
    // fortes — ce sont des cliquets sur la FORMULATION, qui rougiraient si
    // « Raison sociale » devenait « Dénomination » sans que personne le décide.
    expect(
      libelleParticulier,
      `le formulaire demande « ${libelleParticulier} » à un PARTICULIER — même libellé que ` +
        `pour une entreprise (« ${libelleEntreprise} »). ClientForm.tsx:146-148 rend ce ` +
        "libellé conditionnel à `isParticulier` ; s'il ne l'est plus, le formulaire réclame " +
        "une raison sociale à une personne physique.",
    ).not.toBe(libelleEntreprise);
    expect(
      libelleEntreprise,
      "le champ principal d'une ENTREPRISE ne s'appelle plus « Raison sociale » " +
        "(ClientForm.tsx:147)",
    ).toMatch(/^Raison sociale$/);
    expect(
      libelleParticulier,
      "le champ principal d'un PARTICULIER ne s'appelle plus « Nom complet (Prénom Nom) » " +
        "(ClientForm.tsx:147)",
    ).toMatch(/^Nom complet/);

    // ── 2. Le SERVEUR a-t-il écrit le type ? ────────────────────────────────
    //
    // 🔴 C'EST L'ASSERTION QUI PORTE TOUT LE FICHIER. `type` est `.optional()`
    // au schéma Zod (clients.ts:86) et la colonne a `@default(entreprise)`
    // (schema.prisma:5495). Si le formulaire cessait un jour d'envoyer le type,
    // les DEUX fiches naîtraient « entreprise » — et un parcours qui se
    // contentait de chercher son marqueur dans `body` restait vert.
    //
    // Le filtre `?q=` est SERVEUR (clients/page.tsx:65 → `listClients`,
    // crm/clients.ts:74-91, sans `take` quand aucune limite n'est passée) : on
    // lit donc exactement les deux fiches qu'on vient de créer, quelle que soit
    // la taille de la base.
    await page.goto(`${admin("qualiopi/clients")}?q=${marque}`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });

    // Contre-témoin du filtre lui-même : si `?q=` était ignoré, ce compteur
    // afficherait la table entière et l'assertion rougirait. Il décrit le
    // RÉSULTAT AFFICHÉ (clients/page.tsx:124-130).
    await expect(
      page.locator(CONTENU),
      `la recherche « ${marque} » n'annonce pas 2 résultats. Soit le filtre serveur ne ` +
        "s'applique pas (le compteur décrirait alors toute la table), soit l'une des deux " +
        "fiches n'a jamais été écrite malgré le retour sur la liste.",
    ).toContainText(new RegExp(`2\\s*résultats\\s*pour\\s*«\\s*${marque}\\s*»`), {
      timeout: 30_000,
    });

    const lignes = page.locator(`${CONTENU} tbody tr`);
    await expect(
      lignes,
      "le tableau des clients filtré ne porte pas exactement les deux lignes créées",
    ).toHaveCount(2, { timeout: 30_000 });

    const ids: Record<TypeClient, string> = { entreprise: "", particulier: "" };

    for (const type of ["entreprise", "particulier"] as const) {
      const marqueur = marqueurs[type];
      const ligne = lignes.filter({ hasText: marqueur });
      await expect(
        ligne,
        `« ${marqueur} » n'a pas exactement une ligne dans la liste filtrée — le formulaire ` +
          "est revenu sur la liste (donc `createClientAction` a rendu un succès), mais la " +
          "fiche ne s'y lit pas.",
      ).toHaveCount(1, { timeout: 30_000 });

      // Colonnes : 0 = Numéro (:179), 1 = Raison sociale (:185), 2 = Type (:214).
      await expect(
        ligne.locator("td").nth(2),
        `la fiche « ${marqueur} » est enregistrée avec le mauvais type. La colonne relit ` +
          "`Client.type` depuis la base (clients/page.tsx:214-216) : c'est la SEULE preuve " +
          "que le choix a survécu à l'action serveur. `type` est `.optional()` côté Zod " +
          "(clients.ts:86) et la colonne porte `@default(entreprise)` (schema.prisma:5495) — " +
          "un formulaire qui cesserait d'envoyer le type produirait deux entreprises sans " +
          "un mot.",
      ).toHaveText(TYPE_AFFICHE[type], { timeout: 30_000 });

      ids[type] = await idDuClient(ligne, marqueur);

      // ── 3. La divergence voyage jusqu'à l'édition de branche ──────────────
      //
      // Le formulaire d'édition est replié dans un `<details>`
      // (ClientBrancheForm.tsx:114-117). On l'OUVRE — geste d'un humain — avant
      // de mesurer : sans cela, « absent » et « simplement replié » seraient
      // indiscernables, et le zéro attendu pour le particulier ne prouverait
      // rien. (Le `<details>` est natif : il s'ouvre sans React, ce qui rend
      // cette mesure indépendante de l'hydratation.)
      await ligne.locator("summary").click();

      const opco = page.locator(`#opco-${ids[type]}`);
      const taille = page.locator(`#taille-${ids[type]}`);

      // Témoin positif, sur les DEUX types : le formulaire est bien déplié et
      // les identifiants composés `<champ>-<uuid>` sont les bons. Sans lui,
      // le `toHaveCount(0)` ci-dessous serait vert sur un sélecteur cassé.
      await expect(
        taille,
        `l'édition de branche de « ${marqueur} » ne montre pas son champ « Taille » ` +
          `(#taille-${ids[type]}, ClientBrancheForm.tsx:138-142). Le <details> ne s'est pas ` +
          "ouvert, ou le format des identifiants a changé — auquel cas la mesure de l'OPCO " +
          "juste en dessous ne vaudrait plus rien.",
      ).toBeVisible({ timeout: 30_000 });

      if (type === "particulier") {
        await expect(
          opco,
          `l'édition de branche propose un OPCO à « ${marqueur} », qui est un PARTICULIER. ` +
            "Un particulier relève d'un contrat de formation professionnelle " +
            "(C. trav. L6353-3) et n'a PAS d'opérateur de compétences : le champ est censé " +
            "être masqué (`{!estParticulier && …}`, ClientBrancheForm.tsx:163-182, alimenté " +
            "par clients/page.tsx:279). L'afficher inviterait à saisir un financeur " +
            "inexistant, qui remonterait ensuite sur la convention et le dossier de " +
            "financement. ⚠️ Le bouton « Enregistrer » (:184-186) est HORS de ce bloc : il " +
            "ne disparaît pas pour un particulier, et ne doit pas.",
        ).toHaveCount(0, { timeout: 30_000 });
      } else {
        await expect(
          opco,
          `l'édition de branche n'offre plus de secours manuel d'OPCO à « ${marqueur} », ` +
            "qui est une ENTREPRISE (ClientBrancheForm.tsx:157-182). C'est le contre-témoin " +
            "de l'assertion posée sur le particulier : sans lui, un `#opco-…` devenu " +
            "introuvable pour TOUT LE MONDE passerait pour une divergence B2B/B2C.",
        ).toBeVisible({ timeout: 30_000 });
      }

      // On referme : la ligne suivante se lit sur une liste au même état que
      // celle qu'on a trouvée.
      await ligne.locator("summary").click();
    }

    await info.attach("clients-crees.json", {
      body: JSON.stringify({ marque, marqueurs, ids }, null, 2),
      contentType: "application/json",
    });

    // ── 4. Le type Particulier mène-t-il quelque part ? ─────────────────────
    //
    // Joué sur les DEUX fiches, côte à côte : c'est la seule façon de dire si
    // une éventuelle impasse est propre au B2C ou commune aux deux. Le B2B
    // passe en premier — s'il échoue aussi, la cause n'est pas le type.
    await leTunnelDeVenteAccepte(page, ids.entreprise, marqueurs.entreprise);
    await leTunnelDeVenteAccepte(page, ids.particulier, marqueurs.particulier);
  });
});
