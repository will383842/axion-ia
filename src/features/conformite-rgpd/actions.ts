// Conformité RGPD (console) — « Mettre à jour le registre ».
//
// Rôle administrateur seulement, revérifié ICI : une action serveur se joint par un
// simple POST, le bouton masqué n'est pas une garde. Le journal d'activité garde la
// trace de l'import, sans aucun contenu du registre (seulement des comptes).

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { adminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { isR2Configured } from "@/lib/r2-storage";
import { journaliser } from "@/server/journal/journaliser";

import { peutImporterRegistre } from "./regles";
import { lireRegistreJson } from "./schema";
import { enregistrerRegistre, TAILLE_MAX_REGISTRE } from "./stockage";

export type ResultatImport = { ok: true; traitements: number } | { ok: false; erreur: string };

/** Le cœur, sans redirection : testable tel quel. */
export async function importerRegistre(formData: FormData): Promise<ResultatImport> {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) return { ok: false, erreur: "Session expirée : reconnectez-vous." };
  if (!peutImporterRegistre(user.role)) {
    return { ok: false, erreur: "Réservé aux administrateurs." };
  }
  if (!isR2Configured()) {
    return { ok: false, erreur: "Le stockage privé n'est pas configuré sur ce serveur." };
  }

  const fichier = formData.get("registre");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, erreur: "Choisissez le fichier registre.json." };
  }
  // La taille AVANT la lecture : on ne charge pas en mémoire ce qu'on va refuser.
  if (fichier.size > TAILLE_MAX_REGISTRE) {
    return { ok: false, erreur: "Fichier trop lourd (2 Mo au plus)." };
  }

  const texte = await fichier.text();
  const v = lireRegistreJson(texte);
  if (!v.ok) return { ok: false, erreur: v.erreur };

  try {
    await enregistrerRegistre(JSON.parse(texte) as unknown, new Date());
  } catch {
    return { ok: false, erreur: "L'enregistrement a échoué. Réessayez dans un instant." };
  }

  await journaliser(prisma, {
    action: "conformite.registre.importe",
    targetType: "RegistreRgpd",
    targetId: null,
    session: { userId: user.id },
    changes: {
      traitements: v.registre.traitements.length,
      ecarts: v.registre.traitements.reduce((n, t) => n + t.ecarts.length, 0),
      octets: fichier.size,
    },
  });
  return { ok: true, traitements: v.registre.traitements.length };
}

/** L'action du formulaire : importe, puis revient sur la page avec le résultat. */
export async function importerRegistreAction(formData: FormData): Promise<void> {
  const r = await importerRegistre(formData);
  const base = adminPath("fr", "conformite-rgpd");
  if (r.ok) {
    revalidatePath(base);
    redirect(`${base}?import=ok`);
  }
  redirect(`${base}?erreur=${encodeURIComponent(r.erreur)}`);
}
