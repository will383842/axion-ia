/**
 * CLIQUET — aucune preuve d'indicateur ne peut venir d'une session annulée.
 *
 * ## Le défaut (2026-08-24, cahier D1-4)
 *
 * 🔴 `pieceAdmissibleAuDossier()` existe depuis le 2026-08-20 (`D2-5-12`) et
 * exclut deux choses : les pièces annulées, **et les pièces d'une session
 * `annulee` ou `reportee`**. Son en-tête écrit la règle en toutes lettres :
 * « Tout nouveau consommateur appelle cette fonction, jamais ne réécrit son
 * prédicat. »
 *
 * `conformite-service.ts` ne l'importait pas, et réécrivait `annuleeAt: null`
 * **à cinq endroits** — donc sans le filtre de statut de session. Une
 * convocation émise pour une session ensuite **annulée** couvrait l'indicateur
 * 9 ; un émargement d'une session annulée couvrait le 12.
 *
 * 🔑 **La contradiction se voyait sur une seule page.** Le manifeste d'audit
 * prend le *statut* de l'indicateur dans `evaluerConformite()` (non filtré) et
 * la *liste des pièces* via `pieceAdmissibleAuDossier()` (filtré). Il pouvait
 * donc écrire « Indicateur 9 — Couvert » au-dessus d'une rubrique
 * « Documents » **vide**.
 *
 * C'est la forme récurrente de ce dépôt : une règle écrite et justifiée à un
 * endroit, appliquée à un site, oubliée sur son jumeau.
 *
 * ## Pourquoi ce fichier balaye au lieu d'énumérer
 *
 * La garde qui existait (`audit-dossier.spec.ts`) lisait **un seul fichier, en
 * dur** : `audit-dossier.ts`. Les cinq littéraux de `conformite-service.ts`
 * étaient hors de sa portée — une garde nommant son unique cible ne pouvait pas
 * voir le jumeau. Celle-ci balaye **tout le domaine**, et un sixième
 * consommateur écrit demain serait vu sans qu'on touche à ce fichier.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RACINE = join(process.cwd(), "src", "server", "qualiopi");

/**
 * Les domaines qui produisent des VERDICTS de conformité — c'est-à-dire ceux
 * dont les comptes deviennent la réponse donnée au certificateur.
 *
 * ⚠️ Volontairement pas « tout `src/` » : `rgpd-service` compte délibérément les
 * lignes annulées (il doit purger leurs images et les rendre à l'export art. 15),
 * et le registre des pièces DOIT montrer les annulations avec leur motif. La
 * règle porte sur ce qui PROUVE, pas sur ce qui inventorie.
 */
const DOMAINES_DE_PREUVE = ["conformite", "indicateurs"] as const;

/** Tous les `.ts` de production d'un domaine (specs et tests exclus). */
function sourcesDe(domaine: string): string[] {
  const dossier = join(RACINE, domaine);
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) continue;
    if (!entree.endsWith(".ts")) continue;
    if (entree.includes(".spec.") || entree.includes(".test.")) continue;
    trouves.push(chemin);
  }
  return trouves;
}

/**
 * Le code seul, commentaires de LIGNE écartés.
 *
 * ⚠️ On n'enlève PAS les blocs `/* … *\/` par expression régulière : sur un
 * fichier qui contient lui-même des motifs entre guillemets, l'appariement se
 * déphase et emporte du vrai code. Ce dépôt a déjà payé un test statique qui
 * accusait ses propres commentaires.
 */
function codeSeul(chemin: string): string {
  return readFileSync(chemin, "utf-8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !l.startsWith("*") && !l.startsWith("//") && !l.startsWith("/*"))
    .join("\n");
}

describe("aucune preuve d'indicateur ne vient d'une session annulée", () => {
  it("le prédicat partagé existe encore et exclut bien les deux statuts", async () => {
    // 🔑 CONTRE-TÉMOIN n° 1. Tout ce fichier repose sur l'idée que
    // `pieceAdmissibleAuDossier()` est le bon prédicat. S'il cessait d'exclure
    // les sessions annulées, les tests suivants resteraient verts en exigeant
    // qu'on appelle une fonction devenue inoffensive.
    // ⚠️ On importe le module PUR, jamais `audit-dossier.ts` : celui-ci tire
    // toute la chaîne d'authentification et ne peut pas se charger dans un test
    // unitaire. C'est précisément pourquoi le prédicat en a été extrait.
    const { pieceAdmissibleAuDossier } =
      await import("@/server/qualiopi/conformite/piece-admissible");
    const predicat = pieceAdmissibleAuDossier();

    expect(predicat.annuleeAt, "le prédicat n'exclut plus les pièces annulées").toBeNull();

    const exclus = predicat.OR[1].session.statut.notIn;
    for (const statut of ["annulee", "reportee"] as const) {
      expect(
        exclus,
        `« ${statut} » n'est plus exclu du prédicat partagé : les pièces d'une ` +
          `session qui n'a pas eu lieu redeviennent des preuves d'indicateur.`,
      ).toContain(statut);
    }

    // L'admission des pièces SANS session est un arbitrage explicite, pas un
    // oubli : les procédures, registres et lettres-cadres n'ont pas de session
    // et sont précisément ce que la moitié des indicateurs réclame.
    expect(
      predicat.OR[0],
      "les pièces générales de l'organisme ne sont plus admises : le dossier se " +
        "viderait de ses procédures et registres.",
    ).toEqual({ sessionId: null });
  });

  it("aucun fichier de preuve ne réécrit le prédicat à la main", () => {
    // Le cœur du cliquet. Un littéral `annuleeAt: null` dans un `where` est
    // toujours un prédicat recopié — et un prédicat recopié diverge. Ce dépôt
    // l'a payé quatre fois, dont une où une alerte critique partait chaque nuit
    // sur des pièces annulées.
    const fautifs: string[] = [];
    for (const domaine of DOMAINES_DE_PREUVE) {
      for (const chemin of sourcesDe(domaine)) {
        const source = codeSeul(chemin);
        // ⚠️ Le motif ne vise que les requêtes RACINE — `prisma.documentGenere.x`.
        //
        // Une relation IMBRIQUÉE (`documentsGeneres: { where: … }` à l'intérieur
        // d'un `findUnique` de session) est déjà scopée à une session précise :
        // lui appliquer le prédicat partagé, qui admet volontairement
        // `sessionId: null`, n'aurait aucun sens. Enveloppe lue avant d'accuser —
        // le filtre littéral y est correct et suffisant.
        const litteraux =
          source.match(/prisma\.documentGenere\.\w+\(\s*\{[\s\S]{0,300}?annuleeAt:\s*null/g) ?? [];
        if (litteraux.length > 0) {
          fautifs.push(`${chemin.slice(RACINE.length + 1)} — ${litteraux.length} littéral(aux)`);
        }
      }
    }

    expect(
      fautifs,
      "prédicat d'admissibilité RECOPIÉ à la main au lieu d'appeler " +
        "`pieceAdmissibleAuDossier()`. Un littéral `annuleeAt: null` n'exclut que " +
        "les pièces annulées — PAS les pièces d'une session annulée ou reportée. " +
        "C'est le défaut du 2026-08-24 : une convocation émise pour une session " +
        "ensuite annulée couvrait l'indicateur 9 devant le certificateur.",
    ).toEqual([]);
  });

  it("le contre-témoin : le balayage voit réellement les fichiers", () => {
    // 🔑 CONTRE-TÉMOIN n° 2, et il n'est pas décoratif. Si `sourcesDe` cessait
    // de trouver quoi que ce soit — dossier renommé, filtre trop strict — le
    // test précédent rendrait une liste vide de fautifs et passerait au vert
    // sans avoir examiné un seul fichier. C'est la panne exacte que ce dépôt a
    // payée cinq fois.
    const total = DOMAINES_DE_PREUVE.flatMap((d) => sourcesDe(d));
    expect(
      total.length,
      "le balayage ne trouve plus aucun fichier de production dans les domaines " +
        "de preuve : le test précédent ne garde plus rien.",
    ).toBeGreaterThanOrEqual(3);

    // Et il doit voir le fichier qui portait le défaut.
    expect(
      total.some((f) => f.endsWith("conformite-service.ts")),
      "`conformite-service.ts` n'est plus balayé — c'est pourtant le fichier qui " +
        "portait les cinq prédicats recopiés.",
    ).toBe(true);
  });

  it("le contre-témoin : le motif reconnaîtrait bien un prédicat recopié", () => {
    // 🔑 CONTRE-TÉMOIN n° 3. Le motif du test central est une expression
    // régulière ; si elle cessait de reconnaître la forme qu'elle traque, elle
    // rendrait zéro fautif sur un fichier plein de littéraux.
    const faux = [
      "prisma.documentGenere.count({ where: { annuleeAt: null } }),",
      "prisma.documentGenere.count({",
      "  where: {",
      '    type: { in: ["convocation"] },',
      "    annuleeAt: null,",
      "  },",
      "}),",
      // Et la forme qui NE doit PAS être comptée : une relation imbriquée, déjà
      // scopée à une session par le `findUnique` qui la porte. Si elle était
      // comptée, la garde exigerait un prédicat qui n'a pas de sens à cet
      // endroit — et on « corrigerait » du code juste pour la faire taire.
      "documentsGeneres: { where: { annuleeAt: null } },",
    ].join("\n");

    const trouves =
      faux.match(/prisma\.documentGenere\.\w+\(\s*\{[\s\S]{0,300}?annuleeAt:\s*null/g) ?? [];
    expect(
      trouves.length,
      "le motif ne reconnaît plus un prédicat recopié sur une requête racine — " +
        "ni sur une ligne ni sur plusieurs — ou bien il s'est mis à compter les " +
        "relations imbriquées, qui sont déjà scopées à une session. Dans les deux " +
        "cas, le test central ne mesure plus la bonne chose.",
    ).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LE CLIQUET DÉRIVÉ DU SCHÉMA — 2026-08-25, cahier D1-2
//
// 🔴 Pourquoi il a fallu en écrire un second au-dessus du premier.
//
// Le cliquet ci-dessus a été écrit le 2026-08-24 pour empêcher qu'une preuve
// vienne d'une session annulée. Il a manqué son jumeau le jour même, et pour
// deux raisons cumulées :
//
//  1. **Il NOMME sa cible unique** — `prisma.documentGenere.*`. Les trois
//     requêtes `prisma.enrollment.*` du MÊME fichier, dont une à cinq lignes de
//     la ligne corrigée, étaient hors de sa portée. C'est mot pour mot le
//     reproche que son propre en-tête adresse à son prédécesseur : « une garde
//     nommant son unique cible ne pouvait pas voir le jumeau ».
//  2. **Il ne cherche que l'ANCIEN MOTIF FAUTIF** (`annuleeAt: null` en
//     littéral), pas l'ABSENCE de garde. Les sites `enrollment` n'avaient aucun
//     filtre du tout : ils ne ressemblaient même pas à ce qu'il traquait.
//
// Celui-ci ne nomme aucun modèle. Il DÉRIVE DU SCHÉMA PRISMA la classe « une
// ligne de cette table appartient à une session », et exige que toute lecture
// racine d'une telle table, dans un domaine de preuve, contraigne la session.
// Un douzième modèle ajouté demain au schéma y entre sans que personne touche à
// ce fichier.
//
// ⚠️ CE QU'IL NE GARDE PAS — dit ici plutôt que découvert plus tard.
//
// Il attrape « la session est ENTIÈREMENT oubliée ». Il n'attrape PAS « la
// session est contrainte, mais pas par son STATUT ». `conformite-service.ts:472`
// en est l'instance connue : elle écrit `session: { dateDebut: { lte: … } }`,
// donc elle passe — et elle compte pourtant les inscrits de sessions annulées
// au DÉNOMINATEUR d'off.4 ⭐ et off.8.
//
// Ce n'est pas un oubli : durcir la règle jusqu'au statut ferait rougir
// `indicateurs/service.ts` et `pilotage-service.ts`, qui contraignent la session
// autrement et correctement. Et surtout, corriger `:472` rendrait un indicateur
// PLUS FACILE à satisfaire — la seule direction où se tromper masque une
// non-conformité réelle le jour de l'audit. Elle est donc mesurée, écrite au
// cahier D1-2 § 5, et laissée à l'arbitrage. Une garde qui prétendrait la couvrir
// serait une garde qui ment.
// ─────────────────────────────────────────────────────────────────────────────

describe("cliquet dérivé du schéma — toute preuve session-scopée contraint sa session", () => {
  const SCHEMA = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");

  /**
   * Les modèles dont CHAQUE LIGNE appartient à une session de formation.
   *
   * Dérivés de deux conditions cumulatives, et pas d'une liste écrite à la main :
   * le modèle porte une relation `session TrainingSession` ET un scalaire
   * `sessionId`. La seconde condition écarte les relations INVERSES — `Client`,
   * `Formation` et `Trainer` portent un `TrainingSession[]` sans être
   * session-scopés, et les compter ici aurait fabriqué des défauts.
   *
   * ⚠️ Elle écarte aussi `FunnelEvent`, qui porte un `sessionId` DE NAVIGATEUR
   * sans aucun rapport avec une session de formation. Un motif qui n'aurait
   * cherché que `sessionId` l'aurait accusé à tort.
   */
  function modelesSessionScopes(): string[] {
    const modeles = SCHEMA.match(/^model \w+ \{[\s\S]*?^\}/gm) ?? [];
    const trouves: string[] = [];
    for (const bloc of modeles) {
      const nom = /^model (\w+) \{/.exec(bloc)?.[1];
      if (nom == null) continue;
      if (!/^\s+session\s+TrainingSession/m.test(bloc)) continue;
      if (!/^\s+sessionId\s+String\??\s/m.test(bloc)) continue;
      trouves.push(nom);
    }
    return trouves;
  }

  /** Nom d'accès du client Prisma : `DocumentGenere` → `documentGenere`. */
  const accesseur = (modele: string): string => modele.charAt(0).toLowerCase() + modele.slice(1);

  /**
   * Une lecture racine contraint-elle sa session ?
   *
   * Quatre formes sont acceptées, et chacune existe dans le code réel : les deux
   * prédicats partagés, une contrainte `session:` quelle qu'elle soit
   * (`session: { statut: "realisee" }` est PLUS strict que d'exclure les
   * annulées), et un scopage direct par `sessionId`.
   *
   * 🔴 `sessionId\s*[,:}]` et NON `sessionId:` — la forme ABRÉGÉE
   * `{ sessionId, … }` est celle de `dossier-session.ts:402`, et un motif qui
   * n'aurait cherché que les deux-points l'aurait déclarée fautive. Ce dépôt a
   * déjà payé ce piège ; il a été repayé en écrivant ce cliquet même.
   */
  function contraintSaSession(extrait: string): boolean {
    return (
      extrait.includes("pieceAdmissibleAuDossier") ||
      extrait.includes("inscriptionSurSessionTenue") ||
      /\bsession:\s/.test(extrait) ||
      /\bsessionId\s*[,:}]/.test(extrait)
    );
  }

  interface Lecture {
    readonly emplacement: string;
    readonly extrait: string;
  }

  /**
   * Comme `codeSeul`, mais en PRÉSERVANT le nombre de lignes.
   *
   * 🔴 `codeSeul` supprime les lignes de commentaire : les numéros calculés sur
   * son rendu ne désignent PAS le fichier réel. Ce cliquet-ci rapporte un
   * `fichier:ligne` que l'on doit pouvoir ouvrir — et sa dette déclarée est
   * indexée dessus. Les commentaires sont donc VIDÉS, pas retirés.
   */
  function codeSeulLignesPreservees(chemin: string): string {
    return readFileSync(chemin, "utf-8")
      .replace(/\/\*[\s\S]*?\*\//g, (bloc) => bloc.replace(/[^\n]/g, " "))
      .split(/\r?\n/)
      .map((l) => (l.trim().startsWith("//") ? "" : l))
      .join("\n");
  }

  /**
   * Le texte d'UN SEUL appel — de sa parenthèse ouvrante à sa fermante.
   *
   * 🔴 Ce cliquet a d'abord découpé une fenêtre de 400 caractères après le nom
   * de la méthode. **Il ne rougissait pas sur le défaut qu'il prétendait
   * garder** : la fenêtre débordait sur la requête SUIVANTE du même
   * `Promise.all`, et y trouvait le `pieceAdmissibleAuDossier()` du voisin. Le
   * site nu de la ligne 209 était donc déclaré gardé par la ligne 214 — c'est-
   * à-dire par la garde qu'il venait justement de manquer.
   *
   * 🔑 Le défaut n'a été vu que parce que la discipline impose de faire ROUGIR
   * la garde sur le code d'avant. Elle est restée verte, et c'est cela qui l'a
   * dénoncée. Une garde qu'on n'a jamais vue rougir ne garde rien — y compris
   * quand c'est la garde d'une garde.
   */
  function extraitDeLAppel(source: string, indexOuvrante: number): string {
    let profondeur = 0;
    for (let i = indexOuvrante; i < source.length; i += 1) {
      const c = source[i];
      if (c === "(") profondeur += 1;
      else if (c === ")") {
        profondeur -= 1;
        if (profondeur === 0) return source.slice(indexOuvrante, i + 1);
      }
    }
    // Parenthèses non appariées : on rend tout le reste plutôt que rien, pour
    // ne pas transformer une source malformée en faux vert silencieux.
    return source.slice(indexOuvrante);
  }
  function lecturesRacine(): Lecture[] {
    const lectures: Lecture[] = [];
    const accesseurs = modelesSessionScopes().map(accesseur);
    for (const domaine of DOMAINES_DE_PREUVE) {
      for (const chemin of sourcesDe(domaine)) {
        const source = codeSeulLignesPreservees(chemin);
        for (const acc of accesseurs) {
          const motif = new RegExp(`prisma\\.${acc}\\.\\w+\\(`, "g");
          let m = motif.exec(source);
          while (m !== null) {
            const ligne = source.slice(0, m.index).split("\n").length;
            lectures.push({
              emplacement: `${chemin.slice(RACINE.length + 1).replace(/\\/g, "/")}:${ligne}`,
              extrait: extraitDeLAppel(source, m.index + m[0].length - 1),
            });
            m = motif.exec(source);
          }
        }
      }
    }
    return lectures;
  }

  /** Les lectures racine qui ne contraignent RIEN — le défaut que l'on traque. */
  function lecturesNues(): string[] {
    return lecturesRacine()
      .filter((l) => !contraintSaSession(l.extrait))
      .map((l) => l.emplacement);
  }

  /**
   * ⚠️ LA DETTE DÉCLARÉE — une seule ligne, et elle doit RÉTRÉCIR, jamais grandir.
   *
   * `pilotage-service.ts` compte les documents produits sur une période
   * (`createdAt: plage`) pour le tableau de PILOTAGE. Ce n'est pas une preuve
   * d'indicateur : c'est un volume de production, et un document annulé a bien
   * été produit. L'en-tête de ce fichier pose déjà la distinction — « la règle
   * porte sur ce qui PROUVE, pas sur ce qui inventorie ».
   *
   * Il est exempté NOMMÉMENT plutôt qu'écarté par une règle floue, pour que
   * l'exemption se voie et se discute. Toute nouvelle lecture nue est refusée.
   */
  // ⚠️ 2026-08-27 : 247 → 271. La ligne n'a pas changé de nature, elle a été
  // POUSSÉE de 24 lignes par l'ajout des motifs d'abandon (M4). Une dette
  // indexée sur un numéro de ligne rougit à chaque édition située au-dessus
  // d'elle — le rouge est alors juste, mais il ne désigne pas ce qu'on croit.
  // 🔑 Lire l'EXTRAIT rapporté avant de conclure à une régression.
  const DETTE_DECLAREE: ReadonlyArray<string> = ["conformite/pilotage-service.ts:271"];

  it("CONTRE-TÉMOIN : la classe est bien dérivée du schéma, et elle n'est pas vide", () => {
    const modeles = modelesSessionScopes();
    expect(
      modeles.length,
      "aucun modèle session-scopé dérivé du schéma : le motif est cassé, et le " +
        "test central ne garde plus rien.",
    ).toBeGreaterThanOrEqual(8);

    // Les deux modèles qui ont PORTÉ le défaut doivent être dans la classe.
    expect(modeles).toContain("Enrollment");
    expect(modeles).toContain("DocumentGenere");

    // Et les relations INVERSES doivent en être exclues, sinon la garde
    // accuserait du code correct.
    expect(modeles).not.toContain("Client");
    expect(modeles).not.toContain("Formation");
    expect(modeles).not.toContain("Trainer");
    // `FunnelEvent` porte un `sessionId` de NAVIGATEUR : rien à voir.
    expect(modeles).not.toContain("FunnelEvent");
  });

  it("CONTRE-TÉMOIN : le balayage voit réellement des lectures", () => {
    expect(
      lecturesRacine().length,
      "aucune lecture racine trouvée sur un modèle session-scopé : le test " +
        "central passerait au vert sans rien examiner.",
    ).toBeGreaterThanOrEqual(15);
  });

  it("CONTRE-TÉMOIN : le détecteur reconnaît les quatre gardes, et refuse l'absence", () => {
    // Sans ceci, `contraintSaSession` pourrait cesser de reconnaître une forme
    // et déclarer fautif du code correct — ou pire, tout accepter.
    expect(
      contraintSaSession("prisma.documentGenere.count({ where: pieceAdmissibleAuDossier() })"),
    ).toBe(true);
    expect(
      contraintSaSession("prisma.enrollment.count({ where: { ...inscriptionSurSessionTenue() } })"),
    ).toBe(true);
    expect(
      contraintSaSession(
        'prisma.enrollment.findMany({ where: { session: { statut: "realisee" } } })',
      ),
    ).toBe(true);
    // La forme ABRÉGÉE — le piège repayé en écrivant ce cliquet.
    expect(
      contraintSaSession(
        "prisma.documentGenere.findMany({ where: { sessionId, annuleeAt: null } })",
      ),
    ).toBe(true);
    // Et l'absence pure, qui est le défaut du 2026-08-25.
    expect(
      contraintSaSession(
        "prisma.enrollment.count({ where: { emargementSigneAt: { not: null } } })",
      ),
    ).toBe(false);
  });

  it("aucune lecture de preuve session-scopée ne s'affranchit de sa session", () => {
    const nonDeclarees = lecturesNues().filter((e) => !DETTE_DECLAREE.includes(e));

    expect(
      nonDeclarees,
      "lecture RACINE d'une table dont chaque ligne appartient à une session, " +
        "SANS aucune contrainte sur cette session. Une inscription ou une pièce " +
        "d'une session ANNULÉE devient alors une preuve d'indicateur, et le " +
        "manifeste d'audit écrit « Couvert » au-dessus d'une rubrique vide. " +
        "Appeler `inscriptionSurSessionTenue()` (modèle à `sessionId` obligatoire) " +
        "ou `pieceAdmissibleAuDossier()` (modèle à `sessionId` optionnel).",
    ).toEqual([]);
  });

  it("la dette déclarée ne grandit pas, et aucune de ses lignes n'est périmée", () => {
    // Une exemption qui ne correspond plus à rien est PIRE qu'aucune exemption :
    // elle donne à croire qu'un défaut est connu et suivi alors que le code a
    // bougé sous elle. Chaque ligne doit encore désigner une lecture réellement
    // nue.
    const nues = lecturesNues();
    for (const declaree of DETTE_DECLAREE) {
      expect(
        nues,
        `« ${declaree} » est déclarée en dette mais n'est plus une lecture nue — ` +
          "soit elle a été corrigée et la ligne doit disparaître, soit elle a " +
          "bougé et la ligne ne désigne plus rien.",
      ).toContain(declaree);
    }

    expect(
      DETTE_DECLAREE.length,
      "la dette déclarée a grandi. Elle ne doit que rétrécir : une nouvelle " +
        "lecture nue se corrige, elle ne s'inscrit pas.",
    ).toBeLessThanOrEqual(1);
  });
});
