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
import { resoudreSiren } from "@/lib/siret";
import { siretField } from "@/lib/siret-schema";
import { premierMessageZod } from "@/lib/zod-message";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import { inferOpco } from "@/server/qualiopi/crm/naf-opco";
import { definirContactFacturation } from "@/server/qualiopi/crm/contact-facturation";
import {
  creerOuRetrouverClient,
  ErreurSirenDejaPris,
  exigerSirenLibre,
  type SignalProche,
} from "@/server/qualiopi/crm/porte-client";

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

/**
 * Cohérence type × champs d'entreprise — garde SERVEUR.
 *
 * 🔴 Aujourd'hui, seule l'interface masque SIRET, NAF, taille, IDCC et OPCO
 * pour un particulier (`ClientEditForm`, `ClientBrancheForm`). Une Server Action
 * est appelable directement : masquer n'est pas interdire. C'est exactement le
 * défaut corrigé au Lot 10 sur les habilitations, appliqué ici aux données.
 *
 * Ce que ces champs signifient : un SIRET identifie un établissement, un IDCC
 * une convention collective de branche, un OPCO l'opérateur qui finance
 * l'obligation de formation d'un EMPLOYEUR. Aucun n'a de sens pour une personne
 * physique qui se forme à titre individuel — et un OPCO posé sur un particulier
 * produirait un dossier de financement qu'aucun financeur n'accepterait.
 *
 * ⚠️ La règle ne mord QUE si le type `particulier` est présent dans la charge :
 * une mise à jour qui ne touche pas au type ne peut pas être refusée à cause de
 * données historiques qu'elle ne modifie pas.
 */
const CHAMPS_ENTREPRISE = [
  "siret",
  "siren",
  "nafCode",
  "conventionCollective",
  "idcc",
  "taille",
  "opcoIdentifie",
  "opcoNumeroAdherent",
  "opcoEnveloppeAnnuelleCents",
] as const;

function refuserChampsEntreprisePourParticulier(
  valeurs: Record<string, unknown>,
  ctx: z.RefinementCtx,
): void {
  if (valeurs["type"] !== "particulier") return;
  for (const champ of CHAMPS_ENTREPRISE) {
    const v = valeurs[champ];
    if (v === undefined || v === null || v === "") continue;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [champ],
      message:
        `« ${champ} » ne s'applique pas à un particulier : ce champ identifie un employeur ` +
        `(établissement, branche, opérateur de compétences). Retirez-le, ou changez le type du client.`,
    });
  }
}

const createClientSchema = z
  .object({
    /** entreprise (B2B) | particulier (B2C). Défaut entreprise. */
    type: z.enum(CLIENT_TYPES).optional(),
    raisonSociale: z.string().min(1).max(250),
    // Format + clé de Luhn + rejet des valeurs de remplissage. `max(14)` seul
    // acceptait « 00000000000000 », valeur réellement persistée en production, et
    // qui se propage jusqu'au `<ram:ID schemeID="0009">` du Factur-X — donc à une
    // facture non routable par la Plateforme Agréée. Reste FACULTATIF.
    siret: siretField.optional(),
    /**
     * SIREN saisi à la main (chantier visio). Facultatif : quand un SIRET est
     * saisi, le SIREN en est DÉRIVÉ (`resoudreSiren`) ; un SIREN qui le
     * contredit est refusé avec un message qui dit quoi corriger.
     */
    siren: z.string().max(20).optional(),
    nafCode: z.string().max(6).optional(),
    conventionCollective: z.string().max(200).optional(),
    /** Code IDCC de la branche (précise la convention collective). */
    idcc: z.string().max(10).optional(),
    secteur: z.string().max(200).optional(),
    taille: z.enum(COMPANY_SIZES).optional(),
    adresse: z.string().optional(),
    /** Ville et code postal : l'anti-doublon compare « même nom dans la même ville ». */
    adresseVille: z.string().max(120).optional(),
    adresseCodePostal: z.string().max(12).optional(),
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
    /**
     * « Créer quand même » : motif exigé quand l'adresse e-mail est déjà connue
     * sur une autre fiche (≥ 10 caractères, journalisé). Sans effet sur un même
     * SIREN, qui reste refusé.
     */
    motifCreationForcee: z.string().max(300).optional(),
  })
  .superRefine(refuserChampsEntreprisePourParticulier);

const updateClientSchema = z
  .object({
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
    /** Voir `createClientSchema`. `null` efface — seulement sans SIRET. */
    siren: z.string().max(20).nullable().optional(),
    nafCode: z.string().max(6).optional(),
    conventionCollective: z.string().max(200).optional(),
    /** Code IDCC de la branche (précise la convention collective). */
    idcc: z.string().max(10).optional(),
    secteur: z.string().max(200).optional(),
    taille: z.enum(COMPANY_SIZES).optional(),
    adresse: z.string().optional(),
    contactNom: z.string().max(200).optional(),
    /**
     * `.nullable()` en PLUS, exactement pour le motif déjà écrit sur `siret` : la
     * chaîne vide rend `undefined` (= « ne rien changer »), elle ne peut donc pas
     * effacer, et sans `null` une adresse saisie par erreur serait DÉFINITIVE.
     *
     * 🔴 Ici l'enjeu est plus lourd que pour le SIRET : c'est à cette adresse que
     * part le LIEN DE SIGNATURE du devis. Une adresse fautive qu'on ne peut pas
     * retirer laisserait l'écran d'édition proposer d'envoyer un engagement
     * contractuel à un destinataire dont on sait qu'il est faux.
     */
    contactEmail: z.string().email().nullable().optional(),
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
    /**
     * Applique-t-on les pénalités de retard (art. L.441-10) à ce client ?
     *
     * 🔴 `false` par défaut au schéma, et ce défaut est une décision produit :
     * facturer des pénalités à tout le monde est commercialement destructeur. On
     * coche client par client.
     *
     * ⚠️ Gouverne l'APPLICATION des frais (montant chiffré dans une relance et sur
     * la fiche client), JAMAIS la MENTION légale — obligatoire sur toute facture
     * entre professionnels et imprimée sans condition. Cf. `financements/penalites.ts`.
     */
    penalitesRetardActives: z.boolean().optional(),
  })
  .superRefine(refuserChampsEntreprisePourParticulier);

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

/** Une fiche proche, telle que l'écran l'affiche (« c'est peut-être déjà… »). */
export interface FicheProcheAffichee {
  readonly ficheId: string;
  readonly numero: string;
  readonly raisonSociale: string;
  readonly signal: SignalProche;
  readonly force: "bloquant" | "fort" | "proposition";
}

/**
 * Résultat de la création. En cas de refus, `proches` dit POURQUOI et vers
 * quelle fiche aller ; `motifRequis` dit que « créer quand même » est possible
 * avec un motif (signal « même adresse e-mail »), jamais pour un même SIREN.
 */
export type ResultatCreationClient =
  | { data: { id: string; numero: string } }
  | { error: string; proches?: FicheProcheAffichee[]; motifRequis?: boolean };

/**
 * Crée un client prospect — PAR LA PORTE UNIQUE (`creerOuRetrouverClient`).
 * - Même SIREN qu'une fiche existante : refus, avec la fiche à ouvrir.
 * - Même adresse e-mail : refus, sauf motif de « créer quand même » journalisé.
 * - Numéro alloué séquentiellement : AXI-CLI-NNN (borne haute + 1, sans millésime).
 * - opcoIdentifie inféré via inferOpco (IDCC prioritaire, repli NAF) si absent.
 * - Statut initial : prospect.
 * - Le contact saisi devient la première personne de la fiche et son contact
 *   de facturation (`definirContactFacturation`, même transaction).
 */
export async function createClientAction(
  // `z.input` et non `z.infer` : `siretField` porte un `.transform()`, donc le
  // type d'ENTRÉE (ce que l'appelant fournit) diverge du type de SORTIE (ce que
  // Zod rend). Avec `exactOptionalPropertyTypes`, `z.infer` compilerait par
  // coïncidence aujourd'hui et casserait au premier champ transformé suivant.
  input: z.input<typeof createClientSchema>,
): Promise<ResultatCreationClient> {
  const session = await requireAdminWrite();
  const parsed = createClientSchema.safeParse(input);
  // Remonter le message du premier champ fautif : avec « Données invalides » en
  // dur, l'admin ne saurait pas que c'est le SIRET qui est refusé, et la
  // validation serait active mais inexploitable. Surface admin-only.
  if (!parsed.success) return { error: premierMessageZod(parsed.error) };
  const v = parsed.data;

  // SIREN (chantier visio) : dérivé du SIRET quand il y en a un ; un SIREN
  // saisi qui le contredit est refusé AVANT toute écriture.
  const sirenResolu = resoudreSiren(v.siret, v.siren);
  if (!sirenResolu.ok) return { error: sirenResolu.message };
  const siren = sirenResolu.siren;

  // Inférer l'OPCO si non fourni manuellement. L'IDCC prime : c'est la
  // convention collective qui rattache légalement à un OPCO.
  const opcoIdentifie = v.opcoIdentifie ?? inferOpco({ idcc: v.idcc, naf: v.nafCode });

  // ⚠️ `numero` est alloué PAR LA PORTE, dans sa transaction, avec la même
  // borne haute que V20 (série `client` sans millésime : voir `nextNumero`).
  const resultat = await creerOuRetrouverClient(
    prisma,
    {
      raisonSociale: v.raisonSociale,
      ...(v.type !== undefined ? { type: v.type } : {}),
      ...(v.siret !== undefined ? { siret: v.siret } : {}),
      ...(siren !== undefined ? { siren } : {}),
      ...(v.nafCode !== undefined ? { nafCode: v.nafCode } : {}),
      ...(v.conventionCollective !== undefined
        ? { conventionCollective: v.conventionCollective }
        : {}),
      ...(v.idcc !== undefined ? { idcc: v.idcc } : {}),
      ...(v.secteur !== undefined ? { secteur: v.secteur } : {}),
      ...(v.taille !== undefined ? { taille: v.taille } : {}),
      ...(v.adresse !== undefined ? { adresse: v.adresse } : {}),
      ...(v.adresseVille !== undefined ? { adresseVille: v.adresseVille } : {}),
      ...(v.adresseCodePostal !== undefined ? { adresseCodePostal: v.adresseCodePostal } : {}),
      ...(opcoIdentifie !== null ? { opcoIdentifie } : {}),
      ...(v.opcoNumeroAdherent !== undefined ? { opcoNumeroAdherent: v.opcoNumeroAdherent } : {}),
      ...(v.opcoEnveloppeAnnuelleCents !== undefined
        ? { opcoEnveloppeAnnuelleCents: v.opcoEnveloppeAnnuelleCents }
        : {}),
      ...(v.source !== undefined ? { source: v.source } : {}),
      ...(v.contexteIa !== undefined ? { contexteIa: v.contexteIa } : {}),
      ...(v.notes !== undefined ? { notes: v.notes } : {}),
    },
    {
      ...(v.contactNom !== undefined ? { nom: v.contactNom } : {}),
      ...(v.contactEmail !== undefined ? { email: v.contactEmail } : {}),
      ...(v.contactTelephone !== undefined ? { telephone: v.contactTelephone } : {}),
      ...(v.contactFonction !== undefined ? { fonction: v.contactFonction } : {}),
    },
    {
      parAdminId: session.userId,
      ...(v.motifCreationForcee !== undefined
        ? { motifCreationForcee: v.motifCreationForcee }
        : {}),
    },
  );

  if (resultat.statut === "refuse_siren") {
    return { error: resultat.message, proches: [resultat.fiche] };
  }
  if (resultat.statut === "motif_requis") {
    return { error: resultat.message, proches: [...resultat.proches], motifRequis: true };
  }

  await logQualiopiActivity({
    action: "qualiopi.client.create",
    targetType: "Client",
    targetId: resultat.id,
    changes: {
      numero: resultat.numero,
      raisonSociale: v.raisonSociale,
      opcoIdentifie,
      ...(siren !== undefined ? { siren } : {}),
      ...(resultat.creationForcee ? { creationForcee: true } : {}),
    },
    session,
  });

  return { data: { id: resultat.id, numero: resultat.numero } };
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

  // ── SIREN (chantier visio) ────────────────────────────────────────────────
  //  • SIRET transmis        → SIREN dérivé ; un SIREN saisi contraire = refus
  //  • SIRET effacé (`null`) → le SIREN n'est touché que s'il est transmis
  //  • SIREN seul            → comparé au SIRET déjà en base
  let sirenAEcrire: string | null | undefined;
  if (typeof fields.siret === "string") {
    const r = resoudreSiren(fields.siret, fields.siren);
    if (!r.ok) return { error: r.message };
    sirenAEcrire = r.siren;
  } else if (fields.siren !== undefined) {
    const enBase =
      fields.siret === null
        ? null
        : ((
            await prisma.client.findUnique({
              where: { id },
              select: { siret: true },
            })
          )?.siret ?? null);
    if (fields.siren === null || fields.siren.trim() === "") {
      if (enBase !== null) {
        return {
          error:
            "SIREN : il est tiré du SIRET de la fiche. Pour l'effacer, effacez d'abord le SIRET.",
        };
      }
      sirenAEcrire = null;
    } else {
      const r = resoudreSiren(enBase, fields.siren);
      if (!r.ok) return { error: r.message };
      sirenAEcrire = r.siren;
    }
  }

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

  // ── Contact : par la fonction unique, jamais en écriture directe ──────────
  // `Client.contact*` est la COPIE du contact de facturation (dossier client,
  // PA-1). Les écrire ici à côté de lui ferait deux vérités.
  const contactTransmis =
    fields.contactNom !== undefined ||
    fields.contactEmail !== undefined ||
    fields.contactTelephone !== undefined ||
    fields.contactFonction !== undefined;

  try {
    await prisma.$transaction(async (tx) => {
      // B18 : un SIREN écrit sur une fiche EXISTANTE passe par le même verrou et
      // la même recherche que la création — jamais deux fiches vivantes au même
      // SIREN (« C'est elle », SIRET saisi dans « Éditer »).
      if (typeof sirenAEcrire === "string") await exigerSirenLibre(tx, id, sirenAEcrire);
      await tx.client.update({
        where: { id },
        data: {
          ...(fields.type !== undefined ? { type: fields.type } : {}),
          ...(fields.raisonSociale !== undefined ? { raisonSociale: fields.raisonSociale } : {}),
          ...(fields.siret !== undefined ? { siret: fields.siret } : {}),
          ...(sirenAEcrire !== undefined ? { siren: sirenAEcrire } : {}),
          ...(fields.nafCode !== undefined ? { nafCode: fields.nafCode } : {}),
          ...(fields.conventionCollective !== undefined
            ? { conventionCollective: fields.conventionCollective }
            : {}),
          ...(fields.idcc !== undefined ? { idcc: fields.idcc } : {}),
          ...(fields.secteur !== undefined ? { secteur: fields.secteur } : {}),
          ...(fields.taille !== undefined ? { taille: fields.taille } : {}),
          ...(fields.adresse !== undefined ? { adresse: fields.adresse } : {}),
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
          ...(fields.penalitesRetardActives !== undefined
            ? { penalitesRetardActives: fields.penalitesRetardActives }
            : {}),
        },
      });
      if (contactTransmis) {
        await definirContactFacturation(tx, {
          clientId: id,
          ...(fields.contactNom !== undefined ? { nom: fields.contactNom } : {}),
          ...(fields.contactEmail !== undefined ? { email: fields.contactEmail } : {}),
          ...(fields.contactTelephone !== undefined ? { telephone: fields.contactTelephone } : {}),
          ...(fields.contactFonction !== undefined ? { fonction: fields.contactFonction } : {}),
          parAdminId: session.userId,
        });
      }
    });
  } catch (e) {
    if (e instanceof ErreurSirenDejaPris) return { error: e.message };
    throw e;
  }

  await logQualiopiActivity({
    action: "qualiopi.client.update",
    targetType: "Client",
    targetId: id,
    // L'OPCO effectivement écrit doit apparaître dans l'audit : c'est le log
    // d'audit qui a prouvé, sur AXI-CLI-002, que l'inférence tournait et rendait
    // null. Une écriture non tracée est un angle mort pour l'auditeur.
    changes: {
      ...fields,
      ...(opcoAEcrire !== undefined ? { opcoIdentifie: opcoAEcrire } : {}),
      ...(sirenAEcrire !== undefined ? { siren: sirenAEcrire } : {}),
    },
    session,
  });

  return { data: { id } };
}
