"use server";

/**
 * Écran « Vérifier et contresigner » (W-4, lot L9) — ACTIONS.
 *
 * Un seul bouton : « Contresigner et ouvrir son espace ». Dans l'ordre, et
 * chaque étape SAUTÉE quand elle est déjà faite (un second clic rejoue sans
 * rien doubler) :
 *   1. l'attestation URSSAF vérifiée (service L4b : une `PreuveVigilance`) ;
 *   2. les pièces en attente validées (chemin commun des pièces) ;
 *   3. les formations cochées habilitées (chemin commun des habilitations) ;
 *   4. le contrat-cadre contresigné (chemin commun de contresignature L7c :
 *      registre relu EN DIRECT côté serveur, rouge ou muet = refus) ;
 *   5. l'orange du registre validé, si la personne a coché « J'ai vérifié » ;
 *   6. l'activation, par l'écrivain unique, sous la règle complète ;
 *   7. F20 « Votre espace formateur est ouvert », une fois, texte validé exigé.
 *
 * 🔴 LIVRÉ ÉTEINT : `formateurs.activation_auto` absent = toutes ces actions
 * refusent sans rien lire ni écrire.
 *
 * Rôles : vérifier et habiliter = `habiliter_formateur` ; contresigner engage
 * l'organisme = `contresigner` (direction). Les deux sont exigés ici.
 */

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireHabilitation } from "@/server/actions/qualiopi/_guards";
import { contresignerPieceAction } from "@/server/actions/qualiopi/piece-signature";
import { validateTrainerDocumentAction } from "@/server/actions/qualiopi/trainer-documents";
import { setTrainerHabilitationsAction } from "@/server/actions/qualiopi/trainers";
import { MOTIF_REFUS, peutEngager } from "@/server/auth/habilitations";
import {
  changerActivationFormateur,
  messageRefusActivation,
} from "@/server/qualiopi/formateurs-independants/activation";
import { validerControleOrange } from "@/server/qualiopi/formateurs-independants/controle";
import { SOURCE_VALIDATION_ORANGE } from "@/server/qualiopi/formateurs-independants/controle-regles";
import { envoyer } from "@/server/qualiopi/formateurs-independants/envois";
import {
  demanderComplementW4,
  refuserDossier,
  type ResultatDossier,
} from "@/server/qualiopi/formateurs-independants/envois-dossier";
import { lireDrapeauEnvoi } from "@/server/qualiopi/formateurs-independants/interrupteurs";
import { lireEtatsInterrupteurs } from "@/server/qualiopi/formateurs-independants/interrupteurs-etat";
import { validerAttestationVigilance } from "@/server/qualiopi/formateurs-independants/validation-vigilance";
import {
  lireEcranVerifierContresigner,
  motifsControle,
} from "@/server/qualiopi/formateurs-independants/verifier-contresigner-lecture";
import {
  MOTIFS_COMPLEMENT,
  MOTIFS_ORANGE,
  manquesPourContresigner,
  motifRefus,
  motifsCouverts,
  raisonGrise,
  refusPossible,
} from "@/server/qualiopi/formateurs-independants/verifier-contresigner-regles";

export type ResultatW4 = { ok: true; message: string } | { ok: false; error: string };

const ETEINT: ResultatW4 = {
  ok: false,
  error: "Cet écran n'est pas encore ouvert (interrupteur « Activation automatique » coupé).",
};

async function allume(): Promise<boolean> {
  return lireDrapeauEnvoi(await lireEtatsInterrupteurs(), "activation_auto");
}

function rafraichir(): void {
  revalidatePath("/[locale]/(admin)/[adminPrefix]/qualiopi/formateurs/[id]/verifier", "page");
}

const contresignerSchema = z
  .object({
    trainerId: z.string().uuid(),
    codeAttestation: z.string().max(80),
    attestationAuthentique: z.boolean(),
    piecesVerifiees: z.boolean(),
    formationIds: z.array(z.string().uuid()).max(200),
    orangeVerifie: z.boolean(),
    motifOrange: z.enum(MOTIFS_ORANGE).nullable(),
  })
  .strict();

export async function contresignerEtOuvrirEspaceAction(
  input: z.input<typeof contresignerSchema>,
): Promise<ResultatW4> {
  const session = await requireHabilitation("habiliter_formateur");
  if (!peutEngager(session.role, "contresigner")) {
    return { ok: false, error: `Contresignature refusée : ${MOTIF_REFUS.contresigner}` };
  }
  if (!(await allume())) return ETEINT;
  const parsed = contresignerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide : rechargez la page." };
  const s = parsed.data;

  const ecran = await lireEcranVerifierContresigner(s.trainerId);
  if (ecran === null) return { ok: false, error: "Formateur indépendant introuvable." };
  const f = ecran.faits;
  if (f.actif) return { ok: true, message: "Son espace est déjà ouvert." };

  // La MÊME règle que le bouton grisé : rien n'est écrit si un bloc est à faire.
  const manques = manquesPourContresigner(f, s);
  if (manques.length > 0) return { ok: false, error: raisonGrise(manques) };

  try {
    // 1. Attestation URSSAF (L4b).
    if (f.attestation !== null && !f.attestation.prouvee) {
      const r = await validerAttestationVigilance({
        trainerDocumentId: f.attestation.id,
        codeVerification: s.codeAttestation,
        authenticiteVerifiee: true,
        resultat: "valide",
      });
      if ("error" in r) return { ok: false, error: r.error };
    }

    // 2. Pièces en attente (CV, RIB, RC pro si déposée).
    for (const p of [f.pieces.cv, f.pieces.rib, f.pieces.rcPro]) {
      if (p === null || !p.fichierPresent || p.statutValidation !== "en_attente") continue;
      const r = await validateTrainerDocumentAction({ id: p.id, statutValidation: "valide" });
      if ("error" in r) return { ok: false, error: r.error };
    }

    // 3. Formations cochées : AJOUTÉES aux habilitations actives, jamais retirées.
    //    La liste envoyée part de TOUTES les habilitations actives en base, pas
    //    des seules formations affichées : le chemin commun remplace la liste.
    const actives = ecran.habilitationsActives;
    const nouvelles = s.formationIds.filter((id) => !actives.includes(id));
    if (nouvelles.length > 0) {
      const r = await setTrainerHabilitationsAction({
        id: s.trainerId,
        formationsHabilitees: [...actives, ...nouvelles],
      });
      if ("error" in r) return { ok: false, error: r.error };
    }

    // 4. Contresignature (registre relu en direct par le chemin commun).
    if (f.contrat !== null && f.contrat.statutSignature === "partielle") {
      const r = await contresignerPieceAction({
        documentGenereId: f.contrat.id,
        methode: "confirmation_accessible",
      });
      // Double clic : la seconde contresignature est refusée par l'unicité —
      // le contrat EST contresigné, on poursuit.
      if (!r.ok && r.raison !== "deja_signe") return { ok: false, error: r.message };
    }

    // 5. Orange du registre : la contresignature vient de relire le registre.
    //    « J'ai vérifié » ne couvre que les motifs que la personne a vus.
    const dernier = await prisma.verificationRegistreSousTraitance.findFirst({
      where: { trainerId: s.trainerId },
      orderBy: { createdAt: "desc" },
      select: { id: true, verdict: true, source: true, motif: true },
    });
    if (dernier?.verdict === "orange" && dernier.source !== SOURCE_VALIDATION_ORANGE) {
      const couverts = motifsCouverts(f);
      const nouveaux = motifsControle(dernier.motif);
      const vus = nouveaux.every((m) => couverts.includes(m));
      if (!s.orangeVerifie || s.motifOrange === null || !vus) {
        rafraichir();
        return {
          ok: false,
          error:
            "Contrat contresigné. Le registre relu à l'instant demande une vérification : rechargez la page, vérifiez, puis cliquez de nouveau.",
        };
      }
      const v = await validerControleOrange(prisma, {
        trainerId: s.trainerId,
        controleId: dernier.id,
        motif: s.motifOrange,
        valideParId: session.userId,
        maintenant: new Date(),
      });
      if (!v.ok) {
        rafraichir();
        return {
          ok: false,
          error: "Contrat contresigné. Le registre a changé : rechargez la page et revérifiez.",
        };
      }
    }

    // 6. Activation — écrivain unique, règle complète, jamais par « système ».
    const numero = f.contrat?.numero ?? "";
    const a = await changerActivationFormateur({
      trainerId: s.trainerId,
      actif: true,
      acteur: { type: "administrateur", session },
      motif: `Contrat-cadre ${numero} contresigné (écran Vérifier et contresigner).`,
    });
    if (!a.ok) {
      rafraichir();
      // Double clic simultané : l'autre clic a ouvert l'espace.
      const relu = await prisma.trainer.findUnique({
        where: { id: s.trainerId },
        select: { actif: true },
      });
      if (relu?.actif === true) return { ok: true, message: "Son espace est déjà ouvert." };
      return {
        ok: false,
        error: `Contrat contresigné, espace non ouvert : ${messageRefusActivation(a)}`,
      };
    }

    // 7. F20 — la fiche était inactive au départ et l'est plus : l'activation a
    //    pu être faite par l'après-signature (inchangée ici) ; la clé
    //    d'idempotence par fiche garde l'envoi unique.
    let messageEnvoi = "";
    if (a.actif) {
      const t = await prisma.trainer.findUnique({
        where: { id: s.trainerId },
        select: { email: true },
      });
      const envoi =
        t?.email == null
          ? "sans-adresse"
          : await envoyer({
              gabarit: "formateur-espace-ouvert",
              destinataire: t.email,
              payload: {},
              entityType: "Trainer",
              entityId: s.trainerId,
              jobId: `fi-espace-ouvert-${s.trainerId}`,
            });
      if (envoi === "texte-non-valide")
        messageEnvoi = " L'e-mail attend la validation de son texte.";
    }
    rafraichir();
    return { ok: true, message: `Contrat contresigné, espace ouvert.${messageEnvoi}` };
  } catch (err) {
    Sentry.captureException(err, { tags: { action: "contresignerEtOuvrirEspaceAction" } });
    return { ok: false, error: "Erreur lors de la contresignature : rechargez la page." };
  }
}

const complementSchema = z
  .object({ trainerId: z.string().uuid(), motif: z.enum(MOTIFS_COMPLEMENT) })
  .strict();

/**
 * « Demander un complément » : F12, motif d'une liste fermée. Le dossier « à vérifier »
 * est ROUVERT (« à compléter », nouvelle version d'accès : les anciens liens sont
 * révoqués) et l'e-mail donne le nouveau lien (M7, lot A).
 */
export async function demanderComplementFormateurAction(
  input: z.input<typeof complementSchema>,
): Promise<ResultatW4> {
  const session = await requireHabilitation("habiliter_formateur");
  if (!(await allume())) return ETEINT;
  const parsed = complementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choisissez un motif dans la liste." };
  const { trainerId, motif } = parsed.data;
  const r = await demanderComplementW4({
    trainerId,
    motif,
    parId: session.userId,
    maintenant: new Date(),
  });
  return resultatDossier(r, {
    eteint: "Le dossier en ligne est éteint : aucun lien ne peut être donné. Rien n'est parti.",
    etat: "Le dossier n'est pas en attente de vérification (déjà rouvert ?) : rien n'est parti.",
  });
}

const refusSchema = z.object({ trainerId: z.string().uuid() }).strict();

/**
 * « Refuser le dossier » : F13, seulement sur un registre rouge. L'état « refusé » est
 * écrit (ligne ajoutée au registre des contrôles) avant l'e-mail (M7, lot A).
 */
export async function refuserDossierFormateurAction(
  input: z.input<typeof refusSchema>,
): Promise<ResultatW4> {
  const session = await requireHabilitation("habiliter_formateur");
  if (!(await allume())) return ETEINT;
  const parsed = refusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide : rechargez la page." };
  const ecran = await lireEcranVerifierContresigner(parsed.data.trainerId);
  if (ecran === null) return { ok: false, error: "Formateur indépendant introuvable." };
  if (!refusPossible(ecran.faits)) {
    return { ok: false, error: "Le refus n'est proposé que sur un registre rouge." };
  }
  const r = await refuserDossier({
    trainerId: ecran.trainerId,
    motif: motifRefus(ecran.faits),
    parId: session.userId,
  });
  return resultatDossier(r, {
    eteint: "Rien n'est parti.",
    etat: "Le registre a changé, ou la fiche n'est plus refusable : rechargez la page.",
  });
}

function resultatDossier(
  r: ResultatDossier,
  messages: { eteint: string; etat: string },
): ResultatW4 {
  rafraichir();
  if (!r.ok) {
    if (r.raison === "texte-non-valide") {
      return {
        ok: false,
        error: "Le texte de cet e-mail n'est pas encore validé : rien n'est parti.",
      };
    }
    return { ok: false, error: r.raison === "eteint" ? messages.eteint : messages.etat };
  }
  if (r.envoi !== "envoye" && r.envoi !== "en-validation") {
    return { ok: false, error: "L'e-mail n'a pas pu partir : réessayez." };
  }
  return {
    ok: true,
    message:
      r.envoi === "envoye" ? "E-mail envoyé." : "E-mail préparé : il attend votre relecture.",
  };
}
