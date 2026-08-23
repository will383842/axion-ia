/**
 * PARCOURS 2 — Formation à DISTANCE, import du relevé de connexion inclus.
 *
 * Phase 6 de `_AUDIT/PROMPT-AUDIT-QUALIOPI-E2E-50-AGENTS-2026-08-18.md`.
 *
 * En distanciel, la preuve de présence n'est pas une signature sur une feuille :
 * c'est le relevé de connexion de la plateforme. `documents.spec.ts` le dit —
 * « c'est la trace du distanciel : elle vaut preuve au même titre qu'une
 * signature ». Ce parcours joue donc le geste qui produit cette preuve : ouvrir
 * l'émargement d'une session distancielle et y importer un export Zoom.
 *
 * ⚠️ Le fichier importé est une fixture bâtie à la main, jamais un export réel :
 * un relevé de connexion contient des données personnelles.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * 🔴 2026-08-23 — CE PARCOURS ÉTAIT VERT AVEC **ZÉRO APPARIEMENT**.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La version précédente créait une session, y déposait le relevé, puis attendait
 * que l'écran matche `/Marie Martin|Thomas Dubois|2 participants?|appari/i`.
 * Elle passait — sur l'AVEU D'ÉCHEC. Chaîne mesurée, maillon par maillon :
 *
 *   1. la session naissait sans AUCUN inscrit (`#session-participants` renseigne
 *      « Nb participants PRÉVUS », SessionForm.tsx:586-590 — un nombre
 *      déclaratif, qui ne crée pas d'inscription) ;
 *   2. `importReleveConnexionAction` lisait donc `enrollments = []`
 *      (presence.ts:587-599) ;
 *   3. `matchParticipants` renvoyait `matched = []` et poussait les deux
 *      participants dans `unmatched` (match.ts:66) ;
 *   4. l'action RÉUSSISSAIT, avec `nbMatched: 0` / `nbUnmatched: 2`
 *      (presence.ts:930-943) ;
 *   5. `ImportReleveForm` imprimait alors les deux noms sous le titre
 *      « Participants non rapprochés » (ImportReleveForm.tsx:235-257).
 *
 * Le motif du test lisait ces deux noms-là. Il certifiait comme succès l'écran
 * qui dit, en toutes lettres, que le rapprochement a échoué.
 *
 * 🔑 La leçon n'est pas « le motif était trop large ». Elle est que **le même
 * texte apparaît dans les deux issues opposées** : une assertion ne prouve rien
 * tant qu'on n'a pas cherché ce qui l'aurait fait rougir. C'est pour cela que ce
 * fichier importe DEUX relevés — le premier avec un intrus, exprès, pour montrer
 * que la garde SAIT rougir ; le second propre, pour qu'elle verdisse ensuite.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️ 2026-08-23 — CE FICHIER EST DÉSORMAIS UNE GATE. LE COMMENTAIRE INVERSE,
 *    QUI VIVAIT ICI, ÉTAIT PÉRIMÉ DE QUELQUES HEURES.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un premier jet de cet en-tête écrivait « ce fichier n'est PAS une gate, le
 * step « Playwright suite » porte `continue-on-error: true` ». Mesuré dans
 * `.github/workflows/ci.yml` : le `continue-on-error` a été RETIRÉ de ce step
 * (commentaire daté :479, `run:` :519). Et `Gate B · per-PR` est un contexte
 * EXIGÉ par la protection de `main`, en `strict: true` — donc **un rouge d'ici
 * bloque 100 % des PR, pas seulement la sienne** (ci.yml:495-499).
 *
 * 🔑 Deux conséquences, et aucune n'est cosmétique :
 *   · ce parcours n'a plus le droit d'être instable. Chaque attente porte donc
 *     une borne NOMMÉE, et chaque échec doit dire ce qu'il a lu ;
 *   · la dépendance de compilation ci-dessous n'est plus un inconfort local :
 *     un `TS2305` ici rougit la Gate B de tout le monde.
 *
 * ⚠️ **CE FICHIER NE COMPILE PAS SEUL.** Il importe `CONTENU`,
 * `STAGIAIRES_DEMO`, `horodatageZoom` et `inscrire` de `./_communs` : la version
 * de `_communs.ts` qui les exporte doit atterrir AVANT lui. Mesuré le 2026-08-23
 * à 06 h 17 sur ce worktree, le fichier en place n'exportait encore que
 * `Modalite`, `ENREGISTREMENT`, `admin`, `horodatage`, `champEtiquete`,
 * `creerSession`, `ouvrirSessionDemo`. Si le typecheck rougit sur TS2305, c'est
 * l'ordre d'atterrissage qu'il faut lire, pas ce parcours.
 *
 * ## Ce que ce fichier prouve
 *
 *   · une session DISTANCIELLE se crée à la souris et s'annonce comme telle ;
 *   · les deux stagiaires y sont RÉELLEMENT inscrits (compteur de la fiche) ;
 *   · l'écran d'émargement lui ouvre le bloc d'import (gaté `isDistanciel`,
 *     emargement/page.tsx:126 + 262) ;
 *   · un relevé qui contient un inconnu le DÉNONCE (contre-témoin) ;
 *   · un relevé propre rapproche les DEUX inscrits, et zéro non-rapproché ;
 *   · les taux recalculés portent les durées INDIVIDUELLES **déclarées** par le
 *     relevé, et non l'amplitude connexion→déconnexion ;
 *   · la pièce d'archive — le relevé PDF, numéroté au registre — est produite.
 *
 * ## Ce qu'il ne prouve toujours pas
 *
 *   · rien du contenu du PDF (on lit son numéro, pas ses pages) ;
 *   · rien de l'archivage R2 du CSV : `storeAndSignCsv` est fail-soft
 *     (render.ts:94-101) et rend `null` sans R2, donc un poste sans R2 produit
 *     exactement le même écran qu'un poste qui archive ;
 *   · rien du RAPPROCHEMENT PAR DATE — voir le commentaire de `releveZoom` :
 *     sur une session d'un seul jour, le repli et le chemin nominal rendent la
 *     même date, et aucune assertion d'ici ne les distingue ;
 *   · rien de la protection M1 des demi-journées déjà émargées en salle
 *     (`protegePresentiel`, presence.ts) : elle n'a de sens que sur une session
 *     HYBRIDE, et c'est le parcours 03 qui la porte.
 *
 * ## Comment le jouer
 *
 *     pnpm qualiopi:seed-demo
 *     npx playwright test tests/e2e/qualiopi/parcours/02-distanciel.spec.ts \
 *       --project=chromium --workers=1
 */

import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "../../fixtures/admin-auth";
import {
  admin,
  CONTENU,
  creerSession,
  ENREGISTREMENT,
  horodatageZoom,
  inscrire,
  STAGIAIRES_DEMO,
} from "./_communs";

/**
 * Jour de la session, en décalage de jours par rapport à aujourd'hui.
 *
 * Négatif : un relevé de connexion se produit APRÈS la séance. Et 14 jours, pas
 * 40 : au-delà de 31 jours d'amplitude sans journées déclarées,
 * `importReleveConnexionAction` REFUSE l'import (`sessionTropEtaleePourLeRepli`,
 * creneaux.ts:47 + 68 ; refus levé presence.ts:676-686) — un refus légitime,
 * mais qui n'a rien à voir avec ce que ce parcours veut éprouver.
 */
const DEBUT_DANS_JOURS = -14;

const [MARIE, THOMAS] = STAGIAIRES_DEMO;

/**
 * Minutes DÉCLARÉES par le relevé, par personne — colonne « Duration (Minutes) ».
 *
 * 🔑 Deux exigences, et il a fallu les deux pour que l'assertion finale morde.
 *
 * 1. **Elles doivent différer entre les deux personnes.** Deux durées identiques
 *    produiraient deux taux identiques, et un import qui distribuerait une durée
 *    moyenne — ou qui n'aurait rien lu du fichier — serait indiscernable d'un
 *    import correct.
 * 2. **Au moins une doit différer de son AMPLITUDE connexion → déconnexion.**
 *    C'est le défaut qu'un relecteur a trouvé dans le jet précédent : il datait
 *    Thomas de 09:05 à 12:00 et déclarait 175 minutes, soit exactement
 *    `leaveAt − joinAt`. Un import qui aurait calculé l'amplitude au lieu de LIRE
 *    la colonne aurait rendu le même taux, et le commentaire promettait une
 *    discrimination que la fixture ne pouvait pas produire.
 *
 * Thomas déclare donc 130 minutes pour 175 d'amplitude — le cas ordinaire d'une
 * déconnexion en cours de séance, que Zoom déduit. Vérifié dans le code que ce
 * découplage est bien celui qui compte : sans journées déclarées,
 * `jourHeureDebut` est indéfini, donc `horairesConnus` vaut faux
 * (presence.ts:777), donc `joinMin`/`leaveMin` sont nuls (:778-783) et
 * `repartirMinutesConnexion` répartit au prorata du PRÉVU
 * (repartition-distanciel.ts:112-113). Seule la durée déclarée entre dans le
 * calcul ; l'amplitude ne sert à rien d'autre qu'à dater la journée.
 *
 * Ordres de grandeur prédits AVANT de lancer, pour rendre un échec lisible :
 *
 *   · la session ne déclare pas `dureeReelleHeures` (aucun écrivain avant la
 *     clôture), donc `genererCreneaux` retombe sur 7 h/jour
 *     (`HEURES_PAR_JOUR_DEFAUT`, creneaux.ts:24) → 420 min prévues par personne ;
 *   · Marie : 210 / 420 → 50 % ;
 *   · Thomas : 130 / 420 → 31 % (arrondi de 30,95 ; taux.ts:110).
 *
 * ⚠️ Ces deux pourcentages ne sont PAS assertis tels quels, exprès : ils
 * dépendent d'une constante produit (7 h/jour) qu'un métier a le droit de
 * changer. Ce qui est asserti, c'est la RELATION — cf. l'étape 6.
 */
const MINUTES_MARIE = 210;
const MINUTES_THOMAS = 130;

/** L'intrus du contre-témoin — fictif, en `.invalid`, jamais une vraie personne. */
const INTRUS = { nom: "Camille Intruse", email: "camille.intruse@demo.axion-ia.invalid" };

/** Une ligne de l'export Zoom — colonnes relevées dans `parse-zoom.ts:22-26`. */
interface LigneReleve {
  nom: string;
  email: string;
  /** Heure d'arrivée en 24 h, convertie en AM/PM par `horodatageZoom`. */
  arrivee: string;
  /** Heure de départ en 24 h. */
  depart: string;
  /**
   * Colonne « Duration (Minutes) » — c'est ELLE que Zoom somme, et elle peut
   * être plus courte que `depart − arrivee` (déconnexions, reconnexions). C'est
   * la seule que `parseZoomCsv` additionne (parse-zoom.ts:82).
   */
  minutes: number;
}

/**
 * Compose un export Zoom, au format exact que `parse-zoom.ts` attend — colonnes
 * relevées dans `parse-zoom.ts:22-26`, jamais devinées.
 *
 * 🔴 LES DATES SONT CALCULÉES, PLUS ÉCRITES EN DUR. La version précédente datait
 * le relevé du « 06/10/2026 », c'est-à-dire d'un jour qui n'a rien à voir avec
 * celui de la session créée par le parcours. `horodatageZoom` produit le MÊME
 * jour civil que `horodatage`, à partir du même décalage : c'est pour cela qu'il
 * vit dans `_communs.ts`, où le parcours 03 le réutilise à l'identique.
 *
 * ⚠️ MAIS CE PARCOURS NE PROUVE PAS LE RAPPROCHEMENT PAR DATE, et il ne faut pas
 * le lui faire dire. Mesuré : `importReleveConnexionAction` fait
 * `creneauxParJour.has(isoBrut) ? isoBrut : premierJourPlan` (presence.ts:755).
 * Ici `dureeJours` vaut 1, donc `genererCreneaux` ne produit des créneaux que
 * sur UNE date, `creneauxParJour` n'a qu'une clé, et cette clé EST
 * `premierJourPlan` (:718) : **les deux branches du ternaire rendent la même
 * valeur**. Dater le relevé du jour de la session ne fait donc pas rougir ce
 * fichier ; ça le rend COHÉRENT, et ça évite qu'un lecteur croie mesurer un
 * rapprochement que rien ici ne discrimine. L'éprouver demanderait une session
 * de 2 jours ET une assertion sur la COLONNE de la grille où les créneaux ont
 * atterri — c'est un parcours à part, pas une ligne de plus ici.
 *
 * ⚠️ Le format est `MM/DD/YYYY hh:mm:ss AM/PM` et son motif est ANCRÉ, secondes
 * comprises (parse-zoom.ts:156-158). Une date hors format n'est pas refusée :
 * `parseZoomDate` rend `null`, le participant est rapproché sans intervalle, et
 * l'échec est muet.
 */
function releveZoom(participants: readonly LigneReleve[]): string {
  const entete =
    '"Name (Original Name)","User Email","Join Time","Leave Time","Duration (Minutes)"';
  const lignes = participants.map(
    (p) =>
      `"${p.nom}","${p.email}",` +
      `"${horodatageZoom(DEBUT_DANS_JOURS, p.arrivee)}",` +
      `"${horodatageZoom(DEBUT_DANS_JOURS, p.depart)}","${p.minutes}"`,
  );
  return [entete, ...lignes].join("\n");
}

/** Les trois lignes du relevé — les deux inscrits, et l'intrus du contre-témoin. */
const LIGNE_MARIE: LigneReleve = {
  nom: MARIE.nom,
  email: MARIE.email,
  arrivee: "09:00",
  depart: "12:30",
  minutes: MINUTES_MARIE,
};
const LIGNE_THOMAS: LigneReleve = {
  nom: THOMAS.nom,
  email: THOMAS.email,
  // 09:05 → 12:00 = 175 minutes d'amplitude, pour 130 déclarées. L'écart est la
  // raison d'être de la fixture : cf. le commentaire de `MINUTES_THOMAS`.
  arrivee: "09:05",
  depart: "12:00",
  minutes: MINUTES_THOMAS,
};
const LIGNE_INTRUS: LigneReleve = {
  nom: INTRUS.nom,
  email: INTRUS.email,
  arrivee: "09:10",
  depart: "10:40",
  minutes: 90,
};

test.use(ENREGISTREMENT);

test.describe("@parcours-qualiopi 2 — distanciel, relevé de connexion", () => {
  // 🔴 BUDGET — 600 s, et ce n'est pas de la générosité.
  //
  // Le cliquet `tests/unit/e2e-harness/delai-interne-sous-le-budget.spec.ts`
  // exige seulement que le budget dépasse le PLUS GRAND délai interne (180 s,
  // hérité de `loginAsAdmin` et de l'attente d'arrivée de `creerSession`). Ce
  // seuil-là est nécessaire, pas suffisant : ces deux attentes de 180 s vivent
  // dans le MÊME test et peuvent se produire l'une après l'autre. Un budget de
  // 300 s serait donc mathématiquement incapable de les contenir toutes les
  // deux, et l'échec s'afficherait en « Test timeout exceeded » — le message
  // qui ne nomme rien, exactement le défaut que cette phase corrige ailleurs.
  //
  // 🔑 Un budget se dimensionne sur la SOMME de ce qui peut attendre à la
  // suite, pas sur le maximum. Contre un build de production (la CI) le
  // parcours tient en une poignée de dizaines de secondes ; les 180 s sont le
  // coût des compilations à la demande de `next dev`.
  //
  // ⚠️ `mode: "serial"` a été RETIRÉ : ce describe ne contient qu'UN test, et
  // sérialiser un singleton laissait croire au lecteur suivant que l'ordre
  // était load-bearing. Le `--workers=1` du mode d'emploi, lui, garde son sens :
  // il concerne les SEPT parcours entre eux (cf. l'en-tête de `_communs.ts`).
  test.describe.configure({ timeout: 600_000 });

  test("un relevé de connexion rapproche les deux inscrits, et produit sa pièce", async ({
    page,
  }, info) => {
    // ⚠️ Dispense NOMMÉE, et impossible là où elle compterait : la CI ne lance
    // que chromium (`pnpm test:e2e --project=chromium`, ci.yml:519) et
    // n'installe que lui (:299). Les quatre autres projets n'existent qu'en
    // local (playwright.config.ts:43-47). Ce `skip` ne peut donc se déclencher
    // qu'en exécution locale « tous projets » — jamais sur le chemin qui
    // rapporte, ce qui est la seule forme de dispense acceptable ici.
    test.skip(
      info.project.name !== "chromium",
      `Parcours métier : un moteur suffit. Projet « ${info.project.name} » ignoré ; ` +
        "la CI ne joue que chromium (ci.yml:519), ce saut n'y existe pas.",
    );

    await loginAsAdmin(page);

    // ── 1. Une session DISTANCIELLE, créée à la souris ──────────────────────
    const titre = `E2E DISTANCIEL ${Date.now()}`;
    const id = await creerSession(page, {
      modalite: "distanciel",
      titre,
      debutDansJours: DEBUT_DANS_JOURS,
      participants: 2,
      montantHt: 1800,
    });

    // ── 2. Les DEUX stagiaires y sont inscrits — AVANT tout import ──────────
    //
    // 🔴 C'est LA marche qui manquait, et sans elle tout le reste est une
    // pantomime : sans inscrit, il n'y a personne à rapprocher, et l'import
    // « réussit » sur zéro appariement (cf. l'en-tête de ce fichier).
    //
    // 🔑 `inscrire` est importé, jamais recopié : le parcours 03 en a besoin à
    // l'identique (même garde `isDistanciel`, emargement/page.tsx:126), et deux
    // copies divergeraient. Il vérifie lui-même l'aboutissement sur le compteur
    // « N inscrits / M prévus » de la fiche (sessions/[id]/page.tsx:621).
    await inscrire(page, MARIE.email);
    const nbInscrits = await inscrire(page, THOMAS.email);

    // Ce n'est pas une redite du helper : c'est ce qui RATTACHE le littéral
    // « 2 rapprochés » des étapes 4 et 5 à un fait mesuré. Sans cette ligne, le
    // 2 attendu plus bas serait une constante d'espoir.
    expect(
      nbInscrits,
      "la session ne porte pas exactement deux inscrits après les deux inscriptions — les " +
        "compteurs « 2 rapprochés » attendus plus bas ne veulent alors plus rien dire",
    ).toBe(2);

    // ── 3. L'écran d'émargement, et ce qu'il propose en distanciel ──────────
    //
    // 120 s de borne propre : sous `next dev` cette route se compile à la
    // demande, et la borne globale de navigation (30 s, playwright.config.ts:37)
    // la ferait échouer sur un message qui accuserait la page au lieu de la
    // compilation.
    const reponse = await page.goto(admin(`qualiopi/sessions/${id}/emargement`), {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    expect(reponse?.status(), "l'écran d'émargement doit répondre").toBe(200);

    // 🔴 LA MODALITÉ RÉELLE N'EST ÉCRITE QU'À UN SEUL ENDROIT DE CET ÉCRAN.
    //
    // La version précédente faisait `expect(page.locator("body")).toContainText(
    // /Distanciel/i)` sur la FICHE de session. Toujours vrai : `SessionLieuForm`
    // y est monté sans condition (sessions/[id]/page.tsx:763) et
    // `LieuFieldset.tsx:29` propose l'option « Distanciel (visioconférence) ».
    // Le mot était dans la page d'une session PRÉSENTIELLE tout autant.
    //
    // Le sous-titre de l'en-tête, lui, est composé à partir de
    // `MODALITE_LABELS[session.modalite]` (emargement/page.tsx:57-61 + 140) :
    // c'est une LECTURE de la donnée, pas un libellé d'options. On l'ancre entre
    // ses deux séparateurs « · » pour ne pas retomber sur un mot isolé.
    //
    // ⚠️ On n'ajoute PAS de négation `not.toContainText(/Présentiel|Hybride/)` :
    // l'écran ne porte qu'un en-tête, donc une fois l'assertion positive verte,
    // la négation ne peut plus échouer. Zéro signal indépendant.
    await expect(
      page.locator(".admin-page-header"),
      "le sous-titre de l'émargement n'annonce pas « · Distanciel · » — soit la session a été " +
        "créée dans une autre modalité (le sélecteur `#session-modalite` n'a pas pris), soit " +
        "l'en-tête a cessé de composer la modalité (emargement/page.tsx:140)",
    ).toContainText(/·\s*Distanciel\s*·/, { timeout: 120_000 });

    // Le bloc d'import est le SEUL nœud de cet écran gaté par la modalité
    // (`{isDistanciel && (`, emargement/page.tsx:262). Le `<h2>` « Feuille
    // d'émargement présentiel » (:244), lui, est rendu INCONDITIONNELLEMENT :
    // l'exiger ne discriminerait rien.
    //
    // ⚠️ Il ne discrimine pas non plus distanciel d'HYBRIDE : `isDistanciel`
    // vaut `distanciel || hybride` (:126). C'est un fait, pas un défaut — le
    // parcours 03 porte la distinction que celui-ci ne peut pas porter.
    await expect(
      page.getByRole("heading", { level: 2, name: "Relevé de connexion distanciel" }),
      "l'écran d'émargement d'une session DISTANCIELLE n'ouvre pas la section d'import — " +
        "c'est pourtant la seule preuve de présence possible à distance " +
        "(emargement/page.tsx:262-275)",
    ).toBeVisible({ timeout: 120_000 });

    // 🔑 `toBeAttached` sur le locator, et non `count()` puis `toBeGreaterThan`.
    // Un nombre déjà résolu n'est pas réessayable : la version précédente
    // mesurait l'état du DOM à l'instant exact où elle passait, sur une page
    // rendue en flux. Ce qu'elle appelait « pas d'import de relevé » pouvait
    // n'être que « pas encore ».
    const champFichier = page.locator("#import-file");
    await expect(
      champFichier,
      "le champ de dépôt du relevé (#import-file, ImportReleveForm.tsx:179-186) n'est pas " +
        "dans le DOM alors que la section d'import est affichée",
    ).toBeAttached({ timeout: 120_000 });

    // ── Les repères de lecture du rapport d'import ──────────────────────────
    //
    // Le `<form>` est scopé par le seul champ qui lui appartient en propre :
    // cet écran porte au moins quatre autres `[role="alert"]` (journées, liens
    // de signature, génération de créneaux, grille), et lire le mauvais ferait
    // accuser l'import d'une erreur qui n'est pas la sienne.
    const formulaireImport = page.locator("form", { has: champFichier });
    const alerteImport = formulaireImport.locator('[role="alert"]');

    // Le `<h4>` « Rapport d'import » (ImportReleveForm.tsx:211-213) est le seul
    // repère stable du bloc : `locator("div").filter(...).last()` dépendrait de
    // l'ordre du DOM. `xpath=..` remonte à son parent direct, qui EST le bloc
    // ouvert :210 — celui qui contient les compteurs, la liste nominative des
    // non-rapprochés, la référence d'import et le bouton PDF.
    // Motif tolérant sur l'apostrophe (`&apos;` en source) : on ne fait pas
    // dépendre un test d'un caractère typographique.
    const blocRapport = page
      .getByRole("heading", { level: 4, name: /^Rapport d.import$/ })
      .locator("xpath=..");

    /**
     * L'état de l'import, tel que l'écran le montre — une VALEUR, pas un verdict.
     *
     * 🔑 Un message de sondage est FIGÉ ; la valeur reçue, elle, dit ce qui
     * s'est réellement passé. Écrire « l'import n'a rien apparié » dans le
     * message mentirait le jour où l'action a été REFUSÉE — deux causes qui ne
     * se diagnostiquent pas pareil.
     *
     * ⚠️ Les deux compteurs se lisent dans le même texte, et « rapprochés » est
     * un SOUS-MOT de « non rapprochés » (ImportReleveForm.tsx:214-233). Les
     * deux motifs sont donc ancrés sur le chiffre qui les précède
     * IMMÉDIATEMENT : « 0 non rapprochés » ne peut pas satisfaire
     * `(\d+)\s+rapprochés`, puisque « non » s'interpose.
     *
     * ⚠️ La lecture de l'alerte est bornée à 1 s. Sans cela, chaque itération du
     * sondage hériterait de la borne d'action globale (15 s,
     * playwright.config.ts:36) et le chemin NOMINAL — celui où il n'y a aucune
     * alerte — paierait l'attente.
     */
    const etatImport = async (): Promise<string> => {
      if ((await alerteImport.count()) > 0) {
        const texte = await alerteImport
          .first()
          .innerText({ timeout: 1_000 })
          .catch((cause: unknown) => `(alerte illisible : ${String(cause).slice(0, 120)})`);
        return `REFUS: ${texte.replace(/\s+/g, " ").trim()}`;
      }
      if ((await blocRapport.count()) === 0) return "(aucun rapport d'import affiché)";
      const texte = (await blocRapport.innerText({ timeout: 5_000 }).catch(() => "")).replace(
        /\s+/g,
        " ",
      );
      const rapproches = /(\d+)\s+rapprochés/.exec(texte)?.[1];
      const nonRapproches = /(\d+)\s+non\s+rapprochés/.exec(texte)?.[1];
      if (rapproches === undefined || nonRapproches === undefined) {
        return `(compteurs illisibles dans le rapport : « ${texte.slice(0, 200)} »)`;
      }
      return `${rapproches} rapprochés / ${nonRapproches} non rapprochés`;
    };

    /**
     * Dépose un CSV et clique « Importer le relevé ». Rien de plus : ce que
     * l'import a produit se lit avec `etatImport`.
     */
    const importer = async (contenu: string, nomFichier: string): Promise<void> => {
      // 🔴 LE SECOND IMPORT PEUT ARRIVER PENDANT QUE LE PREMIER TERMINE.
      //
      // `#import-file` (ImportReleveForm.tsx:184) et `#import-plateforme` (:163)
      // portent tous deux `disabled={isPending}`, et `isPending` ne retombe qu'à
      // la fin de la transition — laquelle englobe le `router.refresh()` (:135).
      // Or le sondage de l'étape 4 sort dès que le rapport est peint. Si React
      // committe `setRapport` avant la fin du rafraîchissement, il existe une
      // fenêtre où le rapport est LISIBLE et les deux champs encore désactivés.
      //
      // 🔑 Sans cette garde, l'échec s'afficherait en « element is not enabled »
      // sur `setInputFiles`, après quinze secondes d'`actionTimeout` — un symptôme
      // qui n'évoque en rien sa cause. On attend donc l'état de repos, et le
      // message le nomme.
      await expect(
        champFichier,
        "le champ de dépôt est resté désactivé : un import précédent est encore en vol " +
          "(`disabled={isPending}`, ImportReleveForm.tsx:184, et la transition englobe le " +
          "`router.refresh()` de :135), ou la page n'est pas hydratée",
      ).toBeEnabled({ timeout: 30_000 });

      // Un `<input type="file">` se remplit par un tampon : on n'écrit pas de
      // fichier sur le disque du poste qui joue le parcours.
      await champFichier.setInputFiles({
        name: nomFichier,
        mimeType: "text/csv",
        buffer: Buffer.from(contenu, "utf8"),
      });

      // 🔑 SANS GARDE, ET C'EST LE CORRECTIF D'UNE « GARDE QUI NE GARDE RIEN ».
      // La version précédente écrivait `if ((await plateforme.count()) > 0)`.
      // Mesuré : `#import-plateforme` est rendu SANS CONDITION dans le même
      // `<form>` que `#import-file` (ImportReleveForm.tsx:159-171, form ouvert
      // :153, fermé :206). La condition ne pouvait jamais être fausse ; et le
      // jour où elle l'aurait été, l'import serait parti en silence sur la
      // valeur par défaut au lieu de rougir.
      await formulaireImport.locator("#import-plateforme").selectOption("zoom");

      // Le bouton porte « Importer le relevé » ; « Importer un relevé de
      // connexion » est le TITRE du bloc (ImportReleveForm.tsx:149-151). Deux
      // textes voisins, un seul est le bouton — et viser le mauvais rend
      // « element(s) not found », qui ressemble à une absence de fonctionnalité
      // alors que c'est une erreur de lecture. Motif ancré : pendant l'action le
      // libellé devient « Import en cours… » (:204).
      const bouton = formulaireImport.getByRole("button", { name: /^Importer le relevé$/ });

      // 🔴 POSER UN FICHIER AVANT L'HYDRATATION NE FAIT RIEN — et ne dit rien.
      //
      // Le `<input type="file">` accepte le fichier au niveau du DOM même si
      // React n'a pas encore attaché son `onChange` : l'état `file` reste nul, le
      // bouton reste `disabled` (:203), et Playwright attend indéfiniment un
      // élément qui ne s'activera jamais. Le symptôme (« element is not
      // enabled » pendant quatre minutes) ne ressemble en rien à sa cause.
      //
      // On exige donc explicitement que le formulaire ait REÇU le fichier. Le
      // message dit ce que l'échec signifie, plutôt que de laisser lire un délai.
      await expect(
        bouton,
        "le bouton d'import ne s'est pas activé après dépôt du fichier — le formulaire " +
          "n'a pas reçu l'événement (page non hydratée, ou fichier refusé en amont)",
      ).toBeEnabled({ timeout: 30_000 });

      await bouton.click();
    };

    // ── 4. CONTRE-TÉMOIN — un relevé qui contient un inconnu doit le DÉNONCER ─
    //
    // 🔑 Sans ce passage, l'assertion « 0 non rapproché » de l'étape 5 serait un
    // vœu : rien ne prouverait qu'elle SAIT rougir. On lui fait donc produire
    // d'abord le verdict opposé, sur le même écran, dans la même exécution.
    //
    // C'est aussi la démonstration de ce qui rendait l'ancien test creux : à cet
    // instant précis, l'écran contient « Marie Martin » ET « Thomas Dubois » —
    // le motif d'origine `/Marie Martin|Thomas Dubois|2 participants?|appari/i`
    // serait VERT ici, où le rapprochement est pourtant incomplet.
    await importer(
      releveZoom([LIGNE_MARIE, LIGNE_THOMAS, LIGNE_INTRUS]),
      "releve-zoom-avec-intrus.csv",
    );

    await expect
      .poll(etatImport, {
        timeout: 120_000,
        message:
          "le relevé contenant un intrus n'a pas été rapporté comme tel. La valeur reçue dit " +
          "laquelle des causes s'est produite : « REFUS: … » = l'action a refusé le fichier " +
          "(format, plateforme, session trop étalée — presence.ts:676-686) ; « aucun rapport » " +
          "= l'action n'a pas abouti ou l'écran n'a pas été repeint ; « 0 rapprochés » = les " +
          "deux inscriptions n'existent plus ou l'appariement par e-mail est cassé " +
          "(match.ts:52-55)",
      })
      .toBe("2 rapprochés / 1 non rapprochés");

    // Le bloc nominatif n'est rendu que si `unmatched.length > 0`
    // (ImportReleveForm.tsx:235-239) : il est ici la PREUVE que la garde de
    // l'étape 5 porte sur un nœud qui existe pour de bon.
    //
    // 🔑 Lecture SCOPÉE au bloc de rapport, comme les autres lectures de ce
    // fichier. Le texte est unique dans `src/` aujourd'hui, donc `page.getByText`
    // serait juste — mais mesurer sur le document entier une chose qui vit dans
    // un bloc déjà nommé deux lignes plus haut, c'est la porte ouverte au jour
    // où un second écran portera le même libellé.
    await expect(
      blocRapport.getByText("Participants non rapprochés"),
      "l'écran ne dénonce pas l'intrus : la liste nominative des non-rapprochés " +
        "(ImportReleveForm.tsx:235-257) est absente alors que le compteur annonce 1 non " +
        "rapproché. Le contre-témoin ne tient plus, et l'assertion « 0 non rapproché » de " +
        "l'étape suivante ne prouverait donc plus rien",
    ).toHaveCount(1);
    await expect(
      blocRapport,
      `l'intrus « ${INTRUS.nom} » n'est pas nommé dans le rapport — un non-rapproché anonyme ` +
        "est inexploitable : l'admin ne peut ni le retrouver, ni l'inscrire",
    ).toContainText(INTRUS.nom);

    // ── 5. LE RELEVÉ PROPRE — deux rapprochés, zéro non rapproché ───────────
    await importer(releveZoom([LIGNE_MARIE, LIGNE_THOMAS]), "releve-zoom.csv");

    await expect
      .poll(etatImport, {
        timeout: 120_000,
        message:
          "les deux inscrits n'ont pas été rapprochés du relevé. C'est l'échec que ce fichier " +
          "existe pour attraper : l'ancienne version le certifiait comme un succès. La valeur " +
          "reçue nomme la cause — « REFUS: … » (action refusée), « 0 rapprochés » (aucun " +
          "inscrit actif : `inscriptionsActives()` filtre les statuts sortis, presence.ts:587), " +
          "ou « 1 non rapproché » (une adresse du relevé ne correspond plus au seed)",
      })
      .toBe("2 rapprochés / 0 non rapprochés");

    // La même garde que ci-dessus, retournée. On sait qu'elle peut rougir :
    // elle vient de le faire, vingt lignes plus haut.
    await expect(
      blocRapport.getByText("Participants non rapprochés"),
      "l'écran affiche encore la liste des non-rapprochés après un relevé qui ne contient que " +
        "des inscrits — c'est l'AVEU D'ÉCHEC de l'import, et c'est exactement le texte que " +
        "l'ancienne version de ce parcours lisait comme une preuve de succès",
    ).toHaveCount(0);

    // ── 6. Les TAUX recalculés portent les durées INDIVIDUELLES du relevé ───
    //
    // 🔴 On lit dans le RÉCAPITULATIF, jamais dans la grille. Après l'import, la
    // grille d'émargement existe elle aussi (les créneaux viennent d'être créés)
    // et elle affiche les mêmes noms et les mêmes adresses
    // (EmargementGrid.tsx:344-352 — l'identité en :346-348, l'adresse en :350 ;
    // :320-335 est l'EN-TÊTE du tableau, pas les noms). Deux tableaux, les
    // mêmes textes : viser
    // « la ligne de Marie » sans dire dans QUEL tableau, c'est la famille de
    // défaut que ce dépôt a déjà payée quatre fois.
    //
    // Le discriminant est la colonne « Qualification », qui n'existe QUE dans le
    // récapitulatif (emargement/page.tsx:291-293 ; unique occurrence du mot dans
    // tout l'écran, vérifiée sur la page et sur les trois composants qu'elle
    // monte). `hasText` compare le texte du DOM, donc la mise en majuscules
    // purement CSS du `<th>` (`uppercase`) ne le gêne pas.
    const recapitulatif = page
      .locator(CONTENU)
      .locator("table")
      .filter({ hasText: "Qualification" });
    await expect(
      recapitulatif,
      "le « Récapitulatif des taux de présence » n'est pas rendu — il est gaté par " +
        "`enrollments.length > 0` (emargement/page.tsx:278), donc son absence signifie que la " +
        "session n'a plus aucun inscrit ACTIF",
    ).toHaveCount(1);

    /**
     * Le taux d'une personne, en pour cent, ou `null` s'il n'est pas encore
     * calculé.
     *
     * On épingle la ligne par l'ADRESSE et non par le nom : deux homonymes sont
     * possibles, deux adresses non (elle est rendue sous le nom dans la première
     * cellule, emargement/page.tsx:311-313). La cellule visée est la 2e —
     * colonne « Taux présence » (:315-321) — qui porte « — » tant que
     * `tauxPresencePct` vaut `null` (:319).
     */
    const lireTauxPct = async (email: string): Promise<number | null> => {
      const ligne = recapitulatif.locator("tbody tr").filter({ hasText: email });
      if ((await ligne.count()) !== 1) return null;
      const cellule = await ligne
        .locator("td")
        .nth(1)
        .innerText({ timeout: 5_000 })
        .catch(() => "");
      const trouve = /(\d+)\s*%/.exec(cellule.replace(/\s+/g, " "));
      return trouve?.[1] === undefined ? null : Number(trouve[1]);
    };

    // 🔴 LECTURE RÉESSAYABLE, et c'est indispensable. Le récapitulatif est un
    // rendu SERVEUR : il ne se met à jour qu'au `router.refresh()` déclenché par
    // le formulaire d'import (ImportReleveForm.tsx:135), alors que le sondage de
    // l'étape 5 sort dès que l'état CLIENT s'affiche. Avant ce rafraîchissement,
    // les deux lignes portent « — » : une lecture unique capterait l'état périmé
    // et conclurait « aucun taux ».
    await expect
      .poll(
        async () => {
          const marie = await lireTauxPct(MARIE.email);
          const thomas = await lireTauxPct(THOMAS.email);
          return `${marie ?? "—"} / ${thomas ?? "—"}`;
        },
        {
          timeout: 120_000,
          message:
            "le récapitulatif n'a pas été re-rendu côté serveur après l'import. « — » signifie " +
            "`tauxPresencePct` encore nul : soit `recomputeTauxPresence` n'a pas tourné " +
            "(presence.ts:905-906), soit la fiche n'a pas été rafraîchie " +
            "(ImportReleveForm.tsx:135). Attendu : deux pourcentages, celui de " +
            `${MARIE.nom} au-dessus de celui de ${THOMAS.nom}`,
        },
      )
      .toMatch(/^\d+ \/ \d+$/);

    // Relecture après stabilisation : le sondage a garanti que les deux valeurs
    // sont des nombres, on peut les comparer.
    const tauxMarie = await lireTauxPct(MARIE.email);
    const tauxThomas = await lireTauxPct(THOMAS.email);

    expect(
      tauxMarie,
      `le taux de ${MARIE.nom} est illisible juste après avoir été lu — la fiche a été ` +
        "repeinte entre les deux lectures",
    ).not.toBeNull();
    expect(
      tauxThomas,
      `le taux de ${THOMAS.nom} est illisible juste après avoir été lu — la fiche a été ` +
        "repeinte entre les deux lectures",
    ).not.toBeNull();

    // 🔑 PREMIER NIVEAU — l'inégalité. Robuste, lisible, et suffisante pour dire
    // qu'une durée individuelle a traversé la chaîne : parse → appariement →
    // répartition sur les demi-journées (repartition-distanciel.ts:112-144) →
    // recalcul du taux (taux.ts:110). Deux taux ÉGAUX signifieraient que l'import
    // a apparié les personnes sans lire leurs minutes.
    expect(
      tauxMarie as number,
      `${MARIE.nom} (${MINUTES_MARIE} min déclarées) devrait ressortir STRICTEMENT au-dessus ` +
        `de ${THOMAS.nom} (${MINUTES_THOMAS} min). Lu : ${String(tauxMarie)} % contre ` +
        `${String(tauxThomas)} %. Deux taux égaux signifient que les durées individuelles du ` +
        "relevé n'ont pas atteint les créneaux, et la preuve de présence distancielle ne vaut " +
        "alors rien",
    ).toBeGreaterThan(tauxThomas as number);

    // 🔑 SECOND NIVEAU — LE RAPPORT DES DEUX TAUX, ET C'EST LUI QUI FAIT MÉRITER
    // SON TITRE AU FICHIER.
    //
    // L'inégalité seule ne distingue pas « la colonne Duration a été lue » de
    // « l'amplitude connexion→déconnexion a été recalculée » : les deux ordonnent
    // Marie au-dessus de Thomas. Le RAPPORT, lui, les sépare — et il ne dépend
    // PAS de la constante produit 7 h/jour, puisque les deux personnes ont la
    // même durée prévue (mêmes créneaux, même journée) et que
    // `taux = round(réalisé / prévu × 100)` (taux.ts:110) :
    //
    //     lecture de « Duration (Minutes) » → 210 / 130 ≈ 1,62
    //     recalcul de `leaveAt − joinAt`    → 210 / 175 ≈ 1,20
    //
    // Tolérance 0,15 : l'arrondi à l'entier des deux taux déplace le rapport
    // d'au plus ~0,03 ici, et les deux hypothèses sont distantes de 0,42.
    const rapportAttendu = MINUTES_MARIE / MINUTES_THOMAS;
    const rapportLu = (tauxMarie as number) / (tauxThomas as number);
    expect(
      Math.abs(rapportLu - rapportAttendu),
      `le rapport des deux taux vaut ${rapportLu.toFixed(2)} (lu : ${String(tauxMarie)} % / ` +
        `${String(tauxThomas)} %), alors que les durées DÉCLARÉES du relevé en prédisent ` +
        `${rapportAttendu.toFixed(2)} (${MINUTES_MARIE} / ${MINUTES_THOMAS}). Trois causes, ` +
        "et la valeur lue les sépare : ≈ 1,20 = l'import a calculé l'amplitude " +
        "`leaveAt − joinAt` au lieu de LIRE la colonne « Duration (Minutes) » " +
        "(parse-zoom.ts:82) ; ≈ 1,00 = les minutes n'ont pas atteint les créneaux du tout ; " +
        "deux taux à 100 % = la durée prévue est tombée sous les 210 min réalisées et le " +
        "réalisé a été PLAFONNÉ (repartition-distanciel.ts:141-144) — dans ce dernier cas le " +
        "défaut est dans la constante `HEURES_PAR_JOUR_DEFAUT` (creneaux.ts:24), pas dans " +
        "l'import, et c'est cette fixture qu'il faut réviser",
    ).toBeLessThan(0.15);

    // ── 7. LA PIÈCE D'ARCHIVE — le relevé PDF, numéroté au registre ─────────
    //
    // 🔴 Ce bouton n'avait JAMAIS été cliqué par aucun test. C'est pourtant la
    // dernière marche de la chaîne distancielle : le relevé de connexion porte,
    // en toutes lettres, qu'« il remplace la feuille d'émargement pour cette
    // session à distance » (ImportReleveForm.tsx:289) — c'est LA pièce qu'un
    // OPCO réclame. Sans elle, l'import calculait le taux et la preuve archivée
    // n'existait pas.
    //
    // Motif ancré : pendant la génération le libellé devient « Génération… »
    // (ImportReleveForm.tsx:282).
    const boutonPdf = blocRapport.getByRole("button", {
      name: /^Générer le relevé de connexion \(PDF\)$/,
    });
    await expect(
      boutonPdf,
      "le bouton de génération du relevé PDF n'est pas offert — il vit DANS le bloc de rapport " +
        "(ImportReleveForm.tsx:263-283), donc son absence signifie que le rapport a disparu",
    ).toBeEnabled({ timeout: 30_000 });
    await boutonPdf.click();

    /**
     * Le résultat de la génération, tel que l'écran le montre.
     *
     * Deux issues possibles, et le sondage doit les distinguer : le succès
     * imprime le NUMÉRO (ImportReleveForm.tsx:284-291), l'échec imprime le
     * message d'erreur de l'action (:292-296). Un message de sondage figé
     * choisirait l'une des deux et mentirait sur l'autre.
     *
     * ⚠️ Le suffixe `-R<nn>` est accepté par le motif : `formatDocumentNumber`
     * l'ajoute quand la pièce est une récurrence (formats.ts:87-92). Il ne
     * devrait pas se produire ici — mais un motif qui l'exclut ferait échouer la
     * lecture d'un numéro pourtant valide, et l'échec accuserait la génération.
     */
    const etatPdf = async (): Promise<string> => {
      const texte = (await blocRapport.innerText({ timeout: 5_000 }).catch(() => "")).replace(
        /\s+/g,
        " ",
      );
      const numero = /Relevé\s+(AXI-DOC-\d{4}-\d+(?:-R\d+)?)\s+généré/.exec(texte)?.[1];
      if (numero !== undefined) return `GÉNÉRÉ: ${numero}`;
      if (texte.includes("Génération…")) return "EN COURS";
      return `PAS DE NUMÉRO — écran : ${texte.slice(0, 300)}`;
    };

    await expect
      .poll(etatPdf, {
        timeout: 120_000,
        message:
          "la génération du relevé de connexion n'a pas rendu de numéro de registre. Le format " +
          "attendu est `AXI-DOC-<année>-<séquence sur 3 chiffres>` (formats.ts:32 + 42 + 87) : " +
          "c'est lui qu'on cite dans un dossier de financement, et le voir est la seule preuve " +
          "que la pièce est entrée au registre. La valeur reçue emporte le texte du bloc : un " +
          "message d'erreur y sera lisible tel quel.",
      })
      .toMatch(/^GÉNÉRÉ: AXI-DOC-\d{4}-\d+(?:-R\d+)?$/);

    // ⚠️ On n'assert NI le lien de téléchargement, NI l'URL du PDF : sans R2
    // configuré, `storeAndSignPdf` rend `null` sans lever (render.ts:72-79). La
    // pièce EST créée et numérotée, mais elle n'a pas d'URL — exiger un lien
    // rendrait ce parcours rouge sur un défaut d'environnement, pas de produit.

    // La trace de bonne fin réclamée par la phase 6. En cas d'ÉCHEC, c'est
    // Playwright qui documente (capture `only-on-failure` + trace au retry,
    // playwright.config.ts:38-40) : cette pièce-ci n'a de sens que sur le vert.
    //
    // `.first()` : `.admin-main` est unique (une seule branche du layout admin le
    // rend, layout.tsx:404 ou :418), mais `innerText` est un appel STRICT — une
    // seconde occurrence ferait échouer la PIÈCE JOINTE au lieu du test.
    await info.attach("ecran-apres-import.txt", {
      body: (await page.locator(CONTENU).first().innerText()).slice(0, 8000),
      contentType: "text/plain",
    });
  });
});
