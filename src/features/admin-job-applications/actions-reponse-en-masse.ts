// ÉCRIRE À PLUSIEURS POSTULANTS D'UN SEUL GESTE — Server Action.
//
// 🔴 UN MODULE À PART, comme `actions-en-masse.ts` et pour la même raison : une
//    erreur unitaire abîme un dossier, une erreur en masse en abîme cinquante.
//    Sauf qu'ici elle ne les abîme pas — elle écrit à cinquante personnes, et
//    ça ne se rattrape pas. Les garde-fous propres à ce risque méritent d'être
//    lisibles ensemble.
//
// ⛔ CE GESTE N'EXISTE QUE DU CÔTÉ EMPLOI. Le pourquoi est écrit en tête de
//    `reponse-en-masse.ts` : un envoi groupé à des apporteurs d'affaires
//    fabrique une pièce du faisceau de requalification.

"use server";

import { z } from "zod";
import { revalidatePath, updateTag } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { decryptPii } from "@/lib/pii-crypto";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { INBOX_COUNTS_TAG } from "@/features/admin-inbox/cache-tags";
import { MODELES_REPONSE_IDS, remplirModele } from "@/content/recrutement/modeles-reponse";

import { PLAFOND_EN_MASSE } from "./en-masse";
import { ecrireEtEnfilerReponse } from "./envoyer-reponse";
import {
  preparerEnvois,
  type EcartPrepare,
  type EtatReponseEnMasse,
  type DestinatairePrepare,
} from "./reponse-en-masse";

/**
 * 🔴 EXACTEMENT la garde du composeur unitaire, et pas une de moins.
 *
 * Le raisonnement est celui de `requireEcritureCandidature` : répondre expose
 * l'identité du candidat, donc quiconque écrit doit pouvoir lire le dossier.
 * `editor` n'a pas ce droit. Un geste groupé plus PERMISSIF que le geste
 * unitaire qu'il répète cinquante fois serait une porte de service — et c'est
 * la forme que prennent la plupart des escalades de privilège : non pas une
 * garde absente, mais une garde plus faible sur le chemin qu'on a écrit après.
 */
async function requireEcritureCandidature(): Promise<{ userId: string; nom: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("unauthorized");
  const role = (session.user as { role?: string }).role ?? "reader";
  if (!peutOuvrirDossierCandidat(role)) throw new Error("forbidden");
  const nom = (session.user as { name?: string }).name ?? session.user.email ?? session.user.id;
  return { userId: session.user.id, nom };
}

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(PLAFOND_EN_MASSE),
  subject: z.string().min(2).max(120),
  bodyMarkdown: z.string().min(1).max(50_000),
  modele: z.enum(MODELES_REPONSE_IDS).default("libre"),
});

/**
 * Répond à une sélection de candidatures — un message par personne.
 *
 * ── 🔴 CE QUI DIFFÈRE DU GESTE DE STATUT GROUPÉ, ET POURQUOI ──────────────
 * Le geste de statut est « tout passe ou rien ne passe », une seule
 * transaction. Ici c'est IMPOSSIBLE, et prétendre le contraire serait pire que
 * de l'assumer : un e-mail remis à la file est parti. Il n'existe pas de
 * transaction qui le rappelle.
 *
 * On procède donc destinataire par destinataire, et on rend un compte rendu à
 * TROIS nombres qui ne se mélangent pas :
 *
 *   · `envoyees`  — écrites en base ET acceptées par la file ;
 *   · `ecartees`  — écartées AVANT tout envoi, rien n'a été écrit pour elles ;
 *   · `echouees`  — écrites, mais refusées par la file : elles portent `failed`
 *                   et la fiche propose de les rejouer.
 *
 * Un seul total « 50 traitées » aurait été un mensonge utile à personne. C'est
 * précisément ce compte rendu qu'on relit quand un candidat dit « je n'ai rien
 * reçu ».
 *
 * ── UN MESSAGE PAR PERSONNE, JAMAIS UNE COPIE CARBONE ─────────────────────
 * Chaque destinataire reçoit son propre envoi, personnalisé depuis SON dossier.
 * Aucun `cc`, aucun `bcc` : mettre quinze candidats à la même offre en copie
 * leur apprendrait mutuellement leur candidature. Le chemin d'écriture ne le
 * permet d'ailleurs pas — il pose une adresse par ligne — et c'est heureux.
 *
 * ── ORDRE ET INTERRUPTION ─────────────────────────────────────────────────
 * Les envois sont séquentiels et non parallèles. Ce n'est pas de la prudence
 * de débutant : cinquante `$transaction` simultanées épuisent le pool Prisma,
 * et l'échec qui en sort accuse la base au lieu du parallélisme. Cinquante
 * envois séquentiels tiennent largement dans le budget d'une Server Action.
 */
export async function repondreEnMasseAction(
  _prev: EtatReponseEnMasse,
  formData: FormData,
): Promise<EtatReponseEnMasse> {
  let acteur: { userId: string; nom: string };
  try {
    acteur = await requireEcritureCandidature();
  } catch {
    return { ok: false, error: "Permission insuffisante." };
  }

  const parsed = schema.safeParse({
    ids: formData.getAll("ids").map(String),
    subject: formData.get("subject"),
    bodyMarkdown: formData.get("bodyMarkdown"),
    modele: formData.get("modele") ?? undefined,
  });
  if (!parsed.success) {
    // Le cas le plus fréquent est « aucune case cochée » : le dire, plutôt que
    // « champs invalides », qui envoie relire le formulaire.
    const aucun = formData.getAll("ids").length === 0;
    if (aucun) return { ok: false, error: "Aucune candidature sélectionnée." };
    if (formData.getAll("ids").length > PLAFOND_EN_MASSE) {
      return { ok: false, error: `Au plus ${PLAFOND_EN_MASSE} destinataires par envoi.` };
    }
    return { ok: false, error: "Objet et message sont obligatoires." };
  }

  const dossiers = await prisma.jobApplication.findMany({
    where: { id: { in: parsed.data.ids } },
    select: {
      id: true,
      email: true,
      locale: true,
      status: true,
      offerTitleSnap: true,
      firstName: true,
    },
  });
  if (dossiers.length === 0) return { ok: false, error: "Aucune candidature trouvée." };

  // Le prénom est CHIFFRÉ en base. On le déchiffre ici, dans le processus web
  // qui a la clé, et uniquement pour le substituer : il ne repart pas en base.
  const destinataires: DestinatairePrepare[] = dossiers.map((d) => ({
    id: d.id,
    prenom: prenomLisible(d.firstName),
    poste: d.offerTitleSnap,
  }));

  const { envois, ecartes } = preparerEnvois(
    destinataires,
    { objet: parsed.data.subject, corps: parsed.data.bodyMarkdown },
    remplirModele,
  );

  const parId = new Map(dossiers.map((d) => [d.id, d]));
  const details: EcartPrepare[] = [...ecartes];

  // Sélectionné puis disparu entre le clic et l'envoi. Sans cette ligne, l'écran
  // dirait « 47 envoyées » sur une sélection de 50 et laisserait chercher les
  // trois manquantes dans les logs.
  for (const id of parsed.data.ids) {
    if (!parId.has(id)) details.push({ id, motif: "dossier_introuvable", variables: [] });
  }
  let envoyees = 0;
  let echouees = 0;

  for (const envoi of envois) {
    const dossier = parId.get(envoi.id);
    if (!dossier) continue;

    const issue = await ecrireEtEnfilerReponse(dossier, acteur, {
      subject: envoi.objet,
      bodyMarkdown: envoi.corps,
      modele: parsed.data.modele,
    });

    if (!issue.ecrit) {
      // Rien n'a été écrit pour cette personne. Elle rejoint les écartées, avec
      // SON motif — « adresse illisible » et « variable non résolue » appellent
      // deux gestes de rattrapage différents, et les confondre ferait chercher
      // le défaut au mauvais endroit.
      details.push({
        id: envoi.id,
        motif:
          issue.error === "invalid_recipient" ? "destinataire_injoignable" : "ecriture_impossible",
        variables: [],
      });
      continue;
    }
    if (issue.enfile) envoyees += 1;
    else echouees += 1;
  }

  revalidatePath(adminPath("fr", "contacts/candidatures"));
  updateTag(INBOX_COUNTS_TAG);

  return {
    ok: true,
    envoyees,
    ecartees: details.length,
    echouees,
    details,
  };
}

/** Prénom en clair, ou `null` si absent ou indéchiffrable. */
function prenomLisible(chiffre: string | null): string | null {
  if (!chiffre) return null;
  try {
    const clair = decryptPii(chiffre);
    return typeof clair === "string" && clair.trim().length > 0 ? clair : null;
  } catch {
    return null;
  }
}
