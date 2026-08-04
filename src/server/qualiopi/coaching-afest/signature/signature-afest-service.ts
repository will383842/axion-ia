/**
 * AFEST 1-to-1 — Service de signature d'une séance.
 *
 * C'est le SEUL endroit du dépôt qui écrit une signature AFEST. Tout le reste
 * du module (canonicalisation, empreinte, chaînage, mentions, garde temporelle)
 * n'existe que pour lui.
 *
 * ## Ce qu'il remplace
 *
 * `signerSeance1to1Action` posait quatre booléens horodatés sur simple clic
 * administrateur, et le PDF les rendait « signé ». Aucun signataire identifié,
 * aucune image, aucune empreinte : rien qui satisfasse l'art. 1366 C. civ.
 *
 * ## L'ordre des opérations n'est pas négociable
 *
 *  1. Résoudre et AUTORISER le porteur — avant toute autre vérification métier.
 *  2. Garde temporelle PAR SÉANCE (`seances-signables.ts`).
 *  3. Garde d'identité, SYMÉTRIQUE sur les trois rôles.
 *  4. Horaires réels, ou refus — jamais un « 09h00–17h00 » inventé.
 *  5. Binding e-mail du canal B.
 *  6. Image sur R2, qui LÈVE si elle échoue. Une ligne sans objet serait un
 *     mensonge ; un objet sans ligne n'est qu'un déchet.
 *  7. En transaction : relire l'empreinte précédente du MÊME (parcours, rôle),
 *     construire le tuple, calculer `selfHash`, insérer, poser le cache.
 *
 * L'image est écrite AVANT la transaction parce que R2 n'est pas
 * transactionnel. L'identifiant de ligne est donc généré en amont et sert aussi
 * de clé R2 : sans cela, l'objet et la ligne ne seraient rattachés par rien.
 *
 * ## Ce que ce service N'ÉCRIT PAS
 *
 * ⚠️ Pas de `recomputeTauxPresence` ni de `presenceCreneau` : ces deux objets
 * n'existent PAS en AFEST (ils appartiennent au modèle collectif
 * enrollment/créneau). Copier le bloc H4 du service collectif ferait planter la
 * transaction sur chaque signature.
 *
 * ⚠️ Pas de `dureeReelleHeures` : l'écrivain unique est le chemin de CLÔTURE.
 * Poser ce cache à chaque signature le ferait osciller selon l'ordre des
 * opérations, pour une valeur que `heuresReellesSignees` recalcule de toute
 * façon.
 *
 * Node runtime (Prisma + R2). Stub-aware pour le build SSG.
 */

import { createHash, randomUUID } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { Prisma } from "../../../../../prisma/generated/client";
import { prisma } from "@/lib/prisma";
import { DOCUMENT_RETENTION_YEARS } from "@/server/qualiopi/legal/legal-mentions";
import { storeSignatureImage, supprimerImageSignature } from "@/server/qualiopi/emargement/storage";
import {
  calculerSelfHashSeance,
  HASH_VERSION_SEANCE,
  type MethodeSignatureAfest,
  type RoleSignataireAfest,
  type TupleSeanceSignatureV1,
} from "./seance-signature-hash";
import { dateSeanceDepuisJourParis } from "./seance-reconstruction";
import { MENTION_VERSION_AFEST } from "./mentions-afest";
import { etatSeance, horairesSeance } from "./seances-signables";
import { readCoachingForDocs } from "../coaching-snapshot";

/** Nombre de reprises sur conflit de chaîne. Au-delà, c'est autre chose qu'une course. */
const MAX_REPRISES_CHAINE = 3;

/**
 * Qui appose la signature, et à quel titre.
 *
 * 🔴 OBLIGATOIRE, et c'est une garde d'AUTORISATION, pas une trace.
 *
 * Le rôle, le nom et l'e-mail du signataire sont TOUJOURS lus depuis le jeton
 * vérifié, la séance ou le parcours — JAMAIS depuis le client. C'est la classe
 * de faille déjà corrigée côté collectif, où « un stagiaire pouvait signer la
 * feuille d'un absent » parce que l'identité était lue d'un côté et
 * l'autorisation de l'autre.
 */
export type PorteurSignatureAfest =
  | {
      /**
       * Canal B — le signataire utilise SON lien. Le rôle vient du jeton
       * vérifié : un jeton `tuteur` ne peut pas écrire une ligne
       * `beneficiaire`.
       */
      type: "lien";
      coachingId: string;
      tokenId: string;
      role: RoleSignataireAfest;
      /** Empreinte de l'adresse à laquelle le lien a été envoyé (binding réel). */
      destinataireEmailSha256: string | null;
    }
  | {
      /**
       * Canal A — signature recueillie sur le poste du formateur, déjà
       * authentifié. L'identification repose alors sur lui, comme avec une
       * feuille papier qu'il fait circuler.
       *
       * ⚠️ Plafond probant assumé : les trois rôles peuvent porter le même
       * `recueilliParTrainerId`. On atteste l'INTÉGRITÉ, pas l'INDÉPENDANCE.
       */
      type: "poste_formateur";
      trainerId: string;
      role: RoleSignataireAfest;
    };

export type RefusSignatureAfest =
  | "seance_introuvable"
  | "porteur_non_autorise"
  | "email_binding_invalide"
  | "parcours_non_afest"
  | "seance_neutralisee"
  | "seance_non_commencee"
  | "seance_trop_ancienne"
  | "horaires_indeterminables"
  | "deja_signe"
  | "nom_beneficiaire_absent"
  | "nom_formateur_absent"
  | "tuteur_absent"
  | "image_requise"
  | "nom_requis"
  | "nom_non_concordant"
  | "modules_invalides"
  | "conflit_concurrent";

export type ResultatSignatureAfest =
  | { ok: true; signatureId: string; selfHash: string }
  | { ok: false; raison: RefusSignatureAfest; message: string };

export interface EntreeSignatureAfest {
  /** Séance signée (`CompteRenduSeance.id`). */
  compteRenduSeanceId: string;
  porteur: PorteurSignatureAfest;
  methode: MethodeSignatureAfest;
  /** Data-URL PNG/JPEG. Obligatoire sauf pour `confirmation_accessible`. */
  imageDataUrl?: string | undefined;
  /** Nom saisi dans la modalité accessible — remplace le tracé (chemin clavier). */
  nomConfirme?: string | undefined;
  ipHash?: string | null | undefined;
  userAgentSha256?: string | null | undefined;
  /** Injectable pour les tests. Jamais `new Date()` en dur dans la logique. */
  maintenant?: Date | undefined;
}

function estStub(): boolean {
  return process.env["DATABASE_URL"]?.includes("stub.invalid") === true;
}

/** SHA-256 hex d'une adresse normalisée. Jamais l'adresse en clair. */
export function empreinteEmail(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase(), "utf8").digest("hex");
}

/** Normalise un nom pour comparaison : casse, accents et espaces ne tranchent pas. */
function normaliserNom(nom: string): string {
  return nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Supprime une image déjà écrite quand la ligne ne sera finalement pas créée.
 *
 * 🔴 Sans ce nettoyage, l'objet reste sur R2 SANS ligne qui le référence. La
 * purge RGPD part de `signature_key` : un objet orphelin est donc introuvable et
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
      tags: { action: "signerSeanceAfest:nettoyage_orphelin" },
      extra: { key: image.key },
    });
  }
}

/** Contexte complet nécessaire pour figer le tuple, lu en une requête. */
async function lireContexte(compteRenduSeanceId: string, role: RoleSignataireAfest) {
  return prisma.compteRenduSeance.findUnique({
    where: { id: compteRenduSeanceId },
    select: {
      id: true,
      coachingSessionId: true,
      dateSeance: true,
      dureeMinutes: true,
      statut: true,
      signatures: {
        where: { role, revokedAt: null },
        select: { id: true },
        take: 1,
      },
      coachingSession: {
        select: {
          id: true,
          trainerId: true,
          estAfest: true,
          coachingSnapshot: true,
          interventionSlug: true,
          objectifsPedagogiques: true,
          heuresPrevuesConvention: true,
          certificationType: true,
          codeRncp: true,
          codeRs: true,
          numeroEnregistrementFc: true,
          beneficiaireNom: true,
          beneficiaireEmail: true,
          tuteurEntrepriseNom: true,
          tuteurEntrepriseEmail: true,
          trainer: { select: { id: true, nom: true, prenom: true, email: true } },
          trainee: { select: { nom: true, prenom: true, email: true } },
        },
      },
    },
  });
}

type ContexteSeance = NonNullable<Awaited<ReturnType<typeof lireContexte>>>;

/** Identité FIGÉE du signataire, résolue côté serveur — jamais depuis le client. */
interface IdentiteSignataire {
  nom: string;
  email: string | null;
}

/**
 * Résout l'identité du signataire d'après son rôle.
 *
 * 🔴 GARDE SYMÉTRIQUE sur les trois rôles. Le repli littéral « Bénéficiaire »
 * qui existe côté génération de documents est ACCEPTABLE sur un PDF descriptif
 * et INACCEPTABLE ici : sceller « Bénéficiaire » dans un tuple haché produirait
 * une signature juridiquement anonyme — exactement le défaut que ce chantier
 * corrige. On refuse plutôt que de fabriquer.
 */
function resoudreIdentite(
  ctx: ContexteSeance,
  role: RoleSignataireAfest,
): { ok: true; identite: IdentiteSignataire } | { ok: false; raison: RefusSignatureAfest } {
  const cs = ctx.coachingSession;
  if (role === "beneficiaire") {
    const nom = cs.trainee
      ? `${cs.trainee.prenom} ${cs.trainee.nom}`.trim()
      : (cs.beneficiaireNom ?? "").trim();
    if (nom === "") return { ok: false, raison: "nom_beneficiaire_absent" };
    return {
      ok: true,
      identite: { nom, email: cs.trainee?.email ?? cs.beneficiaireEmail ?? null },
    };
  }
  if (role === "formateur") {
    const nom = `${cs.trainer.prenom} ${cs.trainer.nom}`.trim();
    if (nom === "") return { ok: false, raison: "nom_formateur_absent" };
    return { ok: true, identite: { nom, email: cs.trainer.email } };
  }
  const nom = (cs.tuteurEntrepriseNom ?? "").trim();
  const email = (cs.tuteurEntrepriseEmail ?? "").trim();
  if (nom === "" || email === "") return { ok: false, raison: "tuteur_absent" };

  // 🔴 Le tuteur atteste À PROPOS du bénéficiaire, qu'il NOMME.
  //
  // `mentionAttestationAfest("tuteur", …)` produit littéralement « j'atteste que
  // {beneficiaireNom} a réalisé les mises en situation de travail ». Sans nom de
  // bénéficiaire, le tuteur — un TIERS non contractant — se voit présenter, puis
  // scelle, une attestation qui ne désigne personne. La `mentionVersion` figée
  // dans son empreinte pointerait vers une phrase creuse.
  //
  // ⚠️ La garde d'identité au-dessus est symétrique sur les trois rôles, mais
  // elle ne portait que sur le SIGNATAIRE. Elle ne voyait donc pas ce cas : le
  // tuteur est parfaitement identifié, c'est la personne CITÉE qui manque.
  // Trouvé en écrivant l'écran, pas en relisant le service.
  const beneficiaireNom = cs.trainee
    ? `${cs.trainee.prenom} ${cs.trainee.nom}`.trim()
    : (cs.beneficiaireNom ?? "").trim();
  if (beneficiaireNom === "") return { ok: false, raison: "nom_beneficiaire_absent" };

  return { ok: true, identite: { nom, email } };
}

const MESSAGES: Record<RefusSignatureAfest, string> = {
  seance_introuvable: "Séance introuvable.",
  porteur_non_autorise: "Ce lien ne permet pas de signer cette séance.",
  email_binding_invalide:
    "Ce lien a été émis pour une autre adresse électronique. Demandez à l'organisme un lien à votre nom.",
  parcours_non_afest:
    "Ce parcours n'est pas cadré en AFEST : l'émargement par séance ne s'y applique pas.",
  seance_neutralisee:
    "Cette séance est annulée ou justifiée comme non tenue : elle ne s'émarge pas.",
  seance_non_commencee: "Cette séance n'a pas encore commencé. Vous pourrez signer le moment venu.",
  seance_trop_ancienne:
    "Le délai de signature de cette séance est dépassé. Contactez l'organisme : une séance ne se signe pas des mois après sa tenue.",
  horaires_indeterminables:
    "La durée de cette séance n'est pas renseignée : ses horaires réels sont indéterminables et la feuille serait insuffisamment probante. L'organisme doit la corriger avant signature.",
  deja_signe: "Cette séance a déjà été signée à ce titre.",
  nom_beneficiaire_absent:
    "Le nom du bénéficiaire n'est pas renseigné sur ce parcours. Une signature sans signataire identifié ne prouve rien : l'organisme doit le renseigner.",
  nom_formateur_absent: "Le nom du formateur n'est pas renseigné sur ce parcours.",
  tuteur_absent:
    "Le tuteur en entreprise (nom et adresse électronique) n'est pas renseigné sur ce parcours.",
  image_requise: "Aucune signature n'a été tracée.",
  nom_requis: "Saisissez votre nom pour confirmer.",
  nom_non_concordant: "Le nom saisi ne correspond pas à celui enregistré pour ce parcours.",
  modules_invalides:
    "Les objectifs pédagogiques de ce parcours sont mal renseignés. L'organisme doit les corriger.",
  conflit_concurrent:
    "Une autre signature est en cours d'enregistrement. Réessayez dans un instant.",
};

function refus(raison: RefusSignatureAfest): ResultatSignatureAfest {
  return { ok: false, raison, message: MESSAGES[raison] };
}

/**
 * Enregistre la signature d'UNE séance par UN rôle.
 *
 * ⚠️ Ne retourne JAMAIS un succès silencieux : soit la ligne est écrite et son
 * image stockée, soit un refus typé remonte. Une panne de stockage lève
 * (`SignatureStockageError`) et n'est pas rattrapée ici — l'appelant doit
 * refuser la signature, pas la simuler.
 */
export async function signerSeanceAfest(
  input: EntreeSignatureAfest,
): Promise<ResultatSignatureAfest> {
  if (estStub()) return refus("seance_introuvable");

  const maintenant = input.maintenant ?? new Date();
  const role = input.porteur.role;
  const ctx = await lireContexte(input.compteRenduSeanceId, role);
  if (ctx === null) return refus("seance_introuvable");

  // ── 1. GARDE D'AUTORISATION — avant toute autre vérification métier ──
  //
  // Le jeton atteste d'un PARCOURS et d'un RÔLE ; la séance appartient à un
  // parcours : les deux doivent coïncider. Un formateur, lui, doit animer le
  // parcours. Sans ce recoupement, un porteur de lien valide pourrait signer la
  // séance d'un autre parcours — en son nom, puisque l'identité est lue côté
  // serveur.
  const autorise =
    input.porteur.type === "lien"
      ? input.porteur.coachingId === ctx.coachingSessionId
      : input.porteur.trainerId === ctx.coachingSession.trainerId;
  if (!autorise) {
    Sentry.captureException(new Error("Signature AFEST tentée hors périmètre du porteur"), {
      tags: { action: "signerSeanceAfest:porteur_non_autorise" },
      extra: { compteRenduSeanceId: input.compteRenduSeanceId, typePorteur: input.porteur.type },
    });
    return refus("porteur_non_autorise");
  }

  // 🔴 Le FORMATEUR ne signe JAMAIS par jeton : il est authentifié dans son
  // espace. Accepter un lien pour son rôle rouvrirait la porte que
  // l'authentification ferme.
  if (input.porteur.type === "lien" && role === "formateur") {
    return refus("porteur_non_autorise");
  }

  // Placé APRÈS l'autorisation : sinon un porteur de jeton valide qui devine un
  // identifiant de séance apprend si un autre rôle a signé.
  if (ctx.signatures.length > 0) return refus("deja_signe");

  if (!ctx.coachingSession.estAfest) return refus("parcours_non_afest");

  // ── 2. GARDE TEMPORELLE PAR SÉANCE ──
  const etat = etatSeance(
    {
      id: ctx.id,
      debut: ctx.dateSeance,
      dureeMinutes: ctx.dureeMinutes,
      statut: ctx.statut,
      dejaSigne: false,
    },
    maintenant,
  );
  if (!etat.signable) {
    // Les motifs de `etatSeance` sont un sous-ensemble strict des refus du
    // service : la correspondance est directe, sans traduction perdante.
    return refus(etat.motif);
  }

  // ── 3. GARDE D'IDENTITÉ, symétrique sur les trois rôles ──
  const resolution = resoudreIdentite(ctx, role);
  if (!resolution.ok) return refus(resolution.raison);
  const { nom: signataireNom, email: signataireEmail } = resolution.identite;

  const formateurNom =
    `${ctx.coachingSession.trainer.prenom} ${ctx.coachingSession.trainer.nom}`.trim();
  if (formateurNom === "") return refus("nom_formateur_absent");

  // ── 4. HORAIRES RÉELS, ou refus ──
  const horaires = horairesSeance(ctx.dateSeance, ctx.dureeMinutes);
  if (horaires === null || ctx.dureeMinutes === null) return refus("horaires_indeterminables");

  // ── 5. BINDING E-MAIL du canal B ──
  //
  // 🔴 `verifyMagicToken` ne lie PAS le porteur à un destinataire : sans ce
  // contrôle, un lien transféré signe au nom du destinataire initial. Un jeton
  // sans empreinte de destinataire est refusé plutôt que toléré — la tolérance
  // serait précisément le trou.
  if (input.porteur.type === "lien") {
    if (signataireEmail === null || input.porteur.destinataireEmailSha256 === null) {
      return refus("email_binding_invalide");
    }
    if (empreinteEmail(signataireEmail) !== input.porteur.destinataireEmailSha256) {
      Sentry.captureException(new Error("Binding e-mail invalide sur une signature AFEST"), {
        tags: { action: "signerSeanceAfest:email_binding_invalide" },
        extra: { compteRenduSeanceId: input.compteRenduSeanceId, role },
      });
      return refus("email_binding_invalide");
    }
  }

  // Modalité accessible : le nom saisi remplace le tracé, il doit donc concorder.
  if (input.methode === "confirmation_accessible") {
    if (input.nomConfirme === undefined || input.nomConfirme.trim() === "") {
      return refus("nom_requis");
    }
    if (normaliserNom(input.nomConfirme) !== normaliserNom(signataireNom)) {
      return refus("nom_non_concordant");
    }
  } else if (input.imageDataUrl === undefined || input.imageDataUrl === "") {
    return refus("image_requise");
  }

  // Contenu pédagogique FIGÉ du parcours (snapshot légal WS9, ou repli LIVE).
  //
  // ⚠️ On scelle les objectifs du PARCOURS, pas les mises en situation de la
  // séance : ces dernières sont saisies APRÈS la séance, et sceller une liste
  // vide serait pire que ne rien sceller. Elles restent dans le compte-rendu,
  // explicitement NON scellées — ce que la note produit doit dire.
  const resolu = readCoachingForDocs(ctx.coachingSession.coachingSnapshot, ctx.coachingSession);
  const objectifsBruts = resolu.objectifsPedagogiques;
  let modules: string[] = [];
  if (Array.isArray(objectifsBruts)) {
    const libelles = (objectifsBruts as Array<{ libelle?: unknown } | string>).map((o) =>
      typeof o === "string" ? o : typeof o?.libelle === "string" ? o.libelle : null,
    );
    // ⚠️ Amputer en silence une liste mal formée scellerait un contenu
    // incomplet sans que personne ne le sache. On refuse.
    if (libelles.some((l) => l === null)) {
      Sentry.captureException(new Error("objectifsPedagogiques non conformes"), {
        tags: { action: "signerSeanceAfest:modules_invalides" },
        extra: { coachingId: ctx.coachingSessionId },
      });
      return refus("modules_invalides");
    }
    modules = libelles as string[];
  } else if (objectifsBruts !== null && objectifsBruts !== undefined) {
    return refus("modules_invalides");
  }

  // ── Identifiant généré ICI : clé primaire ET clé R2 ──
  const signatureId = randomUUID();

  // ── 6. Image AVANT la transaction : R2 n'est pas transactionnel. LÈVE si échec ──
  //
  // Genre `signatures` — surtout PAS un troisième genre : `CLE_SIGNATURE_RE` et
  // la purge RGPD ne connaissent que `signatures` et `contresignatures`, et un
  // genre inconnu produirait des images ineffaçables.
  let image: { key: string; sha256: string; mimeType: string; sizeBytes: number } | null = null;
  if (input.methode !== "confirmation_accessible" && input.imageDataUrl !== undefined) {
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
    contexteType: "afest_seance" as const,
    coachingId: ctx.coachingSessionId,
    compteRenduSeanceId: ctx.id,
    role,
    seanceDate: horaires.jourParis,
    heureDebut: horaires.heureDebut,
    heureFin: horaires.heureFin,
    formationIntitule: resolu.intitule,
    modules,
    formateurNom,
    signataireNom,
    signataireEmail,
    methode: input.methode,
    mentionVersion: MENTION_VERSION_AFEST,
    signatureSha256: image?.sha256 ?? null,
    signeAtIso: maintenant.toISOString(),
  };

  // ── 7. Insertion, avec reprise sur conflit de chaîne ──
  for (let essai = 0; essai < MAX_REPRISES_CHAINE; essai++) {
    try {
      const cree = await prisma.$transaction(async (tx) => {
        // 🔴 L'ordre de la chaîne est celui de l'INSERTION (`createdAt`), jamais
        // celui de `signeAt` : ce dernier est figé AVANT l'écriture de l'image
        // sur R2 (sharp + aller-retour réseau, 100 à 500 ms). Deux signatures du
        // même rôle lancées depuis deux onglets peuvent donc commiter dans
        // l'ordre INVERSE de leurs `signeAt`. Un lecteur triant dessus verrait
        // une tête de chaîne à `prevHash` non nul puis une rupture : « chaîne
        // corrompue », à tort et définitivement — la table est append-only.
        //
        // ⚠️ TOUT vérificateur doit trier À L'IDENTIQUE.
        const precedente = await tx.coachingSeanceSignature.findFirst({
          where: { coachingId: ctx.coachingSessionId, role, revokedAt: null },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { selfHash: true },
        });
        const prevHash = precedente?.selfHash ?? null;

        const tuple: TupleSeanceSignatureV1 = { ...socle, prevHash };
        const selfHash = calculerSelfHashSeance(tuple);

        const sig = await tx.coachingSeanceSignature.create({
          data: {
            id: signatureId,
            compteRenduSeanceId: ctx.id,
            coachingId: ctx.coachingSessionId,
            role,
            // 🔴 SEUL chemin d'écriture autorisé : minuit UTC du jour civil de
            // Paris. Un `new Date(dateSeance)` brut laisserait PostgreSQL
            // trancher le jour au cast, et l'empreinte serait hachée sur un jour
            // et relue sur l'autre.
            seanceDate: dateSeanceDepuisJourParis(horaires.jourParis),
            dureeMinutes: ctx.dureeMinutes as number,
            heureDebut: horaires.heureDebut,
            heureFin: horaires.heureFin,
            formationIntitule: socle.formationIntitule,
            modulesSnapshot: modules,
            formateurNom,
            signataireNom,
            signataireEmail,
            methode: input.methode,
            // `null` quand la signature est recueillie sur le poste du
            // formateur : la distinction « appareil du signataire » / « poste de
            // l'organisme » est ainsi tracée sans colonne supplémentaire.
            tokenId: input.porteur.type === "lien" ? input.porteur.tokenId : null,
            recueilliParTrainerId:
              input.porteur.type === "poste_formateur" ? input.porteur.trainerId : null,
            signatureKey: image?.key ?? null,
            signatureSha256: image?.sha256 ?? null,
            mimeType: image?.mimeType ?? null,
            sizeBytes: image?.sizeBytes ?? null,
            signeAt: maintenant,
            ipHash: input.ipHash ?? null,
            userAgentSha256: input.userAgentSha256 ?? null,
            prevHash,
            selfHash,
            hashVersion: HASH_VERSION_SEANCE,
            mentionVersion: MENTION_VERSION_AFEST,
            suppressionPrevueAt,
          },
          select: { id: true, selfHash: true },
        });

        // 🔴 Cache d'affichage DÉRIVÉ, dans la MÊME transaction que la preuve.
        //
        // Ces colonnes ne sont plus une preuve : la source de vérité est la
        // ligne ci-dessus. Elles restent écrites pour que la console et le PDF
        // n'aient pas à recharger la chaîne à chaque rendu — et pour que les
        // parcours en régime `legacy_boolean` continuent de fonctionner
        // exactement comme avant.
        //
        // ⚠️ AUCUN report vers `presenceCreneau` ni `recomputeTauxPresence` :
        // ces objets n'existent pas en AFEST, et le bloc équivalent du service
        // collectif ferait planter la transaction ici.
        await tx.compteRenduSeance.update({
          where: { id: ctx.id },
          data:
            role === "beneficiaire"
              ? {
                  beneficiairePresent: true,
                  beneficiaireSigneAt: maintenant,
                  presenceSigneeAt: maintenant,
                }
              : role === "formateur"
                ? { formateurSigneAt: maintenant }
                : { tuteurSigneAt: maintenant },
        });

        return sig;
      });

      return { ok: true, signatureId: cree.id, selfHash: cree.selfHash };
    } catch (err) {
      const conflit = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (!conflit) {
        await nettoyerImageOrpheline(image);
        throw err;
      }

      // Deux causes possibles, et une seule se réessaie : une course sur la
      // chaîne (deux onglets) se résout en relisant l'empreinte précédente ;
      // une signature déjà posée sur ce (séance, rôle) est définitive.
      //
      // ⚠️ On NE lit PAS `err.meta.target` : sa forme pour un index unique
      // PARTIEL créé en SQL brut n'est garantie nulle part, et un `undefined`
      // ferait passer une signature déjà posée pour une course. On interroge la
      // base, qui répond sans ambiguïté.
      const dejaPose = await prisma.coachingSeanceSignature.count({
        where: { compteRenduSeanceId: ctx.id, role, revokedAt: null },
      });
      if (dejaPose > 0) {
        await nettoyerImageOrpheline(image);
        return refus("deja_signe");
      }
      if (essai === MAX_REPRISES_CHAINE - 1) {
        Sentry.captureException(err, {
          tags: { action: "signerSeanceAfest:conflit_chaine" },
          extra: { compteRenduSeanceId: input.compteRenduSeanceId, essais: MAX_REPRISES_CHAINE },
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

export type RefusRevocationSeance =
  "signature_introuvable" | "deja_revoquee" | "revocation_maillon_interne_interdite";

export type ResultatRevocationSeance =
  { ok: true } | { ok: false; raison: RefusRevocationSeance; message: string };

/**
 * Révoque une signature de séance.
 *
 * 🔴 REFUSE de révoquer un maillon NON TERMINAL de sa chaîne.
 *
 * La relecture filtre sur `WHERE revoked_at IS NULL`. Révoquer un maillon
 * interne ferait donc disparaître le prédécesseur de son successeur, dont le
 * `prevHash` pointerait alors dans le vide : `verifierChaine` rendrait
 * `rupture_chainage` — c'est-à-dire, dans un dossier de contrôle, « une ligne a
 * été supprimée après coup ». Sur une correction parfaitement légitime.
 *
 * La correction d'une séance ancienne se fait donc par révocation EN CASCADE
 * depuis la queue de chaîne, puis re-signature dans l'ordre. C'est plus
 * fastidieux, et c'est le prix d'un registre dont les anomalies veulent dire
 * quelque chose.
 */
export async function revoquerSignatureSeance(input: {
  signatureId: string;
  motif: string;
  parAdminId?: string | null;
  maintenant?: Date;
}): Promise<ResultatRevocationSeance> {
  if (estStub()) {
    return { ok: false, raison: "signature_introuvable", message: "Base indisponible." };
  }
  const maintenant = input.maintenant ?? new Date();

  const ligne = await prisma.coachingSeanceSignature.findUnique({
    where: { id: input.signatureId },
    select: { id: true, coachingId: true, role: true, selfHash: true, revokedAt: true },
  });
  if (ligne === null) {
    return { ok: false, raison: "signature_introuvable", message: "Signature introuvable." };
  }
  if (ligne.revokedAt !== null) {
    return { ok: false, raison: "deja_revoquee", message: "Cette signature est déjà révoquée." };
  }

  const successeur = await prisma.coachingSeanceSignature.count({
    where: {
      coachingId: ligne.coachingId,
      role: ligne.role,
      revokedAt: null,
      prevHash: ligne.selfHash,
    },
  });
  if (successeur > 0) {
    return {
      ok: false,
      raison: "revocation_maillon_interne_interdite",
      message:
        "Cette signature n'est pas la dernière de sa chaîne : la révoquer romprait le chaînage et ferait apparaître le registre comme falsifié. Révoquez d'abord les signatures postérieures du même rôle, puis re-signez dans l'ordre.",
    };
  }

  await prisma.coachingSeanceSignature.update({
    where: { id: ligne.id },
    data: {
      revokedAt: maintenant,
      revokedMotif: input.motif.slice(0, 500),
      revokedById: input.parAdminId ?? null,
    },
  });
  return { ok: true };
}
