/**
 * La demande du guide vient-elle de la page « Recevoir le guide » — et la personne a-t-elle dit STOP ?
 *
 * Lecteur UNIQUE, partagé par le rattrapage horaire (worker) et l'envoi à la main de la console : ni l'un ni
 * l'autre ne doit envoyer à une personne dont la conversation a été arrêtée (MG-STOP01).
 *
 * « Écartée » = au moins un contact lié à la demande (`guide_request_id`) est à `merci_statut` écarté, OU la
 * référence de conversation d'un contact lié figure dans `oppositions_conv_ref`. Aucune colonne ajoutée :
 * la mise à l'écart est la valeur `ecarte` déjà utilisée par le STOP et l'effacement.
 *
 * 🔴 FERMÉ : une lecture en erreur de la table des marques — table absente (P2021) comprise — vaut « écartée ».
 * Seule l'absence de la table des CONTACTS (fenêtre worker/app, avant la migration de la page) vaut « pas de
 * page » : sans contact, il n'y a pas de STOP par conversation possible. Journal : un nom d'erreur, jamais
 * d'adresse ni de référence. Aucune écriture, aucune suppression.
 */
import { prisma } from "@/lib/prisma";
import { merciEstEcarte } from "@/server/guides-reseau/merci-statut";

export interface EtatPageGuide {
  /** Une ligne `contacts_guide_reseau` est liée à la demande. */
  readonly page: boolean;
  /** STOP reçu (ou lecture impossible) : rien ne doit partir. */
  readonly ecartee: boolean;
}

function schemaAbsent(e: unknown): boolean {
  const code = typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined;
  return code === "P2021" || code === "P2022";
}

export async function etatPageGuide(demandeId: string): Promise<EtatPageGuide> {
  let contacts: Array<{ convRef: string; merciStatut: string }>;
  try {
    contacts = await prisma.contactGuideReseau.findMany({
      where: { guideRequestId: demandeId },
      select: { convRef: true, merciStatut: true },
    });
  } catch (e) {
    if (schemaAbsent(e)) return { page: false, ecartee: false };
    throw e;
  }
  if (contacts.length === 0) return { page: false, ecartee: false };
  if (contacts.some((c) => merciEstEcarte(c.merciStatut))) return { page: true, ecartee: true };
  try {
    const marque = await prisma.oppositionConvRef.findFirst({
      where: { convRef: { in: contacts.map((c) => c.convRef) } },
      select: { id: true },
    });
    return { page: true, ecartee: marque !== null };
  } catch (e) {
    console.error(
      JSON.stringify({
        event: "guide_page_marque_lecture_echec",
        erreur: e instanceof Error ? e.name : "erreur",
      }),
    );
    return { page: true, ecartee: true };
  }
}
