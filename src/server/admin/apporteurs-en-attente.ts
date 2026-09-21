// Les candidats apporteurs qui attendent une reponse — la tuile « Aujourd'hui »
// de l'accueil admin (2026-09-21).
//
// ── Pourquoi un module A PART, et pas trois fonctions de plus dans
//    `pilotage-dashboard.ts` ────────────────────────────────────────────────
// 🔑 Ce fichier-la tire `@/auth`, donc next-auth, donc `next/server` : une
// suite de tests qui l'importe pour verifier UN compte doit d'abord mimer une
// quarantaine de modules, et finit par ne rien verifier du tout. Ici, un seul
// mock suffit — Prisma. Le cout d'un test se paie a l'ecriture de la chose
// testee, pas au moment ou on essaie de la tester.
//
// Ce module n'importe que Prisma et le predicat apporteur, tous deux purs cote
// graphe.

import { prisma } from "@/lib/prisma";
import { FILTRE_APPORTEUR_PRISMA } from "@/lib/commercial-application/est-apporteur";

/**
 * Les candidats apporteurs qui attendent une reponse — la tuile « Aujourd'hui ».
 *
 * 🔑 UNE TUILE, PAS UNE ALERTE, et c'est la mesure qui tranche : le 19/09, 15
 * personnes attendaient, la plus ancienne depuis 26 JOURS (R7). Un seuil de
 * quelques heures aurait sonne en permanence des le premier jour — et une
 * alerte qui sonne toujours ne dit plus rien. Le chiffre, lui, se lit d'un coup
 * d'oeil et ne demande rien.
 */
export interface ApporteursEnAttente {
  /** Des PERSONNES, jamais des formulaires : la meme personne en occupe souvent trois. */
  personnes: number;
  /** Depuis combien de jours attend la plus ancienne. `null` si personne n'attend. */
  plusAncienJours: number | null;
}

/**
 * Candidats apporteurs sans reponse, comptes PAR PERSONNE.
 *
 * ⚠️ `replyCount === 0` et non `needsAttention` : c'est le critere de la LISTE,
 * et un chiffre d'accueil qui ne colle pas a l'ecran vers lequel il renvoie
 * apprend a se mefier des deux. Meme arbitrage que les compteurs de la barre
 * laterale (`admin-inbox/counters.ts`).
 *
 * Le regroupement se fait en memoire, comme la liste : `groupBy` sur
 * `contactEmailHash` fondrait toutes les lignes SANS empreinte en une seule
 * personne (5 sur 17 en production).
 *
 * Exportee pour son test : le piege des empreintes absentes ne se voit pas
 * depuis l'assemblage du tableau de bord, qui demande une quarantaine de mocks.
 */
export async function apporteursEnAttente(maintenant: Date): Promise<ApporteursEnAttente> {
  try {
    const lignes = await prisma.submission.findMany({
      where: {
        ...FILTRE_APPORTEUR_PRISMA,
        archivedAt: null,
        deletedAt: null,
        replyCount: 0,
        status: { notIn: ["processed", "archived"] },
      },
      select: { id: true, contactEmailHash: true, submittedAt: true },
      orderBy: { submittedAt: "asc" },
      take: 2000,
    });
    if (lignes.length === 0) return { personnes: 0, plusAncienJours: null };

    const cles = new Set(lignes.map((l) => l.contactEmailHash ?? `id:${l.id}`));
    // `orderBy asc` : la premiere ligne est la plus ancienne demande en attente.
    const depuis = lignes[0]!.submittedAt.getTime();
    const jours = Math.floor((maintenant.getTime() - depuis) / 86_400_000);
    return { personnes: cles.size, plusAncienJours: Math.max(0, jours) };
  } catch {
    // Stub-safe (ADR 0026) et panne : l'accueil s'affiche sans cette tuile
    // plutot que pas du tout.
    return { personnes: 0, plusAncienJours: null };
  }
}
