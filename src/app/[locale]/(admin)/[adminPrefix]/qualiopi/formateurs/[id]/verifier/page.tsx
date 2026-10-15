/**
 * Admin — Formateurs freelance › Vérifier et contresigner (écran W-4, lot L9).
 *
 * Cinq blocs à pastille, un seul bouton. Maquette :
 * `maquette-formateur-verifier-contresigner.html` (dépôt des plans).
 *
 * 🔴 LIVRÉ ÉTEINT : interrupteur `formateurs.activation_auto` coupé ou absent =
 * l'écran l'annonce et ne montre rien d'autre.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { gardePage } from "@/server/auth/garde-page";
import { peutEngager } from "@/server/auth/habilitations";
import { lireDrapeauEnvoi } from "@/server/qualiopi/formateurs-independants/interrupteurs";
import { lireEtatsInterrupteurs } from "@/server/qualiopi/formateurs-independants/interrupteurs-etat";
import { lireEcranVerifierContresigner } from "@/server/qualiopi/formateurs-independants/verifier-contresigner-lecture";

import { VerifierContresigner } from "./VerifierContresigner";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Formateurs — Vérifier et contresigner | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const JOUR = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Paris",
});

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string; id: string }>;
}

export default async function VerifierContresignerPage({ params }: PageProps) {
  const { locale, adminPrefix, id } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  if (!UUID.test(id)) notFound();

  if (!lireDrapeauEnvoi(await lireEtatsInterrupteurs(), "activation_auto")) {
    return (
      <AdminPageShell>
        <AdminPageHeader title="Vérifier et contresigner" />
        <AdminCard>
          <p>Cet écran n&apos;est pas encore ouvert.</p>
        </AdminCard>
      </AdminPageShell>
    );
  }

  const peutContresigner =
    peutEngager(acces.role, "contresigner") && peutEngager(acces.role, "habiliter_formateur");
  const peutVerifier = peutEngager(acces.role, "habiliter_formateur");

  // V1-A-6 — une pièce déposée dans le dossier en ligne s'ouvre par la route console,
  // qui garde son propre droit et journalise chaque lecture.
  const ecran = await lireEcranVerifierContresigner(id, new Date(), {
    ...(peutVerifier
      ? { basePiecesDeposees: `/${locale}/${adminPrefix}/qualiopi/formateurs/${id}/pieces` }
      : {}),
    voitRib: peutEngager(acces.role, "remunerer_formateur"),
  });
  if (ecran === null) notFound();

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Vérifier et contresigner"
        description={`${ecran.nomAffiche}${ecran.signeLe ? ` · dossier signé le ${JOUR.format(ecran.signeLe)}` : ""}`}
      />
      <VerifierContresigner
        ecran={ecran}
        peutContresigner={peutContresigner}
        peutVerifier={peutVerifier}
      />
    </AdminPageShell>
  );
}
