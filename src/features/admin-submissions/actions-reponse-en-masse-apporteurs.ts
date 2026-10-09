// ÉCRIRE À PLUSIEURS FUTURS APPORTEURS D'UN SEUL GESTE — Server Action
// (Candidatures unifiées L6b). Les règles pures et le pourquoi « modèle
// seulement » sont dans `reponse-en-masse-apporteurs.ts`.
//
// Un message PAR personne, jamais en copie ; un lien privé PAR personne s'il y
// a des fichiers (kit, présentation SEULS) ; plafond `PLAFOND_EN_MASSE`, le même
// que côté emploi ; exclus et NOMMÉS : opposés, « Sans suite ».

"use server";

import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { decryptPii } from "@/lib/pii-crypto";
import { peutOuvrirDossierApporteur } from "@/server/auth/habilitations";
import { INBOX_COUNTS_TAG } from "@/features/admin-inbox/cache-tags";
import { estApporteur } from "@/lib/commercial-application/est-apporteur";
import { estOpposee } from "@/server/email/opposition";
import { preparerLienFichiers } from "@/server/partages/attacher-a-une-reponse";
import { FICHIERS_PAR_LIEN_MAX } from "@/server/partages/liens";
import { remplirModele } from "@/content/modeles/remplir";
import {
  MODELES_REPONSE_APPORTEUR,
  MODELES_REPONSE_APPORTEUR_IDS,
} from "@/content/apporteurs/modeles-reponse";
import { annulerRelancesLeadApporteur } from "@/features/commercial-application/relances-lead-apporteur";
import { lireSuiviInvitationListe } from "@/features/commercial-application/invitation-apporteur";
import { PLAFOND_EN_MASSE } from "@/features/admin-job-applications/en-masse";
import {
  nomCourt,
  type EcartPrepare,
  type EtatReponseEnMasse,
} from "@/features/admin-job-applications/reponse-en-masse";
import { splitNomPrenom } from "@/lib/nom-prenom";

import { ecrireEtEnfilerReponseSubmission } from "./envoyer-reponse";
import { estClasseeSansSuite, motifExclusionApporteur } from "./reponse-en-masse-apporteurs";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(PLAFOND_EN_MASSE),
  // 🔑 « Message libre » refusé : l'envoi groupé part d'un modèle relu.
  modele: z.enum(MODELES_REPONSE_APPORTEUR_IDS).refine((m) => m !== "libre"),
  fichierIds: z.array(z.string().uuid()).max(FICHIERS_PAR_LIEN_MAX).default([]),
});

export async function repondreEnMasseApporteursAction(
  input: z.input<typeof schema>,
): Promise<EtatReponseEnMasse> {
  // Une garde AU MOINS aussi stricte que le geste unitaire : quiconque écrit à
  // cinquante personnes doit pouvoir ouvrir leur dossier.
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user?.id || !peutOuvrirDossierApporteur(role)) {
    return { ok: false, error: "Permission insuffisante." };
  }
  const acteur = {
    userId: session.user.id,
    name: (session.user as { name?: string }).name ?? session.user.id,
  };

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    if ((input.ids ?? []).length === 0)
      return { ok: false, error: "Aucune personne sélectionnée." };
    if ((input.ids ?? []).length > PLAFOND_EN_MASSE) {
      return { ok: false, error: `Au plus ${PLAFOND_EN_MASSE} destinataires par envoi.` };
    }
    return { ok: false, error: "Choisissez un modèle : l'envoi groupé part d'un modèle." };
  }
  const modele = MODELES_REPONSE_APPORTEUR.find((m) => m.id === parsed.data.modele)!;

  const fiches = await prisma.submission.findMany({
    where: { id: { in: parsed.data.ids }, deletedAt: null },
    select: {
      id: true,
      contactEmail: true,
      contactName: true,
      locale: true,
      status: true,
      details: true,
    },
  });
  // Seulement des dossiers apporteurs : une fiche client glissée dans la
  // sélection est traitée comme disparue, jamais servie d'un texte du réseau.
  const apporteurs = fiches.filter((f) => estApporteur(f.details));
  const parId = new Map(apporteurs.map((f) => [f.id, f]));

  let suivis = new Map<string, { decision?: { type: string } | null }>();
  try {
    suivis = await lireSuiviInvitationListe(apporteurs.map((f) => f.id));
  } catch (e) {
    Sentry.captureException(e, { tags: { geste: "reponse-en-masse-apporteurs" } });
  }

  const details: EcartPrepare[] = [];
  let envoyees = 0;
  let echouees = 0;
  let premier = true;

  for (const id of parsed.data.ids) {
    const f = parId.get(id);
    if (!f) {
      details.push({ id, motif: "dossier_introuvable", variables: [] });
      continue;
    }
    const adresse = decryptPii(f.contactEmail);
    const { prenom, nom } = splitNomPrenom(f.contactName, false);
    const motif = motifExclusionApporteur({
      opposee: adresse ? await estOpposee(adresse) : false,
      sansSuite:
        estClasseeSansSuite(f.details) || suivis.get(f.id)?.decision?.type === "non-retenu",
    });
    if (motif) {
      details.push({ id, motif, variables: [], nom: nomCourt(prenom, nom) });
      continue;
    }
    if (modele.corps.includes("{prenom}") && !prenom) {
      details.push({ id, motif: "variable_non_resolue", variables: ["prenom"] });
      continue;
    }

    let lienFichiers;
    if (parsed.data.fichierIds.length > 0) {
      const p = await preparerLienFichiers(parsed.data.fichierIds, { monde: "apporteur" });
      if (!p.ok) {
        if (premier) return { ok: false, error: p.erreur };
        details.push({ id, motif: "ecriture_impossible", variables: [] });
        continue;
      }
      lienFichiers = p.lien;
    }
    premier = false;

    const valeurs = { prenom };
    const issue = await ecrireEtEnfilerReponseSubmission(
      { id: f.id, contactEmail: f.contactEmail, locale: f.locale, status: f.status },
      acteur,
      {
        subject: remplirModele(modele.objet, valeurs),
        bodyMarkdown: remplirModele(modele.corps, valeurs),
        templateUsed: `apporteur-groupe:${modele.id}`,
        ...(lienFichiers ? { lienFichiers } : {}),
      },
    );
    if (!issue.ecrit) {
      details.push({
        id,
        motif:
          issue.error === "invalid_recipient" ? "destinataire_injoignable" : "ecriture_impossible",
        variables: [],
      });
      continue;
    }
    if (!issue.enfile) {
      echouees += 1;
      continue;
    }
    envoyees += 1;
    // Même règle que la réponse unitaire : une réponse PARTIE arrête les
    // relances en attente de cette personne. Best-effort.
    if (adresse) {
      try {
        await annulerRelancesLeadApporteur(
          adresse,
          "Envoi annulé : une réponse a été envoyée depuis la console.",
        );
      } catch (e) {
        Sentry.captureException(e, { tags: { step: "annuler-relances-envoi-groupe" } });
      }
    }
  }

  revalidatePath(adminPath("fr", "contacts/commercial"));
  updateTag(INBOX_COUNTS_TAG);
  return { ok: true, envoyees, ecartees: details.length, echouees, details };
}
