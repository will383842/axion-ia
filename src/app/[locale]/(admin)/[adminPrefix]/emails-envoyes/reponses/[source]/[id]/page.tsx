// E-mails envoyés › une réponse écrite à la main — écran de LECTURE (lot I3-1).
//
// Montre la réponse comme elle est partie : lecteur isolé (HTML et texte MASQUÉS : le HTML
// stocké porte le vrai lien d'opposition), De, À, Répondre à, statut, dates, motif d'erreur,
// auteur, note interne, et les liens vers la demande ou la candidature et la fiche client.
// Pas de rejeu ici : il reste sur la fiche, avec ses gardes.
//
// Ordre imposé : garde de console (`gardePage`) → source connue → droit de la source (candidat :
// dossier candidat) → SEULEMENT ALORS la base. Écran de détail, atteint depuis une liste ou
// un fil, jamais depuis le menu.
//
// FR uniquement (admin FR).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { gardePage } from "@/server/auth/garde-page";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { AdminPageShell, AdminPageHeader, AdminCard, AdminBadge } from "@/components/admin/ui";
import { LecteurEmail } from "@/components/admin/ui/LecteurEmail";
import { peutConsulter, peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import {
  LIBELLE_STATUT_REPONSE,
  lireReponseManuelle,
  type StatutReponse,
} from "@/features/admin-emails/reponses-manuelles";

// Jamais pré-rendue : donnée de personne, et au build la base est un stub.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Réponse écrite à la main",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ adminPrefix: string; source: string; id: string }>;
}

const TON: Readonly<Record<StatutReponse, "success" | "warning" | "destructive" | "neutral">> = {
  en_attente: "warning",
  envoye: "success",
  rebond: "destructive",
  indesirable: "destructive",
  echec: "destructive",
};

const quand = (d: Date | null): string =>
  d
    ? new Date(d).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Paris",
      })
    : "—";

function Ligne({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[2px] sm:flex-row sm:gap-[var(--space-admin-2)]">
      <dt className="min-w-[9rem] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        {label}
      </dt>
      <dd className="text-[length:var(--text-admin-sm)] break-words text-[color:var(--color-admin-fg)]">
        {children}
      </dd>
    </div>
  );
}

export default async function ReponseManuellePage({
  params,
}: PageProps): Promise<React.ReactElement> {
  const { adminPrefix, source, id } = await params;
  const racine = `/fr/${adminPrefix}`;
  const retour = `${racine}/emails-envoyes`;

  // Même garde que la liste. Le contenu d'une réponse est une donnée de personne : on ne le lit
  // qu'APRÈS la garde et le droit de la source.
  const acces = await gardePage("consultation", `${racine}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={retour} />;

  if (source !== "demande" && source !== "candidature") notFound();

  if (source === "candidature" && !peutOuvrirDossierCandidat(acces.role)) {
    return (
      <AccesRefuse
        motif="Les réponses faites aux candidats relèvent du dossier candidat, que votre rôle ne peut pas ouvrir."
        retourHref={retour}
      />
    );
  }
  if (source === "demande" && !peutConsulter(acces.role)) notFound();

  const r = await lireReponseManuelle(source, id, acces.role);
  if (!r) notFound();

  const lienParent =
    source === "demande"
      ? { href: `${racine}/contacts/messages/${r.parentId}`, libelle: "Voir la demande" }
      : { href: `${racine}/contacts/candidatures/${r.parentId}`, libelle: "Voir la candidature" };

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title={r.sujet}
        description={`Réponse écrite à la main, envoyée à ${r.destinataire}`}
        meta={<AdminBadge tone={TON[r.statut]}>{LIBELLE_STATUT_REPONSE[r.statut]}</AdminBadge>}
        actions={
          <Link href={retour} className="admin-link">
            ← E-mails envoyés
          </Link>
        }
      />

      <div className="grid gap-[var(--space-admin-5)] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <AdminCard>
          <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            Texte de la réponse enregistrée. Les liens personnels (désinscription…) sont masqués :
            la console ne doit pas pouvoir les rejouer.
          </p>
          <LecteurEmail
            html={r.html}
            texte={r.texte}
            de={r.de}
            a={r.destinataire}
            repondreA={r.repondreA}
            objet={r.sujet}
            preEntete={r.preEntete}
            titre={`Réponse écrite à la main : ${r.sujet}`}
            pleinEcranHref={`${racine}/emails/lecture/reponse-${source}/${r.id}`}
            liensInertes
          />
        </AdminCard>

        <AdminCard>
          <dl className="flex flex-col gap-[var(--space-admin-3)]">
            <Ligne label="Statut">{LIBELLE_STATUT_REPONSE[r.statut]}</Ligne>
            <Ligne label="Écrite le">{quand(r.date)}</Ligne>
            <Ligne label="Envoyée le">{quand(r.envoyeLe)}</Ligne>
            {r.echecLe ? <Ligne label="Échec le">{quand(r.echecLe)}</Ligne> : null}
            {r.erreur ? <Ligne label="Motif d'erreur">{r.erreur.slice(0, 300)}</Ligne> : null}
            <Ligne label="Écrite par">{r.auteur}</Ligne>
            <Ligne label="Note interne, jamais envoyée">{r.noteInterne ?? "—"}</Ligne>
          </dl>
          <ul className="mt-[var(--space-admin-4)] flex flex-col gap-[var(--space-admin-2)]">
            <li>
              <Link href={lienParent.href} className="admin-link">
                {lienParent.libelle}
              </Link>
            </li>
            {r.ficheClientId ? (
              <li>
                <Link href={`${racine}/qualiopi/clients/${r.ficheClientId}`} className="admin-link">
                  Voir la fiche client
                </Link>
              </li>
            ) : null}
          </ul>
        </AdminCard>
      </div>
    </AdminPageShell>
  );
}
