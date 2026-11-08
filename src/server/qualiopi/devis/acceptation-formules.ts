/**
 * Acceptation d'un devis À FORMULES (lot 4) — appelée quand la signature est COMPLÈTE
 * (client puis contresignature d'Axion-IA, art. 6.2 des CGV).
 *
 * Dans UNE transaction, toujours (même canal Partners fermé) :
 *   1. relit le choix scellé sur la ligne de signature du client — JAMAIS la requête ;
 *   2. revérifie le sceau (V4), l'empreinte de l'offre, le numéro du devis ;
 *   3. recopie la partie ponctuelle de la formule retenue dans `lignes` + `montantTotalHtCents`
 *      (condition `formule_retenue IS NULL` : une seule recopie, idempotente) ;
 *   4. passe le devis à `accepte` ;
 *   5. émet `devis.signe` (le producteur exige des lignes non vides dont la somme égale le total) ;
 *   6. range le fait `commande.signee` (une ligne par devis, identifiant fixe).
 *
 * Toute incohérence LÈVE : la transaction est annulée, le devis reste `envoye`, la signature est
 * acquise mais l'argent n'est pas touché. Aucun e-mail n'est envoyé d'ici.
 */
import * as Sentry from "@sentry/nextjs";
import type { Prisma, PrismaClient } from "../../../../prisma/generated/client";
import { emettreDevisSigne } from "@/server/partners-sync/producteurs/devis";
import type { LigneFacture } from "../documents/templates/facture";
import { construireCommandeSignee } from "./commande-signee";
import { validerChoixSignature } from "./choix-signature";
import { montantsDevis } from "./montants-devis";
import { sha256Choix, sha256Offre, type ChoixCanonique } from "./offre-calculs";
import { offreDevisV1 } from "./offre-devis";

const STATUTS_ACCEPTABLES = ["envoye", "expire"] as const;

export class AcceptationFormulesRefusee extends Error {
  constructor(
    readonly motif: string,
    message: string,
  ) {
    super(message);
    this.name = "AcceptationFormulesRefusee";
  }
}

function refuser(motif: string): never {
  throw new AcceptationFormulesRefusee(
    motif,
    `Acceptation du devis à formules refusée : ${motif}.`,
  );
}

/**
 * Traite les devis à formules de la pièce. `traite: false` = aucun devis à formules : l'appelant
 * suit alors son chemin habituel, inchangé.
 */
export async function accepterDevisAFormules(
  client: PrismaClient,
  documentGenereId: string,
): Promise<{ traite: boolean; ids: string[]; acceptes: string[] }> {
  const concernes = await client.devis.findMany({
    where: {
      documentGenereId,
      statut: { in: [...STATUTS_ACCEPTABLES] },
      offreSha256: { not: null },
    },
    select: { id: true },
  });
  if (concernes.length === 0) return { traite: false, ids: [], acceptes: [] };

  const ids = concernes.map((d) => d.id);
  // Seuls les devis EFFECTIVEMENT acceptés par CETTE transaction (ni sautés par `preparer`, ni
  // déjà recopiés par un autre accepteur) : l'appelant s'en sert pour proposer les plans.
  const acceptes: string[] = [];
  try {
    // 🔴 Les ÉCRITURES (recopie, acceptation, émission, fait) vivent ICI, dans le travail même de
    // la transaction : c'est la forme que le cliquet des écrivains de `devis.signe`
    // (`partners:cliquet-ecrivains`, E1-E3) sait lire. `preparer` ne fait que LIRE et VÉRIFIER.
    await client.$transaction(async (tx) => {
      for (const devisId of ids) {
        const p = await preparer(tx, documentGenereId, devisId);
        if (p === null) continue;

        const recopie = await tx.devis.updateMany({
          where: { id: devisId, formuleRetenue: null, statut: { in: [...STATUTS_ACCEPTABLES] } },
          data: {
            formuleRetenue: p.choix.formule,
            choixRetenu: p.choix as unknown as Prisma.InputJsonValue,
            choixSignatureId: p.signatureId,
            lignes: p.montants.lignes as unknown as Prisma.InputJsonValue,
            montantTotalHtCents: p.montants.montantTotalHtCents,
          },
        });
        // Un autre accepteur a recopié avant nous : c'est lui qui accepte et range le fait.
        if (recopie.count === 0) continue;

        // Acceptation AVANT l'émission : le producteur n'émet que pour un devis `accepte`.
        const acceptation = await tx.devis.updateMany({
          where: { id: devisId, statut: { in: [...STATUTS_ACCEPTABLES] } },
          data: { statut: "accepte", acceptedAt: new Date() },
        });
        if (acceptation.count > 0) acceptes.push(devisId);
        await emettreDevisSigne(tx, devisId);

        // Le fait `commande.signee` (inerte tant que l'envoi vers la console est fermé).
        await tx.consoleCommande.createMany({
          data: [
            {
              devisId,
              numeroDevis: p.numeroDevis,
              eventId: p.eventId,
              choixOffreSha256: p.choixOffreSha256,
              payload: p.payload as unknown as Prisma.InputJsonValue,
            },
          ],
          skipDuplicates: true,
        });
      }
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { action: "accepterDevisAFormules" },
      extra: { documentGenereId },
    });
    throw err;
  }
  return { traite: true, ids, acceptes };
}

interface Preparation {
  readonly choix: ChoixCanonique;
  readonly signatureId: string;
  readonly montants: { lignes: readonly LigneFacture[]; montantTotalHtCents: number };
  readonly numeroDevis: string;
  readonly eventId: string;
  readonly choixOffreSha256: string;
  readonly payload: Record<string, unknown>;
}

/**
 * Rang de révision du devis : `null` pour la première version, sinon 1 + le nombre de versions
 * qu'il remplace (v2 → 2). Fait immuable de la chaîne `replacesDevisId`, relu à chaque
 * acceptation ; la boucle est bornée et protégée contre un cycle.
 */
async function rangRevision(
  tx: Prisma.TransactionClient,
  devisId: string,
  replacesDevisId: string | null,
): Promise<number | null> {
  if (replacesDevisId == null) return null;
  const vus = new Set<string>([devisId]);
  let courant: string | null = replacesDevisId;
  let rang = 1;
  while (courant !== null && !vus.has(courant) && rang < 100) {
    vus.add(courant);
    rang += 1;
    const parent: { replacesDevisId: string | null } | null = await tx.devis.findUnique({
      where: { id: courant },
      select: { replacesDevisId: true },
    });
    courant = parent?.replacesDevisId ?? null;
  }
  return rang;
}

/**
 * LIT et VÉRIFIE, n'écrit rien. `null` : rien à faire (devis déjà accepté, rejeu). Lève
 * `AcceptationFormulesRefusee` sur toute incohérence.
 */
async function preparer(
  tx: Prisma.TransactionClient,
  documentGenereId: string,
  devisId: string,
): Promise<Preparation | null> {
  const d = await tx.devis.findUnique({
    where: { id: devisId },
    select: {
      id: true,
      numero: true,
      statut: true,
      offre: true,
      offreSha256: true,
      formuleRetenue: true,
      lignes: true,
      montantTotalHtCents: true,
      clientId: true,
      replacesDevisId: true,
    },
  });
  if (d === null) return refuser("devis_introuvable");
  // Déjà accepté (course avec un autre accepteur, ou rejeu) : rien à refaire, rien à rétrograder.
  if (!(STATUTS_ACCEPTABLES as readonly string[]).includes(d.statut)) return null;
  if (d.offre == null || d.offreSha256 == null) return refuser("offre_absente");

  // ── 1. Le choix, lu sur la signature PERSISTÉE du client ──
  const sigClient = await tx.documentSignature.findFirst({
    where: { documentGenereId, partie: "client", revokedAt: null },
    select: {
      id: true,
      hashVersion: true,
      choixOffre: true,
      choixOffreSha256: true,
      signataireNom: true,
      signataireQualite: true,
      signeAt: true,
      cgvVersion: true,
    },
  });
  if (sigClient === null) return refuser("signature_client_absente");
  if (sigClient.hashVersion !== 4) return refuser("sceau_non_v4");
  if (sigClient.choixOffre == null || sigClient.choixOffreSha256 == null) {
    return refuser("choix_absent");
  }

  // ── 2. Tout est revérifié ──
  const offre = offreDevisV1.safeParse(d.offre);
  if (!offre.success) return refuser("offre_illisible");
  if (sha256Offre(offre.data) !== d.offreSha256) return refuser("offre_alteree");
  const choix = sigClient.choixOffre as unknown as ChoixCanonique;
  let empreinteChoix: string;
  try {
    empreinteChoix = sha256Choix(choix);
  } catch {
    return refuser("choix_illisible");
  }
  if (empreinteChoix !== sigClient.choixOffreSha256) return refuser("choix_altere");
  if (choix.devisNumero !== d.numero) return refuser("choix_autre_devis");
  if (choix.offreSha256 !== d.offreSha256) return refuser("choix_autre_offre");
  // Le choix scellé doit être celui que les règles de l'offre figée produisent (maintenance
  // obligatoire, durées, dépendances) : jamais seulement « bien formé ».
  const rederive = validerChoixSignature(
    { offre: offre.data, devisNumero: d.numero, offreSha256: d.offreSha256 },
    {
      formule: choix.formule,
      automatisationsRetenues: choix.automatisationsRetenues,
      maintenanceRetenue: choix.maintenanceRetenue,
      periodiciteMois: choix.periodiciteMois,
    },
  );
  if (!rederive.ok) return refuser(`choix_invalide_${rederive.raison}`);
  if (rederive.sha256Choix !== empreinteChoix) return refuser("choix_non_canonique");

  // ── 3. Montants de la formule retenue (lève si formule/sélection invalide) ──
  const montants = montantsDevis({
    offre: offre.data,
    lignes: d.lignes as unknown as readonly LigneFacture[],
    montantTotalHtCents: d.montantTotalHtCents,
    choix: { formule: choix.formule, automatisationsRetenues: choix.automatisationsRetenues },
  });

  // ── 5. Le fait `commande.signee` (inerte tant que l'envoi vers la console est fermé) ──
  const [clientFiche, sigAxionia] = await Promise.all([
    tx.client.findUnique({
      where: { id: d.clientId },
      select: { numero: true, raisonSociale: true, siren: true, siret: true, adresse: true },
    }),
    tx.documentSignature.findFirst({
      where: { documentGenereId, partie: "axionia", revokedAt: null },
      select: { signeAt: true },
    }),
  ]);
  if (clientFiche === null) return refuser("client_introuvable");
  // Un devis n'est « signé des deux parties » qu'avec la contresignature d'Axion-IA : sans elle,
  // on n'accepte pas et on ne range pas de fait `commande.signee`.
  if (sigAxionia === null) return refuser("contresignature_absente");
  const { eventId, payload } = construireCommandeSignee({
    numeroDevis: d.numero,
    revision: await rangRevision(tx, devisId, d.replacesDevisId),
    offre: offre.data,
    offreSha256: d.offreSha256,
    choix,
    choixOffreSha256: empreinteChoix,
    cgvVersion: sigClient.cgvVersion,
    versionSceau: sigClient.hashVersion,
    client: clientFiche,
    signataire: {
      nom: sigClient.signataireNom,
      qualite: sigClient.signataireQualite,
      signeAt: sigClient.signeAt,
    },
    contresigneAt: sigAxionia.signeAt,
  });
  return {
    choix,
    signatureId: sigClient.id,
    montants,
    numeroDevis: d.numero,
    eventId,
    choixOffreSha256: empreinteChoix,
    payload,
  };
}
