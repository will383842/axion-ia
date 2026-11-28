// « Monde » du bac à sable pour la campagne de tests par l'interface : crée directement en base LOCALE
// des apporteurs, des commandes payées, des avoirs… (données 100 % fictives), joue les passages du
// worker (commissions, autofacturation, réservations échues) et simule l'horloge en reculant des dates.
// Les écrans, eux, sont toujours pilotés par le navigateur dans les specs.
//
// Usage : tsx tests/e2e/apporteurs-ui/outillage/monde.ts <commande> '<json>'   (sortie : une ligne JSON)
// Garde : mêmes refus que `semer.ts` (APPORTEUR_BAC_A_SABLE=1, base locale, nom de base de test).
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { encryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { jetonDossier } from "@/features/apporteurs-reseau/jeton";
import { calculerReleve } from "@/features/apporteurs-reseau/releve-mensuel/calcul";
import { empreinteContenu } from "@/features/apporteurs-reseau/releve-mensuel/empreinte";
import { rendreEtStockerPdfReleve } from "@/features/apporteurs-reseau/releve-mensuel/pdf";
import { bornesPeriode } from "@/features/apporteurs-reseau/releve-mensuel/periode";
import { setQualiopiConfig } from "@/server/qualiopi/config/site-settings";
import {
  passerFacturationApporteurs,
  passerReseauApporteurs,
} from "@/features/apporteurs-reseau/passage-quotidien";

if (process.env["APPORTEUR_BAC_A_SABLE"] !== "1") throw new Error("APPORTEUR_BAC_A_SABLE=1 requis");
const cible = new URL(process.env["DATABASE_URL"] ?? "postgresql://x@invalide/x");
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(cible.hostname))
  throw new Error("base non locale : refus");
if (!/(e2e|test|bac)/i.test(cible.pathname))
  throw new Error("nom de base hors bac à sable : refus");

const [commande, brut] = [process.argv[2], process.argv[3] ?? "{}"];
const a = JSON.parse(brut) as Record<string, unknown>;
const JOUR = 86_400_000;
const uniq = (): string => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

/** SIREN fictif unique à clé de Luhn valide. */
function sirenFictif(): string {
  const luhn = (x: string): boolean =>
    [...x].reverse().reduce((s, c, i) => {
      let d = Number(c);
      if (i % 2 === 1) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      return s + d;
    }, 0) %
      10 ===
    0;
  for (;;) {
    const c = String(900_000_000 + Math.floor(Math.random() * 99_999_999));
    if (luhn(c)) return c;
  }
}
function siretDe(siren: string): string {
  const luhn = (x: string): boolean =>
    [...x].reverse().reduce((s, c, i) => {
      let d = Number(c);
      if (i % 2 === 1) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      return s + d;
    }, 0) %
      10 ===
    0;
  for (let i = 1; i < 100000; i++) {
    const c = `${siren}${String(i).padStart(5, "0")}`;
    if (luhn(c)) return c;
  }
  throw new Error("pas de siret");
}

async function apporteur(): Promise<unknown> {
  const court = String(a["court"] ?? "demo");
  const version = String(a["version"] ?? "2.8");
  const email = `${court}.${uniq()}@exemple.invalid`;
  const maintenant = new Date();
  const r = await prisma.apporteurReseau.create({
    data: {
      prenom: encryptPii("Test")!,
      nom: encryptPii(court)!,
      email: encryptPii(email)!,
      emailHash: hashEmailForLookup(email)!,
      statut: a["statut"] === "dossier_en_cours" ? "dossier_en_cours" : "signe",
      siren: String(a["siren"] ?? sirenFictif()),
      denomination: "Apporteur Fictif",
      statutJuridique: "micro_entrepreneur",
      regimeTva: (a["regime"] as "franchise_293b" | "assujetti" | undefined) ?? "franchise_293b",
      adresse: encryptPii("12 rue de l'Exemple 69001 Lyon")!,
      iban: encryptPii(String(a["iban"] ?? "FR7630006000011234567890189"))!,
      ...(a["statut"] === "dossier_en_cours"
        ? {}
        : {
            signeParApporteurAt: maintenant,
            signeParSocieteAt: maintenant,
            signatureApporteur: { version, nom: `Test ${court}` },
          }),
    },
    select: { id: true, versionLien: true },
  });
  return {
    id: r.id,
    email,
    lien: `/apporteur/dossier/${r.id}/${jetonDossier(r.id, r.versionLien)}`,
  };
}

/** Une entreprise présentée, protégée (confirmée), avec sa commande payée à 100 % (ou non). */
async function commande_(): Promise<unknown> {
  const apporteurId = String(a["apporteurId"]);
  const siren = String(a["siren"] ?? sirenFictif());
  const siret = siretDe(siren);
  const activite = a["activite"] === null ? null : String(a["activite"] ?? "formation");
  const montant = Number(a["montantHtCents"] ?? 149_000);
  const journeeIa = a["journeeIa"] === true;
  const payee = a["payee"] !== false;
  const u = uniq();
  const maintenant = new Date();
  const client = await prisma.client.create({
    data: { numero: `CLI-E2E-${u}`, raisonSociale: `Client Fictif ${u}`, siren, siret },
  });
  let presentationId = a["presentationId"] ? String(a["presentationId"]) : null;
  if (!presentationId) {
    const p = await prisma.presentationEntreprise.create({
      data: {
        apporteurId,
        siren,
        denomination: `Client Fictif ${u}`,
        personneNom: encryptPii("Dupont Fictif")!,
        personneEmail: encryptPii(`contact.${u}@exemple.invalid`)!,
        recueAt: new Date(maintenant.getTime() - 40 * JOUR),
        statut: "confirmee",
        confirmeeAt: new Date(maintenant.getTime() - 20 * JOUR),
        protegeeJusquAt: new Date(maintenant.getTime() + 150 * JOUR),
      },
    });
    presentationId = p.id;
    await prisma.presentationEtablissement.create({
      data: { presentationId, siret, entreprise: true },
    });
  }
  const lignes = journeeIa
    ? [
        {
          designation: "Journée IA",
          offreCode: "journee-ia",
          quantite: 1,
          prixUnitaireHtCents: montant,
        },
      ]
    : [
        {
          designation: String(a["designation"] ?? "Prestation fictive"),
          quantite: 1,
          prixUnitaireHtCents: montant,
        },
      ];
  const devis = await prisma.devis.create({
    data: {
      numero: `DEV-E2E-${u}`,
      activite: activite as "formation" | null,
      clientId: client.id,
      lignes,
      montantTotalHtCents: montant,
      mentionTva: "TVA 20 %",
      statut: "accepte",
      dateValidite: new Date(maintenant.getTime() + 30 * JOUR),
      sentAt: new Date(maintenant.getTime() - 10 * JOUR),
      acceptedAt: new Date(maintenant.getTime() - Number(a["accepteIlYAJours"] ?? 5) * JOUR),
      journeeIa,
    },
  });
  const facture = await prisma.factureFormation.create({
    data: {
      numero: `FAC-E2E-${u}`,
      activite: activite as "formation" | null,
      clientId: client.id,
      devisId: devis.id,
      destinataire: "entreprise",
      destinataireNom: client.raisonSociale,
      montantHtCents: montant,
      montantTvaCents: Math.round(montant * 0.2),
      montantTtcCents: Math.round(montant * 1.2),
      lignes,
      statut: payee ? "payee" : "emise",
      emiseAt: new Date(maintenant.getTime() - 4 * JOUR),
      paidAt: payee ? new Date(maintenant.getTime() - 1 * JOUR) : null,
    },
  });
  return {
    presentationId,
    clientId: client.id,
    devisId: devis.id,
    factureId: facture.id,
    siren,
    denomination: client.raisonSociale,
  };
}

/** Un avoir total ou partiel sur une facture (créé « emis »). */
async function avoir(): Promise<unknown> {
  const f = await prisma.factureFormation.findUniqueOrThrow({
    where: { id: String(a["factureId"]) },
  });
  const montant = Number(a["montantHtCents"] ?? f.montantHtCents);
  const av = await prisma.factureFormation.create({
    data: {
      numero: `AV-E2E-${uniq()}`,
      activite: f.activite,
      clientId: f.clientId,
      devisId: f.devisId,
      destinataire: f.destinataire,
      destinataireNom: f.destinataireNom,
      montantHtCents: montant,
      montantTvaCents: Math.round(montant * 0.2),
      montantTtcCents: Math.round(montant * 1.2),
      lignes: f.lignes ?? [],
      statut: "emise",
      avoirDeId: f.id,
      emiseAt: new Date(),
    },
  });
  return { avoirId: av.id };
}

async function main(): Promise<void> {
  let sortie: unknown;
  switch (commande) {
    case "apporteur":
      sortie = await apporteur();
      break;
    case "commande":
      sortie = await commande_();
      break;
    case "identite-of": {
      // Identité FICTIVE de l'organisme (SIRET + adresse du siège), requise pour émettre une facture/un avoir.
      const admin = await prisma.adminUser.findFirstOrThrow({ select: { id: true } });
      const session = {
        userId: admin.id,
        role: "super_admin",
        email: "admin@exemple.invalid",
      } as never;
      await setQualiopiConfig("siret", siretDe(sirenFictif()) as never, session);
      await setQualiopiConfig("adresse_siege", "1 rue Fictive 75001 Paris" as never, session);
      sortie = { ok: true };
      break;
    }
    case "purger-challenges": {
      // Base de test LOCALE : les challenges des exécutions précédentes bloqueraient la période.
      sortie = await prisma.challengeApporteur.deleteMany({});
      break;
    }
    case "releve": {
      // Relevé mensuel FICTIF d'un apporteur (état « préparé », jamais envoyé) : contenu calculé par le code
      // de production sur une commission fictive, PDF rendu et déposé dans le faux R2.
      const periode = String(a["periode"] ?? "2026-10");
      const apporteurId = String(a["apporteurId"]);
      const { debut } = bornesPeriode(periode);
      const emise = new Date(debut.getTime() + 10 * JOUR);
      const u = uniq();
      const numeroAuto = `AXI-APP-2026-9${u.slice(-3)}`;
      const entree = {
        periode,
        preparationAt: new Date(),
        commissions: [
          {
            id: randomUUID(),
            activite: "formation",
            palier: "journee-ia",
            parrainage: false,
            statut: "due",
            montantCents: Number(a["montantCents"] ?? 50_000),
            factureHtCents: 149_000,
            prixPublicHtCents: 149_000,
            entreprise: `Société fictive ${u}`,
            factureClientNumero: `F-E2E-${u}`,
            factureClientDate: new Date(emise.getTime() - 20 * JOUR),
            encaissementIntegralAt: new Date(emise.getTime() - 1 * JOUR),
            autofactureNumero: numeroAuto,
            autofactureEmiseAt: emise,
            avoirNumero: null,
            autofactureAttenteMotif: null,
            autofactureAttenteDepuis: null,
            litigeDepuis: null,
            verseeAt: null,
            creeAt: new Date(emise.getTime() - 2 * JOUR),
            majAt: emise,
            regleAppliquee: "journee_ia",
            versionContrat: "2.8",
          },
        ],
        pieces: [
          {
            numero: numeroAuto,
            genre: "facture",
            regimeTva: "franchise_293b",
            totalHtCents: Number(a["montantCents"] ?? 50_000),
            totalTvaCents: 0,
            totalTtcCents: Number(a["montantCents"] ?? 50_000),
            factureRectifiee: null,
            emiseAt: emise,
          },
        ],
      } as never;
      const { contenu } = calculerReleve(entree);
      const numero = `REL-${periode}-${u.slice(-4)}`;
      const pdf = await rendreEtStockerPdfReleve(contenu, `e2e/releves/${numero}.pdf`, {
        numero,
        destinataire: "Apporteur Fictif",
      });
      const r = await prisma.releveMensuelApporteur.create({
        data: {
          numero,
          apporteurId,
          periode,
          statut: "prepare",
          coupureAt: new Date(contenu.coupureAt),
          contenu: contenu as never,
          empreinteSha256: empreinteContenu(contenu),
          pdfR2Key: pdf.r2Key,
          pdfSha256: pdf.sha256,
          nbLignes: 1,
          facturesHtCents: contenu.totaux.factureHtCents,
          viresTtcCents: contenu.totaux.vireTtcCents,
        },
        select: { id: true, numero: true },
      });
      sortie = { id: r.id, numero: r.numero, periode };
      break;
    }
    case "releves-de": {
      sortie = await prisma.releveMensuelApporteur.findMany({
        where: { apporteurId: String(a["apporteurId"]) },
        select: { numero: true, statut: true, envoyeAt: true },
      });
      break;
    }
    case "iban-brut": {
      // Lecture de la colonne telle qu'elle est stockée (doit être chiffrée, jamais l'IBAN en clair).
      const r = await prisma.apporteurReseau.findUniqueOrThrow({
        where: { id: String(a["apporteurId"]) },
        select: { iban: true },
      });
      sortie = { brut: r.iban };
      break;
    }
    case "avoir":
      sortie = await avoir();
      break;
    case "passage-horaire":
      sortie = await passerFacturationApporteurs(new Date());
      break;
    case "passage-quotidien":
      sortie = await passerReseauApporteurs(
        new Date(a["maintenant"] ? String(a["maintenant"]) : Date.now()),
      );
      break;
    case "reculer-reservation": {
      // Horloge simulée : on recule d'autant la saisie et les bornes de la réservation.
      const jours = Number(a["jours"]);
      const id = String(a["presentationId"]);
      const p = await prisma.presentationEntreprise.findUniqueOrThrow({ where: { id } });
      await prisma.presentationEntreprise.update({
        where: { id },
        data: { recueAt: new Date(p.recueAt.getTime() - jours * JOUR) },
      });
      const r = await prisma.presentationReservation.findUnique({ where: { presentationId: id } });
      if (r)
        await prisma.presentationReservation.update({
          where: { presentationId: id },
          data: {
            reserveeJusquAt: new Date(r.reserveeJusquAt.getTime() - jours * JOUR),
            creeAt: new Date(r.creeAt.getTime() - jours * JOUR),
          },
        });
      sortie = { ok: true };
      break;
    }
    case "lire-presentation": {
      const id = String(a["presentationId"]);
      sortie = {
        presentation: await prisma.presentationEntreprise.findUnique({
          where: { id },
          select: { statut: true, recueAt: true, confirmeeAt: true, protegeeJusquAt: true },
        }),
        reservation: await prisma.presentationReservation.findUnique({
          where: { presentationId: id },
        }),
      };
      break;
    }
    case "presentation-de": {
      const p = await prisma.presentationEntreprise.findFirst({
        where: { apporteurId: String(a["apporteurId"]) },
        orderBy: { creeAt: "desc" },
        select: { id: true, siren: true },
      });
      sortie = p;
      break;
    }
    case "commissions": {
      const ls = await prisma.commissionApporteur.findMany({
        where: { apporteurId: String(a["apporteurId"]) },
        select: {
          id: true,
          statut: true,
          montantCents: true,
          activite: true,
          palier: true,
          autofactureNumero: true,
          avoirNumero: true,
          factureId: true,
        },
      });
      sortie = ls;
      break;
    }
    default:
      throw new Error(`commande inconnue : ${commande}`);
  }
  process.stdout.write(`${JSON.stringify(sortie)}\n`);
  void randomUUID;
  await prisma.$disconnect();
}
await main();
// Les clients Redis/BullMQ importés par le worker gardent le processus ouvert : sortie explicite.
process.exit(0);
