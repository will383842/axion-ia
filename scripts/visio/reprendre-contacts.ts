#!/usr/bin/env tsx
/**
 * Reprise des contacts (chantier visio, PR 3) : une personne (`ClientContact`)
 * pour chaque fiche existante, tirée de `Client.contact*`.
 *
 * Depuis la PR 3, une personne est un `ClientContact` et `Client.contact*` la
 * copie du contact de facturation. Les fiches créées AVANT n'ont aucune
 * personne (1 fiche à reprendre en production le 28/09, mesuré). Ce script la
 * leur donne, par la fonction unique `definirContactFacturation`.
 *
 * Règles :
 *   · essai à blanc PAR DÉFAUT : rien n'est écrit sans `--appliquer` ;
 *   · IDEMPOTENT : seules les fiches SANS aucune personne sont reprises ; un
 *     second lancement ne crée rien ;
 *   · une fiche sans nom ni adresse de contact n'a rien à reprendre ;
 *   · aucune écriture SQL directe (Prisma seulement) ;
 *   · sortie en NOMBRES seulement : ni raison sociale, ni nom, ni adresse.
 *
 * N'importe que `src/**` : il peut être copié dans le conteneur du worker.
 *
 * Usage :
 *   pnpm exec tsx scripts/visio/reprendre-contacts.ts              # essai à blanc
 *   pnpm exec tsx scripts/visio/reprendre-contacts.ts --appliquer  # écriture réelle
 */

import type { Prisma } from "../../prisma/generated/client";
import { definirContactFacturation } from "@/server/qualiopi/crm/contact-facturation";

export interface FicheAReprendre {
  id: string;
  contactNom: string | null;
  contactEmail: string | null;
  contactTelephone: string | null;
  contactFonction: string | null;
}

/** Ce dont la reprise a besoin de la base — rien de plus. */
export interface BaseReprise {
  client: {
    findMany(args: {
      where: { contacts: { none: Record<string, never> } };
      select: {
        id: true;
        contactNom: true;
        contactEmail: true;
        contactTelephone: true;
        contactFonction: true;
      };
      orderBy: { numero: "asc" };
    }): Promise<FicheAReprendre[]>;
  };
  $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
}

export interface BilanReprise {
  /** Fiches sans aucune personne. */
  readonly sansPersonne: number;
  /** Parmi elles, fiches sans nom ni adresse : rien à reprendre. */
  readonly sansContact: number;
  /** Personnes à créer. */
  readonly aCreer: number;
  /** Personnes créées (0 en essai à blanc). */
  readonly creees: number;
}

export async function reprendreContacts(
  db: BaseReprise,
  options: { readonly appliquer: boolean },
): Promise<BilanReprise> {
  const fiches = await db.client.findMany({
    where: { contacts: { none: {} } },
    select: {
      id: true,
      contactNom: true,
      contactEmail: true,
      contactTelephone: true,
      contactFonction: true,
    },
    orderBy: { numero: "asc" },
  });

  let sansContact = 0;
  let aCreer = 0;
  let creees = 0;
  for (const f of fiches) {
    const nom = f.contactNom?.trim() ?? "";
    const email = f.contactEmail?.trim() ?? "";
    if (nom === "" && email === "") {
      sansContact += 1;
      continue;
    }
    aCreer += 1;
    if (!options.appliquer) continue;
    const r = await db.$transaction((tx) =>
      definirContactFacturation(tx, {
        clientId: f.id,
        ...(nom !== "" ? { nom } : {}),
        ...(email !== "" ? { email } : {}),
        // `undefined` : la personne CRÉÉE hérite du téléphone et de la fonction
        // de la fiche (première personne), sans rien réécrire d'autre.
        origine: "reprise_client",
        parAdminId: null,
      }),
    );
    if (r.cree) creees += 1;
  }

  return { sansPersonne: fiches.length, sansContact, aCreer, creees };
}

async function main(): Promise<void> {
  const appliquer = process.argv.includes("--appliquer");
  const { prisma } = await import("@/lib/prisma");
  console.log(
    appliquer
      ? "== REPRISE DES CONTACTS — écriture RÉELLE =="
      : "== REPRISE DES CONTACTS — essai à blanc (aucune écriture ; --appliquer pour écrire) ==",
  );
  const bilan = await reprendreContacts(prisma as unknown as BaseReprise, { appliquer });
  console.log(`fiches sans aucune personne : ${bilan.sansPersonne}`);
  console.log(`  sans nom ni adresse       : ${bilan.sansContact}   ← rien à reprendre`);
  console.log(`personnes à créer           : ${bilan.aCreer}`);
  console.log(`personnes créées            : ${bilan.creees}`);
  await prisma.$disconnect();
}

const lanceDirectement = /reprendre-contacts\.[cm]?[jt]s$/.test(process.argv[1] ?? "");
if (lanceDirectement) {
  main().catch((err: unknown) => {
    console.error("[reprendre-contacts] échec :", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
