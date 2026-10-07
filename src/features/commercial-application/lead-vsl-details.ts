// Écriture CIBLÉE du bloc `details.vsl` d'une ligne `Submission` (2026-10-05).
//
// ── Pourquoi ce module existe ─────────────────────────────────────────────
// `invitation-auto.ts` fait « lire `details`, le recopier, le réécrire en entier »
// (risque n°9 de l'architecture) : deux écritures simultanées — l'étape 2 du
// visiteur et le passage du worker — peuvent s'écraser, et le champ perdu ne se
// voit pas. Pour `details.vsl`, on écrit donc CE BLOC-LÀ et rien d'autre :
//   · `majVslCible`        : une seule instruction SQL, qui fusionne le bloc
//                            (`jsonb_set` + `||`) sans jamais relire `details` ;
//   · `avancerVslEtape2`   : une transaction qui VERROUILLE la ligne, relit le
//                            bloc, décide, puis écrit le téléphone et le bloc.
//                            Deux validations simultanées de l'étape 2 : une
//                            seule passe (« avance »), l'autre apprend « deja »
//                            et n'envoie donc aucun second message.
//
// Les autres clés de `details` (funnel, candidature, invitationAuto…) ne sont
// JAMAIS lues ni réécrites ici.
//
// Aucun `server-only` : ce module est aussi appelé depuis des tests.

import { prisma } from "@/lib/prisma";
import { VSL_QUESTION } from "@/lib/commercial-application/vsl-apporteur";

export interface VslDetails {
  version?: string;
  etapeAtteinte?: 1 | 2;
  atteinte?: { e1?: string; e2?: string };
  question?: { id: string; reponse: string };
  jetonVuLe?: string;
  suspect?: true;
}

/** Lit défensivement le bloc `details.vsl`. `null` si la ligne n'est pas un lead VSL. */
export function lireVsl(details: unknown): VslDetails | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const v = (details as Record<string, unknown>)["vsl"];
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as VslDetails;
}

/** L'étape atteinte par un lead VSL (1 par défaut : un bloc sans marqueur n'a que l'étape 1). */
export function etapeVsl(details: unknown): 1 | 2 | null {
  const v = lireVsl(details);
  if (!v) return null;
  return v.etapeAtteinte === 2 ? 2 : 1;
}

/**
 * Fusionne `patch` dans `details.vsl` — une seule instruction, aucune relecture
 * de `details`. Les clés absentes du patch sont conservées. Lève si la base
 * échoue : l'appelant décide (best-effort ou non).
 */
export async function majVslCible(id: string, patch: Record<string, unknown>): Promise<void> {
  const json = JSON.stringify(patch);
  await prisma.$executeRaw`
    UPDATE submissions
    SET details = jsonb_set(
          COALESCE(details, '{}'::jsonb),
          '{vsl}',
          COALESCE(details -> 'vsl', '{}'::jsonb) || ${json}::jsonb,
          true
        ),
        updated_at = now()
    WHERE id = ${id}::uuid AND deleted_at IS NULL
  `;
}

/**
 * Met à jour le message affiché sur la fiche (`details.message`) d'un lead
 * VIDÉO uniquement — une seule instruction, aucune relecture. Sans bloc `vsl`,
 * la ligne n'est pas touchée (jamais l'ancien formulaire ni un dossier).
 */
export async function majMessageVsl(id: string, message: string): Promise<void> {
  const json = JSON.stringify(message);
  await prisma.$executeRaw`
    UPDATE submissions
    SET details = jsonb_set(details, '{message}', ${json}::jsonb, true),
        updated_at = now()
    WHERE id = ${id}::uuid AND deleted_at IS NULL AND details ? 'vsl'
  `;
}

export interface AvancerEtape2 {
  readonly id: string;
  /** Téléphone DÉJÀ chiffré (`encryptPii`). */
  readonly telephoneChiffre: string | null;
  readonly reponseId: string;
  readonly suspect: boolean;
  readonly maintenant: Date;
  /** Nouveau texte de `details.message` (la console l'affiche) ; sinon inchangé. */
  readonly message?: string;
}

export type IssueAvancement = "avance" | "deja" | "introuvable";

/**
 * Fait passer un lead VSL à l'étape 2, une seule fois, de façon atomique.
 *
 * Ne remplace JAMAIS un téléphone déjà enregistré : le premier qui complète
 * l'étape 2 fixe le numéro (une personne qui rouvre le lien d'un autre ne peut
 * pas l'écraser).
 */
export async function avancerVslEtape2(a: AvancerEtape2): Promise<IssueAvancement> {
  return prisma.$transaction(async (tx) => {
    const lignes = await tx.$queryRaw<Array<{ vsl: unknown }>>`
      SELECT details -> 'vsl' AS vsl
      FROM submissions
      WHERE id = ${a.id}::uuid AND deleted_at IS NULL
      FOR UPDATE
    `;
    const ligne = lignes[0];
    if (!ligne) return "introuvable" as const;
    const courant = (
      ligne.vsl && typeof ligne.vsl === "object" && !Array.isArray(ligne.vsl) ? ligne.vsl : {}
    ) as VslDetails;
    // Étape la plus avancée gagne : jamais de rétrogradation, jamais de rejeu.
    if (courant.etapeAtteinte === 2) return "deja" as const;

    const patch: VslDetails = {
      etapeAtteinte: 2,
      atteinte: { ...(courant.atteinte ?? {}), e2: a.maintenant.toISOString() },
      question: { id: VSL_QUESTION.id, reponse: a.reponseId },
      ...(a.suspect ? { suspect: true as const } : {}),
    };
    const json = JSON.stringify(patch);
    const message = JSON.stringify(a.message ?? null);
    await tx.$executeRaw`
      UPDATE submissions
      SET details = CASE
            WHEN ${message}::jsonb = 'null'::jsonb THEN jsonb_set(
              COALESCE(details, '{}'::jsonb),
              '{vsl}',
              COALESCE(details -> 'vsl', '{}'::jsonb) || ${json}::jsonb,
              true
            )
            ELSE jsonb_set(
              jsonb_set(
                COALESCE(details, '{}'::jsonb),
                '{vsl}',
                COALESCE(details -> 'vsl', '{}'::jsonb) || ${json}::jsonb,
                true
              ),
              '{message}',
              ${message}::jsonb,
              true
            )
          END,
          contact_phone = COALESCE(contact_phone, ${a.telephoneChiffre}),
          updated_at = now()
      WHERE id = ${a.id}::uuid
    `;
    return "avance" as const;
  });
}
