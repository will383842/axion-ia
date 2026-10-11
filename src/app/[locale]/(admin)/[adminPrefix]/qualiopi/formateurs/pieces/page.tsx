/**
 * Admin — Formateurs › Pièces à renouveler (lot L13, ADR 0066 ; écran W-2,
 * ligne « pièces à valider »).
 *
 * Lecture seule : l'état de l'attestation de vigilance, de la RC pro et du CV
 * de chaque formateur indépendant qui a un geste à faire (ou une pièce en
 * vérification). Aucun e-mail ne part d'ici. Livré ÉTEINT : interrupteur
 * `formateurs.pieces_cron` absent = la page le dit et ne lit rien.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";
import { peutEngager } from "@/server/auth/habilitations";
import { envoiAllume } from "@/server/qualiopi/formateurs-independants/interrupteurs-envoi";
import { libelleEtatPiece } from "@/server/qualiopi/formateurs-independants/pieces-a-renouveler";
import { lirePiecesARenouveler } from "@/server/qualiopi/formateurs-independants/pieces-a-renouveler-lecture";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Formateurs — Pièces à renouveler | Axion-IA Admin",
  robots: { index: false, follow: false },
};

const LIBELLE_TYPE: Readonly<Record<string, string>> = {
  attestation_vigilance_urssaf: "Attestation de vigilance URSSAF",
  assurance_rc_pro: "Assurance RC pro",
  cv: "CV",
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

export default async function PiecesARenouvelerPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  if (!peutEngager(acces.role, "habiliter_formateur")) {
    return (
      <AccesRefuse
        motif="Cette page est réservée à la direction et à la responsable qualité."
        retourHref={`/${locale}/${adminPrefix}`}
      />
    );
  }
  const base = `/${locale}/${adminPrefix}/qualiopi/formateurs`;
  const allume = await envoiAllume("pieces_cron");
  const lignes = allume ? await lirePiecesARenouveler(new Date()).catch(() => null) : [];

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Pièces à renouveler"
        description="Formateurs indépendants dont une pièce arrive à échéance, est échue, à renvoyer ou en vérification. La RC pro est suivie mais ne bloque jamais une mission."
      />
      {!allume ? (
        <p className="admin-alert admin-alert-info">
          Le suivi des pièces n&apos;est pas encore allumé (écran Interrupteurs).
        </p>
      ) : lignes === null ? (
        <p className="admin-alert admin-alert-warning">Liste indisponible pour le moment.</p>
      ) : lignes.length === 0 ? (
        <p className="admin-card">Aucune pièce à suivre : tous les dossiers sont à jour.</p>
      ) : (
        <ul className="admin-card">
          {lignes.map((l) => (
            <li key={l.trainerId} className="py-2">
              <Link href={`${base}/${l.trainerId}`} className="font-semibold underline">
                {l.nom}
              </Link>
              <ul className="text-[length:var(--text-admin-sm)]">
                {l.pieces.map((p) => (
                  <li key={p.type}>
                    {LIBELLE_TYPE[p.type] ?? p.type}
                    {p.bloquante ? "" : " (ne bloque pas)"} : {libelleEtatPiece(p.etat)}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </AdminPageShell>
  );
}
