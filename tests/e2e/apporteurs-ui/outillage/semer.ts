// Semeur du bac à sable : crée des apporteurs FICTIFS déjà signés (contrat 2.6) directement en base
// locale, et écrit leur lien personnel. Jamais la production : refuse toute base qui n'est pas locale.
// Usage : tsx tests/e2e/apporteurs-ui/outillage/semer.ts <nom-court> [statut]
import { prisma } from "@/lib/prisma";
import { encryptPii } from "@/lib/pii-crypto";
import { hashEmailForLookup } from "@/lib/security/email-hash";
import { jetonDossier } from "@/features/apporteurs-reseau/jeton";

const url = process.env["DATABASE_URL"] ?? "";
if (!/@(127\.0\.0\.1|localhost):/.test(url)) throw new Error("base non locale : refus");

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
