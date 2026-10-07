/**
 * scripts/gates/cliquet-ecrivains.ts — le cliquet des ÉCRIVAINS d'un fait émis vers Axion
 * Partners (INT-T04, REQ-INT-007 ; conçu pour INT-T03, T05, T22).
 *
 * « Un événement UNIQUE est produit quel que soit le chemin par lequel l'état est atteint : tous
 * les écrivains de cet état passent par la fonction d'émission unique. » Les tests prouvent
 * l'émission des écrivains d'AUJOURD'HUI. Ce cliquet empêche qu'un écrivain de DEMAIN y échappe :
 * il lit le code (AST TypeScript), ÉNUMÈRE chaque écriture Prisma qui pose l'état sur le modèle,
 * et la confronte, une par une, à trois exigences :
 *
 *   E1  la fonction qui ENGLOBE l'écriture (la plus proche) appelle la fonction d'émission ;
 *   E2  avec, en premier argument, le client même qui écrit (`tx.devis.update` → `emettre…(tx, …)`) :
 *       une écriture sur le client global à côté d'une émission sur `tx` est hors transaction ;
 *   E3  cette fonction est le travail d'une transaction : argument d'un appel `$transaction(…)` ou
 *       d'une enveloppe déclarée (`transactionDevisSigne(…)`).
 *
 *   E0  Une écriture qui pose le champ de l'état avec une valeur NON LITTÉRALE est indécidable :
 *       elle est refusée comme une faute. Un écrivain qu'on ne sait pas lire est un écrivain
 *       qu'on ne sait pas garder.
 *
 * L'identité d'un écrivain est `fichier:ligne (fonction englobante)`. Le vert IMPRIME chaque
 * écrivain confronté : un écrivain ajouté est une ligne de plus, jamais un compte qu'on ajuste.
 * Zéro écrivain pour une règle est une PANNE DE MESURE, et rougit.
 *
 * ── Ajouter un fait ───────────────────────────────────────────────────────────────────────────
 * Une entrée de plus dans `REGLES` : le modèle (accesseur Prisma), le champ, la ou les valeurs de
 * l'état, la fonction d'émission, les enveloppes de transaction admises. Rien d'autre à écrire.
 *
 * Deux champs FACULTATIFS (INT-T05), chacun une règle écrite, jamais une liste d'exceptions :
 *   · `horsFait` — une écriture dont les données posent, EN LITTÉRAL, un marqueur qui dit
 *     « ceci n'est pas un fait du contrat » (`estImportee: true` : une facture reprise
 *     d'historique, émise hors du système). Elle est IMPRIMÉE comme classée, jamais tue.
 *   · `sansEcrivainMesure` — un fait dont le dépôt n'a, mesuré, AUCUN écrivain aujourd'hui.
 *     La règle garde l'écrivain de demain ; zéro n'est alors pas une panne de mesure.
 *
 * Un troisième (INT-T22) : `cleJson`, pour un état qui n'est pas une colonne mais une CLÉ d'un
 * champ Json (`submission.details.pretASignerAt`). `data: { details }` y est presque toujours
 * une variable : lire la valeur écrite est impossible, et refuser toute écriture de `details`
 * rougirait sur des écrivains qui ne touchent pas la clé. Le cliquet suit donc la CLÉ, partout
 * où elle se CONSTRUIT dans `src/` :
 *   · une propriété d'objet littéral `cle: …` (ou `cle,`) — la marque posée dans un objet ;
 *   · une affectation `x.cle = …` / `x["cle"] = …` ;
 * et chacune est un écrivain, confronté à E1-E3 (E2 : un `<client>.<modele>.<écriture>(…)` dans
 * la même fonction, et l'émission sur ce client). Le littéral `"cle"` hors de ces formes et
 * hors d'une LECTURE (`x["cle"]` lu, `"cle" in x`, `path: ["cle"]`, un type) est E0 : une clé
 * qui circule dans une variable finira dans un `details[variable] = …` qu'on ne sait pas suivre.
 * Conséquence assumée : un LECTEUR n'expose jamais la clé sous son propre nom dans un objet.
 *
 * Un quatrième (INT-T03) : `champsTransmis`, pour un fait qui n'est pas UN état mais « la charge
 * a changé » (`client.cree` / `client.mis_a_jour`). Est alors un écrivain :
 *   · toute CRÉATION (`create`, `createMany`, `upsert`…) — créer une fiche est le fait ;
 *   · toute mise à jour dont les données posent l'un des champs listés, QUELLE QUE SOIT la valeur,
 *     ou qu'on ne sait pas lire (une variable, un étalement opaque) : l'illisible est PRÉSUMÉ
 *     toucher la charge. Une variable `const x = { … }` d'une portée englobante est lue.
 * Une mise à jour dont les données, lues, ne posent AUCUN champ listé n'est pas un fait : elle
 * est IMPRIMÉE, classée « aucun champ transmis » (`horsChampsTransmis`), jamais tue. C'est une
 * règle, pas une liste d'exceptions : ajouter un champ transmis à une telle écriture la fait
 * basculer d'elle-même parmi les écrivains. Et `tableSql` : une écriture SQL brute (`INSERT
 * INTO` / `UPDATE`) sur la table est indécidable (E0) — le cliquet ne lit pas le SQL.
 *
 * Lancement : `pnpm partners:cliquet-ecrivains`. Témoin à deux faces :
 * `tests/unit/ci/cliquet-ecrivains-devis.spec.ts`.
 */
import fs from "node:fs";
import path from "node:path";

import ts from "typescript";

export type Sources = ReadonlyMap<string, string>;

export type RegleEcrivain = {
  /** Le type d'événement du contrat. */
  readonly evenement: string;
  /** L'accesseur Prisma du modèle : `devis` dans `tx.devis.update(…)`. */
  readonly modele: string;
  /** Le champ qui porte l'état. */
  readonly champ: string;
  /** Les valeurs du champ qui FONT le fait. */
  readonly valeurs: readonly string[];
  /**
   * Vrai quand POSER le champ, quelle que soit sa valeur, fait le fait : une date, un montant.
   * `valeurs` n'est alors lu que pour le message.
   */
  readonly touteValeur?: true;
  /** L'unique fonction d'émission. */
  readonly emission: string;
  /** Les appels dont le travail (la fonction passée en argument) est transactionnel. */
  readonly transactions: readonly string[];
  /** Le marqueur littéral d'une écriture qui n'est pas un fait du contrat, et pourquoi. */
  readonly horsFait?: {
    readonly champ: string;
    readonly valeur: string | boolean;
    readonly motif: string;
  };
  /** Zéro écrivain MESURÉ aujourd'hui : la règle garde l'avenir. Le texte dit la mesure. */
  readonly sansEcrivainMesure?: string;
  /**
   * L'état est une CLÉ du champ Json `champ` : poser cette clé, quelle que soit sa valeur, fait
   * le fait. Le cliquet suit la clé, pas l'écriture de `champ` (voir l'en-tête).
   */
  readonly cleJson?: string;
  /**
   * Le fait est la création, ou la pose de L'UN de ces champs (voir l'en-tête). `champ` n'est
   * alors lu que pour le message.
   */
  readonly champsTransmis?: readonly string[];
  /** La table SQL du modèle : une écriture brute qui la vise est E0. */
  readonly tableSql?: string;
};

const TRANSACTIONS_FACTURATION = ["$transaction", "transactionFaitFacturation"] as const;

/** La facture reprise d'historique : émise HORS du système, elle n'est pas un fait d'axionia. */
const FACTURE_IMPORTEE = {
  champ: "estImportee",
  valeur: true,
  motif:
    "facture reprise d'historique (importerFacturesHistoriqueAction) : émise hors du système, " +
    "classée sans numéro de la série légale — aucun fait d'axionia",
} as const;

export const REGLES: readonly RegleEcrivain[] = [
  {
    evenement: "devis.signe",
    modele: "devis",
    champ: "statut",
    valeurs: ["accepte"],
    emission: "emettreDevisSigne",
    transactions: ["$transaction", "transactionDevisSigne"],
  },
  // INT-T46-A : un devis posé `envoye` émet `devis.emis` (contrat v3), dans la transaction de l'envoi.
  {
    evenement: "devis.emis",
    modele: "devis",
    champ: "statut",
    valeurs: ["envoye"],
    emission: "emettreDevisEmis",
    transactions: ["$transaction"],
  },
  // INT-T05. Une pièce posée `emise` est une facture OU un avoir : c'est la ligne (`avoirDeId`)
  // qui décide, dans `emettreFaitFacture`. Une seule règle garde donc les deux faits.
  // Ne SONT PAS des faits, et la règle les laisse passer parce qu'ils ne posent pas `emise` :
  // le brouillon (`brouillon`), le retard (`en_retard`, cron), l'encaissement partiel ou total
  // (`partiellement_payee`, `payee` : le fait est l'encaissement, gardé plus bas), le PDF
  // (`documentId`) et l'échéance réparée (`echeanceAt`).
  {
    evenement: "facture.emise|avoir.emis",
    modele: "factureFormation",
    champ: "statut",
    valeurs: ["emise"],
    emission: "emettreFaitFacture",
    transactions: TRANSACTIONS_FACTURATION,
    horsFait: FACTURE_IMPORTEE,
  },
  {
    evenement: "facture.annulee",
    modele: "factureFormation",
    champ: "statut",
    valeurs: ["annulee"],
    emission: "emettreFactureAnnulee",
    transactions: TRANSACTIONS_FACTURATION,
    horsFait: FACTURE_IMPORTEE,
    sansEcrivainMesure:
      "2026-09-29 : aucune écriture de src/ ne pose factureFormation.statut = annulee",
  },
  // L'échéance du financeur fait partie de la charge de CHAQUE facture du dossier : la poser,
  // quelle que soit la date, est un fait pour chacune.
  {
    evenement: "financement.mis_a_jour",
    modele: "dossierFinancement",
    champ: "echeanceFinanceurAt",
    valeurs: ["<toute date>"],
    touteValeur: true,
    emission: "emettreFinancementMisAJour",
    transactions: TRANSACTIONS_FACTURATION,
  },
  // Un `Payment` `succeeded` est un encaissement — ou, de type `refund`, une annulation
  // d'encaissement : `emettreFaitPaiement` lit la ligne et choisit. `pending`, `failed`,
  // `cancelled` ne sont pas des faits.
  {
    evenement: "paiement.recu",
    modele: "payment",
    champ: "status",
    valeurs: ["succeeded"],
    emission: "emettreFaitPaiement",
    transactions: TRANSACTIONS_FACTURATION,
  },
  {
    evenement: "paiement.rembourse",
    modele: "payment",
    champ: "status",
    valeurs: ["refunded"],
    emission: "emettreFaitPaiement",
    transactions: TRANSACTIONS_FACTURATION,
    sansEcrivainMesure:
      "2026-09-29 : aucune écriture de src/ ne pose payment.status = refunded " +
      "ni ne crée de Payment de type refund",
  },
  // INT-T22, ADR 0051 §c : le fait part au clic console « prêt à signer », qui pose la marque
  // `details.pretASignerAt` — JAMAIS à l'écriture de la Submission par le tunnel.
  {
    evenement: "candidature.recue",
    modele: "submission",
    champ: "details",
    valeurs: ["<clé pretASignerAt posée>"],
    cleJson: "pretASignerAt",
    emission: "emettreCandidatureRecue",
    transactions: ["$transaction"],
  },
  // INT-T03, REQ-INT-007. La même liste que `CHAMPS_CLIENT_TRANSMIS`
  // (`src/server/partners-sync/producteurs/client.ts`) : un test tient les deux égales.
  {
    evenement: "client.cree|client.mis_a_jour",
    modele: "client",
    champ: "<champ transmis>",
    valeurs: ["<création, ou tout champ transmis posé>"],
    touteValeur: true,
    champsTransmis: [
      "numero",
      "type",
      "raisonSociale",
      "siren",
      "siret",
      "nafCode",
      "secteur",
      "taille",
    ],
    tableSql: "clients",
    emission: "emettreFaitClient",
    transactions: ["$transaction"],
  },
];

/** Les méthodes de création : sous `champsTransmis`, chacune est un fait. */
const METHODES_DE_CREATION: readonly string[] = [
  "create",
  "createMany",
  "createManyAndReturn",
  "upsert",
];

/** Les méthodes Prisma qui écrivent, et les clés de leur argument qui portent les données. */
const METHODES_D_ECRITURE: Readonly<Record<string, readonly string[]>> = {
  create: ["data"],
  createMany: ["data"],
  createManyAndReturn: ["data"],
  update: ["data"],
  updateMany: ["data"],
  updateManyAndReturn: ["data"],
  upsert: ["create", "update"],
};

export type Ecrivain = {
  readonly evenement: string;
  readonly fichier: string;
  readonly ligne: number;
  readonly fonction: string;
};

export type Faute = Ecrivain & {
  readonly regle: "E0" | "E1" | "E2" | "E3";
  readonly detail: string;
};

export type Bilan = {
  readonly ecrivains: Ecrivain[];
  readonly fautes: Faute[];
  /** Les écritures que le marqueur `horsFait` de leur règle classe hors du contrat. */
  readonly horsFait: Ecrivain[];
  /** Sous `champsTransmis` : les mises à jour lues qui ne posent aucun champ transmis. */
  readonly horsChampsTransmis: Ecrivain[];
  /** Par événement : le nombre d'écrivains confrontés. */
  readonly parEvenement: Record<string, number>;
};

const normal = (p: string) => p.replace(/\\/g, "/");
const estTest = (p: string) => /\/__tests__\/|\.(spec|test)\.tsx?$/.test(p);

type FonctionLike =
  ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction | ts.MethodDeclaration;

function estFonction(n: ts.Node): n is FonctionLike {
  return (
    ts.isFunctionDeclaration(n) ||
    ts.isFunctionExpression(n) ||
    ts.isArrowFunction(n) ||
    ts.isMethodDeclaration(n)
  );
}

/** Retire `as const`, `satisfies`, parenthèses et assertions non nulles. */
function nu(e: ts.Expression): ts.Expression {
  let x = e;
  for (;;) {
    if (ts.isAsExpression(x) || ts.isSatisfiesExpression(x) || ts.isNonNullExpression(x)) {
      x = x.expression;
    } else if (ts.isParenthesizedExpression(x)) {
      x = x.expression;
    } else {
      return x;
    }
  }
}

function litteral(e: ts.Expression): string | null {
  const x = nu(e);
  return ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x) ? x.text : null;
}

function nomDePropriete(p: ts.ObjectLiteralElementLike): string | null {
  if (!p.name) return null;
  if (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) return p.name.text;
  return null;
}

type Verdict = "pose" | "indecidable" | null;

/** Le pire de deux verdicts : `pose` l'emporte sur `indecidable`, qui l'emporte sur rien. */
function pire(a: Verdict, b: Verdict): Verdict {
  if (a === "pose" || b === "pose") return "pose";
  if (a === "indecidable" || b === "indecidable") return "indecidable";
  return null;
}

/**
 * Ce que des données d'écriture posent sur le champ : `"pose"` (une valeur de l'état),
 * `"indecidable"` (une valeur non littérale), ou `null` (le champ n'y est pas, ou une autre
 * valeur littérale).
 *
 * `siOpaque` : le verdict d'une expression qu'on ne sait pas ouvrir (une variable). Au niveau de
 * `data`, c'est `indecidable` ; dans un étalement (`...base`), c'est `null` — limite assumée :
 * un étalement opaque n'est pas suivi.
 */
function verdictDonnees(e: ts.Expression, regle: RegleEcrivain, siOpaque: Verdict): Verdict {
  const lue = constanteLue(nu(e));
  if (lue !== null) return verdictDonnees(lue, regle, siOpaque);
  const x = nu(e);
  if (ts.isConditionalExpression(x)) {
    return pire(
      verdictDonnees(x.whenTrue, regle, siOpaque),
      verdictDonnees(x.whenFalse, regle, siOpaque),
    );
  }
  if (ts.isArrayLiteralExpression(x)) {
    let v: Verdict = null;
    for (const el of x.elements) {
      v = pire(v, ts.isSpreadElement(el) ? siOpaque : verdictDonnees(el, regle, siOpaque));
    }
    return v;
  }
  if (!ts.isObjectLiteralExpression(x)) return siOpaque;
  let v: Verdict = null;
  for (const p of x.properties) {
    if (ts.isSpreadAssignment(p)) {
      // Sous `champsTransmis`, un étalement opaque est présumé poser un champ transmis.
      v = pire(v, verdictDonnees(p.expression, regle, regle.champsTransmis ? "pose" : null));
      continue;
    }
    const nom = nomDePropriete(p);
    if (nom === null || !(regle.champsTransmis ?? [regle.champ]).includes(nom)) continue;
    const valeur = ts.isPropertyAssignment(p)
      ? p.initializer
      : ts.isShorthandPropertyAssignment(p)
        ? p.name
        : null;
    if (valeur === null) return pire(v, "indecidable");
    if (regle.touteValeur) {
      v = pire(v, "pose");
      continue;
    }
    const brut = nu(valeur);
    // `{ set: "accepte" }` — la forme d'opération de Prisma.
    const premiere = ts.isObjectLiteralExpression(brut) ? brut.properties[0] : undefined;
    const cible =
      premiere !== undefined &&
      ts.isPropertyAssignment(premiere) &&
      nomDePropriete(premiere) === "set"
        ? premiere.initializer
        : brut;
    const lu = litteral(cible);
    v = pire(v, lu === null ? "indecidable" : regle.valeurs.includes(lu) ? "pose" : null);
  }
  return v;
}

/**
 * Une variable `const x = { … }` (ou `[ … ]`, ou une conditionnelle) déclarée dans une portée
 * englobante : son initialiseur, lu à sa place. Sinon `null` — la variable reste opaque.
 */
function constanteLue(e: ts.Expression): ts.Expression | null {
  if (!ts.isIdentifier(e)) return null;
  for (let p: ts.Node | undefined = e.parent; p; p = p.parent) {
    if (!ts.isBlock(p) && !ts.isSourceFile(p)) continue;
    for (const instruction of p.statements) {
      if (!ts.isVariableStatement(instruction)) continue;
      if ((instruction.declarationList.flags & ts.NodeFlags.Const) === 0) continue;
      for (const d of instruction.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || d.name.text !== e.text || d.initializer === undefined) {
          continue;
        }
        const init = nu(d.initializer);
        return ts.isObjectLiteralExpression(init) ||
          ts.isArrayLiteralExpression(init) ||
          ts.isConditionalExpression(init)
          ? init
          : null;
      }
    }
  }
  return null;
}

function nomDeFonction(f: FonctionLike): string {
  if ((ts.isFunctionDeclaration(f) || ts.isMethodDeclaration(f)) && f.name) {
    return f.name.getText();
  }
  const parent = f.parent;
  if (ts.isVariableDeclaration(parent)) return parent.name.getText();
  if (ts.isPropertyAssignment(parent)) return parent.name.getText();
  if (ts.isCallExpression(parent)) return `travail de ${parent.expression.getText()}()`;
  return "(fonction anonyme)";
}

/** La fonction nommée la plus proche, pour l'identité imprimée. */
function fonctionNommee(n: ts.Node): string {
  const noms: string[] = [];
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    if (estFonction(p)) {
      const nom = nomDeFonction(p);
      noms.push(nom);
      if (!nom.startsWith("travail de ") && nom !== "(fonction anonyme)") break;
    }
  }
  return noms.length === 0 ? "(module)" : noms.reverse().join(" › ");
}

function fonctionEnglobante(n: ts.Node): FonctionLike | null {
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) if (estFonction(p)) return p;
  return null;
}

/** Les appels de `nom` dans le corps de `f`, sans descendre dans les fonctions imbriquées. */
function appelsDans(f: FonctionLike, nom: string): ts.CallExpression[] {
  const trouves: ts.CallExpression[] = [];
  const visiter = (n: ts.Node): void => {
    if (n !== f && estFonction(n)) return;
    if (ts.isCallExpression(n)) {
      const cible = n.expression;
      const nomAppele = ts.isIdentifier(cible)
        ? cible.text
        : ts.isPropertyAccessExpression(cible)
          ? cible.name.text
          : null;
      if (nomAppele === nom) trouves.push(n);
    }
    ts.forEachChild(n, visiter);
  };
  if (f.body) visiter(f.body);
  return trouves;
}

function estTravailDeTransaction(f: FonctionLike, regle: RegleEcrivain): boolean {
  const parent = f.parent;
  if (!ts.isCallExpression(parent) || !parent.arguments.some((a) => a === f)) return false;
  const cible = parent.expression;
  const nom = ts.isIdentifier(cible)
    ? cible.text
    : ts.isPropertyAccessExpression(cible)
      ? cible.name.text
      : null;
  return nom !== null && regle.transactions.includes(nom);
}

/** Vrai si l'argument d'écriture pose, en littéral, le marqueur `horsFait` de la règle. */
function porteLeMarqueur(arg: ts.ObjectLiteralExpression, regle: RegleEcrivain): boolean {
  const marqueur = regle.horsFait;
  if (marqueur === undefined) return false;
  return arg.properties.some((p) => {
    if (!ts.isPropertyAssignment(p) || nomDePropriete(p) !== "data") return false;
    const donnees = nu(p.initializer);
    if (!ts.isObjectLiteralExpression(donnees)) return false;
    return donnees.properties.some((q) => {
      if (!ts.isPropertyAssignment(q) || nomDePropriete(q) !== marqueur.champ) return false;
      const v = nu(q.initializer);
      if (typeof marqueur.valeur === "boolean") {
        return (
          v.kind === (marqueur.valeur ? ts.SyntaxKind.TrueKeyword : ts.SyntaxKind.FalseKeyword)
        );
      }
      return litteral(v) === marqueur.valeur;
    });
  });
}

/** Confronte les écrivains d'UN fichier à UNE règle. */
function confronterFichier(
  fichier: string,
  texte: string,
  regle: RegleEcrivain,
  ecrivains: Ecrivain[],
  fautes: Faute[],
  horsFait: Ecrivain[] = [],
  horsChampsTransmis: Ecrivain[] = [],
): void {
  if (!texte.includes(regle.modele)) return;
  const sf = ts.createSourceFile(fichier, texte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const visiter = (n: ts.Node): void => {
    ts.forEachChild(n, visiter);
    if (regle.tableSql !== undefined) sqlBrut(n, sf, fichier, regle, regle.tableSql, fautes);
    if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return;
    const methode = n.expression.name.text;
    const cles = METHODES_D_ECRITURE[methode];
    if (cles === undefined) return;
    const surModele = n.expression.expression;
    if (!ts.isPropertyAccessExpression(surModele) || surModele.name.text !== regle.modele) return;

    const arg = n.arguments[0];
    if (arg === undefined) return;
    const argNu = nu(arg);
    let verdict: Verdict = null;
    const siOpaque: Verdict = regle.champsTransmis ? "pose" : "indecidable";
    if (ts.isObjectLiteralExpression(argNu)) {
      for (const p of argNu.properties) {
        // `{ where, data }` : la forme abrégée est une variable, lue comme telle (INT-T03).
        const valeur = ts.isPropertyAssignment(p)
          ? p.initializer
          : ts.isShorthandPropertyAssignment(p)
            ? p.name
            : null;
        if (valeur === null) continue;
        const cle = nomDePropriete(p);
        if (cle === null || !cles.includes(cle)) continue;
        verdict = pire(verdict, verdictDonnees(valeur, regle, siOpaque));
      }
    } else {
      verdict = siOpaque;
    }
    if (regle.champsTransmis !== undefined && METHODES_DE_CREATION.includes(methode)) {
      verdict = "pose";
    }
    if (verdict === null) {
      if (regle.champsTransmis !== undefined) {
        horsChampsTransmis.push({
          evenement: regle.evenement,
          fichier,
          ligne: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
          fonction: fonctionNommee(n),
        });
      }
      return;
    }

    const ecrivain: Ecrivain = {
      evenement: regle.evenement,
      fichier,
      ligne: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
      fonction: fonctionNommee(n),
    };
    const client = surModele.expression.getText();

    if (ts.isObjectLiteralExpression(argNu) && porteLeMarqueur(argNu, regle)) {
      horsFait.push(ecrivain);
      return;
    }

    if (verdict === "indecidable") {
      fautes.push({
        ...ecrivain,
        regle: "E0",
        detail:
          `${client}.${regle.modele}.${methode}() pose \`${regle.champ}\` avec une valeur non ` +
          `littérale : impossible de dire s'il écrit l'état ${regle.valeurs.join("|")}`,
      });
      return;
    }
    ecrivains.push(ecrivain);

    const f = fonctionEnglobante(n);
    const emissions = f === null ? [] : appelsDans(f, regle.emission);
    if (f === null || emissions.length === 0) {
      const ecrit =
        regle.champsTransmis === undefined
          ? `pose ${regle.champ}="${regle.valeurs.join("|")}"`
          : METHODES_DE_CREATION.includes(methode)
            ? "crée une fiche"
            : `pose un champ transmis (${regle.champsTransmis.join(", ")}) ou des données illisibles`;
      fautes.push({
        ...ecrivain,
        regle: "E1",
        detail: `${client}.${regle.modele}.${methode}() ${ecrit} sans appeler ${regle.emission}() dans la même fonction`,
      });
      return;
    }
    const surLeMemeClient = emissions.some((c) => c.arguments[0]?.getText() === client);
    if (!surLeMemeClient) {
      fautes.push({
        ...ecrivain,
        regle: "E2",
        detail: `l'écriture passe par \`${client}\` mais ${regle.emission}() reçoit un autre client : hors de la même transaction`,
      });
      return;
    }
    if (!estTravailDeTransaction(f, regle)) {
      fautes.push({
        ...ecrivain,
        regle: "E3",
        detail: `la fonction englobante n'est pas le travail d'une transaction (${regle.transactions.join(", ")})`,
      });
    }
  };
  visiter(sf);
}

const ECRITURE_SQL = /\b(insert\s+into|update)\s+"?([a-z_]+)"?(\s|\(|$)/gi;

/** Une écriture SQL brute (`$executeRaw`…) qui vise `table` : E0, le cliquet ne lit pas le SQL. */
function sqlBrut(
  n: ts.Node,
  sf: ts.SourceFile,
  fichier: string,
  regle: RegleEcrivain,
  table: string,
  fautes: Faute[],
): void {
  const cible = ts.isTaggedTemplateExpression(n)
    ? n.tag
    : ts.isCallExpression(n)
      ? n.expression
      : null;
  if (cible === null) return;
  const nom = ts.isPropertyAccessExpression(cible)
    ? cible.name.text
    : ts.isIdentifier(cible)
      ? cible.text
      : "";
  if (!/^\$(execute|query)Raw(Unsafe)?$/.test(nom)) return;
  const sql = ts.isTaggedTemplateExpression(n) ? n.template.getText() : n.getText();
  const tables = [...sql.matchAll(ECRITURE_SQL)].map((m) => (m[2] ?? "").toLowerCase());
  if (!tables.includes(table)) return;
  fautes.push({
    evenement: regle.evenement,
    fichier,
    ligne: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
    fonction: fonctionNommee(n),
    regle: "E0",
    detail: `écriture SQL brute sur ${table} : le cliquet ne lit pas le SQL, écrire par ${regle.modele}`,
  });
}

/** Les clients qui écrivent sur `modele` dans le corps de `f` (sans les fonctions imbriquées). */
function clientsQuiEcrivent(f: FonctionLike, modele: string): string[] {
  const clients: string[] = [];
  const visiter = (n: ts.Node): void => {
    if (n !== f && estFonction(n)) return;
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      METHODES_D_ECRITURE[n.expression.name.text] !== undefined &&
      ts.isPropertyAccessExpression(n.expression.expression) &&
      n.expression.expression.name.text === modele
    ) {
      clients.push(n.expression.expression.expression.getText());
    }
    ts.forEachChild(n, visiter);
  };
  if (f.body) visiter(f.body);
  return clients;
}

/** `x.cle` ou `x["cle"]`. */
function designeLaCle(e: ts.Expression, cle: string): boolean {
  const x = nu(e);
  if (ts.isPropertyAccessExpression(x)) return x.name.text === cle;
  if (ts.isElementAccessExpression(x)) return litteral(x.argumentExpression) === cle;
  return false;
}

const AFFECTATIONS: readonly ts.SyntaxKind[] = [
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
];

/**
 * Le littéral `"cle"` est-il à une place qui ne CONSTRUIT pas la clé : une lecture (`x["cle"]`
 * hors affectation, `"cle" in x`), un filtre Json (`path: ["cle"]`), un type, ou le nom d'une
 * propriété d'objet (déjà comptée comme écrivain) ?
 */
function litteralSansEcriture(n: ts.StringLiteralLike): boolean {
  const p = n.parent;
  if (ts.isLiteralTypeNode(p)) return true;
  if (ts.isElementAccessExpression(p) && p.argumentExpression === n) return true;
  if (ts.isPropertyAssignment(p) && p.name === n) return true;
  if (
    ts.isBinaryExpression(p) &&
    p.left === n &&
    p.operatorToken.kind === ts.SyntaxKind.InKeyword
  ) {
    return true;
  }
  return (
    ts.isArrayLiteralExpression(p) &&
    ts.isPropertyAssignment(p.parent) &&
    nomDePropriete(p.parent) === "path"
  );
}

/** Confronte, dans UN fichier, chaque construction de la clé Json d'une règle `cleJson`. */
function confronterMarqueJson(
  fichier: string,
  texte: string,
  regle: RegleEcrivain,
  cle: string,
  ecrivains: Ecrivain[],
  fautes: Faute[],
): void {
  if (!texte.includes(cle)) return;
  const sf = ts.createSourceFile(fichier, texte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const visiter = (n: ts.Node): void => {
    ts.forEachChild(n, visiter);
    const construit =
      ((ts.isPropertyAssignment(n) || ts.isShorthandPropertyAssignment(n)) &&
        ts.isObjectLiteralExpression(n.parent) &&
        nomDePropriete(n) === cle) ||
      (ts.isBinaryExpression(n) &&
        AFFECTATIONS.includes(n.operatorToken.kind) &&
        designeLaCle(n.left, cle));
    const indecidable =
      !construit && ts.isStringLiteralLike(n) && n.text === cle && !litteralSansEcriture(n);
    if (!construit && !indecidable) return;

    const ecrivain: Ecrivain = {
      evenement: regle.evenement,
      fichier,
      ligne: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
      fonction: fonctionNommee(n),
    };
    if (indecidable) {
      fautes.push({
        ...ecrivain,
        regle: "E0",
        detail:
          `le littéral "${cle}" circule hors d'une écriture lisible : une clé portée par une ` +
          `variable finit dans \`${regle.champ}[variable] = …\`, que le cliquet ne sait pas suivre`,
      });
      return;
    }
    ecrivains.push(ecrivain);

    const f = fonctionEnglobante(n);
    const emissions = f === null ? [] : appelsDans(f, regle.emission);
    if (f === null || emissions.length === 0) {
      fautes.push({
        ...ecrivain,
        regle: "E1",
        detail: `la clé ${regle.champ}.${cle} est posée sans appeler ${regle.emission}() dans la même fonction`,
      });
      return;
    }
    const clients = clientsQuiEcrivent(f, regle.modele);
    const surLeMemeClient = emissions.some((c) => {
      const premier = c.arguments[0]?.getText();
      return premier !== undefined && clients.includes(premier);
    });
    if (!surLeMemeClient) {
      fautes.push({
        ...ecrivain,
        regle: "E2",
        detail:
          clients.length === 0
            ? `aucune écriture de ${regle.modele} dans la fonction qui pose ${regle.champ}.${cle}`
            : `${regle.emission}() ne reçoit pas le client qui écrit ${regle.modele} ` +
              `(${clients.join(", ")}) : hors de la même transaction`,
      });
      return;
    }
    if (!estTravailDeTransaction(f, regle)) {
      fautes.push({
        ...ecrivain,
        regle: "E3",
        detail: `la fonction englobante n'est pas le travail d'une transaction (${regle.transactions.join(", ")})`,
      });
    }
  };
  visiter(sf);
}

/** Le cliquet, sur un jeu de sources (chemins relatifs à la racine du dépôt). */
export function confronterEcrivains(
  sources: Sources,
  regles: readonly RegleEcrivain[] = REGLES,
): Bilan {
  const ecrivains: Ecrivain[] = [];
  const fautes: Faute[] = [];
  const horsFait: Ecrivain[] = [];
  const horsChampsTransmis: Ecrivain[] = [];
  const parEvenement: Record<string, number> = {};
  for (const regle of regles) {
    const avant = ecrivains.length;
    for (const [fichier, texte] of sources) {
      if (estTest(fichier)) continue;
      if (regle.cleJson !== undefined) {
        confronterMarqueJson(fichier, texte, regle, regle.cleJson, ecrivains, fautes);
        continue;
      }
      confronterFichier(fichier, texte, regle, ecrivains, fautes, horsFait, horsChampsTransmis);
    }
    parEvenement[regle.evenement] = ecrivains.length - avant;
  }
  return { ecrivains, fautes, horsFait, horsChampsTransmis, parEvenement };
}

export function lireLeDepot(racine: string): Map<string, string> {
  const sources = new Map<string, string>();
  const parcourir = (dossier: string): void => {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      const complet = path.join(dossier, e.name);
      if (e.isDirectory()) {
        if (e.name !== "node_modules" && e.name !== ".next") parcourir(complet);
      } else if (/\.tsx?$/.test(e.name)) {
        sources.set(normal(path.relative(racine, complet)), fs.readFileSync(complet, "utf8"));
      }
    }
  };
  parcourir(path.join(racine, "src"));
  return sources;
}

/**
 * Ce que le cliquet dit d'un bilan : le code de sortie et les lignes, sans rien imprimer. Le
 * code est celui de `pnpm partners:cliquet-ecrivains` (témoin : `cliquet-ecrivains-client`).
 */
export function rendu(
  bilan: Bilan,
  regles: readonly RegleEcrivain[] = REGLES,
): { readonly code: 0 | 1; readonly lignes: string[] } {
  const mesures = regles.filter((r) => r.sansEcrivainMesure !== undefined).map((r) => r.evenement);
  const vides = Object.entries(bilan.parEvenement).filter(
    ([evenement, n]) => n === 0 && !mesures.includes(evenement),
  );
  if (bilan.fautes.length > 0 || vides.length > 0) {
    return {
      code: 1,
      lignes: [
        "[partners:cliquet-ecrivains] ROUGE — un écrivain échappe à l'émission unique :",
        ...bilan.fautes.map(
          (f) =>
            `  ${f.regle}  ${f.fichier}:${f.ligne} (${f.fonction}) [${f.evenement}] — ${f.detail}`,
        ),
        ...vides.map(
          ([evenement]) =>
            `  aucun écrivain trouvé pour ${evenement} : la mesure est VIDE, panne du cliquet.`,
        ),
      ],
    };
  }
  const resume = Object.entries(bilan.parEvenement)
    .map(([evenement, n]) => `${n} écrivain(s) de ${evenement}`)
    .join(", ");
  return {
    code: 0,
    lignes: [
      ...bilan.ecrivains.map((e) => `  ✓ [${e.evenement}] ${e.fichier}:${e.ligne} (${e.fonction})`),
      ...bilan.horsFait.map(
        (e) => `  ○ [${e.evenement}] ${e.fichier}:${e.ligne} (${e.fonction}) — classée hors fait`,
      ),
      ...bilan.horsChampsTransmis.map(
        (e) =>
          `  ○ [${e.evenement}] ${e.fichier}:${e.ligne} (${e.fonction}) — aucun champ transmis`,
      ),
      ...regles
        .filter((r) => r.sansEcrivainMesure !== undefined && bilan.parEvenement[r.evenement] === 0)
        .map((r) => `  ∅ [${r.evenement}] aucun écrivain — mesuré ${r.sansEcrivainMesure ?? ""}`),
      `[partners:cliquet-ecrivains] OK — ${resume} confronté(s), tous par l'émission unique.`,
    ],
  };
}

function principal(): void {
  const { code, lignes } = rendu(confronterEcrivains(lireLeDepot(process.cwd())));
  for (const l of lignes) (code === 0 ? console.warn : console.error)(l);
  if (code !== 0) process.exit(code);
}

if (normal(process.argv[1] ?? "").endsWith("scripts/gates/cliquet-ecrivains.ts")) principal();
