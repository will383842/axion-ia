/**
 * CLIQUET — aucune table portant une adresse ne peut échapper au RGPD en silence.
 *
 * ## Pourquoi ce fichier existe : TROIS FOIS LE MÊME DÉFAUT
 *
 * La route d'effacement (art. 17) et celle d'export (art. 15) énumèrent toutes
 * deux ce qu'elles font et ce qu'elles excluent. Trois fois, une table portant
 * les données d'une personne a manqué aux DEUX listes :
 *
 *   · `D5-5-03` (2026-08-20) — les **candidatures** : CV, photo, téléphone. Le
 *     courriel de confirmation énumérait ce qui avait été effacé. Le commentaire
 *     écrit alors dit tout : « une liste qui se donne pour exhaustive et qui omet
 *     le CV est pire qu'une absence de liste ».
 *   · `D5-5-01` (2026-08-24) — **`email_logs`** : l'adresse en clair survivait à
 *     la demande d'effacement, pendant que la réponse affirmait « vos données
 *     identifiantes ont été effacées ».
 *   · `D5-5-02` (2026-08-24) — **`email_outbox`** : l'adresse ET la charge utile
 *     complète du message — nom, formation, dates, liens personnels.
 *
 * 🔑 Le défaut n'est jamais « on a oublié une table ». C'est qu'une liste
 * **présentée comme exhaustive** puisse être fausse sans que rien ne rougisse.
 * Corriger les trois cas sans garder la classe garantit un quatrième.
 *
 * ## 🔴 2026-08-24 — CE CLIQUET S'EST TROMPÉ DANS LES DEUX SENS
 *
 * Il comptait **trois tables qui n'existent pas**, et en ignorait une qui porte
 * de la donnée personnelle. Son motif testait le PREMIER MOT de chaque ligne
 * sans jamais regarder le TYPE :
 *
 *   · `recipient   DocumentRecipient @relation(...)` — un champ de RELATION.
 *     Deux tables comptées à tort (`RessourcesMagicLink`,
 *     `RessourceTelechargement`), qui ne portent aucune adresse.
 *   · `destinataire  FactureFormationDestinataire` — un ENUM à quatre valeurs
 *     (`entreprise | opco | stagiaire | france_travail`). Une de plus.
 *
 * Trois des douze entrées « à instruire » étaient donc des fantômes : elles
 * gonflaient la dette d'un quart et envoyaient le prochain lecteur instruire du
 * vide. C'est la RÉCIDIVE de ce que ce fichier documente lui-même à propos
 * d'`EmargementToken`, deux paragraphes plus bas — j'avais écrit
 * l'avertissement et refait la faute.
 *
 * Le remède ne pouvait pas être une liste d'exclusions écrite à la main : ce
 * dépôt a déjà payé deux fois qu'une liste en dur prenne du retard. La
 * détection est donc **dérivée du schéma** (`TYPES_NON_TEXTE`).
 *
 * ⚠️ ET L'ERREUR INVERSE RESTE : `FactureFormation` porte `destinataireNom` et
 * `destinataireAdresse` — nom et adresse postale en clair — que ce motif ne
 * verra JAMAIS. Le périmètre de ce cliquet est l'ADRESSE E-MAIL, rien d'autre.
 * La facture est couverte par une exception déclarée dans la route (obligation
 * comptable), mais **aucun inventaire ne couvre aujourd'hui les colonnes de nom
 * et d'adresse postale**. C'est une lacune nommée, pas une lacune traitée.
 *
 * ## Ce que ce cliquet fait, et ce qu'il NE fait PAS
 *
 * Il fige l'inventaire des modèles Prisma portant une colonne d'adresse en clair,
 * et exige que chacun porte un STATUT explicite. Un vingt-septième modèle ne peut
 * plus apparaître sans que son auteur réponde à la question.
 *
 * ⚠️ IL NE PRÉTEND PAS QUE LES 26 SONT CONFORMES. Huit sont traités par la chaîne
 * d'effacement, mesurés. Les autres portent `a-instruire` — ce qui veut dire
 * **non vérifié**, pas « sans objet ». Un inventaire faux serait pire qu'une
 * absence d'inventaire : ces entrées disent honnêtement ce qu'on ignore, et elles
 * se comptent.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SCHEMA = readFileSync(join(process.cwd(), "prisma", "schema.prisma"), "utf8");

/**
 * Les noms de colonnes qui portent une adresse **en clair**. Les colonnes
 * `...Sha256` en sont exclues : une empreinte n'identifie personne, et c'est
 * précisément le traitement qu'on applique quand on doit conserver la preuve.
 */
const COLONNE_ADRESSE =
  /^(email|recipient|contactEmail|signataireEmail|destinataire|destinataireEmail)$/i;

type Statut =
  /** Effacé ou anonymisé par la chaîne art. 17 — vérifié. */
  | "traite"
  /** Conservé pour un motif déclaré dans la route — vérifié. */
  | "exception-declaree"
  /** ⚠️ NON VÉRIFIÉ. Ni confirmé traité, ni confirmé exempté. */
  | "a-instruire";

const INVENTAIRE: ReadonlyArray<{ modele: string; statut: Statut; note: string }> = [
  // ── Traités par la chaîne d'effacement, mesuré le 2026-08-24 ───────────────
  {
    modele: "Submission",
    statut: "traite",
    note: "anonymisation in-place (`eraseSubmissionsForEmail`).",
  },
  {
    modele: "NewsletterSubscriber",
    statut: "traite",
    note: "suppression (`eraseNewsletterForEmail`).",
  },
  { modele: "ChatEscalation", statut: "traite", note: "anonymisation (`eraseChatDataForEmail`)." },
  {
    modele: "JobApplication",
    statut: "traite",
    note: "effacement (`effacerCandidaturesPour`) — `D5-5-03`.",
  },
  {
    modele: "EmailLog",
    statut: "traite",
    note: "adresse PSEUDONYMISÉE, ligne conservée comme preuve Qualiopi — `D5-5-01`.",
  },
  { modele: "EmailOutbox", statut: "traite", note: "SUPPRIMÉ, charge utile comprise — `D5-5-02`." },

  // ── Comptes internes : ce ne sont pas des personnes concernées par la route
  //    publique d'exercice des droits, mais des accès de l'organisme. ─────────
  {
    modele: "AdminUser",
    statut: "exception-declaree",
    note: "compte d'administration de l'organisme.",
  },
  {
    modele: "Trainer",
    statut: "exception-declaree",
    note: "formateur — relation contractuelle, pas un visiteur.",
  },
  { modele: "Author", statut: "exception-declaree", note: "auteur éditorial interne." },
  { modele: "EdMembre", statut: "exception-declaree", note: "membre de la console éditoriale." },
  { modele: "EdInvite", statut: "exception-declaree", note: "invitation à la console éditoriale." },

  // ── ⚠️ NON VÉRIFIÉS. Chacun porte une adresse en clair, aucun n'a été instruit.
  //    Les nommer les rend comptables ; les taire les rendrait invisibles.
  //
  //    ⚠️ `EmargementToken` a d'abord figuré ici — À TORT, et c'est le
  //    contre-témoin ci-dessous qui l'a dit. Il ne porte que
  //    `destinataireEmailSha256` : une empreinte, jamais l'adresse. C'est
  //    exactement le traitement qu'on cherche ailleurs, pas un manque. ────────
  // 🔴 2026-08-24, VÉRIFIÉ APRÈS COUP — CETTE ENTRÉE ÉTAIT FAUSSE.
  // Je l'avais classée `a-instruire` en la présentant comme « la première à
  // reprendre ». Le stagiaire a en réalité SA PROPRE chaîne RGPD, complète et
  // câblée : `qualiopi/portail/rgpd-service.ts` anonymise nom, prénom, e-mail,
  // téléphone, entreprise, fonction, handicap et consentements, pose `deletedAt`,
  // et RÉVOQUE tous les accès portail — un jeton de 90 j resterait sinon
  // exploitable sur un stagiaire « supprimé ». Un export art. 15 dédié existe
  // aussi. Appelée depuis `actions/qualiopi/appreciations.ts`.
  //
  // 🔑 Un inventaire qui déclare « non vérifié » ce qui est TRAITÉ n'est pas
  // prudent : il est faux, et il envoie le prochain lecteur refaire un travail
  // déjà fait. La prudence n'excuse pas l'inexactitude.
  {
    modele: "Trainee",
    statut: "traite",
    note: "chaîne DÉDIÉE `portail/rgpd-service.ts` : anonymisation PII + `deletedAt` + révocation des accès portail (jamais de DELETE physique — intégrité comptable). Export art. 15 dédié.",
  },
  // ── INSTRUITS le 2026-08-24. Les douze entrées ci-dessous portaient toutes
  //    `a-instruire`, c'est-à-dire « non vérifié ». Elles le sont désormais, et
  //    la réponse n'a pas été la même trois fois de suite. ────────────────────

  // ── Traités par la chaîne d'effacement ────────────────────────────────────
  {
    modele: "PodcastRequest",
    statut: "traite",
    note:
      "SUPPRIMÉ intégralement — `D5-5-04`. Le seul VRAI trou des douze : formulaire " +
      "public, aucun contrat, aucune pièce comptable, et la table n'était NI effacée " +
      "NI exemptée. Fallait en outre lui donner un `emailHash` : l'adresse est " +
      "chiffrée à IV aléatoire, la ligne était INTROUVABLE.",
  },
  {
    modele: "BookingOption",
    statut: "traite",
    note:
      "SUPPRIMÉ (`eraseBookingOptionsForEmail`). Une doctrine JUSTE écrite au pluriel " +
      "(« Bookings : … ne contient déjà aucune PII propre ») a couvert son voisin : " +
      "`Booking` n'a effectivement rien, `BookingOption` porte nom, adresse et " +
      "téléphone EN PROPRE, sans aucun `submissionId`.",
  },
  {
    modele: "DocumentSignatureToken",
    statut: "traite",
    note:
      "RÉVOQUÉ puis pseudonymisé (`eraseSignatureTokensForEmail`). Le jeton n'est pas " +
      "une preuve : `tokenHash` est l'empreinte du jeton, pas d'un tuple scellé. " +
      "Révocation d'abord — un lien vivant permettrait de resceller l'adresse dans " +
      "une signature neuve. `destinataireEmailSha256` part aussi : non salé, donc " +
      "réidentifiable par dictionnaire.",
  },

  // ── Conservés pour un motif désormais ÉCRIT dans la route ─────────────────
  //
  //    ⚠️ Les quatre suivants étaient déjà pratiqués ainsi. Aucun n'était faux ;
  //    aucun n'était DÉCLARÉ. Or une exception qu'on applique sans la dire est
  //    indiscernable d'un oubli — c'est exactement sous cette forme qu'ont vécu
  //    les quatre défauts `D5-5-01` à `D5-5-04`.
  {
    modele: "EmargementSignature",
    statut: "exception-declaree",
    note:
      "adresse SCELLÉE dans le tuple haché (`COLONNES_SCELLEES`). L'effacer rendrait " +
      "`empreinte_invalide` sur chaque feuille — soit, devant un contrôle, « pièces " +
      "modifiées après coup » sur des pièces intactes. Ce dépôt a déjà payé ce défaut " +
      "exact. Art. 17(3)(b) et (e) ; l'IMAGE du tracé, elle, est purgée.",
  },
  {
    modele: "DocumentSignature",
    statut: "exception-declaree",
    note:
      "idem — l'identité du signataire est scellée dans l'empreinte de la pièce " +
      "(`COLONNES_SCELLEES_DOCUMENT`). Art. 1366 du code civil, art. 17(3)(e) RGPD. " +
      "Seule l'image de la signature est purgeable.",
  },
  {
    modele: "SousTraitant",
    statut: "exception-declaree",
    note:
      "dossier du signataire d'un contrat de sous-traitance : art. 17(3)(b) — pièces " +
      "exigées par la certification (indicateur 27) — et 17(3)(e), `contactFonction` " +
      "étant FIGÉE à la signature pour porter l'opposabilité du pouvoir de signer. " +
      "⚠️ Réserve : l'exception est fondée mais NON BORNÉE — `actif` est un booléen " +
      "sans date, donc les 5 ans n'ont aucun point de départ calculable.",
  },

  // ── ⚠️ IL EN RESTE TROIS. Chacun bute sur une décision qui n'est pas
  //    technique, et qu'il serait malhonnête de trancher ici. ────────────────
  {
    modele: "Client",
    statut: "a-instruire",
    note:
      "⛔ BLOQUÉ SUR UNE DÉCISION. La table mélange des relations qui n'ont pas la " +
      "même base légale : un `prospect` ou un `perdu` n'a aucun contrat et rien ne " +
      "le retient, un `client_actif` est couvert. Mais AUCUNE date de fin de relation " +
      "n'existe — ni `deletedAt`, ni `finRelationAt` — donc les « 5 ans après fin de " +
      "prestation » que le site PUBLIE sont incalculables en base. Et le dépôt porte " +
      "deux durées contradictoires : 5 ans (`content/legal.ts`, art. L.6353-9) et " +
      "10 ans (registre art. 30, art. L123-22). Il faut une colonne datée et un " +
      "arbitrage sur la durée avant d'écrire quoi que ce soit.",
  },
  {
    modele: "DocumentRecipient",
    statut: "a-instruire",
    note:
      "⛔ BLOQUÉ SUR UN EFFET DE BORD. C'est une liste de diffusion doublée d'un " +
      "compte de connexion sans mot de passe : rien ne fonde de la conserver quand la " +
      "relation cesse. Mais un `deleteMany` emporte EN CASCADE " +
      "`RessourceTelechargement`, l'accusé de lecture des supports — trace qui peut " +
      "valoir preuve de diffusion Qualiopi. Supprimer ou détacher : à trancher avant " +
      "de câbler.",
  },
  {
    modele: "CoachingSeanceSignature",
    statut: "a-instruire",
    note:
      "⛔ BLOQUÉ SUR UNE QUESTION EN AMONT. La table est ORPHELINE depuis le " +
      "2026-08-10 : plus une ligne de `src/` ne l'écrit ni ne la lit, le module AFEST " +
      "1-to-1 ayant été supprimé. L'argument du tuple scellé qui sauve les deux " +
      "signatures ci-dessus ne tient donc pas ici — plus aucun vérificateur ne " +
      "recalcule ces empreintes. La vraie question n'est pas « comment l'effacer » " +
      "mais « pourquoi existe-t-elle encore » : une table morte qui porte de la PII " +
      "en clair est le pire des deux mondes.",
  },
  {
    modele: "ProspectionHealthPractitioner",
    statut: "exception-declaree",
    note: "prospection — conservation SANS LIMITE, décision assumée du propriétaire en connaissance de l'art. 5.1.e. Ne pas rouvrir.",
  },
];

/**
 * Noms de MODÈLES et d'ENUMS du schéma — tous les types qu'une colonne peut
 * porter sans être une chaîne de caractères.
 *
 * 🔴 2026-08-24 — CE JEU N'EXISTAIT PAS, ET LA GARDE COMPTAIT TROIS FANTÔMES.
 * Voir la section « ce cliquet s'est trompé DANS LES DEUX SENS » en tête.
 */
const TYPES_NON_TEXTE: ReadonlySet<string> = new Set([
  ...[...SCHEMA.matchAll(/^model (\w+) \{/gm)].map((m) => m[1] ?? ""),
  ...[...SCHEMA.matchAll(/^enum (\w+) \{/gm)].map((m) => m[1] ?? ""),
]);

/**
 * Une ligne de modèle porte-t-elle vraiment une ADRESSE, ou seulement un nom
 * qui y ressemble ?
 *
 * Deux pièges, tous deux payés le 2026-08-24 :
 *   · `recipient   DocumentRecipient @relation(...)` — un champ de RELATION. Le
 *     nom matche, la ligne ne contient aucune donnée. Deux tables comptées.
 *   · `destinataire  FactureFormationDestinataire` — un ENUM à quatre valeurs
 *     (`entreprise | opco | stagiaire | france_travail`). Aucune adresse.
 *
 * Le remède ne pouvait pas être une liste d'exclusions écrite à la main : ce
 * dépôt a déjà payé deux fois qu'une liste en dur prenne du retard sur ce
 * qu'elle couvre. On DÉRIVE donc du schéma lui-même — un type qui est un modèle
 * ou un enum déclaré n'est pas une chaîne, donc pas une adresse.
 */
function ligneEstUneAdresse(ligne: string): boolean {
  const jetons = ligne.split(/\s+/);
  if (!COLONNE_ADRESSE.test(jetons[0] ?? "")) return false;
  // Ceinture REDONDANTE, et mesuree comme telle : l'eprouver seule laisse le
  // test vert, parce que le filtre par type ci-dessous suffit deja (le type
  // d'un champ de relation EST un nom de modele). On la garde pour le jour ou
  // une relation porterait un type absent du schema, mais un lecteur doit
  // savoir laquelle des deux lignes porte reellement la garde : c'est la
  // suivante.
  if (ligne.includes("@relation")) return false;
  const type = (jetons[1] ?? "").replace(/[?[\]]/g, "");
  return !TYPES_NON_TEXTE.has(type);
}

/** Les modèles du schéma portant une colonne d'adresse en clair. */
function modelesAvecAdresse(): string[] {
  const trouves: string[] = [];
  for (const m of SCHEMA.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    const nom = m[1];
    const corps = m[2];
    if (nom === undefined || corps === undefined) continue;
    const porte = corps
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== "" && !l.startsWith("//") && !l.startsWith("@@"))
      .some(ligneEstUneAdresse);
    if (porte) trouves.push(nom);
  }
  return trouves.sort();
}

describe("aucune table portant une adresse n'échappe au RGPD en silence", () => {
  const reels = modelesAvecAdresse();

  it("le balayage du schéma trouve bien des modèles", () => {
    // Contre-témoin : un motif cassé rendrait une liste vide, et le test suivant
    // passerait au vert sans avoir regardé une seule table. C'est la panne que ce
    // dépôt a payée cinq fois.
    expect(
      reels.length,
      "aucun modèle portant une adresse trouvé dans `schema.prisma` : le motif " +
        "`COLONNE_ADRESSE` ne reconnaît plus rien",
    ).toBeGreaterThanOrEqual(20);
  });

  it("aucun modèle NOUVEAU ne s'ajoute sans statut", () => {
    const connus = new Set(INVENTAIRE.map((e) => e.modele));
    const inconnus = reels.filter((m) => !connus.has(m));
    expect(
      inconnus,
      "modèle(s) portant une adresse en clair sans statut RGPD déclaré. Trois " +
        "fois déjà, une table a manqué À LA FOIS à la route d'effacement et à sa " +
        "liste d'exceptions — candidatures (CV, photo, téléphone), `email_logs`, " +
        "`email_outbox`. Avant d'ajouter une entrée ici, répondre : **que devient " +
        "cette adresse quand la personne exerce son droit à l'effacement ?** Les " +
        "trois réponses admises sont « effacée ou pseudonymisée » (`traite`), " +
        "« conservée pour un motif écrit dans la route » (`exception-declaree`), " +
        "et « je ne sais pas encore » (`a-instruire`) — la troisième étant " +
        "honnête, pas confortable.",
    ).toEqual([]);
  });

  it("aucun modèle inventorié n'a DISPARU du schéma", () => {
    // Symétrique : un modèle renommé sortirait du balayage sans un mot, et
    // l'inventaire décrirait un schéma qui n'existe plus.
    const presents = new Set(reels);
    const disparus = INVENTAIRE.filter((e) => !presents.has(e.modele)).map((e) => e.modele);
    expect(
      disparus,
      "modèle(s) inventorié(s) ici mais absent(s) du schéma : renommage ou " +
        "suppression. Mettre l'inventaire à jour — un inventaire faux est pire " +
        "qu'une absence d'inventaire.",
    ).toEqual([]);
  });

  it("les six tables traitées le sont RÉELLEMENT par la chaîne d'effacement", () => {
    // 🔑 Sans ceci, l'inventaire serait une déclaration d'intention : on pourrait
    // écrire `traite` sur n'importe quoi. On vérifie que le code mute bien ces
    // modèles — c'est exactement ce qui manquait aux trois défauts d'origine.
    const chaine = [
      "src/lib/rgpd-erase.ts",
      "src/app/api/gdpr-erase/route.ts",
      "src/server/careers/candidature-rgpd.ts",
      // 🔴 2026-08-24 — LE STAGIAIRE A SA PROPRE CHAÎNE, ET CE CLIQUET NE LA
      // VOYAIT PAS. Il a donc refusé un `traite` pourtant EXACT, en exigeant
      // une déclaration fausse. Une garde dont le périmètre est plus étroit que
      // la règle qu'elle garde pousse à mentir pour la satisfaire — c'est un
      // défaut de garde, pas un défaut de code.
      "src/server/qualiopi/portail/rgpd-service.ts",
      // Meme raison, une table plus loin : les demandes de podcast ont leur
      // propre module, parce que leur adresse est chiffree et exige une
      // empreinte + un balayage borne. Sans cette ligne, le cliquet refuserait
      // un `traite` EXACT -- il l'a deja fait une fois pour `Trainee`.
      "src/features/podcast-request/rgpd.ts",
    ]
      .map((f) => readFileSync(join(process.cwd(), f), "utf8"))
      .join("\n");

    const traites = INVENTAIRE.filter((e) => e.statut === "traite").map((e) => e.modele);
    const nonMutes = traites.filter((modele) => {
      const accesseur = modele.charAt(0).toLowerCase() + modele.slice(1);
      return !new RegExp(`prisma\\.${accesseur}\\.(updateMany|deleteMany|update|delete)\\b`).test(
        chaine,
      );
    });
    expect(
      nonMutes,
      "modèle(s) déclaré(s) `traite` que la chaîne d'effacement ne mute jamais. " +
        "C'est la forme exacte du défaut : une liste qui affirme un traitement " +
        "qui n'a pas lieu.",
    ).toEqual([]);
  });

  it("l'ampleur de ce qui reste à instruire est CHIFFRÉE, pas dissimulée", () => {
    // Ce test ne bloque rien : il rend le reste visible et le fait décroître de
    // façon mesurable. Le jour où l'on instruit une table, on baisse ce plafond —
    // et il devient impossible d'en ajouter une nouvelle sous couvert du flou.
    const aInstruire = INVENTAIRE.filter((e) => e.statut === "a-instruire").map((e) => e.modele);
    expect(
      aInstruire.length,
      `${aInstruire.length} table(s) portant une adresse en clair ne sont NI ` +
        `traitées NI exemptées avec un motif : ${aInstruire.join(", ")}. Ce nombre ` +
        "ne doit que DÉCROÎTRE. Les trois qui restent ne butent pas sur un " +
        "manque de temps mais sur une DÉCISION : une date de fin de relation à " +
        "créer (`Client`), un effet de cascade à arbitrer (`DocumentRecipient`), " +
        "et une table morte dont il faut d'abord dire si elle doit exister " +
        "(`CoachingSeanceSignature`). Les détails sont dans leurs notes.",
    ).toBeLessThanOrEqual(3);
  });
});
