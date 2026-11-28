/**
 * Questionnaire public d'une fiche collaborateur, par lien personnel. ROUTE PUBLIQUE, SANS COMPTE.
 *
 * Garanties (la relecture sécurité porte sur ce fichier) :
 *  - le jeton n'est jamais stocké : la recherche se fait par `sha256(jeton)` ; un jeton mal formé ne
 *    touche pas la base ;
 *  - UN SEUL message pour inconnu, expiré, révoqué, déjà utilisé, fiche en cours d'effacement :
 *    la réponse ne dit jamais lequel ;
 *  - l'envoi exige Turnstile, une limite par IP hachée (5 / heure) et par jeton (3 / heure) ;
 *  - validation Zod stricte (schéma versionné), attestation de responsabilité ET consentement de
 *    publication contrôlés côté serveur ; photo sans case « photo » cochée refusée ;
 *  - UNE transaction : invitation consommée (usage unique, même en double envoi simultané), fiche
 *    créée ou mise à jour en « a_valider » (JAMAIS publiée automatiquement ; une fiche déjà publiée
 *    n'est pas touchée), réponse conservée, un `ConsentEvent` par accord + l'attestation, journal ;
 *  - la photo passe par la fonction serveur de la console (signature lue dans les octets, ré-encodage
 *    sans EXIF, original privé), appelée après la transaction ;
 *  - aucune adresse e-mail n'est lue, écrite ni journalisée ici ; le journal ne contient jamais de contenu.
 */
import "server-only";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { hashIp, hashUserAgent } from "@/lib/security/ip-hash";
import {
  TEAM_ATTESTATION_VERSION_COURANTE,
  TEAM_CONSENT_VERSION_COURANTE,
  estCategorieEquipe,
  getQuestionnaire,
  schemaReponse,
  type TeamCategory,
  type Question,
} from "@/lib/equipe/donnees";
import { baseSlug, candidatsSlug, slugSchema } from "@/lib/equipe/console/schemas";
import {
  deposerPhotoCollaborateur,
  retirerPhotoCollaborateur,
  traiterPhoto,
} from "../photo-collaborateur";
import { hacherJetonQuestionnaire } from "./jeton";

export const PHOTO_QUESTIONNAIRE_MAX_OCTETS = 5 * 1024 * 1024;
const FORME_JETON = /^[A-Za-z0-9_-]{43}$/;
const IP_PAR_HEURE = 5;
const TENTATIVES_PAR_JETON = 3;
const HEURE = 3600;

export const MESSAGE_NEUTRE =
  "Ce lien n'est plus valable. Si vous pensez qu'il s'agit d'une erreur, demandez-en un nouveau à la personne qui vous l'a envoyé.";

export interface InvitationOuverte {
  readonly id: string;
  readonly categorie: TeamCategory;
  readonly version: string;
  readonly questions: readonly Question[];
}

export type LectureInvitation =
  { readonly etat: "neutre" } | { readonly etat: "ok"; readonly invitation: InvitationOuverte };

const NEUTRE = { etat: "neutre" } as const;

/** Ouvre le lien : message neutre identique pour tout refus ; note la première ouverture. */
export async function lireInvitation(jeton: string): Promise<LectureInvitation> {
  if (!FORME_JETON.test(jeton)) return NEUTRE;
  const invite = await prisma.teamQuestionnaireInvite.findUnique({
    where: { tokenHash: hacherJetonQuestionnaire(jeton) },
  });
  if (!invite || invite.usedAt !== null || invite.revokedAt !== null) return NEUTRE;
  if (invite.expiresAt.getTime() <= Date.now()) return NEUTRE;
  if (!estCategorieEquipe(invite.category)) return NEUTRE;
  const questionnaire = getQuestionnaire(invite.category, invite.questionnaireVersion);
  if (!questionnaire) return NEUTRE;
  if (invite.firstOpenedAt === null) {
    await prisma.teamQuestionnaireInvite.updateMany({
      where: { id: invite.id, firstOpenedAt: null },
      data: { firstOpenedAt: new Date() },
    });
  }
  return {
    etat: "ok",
    invitation: {
      id: invite.id,
      categorie: invite.category,
      version: invite.questionnaireVersion,
      questions: questionnaire.questions,
    },
  };
}

export interface EntreeSoumission {
  readonly jeton: string;
  /** Objet brut `{ commun, categorie, consentements }` : validé ici, jamais cru. */
  readonly reponse: unknown;
  readonly attestation: boolean;
  readonly photo: Buffer | null;
  readonly turnstile: string | null;
  readonly ip: string;
  readonly userAgent: string | null;
}

export type ResultatSoumission =
  | { readonly ok: true; readonly photo: "aucune" | "deposee" | "non-appliquee" | "echec" }
  | {
      readonly ok: false;
      readonly motif: "neutre" | "limite" | "turnstile" | "invalide";
      readonly message: string;
    };

const refus = (
  motif: "neutre" | "limite" | "turnstile" | "invalide",
  message: string,
): ResultatSoumission => ({ ok: false, motif, message });

type Tx = Pick<
  typeof prisma,
  | "teamMember"
  | "teamMemberEvent"
  | "teamQuestionnaireInvite"
  | "teamQuestionnaireSubmission"
  | "consentEvent"
  | "city"
  | "authorProfile"
>;

class Abandon extends Error {}

const arrondi2 = (n: number) => Math.round(n * 100) / 100;

interface Lieu {
  citySlug: string | null;
  departmentCode: string | null;
  locationLabel: string;
  latitude: number | null;
  longitude: number | null;
}

/** Ville ou département reconnus par leur nom ; sinon libellé seul, sans coordonnées (jamais d'adresse). */
async function resoudreLieu(tx: Tx, saisie: string): Promise<Lieu> {
  const libre: Lieu = {
    citySlug: null,
    departmentCode: null,
    locationLabel: saisie.slice(0, 120),
    latitude: null,
    longitude: null,
  };
  const villes = await tx.city.findMany({
    where: { name: { equals: saisie, mode: "insensitive" } },
    select: { slug: true, name: true, departmentCode: true, latitude: true, longitude: true },
    take: 2,
  });
  if (villes.length === 1) {
    const v = villes[0]!;
    return {
      citySlug: v.slug,
      departmentCode: v.departmentCode,
      locationLabel: `${v.name} (${v.departmentCode})`,
      latitude: arrondi2(v.latitude),
      longitude: arrondi2(v.longitude),
    };
  }
  if (villes.length > 1) return libre;
  const dep = await tx.city.findMany({
    where: { departmentName: { equals: saisie, mode: "insensitive" } },
    select: { departmentName: true, departmentCode: true, latitude: true, longitude: true },
    take: 500,
  });
  if (dep.length === 0) return libre;
  const moy = (cle: "latitude" | "longitude") =>
    arrondi2(dep.reduce((s, v) => s + v[cle], 0) / dep.length);
  return {
    citySlug: null,
    departmentCode: dep[0]!.departmentCode,
    locationLabel: `${dep[0]!.departmentName} (${dep[0]!.departmentCode})`,
    latitude: moy("latitude"),
    longitude: moy("longitude"),
  };
}

async function slugLibre(tx: Tx, slug: string): Promise<boolean> {
  const pris = await tx.teamMember.findFirst({
    where: { OR: [{ slug }, { previousSlugs: { has: slug } }] },
    select: { id: true },
  });
  if (pris) return false;
  return (await tx.authorProfile.findUnique({ where: { slug }, select: { id: true } })) === null;
}

async function premierSlugLibre(tx: Tx, base: string, categorie: string): Promise<string> {
  for (const c of candidatsSlug(base, categorie)) {
    if (!slugSchema.safeParse(c).success) continue;
    if (await slugLibre(tx, c)) return c;
  }
  throw new Abandon("slug");
}

export async function soumettreQuestionnaire(
  entree: EntreeSoumission,
): Promise<ResultatSoumission> {
  if (!FORME_JETON.test(entree.jeton)) return refus("neutre", MESSAGE_NEUTRE);
  const tokenHash = hacherJetonQuestionnaire(entree.jeton);

  // 1. Limite par adresse IP hachée (jamais l'adresse en clair dans Redis).
  const empreinteIp = hashIp(entree.ip) ?? "inconnue";
  const parIp = await checkRateLimit(`equipe-questionnaire:ip:${empreinteIp}`, {
    limit: IP_PAR_HEURE,
    windowSec: HEURE,
  });
  if (!parIp.allowed) return refus("limite", "Trop de tentatives. Réessayez dans une heure.");

  // 2. Turnstile, strict : sans lui, rien n'est lu.
  const humain = await verifyTurnstile(entree.turnstile, entree.ip).catch(() => false);
  if (!humain) return refus("turnstile", "La vérification anti-robot a échoué. Réessayez.");

  // 3. Invitation (même message neutre pour tout refus) puis limite par jeton.
  const invite = await prisma.teamQuestionnaireInvite.findUnique({ where: { tokenHash } });
  if (
    !invite ||
    invite.usedAt !== null ||
    invite.revokedAt !== null ||
    invite.expiresAt.getTime() <= Date.now() ||
    !estCategorieEquipe(invite.category)
  ) {
    return refus("neutre", MESSAGE_NEUTRE);
  }
  const parJeton = await checkRateLimit(`equipe-questionnaire:jeton:${tokenHash}`, {
    limit: TENTATIVES_PAR_JETON,
    windowSec: HEURE,
    surPanne: "refuser",
  });
  if (!parJeton.allowed) return refus("limite", "Trop de tentatives. Réessayez dans une heure.");

  // 4. Validation stricte, avant tout effet.
  const schema = schemaReponse(invite.category, invite.questionnaireVersion);
  if (!schema) return refus("neutre", MESSAGE_NEUTRE);
  const parse = schema.safeParse(entree.reponse);
  if (!parse.success) {
    return refus(
      "invalide",
      "Certaines réponses sont incomplètes ou invalides. Vérifiez le formulaire.",
    );
  }
  const v = parse.data;
  if (entree.attestation !== true) {
    return refus("invalide", "L'attestation de responsabilité est obligatoire.");
  }
  if (entree.photo !== null) {
    if (!v.consentements.photo) {
      return refus("invalide", "Cochez l'accord pour la photo, ou retirez la photo.");
    }
    if (entree.photo.length > PHOTO_QUESTIONNAIRE_MAX_OCTETS) {
      return refus("invalide", "La photo dépasse 5 Mo.");
    }
    const t = await traiterPhoto(entree.photo);
    if (!t.ok) return refus("invalide", t.erreur);
  }

  // 5. Effet : une seule transaction.
  const maintenant = new Date();
  const version = {
    publication: TEAM_CONSENT_VERSION_COURANTE.publication,
    photo: TEAM_CONSENT_VERSION_COURANTE.photo,
    linkedin: TEAM_CONSENT_VERSION_COURANTE.linkedin,
    attestation: TEAM_ATTESTATION_VERSION_COURANTE,
  };
  let effet: { memberId: string; slug: string; appliquee: boolean; photoARetirer: boolean };
  try {
    effet = await prisma.$transaction(async (tx) => {
      const existant = invite.memberId
        ? await tx.teamMember.findUnique({
            where: { id: invite.memberId },
            select: {
              id: true,
              slug: true,
              status: true,
              category: true,
              erasureRequestedAt: true,
              photoConsentAt: true,
              linkedinConsentAt: true,
              photoKind: true,
              photoStoragePath: true,
              contactEmailHash: true,
            },
          })
        : null;
      if (invite.memberId && (!existant || existant.erasureRequestedAt !== null)) {
        throw new Abandon("neutre");
      }
      // L'invitation et la fiche doivent parler de la même catégorie.
      if (existant && existant.category !== invite.category) throw new Abandon("neutre");
      // Usage unique : la condition est dans l'UPDATE, donc deux envois simultanés ne passent pas tous les deux.
      const consommee = await tx.teamQuestionnaireInvite.updateMany({
        where: { id: invite.id, usedAt: null, revokedAt: null, expiresAt: { gt: maintenant } },
        data: { usedAt: maintenant },
      });
      if (consommee.count !== 1) throw new Abandon("neutre");

      const publiee = existant?.status === "publie";
      let memberId = existant?.id ?? "";
      let slug = existant?.slug ?? "";
      if (!existant || !publiee) {
        const lieu = await resoudreLieu(tx, v.commun.lieu);
        const donnees = {
          status: "a_valider",
          firstName: v.commun.prenom,
          jobTitle: v.commun.intitule,
          bioMd: v.commun.presentation,
          languages: v.commun.langues,
          categoryAnswers: { commun: { apport: v.commun.apport }, categorie: v.categorie },
          questionnaireVersion: invite.questionnaireVersion,
          ...lieu,
          publicationConsentAt: maintenant,
          publicationConsentVersion: version.publication.version,
          consentSource: "questionnaire",
          // Case cochée : accord enregistré. Case décochée : tout accord antérieur est retiré.
          ...(v.consentements.photo
            ? { photoConsentAt: maintenant, photoConsentVersion: version.photo.version }
            : { photoConsentAt: null, photoConsentVersion: null }),
          ...(v.consentements.linkedin
            ? {
                linkedinUrl: v.commun.linkedin ?? null,
                linkedinConsentAt: maintenant,
                linkedinConsentVersion: version.linkedin.version,
              }
            : { linkedinUrl: null, linkedinConsentAt: null, linkedinConsentVersion: null }),
        };
        if (existant) {
          const r = await tx.teamMember.updateMany({
            where: { id: existant.id, erasureRequestedAt: null, status: { not: "publie" } },
            data: donnees,
          });
          if (r.count !== 1) throw new Abandon("neutre");
        } else {
          const ville = lieu.citySlug
            ? lieu.locationLabel.replace(/\s*\(.*\)$/, "")
            : lieu.locationLabel;
          const nouveauSlug = await premierSlugLibre(
            tx,
            baseSlug([v.commun.prenom, ville]),
            invite.category,
          );
          const cree = await tx.teamMember.create({
            data: { slug: nouveauSlug, category: invite.category, ...donnees, showOnMap: false },
            select: { id: true, slug: true },
          });
          memberId = cree.id;
          slug = cree.slug;
        }
      }
      await tx.teamQuestionnaireSubmission.create({
        data: {
          inviteId: invite.id,
          memberId,
          questionnaireVersion: invite.questionnaireVersion,
          answers: {
            ...v,
            attestation: { version: version.attestation.version, at: maintenant.toISOString() },
          },
          status: "recue",
          ipHash: hashIp(entree.ip),
          userAgent: hashUserAgent(entree.userAgent),
        },
      });

      // Preuve : une ligne par accord donné + l'attestation. Pas d'e-mail : la clé est celle de l'invitation.
      const personKey =
        invite.emailHash ??
        existant?.contactEmailHash ??
        createHash("sha256").update(`team-invite:${invite.id}`).digest("hex");
      const preuve = (c: { formRef: string; version: string }, action = "optin") => ({
        personKey,
        formRef: c.formRef,
        consentVersion: c.version,
        action,
        occurredAt: maintenant,
        ipHash: hashIp(entree.ip),
        userAgent: null,
      });
      await tx.consentEvent.createMany({
        data: [
          preuve(version.publication),
          ...(v.consentements.photo ? [preuve(version.photo)] : []),
          ...(v.consentements.linkedin ? [preuve(version.linkedin)] : []),
          // Case décochée alors qu'un accord existait : le retrait est tracé.
          ...(!publiee && existant?.photoConsentAt && !v.consentements.photo
            ? [preuve(version.photo, "optout")]
            : []),
          ...(!publiee && existant?.linkedinConsentAt && !v.consentements.linkedin
            ? [preuve(version.linkedin, "optout")]
            : []),
          preuve(version.attestation),
        ],
      });

      await tx.teamMemberEvent.create({
        data: {
          memberId,
          action: publiee ? "questionnaire_recu_sans_ecrasement" : "questionnaire_recu",
          actor: "questionnaire",
          details: {
            version: invite.questionnaireVersion,
            souhait_carte: v.commun.souhaitCarte,
            photo_jointe: entree.photo !== null,
            consentements: {
              publication: true,
              photo: v.consentements.photo,
              linkedin: v.consentements.linkedin,
            },
          },
        },
      });
      const photoARetirer =
        !publiee &&
        !v.consentements.photo &&
        existant !== null &&
        (existant.photoKind === "reelle" ||
          existant.photoStoragePath !== null ||
          existant.photoConsentAt !== null);
      return { memberId, slug, appliquee: !publiee, photoARetirer };
    });
  } catch (e) {
    if ((e as { code?: string } | null)?.code === "P2002") {
      return refus("invalide", "Un problème est survenu. Réessayez dans quelques minutes.");
    }
    if (e instanceof Abandon) {
      return e.message === "slug"
        ? refus("invalide", "Un problème est survenu. Réessayez dans quelques minutes.")
        : refus("neutre", MESSAGE_NEUTRE);
    }
    throw e;
  }

  // 6. Photo, après la transaction. Une fiche déjà publiée garde sa photo jusqu'à la relecture.
  if (effet.photoARetirer) {
    await retirerPhotoCollaborateur({ memberId: effet.memberId, acteur: "questionnaire" }).catch(
      () => undefined,
    );
  }
  let photo: "aucune" | "deposee" | "non-appliquee" | "echec" = "aucune";
  if (entree.photo !== null) {
    if (!effet.appliquee) {
      photo = "non-appliquee";
    } else {
      const r = await deposerPhotoCollaborateur({
        memberId: effet.memberId,
        octets: entree.photo,
        acteur: "questionnaire",
      }).catch(() => ({ ok: false as const, erreur: "" }));
      photo = r.ok ? "deposee" : "echec";
      if (!r.ok) {
        // L'invitation est consommée : la trace permet à l'équipe de recontacter la personne.
        await prisma.teamMemberEvent
          .create({
            data: {
              memberId: effet.memberId,
              action: "photo_questionnaire_echec",
              actor: "questionnaire",
            },
          })
          .catch(() => undefined);
      }
    }
  }
  revalidatePath("/fr/equipe");
  return { ok: true, photo };
}
