/**
 * LECTURE du dossier d'un client pour la synchro (console ↔ CRM, 25/10/2026).
 * Module de lecture seul, SANS file d'attente ni émission : le retour du CRM
 * (`retour-dossier.ts`) l'importe sans tirer BullMQ dans sa route.
 *
 * Colonnes en clair seulement. Les réponses des questionnaires ne sont ni
 * sélectionnées ni déchiffrées : on ne compte que des lignes.
 */

import { adminPath } from "@/lib/admin-path";
import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { SITE_URL } from "@/lib/site-url";
import { sirenTransmis } from "@/server/partners-sync/producteurs/client";

import type { ContactPourCrm, EntreeInstantaneCrm } from "./instantane-dossier";

function plusRecent(dates: ReadonlyArray<Date | null | undefined>, repli: Date): Date {
  let max = 0;
  for (const d of dates) if (d instanceof Date && d.getTime() > max) max = d.getTime();
  return new Date(max === 0 ? repli.getTime() : Math.min(max, repli.getTime()));
}

/** Lit un client et en fait l'entrée de la photo. `null` : à ne pas synchroniser. */
export async function lireEntreeDossier(
  clientId: string,
  maintenant: Date,
): Promise<{ entree: EntreeInstantaneCrm; dernierChangement: Date } | null> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      numero: true,
      type: true,
      raisonSociale: true,
      siren: true,
      siret: true,
      adresseRue: true,
      adresseCodePostal: true,
      adresseVille: true,
      effectif: true,
      updatedAt: true,
      contacts: {
        select: {
          id: true,
          nom: true,
          fonction: true,
          telephone: true,
          statut: true,
          partiLe: true,
          updatedAt: true,
          adresses: {
            select: { email: true, nature: true, ajouteeLe: true },
            orderBy: { ajouteeLe: "asc" },
          },
        },
      },
    },
  });
  if (client === null || client.type !== "entreprise") return null;

  const [factures, questionnaires] = await Promise.all([
    prisma.factureFormation.findMany({
      where: { clientId, statut: { notIn: ["brouillon", "annulee"] }, emiseAt: { not: null } },
      select: { emiseAt: true },
    }),
    prisma.questionnaireAvantAudit.findMany({
      where: { OR: [{ clientId }, { rencontre: { clientId } }] },
      select: {
        envoyeLe: true,
        // Des dates et des modes : jamais `donnees`.
        envois: { where: { ecarteLe: null }, select: { mode: true, recuLe: true } },
      },
    }),
  ]);

  const envoyes = questionnaires.flatMap((q) => (q.envoyeLe ? [q.envoyeLe] : []));
  const recus = questionnaires.flatMap((q) => q.envois.map((e) => e.recuLe));
  const equipe = questionnaires.reduce(
    (n, q) => n + q.envois.filter((e) => e.mode === "emp").length,
    0,
  );

  const contacts: ContactPourCrm[] = client.contacts.map((c) => {
    const choisie = c.adresses.find((a) => a.nature === "pro") ?? c.adresses[0] ?? null;
    const email = choisie?.email ?? null;
    return {
      id: c.id,
      nom: c.nom,
      fonction: c.fonction,
      telephone: c.telephone,
      email,
      emailHash: email === null ? null : hashEmailForLookup(email),
      parti: c.statut !== "actif" || c.partiLe !== null,
    };
  });

  const entree: EntreeInstantaneCrm = {
    clientId: client.id,
    numero: client.numero,
    raisonSociale: client.raisonSociale,
    siren: sirenTransmis({ siren: client.siren, siret: client.siret }).siren,
    adresseRue: client.adresseRue,
    adresseCodePostal: client.adresseCodePostal,
    adresseVille: client.adresseVille,
    telephone: null,
    effectif: client.effectif,
    factureEmise: factures.length > 0,
    urlConsole: `${SITE_URL}${adminPath("fr", `qualiopi/clients/${client.id}`)}`,
    questionnaire:
      questionnaires.length === 0
        ? null
        : {
            envoyeLe: envoyes.length
              ? new Date(Math.max(...envoyes.map((d) => d.getTime())))
              : null,
            recuLe: recus.length ? new Date(Math.max(...recus.map((d) => d.getTime()))) : null,
            nbReponsesEquipe: equipe,
          },
    contacts,
  };

  const dernierChangement = plusRecent(
    [
      client.updatedAt,
      ...client.contacts.map((c) => c.updatedAt),
      ...factures.map((f) => f.emiseAt),
      ...envoyes,
      ...recus,
    ],
    maintenant,
  );
  return { entree, dernierChangement };
}
