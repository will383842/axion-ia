/**
 * Actions serveur de la rubrique « Documents » d'un projet (ADR 0063).
 *
 * 🔴 Chaque action appelle `exigerAccesEchanges()` en PREMIÈRE instruction
 * (décision A2) : une action serveur s'appelle directement, sans la page.
 * Garde : `tests/unit/ci/les-documents-du-projet-sont-gardes-comme-le-dossier.spec.ts`.
 *
 * Retour : la page du projet, ancre `#documents`, avec un message SCELLÉ
 * (`message-de-retour.ts`). Le message de succès ne porte que le geste et
 * l'identifiant (`archive:<id>`) : la page compose le texte avec le titre
 * qu'elle a lu. Aucun titre ne part donc dans l'URL, l'historique ni Sentry.
 * `carte=documents` dit à la page que le message est celui de la rubrique.
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones.
 */

"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { adminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { analyserOctets } from "@/server/careers/clamav";
import { exigerAccesEchanges } from "@/features/dossier-client/acces";
import { avecMessageDeRetour } from "@/features/dossier-client/message-de-retour";
import { messageAffichable } from "@/features/dossier-client/message-affichable";
import {
  ajouterFichier,
  ajouterLien,
  ErreurDocument,
  MESSAGES_DOCUMENT,
  verifierTailleAnnoncee,
} from "./ajouter";
import { archiver, reafficher } from "./archiver";

/** L'antivirus a 30 s pour un fichier de 15 Mo au plus. */
const DELAI_ANTIVIRUS_MS = 30_000;

const NATURES = [
  "email",
  "pdf",
  "page_en_ligne",
  "compte_rendu",
  "devis",
  "note",
  "autre",
] as const;

const ajoutSchema = z.object({
  clientId: z.string().uuid(),
  projetId: z.string().uuid(),
  cote: z.enum(["envoye_au_client", "interne"]),
  nature: z.union([z.literal("deviner"), z.enum(NATURES)]),
  titre: z.string().max(1000),
  envoyeLe: z.string().max(20),
  lien: z.string().max(5000),
});

const tripletSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  projetId: z.string().uuid(),
});

function pageDuProjet(clientId: string, projetId: string): string {
  return adminPath("fr", `qualiopi/clients/${clientId}/projets/${projetId}`);
}

function retour(
  clientId: string,
  projetId: string,
  cle: "message" | "erreur",
  texte: string,
): string {
  const url = `${pageDuProjet(clientId, projetId)}?carte=documents`;
  return `${avecMessageDeRetour(url, cle, texte)}#documents`;
}

function texte(formData: FormData, cle: string): string {
  const v = formData.get(cle);
  return typeof v === "string" ? v : "";
}

/** Le fichier CHOISI : un navigateur envoie un fichier sans nom quand rien n'est choisi. */
function fichierChoisi(formData: FormData): File | null {
  const v = formData.get("fichier");
  return typeof v === "object" && v !== null && "arrayBuffer" in v && v.name !== "" ? v : null;
}

/** Formulaire « Ajouter le document » : un lien OU un fichier. */
export async function ajouterDocumentFormAction(formData: FormData): Promise<void> {
  const { userId } = await exigerAccesEchanges();
  const v = ajoutSchema.parse({
    clientId: texte(formData, "clientId"),
    projetId: texte(formData, "projetId"),
    cote: texte(formData, "cote") || "envoye_au_client",
    nature: texte(formData, "nature") || "deviner",
    titre: texte(formData, "titre"),
    envoyeLe: texte(formData, "envoyeLe"),
    lien: texte(formData, "lien"),
  });
  const fichier = fichierChoisi(formData);
  const lien = v.lien.trim();
  const commun = {
    clientId: v.clientId,
    projetId: v.projetId,
    cote: v.cote,
    nature: v.nature === "deviner" ? null : v.nature,
    titre: v.titre,
    envoyeLe: v.envoyeLe || null,
    parAdminId: userId,
  };

  let ajoute: { id: string };
  try {
    if (lien !== "" && fichier !== null) throw new ErreurDocument(MESSAGES_DOCUMENT.lienEtFichier);
    if (lien === "" && fichier === null)
      throw new ErreurDocument(MESSAGES_DOCUMENT.niLienNiFichier);
    if (fichier !== null) {
      // La taille annoncée, AVANT de lire : un fichier trop gros n'est pas chargé.
      verifierTailleAnnoncee(fichier.size);
      const octets = new Uint8Array(await fichier.arrayBuffer());
      ajoute = await ajouterFichier(prisma, { ...commun, nom: fichier.name, octets }, (o) =>
        analyserOctets(o, DELAI_ANTIVIRUS_MS),
      );
    } else {
      ajoute = await ajouterLien(prisma, { ...commun, lien });
    }
  } catch (e) {
    let message: string;
    if (e instanceof ErreurDocument) {
      if (e.signature !== undefined) {
        Sentry.captureMessage("documents-projet : fichier infecté refusé à l'ajout", {
          level: "warning",
          tags: { service: "documents-projet" },
          extra: { signature: e.signature, projetId: v.projetId },
        });
      }
      message = e.message;
    } else {
      const generique = messageAffichable(e);
      message = generique === "Demande incomplète." ? generique : MESSAGES_DOCUMENT.echecImprevu;
    }
    redirect(retour(v.clientId, v.projetId, "erreur", message));
  }
  revalidatePath(pageDuProjet(v.clientId, v.projetId));
  redirect(retour(v.clientId, v.projetId, "message", `ajoute:${ajoute.id}`));
}

async function geste(
  formData: FormData,
  userId: string,
  faire: typeof archiver,
  succes: "archive" | "reaffiche",
  echec: string,
): Promise<void> {
  const t = tripletSchema.parse({
    id: texte(formData, "id"),
    clientId: texte(formData, "clientId"),
    projetId: texte(formData, "projetId"),
  });
  let erreur: string | null = null;
  try {
    await faire(prisma, { ...t, parAdminId: userId });
  } catch (e) {
    if (e instanceof ErreurDocument) {
      erreur = e.message;
    } else {
      messageAffichable(e); // journal serveur ; jamais le texte technique dans l'URL
      erreur = echec;
    }
  }
  revalidatePath(pageDuProjet(t.clientId, t.projetId));
  if (erreur !== null) redirect(retour(t.clientId, t.projetId, "erreur", erreur));
  redirect(retour(t.clientId, t.projetId, "message", `${succes}:${t.id}`));
}

/** « Archiver » : masqué de la liste, jamais détruit. */
export async function archiverDocumentFormAction(formData: FormData): Promise<void> {
  const { userId } = await exigerAccesEchanges();
  await geste(
    formData,
    userId,
    archiver,
    "archive",
    "Ce document n'a pas pu être archivé. Rechargez la page puis réessayez.",
  );
}

/** « Réafficher » (et « Annuler » juste après un archivage). */
export async function reafficherDocumentFormAction(formData: FormData): Promise<void> {
  const { userId } = await exigerAccesEchanges();
  await geste(
    formData,
    userId,
    reafficher,
    "reaffiche",
    "Ce document n'a pas pu être réaffiché. Rechargez la page puis réessayez.",
  );
}
