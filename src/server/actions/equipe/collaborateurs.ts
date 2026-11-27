"use server";

/**
 * Actions de la console « Collaborateurs » (fiches publiques de l'équipe).
 *
 * Règles communes :
 *  - rôle administrateur revérifié dans CHAQUE action (`exigerAdministrateur`), avant tout accès base ;
 *  - entrées validées par Zod ; identifiants au format UUID ; lieu recalculé côté serveur ;
 *  - chaque changement = une ligne de `TeamMemberEvent` (champs touchés, jamais de contenu personnel) ;
 *  - tout ce qui change ce que voit le public appelle `revalidatePath` (fiche et hub).
 */
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { TEAM_CONSENT_VERSION_COURANTE } from "@/lib/equipe/donnees";
import {
  NOTE_PREUVE_MIN,
  baseSlug,
  candidatsSlug,
  champsFicheSchema,
  identiteFicheSchema,
  idSchema,
  slugSchema,
} from "@/lib/equipe/console/schemas";
import { exigerAdministrateur, type AdministrateurEquipe } from "@/server/equipe-garde";

export type ResultatAction<T extends object = object> =
  ({ ok: true } & T) | { ok: false; erreur: string; champs?: Record<string, string> };

const ERREUR_ACCES = "Accès réservé aux administrateurs.";

async function adminOuRefus(): Promise<AdministrateurEquipe | null> {
  try {
    return await exigerAdministrateur();
  } catch {
    return null;
  }
}

function arrondi2(n: number): number {
  return Math.round(n * 100) / 100;
}

function revalider(slug: string): void {
  revalidatePath("/fr/equipe");
  revalidatePath(`/fr/equipe/${slug}`);
}

type Tx = Pick<typeof prisma, "teamMember" | "teamMemberEvent" | "city" | "authorProfile">;

interface Lieu {
  citySlug: string | null;
  departmentCode: string | null;
  locationLabel: string | null;
  latitude: number | null;
  longitude: number | null;
}

const SANS_LIEU: Lieu = {
  citySlug: null,
  departmentCode: null,
  locationLabel: null,
  latitude: null,
  longitude: null,
};

/** Ville (table City) ou département (moyenne de ses villes), arrondi à 2 décimales. */
async function resoudreLieu(
  tx: Tx,
  citySlug: string | null,
  departmentCode: string | null,
): Promise<Lieu | "inconnu"> {
  if (citySlug !== null) {
    const ville = await tx.city.findUnique({
      where: { slug: citySlug },
      select: { slug: true, name: true, departmentCode: true, latitude: true, longitude: true },
    });
    if (!ville) return "inconnu";
    return {
      citySlug: ville.slug,
      departmentCode: ville.departmentCode,
      locationLabel: `${ville.name} (${ville.departmentCode})`,
      latitude: arrondi2(ville.latitude),
      longitude: arrondi2(ville.longitude),
    };
  }
  if (departmentCode !== null) {
    const villes = await tx.city.findMany({
      where: { departmentCode },
      select: { departmentName: true, latitude: true, longitude: true },
      take: 500,
    });
    if (villes.length === 0) return "inconnu";
    const moy = (cle: "latitude" | "longitude") =>
      arrondi2(villes.reduce((somme, v) => somme + v[cle], 0) / villes.length);
    return {
      citySlug: null,
      departmentCode,
      locationLabel: `${villes[0]!.departmentName} (${departmentCode})`,
      latitude: moy("latitude"),
      longitude: moy("longitude"),
    };
  }
  return SANS_LIEU;
}

/** Libre = ni slug ni ancien slug d'une autre fiche, ni slug d'AuthorProfile (réservés : déjà refusés). */
async function slugLibre(tx: Tx, slug: string, exclureId?: string): Promise<boolean> {
  const pris = await tx.teamMember.findFirst({
    where: {
      OR: [{ slug }, { previousSlugs: { has: slug } }],
      ...(exclureId ? { NOT: { id: exclureId } } : {}),
    },
    select: { id: true },
  });
  if (pris) return false;
  const auteur = await tx.authorProfile.findUnique({ where: { slug }, select: { id: true } });
  return auteur === null;
}

async function premierSlugLibre(
  tx: Tx,
  base: string,
  category: string,
  exclureId?: string,
): Promise<string | null> {
  for (const candidat of candidatsSlug(base, category)) {
    if (!slugSchema.safeParse(candidat).success) continue;
    if (await slugLibre(tx, candidat, exclureId)) return candidat;
  }
  return null;
}

function estConflitUnique(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

// ───────────────────────── Lecture : recherche de lieu et slug proposé ─────────────────────────

export interface LieuTrouve {
  type: "ville" | "departement";
  valeur: string;
  libelle: string;
}

export async function rechercherLieux(q: string): Promise<ResultatAction<{ lieux: LieuTrouve[] }>> {
  if (!(await adminOuRefus())) return { ok: false, erreur: ERREUR_ACCES };
  const terme = typeof q === "string" ? q.trim() : "";
  if (terme.length < 2 || terme.length > 60) return { ok: true, lieux: [] };
  const [villes, departements] = await Promise.all([
    prisma.city.findMany({
      where: { name: { contains: terme, mode: "insensitive" } },
      orderBy: { population: "desc" },
      take: 10,
      select: { slug: true, name: true, departmentCode: true },
    }),
    prisma.city.groupBy({
      by: ["departmentCode", "departmentName"],
      where: {
        OR: [
          { departmentCode: { startsWith: terme.toUpperCase() } },
          { departmentName: { contains: terme, mode: "insensitive" } },
        ],
      },
      orderBy: { departmentCode: "asc" },
      take: 5,
    }),
  ]);
  return {
    ok: true,
    lieux: [
      ...villes.map((v) => ({
        type: "ville" as const,
        valeur: v.slug,
        libelle: `${v.name} (${v.departmentCode})`,
      })),
      ...departements.map((d) => ({
        type: "departement" as const,
        valeur: d.departmentCode,
        libelle: `Département : ${d.departmentName} (${d.departmentCode})`,
      })),
    ],
  };
}

export async function proposerSlugCollaborateur(entree: {
  firstName: string;
  category: string;
  citySlug?: string | null;
  departmentCode?: string | null;
  excluId?: string;
}): Promise<ResultatAction<{ slug: string }>> {
  if (!(await adminOuRefus())) return { ok: false, erreur: ERREUR_ACCES };
  const parse = identiteFicheSchema.safeParse({
    category: entree?.category,
    firstName: entree?.firstName,
  });
  if (!parse.success) return { ok: false, erreur: "Prénom ou catégorie invalide." };
  const lieu = await resoudreLieu(
    prisma,
    typeof entree.citySlug === "string" && entree.citySlug !== "" ? entree.citySlug : null,
    typeof entree.departmentCode === "string" && entree.departmentCode !== ""
      ? entree.departmentCode
      : null,
  );
  if (lieu === "inconnu") return { ok: false, erreur: "Lieu inconnu." };
  const ville =
    lieu.citySlug !== null ? lieu.locationLabel?.replace(/\s*\(.*\)$/, "") : lieu.departmentCode;
  const exclure =
    entree.excluId && idSchema.safeParse(entree.excluId).success ? entree.excluId : undefined;
  const slug = await premierSlugLibre(
    prisma,
    baseSlug([parse.data.firstName, ville]),
    parse.data.category,
    exclure,
  );
  return slug ? { ok: true, slug } : { ok: false, erreur: "Aucun slug libre trouvé." };
}

// ───────────────────────── Création et modification ─────────────────────────

interface ConsentsExistants {
  publicationConsentAt: Date | null;
  linkedinConsentAt: Date | null;
  status: string;
}

/** Calcule les colonnes de consentement. Un accord NOUVEAU saisi ici exige la note de preuve. */
function patchConsentements(
  demande: { consentPublication: boolean; consentLinkedin: boolean; consentNote: string | null },
  existant: ConsentsExistants | null,
  maintenant: Date,
): { erreur: string } | { data: Record<string, unknown>; changes: string[] } {
  const data: Record<string, unknown> = {};
  const changes: string[] = [];
  const nouveau =
    (demande.consentPublication && !existant?.publicationConsentAt) ||
    (demande.consentLinkedin && !existant?.linkedinConsentAt);
  if (nouveau) {
    if ((demande.consentNote ?? "").length < NOTE_PREUVE_MIN) {
      return {
        erreur: `Une note de preuve (${NOTE_PREUVE_MIN} caractères au moins) est obligatoire pour un accord saisi depuis la console.`,
      };
    }
    data["consentSource"] = "console";
    data["consentNote"] = demande.consentNote;
  }
  if (demande.consentPublication && !existant?.publicationConsentAt) {
    data["publicationConsentAt"] = maintenant;
    data["publicationConsentVersion"] = TEAM_CONSENT_VERSION_COURANTE.publication.version;
    changes.push("consentement_publication_donne");
  } else if (!demande.consentPublication && existant?.publicationConsentAt) {
    if (existant.status === "publie") {
      return { erreur: "Dépubliez la fiche avant de retirer l'accord de publication." };
    }
    data["publicationConsentAt"] = null;
    data["publicationConsentVersion"] = null;
    changes.push("consentement_publication_retire");
  }
  if (demande.consentLinkedin && !existant?.linkedinConsentAt) {
    data["linkedinConsentAt"] = maintenant;
    data["linkedinConsentVersion"] = TEAM_CONSENT_VERSION_COURANTE.linkedin.version;
    changes.push("consentement_linkedin_donne");
  } else if (!demande.consentLinkedin && existant?.linkedinConsentAt) {
    data["linkedinConsentAt"] = null;
    data["linkedinConsentVersion"] = null;
    changes.push("consentement_linkedin_retire");
  }
  return { data, changes };
}

function messagesZod(e: import("zod").ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of e.issues) out[String(issue.path[0] ?? "_")] ??= issue.message;
  return out;
}

export async function creerCollaborateur(
  entree: unknown,
): Promise<ResultatAction<{ id: string; slug: string }>> {
  const admin = await adminOuRefus();
  if (!admin) return { ok: false, erreur: ERREUR_ACCES };
  const parse = champsFicheSchema.safeParse(entree);
  if (!parse.success) {
    return { ok: false, erreur: "Fiche invalide.", champs: messagesZod(parse.error) };
  }
  const v = parse.data;
  const maintenant = new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      const lieu = await resoudreLieu(tx, v.citySlug, v.departmentCode);
      if (lieu === "inconnu")
        return {
          ok: false as const,
          erreur: "Lieu inconnu.",
          champs: { citySlug: "Lieu inconnu" },
        };
      if (v.showOnMap && lieu.latitude === null) {
        return {
          ok: false as const,
          erreur: "Choisissez un lieu pour afficher un point sur la carte.",
        };
      }
      const consent = patchConsentements(v, null, maintenant);
      if ("erreur" in consent) return { ok: false as const, erreur: consent.erreur };

      let slug: string | null;
      if (v.slug) {
        slug = (await slugLibre(tx, v.slug)) ? v.slug : null;
        if (!slug)
          return {
            ok: false as const,
            erreur: "Ce slug est déjà pris.",
            champs: { slug: "Déjà pris" },
          };
      } else {
        const ville =
          lieu.citySlug !== null
            ? lieu.locationLabel?.replace(/\s*\(.*\)$/, "")
            : lieu.departmentCode;
        slug = await premierSlugLibre(tx, baseSlug([v.firstName, ville]), v.category);
        if (!slug) return { ok: false as const, erreur: "Aucun slug libre trouvé." };
      }

      const cree = await tx.teamMember.create({
        data: {
          slug,
          category: v.category,
          status: "brouillon",
          firstName: v.firstName,
          organizationName: v.organizationName,
          jobTitle: v.jobTitle,
          headline: v.headline,
          bioMd: v.bioMd,
          skills: v.skills,
          languages: v.languages,
          websiteUrl: v.websiteUrl,
          linkedinUrl: v.linkedinUrl,
          ...lieu,
          showOnMap: v.showOnMap,
          sortOrder: v.sortOrder,
          ...consent.data,
        },
        select: { id: true, slug: true },
      });
      await tx.teamMemberEvent.create({
        data: {
          memberId: cree.id,
          action: "creation",
          actor: admin.userId,
          details: { categorie: v.category, evenements: consent.changes },
        },
      });
      return { ok: true as const, id: cree.id, slug: cree.slug };
    });
  } catch (e) {
    if (estConflitUnique(e))
      return { ok: false, erreur: "Ce slug est déjà pris.", champs: { slug: "Déjà pris" } };
    throw e;
  }
}

export async function modifierCollaborateur(
  id: unknown,
  entree: unknown,
): Promise<ResultatAction<{ slug: string }>> {
  const admin = await adminOuRefus();
  if (!admin) return { ok: false, erreur: ERREUR_ACCES };
  const idOk = idSchema.safeParse(id);
  if (!idOk.success) return { ok: false, erreur: "Identifiant invalide." };
  const parse = champsFicheSchema.safeParse(entree);
  if (!parse.success) {
    return { ok: false, erreur: "Fiche invalide.", champs: messagesZod(parse.error) };
  }
  const v = parse.data;
  const maintenant = new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      const actuel = await tx.teamMember.findUnique({ where: { id: idOk.data } });
      if (!actuel) return { ok: false as const, erreur: "Fiche introuvable." };

      const lieu = await resoudreLieu(tx, v.citySlug, v.departmentCode);
      if (lieu === "inconnu")
        return {
          ok: false as const,
          erreur: "Lieu inconnu.",
          champs: { citySlug: "Lieu inconnu" },
        };
      if (v.showOnMap && lieu.latitude === null) {
        return {
          ok: false as const,
          erreur: "Choisissez un lieu pour afficher un point sur la carte.",
        };
      }
      const consent = patchConsentements(v, actuel, maintenant);
      if ("erreur" in consent) return { ok: false as const, erreur: consent.erreur };

      let slug = actuel.slug;
      if (v.slug && v.slug !== actuel.slug) {
        if (actuel.publishedAt !== null) {
          return {
            ok: false as const,
            erreur: "Le slug est figé après la première publication.",
            champs: { slug: "Figé" },
          };
        }
        if (!(await slugLibre(tx, v.slug, actuel.id))) {
          return {
            ok: false as const,
            erreur: "Ce slug est déjà pris.",
            champs: { slug: "Déjà pris" },
          };
        }
        slug = v.slug;
      }

      // Le lien LinkedIn n'est conservé que s'il est saisi ; il n'est AFFICHÉ qu'avec l'accord.
      const touches: string[] = [];
      const compare: Array<[string, unknown, unknown]> = [
        ["categorie", actuel.category, v.category],
        ["prenom", actuel.firstName, v.firstName],
        ["structure", actuel.organizationName, v.organizationName],
        ["intitule", actuel.jobTitle, v.jobTitle],
        ["accroche", actuel.headline, v.headline],
        ["presentation", actuel.bioMd, v.bioMd],
        ["competences", actuel.skills.join("|"), v.skills.join("|")],
        ["langues", actuel.languages.join("|"), v.languages.join("|")],
        ["site", actuel.websiteUrl, v.websiteUrl],
        ["linkedin", actuel.linkedinUrl, v.linkedinUrl],
        [
          "lieu",
          `${actuel.citySlug}|${actuel.departmentCode}`,
          `${lieu.citySlug}|${lieu.departmentCode}`,
        ],
        ["carte", actuel.showOnMap, v.showOnMap],
        ["slug", actuel.slug, slug],
        ["ordre", actuel.sortOrder, v.sortOrder],
      ];
      for (const [nom, avant, apres] of compare) if (avant !== apres) touches.push(nom);

      await tx.teamMember.update({
        where: { id: actuel.id },
        data: {
          slug,
          category: v.category,
          firstName: v.firstName,
          organizationName: v.organizationName,
          jobTitle: v.jobTitle,
          headline: v.headline,
          bioMd: v.bioMd,
          skills: v.skills,
          languages: v.languages,
          websiteUrl: v.websiteUrl,
          linkedinUrl: v.linkedinUrl,
          ...lieu,
          showOnMap: v.showOnMap,
          sortOrder: v.sortOrder,
          ...consent.data,
        },
      });
      await tx.teamMemberEvent.create({
        data: {
          memberId: actuel.id,
          action: "modification",
          actor: admin.userId,
          details: { champs: touches, evenements: consent.changes },
        },
      });
      if (actuel.status === "publie") revalider(slug);
      return { ok: true as const, slug };
    });
  } catch (e) {
    if (estConflitUnique(e))
      return { ok: false, erreur: "Ce slug est déjà pris.", champs: { slug: "Déjà pris" } };
    throw e;
  }
}

// ───────────────────────── Publier, dépublier, carte ─────────────────────────

export async function publierCollaborateur(id: unknown): Promise<ResultatAction<{ slug: string }>> {
  const admin = await adminOuRefus();
  if (!admin) return { ok: false, erreur: ERREUR_ACCES };
  const idOk = idSchema.safeParse(id);
  if (!idOk.success) return { ok: false, erreur: "Identifiant invalide." };
  const maintenant = new Date();
  return prisma.$transaction(async (tx) => {
    const m = await tx.teamMember.findUnique({ where: { id: idOk.data } });
    if (!m) return { ok: false as const, erreur: "Fiche introuvable." };
    if (m.status === "publie") return { ok: false as const, erreur: "La fiche est déjà publiée." };
    if (!m.publicationConsentAt) {
      return {
        ok: false as const,
        erreur: "Impossible de publier sans l'accord de publication de la personne.",
      };
    }
    if (m.status === "retire" && m.withdrawnAt && m.publicationConsentAt <= m.withdrawnAt) {
      return {
        ok: false as const,
        erreur: "Une fiche retirée ne se republie qu'avec un NOUVEL accord de publication.",
      };
    }
    if (m.consentSource === "console" && (m.consentNote ?? "").trim().length < NOTE_PREUVE_MIN) {
      return { ok: false as const, erreur: "La note de preuve de l'accord est manquante." };
    }
    const r = await tx.teamMember.updateMany({
      where: { id: m.id, status: m.status },
      data: {
        status: "publie",
        publishedAt: m.publishedAt ?? maintenant,
        validatedAt: maintenant,
        validatedByAdminId: admin.userId,
        withdrawnAt: null,
        withdrawnBy: null,
      },
    });
    if (r.count !== 1)
      return { ok: false as const, erreur: "La fiche a changé entre-temps, rechargez la page." };
    await tx.teamMemberEvent.create({
      data: {
        memberId: m.id,
        action: "publication",
        actor: admin.userId,
        details: { depuis: m.status },
      },
    });
    revalider(m.slug);
    return { ok: true as const, slug: m.slug };
  });
}

export async function depublierCollaborateur(
  id: unknown,
): Promise<ResultatAction<{ slug: string }>> {
  const admin = await adminOuRefus();
  if (!admin) return { ok: false, erreur: ERREUR_ACCES };
  const idOk = idSchema.safeParse(id);
  if (!idOk.success) return { ok: false, erreur: "Identifiant invalide." };
  return prisma.$transaction(async (tx) => {
    const m = await tx.teamMember.findUnique({
      where: { id: idOk.data },
      select: { id: true, slug: true, status: true },
    });
    if (!m) return { ok: false as const, erreur: "Fiche introuvable." };
    if (m.status !== "publie") return { ok: false as const, erreur: "La fiche n'est pas publiée." };
    const r = await tx.teamMember.updateMany({
      where: { id: m.id, status: "publie" },
      data: { status: "retire", withdrawnAt: new Date(), withdrawnBy: "admin" },
    });
    if (r.count !== 1)
      return { ok: false as const, erreur: "La fiche a changé entre-temps, rechargez la page." };
    await tx.teamMemberEvent.create({
      data: { memberId: m.id, action: "depublication", actor: admin.userId },
    });
    revalider(m.slug);
    return { ok: true as const, slug: m.slug };
  });
}

export async function basculerPointCarte(id: unknown, actif: unknown): Promise<ResultatAction> {
  const admin = await adminOuRefus();
  if (!admin) return { ok: false, erreur: ERREUR_ACCES };
  const idOk = idSchema.safeParse(id);
  if (!idOk.success || typeof actif !== "boolean")
    return { ok: false, erreur: "Demande invalide." };
  return prisma.$transaction(async (tx) => {
    const m = await tx.teamMember.findUnique({
      where: { id: idOk.data },
      select: { id: true, slug: true, status: true, latitude: true, longitude: true },
    });
    if (!m) return { ok: false as const, erreur: "Fiche introuvable." };
    if (actif && (m.latitude === null || m.longitude === null)) {
      return { ok: false as const, erreur: "Choisissez d'abord un lieu pour cette fiche." };
    }
    await tx.teamMember.update({ where: { id: m.id }, data: { showOnMap: actif } });
    await tx.teamMemberEvent.create({
      data: {
        memberId: m.id,
        action: actif ? "carte_activee" : "carte_desactivee",
        actor: admin.userId,
      },
    });
    if (m.status === "publie") revalider(m.slug);
    return { ok: true as const };
  });
}
