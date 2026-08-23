/**
 * Console éditoriale — Server Actions de la banque d'idées (lot 1).
 *
 * > **Noter une idée : 10 secondes, 1 champ.** (§1 ter, test de simplicité)
 *
 * Ce n'est pas une préférence d'ergonomie, c'est la condition de survie de la
 * fonction : une idée se note debout, entre deux rendez-vous. Un formulaire
 * qui en demande six ne sera pas rempli, et la matière sera perdue. Le schéma
 * de capture n'a donc **qu'un champ obligatoire**, et tout le reste est
 * facultatif — y compris le compte et la famille.
 *
 * C'est aussi pourquoi `idee.capturer` est ouverte à TOUS les rôles, `lecture`
 * comprise (§4) : brider la capture coûterait plus que ça ne protège.
 */

"use server";

import { z } from "zod";
import { champ, avecErreur, avecSucces } from "@/server/actions/editorial/_form-outils";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, journaliser } from "@/server/actions/editorial/_guards";
import type { ActionResult } from "@/server/actions/editorial/publications";
import {
  dateIsoValide,
  dateUtcStricte,
  heureValide,
  verifierDateIso,
} from "@/server/editorial/calendrier-pur";

/** 🔴 UN seul champ requis. Tout ajout ici doit être combattu. */
const captureSchema = z.object({
  titre: z.string().trim().min(1, "Une idée, même en trois mots").max(240),
  detail: z.string().max(5_000).optional(),
  lien: z.string().max(1024).optional(),
  compteId: z.string().uuid().optional(),
  familleId: z.string().uuid().optional(),
  interet: z.number().int().min(1).max(5).optional(),
  origine: z.string().max(120).optional(),
});

const promotionSchema = z.object({
  id: z.string().uuid(),
  compteId: z.string().uuid(),
  datePrevue: z.string().refine(dateIsoValide, (v) => ({
    // Le message CITE la valeur fautive et dit ce qui cloche : « 30 février »
    // et « année hors calendrier » ne se corrigent pas de la même façon.
    message: verifierDateIso(v).ok ? "" : (verifierDateIso(v) as { erreur: string }).erreur,
  })),
  heurePrevue: z
    .string()
    .refine(heureValide, "Heure attendue au format HH:MM, entre 00:00 et 23:59")
    .optional(),
});

const archivageSchema = z.object({
  id: z.string().uuid(),
  motif: z.string().trim().min(1, "Dire POURQUOI on écarte une idée").max(1_000),
});

function messageErreur(e: unknown): string {
  return e instanceof Error ? e.message : "Erreur inattendue";
}

// ── Capturer ──────────────────────────────────────────────────────────────

export async function capturerIdeeAction(
  input: z.input<typeof captureSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const membre = await requirePermission("idee.capturer");
    const parsed = captureSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
    }
    const v = parsed.data;

    const idee = await prisma.edIdee.create({
      data: {
        titre: v.titre,
        detail: v.detail ?? null,
        lien: v.lien ?? null,
        compteId: v.compteId ?? null,
        familleId: v.familleId ?? null,
        interet: v.interet ?? null,
        origine: v.origine ?? null,
        statut: "capturee",
      },
      select: { id: true },
    });

    await journaliser({
      entite: "EdIdee",
      entiteId: idee.id,
      action: "capture",
      membreId: membre.membreId,
      apres: { titre: v.titre },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");
    return { data: { id: idee.id } };
  } catch (e) {
    return { error: messageErreur(e) };
  }
}

// ── Promouvoir ────────────────────────────────────────────────────────────

/**
 * Promeut une idée en publication — critère 17 du lot 1.
 *
 * L'idée n'est **pas** consommée : elle passe à `promue` et garde le lien
 * vers la publication née d'elle (`promueVersId`). On doit pouvoir remonter
 * de la publication à l'idée qui l'a déclenchée, six mois plus tard.
 *
 * Transactionnel : une idée marquée « promue » sans publication en face
 * serait une idée perdue pour tout le monde.
 */
export async function promouvoirIdeeAction(
  input: z.input<typeof promotionSchema>,
): Promise<ActionResult<{ ideeId: string; publicationId: string }>> {
  try {
    const membre = await requirePermission("idee.promouvoir");
    const parsed = promotionSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
    }
    const { id, compteId, datePrevue, heurePrevue } = parsed.data;

    const idee = await prisma.edIdee.findUnique({
      where: { id },
      select: { id: true, titre: true, detail: true, lien: true, statut: true, promueVersId: true },
    });
    if (!idee) return { error: "Idée introuvable" };
    if (idee.statut === "promue" && idee.promueVersId) {
      // Rejouer la promotion créerait une seconde publication pour la même
      // idée, sans que rien ne le signale.
      return { error: "Cette idée a déjà été promue en publication." };
    }
    if (idee.statut === "archivee") {
      return { error: "Cette idée est archivée. Réactivez-la avant de la promouvoir." };
    }

    const compte = await prisma.edCompte.findUnique({ where: { id: compteId } });
    if (!compte) return { error: "Compte introuvable" };

    const { publicationId } = await prisma.$transaction(async (tx) => {
      const publication = await tx.edPublication.create({
        data: {
          compteId,
          datePrevue: dateUtcStricte(datePrevue),
          heurePrevue: heurePrevue ?? "09:00",
          titreInterne: idee.titre.slice(0, 200),
          // Le détail de l'idée devient le premier jet du corps : le sens de
          // la promotion est de NE PAS retaper ce qui est déjà écrit.
          corps: idee.detail ?? null,
          lienUrl: idee.lien ?? null,
          statutRedaction: idee.detail ? "redige" : "idee",
          responsableId: membre.membreId,
        },
        select: { id: true },
      });

      await tx.edIdee.update({
        where: { id },
        data: { statut: "promue", promueVersId: publication.id },
      });

      return { publicationId: publication.id };
    });

    await journaliser({
      entite: "EdIdee",
      entiteId: id,
      action: "promotion",
      membreId: membre.membreId,
      avant: { statut: idee.statut },
      apres: { statut: "promue", promueVersId: publicationId },
    });
    await journaliser({
      entite: "EdPublication",
      entiteId: publicationId,
      action: "creation_par_promotion",
      membreId: membre.membreId,
      apres: { ideeId: id },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");
    return { data: { ideeId: id, publicationId } };
  } catch (e) {
    return { error: messageErreur(e) };
  }
}

// ── Archiver ──────────────────────────────────────────────────────────────

/**
 * Écarte une idée — sans la supprimer.
 *
 * Le modèle porte `motifArchivage` et le commentaire du schéma est explicite :
 * « une idée écartée n'est jamais supprimée ». Le motif est donc OBLIGATOIRE :
 * une idée écartée sans raison ressort six mois plus tard, et on refait le
 * même débat.
 */
export async function archiverIdeeAction(
  input: z.input<typeof archivageSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    const membre = await requirePermission("idee.promouvoir");
    const parsed = archivageSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Données invalides" };
    }
    const { id, motif } = parsed.data;

    const idee = await prisma.edIdee.findUnique({ where: { id }, select: { statut: true } });
    if (!idee) return { error: "Idée introuvable" };

    await prisma.edIdee.update({
      where: { id },
      data: { statut: "archivee", motifArchivage: motif },
    });

    await journaliser({
      entite: "EdIdee",
      entiteId: id,
      action: "archivage",
      membreId: membre.membreId,
      avant: { statut: idee.statut },
      apres: { statut: "archivee", motif },
    });

    revalidatePath("/[locale]/(admin)/[adminPrefix]/console-editoriale", "page");
    return { data: { id } };
  } catch (e) {
    return { error: messageErreur(e) };
  }
}

// ── Les adaptateurs de formulaire ─────────────────────────────────────────
//
// Un `<form action={…}>` HTML nu ne sait pas lire une valeur de retour : ces
// adaptateurs prennent un `FormData` et REDIRIGENT, le seul protocole qu'il
// comprenne nativement. C'est ce qui permet aux écrans de saisie de rester
// des Server Components — consommer un `{ data } | { error }` demanderait
// `useActionState`, donc du JavaScript client sur chaque écran.
//
// 🔑 Ils vivent ICI, à côté des actions qu'ils adaptent, et non dans un
// module central. Voir `_form-outils.ts` : la garde `D3-3-05` du dépôt
// raisonne au grain du fichier, et un module dont aucune action n'est nommée
// par un écran est signalé — à juste titre, car un lecteur qui cherche les
// appelants ne trouve rien non plus.

/**
 * Capture une idée — critère 16 : **un seul champ**.
 *
 * Le formulaire n'en porte qu'un, et cette action n'en exige qu'un. Le §1 ter
 * fixe la barre à « 10 secondes, 1 champ » : tout ajout ici doit être combattu.
 */
export async function capturerIdeeFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const titre = champ(donnees, "titre");

  if (!titre) {
    redirect(avecErreur(retour, "Une idée, même en trois mots."));
  }

  const detail = champ(donnees, "detail");
  const resultat = await capturerIdeeAction({
    titre,
    ...(detail ? { detail } : {}),
  });

  if ("error" in resultat) {
    redirect(avecErreur(retour, resultat.error));
  }
  redirect(`${retour}${retour.includes("?") ? "&" : "?"}capturee=1`);
}

/**
 * Promeut une idée en publication — critère 17.
 *
 * L'idée n'est pas consommée : elle garde le lien vers ce qu'elle a produit.
 */
export async function promouvoirIdeeFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const id = champ(donnees, "id");
  const compteId = champ(donnees, "compteId");
  const datePrevue = champ(donnees, "datePrevue");

  if (!id || !compteId || !datePrevue) {
    redirect(avecErreur(retour, "Idée, compte et date sont requis pour promouvoir."));
  }

  const heurePrevue = champ(donnees, "heurePrevue");
  const resultat = await promouvoirIdeeAction({
    id,
    compteId,
    datePrevue,
    ...(heurePrevue ? { heurePrevue } : {}),
  });

  if ("error" in resultat) {
    redirect(avecErreur(retour, resultat.error));
  }
  redirect(`${champ(donnees, "basePublications") ?? retour}/${resultat.data.publicationId}`);
}

/** Écarte une idée — en DISANT pourquoi, le motif est obligatoire. */
export async function archiverIdeeFormAction(donnees: FormData): Promise<void> {
  const retour = champ(donnees, "retour") ?? "";
  const id = champ(donnees, "id");
  const motif = champ(donnees, "motif");
  if (!id) redirect(avecErreur(retour, "Idée introuvable."));
  if (!motif) {
    // Le critère l'exige : écarter sans motif, c'est perdre la raison six
    // mois plus tard, quand l'idée revient et qu'on ne sait plus.
    redirect(avecErreur(retour, "Dire POURQUOI on écarte une idée."));
  }

  const resultat = await archiverIdeeAction({ id, motif });
  if ("error" in resultat) redirect(avecErreur(retour, resultat.error));
  redirect(avecSucces(retour, "archivee"));
}
