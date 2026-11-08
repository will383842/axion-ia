"use server";

/**
 * Numérotation, mise à jour et envoi d'un devis depuis l'assistant (chantier assistant, fiche S08).
 *
 * L'assistant ne crée JAMAIS une ligne `devis` lui-même : il appelle les portes existantes
 * (`createDevisAction`, `creerDevisFormulesAction`, `modifierDevisClassiqueBrouillonAction`,
 * `modifierDevisBrouillonAction`, `fixerValiditeDevisBrouillonAction`, `sendDevisAction`).
 * Il n'envoie aucun e-mail : l'envoi est `sendDevisAction`, dont l'e-mail passe par la corbeille de
 * relecture (D9). Il n'écrit jamais le statut d'un devis et ne supprime rien.
 *
 * Le numéro AXI-DEV n'est attribué qu'à l'entrée de l'étape 4 (cette action). Le serveur lit la
 * saisie dans le brouillon d'assistant (à la révision attendue) et REJOUE `validerEtape(4)` puis la
 * conversion : il ne croit pas l'écran. Il n'y a donc aucun montant en entrée.
 *
 * Idempotence :
 *   - verrou : `updateMany` conditionnel (id, propriétaire, révision attendue, statut `en_cours` /
 *     `lie_au_devis` / `numerotation` expiré depuis plus de 2 min) → statut `numerotation` ;
 *     le second de deux appels simultanés reçoit « Numérotation déjà en cours » ;
 *   - rejeu d'un appel déjà terminé (même révision attendue, révision actuelle = attendue + 1,
 *     brouillon lié) : renvoie le devis existant, sans aucune écriture ;
 *   - déjà lié : MET À JOUR le devis (jamais un second numéro) ; refus si le client ou le type
 *     (classique ↔ formules) change, ou si le devis n'est plus brouillon ;
 *   - échec de création : le verrou est levé et le statut précédent rétabli.
 *
 * `sauverBrouillonAssistantAction` accepte le statut `numerotation` et incrémente `revision` : une
 * sauvegarde peut donc s'intercaler pendant la création. Le lien final ne dépend pas de la
 * révision (il est conditionné à NOTRE verrou, repéré par sa date) et relit la saisie la plus
 * récente pour y écrire `sync` ; si la saisie a changé depuis celle qui a été numérotée,
 * `aRenumeroter` vaut `true` (le devis porte l'ancienne version) et l'envoi est refusé.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { createDevisAction, sendDevisAction } from "@/server/actions/qualiopi/devis";
import {
  creerDevisFormulesAction,
  modifierDevisBrouillonAction,
} from "@/server/actions/qualiopi/devis-formules";
import {
  fixerValiditeDevisBrouillonAction,
  modifierDevisClassiqueBrouillonAction,
} from "@/server/actions/qualiopi/devis-classique-modifier";
import { getQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import { projetOuvrableDuClient } from "@/server/qualiopi/crm/devis-projet";
import { formulesActives } from "@/server/qualiopi/devis/interrupteur-formules";
import { TAUX_TVA_STANDARD } from "@/server/qualiopi/legal/tva";
import {
  payloadVersCreation,
  type ContexteConversion,
  type ResultatConversion,
} from "@/server/qualiopi/devis/assistant/conversion";
import { lirePayload, type PayloadAssistantV1 } from "@/server/qualiopi/devis/assistant/payload";
import { validerEtape } from "@/server/qualiopi/devis/assistant/validation-etapes";

type ActionResult<T> = { data: T } | { error: string };

interface Numerotation {
  devisId: string;
  numero: string;
  devisMajLe: string;
  /** Révision du brouillon d'assistant à utiliser pour l'appel suivant. */
  revision: number;
  /** `true` : la saisie a changé pendant la numérotation, le devis porte la version précédente. */
  aRenumeroter?: true;
}
type SortieNumerotation =
  | { data: Numerotation }
  | { error: string }
  | { error: string; conflit: true; revisionActuelle: number };

const INTROUVABLE = "Brouillon introuvable";
const BUILD = "Indisponible pendant le build";
const EN_COURS = "Numérotation déjà en cours";
const MSG_PERIME = "Ce brouillon a été modifié ailleurs (autre onglet) : rechargez la page.";
const MSG_ENVOYE = "Ce devis a été envoyé : ouvrez sa fiche.";
const VERROU_MS = 2 * 60_000;

const enBuild = () => process.env["DATABASE_URL"]?.includes("stub.invalid") === true;

const entreeSchema = z.object({
  brouillonId: z.string().uuid(),
  attenduRevision: z.number().int().min(0),
});

type Interne =
  | { rejoue?: true; data: Numerotation }
  | { error: string; conflit?: true; revisionActuelle?: number };

/** Le brouillon d'assistant est-il, à cette révision, déjà numéroté par un appel identique ? */
async function rejeuOuConflit(
  id: string,
  adminId: string,
  attendu: number,
): Promise<Interne | null> {
  const row = await prisma.devisAssistantBrouillon.findFirst({
    where: { id, createdByAdminId: adminId },
    select: { statut: true, revision: true, devisId: true, verrouDepuis: true },
  });
  if (!row) return { error: INTROUVABLE };
  if (row.statut === "a_l_ecart") return { error: "Ce brouillon a été mis à l'écart." };
  if (row.statut === "numerotation") return { error: EN_COURS };
  if (row.statut === "lie_au_devis" && row.devisId && row.revision === attendu + 1) {
    const devis = await prisma.devis.findUnique({
      where: { id: row.devisId },
      select: { numero: true, updatedAt: true },
    });
    if (devis) {
      return {
        rejoue: true,
        data: {
          devisId: row.devisId,
          numero: devis.numero,
          devisMajLe: devis.updatedAt.toISOString(),
          revision: row.revision,
        },
      };
    }
  }
  return { error: MSG_PERIME, conflit: true, revisionActuelle: row.revision };
}

/** Lève NOTRE verrou (repéré par sa date) et rétablit le statut d'avant. */
async function relacher(
  id: string,
  adminId: string,
  verrou: Date,
  statutAvant: "en_cours" | "lie_au_devis",
): Promise<void> {
  await prisma.devisAssistantBrouillon.updateMany({
    where: { id, createdByAdminId: adminId, statut: "numerotation", verrouDepuis: verrou },
    data: { statut: statutAvant, verrouDepuis: null },
  });
}

/**
 * Pose le lien et `sync` sous NOTRE verrou. Relit la saisie courante : une sauvegarde intercalée
 * n'est jamais écrasée (elle est conservée, `sync` est réécrit dessus).
 */
async function lier(
  id: string,
  adminId: string,
  verrou: Date,
  devisId: string,
  devisMajLe: string,
  numerotee: PayloadAssistantV1,
  attendu: number,
): Promise<{ revision: number; aRenumeroter: boolean } | null> {
  for (let essai = 0; essai < 3; essai++) {
    const cur = await prisma.devisAssistantBrouillon.findFirst({
      where: { id, createdByAdminId: adminId, statut: "numerotation", verrouDepuis: verrou },
      select: { revision: true, payload: true },
    });
    if (!cur) return null;
    const lu = lirePayload(cur.payload);
    const base = lu.ok ? lu.payload : numerotee;
    const { count } = await prisma.devisAssistantBrouillon.updateMany({
      where: {
        id,
        createdByAdminId: adminId,
        statut: "numerotation",
        verrouDepuis: verrou,
        revision: cur.revision,
      },
      data: {
        payload: { ...base, sync: { devisId, devisMajLe } } as never,
        devisId,
        statut: "lie_au_devis",
        verrouDepuis: null,
        revision: { increment: 1 },
      },
    });
    if (count === 1) return { revision: cur.revision + 1, aRenumeroter: cur.revision !== attendu };
  }
  // Dernier recours (3 sauvegardes intercalées) : le devis EXISTE, il ne doit jamais rester sans
  // lien (le verrou expiré en créerait un second). Le contrôle `verrouDepuis` garantit que le
  // verrou est le nôtre : on pose `devisId` sans condition de révision. Le `payload` n'est pas
  // réécrit en entier (il écraserait la sauvegarde la plus récente) : seul `sync` est écrit, en
  // UNE instruction atomique (`jsonb_set`), sous la même condition statut + verrou. Sans lui,
  // `sync.devisMajLe` resterait nul et chaque rappel ferait MSG_PERIME (brouillon inutilisable).
  const syncJson = JSON.stringify({ devisId, devisMajLe });
  const count = await prisma.$executeRaw`
    UPDATE "devis_assistant_brouillons"
    SET "payload" = jsonb_set("payload", '{sync}', ${syncJson}::jsonb, true),
        "devis_id" = ${devisId}::uuid,
        "statut" = 'lie_au_devis',
        "verrou_depuis" = NULL,
        "revision" = "revision" + 1,
        "updated_at" = CURRENT_TIMESTAMP
    WHERE "id" = ${id}::uuid
      AND "created_by_admin_id" = ${adminId}::uuid
      AND "statut" = 'numerotation'
      AND "verrou_depuis" = ${verrou}`;
  if (count !== 1) return null;
  const apres = await prisma.devisAssistantBrouillon.findFirst({
    where: { id, createdByAdminId: adminId },
    select: { revision: true },
  });
  return { revision: apres?.revision ?? attendu + 1, aRenumeroter: true };
}

async function numeroter(i: unknown): Promise<Interne> {
  if (enBuild()) return { error: BUILD };
  const session = await requireAdminWrite();
  const adminId = session.userId;
  const e = entreeSchema.safeParse(i);
  if (!e.success) return { error: "Données invalides" };
  const { brouillonId: id, attenduRevision: attendu } = e.data;

  const row = await prisma.devisAssistantBrouillon.findFirst({
    where: { id, createdByAdminId: adminId },
    select: { id: true, devisId: true, statut: true, revision: true, payload: true },
  });
  if (!row) return { error: INTROUVABLE };
  if (row.statut === "a_l_ecart") return { error: "Ce brouillon a été mis à l'écart." };
  if (row.revision !== attendu) {
    return (await rejeuOuConflit(id, adminId, attendu)) ?? { error: MSG_PERIME };
  }
  const lu = lirePayload(row.payload);
  if (!lu.ok) return { error: lu.error };
  const payload = lu.payload;

  // ── Devis déjà lié : il doit être encore un brouillon, du même client et du même type. ──
  let devisLie: {
    id: string;
    numero: string;
    statut: string;
    clientId: string;
    offreSha256: string | null;
    offre: unknown;
    updatedAt: Date;
  } | null = null;
  if (row.devisId) {
    devisLie = await prisma.devis.findUnique({
      where: { id: row.devisId },
      select: {
        id: true,
        numero: true,
        statut: true,
        clientId: true,
        offreSha256: true,
        offre: true,
        updatedAt: true,
      },
    });
    if (!devisLie) return { error: "Le devis lié est introuvable : ouvrez la liste des devis." };
    if (devisLie.statut !== "brouillon") return { error: MSG_ENVOYE };
    if (payload.clientId !== devisLie.clientId) {
      return { error: "Le client d'un devis ne se change pas : créez un nouveau devis." };
    }
    const aFormules = devisLie.offreSha256 !== null;
    if ((payload.typeDevis === "formules") !== aFormules) {
      return {
        error:
          "Le type du devis (classique ou à formules) ne se change pas après sa numérotation : créez un nouveau devis.",
      };
    }
  }

  // ── Contexte relu en base, jamais cru. ──
  let typeClient: "entreprise" | "particulier" | null = null;
  if (payload.clientId) {
    const client = await prisma.client.findUnique({
      where: { id: payload.clientId },
      select: { type: true },
    });
    if (!client) return { error: "Client introuvable : sélectionnez un client existant." };
    typeClient = client.type === "particulier" ? "particulier" : "entreprise";
  }
  const heritees =
    devisLie?.offre && typeof devisLie.offre === "object"
      ? (devisLie.offre as { automatisations?: unknown }).automatisations
      : undefined;
  const ctx: ContexteConversion = {
    formulesActives: await formulesActives(),
    typeClient,
    maintenant: new Date(),
    tauxStandard: Number(await getQualiopiConfig("taux_tva_standard_percent")) || TAUX_TVA_STANDARD,
    ...(Array.isArray(heritees) ? { automatisationsHeritees: heritees } : {}),
    clientIdDuProjet:
      payload.projetId && payload.clientId
        ? (await projetOuvrableDuClient(prisma, payload.projetId, payload.clientId))
          ? payload.clientId
          : null
        : null,
  };

  // ── Rejeu des validations (étape 4 inclut 1 à 3) puis de la conversion. ──
  const v = validerEtape(payload, 4, ctx);
  if (!v.ok)
    return {
      error: v.erreurs
        .slice(0, 3)
        .map((x) => x.message)
        .join(" "),
    };
  const conv: ResultatConversion = payloadVersCreation(payload, ctx);
  if ("erreurs" in conv) {
    return {
      error: conv.erreurs
        .slice(0, 3)
        .map((x) => x.message)
        .join(" "),
    };
  }

  // ── Verrou. ──
  const verrou = new Date();
  const { count } = await prisma.devisAssistantBrouillon.updateMany({
    where: {
      id,
      createdByAdminId: adminId,
      revision: attendu,
      OR: [
        { statut: "en_cours" },
        { statut: "lie_au_devis" },
        { statut: "numerotation", verrouDepuis: { lt: new Date(verrou.getTime() - VERROU_MS) } },
      ],
    },
    data: { statut: "numerotation", verrouDepuis: verrou },
  });
  if (count === 0) {
    return (await rejeuOuConflit(id, adminId, attendu)) ?? { error: EN_COURS };
  }
  const statutAvant: "en_cours" | "lie_au_devis" = row.devisId ? "lie_au_devis" : "en_cours";

  // `devisId` non nul = le devis EXISTE : plus aucun chemin ne relâche le brouillon vers
  // `en_cours` (un 2e appel créerait un 2e numéro) ; on lie toujours.
  let devisId: string | null = null;
  let numero = "";
  let majLe: string | null = null;
  let erreurValidite: string | null = null;
  try {
    if (devisLie) {
      // ── Mise à jour : jamais un second numéro. ──
      const attenduMajLe = payload.sync.devisMajLe;
      if (!attenduMajLe) {
        await relacher(id, adminId, verrou, statutAvant);
        return { error: MSG_PERIME };
      }
      let maj: { error: string } | { data: { majLe?: string } | { id: string } };
      if (conv.type === "classique") {
        maj = await modifierDevisClassiqueBrouillonAction({
          id: devisLie.id,
          attenduMajLe,
          input: conv.input as never,
        });
      } else {
        maj = await modifierDevisBrouillonAction({
          id: devisLie.id,
          attenduMajLe,
          offre: conv.input.offre,
          refClient: conv.input.refClient ?? null,
        });
      }
      if ("error" in maj) {
        await relacher(id, adminId, verrou, statutAvant);
        return { error: maj.error };
      }
      devisId = devisLie.id;
      numero = devisLie.numero;
      majLe = ("majLe" in maj.data ? maj.data.majLe : undefined) ?? null;
      majLe = majLe ?? (await lireMajLe(devisId)) ?? new Date().toISOString();
    } else {
      // ── Première fois : la porte existante attribue le numéro. ──
      const cree =
        conv.type === "classique"
          ? await createDevisAction(conv.input as never)
          : await creerDevisFormulesAction(conv.input as never);
      if ("error" in cree) {
        await relacher(id, adminId, verrou, statutAvant);
        return { error: cree.error };
      }
      devisId = cree.data.id;
      numero = cree.data.numero;
      majLe = (await lireMajLe(devisId)) ?? new Date().toISOString();
    }

    // ── Validité (S10) : la date choisie ; sinon le défaut du moteur reste en place. ──
    if (payload.dateValidite) {
      const val = await fixerValiditeDevisBrouillonAction({
        id: devisId,
        attenduMajLe: majLe ?? new Date().toISOString(),
        dateValidite: payload.dateValidite,
      });
      if ("error" in val) erreurValidite = val.error;
      else majLe = val.data.majLe;
    }
  } catch (err) {
    console.error("[devis-assistant] numérotation interrompue", err);
    if (devisId === null) {
      await relacher(id, adminId, verrou, statutAvant);
      return { error: "La numérotation a échoué : réessayez dans un instant." };
    }
    // Le devis existe (création ou mise à jour faite) : on lie, jamais de relâchement.
    const lienApresErreur = await lier(
      id,
      adminId,
      verrou,
      devisId,
      majLe ?? payload.sync.devisMajLe ?? new Date().toISOString(),
      payload,
      attendu,
    );
    return {
      error: lienApresErreur
        ? `Le devis ${numero} est numéroté, mais la suite de l'opération a échoué : ouvrez le devis dans la liste. Ne recommencez pas la numérotation.`
        : `Le devis ${numero} a été créé mais son lien avec le brouillon n'a pas pu être posé. Ne recommencez pas : ouvrez la liste des devis.`,
    };
  }
  if (devisId === null || majLe === null) {
    await relacher(id, adminId, verrou, statutAvant);
    return { error: "La numérotation a échoué : réessayez dans un instant." };
  }

  // ── Lien : posé même si la validité a été refusée (jamais de devis orphelin). ──
  const lien = await lier(id, adminId, verrou, devisId, majLe, payload, attendu);
  if (!lien) {
    return {
      error: `Le devis ${numero} a été créé mais son lien avec le brouillon n'a pas pu être posé. Ne recommencez pas : ouvrez la liste des devis.`,
    };
  }

  if (!devisLie && payload.venteBrouillonId) {
    // Propriétaire seulement, jamais écrasé : un autre admin ou un lien existant → 0 ligne.
    try {
      await prisma.venteBrouillon.updateMany({
        where: { id: payload.venteBrouillonId, createdByAdminId: adminId, devisId: null },
        data: { devisId },
      });
    } catch (err) {
      console.error("[devis-assistant] lien vente non posé", err);
    }
  }

  await logQualiopiActivity({
    action: devisLie
      ? "qualiopi.devis_assistant.devis_mis_a_jour"
      : "qualiopi.devis_assistant.devis_numerote",
    targetType: "Devis",
    targetId: devisId,
    changes: { numero, brouillonAssistantId: id },
    session,
  });

  if (erreurValidite) {
    return {
      error: `Le devis ${numero} est numéroté, mais sa date de validité n'a pas pu être posée : ${erreurValidite}`,
    };
  }
  return {
    data: {
      devisId,
      numero,
      devisMajLe: majLe,
      revision: lien.revision,
      ...(lien.aRenumeroter ? { aRenumeroter: true as const } : {}),
    },
  };
}

async function lireMajLe(devisId: string): Promise<string | null> {
  const d = await prisma.devis.findUnique({ where: { id: devisId }, select: { updatedAt: true } });
  return d ? d.updatedAt.toISOString() : null;
}

export async function numeroterDevisAssistantAction(i: {
  brouillonId: string;
  attenduRevision: number;
}): Promise<SortieNumerotation> {
  const r = await numeroter(i);
  if ("data" in r) return { data: r.data };
  return r as SortieNumerotation;
}

/** Synchronise la dernière saisie (`numeroter`) PUIS appelle `sendDevisAction`, inchangé. */
export async function envoyerDepuisAssistantAction(i: {
  brouillonId: string;
  attenduRevision: number;
}): Promise<
  ActionResult<{ devisId: string; emailEnvoye: boolean; signatureCreee: boolean; note?: string }>
> {
  const n = await numeroter(i);
  if (!("data" in n)) return { error: n.error };
  if (n.rejoue) {
    // Doublon d'un appel déjà traité : jamais un second envoi (lien de signature, e-mail).
    return { error: "Envoi déjà demandé : rechargez la page pour voir l'état du devis." };
  }
  if (n.data.aRenumeroter) {
    return {
      error:
        "La saisie a été modifiée pendant la numérotation : le devis porte la version précédente. Relancez l'envoi.",
    };
  }
  const r = await sendDevisAction(n.data.devisId);
  if ("error" in r) return { error: r.error };
  return {
    data: {
      devisId: n.data.devisId,
      emailEnvoye: r.data.emailEnvoye,
      signatureCreee: r.data.signatureCreee,
      ...(r.data.note !== undefined ? { note: r.data.note } : {}),
    },
  };
}
