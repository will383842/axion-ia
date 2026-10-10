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

// ───────────────────────────────────────────────────────────────────────────
// RETOURS d'une personne DÉJÀ CONNUE (2026-10-10)
// ───────────────────────────────────────────────────────────────────────────
//
// Une adresse qui a déjà une ligne apporteur qui n'est pas un lead vidéo (ancien
// formulaire, Indeed, saisie manuelle, fiche archivée…) et qui revient par la
// publicité : on ne crée rien et on ne rétrograde rien (R3), mais on GARDE la
// trace du retour sur la fiche existante — sans elle, Will n'en savait rien et le
// téléphone de l'étape 2 était perdu.
//
// 🔒 La trace est la SEULE écriture : ni étape, ni statut, ni nom, ni archivage,
// ni téléphone principal, ni `updated_at` (la fiche ne remonte pas dans les
// listes). Bornée à `MAX_RETOURS_VSL` entrées, les plus récentes : quelqu'un qui
// tape l'adresse d'autrui ne peut qu'ajouter une ligne courte, jamais lire ni
// écraser quoi que ce soit.

/** Nombre maximal d'entrées gardées dans `details.retoursVsl`. */
export const MAX_RETOURS_VSL = 10;

export interface RetourVsl {
  /** Heure de l'étape 1 (ISO) — c'est aussi l'`iat` du jeton : elle désigne l'entrée. */
  le: string;
  etape: 1 | 2;
  utm?: { source?: string; medium?: string; campaign?: string; content?: string };
  consentPub?: boolean;
  /** Étape 2 : heure, réponse « dirigeants connus », téléphone CHIFFRÉ. */
  e2?: string;
  reponse?: string;
  telephone?: string | null;
  suspect?: true;
}

/** Lit défensivement `details.retoursVsl` (tableau vide sinon). */
export function lireRetoursVsl(details: unknown): RetourVsl[] {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  const v = (details as Record<string, unknown>)["retoursVsl"];
  if (!Array.isArray(v)) return [];
  return v.filter(
    (e): e is RetourVsl =>
      !!e && typeof e === "object" && !Array.isArray(e) && typeof (e as RetourVsl).le === "string",
  );
}

/**
 * Ajoute une entrée à `details.retoursVsl` et ne garde que les
 * `MAX_RETOURS_VSL` plus récentes — UNE instruction, aucune relecture de
 * `details`, aucune autre clé touchée. Lève si la base échoue.
 */
export async function ajouterRetourVsl(id: string, entree: RetourVsl): Promise<void> {
  const json = JSON.stringify(entree);
  await prisma.$executeRaw`
    UPDATE submissions
    SET details = jsonb_set(
          COALESCE(details, '{}'::jsonb),
          '{retoursVsl}',
          (
            SELECT COALESCE(jsonb_agg(t.e ORDER BY t.n), '[]'::jsonb)
            FROM (
              SELECT e, n
              FROM jsonb_array_elements(
                CASE WHEN jsonb_typeof(details -> 'retoursVsl') = 'array'
                     THEN details -> 'retoursVsl' ELSE '[]'::jsonb END
                || jsonb_build_array(${json}::jsonb)
              ) WITH ORDINALITY AS a(e, n)
              ORDER BY n DESC
              LIMIT ${MAX_RETOURS_VSL}
            ) t
          ),
          true
        )
    WHERE id = ${id}::uuid AND deleted_at IS NULL
  `;
}

export type IssueRetour = "complete" | "deja" | "introuvable";

export interface CompleterRetour {
  readonly id: string;
  /** L'heure de l'étape 1 portée par le jeton : elle désigne l'entrée à compléter. */
  readonly le: string;
  /** Téléphone DÉJÀ chiffré (`encryptPii`). */
  readonly telephoneChiffre: string | null;
  readonly reponseId: string;
  readonly suspect: boolean;
  readonly maintenant: Date;
}

/**
 * Complète l'entrée `retoursVsl` de l'étape 1 (celle dont `le` est l'heure du
 * jeton) avec l'étape 2 — une seule fois, de façon atomique (ligne verrouillée),
 * comme `avancerVslEtape2`. Ne touche JAMAIS au téléphone principal de la fiche.
 */
export async function completerRetourVsl(a: CompleterRetour): Promise<IssueRetour> {
  return prisma.$transaction(async (tx) => {
    const lignes = await tx.$queryRaw<Array<{ retours: unknown }>>`
      SELECT details -> 'retoursVsl' AS retours
      FROM submissions
      WHERE id = ${a.id}::uuid AND deleted_at IS NULL
      FOR UPDATE
    `;
    const ligne = lignes[0];
    if (!ligne || !Array.isArray(ligne.retours)) return "introuvable" as const;
    const idx = (ligne.retours as unknown[]).findIndex(
      (e) => !!e && typeof e === "object" && (e as RetourVsl).le === a.le,
    );
    if (idx < 0) return "introuvable" as const;
    if ((ligne.retours[idx] as RetourVsl).etape === 2) return "deja" as const;
    const patch: Partial<RetourVsl> = {
      etape: 2,
      e2: a.maintenant.toISOString(),
      reponse: a.reponseId,
      telephone: a.telephoneChiffre,
      ...(a.suspect ? { suspect: true as const } : {}),
    };
    const json = JSON.stringify(patch);
    const chemin = ["retoursVsl", String(idx)];
    await tx.$executeRaw`
      UPDATE submissions
      SET details = jsonb_set(
            details,
            ${chemin}::text[],
            (details -> 'retoursVsl' -> ${idx}::int) || ${json}::jsonb,
            false
          )
      WHERE id = ${a.id}::uuid
    `;
    return "complete" as const;
  });
}
