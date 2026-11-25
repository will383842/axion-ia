// Semeur du bac à sable : crée des apporteurs FICTIFS déjà signés (contrat 2.6) directement en base
// locale, et écrit leur lien personnel. Jamais la production : refuse toute base qui n'est pas locale.
// Usage : tsx tests/e2e/apporteurs-ui/outillage/semer.ts <nom-court> [statut]
import { prisma } from "@/lib/prisma";
import { encryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { jetonDossier } from "@/features/apporteurs-reseau/jeton";

// Garde stricte : bac à sable explicite, hôte local ET nom de base de test (un tunnel SSH vers la
// production sur localhost ne passe donc pas).
if (process.env["APPORTEUR_BAC_A_SABLE"] !== "1") throw new Error("APPORTEUR_BAC_A_SABLE=1 requis");
const cible = new URL(process.env["DATABASE_URL"] ?? "postgresql://x@invalide/x");
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(cible.hostname))
  throw new Error("base non locale : refus");
if (!/(e2e|test|bac)/i.test(cible.pathname))
  throw new Error("nom de base hors bac à sable : refus");

const court = process.argv[2] ?? "demo";
const statut = (process.argv[3] ?? "signe") as "signe" | "dossier_en_cours";
const email = `${court}.${Date.now()}@exemple.invalid`;
const maintenant = new Date();

const a = await prisma.apporteurReseau.create({
  data: {
    prenom: encryptPii("Test")!,
    nom: encryptPii(court)!,
    email: encryptPii(email)!,
    emailHash: hashEmailForLookup(email)!,
    statut,
    ...(statut === "signe"
      ? {
          siren: "123456782",
          denomination: "Apporteur Fictif",
          statutJuridique: "micro_entrepreneur",
          regimeTva: "franchise_293b" as const,
          signeParApporteurAt: maintenant,
          signeParSocieteAt: maintenant,
          signatureApporteur: { version: "2.6", nom: `Test ${court}` },
        }
      : {}),
  },
  select: { id: true, versionLien: true },
});
const jeton = jetonDossier(a.id, a.versionLien);
process.stdout.write(
  `${JSON.stringify({ id: a.id, email, lien: `/apporteur/dossier/${a.id}/${jeton}` })}\n`,
);
await prisma.$disconnect();
