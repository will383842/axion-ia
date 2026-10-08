// Réseau d'apporteurs — CORRIGER LE NOM d'un apporteur depuis la console (2026-10-08).
//
// Cas réel : un dossier portait le nom de naissance au lieu du nom d'usage. L'apporteur ne peut
// saisir son nom que s'il est vide, et la console n'avait aucun moyen de le corriger (il a fallu
// une correction à la main en production).
//
// Règles :
//   · réservé au droit « contresigner » (contrôlé par l'action serveur) ;
//   · REFUSÉ dès que le contrat est signé par l'apporteur : le nom figure dans le PDF signé, et le
//     changer demanderait un avenant ;
//   · prénom et nom chiffrés (`encryptPii`) ; le geste est tracé au journal d'activité, avec
//     l'avant et l'après CHIFFRÉS (le journal ne porte jamais un nom en clair).

import { decryptPii, encryptPii } from "@/lib/pii-crypto";
import { prisma } from "@/lib/prisma";

const LONGUEUR_MAX = 80;
// Lettres (accents compris), espaces, trait d'union, apostrophes : pas de chiffre ni de symbole.
const NOM_VALIDE = /^[\p{L}][\p{L}\p{M}' ’-]*$/u;

export const REFUS_CONTRAT_SIGNE =
  "Le contrat est déjà signé : ce nom figure dans le PDF signé. Le corriger demande un avenant.";

function nettoyer(v: string): string {
  return v.replace(/\s+/g, " ").trim();
}

export async function corrigerNomApporteur(e: {
  apporteurId: string;
  prenom: string;
  nom: string;
  acteurId: string | null;
}): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const prenom = nettoyer(e.prenom);
  const nom = nettoyer(e.nom);
  if (!prenom || !nom) return { ok: false, message: "Indiquez le prénom et le nom." };
  if (prenom.length > LONGUEUR_MAX || nom.length > LONGUEUR_MAX)
    return { ok: false, message: `${LONGUEUR_MAX} caractères au plus.` };
  if (!NOM_VALIDE.test(prenom) || !NOM_VALIDE.test(nom))
    return {
      ok: false,
      message: "Lettres, espaces, traits d'union et apostrophes seulement.",
    };
  const a = await prisma.apporteurReseau.findUnique({
    where: { id: e.apporteurId },
    select: { prenom: true, nom: true, signeParApporteurAt: true },
  });
  if (!a) return { ok: false, message: "Apporteur introuvable." };
  if (a.signeParApporteurAt) return { ok: false, message: REFUS_CONTRAT_SIGNE };
  if (decryptPii(a.prenom) === prenom && decryptPii(a.nom) === nom)
    return { ok: false, message: "Aucun changement." };
  // Écriture conditionnée : un contrat signé entre la lecture et l'écriture n'est jamais modifié.
  const r = await prisma.apporteurReseau.updateMany({
    where: { id: e.apporteurId, signeParApporteurAt: null },
    data: { prenom: encryptPii(prenom), nom: encryptPii(nom) },
  });
  if (r.count !== 1) return { ok: false, message: REFUS_CONTRAT_SIGNE };
  try {
    await prisma.activityLog.create({
      data: {
        adminUserId: e.acteurId,
        action: "apporteur_reseau.nom_corrige",
        targetType: "apporteur_reseau",
        targetId: e.apporteurId,
        changes: {
          avant: { prenom: a.prenom, nom: a.nom },
          apres: { prenom: encryptPii(prenom), nom: encryptPii(nom) },
        },
      },
    });
  } catch {
    // La trace ne fait jamais échouer le geste.
  }
  return { ok: true, message: `Nom corrigé : ${prenom} ${nom}.` };
}
