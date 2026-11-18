#!/usr/bin/env tsx
/**
 * Régularise une fiche dont « Modifier la fiche » a créé une DEUXIÈME personne
 * en corrigeant le nom du contact principal (et vidé le téléphone de la copie).
 *
 * ⚠️ ÉCRIT, JAMAIS EXÉCUTÉ par la PR qui l'ajoute : un humain le lance, après
 * relecture, sur une fiche identifiée.
 *
 * Usage :
 *   pnpm exec tsx scripts/qualiopi/regulariser-contact-en-double.ts \
 *     --client AXI-CLI-NNN --garder <id personne d'origine> --doublon <id doublon>
 *     [--admin <id administrateur>]                 # essai à blanc : affiche seulement
 *   … --executer                                    # écriture réelle
 *
 * Ce que fait `--executer`, dans UNE transaction :
 *   (a) `definirContactFacturation` avec l'adresse de la personne gardée, le nom
 *       et la fonction saisis sur le doublon, et le téléphone actuel de la fiche
 *       (s'il existe) : la personne d'origine redevient contact de facturation,
 *       renommée, et la copie de la fiche redevient cohérente ;
 *   (b) le doublon est GARDÉ (ni suppression ni départ) ;
 *   (c) une note datée « Doublon créé par Modifier la fiche, régularisé » ;
 *   (d) un journal `dossier_client.contact_regularise`, identifiants seulement.
 *
 * Refuse si les deux personnes ne sont pas sur la fiche indiquée, si elles sont
 * identiques, ou si la personne gardée n'a aucune adresse. Sortie : identifiants
 * et nombres, jamais un nom ni une adresse.
 */

import type { Prisma } from "../../prisma/generated/client";
import { definirContactFacturation } from "@/server/qualiopi/crm/contact-facturation";

export const TEXTE_NOTE = "Doublon créé par Modifier la fiche, régularisé";
export const ACTION_JOURNAL = "dossier_client.contact_regularise";

export interface ArgsRegularisation {
  readonly client: string;
  readonly garder: string;
  readonly doublon: string;
  readonly parAdminId?: string | null;
}

interface PersonneLue {
  id: string;
  clientId: string;
  nom: string;
  fonction: string | null;
  adresses: Array<{ email: string }>;
}

/** Ce dont le script a besoin de la base — rien de plus. */
export interface BaseRegularisation {
  client: {
    findUnique(args: {
      where: { numero: string };
      select: { id: true; contactEmail: true; contactTelephone: true };
    }): Promise<{
      id: string;
      contactEmail: string | null;
      contactTelephone: string | null;
    } | null>;
  };
  clientContact: {
    findUnique(args: {
      where: { id: string };
      select: {
        id: true;
        clientId: true;
        nom: true;
        fonction: true;
        adresses: { select: { email: true }; orderBy: { ajouteeLe: "asc" } };
      };
    }): Promise<PersonneLue | null>;
  };
  $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
}

export interface BilanRegularisation {
  readonly executee: boolean;
  readonly clientId: string;
  readonly gardeeId: string;
  readonly doublonId: string;
  /** La fiche porte un téléphone à reporter sur la personne gardée. */
  readonly telephoneReporte: boolean;
}

export class ErreurRegularisation extends Error {}

export async function regulariserContactEnDouble(
  db: BaseRegularisation,
  args: ArgsRegularisation,
  options: { readonly executer: boolean; readonly journal?: (ligne: string) => void },
): Promise<BilanRegularisation> {
  const dire = options.journal ?? (() => undefined);
  const fiche = await db.client.findUnique({
    where: { numero: args.client },
    select: { id: true, contactEmail: true, contactTelephone: true },
  });
  if (fiche === null) throw new ErreurRegularisation("fiche introuvable");
  if (args.garder === args.doublon) {
    throw new ErreurRegularisation("la personne gardée et le doublon sont la même personne");
  }
  const lire = (id: string) =>
    db.clientContact.findUnique({
      where: { id },
      select: {
        id: true,
        clientId: true,
        nom: true,
        fonction: true,
        adresses: { select: { email: true }, orderBy: { ajouteeLe: "asc" } },
      },
    });
  const [gardee, doublon] = await Promise.all([lire(args.garder), lire(args.doublon)]);
  if (gardee === null || doublon === null) throw new ErreurRegularisation("personne introuvable");
  if (gardee.clientId !== fiche.id || doublon.clientId !== fiche.id) {
    throw new ErreurRegularisation("les deux personnes ne sont pas sur la même fiche");
  }
  const adresse =
    gardee.adresses.find((a) => a.email === fiche.contactEmail)?.email ?? gardee.adresses[0]?.email;
  if (adresse === undefined) {
    throw new ErreurRegularisation("la personne gardée n'a aucune adresse : rien à rattacher");
  }
  const telephone = fiche.contactTelephone;
  const bilan: BilanRegularisation = {
    executee: options.executer,
    clientId: fiche.id,
    gardeeId: gardee.id,
    doublonId: doublon.id,
    telephoneReporte: telephone !== null,
  };

  dire(`fiche ${fiche.id}`);
  dire(`personne gardée ${gardee.id} : redevient contact de facturation, renommée`);
  dire(`doublon ${doublon.id} : GARDÉ (ni suppression ni départ), n'est plus de facturation`);
  dire(`téléphone de la fiche à reporter : ${telephone !== null ? "oui" : "non"}`);
  dire(`note datée « ${TEXTE_NOTE} » + journal ${ACTION_JOURNAL}`);
  if (!options.executer) return bilan;

  await db.$transaction(async (tx) => {
    const r = await definirContactFacturation(tx, {
      clientId: fiche.id,
      email: adresse,
      nom: doublon.nom,
      // Fonction vide sur le doublon : on ne remplace pas celle de la personne gardée.
      ...(doublon.fonction !== null && doublon.fonction !== ""
        ? { fonction: doublon.fonction }
        : {}),
      // La fiche n'a plus de téléphone : on ne l'efface pas sur la personne gardée.
      ...(telephone !== null ? { telephone } : {}),
      parAdminId: args.parAdminId ?? null,
    });
    // Garde-fou : si la fonction unique a choisi une autre personne, TOUT est annulé.
    if (r.contactId !== gardee.id || r.cree) {
      throw new ErreurRegularisation(
        "la fonction unique n'a pas rattaché la personne gardée : transaction annulée",
      );
    }
    const { chiffrerParole } = await import("@/lib/chiffrer-parole");
    await tx.clientNote.create({
      data: {
        clientId: fiche.id,
        contenuChiffre: chiffrerParole(`${new Date().toISOString().slice(0, 10)} — ${TEXTE_NOTE}`),
        auteurLabel: "Régularisation",
      },
    });
    await tx.activityLog.create({
      data: {
        adminUserId: args.parAdminId ?? null,
        action: ACTION_JOURNAL,
        targetType: "ClientContact",
        targetId: gardee.id,
        // Identifiants seulement : ni nom, ni adresse.
        changes: { clientId: fiche.id, gardeeId: gardee.id, doublonId: doublon.id },
      },
    });
  });
  return bilan;
}

function valeur(argv: readonly string[], drapeau: string): string | undefined {
  const i = argv.indexOf(drapeau);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const client = valeur(argv, "--client");
  const garder = valeur(argv, "--garder");
  const doublon = valeur(argv, "--doublon");
  if (!client || !garder || !doublon) {
    throw new Error(
      "usage : --client <numero> --garder <id> --doublon <id> [--admin <id>] [--executer]",
    );
  }
  const executer = argv.includes("--executer");
  const parAdminId = valeur(argv, "--admin") ?? null;
  const { prisma } = await import("@/lib/prisma");
  console.log(
    executer
      ? "== RÉGULARISATION — écriture RÉELLE =="
      : "== RÉGULARISATION — à blanc (aucune écriture ; --executer pour écrire) ==",
  );
  await regulariserContactEnDouble(
    prisma as unknown as BaseRegularisation,
    { client, garder, doublon, parAdminId },
    { executer, journal: (l) => console.log(l) },
  );
  await prisma.$disconnect();
}

const lanceDirectement = /regulariser-contact-en-double\.[cm]?[jt]s$/.test(process.argv[1] ?? "");
if (lanceDirectement) {
  main().catch((err: unknown) => {
    // Le message d'une erreur inattendue peut porter un nom ou une adresse
    // (erreur de base, de chiffrement) : seul le nom de l'erreur est affiché.
    console.error(
      "[regulariser-contact] échec :",
      err instanceof ErreurRegularisation
        ? err.message
        : err instanceof Error
          ? err.name
          : "erreur inconnue",
    );
    process.exit(1);
  });
}
