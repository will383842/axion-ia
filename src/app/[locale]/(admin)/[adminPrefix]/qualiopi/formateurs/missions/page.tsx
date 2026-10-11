/**
 * Formateurs freelance › Missions (lot L11d, écran W-6 de la maquette 6).
 *
 * Les missions des formateurs indépendants, groupées par « qui doit agir » :
 * Vous · Le formateur · Le client · Rien à faire. Filtre « Vous » par défaut,
 * sur 30 jours. Une ligne = la formation, la date, le formateur, l'étape, UN
 * bouton. Même calcul que le moteur des missions (`etapeMission`).
 *
 * 🔑 Interrupteur `formateurs.missions_console` coupé : la page n'existe pas.
 * Rôles du dossier candidat seulement (la page nomme des formateurs).
 */

import Link from "next/link";
import { notFound } from "next/navigation";

import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { gardePage } from "@/server/auth/garde-page";
import { peutOuvrirDossierCandidat } from "@/server/auth/habilitations";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";
import {
  lireMissionsConsole,
  type LigneMission,
} from "@/server/qualiopi/formateurs-independants/missions-console";
import type { QuiAgit } from "@/server/qualiopi/formateurs-independants/etape-mission";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{ qui?: string; tout?: string }>;
}

const ONGLETS: ReadonlyArray<{ cle: QuiAgit; libelle: string }> = [
  { cle: "vous", libelle: "Vous" },
  { cle: "formateur", libelle: "Le formateur" },
  { cle: "client", libelle: "Le client" },
  { cle: "rien", libelle: "Rien à faire" },
];

const BOUTON: Readonly<Record<QuiAgit, string>> = {
  vous: "Ouvrir",
  formateur: "Voir",
  client: "Voir",
  rien: "Voir",
};

const JOUR = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});

const TRENTE_JOURS_MS = 30 * 24 * 60 * 60 * 1000;

export default async function MissionsFormateursPage({ params, searchParams }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  if (!peutOuvrirDossierCandidat(acces.role)) {
    return (
      <AccesRefuse
        motif="Cette page nomme des formateurs : elle est réservée aux rôles qui ouvrent leur dossier."
        retourHref={`/${locale}/${adminPrefix}`}
      />
    );
  }
  if (!(await interrupteurAllume("missions_console"))) notFound();

  const sp = await searchParams;
  const qui: QuiAgit = ONGLETS.some((o) => o.cle === sp.qui) ? (sp.qui as QuiAgit) : "vous";
  const tout = sp.tout === "1";
  const maintenant = new Date();
  const lignes = await lireMissionsConsole(maintenant);
  const horizon = maintenant.getTime() + TRENTE_JOURS_MS;
  const visibles = lignes.filter(
    (l) => l.quiAgit === qui && (tout || qui !== "vous" || l.dateDebut.getTime() <= horizon),
  );
  const base = `/${locale}/${adminPrefix}`;
  const compte = (c: QuiAgit) => lignes.filter((l) => l.quiAgit === c).length;

  return (
    <div className="mx-auto max-w-5xl space-y-[var(--space-admin-5)] p-[var(--space-admin-6)]">
      <h1 className="text-[length:var(--text-admin-xl)] font-semibold text-[color:var(--color-admin-fg)]">
        Missions
      </h1>
      <nav className="flex flex-wrap gap-[var(--space-admin-2)]" aria-label="Qui doit agir">
        {ONGLETS.map((o) => (
          <Link
            key={o.cle}
            href={`${base}/qualiopi/formateurs/missions?qui=${o.cle}`}
            aria-current={o.cle === qui ? "page" : undefined}
            className={
              o.cle === qui
                ? "admin-button min-h-[40px]"
                : "min-h-[40px] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]"
            }
          >
            {o.libelle} ({compte(o.cle)})
          </Link>
        ))}
      </nav>
      {qui === "vous" && !tout ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Les 30 prochains jours.{" "}
          <Link href={`${base}/qualiopi/formateurs/missions?qui=vous&tout=1`} className="underline">
            Tout afficher
          </Link>
        </p>
      ) : null}
      {visibles.length === 0 ? (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Rien ici.
        </p>
      ) : (
        <ul className="divide-y divide-[color:var(--color-admin-border)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)]">
          {visibles.map((l) => (
            <Ligne key={l.missionId} ligne={l} base={base} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Ligne({ ligne: l, base }: { ligne: LigneMission; base: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-[var(--space-admin-3)] p-[var(--space-admin-4)]">
      <div>
        <p className="text-[length:var(--text-admin-sm)] font-semibold text-[color:var(--color-admin-fg)]">
          {l.intitule} · {JOUR.format(l.dateDebut)} · {l.formateur}
        </p>
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {l.libelle} · {l.numero}
        </p>
      </div>
      <Link
        href={`${base}/qualiopi/sessions/${l.sessionId}#formateur`}
        className="admin-button min-h-[40px]"
      >
        {BOUTON[l.quiAgit]}
      </Link>
    </li>
  );
}
