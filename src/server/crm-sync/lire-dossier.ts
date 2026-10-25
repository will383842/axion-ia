/**
 * LECTURE du dossier d'un client pour la synchro (console ↔ CRM, 25/10/2026).
 * Module de lecture seul, SANS file d'attente ni émission : le retour du CRM
 * (`retour-dossier.ts`) l'importe sans tirer BullMQ dans sa route.
 *
 * Colonnes en clair seulement. Les réponses des questionnaires ne sont ni
 * sélectionnées ni déchiffrées : on ne compte que des lignes.
 */

import { prisma } from "@/lib/prisma";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { sirenTransmis } from "@/server/partners-sync/producteurs/client";

import { adressesOpposees } from "./oppositions-par-lot";
import type { ContactPourCrm, EntreeInstantaneCrm } from "./instantane-dossier";

function plusRecent(dates: ReadonlyArray<Date | null | undefined>, repli: Date): Date {
  let max = 0;
  for (const d of dates) if (d instanceof Date && d.getTime() > max) max = d.getTime();
  return new Date(max === 0 ? repli.getTime() : Math.min(max, repli.getTime()));
}

/**
 * Case « Facture établie hors console » (`client_factures_hors_console`, PR
 * #1684). La table peut ne pas exister encore (la migration atterrit avant le
 * code, mais pas forcément avant celui-ci) : absente ⇒ « non », jamais une
 * erreur. Lecture seule, une colonne (l'existence de la ligne).
 */
async function factureHorsConsole(clientId: string): Promise<boolean> {
  const lignes = await prisma.$queryRaw<Array<{ ok: boolean }>>`
    SELECT CASE WHEN to_regclass('client_factures_hors_console') IS NULL THEN false
           ELSE EXISTS (SELECT 1 FROM client_factures_hors_console WHERE client_id = ${clientId}::uuid)
           END AS ok`;
  return lignes[0]?.ok === true;
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
          origine: true,
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

  const [factures, horsConsole, questionnaires] = await Promise.all([
    prisma.factureFormation.findMany({
      where: { clientId, statut: { notIn: ["brouillon", "annulee"] }, emiseAt: { not: null } },
      select: { emiseAt: true },
    }),
    factureHorsConsole(clientId),
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

  // L'opposition gagne : registre `email_oppositions`, sur TOUTES les adresses de
  // chaque contact (une personne opposée l'est quelle que soit l'adresse).
  const opposees = await adressesOpposees(
    client.contacts.flatMap((c) => c.adresses.map((a) => a.email)),
  );

  const contacts: ContactPourCrm[] = client.contacts.map((c) => {
    // Pro d'abord ; une adresse non pro est repérée comme telle et ne part pas.
    const choisie = c.adresses.find((a) => a.nature === "pro") ?? c.adresses[0] ?? null;
    const email = choisie?.email ?? null;
    return {
      id: c.id,
      nom: c.nom,
      fonction: c.fonction,
      telephone: c.telephone,
      email,
      emailType: choisie === null ? null : choisie.nature === "pro" ? "pro" : "perso",
      origine: c.origine,
      emailHash: email === null ? null : hashEmailForLookup(email),
      oppose: c.adresses.some((a) => opposees.has(a.email.trim().toLowerCase())),
      parti: c.statut !== "actif" || c.partiLe !== null,
    };
  });

  const entree: EntreeInstantaneCrm = {
    clientId: client.id,
    numero: client.numero,
    type: "entreprise",
    raisonSociale: client.raisonSociale,
    siren: sirenTransmis({ siren: client.siren, siret: client.siret }).siren,
    adresseRue: client.adresseRue,
    adresseCodePostal: client.adresseCodePostal,
    adresseVille: client.adresseVille,
    telephone: null,
    effectif: client.effectif,
    factureEmise: factures.length > 0,
    factureHorsConsole: horsConsole,
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
