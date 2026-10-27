// Demandes du Tour France IA — les personnes qui ont rempli la mini-demande avant la visio
// (2026-10-27, PR-2a).
//
// Page SERVEUR, aucun composant client. Le rendu vit dans `VueDemandesTour`, affichable sans
// session. Garde : celle des appels réservés (`gardeLectureAppels`) — la page montre des
// coordonnées de prospects et le rapprochement avec leurs rendez-vous. La garde passe AVANT toute
// lecture (garde `la-lecture-est-gardee-comme-l-ecriture`).
//
// FR uniquement (CLAUDE.md §14 admin FR).

import type { Metadata } from "next";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardeLectureAppels } from "@/features/admin-calendly/acces";
import { compteurParVille, lireDemandesConsole } from "@/features/tour-de-france/lectures";
import { estStatutAffiche } from "@/features/tour-de-france/types";
import { VueDemandesTour } from "../../_components/VueDemandesTour";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demandes du Tour France IA",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

/** Une clé de ville de l'adresse : courte, sans caractère de contrôle ; sinon on l'ignore. */
function villeDeLAdresse(v: string | undefined): string | null {
  if (v === undefined || v.length === 0 || v.length > 100) return null;
  return /^[\p{L}\p{N}?\- ]+$/u.test(v) ? v : null;
}

export default async function DemandesTourPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix } = await params;
  const acces = await gardeLectureAppels(`/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;

  const sp = await searchParams;
  const filtreVille = villeDeLAdresse(sp["ville"]);
  const statutBrut = sp["statut"];
  const filtreStatut = estStatutAffiche(statutBrut) ? statutBrut : null;

  const [liste, villes] = await Promise.all([
    lireDemandesConsole({ ville: filtreVille, statut: filtreStatut }),
    compteurParVille(),
  ]);

  return (
    <VueDemandesTour
      adminPrefix={adminPrefix}
      liste={liste}
      villes={villes}
      filtreVille={filtreVille}
      filtreStatut={filtreStatut}
      ok={sp["ok"] ?? null}
      erreur={sp["erreur"] ?? null}
    />
  );
}
