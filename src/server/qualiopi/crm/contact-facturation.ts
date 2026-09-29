/**
 * Le contact de facturation d'une fiche — SEULE fonction qui écrit
 * `Client.contactNom`, `contactEmail`, `contactTelephone` et `contactFonction`
 * (chantier visio, plan PA-1, ADR 0053).
 *
 * ## Pourquoi une seule porte
 *
 * Depuis le dossier client, une personne est un `ClientContact` (avec ses
 * adresses dans `ClientContactAdresse`). Les quatre colonnes `contact*` de
 * `clients` restent lues partout — devis, factures, relances, lien de
 * signature — et deviennent la COPIE du contact de facturation. Deux écrivains
 * produiraient deux vérités : la fiche enverrait le lien de signature à une
 * adresse que la liste des personnes ne connaît pas. D'où cette fonction, seule
 * autorisée à écrire ces colonnes (garde
 * `tests/unit/ci/personne-n-ecrit-contact-email-hors-de-la-fonction-unique.spec.ts`),
 * et qui écrit la personne ET la copie dans la même transaction.
 *
 * ## Contrat des champs
 *
 *   · `undefined` = ne rien changer ;
 *   · `null`      = effacer (l'adresse effacée est retirée de la personne) ;
 *   · une valeur  = l'écrire.
 *
 * ## Qui devient le contact de facturation
 *
 *   1. la personne de la fiche qui a DÉJÀ cette adresse (une DAF connue ne se
 *      duplique pas) ;
 *   2. sinon le contact de facturation actuel, si le nom est le même (ou non
 *      transmis) : on lui ajoute l'adresse ;
 *   3. sinon une nouvelle personne, et l'ancien contact garde sa fiche de
 *      personne (il n'est plus « de facturation », il n'est pas supprimé).
 *
 * Idempotente : un second appel avec les mêmes valeurs ne crée rien.
 *
 * ⚠️ Module NEUTRE (ni `server-only`, ni Next) : il reçoit sa transaction, il
 * est appelé par la porte de création, par `updateClientAction`, et par le
 * script de reprise des contacts.
 */

import type { ContactOrigine, Prisma } from "../../../../prisma/generated/client";
import { natureAdresse } from "@/lib/email/nature-adresse";
import { hashEmailForLookup, normalizeEmail } from "@/lib/security/email-hash";
import { normaliserNom } from "@/server/qualiopi/crm/normaliser-nom";

/** Nom posé quand seule une adresse est connue : `ClientContact.nom` est obligatoire. */
export const NOM_A_COMPLETER = "Nom à compléter";

export interface ContactFacturationEntree {
  readonly clientId: string;
  readonly nom?: string | null;
  readonly email?: string | null;
  readonly telephone?: string | null;
  readonly fonction?: string | null;
  /** Origine d'une personne CRÉÉE par cet appel. Défaut : `saisie`. */
  readonly origine?: ContactOrigine;
  readonly parAdminId?: string | null;
}

export interface ContactFacturationResultat {
  /** La personne de facturation, ou `null` s'il n'y a rien à écrire (ni nom ni adresse). */
  readonly contactId: string | null;
  /** Une personne a été créée. */
  readonly cree: boolean;
}

function texteOuNull(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/** Même personne ? Comparaison sur le nom normalisé (casse, accents, espaces). */
function memeNom(a: string, b: string): boolean {
  const na = normaliserNom(a);
  return na !== "" && na === normaliserNom(b);
}

/**
 * Définit (ou met à jour) le contact de facturation d'une fiche, et recopie ses
 * coordonnées dans `Client.contact*`. À appeler DANS une transaction.
 */
export async function definirContactFacturation(
  tx: Prisma.TransactionClient,
  entree: ContactFacturationEntree,
): Promise<ContactFacturationResultat> {
  const nom = texteOuNull(entree.nom);
  const telephone = texteOuNull(entree.telephone);
  const fonction = texteOuNull(entree.fonction);
  const emailBrut = texteOuNull(entree.email);
  const email = typeof emailBrut === "string" ? normalizeEmail(emailBrut) : emailBrut;
  const emailHash = typeof email === "string" ? hashEmailForLookup(email) : null;

  const fiche = await tx.client.findUnique({
    where: { id: entree.clientId },
    select: {
      contactNom: true,
      contactEmail: true,
      contactTelephone: true,
      contactFonction: true,
    },
  });
  if (fiche === null) throw new Error("contact de facturation : fiche client introuvable");

  const actuel = await tx.clientContact.findFirst({
    where: { clientId: entree.clientId, estContactFacturation: true },
    select: { id: true, nom: true, telephone: true, fonction: true },
  });

  // 1. La personne qui porte déjà cette adresse sur CETTE fiche.
  const parAdresse =
    emailHash !== null
      ? await tx.clientContact.findFirst({
          where: { clientId: entree.clientId, adresses: { some: { emailHash } } },
          select: { id: true, nom: true, telephone: true, fonction: true },
        })
      : null;

  // 2. Le contact actuel, si c'est la même personne (ou si le nom n'est pas transmis).
  const actuelConvient =
    actuel !== null &&
    (nom === undefined ||
      nom === null ||
      actuel.nom === NOM_A_COMPLETER ||
      memeNom(nom, actuel.nom));
  let cible = parAdresse ?? (actuelConvient ? actuel : null);

  // Rien à écrire : ni personne connue, ni nom, ni adresse.
  const nomACreer = typeof nom === "string" ? nom : (fiche.contactNom ?? null);
  const adresseACreer = typeof email === "string" ? email : null;
  if (cible === null && nomACreer === null && adresseACreer === null) {
    // Aucune personne à créer (fiche d'avant le dossier client, pas encore
    // reprise) : on applique quand même ce qui est demandé sur la copie —
    // effacer une adresse fautive doit toujours être possible.
    const copie = {
      ...(email !== undefined ? { contactEmail: email } : {}),
      ...(nom === null ? { contactNom: null } : {}),
      ...(telephone !== undefined ? { contactTelephone: telephone } : {}),
      ...(fonction !== undefined ? { contactFonction: fonction } : {}),
    };
    if (Object.keys(copie).length > 0) {
      await tx.client.update({ where: { id: entree.clientId }, data: copie });
    }
    return { contactId: null, cree: false };
  }

  // Un seul contact de facturation par fiche (index partiel) : on retire
  // d'abord la marque de l'ancien, AVANT de la poser sur le nouveau.
  if (actuel !== null && (cible === null || cible.id !== actuel.id)) {
    await tx.clientContact.update({
      where: { id: actuel.id },
      data: { estContactFacturation: false },
    });
  }

  let cree = false;
  if (cible === null) {
    cible = await tx.clientContact.create({
      data: {
        clientId: entree.clientId,
        nom: nomACreer ?? NOM_A_COMPLETER,
        // Première personne de la fiche : elle hérite des coordonnées déjà
        // saisies sur la fiche. Une personne qui en REMPLACE une autre n'hérite
        // de rien (la fonction de l'ancienne DAF n'est pas celle du nouveau).
        fonction:
          fonction !== undefined ? fonction : actuel === null ? fiche.contactFonction : null,
        telephone:
          telephone !== undefined ? telephone : actuel === null ? fiche.contactTelephone : null,
        origine: entree.origine ?? "saisie",
        estContactFacturation: true,
        creeParId: entree.parAdminId ?? null,
      },
      select: { id: true, nom: true, telephone: true, fonction: true },
    });
    cree = true;
  } else {
    cible = await tx.clientContact.update({
      where: { id: cible.id },
      data: {
        estContactFacturation: true,
        ...(typeof nom === "string" && nom !== cible.nom ? { nom } : {}),
        ...(telephone !== undefined ? { telephone } : {}),
        ...(fonction !== undefined ? { fonction } : {}),
      },
      select: { id: true, nom: true, telephone: true, fonction: true },
    });
  }

  // L'adresse : ajoutée si elle manque, retirée si on l'efface.
  if (typeof email === "string" && emailHash !== null) {
    const connue = await tx.clientContactAdresse.findFirst({
      where: { contactId: cible.id, emailHash },
      select: { id: true },
    });
    if (connue === null) {
      await tx.clientContactAdresse.create({
        data: { contactId: cible.id, email, emailHash, nature: natureAdresse(email) },
      });
    }
  } else if (email === null && fiche.contactEmail) {
    const ancienne = hashEmailForLookup(fiche.contactEmail);
    if (ancienne !== null) {
      await tx.clientContactAdresse.deleteMany({
        where: { contactId: cible.id, emailHash: ancienne },
      });
    }
  }

  // La copie sur la fiche, écrite depuis la personne : jamais l'inverse.
  await tx.client.update({
    where: { id: entree.clientId },
    data: {
      contactNom: cible.nom === NOM_A_COMPLETER ? null : cible.nom,
      contactTelephone: cible.telephone,
      contactFonction: cible.fonction,
      ...(email !== undefined ? { contactEmail: email } : {}),
    },
  });

  return { contactId: cible.id, cree };
}
