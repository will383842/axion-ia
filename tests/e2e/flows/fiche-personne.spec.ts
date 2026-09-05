// La fiche personne — recette par l'INTERFACE.
//
// Pourquoi ce fichier existe alors que `rapprocher-sans-fusionner.spec.ts` a
// déjà 9 tests unitaires : ces 9 tests montent des fixtures et prouvent que la
// FONCTION classe juste. Ils ne prouvent pas que l'écran s'ouvre, que la garde
// de rôle laisse passer, que l'empreinte de l'URL retrouve bien un humain, ni
// que ce qui s'affiche correspond à ce que la base contient.
//
// 🔴 ET SURTOUT : les fixtures unitaires arrivent DÉJÀ ÉTIQUETÉES. C'est
// exactement ce qui a laissé passer le défaut que ce fichier surveille — un
// message « recrutement » envoyé depuis le formulaire de contact public
// s'affichait comme « Apporteur d'affaires », avec un lien vers la file
// commerciale. Aucune fixture ne décrivait ce cas, parce qu'aucune fixture
// n'était construite depuis le producteur réel.
//
// ── 🔴 CE FICHIER SÈME SES PROPRES DONNÉES (2026-09-05) ────────────────────
//
// Il a porté jusqu'ici QUATRE EMPREINTES EN DUR — quatre HMAC de 64 caractères
// hexadécimaux, calculés sur des personnes semées À LA MAIN dans une base
// locale jetable. Elles n'existent dans aucun seed du dépôt. Conséquence
// mesurée : la suite passait sur le poste qui avait fabriqué les lignes, et
// ROUGISSAIT partout ailleurs — en CI comme chez le voisin. Une recette qui
// dépend d'une donnée que personne d'autre n'a ne recette rien : elle ne dit
// que « cette machine-ci ».
//
// Sa sœur `reponse-en-masse.spec.ts` s'est fait attraper par le même défaut, en
// exigeant un dossier « écarté » fabriqué à la main.
//
// Le remède est celui déjà en place dans `saisie-manuelle.spec.ts`,
// `capture-ecran-1.spec.ts` et `tunnel-apporteur-bout-en-bout.spec.ts` : la
// spec parle à la base par le client Prisma généré. Ici elle va plus loin —
// elle SÈME, elle utilise, elle EFFACE :
//
//   · `beforeAll` crée les quatre personnes avec le VRAI chiffrement
//     (`encryptPii`) et la VRAIE empreinte (`hashEmailForLookup`), et surtout
//     avec la forme de `details` que les producteurs RÉELS écrivent — c'est
//     tout l'enjeu du cas D : le classement se joue sur `subType`, pas sur
//     `unifiedType`. Une fixture inventée reproduirait l'erreur d'origine ;
//   · les empreintes sont CALCULÉES ici, jamais recopiées ;
//   · `afterAll` efface exactement ce qui a été créé.
//
// 🔑 Chaque exécution tire un MARQUEUR unique, présent dans les quatre adresses
// e-mail. Deux conséquences, toutes deux voulues :
//   · le nettoyage filtre sur des empreintes qui n'appartiennent qu'à CE
//     passage — il ne peut donc emporter ni une vraie donnée, ni les lignes
//     d'un autre worker Playwright qui tournerait en parallèle ;
//   · le domaine `@recette-fiche-e2e.invalid` (TLD réservé, RFC 2606) rend ces
//     lignes reconnaissables à l'œil si un nettoyage échouait.
//
// ── Pré-requis ────────────────────────────────────────────────────────────
// Serveur de dev sur une base réelle, `E2E_BASE_URL` posé, `DATABASE_URL` sur
// LA MÊME base que le serveur.
//
// ⚠️ Et `PII_ENCRYPTION_KEY` IDENTIQUE à celle du serveur. C'est elle — et non
// `IP_HASH_SALT`, dont le nom le laisserait croire — qui sert de clé HMAC à
// `hashEmailForLookup` ET de clé AES aux colonnes d'identité. Avec deux clés
// différentes : l'URL cherche une empreinte que la base ne contient pas, ou le
// serveur ne sait pas déchiffrer le nom qu'on vient d'écrire. Dans les deux cas
// l'échec accuse l'écran au lieu d'accuser la configuration du test.

import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { PrismaClient, SubmissionType } from "../../../prisma/generated/client/index.js";
import { CANDIDATURE_COMMERCIALE_SUBTYPE } from "../../../src/lib/commercial-application/model";
import { encryptPii } from "../../../src/lib/pii-crypto";
import { hashEmailForLookup } from "../../../src/lib/security/email-hash";
import { ADMIN_PREFIX, loginAsAdmin } from "../fixtures/admin-auth";

const prisma = new PrismaClient();

const fiche = (empreinte: string) => `/fr/${ADMIN_PREFIX}/contacts/personne/${empreinte}`;

/**
 * Ce qui rend CE passage distinguable de tous les autres.
 *
 * 🔑 Calculé au chargement du module, donc une fois par worker Playwright.
 * Deux workers qui exécuteraient ce fichier en parallèle sèment deux jeux
 * disjoints et n'effacent que le leur — c'est ce qui rend le nettoyage sûr sans
 * jamais avoir à supposer qu'on est seul.
 */
const MARQUEUR = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;

/** Adresse jetable, sur un TLD qui ne résout nulle part (RFC 2606). */
const adresse = (qui: string) => `${qui}-${MARQUEUR}@recette-fiche-e2e.invalid`;

interface Personne {
  readonly prenom: string;
  readonly nom: string;
  readonly email: string;
}

const complet = (p: Personne) => `${p.prenom} ${p.nom}`;

/** Les quatre repères du jeu de recette — semés plus bas, jamais supposés. */
const ALICE: Personne = { prenom: "Alice", nom: "Moreau", email: adresse("alice") };
const BRUNO: Personne = { prenom: "Bruno", nom: "Lefèvre", email: adresse("bruno") };
const CAROLE: Personne = { prenom: "Carole", nom: "Simon", email: adresse("carole") };
const DAVID: Personne = { prenom: "David", nom: "Nguyen", email: adresse("david") };

/**
 * L'empreinte d'une adresse — la clé de personne, celle de l'URL.
 *
 * 🔴 `hashEmailForLookup` rend `null` sur une adresse vide. Le laisser filer
 * produirait une URL `/personne/null` et un écran vide : l'échec accuserait
 * alors la fiche, pas la fixture. On tombe ici, avec le nom du coupable.
 */
function empreinteDe(email: string): string {
  const h = hashEmailForLookup(email);
  if (!h) throw new Error(`empreinte introuvable pour « ${email} » — fixture invalide`);
  return h;
}

const A = empreinteDe(ALICE.email);
const B = empreinteDe(BRUNO.email);
const C = empreinteDe(CAROLE.email);
/** Le témoin du défaut : un CHERCHEUR D'EMPLOI venu de /contact. */
const D = empreinteDe(DAVID.email);

const EMPREINTES = [A, B, C, D];

/** Marque de fabrique des lignes de recette, dans une colonne qui l'accepte. */
const CONSENT_RECETTE = "recette-fiche-personne-e2e";
const TELEPHONE = "0600000000";

/**
 * Une candidature à une offre — le monde EMPLOI.
 *
 * Les champs posés sont ceux que `features/job-application/actions.ts` pose, et
 * pas un de plus. ⚠️ `first_name`, `last_name`, `email`, `phone`,
 * `offer_title_snap` et `consent_version` sont NOT NULL : les omettre fait
 * échouer l'insertion tout au fond de la pile, sur un message Postgres qu'on
 * lit d'abord comme une panne de la fiche.
 *
 * `offerId` reste absent : la colonne est nullable depuis
 * `20260904010000_candidature_sans_offre`, et c'est le cas de la candidature
 * spontanée. `offerTitleSnap` continue de dire pour quel poste elle a été
 * déposée — c'est tout l'intérêt d'un instantané.
 */
async function semerCandidature(p: Personne, poste: string): Promise<void> {
  await prisma.jobApplication.create({
    data: {
      offerTitleSnap: poste,
      firstName: encryptPii(p.prenom),
      lastName: encryptPii(p.nom),
      email: encryptPii(p.email),
      // Sans cette empreinte, la fiche ne retrouve JAMAIS la candidature :
      // `email` est chiffré à IV aléatoire, aucune égalité SQL n'y est possible.
      emailHash: empreinteDe(p.email),
      phone: encryptPii(TELEPHONE),
      consentVersion: CONSENT_RECETTE,
      locale: "fr",
      // `status` reste à son défaut `new`. ⛔ Ne pas le passer à `rejected` ni
      // `withdrawn` sans motif : `job_applications_motif_coherent_check` le
      // refuse au niveau SQL.
    },
  });
}

/**
 * Une `Submission`, dans la forme exacte que les producteurs écrivent.
 *
 * `details` est reçu tel quel : c'est LUI qui décide du monde de la trace, et
 * le paramétrer ici évite de fabriquer quatre variantes qui divergeraient du
 * code réel.
 */
async function semerSubmission(p: Personne, details: Record<string, unknown>): Promise<void> {
  await prisma.submission.create({
    data: {
      type: SubmissionType.contact,
      locale: "fr",
      companyName: "—",
      contactName: encryptPii(complet(p)),
      contactEmail: encryptPii(p.email),
      contactEmailHash: empreinteDe(p.email),
      contactPhone: encryptPii(TELEPHONE),
      details: details as object,
    },
  });
}

/**
 * Un dossier APPORTEUR — la forme des quatre producteurs du monde apporteur
 * (`commercial-application/{actions,capture,lead,saisie-manuelle}-actions.ts`).
 *
 * 🔑 Les DEUX clés, parce que la fiche exige les deux. `subType` est dérivé de
 * `lib/commercial-application/model.ts`, la source unique déjà lue par la file
 * commerciale de la console : recopier la chaîne ici ferait de ce test un
 * second dictionnaire, qui aurait raison le jour où le vrai changerait.
 */
const dossierApporteur = () => ({
  unifiedType: "recrutement",
  subType: CANDIDATURE_COMMERCIALE_SUBTYPE,
  ville: "Grenoble (38000)",
  message: "Dossier de recette — aucune personne réelle derrière cette ligne.",
  source: "/devenir-commercial-ia/candidature",
  consentVersion: CONSENT_RECETTE,
});

/**
 * Un message venu du formulaire de contact public
 * (`features/unified-contact/actions.ts`, ~l. 230).
 *
 * 🔴 Ce producteur écrit `unifiedType: data.type` et `subType: data.subType` —
 * et `subType` n'est renseigné par AUCUNE rubrique du formulaire public. C'est
 * précisément ce qui fabrique le cas D quand la rubrique choisie est
 * « recrutement » : une ligne qui ressemble à un dossier apporteur par son
 * `unifiedType`, et qui n'en est pas un.
 */
const messagePublic = (unifiedType: string) => ({
  unifiedType,
  ville: "Grenoble",
  message: "Message de recette — aucune personne réelle derrière cette ligne.",
  source: "/contact",
  consentVersion: CONSENT_RECETTE,
});

test.describe("@personne la fiche rapproche sans fusionner", () => {
  // 🔴 BUDGET DÉCLARÉ, forme exigée par le cliquet
  // `tests/unit/e2e-harness/budget-des-specs-admin.spec.ts` : toute suite qui
  // ouvre une session admin l'annonce, et au moins 90 s. `test.setTimeout()` ne
  // compte PAS — le cliquet lit `describe.configure`.
  //
  // Pourquoi si haut : Argon2id à la connexion, et sous `next dev` la PREMIÈRE
  // navigation vers chaque route la COMPILE.
  test.describe.configure({ timeout: 240_000 });

  test.beforeAll(async () => {
    // Le budget d'un hook ne suit PAS celui du `describe` : sans cette ligne il
    // resterait aux 30 s de `playwright.config.ts`, et le démarrage du moteur
    // Prisma les consomme sur un poste chargé.
    test.setTimeout(120_000);

    // A — DEUX candidatures emploi, et rien d'autre. ⚠️ Aucun intitulé de poste
    // ne doit contenir « apporteur » : la fiche l'affiche en clair, et c'est le
    // mot que ce test interdit d'y voir.
    await semerCandidature(ALICE, "Formateur IA (recette)");
    await semerCandidature(ALICE, "Chargé de formation (recette)");

    // B — un pied dans chaque monde. LE cas qui justifie la fiche.
    await semerCandidature(BRUNO, "Formateur IA (recette)");
    await semerSubmission(BRUNO, dossierApporteur());

    // C — un message ET un dossier apporteur, aucune candidature emploi.
    await semerSubmission(CAROLE, messagePublic("autre"));
    await semerSubmission(CAROLE, dossierApporteur());

    // D — le témoin du défaut : « je cherche un poste » posté depuis /contact.
    // `unifiedType: "recrutement"` SANS `subType`.
    await semerSubmission(DAVID, messagePublic("recrutement"));

    // Fail-loud : une écriture avalée laisserait les quatre écrans vides, et
    // l'échec accuserait la fiche. On veut savoir ICI que la base n'a rien pris.
    const traces = await prisma.submission.count({
      where: { contactEmailHash: { in: EMPREINTES } },
    });
    const candidatures = await prisma.jobApplication.count({
      where: { emailHash: { in: EMPREINTES } },
    });
    if (traces !== 4 || candidatures !== 3) {
      throw new Error(
        `jeu de recette incomplet : ${traces}/4 submissions, ${candidatures}/3 candidatures — ` +
          "DATABASE_URL pointe-t-elle sur la base du serveur ?",
      );
    }
  });

  test.afterAll(async () => {
    test.setTimeout(120_000);
    try {
      // ⛔ On n'efface QUE ce qu'on a semé. Le filtre porte sur les empreintes
      // de CE passage — quatre adresses tirées au hasard il y a quelques
      // secondes : aucune ligne réelle ne peut y répondre, et aucune table
      // n'est balayée en entier.
      await prisma.jobApplication.deleteMany({ where: { emailHash: { in: EMPREINTES } } });
      await prisma.submission.deleteMany({ where: { contactEmailHash: { in: EMPREINTES } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  test("deux candidatures emploi, et AUCUN encadré « des deux côtés »", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(fiche(A));

    expect(new URL(page.url()).pathname, "renvoyé au login").not.toContain("/login");
    await expect(page.getByRole("heading", { name: /Alice Moreau/ })).toBeVisible({
      timeout: 120_000,
    });

    const corps = page.locator("main");
    await expect(corps).toContainText("Candidature emploi");

    // 🔑 L'encadré ne doit PAS apparaître : cette personne n'existe que d'un
    // côté. Un encadré affiché pour tout le monde ne dirait plus rien.
    await expect(corps, "encadré « des deux côtés » affiché à tort").not.toContainText(
      "des deux côtés",
    );
    // Et rien du monde apporteur ne doit s'être glissé là.
    await expect(corps, "vocabulaire apporteur sur une fiche purement emploi").not.toContainText(
      "Apporteur d'affaires",
    );
  });

  test("emploi ET apporteur : l'encadré paraît, sans mélanger les vocabulaires", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto(fiche(B));

    await expect(page.getByRole("heading", { name: /Bruno Lef/ })).toBeVisible({
      timeout: 120_000,
    });
    const corps = page.locator("main");

    // C'est LE cas qui prouve le rapprochement.
    await expect(corps, "l'encadré des deux mondes manque").toContainText("des deux côtés");
    await expect(corps).toContainText("Candidature emploi");
    await expect(corps).toContainText("Apporteur d'affaires");

    // 🔴 ELLE RAPPROCHE, ELLE NE FUSIONNE PAS. Aucun statut de sélection emploi
    // ne doit apparaître : ni sur la ligne emploi, ni — surtout — à côté de la
    // ligne apporteur. Un statut commun aux deux mondes est précisément la
    // pièce qu'un contrôle de requalification cherche.
    for (const statut of ["shortlisted", "Présélection", "À étudier", "En revue"]) {
      await expect(corps, `un statut de sélection emploi s'affiche : ${statut}`).not.toContainText(
        statut,
      );
    }
  });

  test("un dépôt apporteur seul, sans aucune candidature", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(fiche(C));

    await expect(page.getByRole("heading", { name: /Carole Simon/ })).toBeVisible({
      timeout: 120_000,
    });
    const corps = page.locator("main");

    await expect(corps).toContainText("Apporteur d'affaires");
    await expect(
      corps,
      "une candidature emploi apparaît alors qu'il n'y en a pas",
    ).not.toContainText("Candidature emploi");
    await expect(corps, "encadré « des deux côtés » affiché à tort").not.toContainText(
      "des deux côtés",
    );
  });

  test("🔴 un message « recrutement » de /contact N'EST PAS un apporteur", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(fiche(D));

    await expect(page.getByRole("heading", { name: /David Nguyen/ })).toBeVisible({
      timeout: 120_000,
    });
    const corps = page.locator("main");

    // Cette personne a écrit « je cherche un poste » depuis le formulaire de
    // contact public. Son dépôt porte `unifiedType: "recrutement"` — comme un
    // vrai dossier apporteur — mais PAS de `subType: "candidature-commerciale"`,
    // que les quatre producteurs apporteur écrivent tous.
    //
    // Avant correction, l'écran l'annonçait « Apporteur d'affaires / Dossier
    // apporteur » et pointait vers `contacts/commercial/`. C'est l'inversion
    // même que cette fiche existe pour empêcher.
    await expect(corps, "un chercheur d'emploi est classé APPORTEUR").not.toContainText(
      "Apporteur d'affaires",
    );
    await expect(corps).toContainText("Message reçu");

    // Le lien de la trace doit mener à la boîte de réception, jamais au DOSSIER
    // commercial.
    //
    // 🔴 L'ASSERTION VISE UN IDENTIFIANT, PAS UN PRÉFIXE. Une première version
    // refusait tout href contenant `/contacts/commercial/` et rougissait sur
    // trois liens parfaitement légitimes : la file commerciale elle-même et
    // « Nouveau contact apporteur », posés par la barre de navigation, qui vit
    // dans `<main>`. Une garde qui condamne la navigation d'un écran ne dit rien
    // de ce qu'on voulait vérifier — et se fait retirer au premier faux positif.
    const liens = await page
      .locator('main a[href*="/contacts/"]')
      .evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
    expect(
      liens.filter((h) => /\/contacts\/commercial\/[0-9a-f]{8}-/.test(h)),
      "un lien mène au DOSSIER commercial de cette personne",
    ).toEqual([]);

    // Témoin positif : la fiche porte bien un lien de trace, sinon l'assertion
    // ci-dessus serait vraie pour une page vide.
    expect(
      liens.filter((h) => h.includes("/contacts/messages/")),
      "aucun lien de trace : la fiche est-elle seulement rendue ?",
    ).not.toEqual([]);
  });
});
