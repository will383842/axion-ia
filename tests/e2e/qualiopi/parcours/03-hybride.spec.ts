/**
 * PARCOURS 3 — Journée HYBRIDE : la salle ET la visioconférence, le même jour.
 *
 * Phase 6 de `_AUDIT/PROMPT-AUDIT-QUALIOPI-E2E-50-AGENTS-2026-08-18.md`.
 *
 * ## Ce que « hybride » veut dire, et pourquoi rien d'autre ne le prouve
 *
 * L'hybride est le cas qui casse les raisonnements binaires : la preuve de
 * présence n'est ni « la feuille signée » ni « le relevé de connexion », mais
 * les DEUX, sur la MÊME journée. Or les deux chemins écrivent dans la même
 * table (`presence_creneaux`), sur la même clé
 * `[enrollmentId, date, demiJournee]` : ils se marchent dessus par construction.
 *
 * 🔴 CE QUE L'ANCIENNE VERSION DE CE FICHIER NE PROUVAIT PAS. Elle faisait deux
 * `count() === 0` sur des nœuds présents AUSSI ailleurs :
 *
 *   · `GenererCreneauxButton` est rendu HORS CONDITION (emargement/page.tsx:203) —
 *     il s'affiche à l'identique sur une session distancielle ;
 *   · `#import-file` est gardé par `isDistanciel = distanciel || hybride`
 *     (emargement/page.tsx:126 puis :262) — il distingue donc bien HYBRIDE de
 *     PRÉSENTIEL, mais pas hybride de distanciel.
 *
 * ⚠️ Ne pas écrire ici la formulation forte « zéro pouvoir discriminant » : elle
 * sur-déclare. Le trou exact est plus étroit : l'ancienne version ne distinguait
 * pas hybride de DISTANCIEL, et surtout elle mesurait un DOM sur une session
 * SANS AUCUN INSCRIT — donc sans grille signable (le `<h2>` est rendu, mais la
 * grille est remplacée par « Aucun stagiaire inscrit à cette session »,
 * emargement/page.tsx:245-248) et sur une génération de créneaux qui bouclait
 * sur zéro enrollment.
 *
 * 🔑 MÉMOIRE CONSERVÉE, ET CORRIGÉE PAR LA MESURE. L'ancienne version acceptait
 * `/Mixte|Hybride/i` en expliquant que « hybride s'affiche « Mixte » ou
 * « Hybride » selon l'écran ». Mesuré le 2026-08-23 : dans la CONSOLE la valeur
 * est toujours « Hybride » (`MODALITE_LABELS`, deux déclarations, sessions/[id]/
 * page.tsx:97-101 et server/formateur/collectif-labels.ts:29-33) ; « Mixte »
 * n'existe que dans les PDF (src/server/actions/qualiopi/documents.ts:170-176,
 * le `return "Mixte"` en :175). L'alternative était donc
 * juste sur le dépôt, fausse sur CET écran — et une alternative acceptée sans
 * l'avoir mesurée est une assertion qui ne peut plus rougir.
 *
 * ## Ce que ce fichier prouve désormais
 *
 * La seule assertion qu'AUCUN autre parcours ne peut porter : la protection
 * **M1** de `importReleveConnexionAction` (presence.ts:848-882). Une demi-journée
 * émargée EN SALLE, puis un relevé de connexion importé sur la MÊME journée :
 * la signature présentielle doit survivre à l'import distanciel.
 *
 *     const protegePresentiel =
 *       existantDemi !== null &&
 *       existantDemi.importId === null &&
 *       (existantDemi._count.emargementSignatures > 0 || existantDemi.present);
 *
 * Sans elle, l'`upsertCreneau` de l'import (presence.ts:884-899) réécrit
 * `dureeRealiseeMinutes` avec la part distancielle du jour, puis
 * `recomputeTauxPresence` (presence-service.ts:141-145) rebascule `present` —
 * une preuve d'émargement présentiel détruite en silence.
 *
 * ## ⚠️ CE HARNAIS EST DÉSORMAIS UNE GATE BLOQUANTE (mesuré le 2026-08-23)
 *
 * 🔴 Les brouillons de ce fichier — et plusieurs enquêtes avant eux — écrivaient
 * « aucun rouge d'ici ne fera rougir une PR, le step porte `continue-on-error:
 * true` ». C'ÉTAIT VRAI, ÇA NE L'EST PLUS : `ci.yml:479` porte, en toutes
 * lettres, « ✅ 2026-08-23 — `continue-on-error` RETIRÉ. CE GATE PEUT ENFIN
 * ROUGIR », et le step `run: pnpm test:e2e --project=chromium --grep-invert
 * "@baseline"` (ci.yml:519) n'a plus de `continue-on-error`. Le commentaire
 * ci.yml:495-499 précise que `Gate B · per-PR` est un contexte EXIGÉ par la
 * protection de `main`, avec `strict: true`.
 *
 * 🔑 Conséquence directe sur la façon d'écrire ici : un faux rouge de ce fichier
 * ne coûte plus « un diagnostic ignoré », il bloque 100 % des PR du dépôt. Toute
 * attente est donc bornée ET nommée, et tout geste qui dépend de l'hydratation
 * est RÉESSAYÉ plutôt que constaté trente secondes plus tard.
 *
 * ## ⚠️ DÉPENDANCE AU SOCLE — état mesuré, pas supposé
 *
 * `grep -n "^export" tests/e2e/qualiopi/parcours/_communs.ts`, 2026-08-23 :
 * `Modalite`, `ENREGISTREMENT`, `admin`, `horodatage`, `champEtiquete`,
 * `creerSession`, `ouvrirSessionDemo`. SEPT exports, pas onze. `CONTENU`,
 * `STAGIAIRES_DEMO`, `inscrire` et `horodatageZoom` N'Y SONT PAS.
 *
 * Ce fichier n'importe donc QUE ce qui existe, et définit le reste localement.
 * Ce n'est pas un choix de confort : un import vers un symbole absent est un
 * TS2305 au CHARGEMENT de la suite — les 237 tests de Gate B tombent avec lui,
 * et le gate est maintenant bloquant.
 *
 * 🔑 Ce que ces définitions locales doivent devenir : `horodatageZoom` et
 * `inscrire` seront réclamés à l'identique par le parcours 02 (distanciel). DEUX
 * COPIES DIVERGERONT — le dépôt l'a payé quatre fois. Dès que `_communs.ts`
 * porte ces exports, remonter les trois blocs marqués « SOCLE ABSENT » tels
 * quels et les remplacer par un import. Tant que le socle ne les porte pas, les
 * recopier ici est le moindre mal ; les importer serait une panne certaine.
 *
 * ## Comment le jouer
 *
 *     pnpm qualiopi:seed-demo
 *     npx playwright test tests/e2e/qualiopi/parcours/03-hybride.spec.ts \
 *       --project=chromium --workers=1
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { loginAsAdmin } from "../../fixtures/admin-auth";
import {
  ENREGISTREMENT,
  STAGIAIRES_DEMO,
  admin,
  creerSession,
  horodatage,
  horodatageZoom,
  inscrire,
} from "./_communs";

/**
 * Décalage du premier jour de la session. Négatif : une session PASSÉE, seul
 * état où l'on émarge et où l'on importe un relevé.
 *
 * 🔑 Ce même décalage sert à TROIS choses qui doivent tomber sur le même jour
 * civil : la date de début de la session, la colonne visée dans la grille, et
 * l'horodatage du relevé Zoom. `horodatageZoom` DÉRIVE son jour de `horodatage`
 * (_communs.ts) au lieu de le recalculer. ⚠️ Ce ne sont pas « un seul et même
 * appel » : il y en a TROIS — `JOUR_UN` ci-dessous, chaque ligne du relevé via
 * `horodatageZoom`, et `creerSession` pour la date de début. Trois appels au
 * MÊME helper déterministe, donc trois résultats identiques, sauf si l'exécution
 * enjambe minuit UTC — auquel cas `indexColonneMatin` rougit avec son message
 * nommé, jamais un faux vert. Deux calculs de jour PARALLÈLES, eux,
 * divergeraient d'un fuseau et rendraient ce parcours muet SANS le faire rougir :
 * `parisDateISO(joinAt)` ne tomberait pas sur un jour du plan et
 * `presence.ts:755` reporterait le créneau sur le premier jour.
 *
 * ⚠️ `dureeJours` reste à 1 (défaut de `creerSession`) : sur une session d'un
 * seul jour, `creneauxParJour` n'a qu'une clé — qui est aussi `premierJourPlan`
 * (presence.ts:718). Les deux branches du ternaire de :755 rendent donc la même
 * valeur, et ce parcours ne PROUVE rien du rapprochement par date : il le rend
 * seulement cohérent. Éprouver ce rapprochement demande une session de deux
 * jours et une assertion sur la COLONNE d'atterrissage — un parcours à part.
 */
const DEBUT_DANS_JOURS = -7;

/** Jour civil `YYYY-MM-DD` de la première journée de la session. */
const JOUR_UN = horodatage(DEBUT_DANS_JOURS).slice(0, 10);

// ─────────────────────────────────────────────────────────────────────────────
// SOCLE ABSENT (1/3) — les deux stagiaires du dossier de démonstration
// ─────────────────────────────────────────────────────────────────────────────
/**
 * 🔴 À REMONTER dans `_communs.ts` sous le nom `STAGIAIRES_DEMO` dès que le
 * socle l'accepte. Valeurs relevées dans le seed, jamais devinées :
 * `prisma/seeds/qualiopi/demo.ts:350-351` (adresses) et `:578-594` (identités —
 * Marie :579-580, Thomas :587-588).
 * `prisma/scripts/purge-demo-qualiopi.ts:50` porte les mêmes adresses — c'est
 * elles que la purge reconnaît.
 *
 * On garde `prenom`/`nom` séparés : le relevé Zoom écrit « Prénom Nom » dans sa
 * colonne de nom, et `matchParticipants` normalise les deux ordres
 * (match.ts:41-44) — mais ce n'est qu'un REPLI. Le rapprochement se fait d'abord
 * par ADRESSE (match.ts:52-55) : ce sont les adresses qui portent la preuve.
 */
const MARIE = {
  prenom: "Marie",
  nom: "Martin",
  email: "marie.martin@demo.axion-ia.invalid",
} as const;
const THOMAS = {
  prenom: "Thomas",
  nom: "Dubois",
  email: "thomas.dubois@demo.axion-ia.invalid",
} as const;

/**
 * 🔴 CETTE VÉRIFICATION EXISTE PARCE QUE `MARIE`/`THOMAS` SONT UNE SECONDE
 * ÉCRITURE DE `STAGIAIRES_DEMO`.
 *
 * Le socle porte le nom AFFICHÉ d'un seul tenant (« Marie Martin ») ; ce
 * parcours a besoin du prénom et du nom SÉPARÉS, parce que le relevé Zoom écrit
 * « Prénom Nom » dans sa colonne de nom. Les deux formes sont donc légitimes —
 * mais « un prédicat recopié diverge toujours », et une divergence d'adresse
 * rendrait ce parcours muet SANS le faire rougir : `matchParticipants` ne
 * rapprocherait personne, et l'écran afficherait l'aveu d'échec qu'un test mal
 * écrit lit comme un succès.
 *
 * 🔑 Le remède n'est pas une prière en commentaire — « garder identique à X » est
 * l'aveu qu'on sait que ça va casser. C'est une garde qui ROUGIT, ici, au
 * chargement du module, avant qu'un seul navigateur ne s'ouvre.
 */
for (const [local, socle] of [
  [MARIE, STAGIAIRES_DEMO[0]],
  [THOMAS, STAGIAIRES_DEMO[1]],
] as const) {
  expect(
    local.email,
    `l'adresse « ${local.email} » de ce fichier a divergé de STAGIAIRES_DEMO ` +
      `(« ${socle.email} », _communs.ts). Le rapprochement se fait par ADRESSE ` +
      "(match.ts:52-55) : une divergence ici ne ferait PAS rougir le parcours, elle le " +
      "rendrait muet — zéro appariement, et les deux noms lus sous « Participants non " +
      "rapprochés », c'est-à-dire l'écran de l'échec certifié comme un succès.",
  ).toBe(socle.email);
  expect(
    `${local.prenom} ${local.nom}`,
    `le nom affiché « ${local.prenom} ${local.nom}` +
      `» a divergé de STAGIAIRES_DEMO (« ${socle.nom} », _communs.ts)`,
  ).toBe(socle.nom);
}

/**
 * Minutes de connexion de Marie — **délibérément petites**.
 *
 * Marie est EN SALLE le matin (elle signe), et se connecte 14 h → 15 h l'après-
 * midi. C'est le scénario hybride au sens propre, et c'est aussi ce qui donne à
 * l'assertion M1 son pouvoir de rougir : sans la protection, l'import écrirait
 * sur SA matinée une part distancielle trop faible pour rester cochée, et
 * `recomputeTauxPresence` décocherait la case.
 *
 * 🔴 CE QUE LA MÉCANIQUE FAIT VRAIMENT ICI — trois brouillons ont décrit un
 * chemin de code que ce parcours n'emprunte pas. Ce parcours ne déclare AUCUNE
 * journée (il ne touche jamais `SessionJoursEditor`). `genererCreneaux` passe
 * donc par son REPLI (creneaux.ts:143-157), où `jour === null` : aucun créneau
 * ne porte de `jourHeureDebut` (creneaux.ts:187). Dans l'import,
 * `horairesConnus` (presence.ts:777) vaut donc FAUX, `joinMin`/`leaveMin` sont
 * `null`, et `repartirMinutesConnexion` répartit au PRORATA DES DURÉES PRÉVUES
 * (repartition-distanciel.ts:109-117) — `fenetreDemiJournee` n'est JAMAIS
 * consultée. Part réelle du matin de Marie sans M1 : 60 × 210/420 = 30 minutes,
 * pas 0. Sous le seuil de 105 (= 0,5 × 210), donc la garde rougit bien — mais
 * par le prorata, pas par la fenêtre horaire. Raisonner sur la fenêtre ici
 * enverrait le prochain lecteur au mauvais endroit.
 */
const MINUTES_MARIE = 60;

/**
 * Minutes de connexion de Thomas — presque la journée entière, à distance.
 *
 * C'est le CONTRE-TÉMOIN de l'assertion M1 : sa demi-journée du matin n'est ni
 * signée ni cochée, donc RIEN ne la protège. Si l'import écrit vraiment sur ce
 * jour, sa case doit passer de décochée à cochée. Deux matinées, même jour, même
 * import : l'une protégée, l'autre non. La différence entre les deux EST la
 * protection — sans ce témoin, « la case de Marie est restée cochée » serait
 * indiscernable d'« un import qui n'a rien écrit du tout ».
 *
 * 🔑 300 ET NON 480 : sa plage 09:00 → 17:00 fait 480 minutes d'amplitude. Les
 * faire coïncider rendrait la colonne « Duration (Minutes) » REDONDANTE — un
 * import qui calculerait `leaveAt − joinAt` au lieu de lire la colonne
 * (parse-zoom.ts:62 puis :82) produirait exactement le même résultat, et la
 * fixture ne discriminerait pas ce qu'elle prétend discriminer. Zoom déduit les
 * déconnexions : 480 d'amplitude, 300 réellement connectées.
 *
 * Vérifié : part du matin = 300 × 210/420 = 150 minutes, au-dessus du seuil de
 * 105 — sa case se coche. Et chaque part reste plafonnée à la durée PRÉVUE de sa
 * demi-journée (repartition-distanciel.ts:144).
 */
const MINUTES_THOMAS = 300;

/**
 * Le relevé Zoom, au format EXACT que `parse-zoom.ts` attend.
 *
 * Colonnes relevées dans `parse-zoom.ts:21-26`, jamais devinées.
 */
const RELEVE_ZOOM = [
  '"Name (Original Name)","User Email","Join Time","Leave Time","Duration (Minutes)"',
  `"${MARIE.prenom} ${MARIE.nom}","${MARIE.email}",` +
    `"${horodatageZoom(DEBUT_DANS_JOURS, "14:00:00")}",` +
    `"${horodatageZoom(DEBUT_DANS_JOURS, "15:00:00")}","${MINUTES_MARIE}"`,
  `"${THOMAS.prenom} ${THOMAS.nom}","${THOMAS.email}",` +
    `"${horodatageZoom(DEBUT_DANS_JOURS, "09:00:00")}",` +
    `"${horodatageZoom(DEBUT_DANS_JOURS, "17:00:00")}","${MINUTES_THOMAS}"`,
].join("\n");

/**
 * LA grille d'émargement, et elle seule.
 *
 * 🔴 `tbody tr` nu matcherait AUSSI le « Récapitulatif des taux de présence »
 * (emargement/page.tsx:278-296), qui porte les MÊMES noms et les MÊMES adresses.
 * Deux tableaux, une seule cible : on discrimine sur ce que seule la grille
 * possède — un `<div title="YYYY-MM-DD">` dans ses en-têtes de colonne
 * (EmargementGrid.tsx:329), là où le récapitulatif n'a que du texte nu
 * (emargement/page.tsx:285-296).
 *
 * Vérifié le 2026-08-23 : la page d'émargement ne porte aucun autre `<table>`
 * (ni `SessionJoursEditor`, ni `LiensEmargement`, ni `DossierSessionButton`).
 */
const GRILLE = "table:has(thead th div[title])";

/**
 * L'en-tête de page — le SEUL endroit de cet écran où la modalité RÉELLE est
 * écrite avec ses séparateurs.
 *
 * `AdminPageHeader` pose `class="admin-page-header"` sur un `<header>`
 * (AdminPageHeader.tsx:32-38) et y rend `description` dans un `<p>` (:74-85).
 * Vérifié : cette classe n'a qu'UNE occurrence dans `src/` (le composant
 * lui-même), le layout admin n'en rend aucun, et cette page n'en instancie qu'un
 * (emargement/page.tsx:138-141). Viser cet en-tête plutôt que `.admin-main`
 * évite de recopier ici un repère qui appartient au socle.
 */
const EN_TETE = "header.admin-page-header";

test.use(ENREGISTREMENT);

test.describe("@parcours-qualiopi 3 — hybride, la salle et la visio le même jour", () => {
  /**
   * 🔴 BUDGET EN LITTÉRAL, JAMAIS EN TERNAIRE — mesuré sur les cliquets, pas
   * supposé.
   *
   * Un premier jet proposait un ternaire sur `process.env["CI"]`, avec deux
   * paliers (six minutes en intégration continue, dix minutes hors CI). Écrit
   * ainsi, `budgetDeclare` (`/describe\.configure\(\{[^}]*timeout:\s*([0-9_]+)/`)
   * ne matche PAS — après `timeout:` vient `process`, pas un chiffre. Deux
   * cliquets tomberaient alors ensemble :
   *
   *   · `tests/unit/e2e-harness/budget-des-specs-admin.spec.ts:64-73` — « chacune
   *     déclare un budget » rougit, cette suite appelant `loginAsAdmin` ;
   *   · `tests/unit/e2e-harness/delai-interne-sous-le-budget.spec.ts:107-134` —
   *     faute de budget lu, il retombe sur le défaut de `playwright.config.ts:7`
   *     (30 s) et déclare la suite en faute contre ses propres délais internes.
   *
   * ⚠️ ET LE COMMENTAIRE LUI-MÊME EST LU. `delaiMaximal`
   * (delai-interne-sous-le-budget.spec.ts:74-87) ne retire PAS les commentaires —
   * contrairement au test `networkidle` de la même suite, qui le fait
   * explicitement (:148-154) après s'être trouvé lui-même. Sa seconde boucle
   * cherche toute paire de nombres séparée par `?` et `:` : recopier ici le
   * ternaire AVEC SES CHIFFRES ferait compter dix minutes comme un « délai
   * interne », égal au budget, et le cliquet rougirait sur sa propre
   * documentation. Les paliers s'écrivent donc en toutes lettres.
   *
   * 🔑 Un budget qu'un outil ne sait pas lire n'est pas un budget. Dix minutes
   * couvrent les deux environnements et restent STRICTEMENT supérieures au plus
   * long délai qui vit ici, helpers importés compris : trois minutes
   * (`loginAsAdmin` hors CI, admin-auth.ts:141, et l'attente d'arrivée de
   * `creerSession`, _communs.ts:152-154). Le plus long délai propre à ce fichier
   * est de deux minutes.
   *
   * ⚠️ Pas de `mode: "serial"` : le describe ne porte qu'UN test, et le mot
   * ferait croire à un enchaînement de tests dépendants qui n'existe pas.
   */
  test.describe.configure({ timeout: 600_000 });

  test("une signature en salle survit à l'import du relevé de la même journée", async ({
    page,
  }, info) => {
    // Restriction délibérée, pas une dispense : le parcours mesure une règle
    // MÉTIER, identique dans les cinq moteurs déclarés (playwright.config.ts:42-48).
    // En CI la question ne se pose même pas — `ci.yml:519` ne lance que
    // `--project=chromium` et `:299` n'installe que lui. Ces sauts n'existent
    // donc qu'en exécution locale « tous projets ».
    test.skip(info.project.name !== "chromium", "Règle métier : un moteur suffit.");

    await loginAsAdmin(page);

    // ── 1. Une session HYBRIDE, et deux inscrits ────────────────────────────
    //
    // 🔴 SANS INSCRIT, CET ÉCRAN NE PROUVE RIEN — et il le prouve en vert. La
    // grille n'est même pas dans le DOM (emargement/page.tsx:245-249),
    // `generateSessionCreneauxAction` boucle sur zéro enrollment
    // (presence.ts:256), et l'import lit `enrollments = []` puis réussit avec
    // `nbMatched: 0`. C'est la chaîne exacte qui rendait le parcours distanciel
    // vert sur zéro appariement.
    //
    // `participants: 2` ne crée AUCUNE inscription — c'est « Nb participants
    // PRÉVUS », un nombre déclaratif. D'où `inscrire()`.
    const titre = `E2E HYBRIDE ${Date.now()}`;
    const id = await creerSession(page, {
      modalite: "hybride",
      titre,
      debutDansJours: DEBUT_DANS_JOURS,
      participants: 2,
      montantHt: 3200,
    });

    await inscrire(page, MARIE.email);
    await inscrire(page, THOMAS.email);

    // ── 2. On CLIQUE vers l'émargement, on ne compose pas l'URL ─────────────
    //
    // Un parcours joue ce qu'un humain fait. Le lien est scopé à `#sous-pages`
    // (sessions/[id]/page.tsx:814-818) : « Émargement » n'existe nulle part dans
    // le rail admin (vérifié — 0 occurrence dans `src/lib/admin-nav.ts`), mais
    // scoper coûte une ligne et referme la question pour de bon.
    //
    // 🔑 On attend un CONTENU avant de cliquer. La fiche de session est rendue
    // en flux : cliquer trop tôt meurt sur l'`actionTimeout` de 15 s
    // (playwright.config.ts:36) avec un message qui ne nomme pas le streaming.
    const urlEmargement = admin(`qualiopi/sessions/${id}/emargement`);
    const lienEmargement = page.locator("#sous-pages").getByRole("link", { name: "Émargement" });
    await expect(
      lienEmargement,
      "la section « Sous-pages » de la fiche de session n'a jamais affiché son lien " +
        "« Émargement » (sessions/[id]/page.tsx:814-818) — la fiche est restée en cours " +
        `de rendu. URL : ${urlEmargement}`,
    ).toBeVisible({ timeout: 120_000 });
    await lienEmargement.click({ timeout: 90_000 }); // cf. `ARRIVEE_ECRAN` (_communs.ts) : le clic paie l'attente de SA navigation.
    await page.waitForURL(new RegExp(`/sessions/${id}/emargement$`), {
      waitUntil: "domcontentloaded", // défaut = `"load"` ; cf. la note de `creerSession` dans `_communs.ts`.
      timeout: 90_000,
    });

    // ── 3. L'écran dit-il HYBRIDE ? ─────────────────────────────────────────
    //
    // 🔑 Le sous-titre d'`AdminPageHeader` (emargement/page.tsx:140) est le SEUL
    // endroit de cette page où la modalité RÉELLE est écrite :
    // `Session AXI-… · Hybride · 10/08/2026 → 10/08/2026`. Le bloc « Modalité »
    // du bandeau l'écrit aussi (:153-160), mais sans séparateurs — et de toute
    // façon le locator est scopé à l'en-tête, donc le bandeau ne peut pas
    // satisfaire l'assertion à sa place.
    //
    // ⚠️ On NE remet PAS l'assertion négative `not.toContainText(/·(Présentiel|Distanciel)·/)`
    // d'un brouillon précédent : une négation est satisfaite par un DOM vide, et
    // l'écran ne porte qu'un seul en-tête — une fois la positive verte, elle ne
    // peut plus jamais échouer. Zéro signal indépendant.
    await expect(
      page.locator(EN_TETE),
      "l'en-tête de l'écran d'émargement n'annonce pas une session hybride — " +
        "c'est le seul endroit de la page où la modalité RÉELLE est écrite " +
        "(emargement/page.tsx:140, libellé « Hybride » de MODALITE_LABELS)",
    ).toContainText(/·\s*Hybride\s*·/, { timeout: 90_000 });

    // ── 4. La preuve DISTANCIELLE est offerte ───────────────────────────────
    //
    // `#import-file` est gardé par `isDistanciel = distanciel || hybride`
    // (emargement/page.tsx:126 puis :262). C'est ce qui distingue cet écran de
    // celui d'une session PRÉSENTIELLE — et rien d'autre sur cette page ne le
    // fait : le `<h2>` « Feuille d'émargement présentiel » (:244) est rendu
    // INCONDITIONNELLEMENT, donc l'exiger ne garderait rien.
    //
    // `toBeAttached` et non un `count()` : un nombre déjà résolu ne se réessaie
    // pas, et la page est rendue en flux.
    await expect(
      page.locator("#import-file"),
      "l'écran d'émargement d'une session HYBRIDE n'offre pas l'import de relevé — " +
        "la moitié DISTANCIELLE de la session n'a alors aucun moyen de preuve " +
        "(garde `isDistanciel`, emargement/page.tsx:126 + 262)",
    ).toBeAttached({ timeout: 90_000 });

    // ── 5. La preuve PRÉSENTIELLE : générer les créneaux, puis la grille ────
    //
    // Le bouton porte « Générer les créneaux », ou « Régénérer les créneaux »
    // quand des créneaux existent déjà (GenererCreneauxButton.tsx:71-75). On
    // ancre les deux formes : un motif non ancré matcherait aussi
    // « Génération… », l'état transitoire (:72).
    const boutonCreneaux = page.getByRole("button", {
      name: /^(Générer|Régénérer) les créneaux$/,
    });
    await expect(
      boutonCreneaux,
      "le bouton de génération des créneaux n'est pas apparu (emargement/page.tsx:203) — " +
        "l'écran est resté en cours de rendu",
    ).toBeVisible({ timeout: 90_000 });
    await boutonCreneaux.click({ timeout: 30_000 });

    const grille = page.locator(GRILLE);
    await expect(
      grille,
      "la grille d'émargement n'est pas apparue après la génération des créneaux. " +
        "Trois causes à distinguer : soit la session n'a aucun inscrit (l'écran affiche " +
        "alors « Aucun stagiaire inscrit à cette session », emargement/page.tsx:245-248), " +
        "soit `generateSessionCreneauxAction` a refusé et l'a écrit dans le " +
        '`[role="alert"]` du bouton (GenererCreneauxButton.tsx:83-90 — typiquement le ' +
        "garde-fou D14, presence.ts:204-217), soit la génération n'a produit aucun créneau " +
        "et la grille affiche son repli (EmargementGrid.tsx:290-309)",
    ).toBeVisible({ timeout: 120_000 });

    // ── 6. Repérer la demi-journée du MATIN du PREMIER jour ─────────────────
    const indexMatin = await indexColonneMatin(grille, JOUR_UN);
    const matinDe = (email: string): Locator => cellule(grille, email, indexMatin);

    const caseMatinMarie = matinDe(MARIE.email).locator('input[type="checkbox"]');
    const caseMatinThomas = matinDe(THOMAS.email).locator('input[type="checkbox"]');

    // État de départ — c'est le contre-témoin de tout ce qui suit : un créneau
    // fraîchement généré porte `present: false` (presence.ts:280) et
    // `dureeRealiseeMinutes: 0` (:281). Si ces cases étaient DÉJÀ cochées,
    // « elles sont cochées à la fin » ne prouverait rien.
    await expect(
      caseMatinMarie,
      `la case « matin » de ${MARIE.email} est déjà cochée avant tout émargement — ` +
        "un créneau fraîchement généré vaut `present: false` (presence.ts:280) ; " +
        "cette session n'est donc pas neuve, et les assertions de fin ne prouveraient rien",
    ).not.toBeChecked({ timeout: 30_000 });
    await expect(
      caseMatinThomas,
      `la case « matin » de ${THOMAS.email} est déjà cochée avant tout import — le ` +
        "contre-témoin de l'étape 11(a) serait alors vrai d'avance et ne prouverait plus " +
        "que l'import a écrit sur cette journée",
    ).not.toBeChecked({ timeout: 30_000 });

    // ── 7. Marie signe SA MATINÉE en salle ──────────────────────────────────
    await caseMatinMarie.check({ timeout: 30_000 });

    // 🔑 LE CHAMP MINUTES EST LE TÉMOIN D'HYDRATATION, et il n'y en a pas
    // d'autre ici. Il n'est rendu QUE si `cell.present` est vrai
    // (EmargementGrid.tsx:379-392), c'est-à-dire seulement si React a reçu le
    // `change`. Cocher avant l'hydratation coche le nœud DOM et ne change RIEN à
    // l'état — le geste réussit, l'écran ment, et la sauvegarde part vide. C'est
    // la famille de défauts déjà payée par ce dépôt (« form_input n'écrit pas
    // l'état React »).
    const minutesMatinMarie = matinDe(MARIE.email).locator('input[type="number"]');
    await expect(
      minutesMatinMarie,
      "le champ « minutes » n'est pas apparu après avoir coché la présence de " +
        `${MARIE.email}. Il n'est rendu que si l'état React a basculé ` +
        "(EmargementGrid.tsx:379) : la page n'est donc pas hydratée, et la case " +
        "cochée n'est qu'un nœud DOM que la sauvegarde ignorera",
    ).toBeVisible({ timeout: 30_000 });

    // La valeur affichée EST la durée prévue du créneau : `togglePresent` la
    // recopie quand la durée réalisée vaut zéro (EmargementGrid.tsx:202-206,
    // correctif du 2026-08-22). C'est notre seule lecture honnête du prévu.
    const prevuMatin = Number(await minutesMatinMarie.inputValue());

    // 🔴 PRÉCONDITION ARITHMÉTIQUE — sans elle, l'assertion M1 de l'étape 11
    // serait VRAIE quoi qu'il arrive, donc vide.
    //
    // `recomputeTauxPresence` recalcule `present = réalisé >= 0,5 × prévu`
    // (presence-service.ts:143-144). Pour que la disparition de M1 se VOIE, il
    // faut que la part distancielle du matin de Marie tombe SOUS ce seuil. Deux
    // régimes possibles, et le seuil ci-dessous couvre les DEUX :
    //
    //   · deux demi-journées (le cas nominal) → part = 60 × prévu/(2 × prévu)
    //     = 30 min, à comparer à 0,5 × prévu — il suffit que prévu > 60 ;
    //
    // ⚠️ Un second régime — une seule demi-journée, `repartirMinutesConnexion`
    // rendant `min(60, prévu)` (repartition-distanciel.ts:98-100) — est
    // INATTEIGNABLE ici : `demiJourneesDe` n'est appelée que sur des journées
    // DÉCLARÉES, et le repli empile toujours matin + après-midi
    // (creneaux.ts:154-155), ce que ce fichier établit lui-même plus haut. Le
    // seuil retenu est donc plus strict que nécessaire, par prudence — et non
    // parce qu'il faudrait couvrir un chemin qui n'existe pas. Documenter un
    // chemin mort comme atteignable envoie le prochain lecteur nulle part.
    //
    // On EXIGE la marge, et on la NOMME plutôt que de la supposer : c'est une
    // grandeur continue, « ça ne dépasse pas » ne garde rien.
    expect(
      prevuMatin,
      `la demi-journée du matin ne prévoit que ${prevuMatin} minutes. Ce parcours a ` +
        `besoin de plus de ${2 * MINUTES_MARIE} minutes prévues pour que la protection M1 ` +
        "soit OBSERVABLE : en dessous, les 60 minutes de connexion de Marie suffiraient " +
        "à elles seules à garder sa case cochée, et l'assertion finale serait vraie même " +
        "si la protection disparaissait. Cause à chercher LÀ, pas ailleurs : une session " +
        "neuve a `dureeReelleHeures` à NULL — son seul écrivain est la CLÔTURE " +
        "(sessions.ts:831-832 puis :852, sous `toStatus === 'realisee'`) — donc " +
        "`generateSessionCreneauxAction` ne passe aucun `dureeTotaleHeures` " +
        "(presence.ts:231-233), `repartirDurees` retombe sur le défaut de 7 h " +
        "(`HEURES_PAR_JOUR_DEFAUT`, creneaux.ts:24) et rend 210 minutes par demi-journée " +
        "(creneaux.ts:276-282). Si ce nombre a changé, c'est ce défaut qui a bougé, ou une " +
        "journée a été déclarée pour cette session. La formation choisie par `creerSession` " +
        "n'y entre à aucun moment.",
    ).toBeGreaterThan(2 * MINUTES_MARIE);

    const formulaireGrille = page.locator("form").filter({ has: page.locator(GRILLE) });
    await enregistrerLaGrille(page, formulaireGrille);

    // ── 8. RATCHET — cocher une présence et enregistrer l'enregistre bien ───
    //
    // 🔴 2026-08-22, DÉFAUT « E » DE L'ENQUÊTE — corrigé DEUX FOIS depuis, et
    // c'est ce que ce rechargement verrouille.
    //
    // La chaîne d'origine : créneau créé à `dureeRealiseeMinutes: 0`
    // (presence.ts:281) → le champ minutes s'initialisait sur cette valeur →
    // `handleSubmit` envoie TOUJOURS la durée (EmargementGrid.tsx:267), donc `0`,
    // jamais `undefined` → le repli serveur « présent sans durée ⇒ durée prévue »
    // était INATTEIGNABLE → `recomputeTauxPresence` réécrivait `present = false`
    // DANS LA MÊME REQUÊTE. L'écran affichait « 1 ligne mise à jour », l'admin
    // rechargeait, la case était décochée.
    //
    // ⚠️ Nuance à ne pas perdre : le défaut n'était pas invisible. Cocher FAIT
    // apparaître le champ minutes, à `0` et bien visible — l'écran montrait la
    // valeur qui allait défaire la sauvegarde. C'est le retour arrière SERVEUR
    // qui était silencieux.
    //
    // 🔑 Deux correctifs coexistent aujourd'hui : côté client
    // (EmargementGrid.tsx:202-206, la durée prévue est recopiée à la coche) et
    // côté serveur (presence.ts:447-449, le repli teste désormais `=== 0`). Cette
    // assertion ne rougira donc que si les DEUX disparaissent — ce qui est
    // exactement ce qu'on veut interdire.
    //
    // ⚠️ Elle n'est PAS marquée `test.fail()` : le défaut est réparé dans ce
    // worktree, et un `test.fail()` sur un chemin qui passe rougit à l'envers.
    await page.goto(urlEmargement, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(
      grille,
      "la grille d'émargement n'est pas revenue après rechargement de " + urlEmargement,
    ).toBeVisible({ timeout: 90_000 });
    await expect(
      matinDe(MARIE.email).locator('input[type="checkbox"]'),
      `la présence en salle de ${MARIE.email} n'a pas survécu au rechargement. ` +
        "C'est le défaut du 2026-08-22 qui revient : la grille envoie 0 minute, le repli " +
        "de `saveEmargementAction` (presence.ts:447-449) redevient inatteignable, et " +
        "`recomputeTauxPresence` (presence-service.ts:141-145) rebascule `present` à " +
        "false dans la même requête. L'écran annonce « 1 ligne mise à jour » et " +
        "l'émargement — LA preuve d'assiduité de l'indicateur off.12 — est détruit en silence.",
    ).toBeChecked({ timeout: 60_000 });
    expect(
      Number(await matinDe(MARIE.email).locator('input[type="number"]').inputValue()),
      "la durée émargée en salle n'a pas été conservée telle quelle par la sauvegarde",
    ).toBe(prevuMatin);

    // ── 9. L'après-midi se joue à distance : import du relevé ───────────────
    const formulaireImport = page.locator("form").filter({ has: page.locator("#import-file") });

    // `#import-plateforme` est rendu SANS CONDITION avec le formulaire
    // (ImportReleveForm.tsx:159-171, dans le `<form>` ouvert :153) : pas de
    // `if (count() > 0)` ici — une garde qui ne peut jamais être fausse ne garde
    // rien, et le jour où elle le serait l'import partirait en silence sur la
    // valeur par défaut au lieu de rougir.
    //
    // ⚠️ Ce geste n'est PAS un témoin d'hydratation : l'état initial vaut déjà
    // `"zoom"` (ImportReleveForm.tsx:89). Le sélectionner est le geste d'un
    // humain, pas une preuve — c'est le dépôt du fichier, ci-dessous, qui porte
    // la barrière.
    await formulaireImport.locator("#import-plateforme").selectOption("zoom");

    // 🔴 POSER UN FICHIER AVANT L'HYDRATATION NE FAIT RIEN — ET NE DIT RIEN.
    // Le `<input type="file">` accepte le fichier au niveau du DOM même si React
    // n'a pas attaché son `onChange` (`handleFileChange`, ImportReleveForm.tsx:99-104) :
    // l'état `file` reste nul, le bouton reste `disabled={isPending || !file}`
    // (:203), et le clic meurt sur l'`actionTimeout` de 15 s avec « element is
    // not enabled » — un symptôme qui ne ressemble pas à sa cause.
    //
    // 🔑 Un `change` perdu avant l'attache du listener racine N'EST PAS REJOUÉ.
    // Le seul témoin d'hydratation du parcours (l'apparition du champ minutes,
    // étape 7) a été détruit par le rechargement de l'étape 8 : on REPOSE donc le
    // fichier tant que le bouton ne s'active pas, au lieu de constater l'échec
    // trente secondes plus tard.
    const boutonImport = formulaireImport.getByRole("button", { name: /^Importer le relevé$/ });
    await expect
      .poll(
        async () => {
          await page.locator("#import-file").setInputFiles({
            // Un tampon, pas un fichier sur le disque du poste qui joue le parcours.
            name: "releve-zoom-hybride.csv",
            mimeType: "text/csv",
            buffer: Buffer.from(RELEVE_ZOOM, "utf8"),
          });
          return boutonImport.isEnabled();
        },
        {
          timeout: 60_000,
          intervals: [1_000, 2_000, 5_000],
          message:
            "le bouton d'import ne s'est jamais activé, malgré plusieurs dépôts du " +
            "fichier : `ImportReleveForm` n'a pas hydraté (le `change` n'atteint aucun " +
            "gestionnaire et n'est jamais rejoué), ou le fichier a été refusé en amont " +
            '(accept=".csv,.tsv,.txt", ImportReleveForm.tsx:182)',
        },
      )
      .toBe(true);
    await boutonImport.click();

    // ── 10. Ce que l'import doit VRAIMENT produire ──────────────────────────
    //
    // 🔴 On lit les DEUX compteurs du rapport, jamais « un des deux noms
    // apparaît quelque part ». Sur une session sans inscrit, l'action RÉUSSIT
    // avec `nbMatched: 0 / nbUnmatched: 2` et imprime les deux noms sous
    // « Participants non rapprochés » (ImportReleveForm.tsx:235-254) : chercher
    // les noms revient à lire l'aveu d'échec et à le certifier comme succès.
    //
    // Le repère du rapport est le `<h4>` « Rapport d'import » (ImportReleveForm.tsx:211-213),
    // dont on remonte au parent (:210) : un `locator("div").filter(...).last()`
    // n'est stable que par accident. ⚠️ Ce bloc vit HORS du `<form>` (fermé :206),
    // donc il ne peut pas être scopé à `formulaireImport`.
    //
    // ⚠️ « rapprochés » apparaît DEUX fois dans ce bloc (:219 et :231). Les deux
    // motifs sont donc distincts par construction : `(\d+) non rapprochés` ne peut
    // matcher que le second, et `(\d+) rapprochés` que le premier — le « 0 » du
    // second est suivi de « non », jamais de « rapprochés ».
    const rapport = page.getByRole("heading", { name: /Rapport d'import/ }).locator("xpath=..");
    const etatImport = async (): Promise<string> => {
      // Seul le `[role="alert"]` DU FORMULAIRE d'import nous concerne
      // (ImportReleveForm.tsx:193-200) ; la page en porte d'autres
      // (SessionJoursEditor, LiensEmargement, et la grille elle-même:410-417).
      const alerte = formulaireImport.locator('[role="alert"]');
      if ((await alerte.count()) > 0) {
        // Lecture BORNÉE à 1 s : sans cela chaque itération hériterait de
        // l'`actionTimeout` de 15 s et le chemin NOMINAL paierait l'attente.
        const texte = await alerte
          .first()
          .innerText({ timeout: 1_000 })
          .catch(() => "(alerte illisible)");
        return `REFUS: ${texte.replace(/\s+/g, " ").trim()}`;
      }
      if ((await rapport.count()) === 0) return "(aucun rapport d'import affiché)";
      const texte = (await rapport.innerText({ timeout: 5_000 }).catch(() => "")).replace(
        /\s+/g,
        " ",
      );
      const rapproches = /(\d+) rapprochés/.exec(texte)?.[1] ?? "?";
      const nonRapproches = /(\d+) non rapprochés/.exec(texte)?.[1] ?? "?";
      return `${rapproches} rapprochés / ${nonRapproches} non rapprochés`;
    };

    await expect
      .poll(etatImport, {
        timeout: 120_000,
        message:
          "l'import du relevé n'a pas rapproché les deux inscrits. La valeur reçue dit " +
          "laquelle des causes s'est produite : « REFUS: … » = l'action a refusé et l'a " +
          "écrit dans le formulaire (typiquement le garde-fou D14 sur une session étalée " +
          "sans journées déclarées, presence.ts:676-686) ; « 0 rapprochés / 2 non " +
          "rapprochés » = la session n'a AUCUN inscrit et `matchParticipants` n'avait " +
          "personne à qui rattacher les participants (match.ts:65-68) ; « 1 rapproché » = " +
          "une seule des deux adresses du relevé correspond à un inscrit (la casse est " +
          "normalisée, match.ts:52-55 — chercher plutôt une inscription qui a échoué).",
      })
      .toBe("2 rapprochés / 0 non rapprochés");

    // ── 11. LA question du parcours hybride ─────────────────────────────────
    //
    // On recharge : l'écran doit dire ce que la BASE dit, pas ce que l'état
    // client d'`ImportReleveForm` a bien voulu peindre.
    await page.goto(urlEmargement, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await expect(
      grille,
      "la grille d'émargement n'est pas revenue après l'import — impossible de lire ce " +
        "que la base porte réellement",
    ).toBeVisible({ timeout: 90_000 });

    const matinMarieApres = matinDe(MARIE.email).locator('input[type="checkbox"]');
    const matinThomasApres = matinDe(THOMAS.email).locator('input[type="checkbox"]');

    // (a) LE CONTRE-TÉMOIN D'ABORD — sinon (b) serait indiscernable d'un import
    //     qui n'a rien écrit du tout sur cette journée.
    //
    //     La matinée de Thomas n'est ni signée ni cochée : `protegePresentiel`
    //     est faux pour elle (presence.ts:871-874), l'import l'upserte donc avec
    //     sa part distancielle — 300 × 210/420 = 150 minutes, au-dessus du seuil
    //     de 105 — et `recomputeTauxPresence` la coche. Si cette assertion
    //     échoue, ce n'est PAS la protection M1 qui est en cause : c'est l'import
    //     qui n'a pas atteint cette journée.
    await expect(
      matinThomasApres,
      `l'import n'a pas coché la matinée de ${THOMAS.email}, pourtant présent de bout en ` +
        "bout dans le relevé et protégé par RIEN. L'import n'a donc pas écrit sur cette " +
        "journée : soit `parisDateISO(joinAt)` ne tombe pas sur un jour PLANIFIÉ et le " +
        "créneau a été reporté sur le premier jour du plan (presence.ts:752-755), soit " +
        "les journées déclarées de la session ne sont pas celles que ce parcours vise, " +
        "soit la part attribuée est passée sous 0,5 × prévu (répartition au prorata, " +
        "repartition-distanciel.ts:109-117). " +
        "Tant que ce témoin est rouge, l'assertion suivante ne prouve rien.",
    ).toBeChecked({ timeout: 60_000 });

    // (b) LA PROTECTION M1 — l'assertion qu'aucun autre parcours ne peut porter.
    //
    //     Même journée, même import, même demi-journée que (a). La seule
    //     différence : celle-ci portait une présence émargée en salle. Elle doit
    //     survivre, avec SES minutes.
    //
    //     Sans `protegePresentiel`, l'`upsertCreneau` de l'import (presence.ts:884-899)
    //     lui écrirait la part distancielle du matin — 60 × 210/420 = 30 minutes,
    //     sous le seuil de 105 — et la case se décocherait. C'est vérifiable en
    //     retirant les lignes presence.ts:871-882 : ce test rougit alors sur (b)
    //     en gardant (a) vert.
    await expect(
      matinMarieApres,
      `la matinée émargée EN SALLE de ${MARIE.email} a été écrasée par l'import du relevé ` +
        "distanciel de la MÊME journée. C'est la protection M1 qui a cédé " +
        "(`protegePresentiel`, presence.ts:871-874) : sur une session hybride, une preuve " +
        "de présence présentielle — la signature qui fonde l'assiduité aux indicateurs 9 " +
        "et 11 — est détruite en silence par un geste administratif ordinaire. " +
        "Le témoin (a) est vert : l'import a bien écrit sur cette journée, il n'a " +
        "simplement pas épargné ce qui devait l'être.",
    ).toBeChecked({ timeout: 60_000 });

    expect(
      Number(await matinDe(MARIE.email).locator('input[type="number"]').inputValue()),
      "la case est restée cochée mais la DURÉE émargée en salle a changé : l'import a " +
        "réécrit `dureeRealiseeMinutes` sur un créneau présentiel. La case ne suffit donc " +
        "pas à constater la protection — c'est la durée qui porte la preuve, et c'est elle " +
        "qui alimente le taux de présence et le certificat de réalisation.",
    ).toBe(prevuMatin);

    // ── 12. Trace ───────────────────────────────────────────────────────────
    //
    // 🔴 On attache la GRILLE, et rien d'autre. Un brouillon annonçait « on
    // attache la grille, PAS `body` » puis attachait `.admin-main` : le rail est
    // bien hors de `.admin-main`, mais la zone de contenu porte AUSSI le bandeau,
    // les journées, les liens de signature, le dossier d'audit, la feuille à jour
    // et le récapitulatif des taux — quatre mille caractères tronqués auraient
    // coupé AVANT la grille, c'est-à-dire avant la cause.
    await info.attach("grille-hybride-apres-import.txt", {
      body: await grille.innerText(),
      contentType: "text/plain",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Repères de la grille
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Index de la colonne « Matin » du jour `jourISO` dans la grille d'émargement.
 *
 * 🔑 On rend un index de colonne, et non un sélecteur bâti sur l'`aria-label` de
 * la case (`Présent Prénom Nom <libellé>`, EmargementGrid.tsx:376). Le libellé
 * d'un créneau est RÉÉCRIT à chaque sauvegarde (`saveEmargementAction`,
 * presence.ts:470-472) et de nouveau à chaque import : un sélecteur bâti dessus
 * matche avant l'action et plus après, sans que rien ne le dise.
 *
 * ⚠️ L'index de `<th>` et celui de `<td>` COÏNCIDENT : la première colonne est
 * « Stagiaire » des deux côtés (EmargementGrid.tsx:323 et :345). L'appelant peut
 * donc passer cet index directement à `cellule()`.
 *
 * ⚠️ `/Matin/` ne matche pas « Après-midi » : la casse diffère. Et le libellé de
 * demi-journée est rendu dans un `<div class="normal-case">` (:330-332), donc le
 * `uppercase` du `<th>` (:314) ne le transforme pas — `innerText()` rend bien
 * « Matin ».
 *
 * 🔴 Une session peut porter PLUSIEURS journées : il y a alors autant de colonnes
 * « Matin » que de journées, et prendre la première venue viserait un jour au
 * hasard. On exige la coïncidence avec la DATE, portée par le `title` de
 * l'en-tête (EmargementGrid.tsx:329).
 */
async function indexColonneMatin(grille: Locator, jourISO: string): Promise<number> {
  const enTetes = grille.locator("thead th");
  await expect(
    enTetes.first(),
    "la grille d'émargement n'a aucun en-tête de colonne — elle est vide ou en cours de rendu",
  ).toBeVisible({ timeout: 60_000 });

  const nb = await enTetes.count();
  const vus: string[] = [];
  for (let i = 0; i < nb; i += 1) {
    const th = enTetes.nth(i);
    const texte = (await th.innerText()).replace(/\s+/g, " ").trim();
    // 🔴 ON COMPTE AVANT DE LIRE. « Stagiaire » (EmargementGrid.tsx:323) et
    // « Taux » (:335) ne portent aucun `div[title]` : un `getAttribute` y
    // attendrait l'`actionTimeout` entier (playwright.config.ts:36, 15 s) avant
    // de lever, soit 30 s morts sur le chemin NOMINAL, à chaque exécution. Et le
    // `catch(() => null)` qui rattrapait cette absence attendue avalait tout
    // aussi bien un détachement de nœud ou une violation de mode strict : un
    // trou noir en miniature.
    const boite = th.locator("div[title]");
    const titre =
      (await boite.count()) > 0
        ? await boite.first().getAttribute("title", { timeout: 2_000 })
        : null;
    vus.push(`${i} « ${texte} » title=${titre ?? "—"}`);
    if (/Matin/.test(texte) && titre === jourISO) return i;
  }

  throw new Error(
    `aucune colonne « Matin » datée du ${jourISO} dans la grille d'émargement. ` +
      `Colonnes réellement présentes : ${vus.join(" | ")}. ` +
      "Trois causes à distinguer avant d'accuser ce parcours : (1) les journées de la " +
      "session ne commencent pas le jour visé — sans journées déclarées, elles sont " +
      "déduites de la plage `dateDebut..dateFin` (creneaux.ts:143-157) ; (2) la journée " +
      "est trop courte pour être coupée au pivot de 13:00 et ne produit qu'une " +
      "demi-journée (creneaux.ts:300-313) ; (3) le fuseau du serveur Next décale la date " +
      'affichée — la colonne est étiquetée par `c.date.toLocaleDateString("fr-CA")` ' +
      "(emargement/page.tsx:105-108), donc en heure du SERVEUR, sur une date stockée à " +
      "minuit UTC, alors que la date visée est calculée sur l'horloge du poste qui joue " +
      "le parcours.",
  );
}

/**
 * La cellule de la colonne `index` sur la ligne du stagiaire `email`.
 *
 * 🔴 On filtre sur l'ADRESSE, jamais sur le nom affiché. Sur cet écran, la grille
 * et le récapitulatif des taux portent tous deux le nom ET l'adresse
 * (EmargementGrid.tsx:346-351, emargement/page.tsx:307-310). Le scope `grille`
 * écarte le récapitulatif, l'adresse écarte les homonymes.
 */
function cellule(grille: Locator, email: string, index: number): Locator {
  return grille.locator("tbody tr").filter({ hasText: email }).locator("td").nth(index);
}

/**
 * Clique « Enregistrer l'émargement » et exige que l'écran le CONFIRME.
 *
 * 🔴 Le repère est scopé au `<form>` de la grille. La page d'émargement porte
 * plusieurs `[role="status"]` distincts (SessionJoursEditor, LiensEmargement,
 * GenererCreneauxButton.tsx:102, et la grille elle-même:418-425) : un
 * `page.getByRole("status")` non scopé viole le mode strict dès que les créneaux
 * viennent d'être générés — c'est-à-dire toujours, ici.
 *
 * Le nom du bouton est ANCRÉ : pendant l'action il devient « Enregistrement… »
 * (EmargementGrid.tsx:428), et un motif lâche matcherait les deux états.
 *
 * La valeur SONDÉE porte la cause : un message figé mentirait le jour où l'écran
 * affiche précisément un refus.
 */
async function enregistrerLaGrille(page: Page, formulaireGrille: Locator): Promise<void> {
  await formulaireGrille
    .getByRole("button", { name: /^Enregistrer l'émargement$/ })
    .click({ timeout: 30_000 });

  const etat = async (): Promise<string> => {
    const alerte = formulaireGrille.locator('[role="alert"]');
    if ((await alerte.count()) > 0) {
      const texte = await alerte
        .first()
        .innerText({ timeout: 1_000 })
        .catch(() => "(alerte illisible)");
      return `REFUS: ${texte.replace(/\s+/g, " ").trim()}`;
    }
    const statut = formulaireGrille.locator('[role="status"]');
    if ((await statut.count()) === 0) return "(aucun retour affiché par la grille)";
    const texte = await statut
      .first()
      .innerText({ timeout: 1_000 })
      .catch(() => "(statut illisible)");
    return texte.replace(/\s+/g, " ").trim();
  };

  await expect
    .poll(etat, {
      timeout: 90_000,
      message:
        "la sauvegarde de la grille d'émargement n'a rien confirmé. La valeur reçue dit " +
        "laquelle des causes s'est produite : « REFUS: … » = `saveEmargementAction` a " +
        "refusé et l'a écrit dans le formulaire (EmargementGrid.tsx:410-417) ; " +
        "« (aucun retour affiché…) » = l'action n'a pas abouti, ou la page n'était pas " +
        `hydratée et le clic n'a atteint aucun gestionnaire. URL : ${page.url()}`,
    })
    .toMatch(/ligne.? mise.? à jour/);
}
