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
// RETOURS d'une personne DÉJÀ CONNUE (2026-10-10, R3 — audit du tunnel pub)
// ───────────────────────────────────────────────────────────────────────────
//
// Une personne qui a déjà une fiche apporteur qui n'est PAS un lead vidéo
// (ancien formulaire, Indeed, saisie manuelle, fiche archivée…) et qui revient
// par la publicité passait les deux étapes sans que RIEN ne soit gardé : ni
// l'annonce, ni le téléphone. On garde désormais une TRACE BORNÉE sur sa fiche,
// `details.retoursVsl` — et rien d'autre : ni étape, ni statut, ni nom, ni
// archivage, ni téléphone principal (une personne qui tape l'adresse d'autrui
// ne peut qu'AJOUTER une trace, jamais lire ni écraser).

/** Au plus dix retours gardés, les plus récents. */
export const RETOURS_VSL_MAX = 10;

export interface RetourVsl {
  /** Heure de l'étape 1 (ISO) — c'est aussi l'émission du jeton, qui la retrouve. */
  le: string;
  etape: 1 | 2;
  utm?: { source?: string; medium?: string; campaign?: string; content?: string };
  /** Réponse à la bannière publicitaire à l'étape 1 ; `null` si inconnue. */
  consentPub: boolean | null;
  /** Étape 2 : heure, réponse « dirigeants connus », téléphone CHIFFRÉ. */
  e2?: string;
  dirigeants?: string;
  telephoneChiffre?: string | null;
}

/** Lit défensivement `details.retoursVsl` (tableau, sinon vide). */
export function lireRetoursVsl(details: unknown): RetourVsl[] {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  const r = (details as Record<string, unknown>)["retoursVsl"];
  if (!Array.isArray(r)) return [];
  return r.filter(
    (e): e is RetourVsl => !!e && typeof e === "object" && typeof (e as RetourVsl).le === "string",
  );
}

/** Garde les `RETOURS_VSL_MAX` derniers, dans l'ordre d'arrivée. */
export function bornerRetours(retours: readonly RetourVsl[]): RetourVsl[] {
  return retours.slice(-RETOURS_VSL_MAX);
}

export type IssueRetour = "ecrit" | "deja" | "introuvable";

/**
 * Écrit `details.retoursVsl` d'une fiche qui n'est PAS un lead vidéo, sous verrou
 * de ligne : relit le tableau, applique `modifier`, réécrit CE tableau seul
 * (`jsonb_set`). `updated_at` n'est pas touché : la fiche n'a pas « bougé ».
 */
async function ecrireRetours(
  id: string,
  modifier: (retours: RetourVsl[]) => RetourVsl[] | "deja",
): Promise<IssueRetour> {
  return prisma.$transaction(async (tx) => {
    const lignes = await tx.$queryRaw<Array<{ retours: unknown }>>`
      SELECT details -> 'retoursVsl' AS retours
      FROM submissions
      WHERE id = ${id}::uuid AND deleted_at IS NULL AND NOT (COALESCE(details, '{}'::jsonb) ? 'vsl')
      FOR UPDATE
    `;
    const ligne = lignes[0];
    if (!ligne) return "introuvable" as const;
    const suivant = modifier(lireRetoursVsl({ retoursVsl: ligne.retours }));
    if (suivant === "deja") return "deja" as const;
    const json = JSON.stringify(bornerRetours(suivant));
    await tx.$executeRaw`
      UPDATE submissions
      SET details = jsonb_set(COALESCE(details, '{}'::jsonb), '{retoursVsl}', ${json}::jsonb, true)
      WHERE id = ${id}::uuid
    `;
    return "ecrit" as const;
  });
}

/** Étape 1 d'une personne déjà connue : ajoute un retour (borné à dix). */
export async function ajouterRetourVsl(id: string, retour: RetourVsl): Promise<IssueRetour> {
  return ecrireRetours(id, (r) => [...r, retour]);
}

export interface CompleterRetour {
  readonly id: string;
  /** Heure de l'étape 1 (ISO), lue dans le jeton : désigne le retour à compléter. */
  readonly le: string;
  readonly maintenant: Date;
  readonly dirigeants: string;
  readonly telephoneChiffre: string | null;
}

/**
 * Étape 2 d'une personne déjà connue : complète le retour de SON étape 1 (ou en
 * ajoute un, si la trace de l'étape 1 manque). « deja » si ce retour a déjà son
 * étape 2 (double clic) : aucun second message.
 */
export async function completerRetourVsl(c: CompleterRetour): Promise<IssueRetour> {
  return ecrireRetours(c.id, (retours) => {
    const i = retours.findIndex((r) => r.le === c.le);
    const base: RetourVsl =
      i >= 0 ? (retours[i] as RetourVsl) : { le: c.le, etape: 1, consentPub: null };
    if (base.etape === 2) return "deja";
    const complet: RetourVsl = {
      ...base,
      etape: 2,
      e2: c.maintenant.toISOString(),
      dirigeants: c.dirigeants,
      telephoneChiffre: c.telephoneChiffre,
    };
    return i >= 0 ? retours.map((r, j) => (j === i ? complet : r)) : [...retours, complet];
  });
}
