/**
 * Candidatures — droits d'accès (art. 15) et d'effacement (art. 17).
 *
 * ## Le défaut que ce module corrige (`D5-5-03`)
 *
 * Une candidature était **hors de portée des deux droits**. Ni l'export ni
 * l'effacement ne la mentionnaient — alors qu'elle porte le **CV**, la **photo**
 * et le **téléphone**, c'est-à-dire les données les plus sensibles que le site
 * détienne sur une personne.
 *
 * 🔴 Et le défaut était plus profond qu'un oubli de branchement : `email` est
 * chiffré par `encryptPii` avec un **IV aléatoire**. Deux chiffrements de la
 * même adresse donnent deux valeurs différentes, donc **une égalité SQL ne peut
 * jamais correspondre**. La candidature n'était pas seulement oubliée : elle
 * était *introuvable*.
 *
 * C'est le même défaut, à la lettre, que celui qui rendait l'export art. 15 des
 * `Submission` vide — corrigé là-bas par `contact_email_hash`. Le remède est le
 * même : une empreinte HMAC déterministe, indexée.
 *
 * ## Le repli, et sa borne
 *
 * Les candidatures antérieures n'ont pas d'empreinte. On les retrouve par un
 * balayage qui déchiffre chaque adresse en mémoire.
 *
 * ⚠️ Ce balayage est **borné** (`PLAFOND_BALAYAGE`). Sans borne, une base qui
 * grossit transformerait chaque demande RGPD en lecture intégrale de la table —
 * et le jour où elle deviendrait trop lente, le droit ne s'exercerait plus. Le
 * plafond est signalé à l'appelant plutôt que silencieux : **une recherche
 * tronquée qui se présente comme complète est pire qu'une recherche refusée.**
 */

import { prisma } from "@/lib/prisma";
import { decryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { deleteCv } from "@/server/careers/cv-storage";

/**
 * Nombre maximal de candidatures déchiffrées lors du repli.
 *
 * Généreux au regard du volume réel (quelques centaines), et fini par principe.
 */
export const PLAFOND_BALAYAGE = 5_000;

export interface CandidatureTrouvee {
  readonly id: string;
  readonly cvStoragePath: string | null;
  readonly photoStoragePath: string | null;
}

/** Normalisation identique à celle de l'empreinte, pour comparer le même objet. */
function normaliser(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Retrouve les candidatures d'une personne.
 *
 * Deux chemins, dans cet ordre :
 *   1. l'empreinte, exacte et indexée, pour tout ce qui a été déposé depuis la
 *      correction ;
 *   2. un balayage déchiffrant borné, pour l'historique sans empreinte.
 *
 * Les deux sont fusionnés : une même candidature ne peut pas être rendue deux
 * fois.
 */
export async function trouverCandidatures(email: string): Promise<{
  readonly candidatures: CandidatureTrouvee[];
  /** `true` si le balayage a mordu son plafond — la liste peut être incomplète. */
  readonly tronque: boolean;
}> {
  const cible = normaliser(email);
  const empreinte = hashEmailForLookup(email);
  const parId = new Map<string, CandidatureTrouvee>();

  if (empreinte !== null) {
    const parEmpreinte = await prisma.jobApplication.findMany({
      where: { emailHash: empreinte },
      select: { id: true, cvStoragePath: true, photoStoragePath: true },
    });
    for (const c of parEmpreinte) parId.set(c.id, c);
  }

  // Repli : l'historique déposé avant l'empreinte. On ne lit QUE les lignes
  // sans empreinte — celles qui en ont une ont déjà été traitées ci-dessus, et
  // les relire doublerait le coût sans rien ajouter.
  const sansEmpreinte = await prisma.jobApplication.findMany({
    where: { emailHash: null },
    select: { id: true, email: true, cvStoragePath: true, photoStoragePath: true },
    take: PLAFOND_BALAYAGE + 1,
  });
  const tronque = sansEmpreinte.length > PLAFOND_BALAYAGE;

  for (const c of sansEmpreinte.slice(0, PLAFOND_BALAYAGE)) {
    // `decryptPii` est tolérant : une valeur non chiffrée est rendue telle
    // quelle. Les dépôts antérieurs au chiffrement passent donc aussi.
    if (normaliser(decryptPii(c.email)) !== cible) continue;
    parId.set(c.id, {
      id: c.id,
      cvStoragePath: c.cvStoragePath,
      photoStoragePath: c.photoStoragePath,
    });
  }

  return { candidatures: [...parId.values()], tronque };
}

/**
 * Efface les candidatures d'une personne — FICHIERS COMPRIS.
 *
 * ⚠️ Les fichiers d'abord, la ligne ensuite. Dans l'autre ordre, un échec de
 * suppression de la ligne laisserait des CV orphelins sur le disque, sans plus
 * aucune trace pour les retrouver : la donnée la plus sensible survivrait à
 * l'effacement, définitivement introuvable.
 *
 * Suppression DURE, pas anonymisation : contrairement à une `Submission` — dont
 * l'anonymisation préserve un audit métier légitime — une candidature non
 * retenue n'a aucune raison de conservation opposable au droit d'effacement.
 */
export async function effacerCandidaturesPour(email: string): Promise<{
  readonly supprimees: number;
  readonly fichiersSupprimes: number;
  readonly tronque: boolean;
}> {
  const { candidatures, tronque } = await trouverCandidatures(email);
  let fichiersSupprimes = 0;
  let supprimees = 0;

  for (const c of candidatures) {
    for (const chemin of [c.cvStoragePath, c.photoStoragePath]) {
      if (chemin === null) continue;
      try {
        await deleteCv(chemin);
        fichiersSupprimes += 1;
      } catch {
        // Fichier déjà absent, ou disque indisponible. On continue : ne pas
        // supprimer la ligne parce qu'un fichier manque laisserait la
        // candidature en base, c'est-à-dire l'inverse du droit exercé.
      }
    }
    await prisma.jobApplication.delete({ where: { id: c.id } });
    supprimees += 1;
  }

  return { supprimees, fichiersSupprimes, tronque };
}

/**
 * Rend les candidatures d'une personne, en CLAIR, pour l'export art. 15.
 *
 * 🔴 L'export les omettait entièrement — même cause que l'effacement : la
 * candidature était introuvable par son adresse.
 *
 * ⚠️ Les champs chiffrés sont DÉCHIFFRÉS ici. Un export art. 15 doit être
 * « compréhensible » (art. 12.1) : rendre `enc:v1:…` à la place d'un nom n'est
 * pas une communication, c'est un refus déguisé — le défaut corrigé au même
 * moment sur les demandes de contact.
 *
 * ⚠️ Les CHEMINS de fichiers ne sortent PAS. Ils ne renseignent la personne sur
 * rien — elle sait qu'elle a joint un CV — et exposer l'arborescence du serveur
 * dans un document qu'on remet à un tiers serait gratuit. On rend le NOM
 * d'origine du fichier, qui est ce qu'elle reconnaîtra.
 */
export async function exporterCandidaturesPour(email: string): Promise<{
  readonly candidatures: ReadonlyArray<Record<string, unknown>>;
  readonly tronque: boolean;
}> {
  const { candidatures: trouvees, tronque } = await trouverCandidatures(email);
  if (trouvees.length === 0) return { candidatures: [], tronque };

  const lignes = await prisma.jobApplication.findMany({
    where: { id: { in: trouvees.map((c) => c.id) } },
    select: {
      id: true,
      offerTitleSnap: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      currentRole: true,
      experienceBand: true,
      linkedinUrl: true,
      hasDriverLicense: true,
      hasVehicle: true,
      cvOriginalName: true,
      photoOriginalName: true,
      submittedAt: true,
      salaryExpectation: true,
      consentVersion: true,
      locale: true,
    },
  });

  return {
    candidatures: lignes.map((l) => ({
      ...l,
      firstName: decryptPii(l.firstName),
      lastName: decryptPii(l.lastName),
      email: decryptPii(l.email),
      phone: decryptPii(l.phone),
    })),
    tronque,
  };
}
