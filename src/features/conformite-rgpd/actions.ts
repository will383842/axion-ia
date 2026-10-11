// Conformité RGPD (console) — « Mettre à jour le registre » et « Reprendre le
// registre déjà importé ».
//
// Rôle administrateur seulement, revérifié ICI (`garde.ts`). Le fichier alimente la
// BASE (upsert, sans rouvrir un écart corrigé) ; sa copie datée reste dans R2 comme
// historique. Le journal d'activité garde la trace, sans aucun contenu (des comptes).

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { adminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { isR2Configured } from "@/lib/r2-storage";
import { journaliser } from "@/server/journal/journaliser";

import { ecrireRegistreEnBase, verifierCodes, type BilanImport } from "./base";
import { exigerAdministrateur } from "./garde";
import { lireRegistreJson } from "./schema";
import { enregistrerRegistre, lireRegistre, TAILLE_MAX_REGISTRE } from "./stockage";

export type ResultatImport = { ok: true; traitements: number } | { ok: false; erreur: string };

const ECHEC = "L'enregistrement a échoué. Réessayez dans un instant.";

/** Le cœur, sans redirection : testable tel quel. */
export async function importerRegistre(formData: FormData): Promise<ResultatImport> {
  const garde = await exigerAdministrateur();
  if (!garde.ok) return garde;
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
  const codes = verifierCodes(v.registre);
  if (codes) return { ok: false, erreur: codes };

  const maintenant = new Date();
  let bilan: BilanImport;
  try {
    // La copie datée d'abord : l'historique est complet même si la base échoue.
    await enregistrerRegistre(JSON.parse(texte) as unknown, maintenant);
    bilan = await ecrireRegistreEnBase(v.registre, garde.auteur, maintenant);
  } catch {
    return { ok: false, erreur: ECHEC };
  }

  await journaliser(prisma, {
    action: "conformite.registre.importe",
    targetType: "RegistreRgpd",
    targetId: null,
    session: { userId: garde.auteur.id },
    changes: { ...bilan, octets: fichier.size },
  });
  return { ok: true, traitements: bilan.traitements };
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

/**
 * Reprise du lot 1 : le registre déjà rangé dans R2 entre dans la base. Seulement
 * si la base est vide — jamais d'import silencieux, c'est un bouton.
 */
export async function reprendreRegistre(): Promise<ResultatImport> {
  const garde = await exigerAdministrateur();
  if (!garde.ok) return garde;
  let deja: number;
  try {
    deja = await prisma.traitementRgpd.count();
  } catch {
    return { ok: false, erreur: ECHEC };
  }
  if (deja > 0) return { ok: false, erreur: "Le registre est déjà dans la base." };

  const lecture = await lireRegistre();
  if (lecture.etat !== "ok") {
    return { ok: false, erreur: "Aucun registre lisible à reprendre dans le stockage privé." };
  }
  const codes = verifierCodes(lecture.registre);
  if (codes) return { ok: false, erreur: codes };

  let bilan: BilanImport;
  try {
    bilan = await ecrireRegistreEnBase(lecture.registre, garde.auteur, new Date());
  } catch {
    return { ok: false, erreur: ECHEC };
  }
  await journaliser(prisma, {
    action: "conformite.registre.repris",
    targetType: "RegistreRgpd",
    targetId: null,
    session: { userId: garde.auteur.id },
    changes: bilan,
  });
  return { ok: true, traitements: bilan.traitements };
}

export async function reprendreRegistreAction(): Promise<void> {
  const r = await reprendreRegistre();
  const base = adminPath("fr", "conformite-rgpd");
  if (r.ok) {
    revalidatePath(base);
    redirect(`${base}?import=ok`);
  }
  redirect(`${base}?erreur=${encodeURIComponent(r.erreur)}`);
}
