/**
 * Signature au grain DOCUMENT — service d'écriture.
 *
 * C'est le SEUL endroit du dépôt qui écrit une ligne `document_signatures`. Tout
 * le reste du module (canonicalisation, empreinte, chaînage, mentions) n'existe
 * que pour lui.
 *
 * ## L'ordre des opérations n'est pas négociable
 *
 *  1. Lire la pièce, puis AUTORISER le porteur — avant toute vérification métier.
 *  2. Gardes sur la PIÈCE : jamais une pièce ANNULÉE, jamais un SPÉCIMEN, jamais
 *     une pièce non scellée.
 *  3. Cohérence canal ↔ submission, et modalité ↔ image.
 *  4. Identité résolue CÔTÉ SERVEUR pour le canal maison — jamais depuis l'entrée.
 *  5. Image sur R2, qui LÈVE si elle échoue. Une ligne sans objet serait un
 *     mensonge ; un objet sans ligne n'est qu'un déchet.
 *  6. En transaction : relire l'empreinte précédente de la MÊME pièce, construire
 *     le tuple, calculer `selfHash`, insérer, dériver `statutSignature`.
 *
 * L'image est écrite AVANT la transaction parce que R2 n'est pas transactionnel.
 * L'identifiant de ligne est donc généré en amont et sert aussi de clé R2 : sans
 * cela, l'objet et la ligne ne seraient rattachés par rien.
 *
 * ## Ce que ce service ne fait PAS, et ne doit pas faire
 *
 * ⚠️ Il ne pose JAMAIS `en_attente`, `refusee` ni `expiree`. Ces trois statuts
 * décrivent le cycle de vie d'une DEMANDE de signature (envoi, refus, péremption
 * d'un lien fournisseur), pas l'acte de signer. Les écrire ici les ferait osciller
 * au gré des signatures partielles.
 *
 * ⚠️ Il ne connaît AUCUNE matrice « quelles parties doivent signer quel type de
 * pièce ». Cette matrice appartient aux circuits (phases 4 à 7), qui la
 * possèdent réellement. Le service exige donc `partiesRequises` en entrée et
 * refuse une liste vide : dériver `signee` sans savoir qui devait signer serait
 * exactement le genre d'affirmation non fondée que ce chantier retire.
 *
 * Node runtime (Prisma + R2). Stub-aware pour le build SSG.
 */

import { randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "../../../../../prisma/generated/client";
import { prisma } from "@/lib/prisma";
import { resolveLegalIdentity } from "@/lib/legal-identity";
import { DOCUMENT_RETENTION_YEARS } from "@/server/qualiopi/legal/legal-mentions";
import { storeSignatureImage, supprimerImageSignature } from "@/server/qualiopi/emargement/storage";
import { peutEngager } from "@/server/auth/habilitations";
import { resoudreAppartenance, type RoleFormateur } from "@/server/formateur/session-membership";
import {
  calculerSelfHashDocument,
  HASH_VERSION_DOCUMENT,
  type MethodeSignatureDocument,
  type PartieSignataire,
  type ProviderSignature,
  type TupleDocumentSignatureV1,
} from "./document-signature-hash";
import { MENTION_VERSION_DOCUMENT, CONSENTEMENT_VERSION_DOCUMENT } from "./mentions-document";

/** Nombre de reprises sur conflit de chaîne. Au-delà, c'est autre chose qu'une course. */
const MAX_REPRISES_CHAINE = 3;

/**
 * Identité fournie par un canal EXTERNE, et son plafond probant.
 *
 * ⚠️ Employée uniquement là où le serveur ne PEUT PAS la résoudre : ce que le
 * certificat DocuSeal atteste, ou ce que l'organisme reverse d'une pièce signée
 * à la main. Dans les deux cas la garantie d'identité vient d'ailleurs — du
 * prestataire de confiance, ou de l'organisme lui-même, exactement comme avec
 * une feuille papier qu'un formateur fait circuler.
 *
 * 🔴 Ne JAMAIS l'utiliser sur le canal maison authentifié : là, l'identité est
 * connue du serveur, et l'accepter de l'appelant rouvrirait la faille déjà
 * corrigée côté collectif — « un stagiaire pouvait signer la feuille d'un
 * absent » parce que l'identité était lue d'un côté et l'autorisation de l'autre.
 */
export interface IdentiteFournie {
  nom: string;
  email?: string | null | undefined;
  qualite?: string | null | undefined;
}

/**
 * Qui appose la signature, et à quel titre.
 *
 * 🔴 OBLIGATOIRE, et c'est une garde d'AUTORISATION, pas une trace.
 */
export type PorteurSignatureDocument =
  | {
      /**
       * Canal B — le formateur signe depuis son espace authentifié. Son identité
       * est lue de `Trainer`, jamais de l'entrée, et son rattachement à la pièce
       * est vérifié.
       */
      type: "formateur_authentifie";
      trainerId: string;
      partie: PartieSignataire;
    }
  | {
      /**
       * Canal B — un membre de l'organisme signe (contresignature `axionia`,
       * responsable pédagogique). Identité lue de `AdminUser`.
       */
      type: "organisme_authentifie";
      adminId: string;
      partie: PartieSignataire;
    }
  | {
      /**
       * Canal D — le fournisseur a recueilli et CERTIFIÉ la signature. C'est la
       * seule voie qui produit un certificat opposable à un tiers.
       *
       * ⚠️ Ce service ne lit ni ne valide le webhook : il enregistre ce que
       * l'appelant a déjà authentifié. La vérification de la charge utile
       * appartient à la route de webhook (phases 4 à 6).
       */
      type: "fournisseur";
      provider: "docuseal";
      submissionId: string;
      partie: PartieSignataire;
      signataire: IdentiteFournie;
    }
  | {
      /**
       * Canal papier — l'organisme reverse au dossier une pièce signée à la main
       * (`physical_signed`) ou signée ailleurs (`manual_upload`).
       *
       * ⚠️ Plafond probant ASSUMÉ et documenté (plan II.2bis) : c'est l'organisme
       * qui atteste l'identité du signataire, comme avec une feuille papier. On
       * atteste l'INTÉGRITÉ de ce qui est versé, pas l'INDÉPENDANCE du recueil.
       */
      type: "reversement_papier";
      adminId: string;
      provider: "manual_upload" | "physical_signed";
      partie: PartieSignataire;
      signataire: IdentiteFournie;
    }
  | {
      /**
       * Canal A — maison, par LIEN PUBLIC à jeton. Le cas le plus courant du
       * contractuel : un client signe depuis un lien reçu par e-mail, sans
       * compte.
       *
       * 🔴 Aucune identité n'est acceptée de l'appelant, et c'est tout l'intérêt
       * de ce porteur. Elle a été FIGÉE à l'émission du lien, côté serveur,
       * depuis la fiche client, par une action d'administration authentifiée
       * (`token-document.ts`). Ce service la relit dans la ligne de jeton —
       * c'est-à-dire en BASE, comme l'exige la doctrine du canal maison.
       *
       * ⚠️ `tokenId` n'est PAS une trace : c'est la garde d'autorisation. Le
       * service revérifie lui-même que le jeton vise CETTE pièce, AU TITRE de
       * cette partie, et qu'il est toujours vivant. Il ne suppose jamais que la
       * couche action l'a fait — c'est la même défense en profondeur que partout
       * ailleurs ici.
       */
      type: "signataire_jeton";
      tokenId: string;
      partie: PartieSignataire;
    };

export type RefusSignatureDocument =
  | "piece_introuvable"
  | "piece_specimen"
  | "piece_non_scellee"
  /** La pièce a été annulée au registre : elle ne fait plus foi, elle ne se signe plus. */
  | "piece_annulee"
  | "porteur_non_autorise"
  | "partie_non_attendue"
  | "parties_requises_absentes"
  | "deja_signe"
  | "identite_non_resolvable"
  | "image_requise"
  | "image_interdite"
  | "submission_incoherente"
  | "conflit_concurrent"
  /** Canal A — le lien ne vise pas cette pièce, ou plus cette partie. */
  | "jeton_non_applicable"
  /** Canal A — lien révoqué ou périmé. Distingué : le client peut en redemander un. */
  | "jeton_inactif";

export type ResultatSignatureDocument =
  | {
      ok: true;
      signatureId: string;
      selfHash: string;
      /** Statut DÉRIVÉ posé sur la pièce à l'issue de cette signature. */
      statutSignature: "partielle" | "signee";
    }
  | { ok: false; raison: RefusSignatureDocument; message: string };

export interface EntreeSignatureDocument {
  /** Pièce signée (`DocumentGenere.id`). */
  documentGenereId: string;
  porteur: PorteurSignatureDocument;
  methode: MethodeSignatureDocument;
  /**
   * 🔴 Parties qui DOIVENT signer cette pièce pour qu'elle soit conclue.
   *
   * Exigée, et non déduite : voir l'en-tête. Le service s'en sert pour deux
   * choses — refuser une partie qui n'a rien à faire sur cette pièce, et dériver
   * `signee` plutôt que `partielle` sans rien inventer.
   */
  partiesRequises: readonly PartieSignataire[];
  /** Data-URL PNG/JPEG. Obligatoire sauf pour `confirmation_accessible`. */
  imageDataUrl?: string | undefined;
  ipHash?: string | null | undefined;
  userAgentSha256?: string | null | undefined;
  /** Injectable pour les tests. Jamais `new Date()` en dur dans la logique. */
  maintenant?: Date | undefined;
}

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

const MESSAGES: Record<RefusSignatureDocument, string> = {
  piece_introuvable: "Pièce introuvable.",
  piece_specimen:
    "Cette pièce est un SPÉCIMEN, sans valeur juridique : l'identité de l'organisme est incomplète. Renseignez-la dans Qualiopi › Configuration, régénérez la pièce, puis faites-la signer.",
  piece_non_scellee:
    "Cette pièce n'a pas d'empreinte : rien ne permettrait de prouver plus tard quel document a été signé.",
  piece_annulee:
    "Cette pièce a été annulée : elle ne fait plus foi et ne peut plus être signée. Votre interlocuteur vous adressera la version qui la remplace.",
  porteur_non_autorise: "Vous n'êtes pas autorisé à signer cette pièce à ce titre.",
  partie_non_attendue: "Cette partie n'a pas à signer cette pièce.",
  parties_requises_absentes:
    "Les parties devant signer cette pièce ne sont pas déclarées : impossible de savoir si sa signature est complète.",
  deja_signe: "Cette pièce a déjà été signée à ce titre.",
  identite_non_resolvable:
    "L'identité du signataire n'est pas renseignée. Une signature sans signataire identifié ne prouve rien : l'organisme doit la renseigner.",
  image_requise: "Aucune signature n'a été tracée.",
  image_interdite:
    "Une confirmation accessible ne s'accompagne pas d'un tracé : transmettre une image ici présenterait comme manuscrite une signature qui ne l'est pas.",
  submission_incoherente:
    "Le canal de signature et l'identifiant de submission ne concordent pas : une ligne maison ne peut pas porter d'identifiant fournisseur, et l'inverse.",
  conflit_concurrent:
    "Une autre signature est en cours d'enregistrement sur cette pièce. Réessayez dans un instant.",
  jeton_non_applicable:
    "Ce lien de signature ne correspond pas à cette pièce, ou pas à ce titre. Demandez un nouveau lien à votre interlocuteur.",
  jeton_inactif:
    "Ce lien de signature n'est plus valable : il a expiré ou a été remplacé. Demandez-en un nouveau à votre interlocuteur.",
};

function refus(raison: RefusSignatureDocument): ResultatSignatureDocument {
  return { ok: false, raison, message: MESSAGES[raison] };
}

/**
 * Supprime une image déjà écrite quand la ligne ne sera finalement pas créée.
 *
 * 🔴 Sans ce nettoyage, l'objet reste sur R2 SANS ligne qui le référence. La
 * purge RGPD part de `signatureKey` : un objet orphelin est donc introuvable et
 * ineffaçable, conservé cinq ans par la règle de cycle de vie. Or le tracé
 * rasterisé est une donnée personnelle (art. 6).
 *
 * ⚠️ N'échoue JAMAIS bruyamment : un nettoyage raté ne doit pas masquer le refus
 * qui l'a déclenché, qui est l'information utile à l'appelant.
 */
async function nettoyerImageOrpheline(image: { key: string } | null): Promise<void> {
  if (image === null) return;
  try {
    await supprimerImageSignature(image.key);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "signerDocument:nettoyage_orphelin" },
      extra: { key: image.key },
    });
  }
}

/** Contexte complet nécessaire pour figer le tuple, lu en une requête. */
async function lirePiece(documentGenereId: string, partie: PartieSignataire) {
  return prisma.documentGenere.findUnique({
    where: { id: documentGenereId },
    select: {
      id: true,
      numero: true,
      type: true,
      hashSha256: true,
      metadata: true,
      sessionId: true,
      // 🔴 Le SORT de la pièce entre dans la décision de signer. Il n'y entrait
      // pas : `verifierJeton` pesait cinq conditions — existence, pièce visée,
      // partie, révocation, péremption — dont aucune ne regardait si la pièce
      // faisait encore foi. Un lien légitimement émis, porté par son
      // destinataire légitime, signait donc une pièce annulée.
      annuleeAt: true,
      signatures: {
        where: { partie, revokedAt: null },
        select: { id: true },
        take: 1,
      },
      // 2026-08-10 (décision Will) : la lecture `coachingSession.trainerId` a
      // été retirée avec le module AFEST 1-to-1 — plus aucune pièce SIGNABLE
      // n'est rattachée à un parcours coaching. La garde collective (session)
      // ci-dessous est intacte.
      // 🔴 `formateurPrincipalId` EST lu, et ce n'est pas du zèle.
      //
      // La première version de ce service ne regardait que `sessionFormateurs`.
      // Or `resoudreAppartenance` — source de vérité de l'appartenance dans tout
      // le dépôt — pose que la FK `formateurPrincipalId` PRIME, et rien ne
      // garantit qu'une ligne `SessionFormateur` accompagne toujours la FK
      // (aucun dual-write n'a été trouvé). Résultat : le formateur principal
      // d'une session était autorisé par la couche action, puis REFUSÉ ici avec
      // `porteur_non_autorise` — un refus qui n'a aucun sens pour lui, sur sa
      // propre session.
      //
      // Échec « fermé » donc sans faille de sécurité, mais une garde qui bloque
      // le seul ayant droit ne protège rien : elle casse.
      session: {
        select: {
          formateurPrincipalId: true,
          sessionFormateurs: { select: { trainerId: true, role: true } },
        },
      },
    },
  });
}

type ContextePiece = NonNullable<Awaited<ReturnType<typeof lirePiece>>>;

/**
 * Vrai si la pièce a été déclassée en SPÉCIMEN faute d'identité d'organisme.
 *
 * 🔴 Un SPÉCIMEN porte un filigrane « sans valeur juridique ». Le faire signer
 * produirait une preuve d'engagement sur une pièce qui affirme elle-même n'en
 * être pas une — la contradiction exacte qu'un contrôle relève.
 *
 * ⚠️ `metadata` est une colonne `Json` : son type n'est PAS garanti côté
 * application. On teste la forme au lieu de caster.
 */
function estSpecimen(metadata: unknown): boolean {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>)["specimen"] === true;
}

/** Identité FIGÉE du signataire, résolue côté serveur pour le canal maison. */
interface IdentiteSignataire {
  nom: string;
  email: string | null;
  qualite: string | null;
  /**
   * Membre de l'organisme qui ATTESTE le recueil, quand il y en a un.
   *
   * `null` quand la personne a signé depuis son propre accès (elle répond
   * d'elle-même) ou quand un tiers a certifié la signature (il en répond).
   */
  recueilliParAdminId: string | null;
}

function nettoyer(valeur: string | null | undefined): string | null {
  const v = (valeur ?? "").trim();
  return v === "" ? null : v;
}

/**
 * Résout l'identité du signataire.
 *
 * 🔴 Sur le canal maison, elle est lue de la BASE, jamais de l'entrée. Sceller
 * un nom fourni par l'appelant produirait une signature dont l'identité serait
 * exactement ce que l'appelant a bien voulu déclarer.
 *
 * Et quand elle n'est pas résolvable, on REFUSE plutôt que de fabriquer : sceller
 * un repli littéral (« Le formateur ») dans un tuple haché produirait une
 * signature juridiquement anonyme — précisément le défaut que ce chantier a
 * déjà retiré ailleurs dans le dépôt.
 */
async function resoudreIdentite(
  porteur: PorteurSignatureDocument,
  /** Jeton déjà relu et validé, sur le canal A uniquement. */
  jeton: JetonPorteur | null,
): Promise<
  | { ok: true; identite: IdentiteSignataire }
  | { ok: false; raison: "identite_non_resolvable" | "porteur_non_autorise" }
> {
  // Canal A — l'identité vient de la LIGNE DE JETON, pas de l'entrée.
  //
  // 🔴 `jeton === null` ici serait un bug d'ordonnancement, pas une entrée
  // invalide : `signerDocument` valide le jeton AVANT d'appeler cette fonction.
  // On refuse plutôt que de retomber sur l'entrée — un repli silencieux
  // rouvrirait exactement la faille que ce porteur ferme.
  if (porteur.type === "signataire_jeton") {
    if (jeton === null) return { ok: false, raison: "porteur_non_autorise" };
    const nom = nettoyer(jeton.signataireNom);
    if (nom === null) return { ok: false, raison: "identite_non_resolvable" };
    return {
      ok: true,
      identite: {
        nom,
        email: nettoyer(jeton.signataireEmail),
        qualite: nettoyer(jeton.signataireQualite),
        // Le signataire agit depuis son propre lien nominatif : il répond de
        // lui-même. L'organisme n'atteste pas son identité — il l'a seulement
        // figée à l'émission, ce que `createdIpHash` et `createdAt` tracent.
        recueilliParAdminId: null,
      },
    };
  }

  if (porteur.type === "formateur_authentifie") {
    const t = await prisma.trainer.findUnique({
      where: { id: porteur.trainerId },
      select: { nom: true, prenom: true, email: true },
    });
    const nom = nettoyer(`${t?.prenom ?? ""} ${t?.nom ?? ""}`);
    if (t === null || nom === null) return { ok: false, raison: "identite_non_resolvable" };
    return {
      ok: true,
      identite: {
        nom,
        email: nettoyer(t.email),
        qualite: "Formateur",
        // Il signe depuis son propre accès : personne n'atteste à sa place.
        recueilliParAdminId: null,
      },
    };
  }

  if (porteur.type === "organisme_authentifie") {
    const a = await habiliter(porteur.adminId);
    if (a === null) return { ok: false, raison: "identite_non_resolvable" };

    // 🔴 Ce qui doit figurer au bas d'une convention, c'est la personne qui
    // ENGAGE la société et sa QUALITÉ — pas le libellé du compte qui a cliqué.
    // Le contreseing de la première convention réelle portait « Will (Super
    // Admin) », sans qualité, face à un client correctement identifié
    // (« Simone Blanc — Associée avec pouvoir d'engager la société ») : un rôle
    // applicatif tenait lieu de qualité sociale, dans le cadre « Nom, qualité ».
    //
    // Le compte reste tracé par `recueilliParAdminId` : on sait toujours QUI a
    // apposé la signature, tout en imprimant AU NOM DE QUI elle l'est.
    const legal = await resolveLegalIdentity();
    const nom = nettoyer(legal.representantNom) ?? a.nom;
    return {
      ok: true,
      identite: {
        nom,
        email: a.email,
        qualite: nettoyer(legal.representantQualite),
        recueilliParAdminId: porteur.adminId,
      },
    };
  }

  const nom = nettoyer(porteur.signataire.nom);
  if (nom === null) return { ok: false, raison: "identite_non_resolvable" };

  // 🔴 Sur le canal papier, c'est l'ORGANISME qui atteste l'identité d'un tiers.
  // Le membre qui verse la pièce doit donc exister, être actif et habilité — et
  // il est ENREGISTRÉ. Sans cela, `adminId` serait un paramètre décoratif : un
  // contrôle qu'on croit exercer et qui n'existe pas.
  if (porteur.type === "reversement_papier") {
    const a = await habiliter(porteur.adminId);
    if (a === null) return { ok: false, raison: "porteur_non_autorise" };
    return {
      ok: true,
      identite: {
        nom,
        email: nettoyer(porteur.signataire.email),
        qualite: nettoyer(porteur.signataire.qualite),
        recueilliParAdminId: porteur.adminId,
      },
    };
  }

  return {
    ok: true,
    identite: {
      nom,
      email: nettoyer(porteur.signataire.email),
      qualite: nettoyer(porteur.signataire.qualite),
      // Le fournisseur certifie lui-même : l'organisme n'atteste rien de plus.
      recueilliParAdminId: null,
    },
  };
}

/**
 * Le compte d'administration existe-t-il, est-il actif, et a-t-il le pouvoir
 * d'engager l'organisme ?
 *
 * 🔴 Trois conditions, et aucune n'est superflue. Un compte SUSPENDU signant une
 * convention est une signature apposée par quelqu'un dont on a précisément
 * révoqué les droits. Un compte `reader` ou `editor` n'a jamais reçu le pouvoir
 * de conclure : lui laisser écrire une ligne `axionia` fabriquerait un
 * engagement de l'organisme par une personne non habilitée.
 */
async function habiliter(adminId: string): Promise<{ nom: string; email: string | null } | null> {
  const a = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { name: true, email: true, status: true, role: true },
  });
  if (a === null || a.status !== "active" || !ROLES_ADMIN_HABILITES.has(a.role)) return null;
  const nom = nettoyer(a.name);
  if (nom === null) return null;
  return { nom, email: nettoyer(a.email) };
}

/** Canal de la ligne, déduit du porteur — jamais de l'entrée. */
function providerDuPorteur(porteur: PorteurSignatureDocument): ProviderSignature {
  switch (porteur.type) {
    case "formateur_authentifie":
    case "organisme_authentifie":
    // Canal A : maison, comme B. L'identité vient de la base dans les deux cas —
    // seul le MOMENT où elle y a été résolue diffère (émission vs signature).
    case "signataire_jeton":
      return "interne";
    case "fournisseur":
      return porteur.provider;
    case "reversement_papier":
      return porteur.provider;
  }
}

/**
 * 🔴 Parties qu'un LIEN PUBLIC ne peut jamais porter.
 *
 * Un jeton engage un tiers ; il ne doit pas pouvoir engager l'organisme ni
 * attester au titre de la responsabilité pédagogique. Sans cette garde, un lien
 * mal émis — ou une émission détournée — ferait contresigner l'organisme par la
 * personne même à qui il envoie la pièce, et la convention paraîtrait conclue.
 *
 * ⚠️ Doublon DÉLIBÉRÉ avec la garde d'émission : l'émission décide, celle-ci
 * garantit. C'est la même défense en profondeur que `PARTIES_PAR_CANAL_AUTHENTIFIE`.
 */
const PARTIES_INTERDITES_AU_JETON: ReadonlySet<PartieSignataire> = new Set([
  "axionia",
  "responsable_pedagogique",
]);

/** Ligne de jeton, relue pour AUTORISER puis pour figer l'identité. */
interface JetonPorteur {
  documentGenereId: string;
  partie: PartieSignataire;
  signataireNom: string;
  signataireEmail: string | null;
  signataireQualite: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
}

/**
 * Relit le jeton et vérifie qu'il vise bien CETTE pièce, À CE TITRE, et qu'il
 * est encore vivant.
 *
 * 🔴 Le service ne suppose jamais que la couche action a vérifié : c'est ici que
 * l'autorisation se joue, parce que c'est ici que la ligne de preuve s'écrit.
 */
async function verifierJeton(
  ctx: ContextePiece,
  tokenId: string,
  partie: PartieSignataire,
  maintenant: Date,
): Promise<
  | { ok: true; jeton: JetonPorteur }
  | { ok: false; raison: "jeton_non_applicable" | "jeton_inactif" }
> {
  const jeton = await prisma.documentSignatureToken.findUnique({
    where: { id: tokenId },
    select: {
      documentGenereId: true,
      partie: true,
      signataireNom: true,
      signataireEmail: true,
      signataireQualite: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
  if (jeton === null) return { ok: false, raison: "jeton_non_applicable" };
  // Le lien vise-t-il cette pièce, et le porteur signe-t-il au titre que le lien
  // lui donne ? Les deux, sinon un lien légitime servirait sur une autre pièce.
  if (jeton.documentGenereId !== ctx.id) return { ok: false, raison: "jeton_non_applicable" };
  if (jeton.partie !== partie) return { ok: false, raison: "jeton_non_applicable" };
  if (PARTIES_INTERDITES_AU_JETON.has(partie)) return { ok: false, raison: "jeton_non_applicable" };
  if (jeton.revokedAt !== null) return { ok: false, raison: "jeton_inactif" };
  if (jeton.expiresAt.getTime() <= maintenant.getTime()) {
    return { ok: false, raison: "jeton_inactif" };
  }
  return { ok: true, jeton };
}

/**
 * 🔴 Parties qu'un canal AUTHENTIFIÉ a le droit d'écrire.
 *
 * Sans cette table, un formateur authentifié sur une session pouvait signer la
 * convention à la place du CLIENT : le porteur était autorisé sur la pièce, et
 * plus rien ne recoupait le titre auquel il signait. L'identité scellée aurait
 * été la sienne, mais la ligne aurait dit « le client a accepté ».
 *
 * C'est la classe de faille déjà corrigée sur ce dépôt — côté collectif
 * (« un stagiaire pouvait signer la feuille d'un absent »).
 *
 * ⚠️ Les canaux NON authentifiés (fournisseur, reversement papier) ne sont pas
 * dans cette table, et c'est délibéré : là, la partie signataire est celle que
 * le certificat du tiers ou la feuille papier désigne. L'organisme en répond, et
 * `recueilliParAdminId` dit qui.
 */
const PARTIES_PAR_CANAL_AUTHENTIFIE: Readonly<
  Record<"formateur_authentifie" | "organisme_authentifie", readonly PartieSignataire[]>
> = {
  // Un formateur signe en tant que formateur. Rien d'autre.
  formateur_authentifie: ["formateur"],
  // Un membre de l'organisme engage l'organisme, ou atteste au titre de la
  // responsabilité pédagogique. Il ne signe jamais pour un client ni un financeur.
  organisme_authentifie: ["axionia", "responsable_pedagogique"],
};

/**
 * Rôles habilités à engager l'organisme ou à verser une preuve au dossier.
 *
 * 🔴 Cette constante était, jusqu'au 2026-08-15, la SEULE expression serveur de
 * la frontière « engage l'organisme » — non exportée, un seul site d'appel,
 * pendant que 311 autres actes passaient par `requireAdminWrite` (qui autorise
 * `editor`). Elle délègue désormais au SSOT `@/server/auth/habilitations` :
 * deux définitions de la même frontière divergeraient un jour, et ce serait
 * celle qu'on a oublié de durcir qui servirait.
 */
const ROLES_ADMIN_HABILITES = {
  has: (role: string): boolean => peutEngager(role, "contresigner"),
};

/**
 * Le porteur a-t-il quelque chose à voir avec cette pièce, et signe-t-il au bon
 * titre ?
 *
 * Un formateur authentifié n'est pas pour autant rattaché à TOUTE pièce du
 * dépôt : sans ce recoupement, n'importe quel formateur pourrait signer la
 * convention d'une session qu'il n'anime pas — en son nom, puisque l'identité
 * est lue côté serveur.
 */
function porteurAutorise(ctx: ContextePiece, porteur: PorteurSignatureDocument): boolean {
  if (porteur.type === "formateur_authentifie" || porteur.type === "organisme_authentifie") {
    if (!PARTIES_PAR_CANAL_AUTHENTIFIE[porteur.type].includes(porteur.partie)) return false;
  }
  if (porteur.type !== "formateur_authentifie") return true;
  // 2026-08-10 (décision Will) : la branche « formateur du parcours coaching
  // rattaché » a été retirée avec le module AFEST 1-to-1 ; l'appartenance à la
  // SESSION collective reste la seule voie d'autorisation d'un formateur.
  if (ctx.session === null) return false;

  // 🔴 On délègue à `resoudreAppartenance`, source de vérité UNIQUE de
  // l'appartenance formateur↔session dans tout le dépôt. Réimplémenter la règle
  // ici — ce que faisait la première version — c'était exactement l'erreur que
  // les commentaires de ce fichier dénoncent par ailleurs : une garde
  // d'autorisation dupliquée est l'endroit où les deux copies divergent en
  // silence. Elles avaient déjà divergé.
  return resoudreAppartenance({
    estPrincipalFk: ctx.session.formateurPrincipalId === porteur.trainerId,
    roleSessionFormateur:
      (ctx.session.sessionFormateurs.find((f) => f.trainerId === porteur.trainerId)?.role as
        RoleFormateur | undefined) ?? null,
  }).estMembre;
}

/**
 * Enregistre la signature d'UNE pièce par UNE partie.
 *
 * ⚠️ Ne retourne JAMAIS un succès silencieux : soit la ligne est écrite et son
 * image stockée, soit un refus typé remonte. Une panne de stockage lève
 * (`SignatureStockageError`) et n'est pas rattrapée ici — l'appelant doit
 * refuser la signature, pas la simuler.
 */
export async function signerDocument(
  input: EntreeSignatureDocument,
): Promise<ResultatSignatureDocument> {
  if (estStub()) return refus("piece_introuvable");

  const maintenant = input.maintenant ?? new Date();
  const { porteur } = input;
  const { partie } = porteur;
  const provider = providerDuPorteur(porteur);

  const ctx = await lirePiece(input.documentGenereId, partie);
  if (ctx === null) return refus("piece_introuvable");

  // ── 1. GARDE D'AUTORISATION — avant toute autre vérification métier ──
  if (!porteurAutorise(ctx, porteur)) {
    Sentry.captureException(new Error("Signature de document tentée hors périmètre du porteur"), {
      tags: { action: "signerDocument:porteur_non_autorise" },
      extra: { documentGenereId: input.documentGenereId, typePorteur: porteur.type },
    });
    return refus("porteur_non_autorise");
  }

  // Canal A — la garde d'autorisation est le JETON lui-même, et elle est en
  // base : elle ne peut donc pas tenir dans `porteurAutorise`, qui est pur.
  // Placée ICI, au même rang que les autres gardes d'autorisation, et AVANT
  // qu'on apprenne quoi que ce soit sur l'état de signature de la pièce.
  let jeton: JetonPorteur | null = null;
  if (porteur.type === "signataire_jeton") {
    const v = await verifierJeton(ctx, porteur.tokenId, partie, maintenant);
    if (!v.ok) {
      // Seul le non-applicable est anormal : un lien périmé est un événement
      // ordinaire, et le remonter à Sentry noierait les vraies tentatives.
      if (v.raison === "jeton_non_applicable") {
        Sentry.captureException(new Error("Jeton de signature présenté hors de son périmètre"), {
          tags: { action: "signerDocument:jeton_non_applicable" },
          extra: { documentGenereId: input.documentGenereId, partie },
        });
      }
      return refus(v.raison);
    }
    jeton = v.jeton;
  }

  // Placé APRÈS l'autorisation : sinon un appelant qui devine un identifiant de
  // pièce apprend si une autre partie a déjà signé.
  if (ctx.signatures.length > 0) return refus("deja_signe");

  // ── 2. GARDES SUR LA PIÈCE ──
  //
  // 🔴 Annulée d'abord. La doctrine est déjà écrite dans ce dépôt
  // (`audit-dossier.ts`) : « une pièce annulée ne se compte NULLE PART ».
  // Elle ne se signe donc pas non plus — signer, c'est ajouter une preuve
  // d'engagement à un document dont l'organisme a lui-même déclaré qu'il ne
  // valait plus rien.
  //
  // ⚠️ Ce qui fait la gravité n'est pas la ligne écrite, ce sont ses SUITES
  // AUTOMATIQUES : `consequenceSignatureComplete` (piece-signature.ts) envoie
  // les questionnaires de positionnement à des stagiaires réels dès qu'une
  // convention ou un contrat passe `signee`, et fait basculer un devis en
  // `accepte`. Aucun écran humain ne s'interpose entre la signature et l'effet.
  //
  // ⚠️ AUCUNE exception, canal papier compris. Le reversement d'une signature
  // manuscrite recueillie AVANT l'annulation serait le seul cas légitime — mais
  // ce porteur n'a aucun appelant dans le dépôt, et le service n'accepte pas de
  // date de recueil distincte de `maintenant` : il ne pourrait donc pas établir
  // l'antériorité qui justifierait l'exception. L'ouvrir sur une promesse
  // reviendrait à rouvrir le défaut pour le seul canal où personne ne regarde.
  if (ctx.annuleeAt !== null) return refus("piece_annulee");
  if (estSpecimen(ctx.metadata)) return refus("piece_specimen");
  // `hashSha256` est l'empreinte du PDF. Vide, la signature ne porterait sur rien
  // de vérifiable — et `documentHashSha256` est scellé dans le tuple.
  if (nettoyer(ctx.hashSha256) === null) return refus("piece_non_scellee");

  // ── 3. COHÉRENCES DE FORME ──
  //
  // Les mêmes invariants que les CHECK de la base, refusés ici pour rendre un
  // message utile plutôt qu'une violation de contrainte. ⚠️ Les CHECK RESTENT :
  // c'est la base qui garantit, ce code qui explique.
  if (input.partiesRequises.length === 0) return refus("parties_requises_absentes");
  if (!input.partiesRequises.includes(partie)) return refus("partie_non_attendue");

  const submissionId = porteur.type === "fournisseur" ? porteur.submissionId.trim() : null;
  if ((provider === "docuseal") !== (submissionId !== null && submissionId !== "")) {
    return refus("submission_incoherente");
  }

  const imageFournie = input.imageDataUrl !== undefined && input.imageDataUrl !== "";
  if (input.methode === "confirmation_accessible") {
    if (imageFournie) return refus("image_interdite");
  } else if (!imageFournie) {
    // `trace` sans image, `papier_scanne` sans scan : dans les deux cas la ligne
    // affirmerait l'existence d'une pièce que personne ne pourra produire.
    return refus("image_requise");
  }

  // ── 4. IDENTITÉ, résolue côté serveur sur le canal maison ──
  const resolution = await resoudreIdentite(porteur, jeton);
  if (!resolution.ok) return refus(resolution.raison);
  const {
    nom: signataireNom,
    email: signataireEmail,
    qualite: signataireQualite,
    recueilliParAdminId,
  } = resolution.identite;

  // ── Identifiant généré ICI : clé primaire ET clé R2 ──
  const signatureId = randomUUID();

  // ── 5. Image AVANT la transaction : R2 n'est pas transactionnel. LÈVE si échec ──
  //
  // Genre `signatures` — surtout PAS un troisième genre : `CLE_SIGNATURE_RE` et
  // la purge RGPD ne connaissent que `signatures` et `contresignatures`, et un
  // genre inconnu produirait des images ineffaçables. Les clés sont des UUID :
  // partager le préfixe avec l'émargement ne crée aucune collision.
  let image: { key: string; sha256: string; mimeType: string; sizeBytes: number } | null = null;
  if (imageFournie && input.imageDataUrl !== undefined) {
    image = await storeSignatureImage({
      dataUrl: input.imageDataUrl,
      genre: "signatures",
      signeAt: maintenant,
      id: signatureId,
    });
  }

  const suppressionPrevueAt = new Date(maintenant);
  suppressionPrevueAt.setFullYear(suppressionPrevueAt.getFullYear() + DOCUMENT_RETENTION_YEARS);

  const socle = {
    contexteType: "document_engagement" as const,
    documentGenereId: ctx.id,
    documentNumero: ctx.numero,
    documentType: ctx.type,
    documentHashSha256: ctx.hashSha256,
    partie,
    provider,
    providerSubmissionId: submissionId,
    signataireNom,
    signataireEmail,
    signataireQualite,
    methode: input.methode,
    signatureSha256: image?.sha256 ?? null,
    mentionVersion: MENTION_VERSION_DOCUMENT,
    consentementVersion: CONSENTEMENT_VERSION_DOCUMENT,
    signeAtIso: maintenant.toISOString(),
  };

  const requises = new Set(input.partiesRequises);

  // ── 6. Insertion, avec reprise sur conflit de chaîne ──
  for (let essai = 0; essai < MAX_REPRISES_CHAINE; essai++) {
    try {
      const cree = await prisma.$transaction(async (tx) => {
        // 🔴 L'ordre de la chaîne est celui de l'INSERTION (`createdAt`), jamais
        // celui de `signeAt` : ce dernier est figé AVANT l'écriture de l'image sur
        // R2 (sharp + aller-retour réseau, 100 à 500 ms), et il peut de surcroît
        // venir d'un tiers, qui ne garantit aucune monotonie. Deux parties signant
        // depuis deux postes peuvent donc commiter dans l'ordre INVERSE de leurs
        // `signeAt`. Un lecteur triant dessus verrait une tête de chaîne à
        // `prevHash` non nul puis une rupture : « registre corrompu », à tort et
        // définitivement — la table est append-only.
        //
        // ⚠️ TOUT vérificateur doit trier À L'IDENTIQUE.
        const precedente = await tx.documentSignature.findFirst({
          where: { documentGenereId: ctx.id, revokedAt: null },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { selfHash: true },
        });
        const prevHash = precedente?.selfHash ?? null;

        const tuple: TupleDocumentSignatureV1 = { ...socle, prevHash };
        const selfHash = calculerSelfHashDocument(tuple);

        const sig = await tx.documentSignature.create({
          data: {
            id: signatureId,
            documentGenereId: ctx.id,
            provider,
            providerSubmissionId: submissionId,
            partie,
            signataireNom,
            signataireEmail,
            signataireQualite,
            documentHashSha256: ctx.hashSha256,
            methode: input.methode,
            recueilliParAdminId,
            signatureKey: image?.key ?? null,
            signatureSha256: image?.sha256 ?? null,
            mimeType: image?.mimeType ?? null,
            sizeBytes: image?.sizeBytes ?? null,
            prevHash,
            selfHash,
            hashVersion: HASH_VERSION_DOCUMENT,
            mentionVersion: MENTION_VERSION_DOCUMENT,
            consentementVersion: CONSENTEMENT_VERSION_DOCUMENT,
            signeAt: maintenant,
            ipHash: input.ipHash ?? null,
            userAgentSha256: input.userAgentSha256 ?? null,
            suppressionPrevueAt,
          },
          select: { id: true, selfHash: true },
        });

        // 🔴 Statut DÉRIVÉ, dans la MÊME transaction que la preuve.
        //
        // Ce n'est pas une source de vérité : la source, ce sont les lignes
        // ci-dessus. C'est un cache de lecture, pour que le registre et les
        // dossiers n'aient pas à recharger la chaîne à chaque rendu.
        //
        // ⚠️ Relu DANS la transaction, jamais compté depuis le contexte lu en
        // amont : deux parties signant en parallèle laisseraient sinon la pièce
        // à `partielle` alors qu'elle est complète.
        const signees = await tx.documentSignature.findMany({
          where: { documentGenereId: ctx.id, revokedAt: null },
          select: { partie: true },
        });
        const posees = new Set(signees.map((s) => s.partie));
        const complet = [...requises].every((p) => posees.has(p));
        const statutSignature = complet ? ("signee" as const) : ("partielle" as const);

        await tx.documentGenere.update({
          where: { id: ctx.id },
          data: { statutSignature },
        });

        return { ...sig, statutSignature };
      });

      return {
        ok: true,
        signatureId: cree.id,
        selfHash: cree.selfHash,
        statutSignature: cree.statutSignature,
      };
    } catch (err) {
      const conflit = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!conflit) {
        await nettoyerImageOrpheline(image);
        throw err;
      }

      // Deux causes possibles, et une seule se réessaie : une course sur la
      // chaîne (deux parties en parallèle) se résout en relisant l'empreinte
      // précédente ; une signature déjà posée par cette partie est définitive.
      //
      // ⚠️ On NE lit PAS `err.meta.target` : sa forme pour un index unique
      // PARTIEL créé en SQL brut n'est garantie nulle part, et un `undefined`
      // ferait passer une signature déjà posée pour une course. On interroge la
      // base, qui répond sans ambiguïté.
      const dejaPose = await prisma.documentSignature.count({
        where: { documentGenereId: ctx.id, partie, revokedAt: null },
      });
      if (dejaPose > 0) {
        await nettoyerImageOrpheline(image);
        return refus("deja_signe");
      }
      if (essai === MAX_REPRISES_CHAINE - 1) {
        Sentry.captureException(err, {
          tags: { action: "signerDocument:conflit_chaine" },
          extra: { documentGenereId: input.documentGenereId, essais: MAX_REPRISES_CHAINE },
        });
        await nettoyerImageOrpheline(image);
        return refus("conflit_concurrent");
      }
    }
  }

  return refus("conflit_concurrent");
}

// ─────────────────────────────────────────────────────────────────────────────
// Révocation
// ─────────────────────────────────────────────────────────────────────────────

export type RefusRevocationDocument =
  | "signature_introuvable"
  | "deja_revoquee"
  | "motif_requis"
  | "porteur_non_autorise"
  | "revocation_maillon_interne_interdite";

export type ResultatRevocationDocument =
  { ok: true } | { ok: false; raison: RefusRevocationDocument; message: string };

/**
 * Révoque une signature de document.
 *
 * 🔴 REFUSE de révoquer un maillon NON TERMINAL de sa chaîne.
 *
 * La relecture filtre sur `WHERE revoked_at IS NULL`. Révoquer un maillon
 * interne ferait donc disparaître le prédécesseur de son successeur, dont le
 * `prevHash` pointerait alors dans le vide : `verifierChaine` rendrait
 * `rupture_chainage` — c'est-à-dire, dans un dossier de contrôle, « une ligne a
 * été supprimée après coup ». Sur une correction parfaitement légitime.
 *
 * La correction se fait donc par révocation EN CASCADE depuis la queue de
 * chaîne, puis re-signature dans l'ordre. C'est plus fastidieux, et c'est le
 * prix d'un registre dont les anomalies veulent dire quelque chose.
 *
 * ⚠️ Cas concret que cela couvre : une convention signée par le client puis par
 * l'organisme, dont on veut retirer la seule signature du client. Il faut
 * d'abord révoquer celle de l'organisme. Le message le dit.
 */
export async function revoquerSignatureDocument(input: {
  signatureId: string;
  motif: string;
  /**
   * 🔴 Qui révoque. Une révocation non imputée est une preuve retirée par
   * personne — et c'est précisément ce qu'un auditeur cherche à savoir.
   */
  parAdminId: string;
  maintenant?: Date;
}): Promise<ResultatRevocationDocument> {
  if (estStub()) {
    return { ok: false, raison: "signature_introuvable", message: "Base indisponible." };
  }
  const maintenant = input.maintenant ?? new Date();

  // Un motif vide est un motif absent : il ne dit rien à l'auditeur, et le CHECK
  // de la base le refuserait de toute façon — autant rendre un message utile.
  const motif = input.motif.trim();
  if (motif === "") {
    return {
      ok: false,
      raison: "motif_requis",
      message: "Indiquez le motif de la révocation : sans lui, le registre ne dit rien.",
    };
  }

  // Même exigence qu'à la signature : retirer une preuve du dossier engage
  // l'organisme autant que l'y verser.
  if ((await habiliter(input.parAdminId)) === null) {
    return {
      ok: false,
      raison: "porteur_non_autorise",
      message: "Vous n'êtes pas habilité à révoquer une signature.",
    };
  }

  const ligne = await prisma.documentSignature.findUnique({
    where: { id: input.signatureId },
    select: { id: true, documentGenereId: true, selfHash: true, revokedAt: true },
  });
  if (ligne === null) {
    return { ok: false, raison: "signature_introuvable", message: "Signature introuvable." };
  }
  if (ligne.revokedAt !== null) {
    return { ok: false, raison: "deja_revoquee", message: "Cette signature est déjà révoquée." };
  }

  const successeur = await prisma.documentSignature.count({
    where: {
      documentGenereId: ligne.documentGenereId,
      revokedAt: null,
      prevHash: ligne.selfHash,
    },
  });
  if (successeur > 0) {
    return {
      ok: false,
      raison: "revocation_maillon_interne_interdite",
      message:
        "Cette signature n'est pas la dernière apposée sur cette pièce : la révoquer romprait le chaînage et ferait apparaître le registre comme falsifié. Révoquez d'abord les signatures postérieures, puis re-signez dans l'ordre.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.documentSignature.update({
      where: { id: ligne.id },
      data: {
        revokedAt: maintenant,
        revokedMotif: motif.slice(0, 500),
        revokedById: input.parAdminId,
      },
    });
    // La pièce redevient au mieux `partielle` : une pièce dont on vient de
    // retirer une signature n'est plus conclue. Laisser `signee` en place ferait
    // du statut dérivé un mensonge — et c'est lui que les dossiers affichent.
    //
    // ⚠️ On ne remet PAS `non_requise` quand il ne reste aucune signature : la
    // pièce EXIGE toujours d'être signée, elle ne l'est simplement plus.
    const restantes = await tx.documentSignature.count({
      where: { documentGenereId: ligne.documentGenereId, revokedAt: null },
    });
    await tx.documentGenere.update({
      where: { id: ligne.documentGenereId },
      data: { statutSignature: restantes > 0 ? "partielle" : "en_attente" },
    });
  });

  return { ok: true };
}
