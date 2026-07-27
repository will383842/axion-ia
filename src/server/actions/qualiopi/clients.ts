/**
 * Qualiopi — Server Actions CRM clients (T2).
 *
 * createClientAction : crée un client prospect avec numérotation AXI-CLI-NNN.
 * updateClientAction : met à jour les champs éditoriaux.
 * Guards RBAC write + audit ActivityLog.
 */

"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { siretField } from "@/lib/siret-schema";
import { premierMessageZod } from "@/lib/zod-message";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { inferOpco } from "@/server/qualiopi/crm/naf-opco";
import { nextNumero } from "@/server/qualiopi/numbering/allocate";
import { withNumberRetry } from "@/server/qualiopi/numbering/retry";

type ActionResult<T> = { data: T } | { error: string };

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod
// ─────────────────────────────────────────────────────────────────────────────

const COMPANY_SIZES = ["TPE", "PME", "ETI", "GRANDE_ENTREPRISE"] as const;
const CLIENT_TYPES = ["entreprise", "particulier"] as const;
const CLIENT_STATUTS = [
  "prospect",
  "devis_envoye",
  "client_actif",
  "client_inactif",
  "perdu",
] as const;

const createClientSchema = z.object({
  /** entreprise (B2B) | particulier (B2C). Défaut entreprise. */
  type: z.enum(CLIENT_TYPES).optional(),
  raisonSociale: z.string().min(1).max(250),
  // Format + clé de Luhn + rejet des valeurs de remplissage. `max(14)` seul
  // acceptait « 00000000000000 », valeur réellement persistée en production, et
  // qui se propage jusqu'au `<ram:ID schemeID="0009">` du Factur-X — donc à une
  // facture non routable par la Plateforme Agréée. Reste FACULTATIF.
  siret: siretField.optional(),
  nafCode: z.string().max(6).optional(),
  conventionCollective: z.string().max(200).optional(),
  /** Code IDCC de la branche (précise la convention collective). */
  idcc: z.string().max(10).optional(),
  secteur: z.string().max(200).optional(),
  taille: z.enum(COMPANY_SIZES).optional(),
  adresse: z.string().optional(),
  contactNom: z.string().max(200).optional(),
  contactEmail: z.string().email().optional(),
  contactTelephone: z.string().max(40).optional(),
  contactFonction: z.string().max(150).optional(),
  /**
   * OPCO saisi manuellement. Si absent, inféré depuis l'IDCC puis le NAF.
   *
   * `.min(1)` est BLOQUANT, pas cosmétique : une option vide de `<select>`
   * soumettrait `""`, qui serait écrit en base, continuerait d'afficher
   * « À déterminer » (chaîne vide falsy) et surtout désactiverait à vie la
   * ré-inférence de `updateClientAction` (sa garde teste `== null`). Un clic
   * suffirait à briquer le mécanisme.
   */
  opcoIdentifie: z.string().min(1).max(60).optional(),
  opcoNumeroAdherent: z.string().max(80).optional(),
  opcoEnveloppeAnnuelleCents: z.number().int().min(0).optional(),
  source: z.string().max(120).optional(),
  contexteIa: z.string().optional(),
  notes: z.string().optional(),
});

const updateClientSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(CLIENT_TYPES).optional(),
  raisonSociale: z.string().min(1).max(250).optional(),
  // Même règle qu'à la création : la mise à jour est une porte d'entrée
  // distincte, elle doit être fermée séparément.
  //
  // `.nullable()` en PLUS ici : la chaîne vide rend `undefined` (= « champ non
  // transmis », donc « ne rien changer »), elle ne peut donc pas effacer. Sans
  // `null`, un SIRET erroné saisi une fois serait DÉFINITIF — et un futur écran
  // d'édition pré-rempli avec une valeur invalide (chantier V18) refuserait
  // toute modification de la fiche, y compris des champs sans rapport.
  siret: siretField.nullable().optional(),
  nafCode: z.string().max(6).optional(),
  conventionCollective: z.string().max(200).optional(),
  /** Code IDCC de la branche (précise la convention collective). */
  idcc: z.string().max(10).optional(),
  secteur: z.string().max(200).optional(),
  taille: z.enum(COMPANY_SIZES).optional(),
  adresse: z.string().optional(),
  contactNom: z.string().max(200).optional(),
  contactEmail: z.string().email().optional(),
  contactTelephone: z.string().max(40).optional(),
  contactFonction: z.string().max(150).optional(),
  /**
   * Voir createClientSchema pour `.min(1)`.
   *
   * `.nullable()` en PLUS ici, et c'est structurant : `null` signifie
   * « remettre en inféré » — on efface la saisie ET on relance le calcul.
   * Sans lui, un OPCO saisi par erreur serait définitif via l'interface (la
   * ré-inférence refuse par construction de toucher une valeur non vide), sur
   * une pièce opposable au financeur et à l'auditeur.
   */
  opcoIdentifie: z.string().min(1).max(60).nullable().optional(),
  opcoNumeroAdherent: z.string().max(80).optional(),
  opcoEnveloppeAnnuelleCents: z.number().int().min(0).optional(),
  statut: z.enum(CLIENT_STATUTS).optional(),
  source: z.string().max(120).optional(),
  contexteIa: z.string().optional(),
  notes: z.string().optional(),
  besoinsIdentifies: z.unknown().optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée un client prospect.
 * - Numéro alloué séquentiellement : AXI-CLI-NNN (borne haute + 1, sans millésime).
 * - opcoIdentifie inféré via inferOpco (IDCC prioritaire, repli NAF) si absent.
 * - Statut initial : prospect.
 */
export async function createClientAction(
  // `z.input` et non `z.infer` : `siretField` porte un `.transform()`, donc le
  // type d'ENTRÉE (ce que l'appelant fournit) diverge du type de SORTIE (ce que
  // Zod rend). Avec `exactOptionalPropertyTypes`, `z.infer` compilerait par
  // coïncidence aujourd'hui et casserait au premier champ transformé suivant.
  input: z.input<typeof createClientSchema>,
): Promise<ActionResult<{ id: string; numero: string }>> {
  const session = await requireAdminWrite();
  const parsed = createClientSchema.safeParse(input);
  // Remonter le message du premier champ fautif : avec « Données invalides » en
  // dur, l'admin ne saurait pas que c'est le SIRET qui est refusé, et la
  // validation serait active mais inexploitable. Surface admin-only.
  if (!parsed.success) return { error: premierMessageZod(parsed.error) };
  const v = parsed.data;

  // Inférer l'OPCO si non fourni manuellement. L'IDCC prime : c'est la
  // convention collective qui rattache légalement à un OPCO.
  const opcoIdentifie = v.opcoIdentifie ?? inferOpco({ idcc: v.idcc, naf: v.nafCode });

  // Allocation numéro séquentiel + insertion, avec retry sur collision (R7)
  const created = await withNumberRetry(async () => {
    // 🔴 V20. `client.count()` portait sur TOUTE la table, sans le moindre
    // filtre de préfixe : une ligne importée hors série, ou un client supprimé,
    // décalait le compteur et faisait réémettre un numéro déjà attribué.
    //
    // ⚠️ `null` en second argument, et ce n'est PAS un oubli : `client` est la
    // SEULE série sans millésime. Deux numéros `AXI-CLI-001` / `AXI-CLI-002`
    // sont déjà émis sous ce format en production. Passer `year` ici ferait lire
    // le préfixe `AXI-CLI-2026-`, qui ne correspond à aucune ligne existante →
    // borne 0 → réémission de `AXI-CLI-001` → collision immédiate sur
    // `clients_numero_key`. `seriesPrefix` connaît l'exception ; ne pas la
    // contourner.
    const numero = await nextNumero("client", null, (prefixe) =>
      prisma.client.findMany({
        where: { numero: { startsWith: prefixe } },
        select: { numero: true },
      }),
    );
    return prisma.client.create({
      data: {
        numero,
        raisonSociale: v.raisonSociale,
        statut: "prospect",
        ...(v.type !== undefined ? { type: v.type } : {}),
        ...(v.siret !== undefined ? { siret: v.siret } : {}),
        ...(v.nafCode !== undefined ? { nafCode: v.nafCode } : {}),
        ...(v.conventionCollective !== undefined
          ? { conventionCollective: v.conventionCollective }
          : {}),
        ...(v.idcc !== undefined ? { idcc: v.idcc } : {}),
        ...(v.secteur !== undefined ? { secteur: v.secteur } : {}),
        ...(v.taille !== undefined ? { taille: v.taille } : {}),
        ...(v.adresse !== undefined ? { adresse: v.adresse } : {}),
        ...(v.contactNom !== undefined ? { contactNom: v.contactNom } : {}),
        ...(v.contactEmail !== undefined ? { contactEmail: v.contactEmail } : {}),
        ...(v.contactTelephone !== undefined ? { contactTelephone: v.contactTelephone } : {}),
        ...(v.contactFonction !== undefined ? { contactFonction: v.contactFonction } : {}),
        ...(opcoIdentifie !== null ? { opcoIdentifie } : {}),
        ...(v.opcoNumeroAdherent !== undefined ? { opcoNumeroAdherent: v.opcoNumeroAdherent } : {}),
        ...(v.opcoEnveloppeAnnuelleCents !== undefined
          ? { opcoEnveloppeAnnuelleCents: v.opcoEnveloppeAnnuelleCents }
          : {}),
        ...(v.source !== undefined ? { source: v.source } : {}),
        ...(v.contexteIa !== undefined ? { contexteIa: v.contexteIa } : {}),
        ...(v.notes !== undefined ? { notes: v.notes } : {}),
      },
      select: { id: true, numero: true },
    });
  });

  await logQualiopiActivity({
    action: "qualiopi.client.create",
    targetType: "Client",
    targetId: created.id,
    changes: { numero: created.numero, raisonSociale: v.raisonSociale, opcoIdentifie },
    session,
  });

  return { data: { id: created.id, numero: created.numero } };
}

/**
 * Met à jour les champs éditoriaux d'un client existant
 * (notes, contexteIa, statut, coordonnées, OPCO, etc.).
 */
export async function updateClientAction(
  // `z.input` : voir createClientAction (transform sur siretField).
  input: z.input<typeof updateClientSchema>,
): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdminWrite();
  const parsed = updateClientSchema.safeParse(input);
  if (!parsed.success) return { error: premierMessageZod(parsed.error) };
  const { id, ...fields } = parsed.data;

  // ── OPCO : trois entrées possibles, UNE seule sortie (`opcoAEcrire`) ───────
  //  • chaîne  → saisie explicite de l'admin, écrite telle quelle
  //  • null    → option « — (inféré) » : on efface la saisie ET on recalcule
  //  • absente → on ne recalcule QUE si le champ est vide en base
  //
  // La ré-inférence sur champ vide est le vrai correctif de F6 : sans elle, un
  // client créé sans NAF restait « À déterminer » à vie, même une fois sa
  // branche saisie — l'inférence ne tournait QU'À LA CRÉATION.
  //
  // 🔴 La garde « seulement si vide » est NON NÉGOCIABLE : sans elle, une
  // correction manuelle d'OPCO serait silencieusement annulée au prochain
  // enregistrement de la branche. Le `trim() === ""` couvre les lignes
  // historiques où une chaîne vide a pu être écrite (le schéma l'autorisait).
  let opcoAEcrire: string | null | undefined;
  if (typeof fields.opcoIdentifie === "string") {
    opcoAEcrire = fields.opcoIdentifie;
  } else if (
    fields.opcoIdentifie === null ||
    fields.nafCode !== undefined ||
    fields.idcc !== undefined
  ) {
    const reinferenceDemandee = fields.opcoIdentifie === null;
    const actuel = await prisma.client.findUnique({
      where: { id },
      select: { nafCode: true, idcc: true, opcoIdentifie: true },
    });
    if (
      actuel !== null &&
      (reinferenceDemandee || actuel.opcoIdentifie == null || actuel.opcoIdentifie.trim() === "")
    ) {
      const infere = inferOpco({
        idcc: fields.idcc ?? actuel.idcc,
        naf: fields.nafCode ?? actuel.nafCode,
      });
      // Sur demande explicite on écrit même `null` (retour à « à déterminer ») ;
      // sinon on n'écrit que si l'inférence a trouvé quelque chose.
      if (reinferenceDemandee || infere !== null) opcoAEcrire = infere;
    }
  }

  await prisma.client.update({
    where: { id },
    data: {
      ...(fields.type !== undefined ? { type: fields.type } : {}),
      ...(fields.raisonSociale !== undefined ? { raisonSociale: fields.raisonSociale } : {}),
      ...(fields.siret !== undefined ? { siret: fields.siret } : {}),
      ...(fields.nafCode !== undefined ? { nafCode: fields.nafCode } : {}),
      ...(fields.conventionCollective !== undefined
        ? { conventionCollective: fields.conventionCollective }
        : {}),
      ...(fields.idcc !== undefined ? { idcc: fields.idcc } : {}),
      ...(fields.secteur !== undefined ? { secteur: fields.secteur } : {}),
      ...(fields.taille !== undefined ? { taille: fields.taille } : {}),
      ...(fields.adresse !== undefined ? { adresse: fields.adresse } : {}),
      ...(fields.contactNom !== undefined ? { contactNom: fields.contactNom } : {}),
      ...(fields.contactEmail !== undefined ? { contactEmail: fields.contactEmail } : {}),
      ...(fields.contactTelephone !== undefined
        ? { contactTelephone: fields.contactTelephone }
        : {}),
      ...(fields.contactFonction !== undefined ? { contactFonction: fields.contactFonction } : {}),
      ...(opcoAEcrire !== undefined ? { opcoIdentifie: opcoAEcrire } : {}),
      ...(fields.opcoNumeroAdherent !== undefined
        ? { opcoNumeroAdherent: fields.opcoNumeroAdherent }
        : {}),
      ...(fields.opcoEnveloppeAnnuelleCents !== undefined
        ? { opcoEnveloppeAnnuelleCents: fields.opcoEnveloppeAnnuelleCents }
        : {}),
      ...(fields.statut !== undefined ? { statut: fields.statut } : {}),
      ...(fields.source !== undefined ? { source: fields.source } : {}),
      ...(fields.contexteIa !== undefined ? { contexteIa: fields.contexteIa } : {}),
      ...(fields.notes !== undefined ? { notes: fields.notes } : {}),
      ...(fields.besoinsIdentifies !== undefined
        ? { besoinsIdentifies: fields.besoinsIdentifies as never }
        : {}),
    },
  });

  await logQualiopiActivity({
    action: "qualiopi.client.update",
    targetType: "Client",
    targetId: id,
    // L'OPCO effectivement écrit doit apparaître dans l'audit : c'est le log
    // d'audit qui a prouvé, sur AXI-CLI-002, que l'inférence tournait et rendait
    // null. Une écriture non tracée est un angle mort pour l'auditeur.
    changes: { ...fields, ...(opcoAEcrire !== undefined ? { opcoIdentifie: opcoAEcrire } : {}) },
    session,
  });

  return { data: { id } };
}
