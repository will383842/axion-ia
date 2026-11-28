"use server";

/**
 * Écran « À valider » de la console : les trois décisions sur une fiche arrivée par le questionnaire.
 *
 * Règles communes :
 *  - rôle administrateur revérifié dans CHAQUE action, AVANT toute lecture de la base ;
 *  - identifiant au format UUID, et seule une fiche au statut « a_valider » passe par ici
 *    (une fiche publiée ou en brouillon ne peut pas être décidée depuis cet écran) ;
 *  - aucun consentement ne se donne ici : ceux du formulaire sont remplacés par ceux de la base ;
 *  - rien n'est écrit si une condition de publication manque (pas d'enregistrement à moitié) ;
 *  - chaque décision = au moins une ligne de `TeamMemberEvent`.
 */
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { NOTE_PREUVE_MIN, champsFicheSchema, idSchema } from "@/lib/equipe/console/schemas";
import { exigerAdministrateur, type AdministrateurEquipe } from "@/server/equipe-garde";

import { modifierCollaborateur, publierCollaborateur, type ResultatAction } from "./collaborateurs";

const ERREUR_ACCES = "Accès réservé aux administrateurs.";
const NOTE_REFUS_MAX = 2000;

async function adminOuRefus(): Promise<AdministrateurEquipe | null> {
  try {
    return await exigerAdministrateur();
  } catch {
    return null;
  }
}

type Fiche = NonNullable<Awaited<ReturnType<typeof prisma.teamMember.findUnique>>>;

type Prepare =
  | { ok: false; erreur: string; champs?: Record<string, string> }
  | { ok: true; admin: AdministrateurEquipe; id: string; m: Fiche };

/** Rôle, identifiant, fiche « à valider » et version : commun aux trois décisions. */
async function preparer(id: unknown, version: unknown): Promise<Prepare> {
  const admin = await adminOuRefus();
  if (!admin) return { ok: false, erreur: ERREUR_ACCES };
  const idOk = idSchema.safeParse(id);
  if (!idOk.success) return { ok: false, erreur: "Identifiant invalide." };
  if (typeof version !== "string" || Number.isNaN(Date.parse(version))) {
    return { ok: false, erreur: "Version de la fiche manquante : rechargez la page." };
  }
  const m = await prisma.teamMember.findUnique({ where: { id: idOk.data } });
  if (!m) return { ok: false, erreur: "Fiche introuvable." };
  if (m.status !== "a_valider") {
    return { ok: false, erreur: "Cette fiche n'est pas à valider." };
  }
  if (m.erasureRequestedAt) {
    return { ok: false, erreur: "Une demande d'effacement est en cours : fiche verrouillée." };
  }
  if (m.updatedAt.toISOString() !== new Date(version).toISOString()) {
    return {
      ok: false,
      erreur: "La fiche a changé depuis l'affichage : rechargez la page.",
    };
  }
  return { ok: true, admin, id: idOk.data, m };
}

/** Le formulaire n'accorde rien : les consentements viennent de la base, jamais du navigateur. */
function entreeSansConsentement(entree: unknown, m: Fiche): unknown {
  if (typeof entree !== "object" || entree === null || Array.isArray(entree)) return entree;
  return {
    ...entree,
    consentPublication: m.publicationConsentAt !== null,
    consentLinkedin: m.linkedinConsentAt !== null,
    consentNote: "",
  };
}

async function clore(
  memberId: string,
  statut: "validee" | "refusee",
  note: string | null,
): Promise<void> {
  try {
    await prisma.teamQuestionnaireSubmission.updateMany({
      where: { memberId, status: "recue" },
      data: {
        status: statut,
        reviewedAt: new Date(),
        ...(note !== null ? { reviewNote: note } : {}),
      },
    });
  } catch {
    /* la décision est prise ; le marquage de la réponse est un confort de lecture */
  }
}

export async function enregistrerEnBrouillon(
  id: unknown,
  entree: unknown,
  version: unknown,
): Promise<ResultatAction<{ slug: string }>> {
  const p = await preparer(id, version);
  if (!p.ok) return p;
  const saisie = entreeSansConsentement(entree, p.m);
  const modifie = await modifierCollaborateur(p.id, saisie, version);
  if (!modifie.ok) return modifie;
  const ok = await prisma.$transaction(async (tx) => {
    const r = await tx.teamMember.updateMany({
      where: { id: p.id, status: "a_valider", erasureRequestedAt: null },
      data: { status: "brouillon" },
    });
    if (r.count !== 1) return false;
    await tx.teamMemberEvent.create({
      data: { memberId: p.id, action: "mise_en_brouillon", actor: p.admin.userId },
    });
    return true;
  });
  if (!ok) return { ok: false, erreur: "La fiche a changé entre-temps, rechargez la page." };
  return { ok: true, slug: modifie.slug };
}

export async function validerEtPublier(
  id: unknown,
  entree: unknown,
  version: unknown,
): Promise<ResultatAction<{ slug: string }>> {
  const p = await preparer(id, version);
  if (!p.ok) return p;
  const saisie = entreeSansConsentement(entree, p.m);
  const parse = champsFicheSchema.safeParse(saisie);
  if (!parse.success) return { ok: false, erreur: "Fiche invalide." };

  // Toutes les conditions AVANT la première écriture : un refus ne laisse rien d'enregistré.
  if (!p.m.publicationConsentAt) {
    return {
      ok: false,
      erreur: "Impossible de publier sans l'accord de publication de la personne.",
    };
  }
  if (p.m.photoKind === "reelle" && !p.m.photoConsentAt) {
    return {
      ok: false,
      erreur:
        "Photo réelle sans accord photo : retirez la photo (retour à l'avatar) avant de publier.",
    };
  }
  if (parse.data.linkedinUrl !== null && !p.m.linkedinConsentAt) {
    return {
      ok: false,
      erreur: "Lien LinkedIn sans accord LinkedIn : videz le champ avant de publier.",
      champs: { linkedinUrl: "Sans accord LinkedIn" },
    };
  }

  const modifie = await modifierCollaborateur(p.id, saisie, version);
  if (!modifie.ok) return modifie;
  const publie = await publierCollaborateur(p.id);
  if (!publie.ok) return publie;
  await clore(p.id, "validee", null);
  revalidatePath("/sitemap.xml");
  return { ok: true, slug: publie.slug };
}

export async function refuserFiche(
  id: unknown,
  note: unknown,
  version: unknown,
): Promise<ResultatAction> {
  const p = await preparer(id, version);
  if (!p.ok) return p;
  const texte = typeof note === "string" ? note.trim() : "";
  if (texte.length < NOTE_PREUVE_MIN) {
    return {
      ok: false,
      erreur: `Une note de refus (${NOTE_PREUVE_MIN} caractères au moins) est obligatoire.`,
    };
  }
  if (texte.length > NOTE_REFUS_MAX) {
    return { ok: false, erreur: `La note de refus dépasse ${NOTE_REFUS_MAX} caractères.` };
  }
  const ok = await prisma.$transaction(async (tx) => {
    const r = await tx.teamMember.updateMany({
      where: { id: p.id, status: "a_valider", updatedAt: p.m.updatedAt, erasureRequestedAt: null },
      data: { status: "brouillon" },
    });
    if (r.count !== 1) return false;
    await tx.teamMemberEvent.create({
      data: { memberId: p.id, action: "refus", actor: p.admin.userId, details: { note: texte } },
    });
    return true;
  });
  if (!ok) return { ok: false, erreur: "La fiche a changé entre-temps, rechargez la page." };
  await clore(p.id, "refusee", texte);
  return { ok: true };
}
