/**
 * EXPORT ART. 15 — le contact laissé sur la page « Recevoir le guide » (lot S2, 2026-11-08).
 *
 * Appelé par `src/app/api/gdpr-export/route.ts`. Rend à une personne, par son adresse, ce que la
 * table `contacts_guide_reseau` détient SUR ELLE : son prénom (déchiffré), le mot et le réseau
 * d'où elle est venue, la version et l'empreinte du texte de la case qu'elle a cochée, la date de
 * son accord, l'état du remerciement.
 *
 * Ce qui n'est PAS rendu, et pourquoi : l'empreinte du jeton du lien (un identifiant technique
 * d'usage unique, sans information sur elle) et la référence de la conversation (une empreinte
 * HMAC à clé serveur de l'identifiant opaque du réseau, qui ne se relit pas).
 *
 * Ne lève pas : une lecture impossible devient un avertissement.
 */
import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";

export interface ContactGuideReseauExporte {
  readonly prenom: string | null;
  readonly mot: string;
  readonly reseau: string;
  readonly postRef: string | null;
  readonly versionTexteCase: string;
  readonly empreinteTexteCase: string;
  readonly consentiLe: Date;
  readonly remerciement: string;
}

export interface ExportGuideReseau {
  readonly contacts: readonly ContactGuideReseauExporte[];
  readonly avertissements: readonly string[];
}

export async function exporterGuideReseauPour(email: string): Promise<ExportGuideReseau> {
  const empreinte = hashEmailForLookup(email);
  if (!empreinte) return { contacts: [], avertissements: [] };
  try {
    const lignes = await prisma.contactGuideReseau.findMany({
      where: { emailKey: empreinte },
      orderBy: { consentiLe: "asc" },
      select: {
        prenom: true,
        mot: true,
        reseau: true,
        postRef: true,
        versionConsentement: true,
        consentEmpreinte: true,
        consentiLe: true,
        merciStatut: true,
      },
    });
    return {
      contacts: lignes.map((l) => ({
        prenom: decryptPii(l.prenom) ?? null,
        mot: l.mot,
        reseau: l.reseau,
        postRef: l.postRef,
        versionTexteCase: l.versionConsentement,
        empreinteTexteCase: l.consentEmpreinte,
        consentiLe: l.consentiLe,
        remerciement: l.merciStatut,
      })),
      avertissements: [],
    };
  } catch {
    return {
      contacts: [],
      avertissements: [
        "guideReseau : lecture impossible au moment de l'export — cette rubrique peut être incomplète. " +
          "Écrivez à contact@axion-ia.com pour une vérification manuelle.",
      ],
    };
  }
}
