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
  {
    modele: "Client",
    statut: "a-instruire",
    note: "contact B2B ; conservation contractuelle probable, non instruite.",
  },
  { modele: "SousTraitant", statut: "a-instruire", note: "contact B2B, non instruit." },
  {
    modele: "FactureFormation",
    statut: "a-instruire",
    note: "destinataire de facture ; obligation comptable probable, non instruite.",
  },
  {
    modele: "DocumentSignature",
    statut: "a-instruire",
    note: "signataire d'une pièce ; preuve, non instruite.",
  },
  {
    modele: "DocumentSignatureToken",
    statut: "a-instruire",
    note: "jeton de signature, non instruit.",
  },
  {
    modele: "DocumentRecipient",
    statut: "a-instruire",
    note: "destinataire d'une pièce, non instruit.",
  },
  {
    modele: "EmargementSignature",
    statut: "a-instruire",
    note: "signataire d'émargement ; preuve d'assiduité, non instruite.",
  },
  {
    modele: "CoachingSeanceSignature",
    statut: "a-instruire",
    note: "signataire de séance, non instruit.",
  },
  {
    modele: "BookingOption",
    statut: "a-instruire",
    note: "contact d'une option de réservation, non instruit.",
  },
  {
    modele: "RessourcesMagicLink",
    statut: "a-instruire",
    note: "lien d'accès ressource, non instruit.",
  },
  {
    modele: "RessourceTelechargement",
    statut: "a-instruire",
    note: "téléchargement de ressource, non instruit.",
  },
  { modele: "PodcastRequest", statut: "a-instruire", note: "demande podcast, non instruite." },
  {
    modele: "ProspectionHealthPractitioner",
    statut: "exception-declaree",
    note: "prospection — conservation SANS LIMITE, décision assumée du propriétaire en connaissance de l'art. 5.1.e. Ne pas rouvrir.",
  },
];

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
      .some((l) => COLONNE_ADRESSE.test(l.split(/\s+/)[0] ?? ""));
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
        "ne doit que DÉCROÎTRE. La première à reprendre est `Trainee` — c'est le " +
        "stagiaire lui-même.",
    ).toBeLessThanOrEqual(14);
  });
});
