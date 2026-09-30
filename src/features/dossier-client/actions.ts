/**
 * Actions serveur du dossier client (chantier visio, PR 3).
 *
 * Chaque action vérifie ELLE-MÊME la session : une Server Action s'appelle
 * directement, masquer un bouton n'est pas interdire.
 *   · Les actions qui touchent au dossier (personnes, projets) exigent
 *     `peutVoirLesEchanges` (décision A2) ;
 *   · « c'est peut-être déjà… » et « C'est elle » (SIREN de l'annuaire)
 *     servent la fiche elle-même : elles suivent la garde d'écriture de la
 *     console (`requireAdminWrite`), et ne rendent que numéro et raison sociale.
 *
 * ⚠️ Module `"use server"` : il n'exporte QUE des fonctions asynchrones (garde
 * `tests/unit/ci/un-fichier-use-server-n-exporte-que-des-fonctions.spec.ts`).
 */

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { adminPath } from "@/lib/admin-path";
import { checkSiretFormat, resoudreSiren, sirenDuSiret } from "@/lib/siret";
import { requireAdminWrite, logQualiopiActivity } from "@/server/actions/qualiopi/_guards";
import {
  ajouterPersonneAFiche,
  chargerFichesCandidates,
  libellerFichesProches,
  preparerCandidat,
  trouverFichesProches,
  type FicheProcheLibellee,
} from "@/server/qualiopi/crm/porte-client";
import { exigerAccesEchanges } from "@/features/dossier-client/acces";
import { creerProjet, ErreurCreationProjet } from "@/features/dossier-client/creer-projet";
import { ErreurTrancher, garderCetteValeur } from "@/features/dossier-client/trancher";
import { updateClientAction } from "@/server/actions/qualiopi/clients";

const candidatSchema = z.object({
  type: z.enum(["entreprise", "particulier"]).optional(),
  raisonSociale: z.string().max(250),
  siren: z.string().max(20).optional(),
  siret: z.string().max(20).optional(),
  email: z.string().max(320).optional(),
  ville: z.string().max(120).optional(),
  codePostal: z.string().max(12).optional(),
});

/**
 * « C'est peut-être déjà… » : les fiches qui ressemblent à la saisie en cours.
 * Appelée par le formulaire pendant la frappe (délai 300 ms). Le serveur
 * RECALCULE tout à la création : cette liste n'est qu'une aide.
 */
export async function fichesProchesAction(
  saisie: z.input<typeof candidatSchema>,
): Promise<FicheProcheLibellee[]> {
  await requireAdminWrite();
  const v = candidatSchema.safeParse(saisie);
  if (!v.success) return [];
  // La même dérivation que la création (`src/lib/siret.ts`, source unique) :
  // un SIRET encore incomplet ou à la clé fausse ne propose rien.
  const siretSaisi = (v.data.siret ?? "").trim();
  const siretValide = siretSaisi !== "" && checkSiretFormat(siretSaisi).ok ? siretSaisi : null;
  const resolu = resoudreSiren(siretValide, v.data.siren);
  const siren = resolu.ok
    ? (resolu.siren ?? null)
    : siretValide !== null
      ? sirenDuSiret(siretValide)
      : null;
  const candidat = preparerCandidat({
    ...(v.data.type !== undefined ? { type: v.data.type } : {}),
    raisonSociale: v.data.raisonSociale,
    siren,
    emails: v.data.email && v.data.email.includes("@") ? [v.data.email] : [],
    ville: v.data.ville ?? null,
    codePostal: v.data.codePostal ?? null,
  });
  return libellerFichesProches(
    trouverFichesProches(candidat, await chargerFichesCandidates(prisma, candidat)).slice(0, 5),
  );
}

/**
 * « C'est elle » : Will confirme d'un clic le SIREN proposé par l'annuaire
 * (fiche « SIREN à compléter »). L'écriture passe par `updateClientAction`, qui
 * garde l'écriture et compare le SIREN au SIRET déjà saisi. Rien n'est écrit
 * sans ce clic.
 */
export async function confirmerSirenFormAction(formData: FormData): Promise<void> {
  await requireAdminWrite();
  const clientId = z
    .string()
    .uuid()
    .parse(String(formData.get("clientId") ?? ""));
  const siren = String(formData.get("siren") ?? "").replace(/\D/g, "");
  const base = adminPath("fr", `qualiopi/clients/${clientId}`);
  const r = await updateClientAction({ id: clientId, siren });
  if ("error" in r) {
    redirect(`${base}?onglet=facturation&erreur=${encodeURIComponent(r.error)}`);
  }
  revalidatePath(base);
  redirect(base);
}

const personneSchema = z.object({
  clientId: z.string().uuid(),
  nom: z.string().max(200).optional(),
  email: z.string().email().optional().or(z.literal("")),
  telephone: z.string().max(40).optional(),
  fonction: z.string().max(150).optional(),
});

/** « Ajouter cette personne à la fiche » — plutôt qu'une seconde fiche. */
export async function ajouterPersonneALaFicheAction(
  saisie: z.input<typeof personneSchema>,
): Promise<{ ok: true; cree: boolean } | { ok: false; erreur: string }> {
  let userId: string;
  let role: string;
  try {
    ({ userId, role } = await exigerAccesEchanges());
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : "Accès refusé." };
  }
  const v = personneSchema.safeParse(saisie);
  if (!v.success) return { ok: false, erreur: "Nom ou adresse e-mail invalide." };
  if (!v.data.nom?.trim() && !v.data.email?.trim()) {
    return { ok: false, erreur: "Indiquez au moins un nom ou une adresse e-mail." };
  }
  const r = await ajouterPersonneAFiche(
    prisma,
    v.data.clientId,
    {
      ...(v.data.nom ? { nom: v.data.nom } : {}),
      ...(v.data.email ? { email: v.data.email } : {}),
      ...(v.data.telephone ? { telephone: v.data.telephone } : {}),
      ...(v.data.fonction ? { fonction: v.data.fonction } : {}),
    },
    userId,
  );
  // Registre (art. 30) : l'ajout d'une personne au dossier est tracé — sans
  // son nom ni son adresse, seulement la fiche et la personne concernées.
  if (r.cree) {
    await logQualiopiActivity({
      action: "dossier_client.personne_ajoutee",
      targetType: "ClientContact",
      targetId: r.contactId,
      changes: { clientId: v.data.clientId },
      session: { userId, role },
    });
  }
  revalidatePath(adminPath("fr", `qualiopi/clients/${v.data.clientId}`));
  return { ok: true, cree: r.cree };
}

/** Formulaire « Ajouter une personne » de l'onglet Personnes (sans JavaScript). */
export async function ajouterPersonneFormAction(formData: FormData): Promise<void> {
  const clientId = String(formData.get("clientId") ?? "");
  const r = await ajouterPersonneALaFicheAction({
    clientId,
    nom: String(formData.get("nom") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    telephone: String(formData.get("telephone") ?? "").trim(),
    fonction: String(formData.get("fonction") ?? "").trim(),
  });
  const base = adminPath("fr", `qualiopi/clients/${clientId}`);
  if (!r.ok) redirect(`${base}?onglet=personnes&erreur=${encodeURIComponent(r.erreur)}`);
  redirect(`${base}?onglet=personnes`);
}

/**
 * Case « s'oppose au traitement par IA » (art. 21) : enregistrement et dictée
 * seront refusés pour cette personne. Réversible.
 */
export async function basculerOppositionIaFormAction(formData: FormData): Promise<void> {
  const { userId, role } = await exigerAccesEchanges();
  const contactId = z
    .string()
    .uuid()
    .parse(String(formData.get("contactId") ?? ""));
  const oppose = String(formData.get("oppose") ?? "") === "oui";
  const contact = await prisma.clientContact.update({
    where: { id: contactId },
    data: { oppositionIaLe: oppose ? new Date() : null },
    select: { clientId: true },
  });
  await logQualiopiActivity({
    action: oppose ? "dossier_client.opposition_ia" : "dossier_client.opposition_ia_levee",
    targetType: "ClientContact",
    targetId: contactId,
    session: { userId, role },
  });
  redirect(`${adminPath("fr", `qualiopi/clients/${contact.clientId}`)}?onglet=personnes`);
}

/** Formulaire « Nouveau projet » (onglet Projets) : crée, range les faits cochés, ouvre le projet. */
export async function creerProjetFormAction(formData: FormData): Promise<void> {
  const { userId } = await exigerAccesEchanges();
  const clientId = z
    .string()
    .uuid()
    .parse(String(formData.get("clientId") ?? ""));
  const base = adminPath("fr", `qualiopi/clients/${clientId}`);
  const faits = formData
    .getAll("faitARanger")
    .map((v) => String(v))
    .filter((v) => z.string().uuid().safeParse(v).success);
  let cree: { id: string; numero: string };
  try {
    cree = await creerProjet(prisma, {
      clientId,
      titre: String(formData.get("titre") ?? ""),
      faitsARangerIds: faits,
      parAdminId: userId,
    });
  } catch (e) {
    const message =
      e instanceof ErreurCreationProjet ? e.message : "Le projet n'a pas pu être créé.";
    redirect(`${base}?onglet=projets&erreur=${encodeURIComponent(message)}`);
  }
  revalidatePath(base);
  redirect(`${base}/projets/${cree.id}`);
}

/** Pages d'où « Garder cette valeur » peut être cliqué : la fiche (Synthèse) et « Préparer ». */
const RETOUR_TRANCHER =
  /^\/[a-z]{2}\/[\w-]+\/qualiopi\/clients\/[0-9a-f-]{36}(\/preparer(\?projet=[0-9a-f-]{36})?)?$/;

/**
 * « Garder cette valeur » (V1-02) : une information « à trancher » prend la
 * valeur choisie ; les autres sont marquées remplacées et journalisées.
 */
export async function garderCetteValeurFormAction(formData: FormData): Promise<void> {
  const { userId } = await exigerAccesEchanges();
  const retourLu = String(formData.get("retour") ?? "");
  const retour = RETOUR_TRANCHER.test(retourLu) ? retourLu : adminPath("fr", "qualiopi/clients");
  let erreur: string | null = null;
  try {
    await garderCetteValeur(prisma, {
      faitId: z
        .string()
        .uuid()
        .parse(String(formData.get("faitId") ?? "")),
      parAdminId: userId,
    });
  } catch (e) {
    erreur = e instanceof ErreurTrancher ? e.message : "La valeur n'a pas pu être gardée.";
  }
  revalidatePath(retour.split("?")[0] ?? retour);
  if (erreur !== null) {
    redirect(`${retour}${retour.includes("?") ? "&" : "?"}erreur=${encodeURIComponent(erreur)}`);
  }
  redirect(retour);
}
