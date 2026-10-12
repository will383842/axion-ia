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
import { peutEngager } from "@/server/auth/habilitations";
import { ecrireIndemniteAnnulationFormAction } from "@/server/actions/qualiopi/indemnite-annulation";
import { instantParis } from "@/server/qualiopi/formateurs-independants/argent/dates";
import {
  apercuDecisionIndemnite,
  lireMissionsAIndemniser,
  type MissionAIndemniser,
} from "@/server/qualiopi/formateurs-independants/paiement/indemnite-annulation-base";
import type { ApercuIndemnite } from "@/server/qualiopi/formateurs-independants/paiement/indemnite-annulation-decision";
import { montantEnTexte } from "@/server/qualiopi/formateurs-independants/paiement/virement-fait-envoi";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<{
    qui?: string;
    tout?: string;
    ok?: string;
    erreur?: string;
    /** Aperçu de l'indemnité demandé pour CETTE mission, à l'instant saisi. */
    apercu?: string;
    annuleeA?: string;
    parAxion?: string;
  }>;
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
  // Lot D (M11) — missions fermées, lettre signée : la décision d'indemnité.
  const aIndemniser = peutEngager(acces.role, "remunerer_formateur")
    ? await lireMissionsAIndemniser()
    : [];
  // L'aperçu se calcule à l'instant SAISI quand l'administrateur l'a demandé
  // (défaut 3 de la relecture lot D), sinon à l'instant proposé.
  const saisies = aIndemniser.map((m) => saisieDemandee(sp, m));
  const apercus = await Promise.all(
    saisies.map((v, i) =>
      v === null
        ? null
        : apercuDecisionIndemnite({
            missionId: aIndemniser[i]!.missionId,
            annuleeA: v.annuleeA,
            parAxion: v.parAxion,
          }).catch(() => null),
    ),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-[var(--space-admin-5)] p-[var(--space-admin-6)]">
      <h1 className="text-[length:var(--text-admin-xl)] font-semibold text-[color:var(--color-admin-fg)]">
        Missions
      </h1>
      {sp.ok !== undefined && (
        <div className="admin-alert admin-alert-success" role="status">
          {sp.ok}
        </div>
      )}
      {sp.erreur !== undefined && (
        <div className="admin-alert admin-alert-error" role="alert">
          {sp.erreur}
        </div>
      )}
      {aIndemniser.length > 0 && (
        <section className="space-y-[var(--space-admin-3)]" aria-labelledby="indemnites">
          <h2 id="indemnites" className="text-[length:var(--text-admin-lg)] font-semibold">
            Missions annulées, lettre signée : indemnité à décider
          </h2>
          {aIndemniser.map((m, i) => (
            <DecisionIndemnite
              key={m.missionId}
              mission={m}
              saisie={saisies[i] ?? null}
              apercu={apercus[i] ?? null}
              retour={`${base}/qualiopi/formateurs/missions`}
            />
          ))}
        </section>
      )}
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

const SAISIE_PARIS = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** « AAAA-MM-JJTHH:MM » à l'heure de Paris, pour un champ `datetime-local`. */
function saisieParis(d: Date): string {
  return SAISIE_PARIS.format(d).replace(" ", "T");
}

interface SaisieIndemnite {
  readonly brut: string;
  readonly annuleeA: Date;
  readonly parAxion: boolean;
}

/** Les valeurs dont l'aperçu est affiché : celles demandées, sinon la proposition. */
function saisieDemandee(
  sp: { apercu?: string; annuleeA?: string; parAxion?: string },
  m: MissionAIndemniser,
): SaisieIndemnite | null {
  if (sp.apercu === m.missionId) {
    const lu = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(sp.annuleeA ?? "");
    if (lu !== null) {
      try {
        return {
          brut: lu[0],
          annuleeA: instantParis(lu[1]!, lu[2]!),
          parAxion: sp.parAxion === "oui",
        };
      } catch {
        return null;
      }
    }
    return null;
  }
  if (m.annuleeAProposee === null) return null;
  return {
    brut: saisieParis(m.annuleeAProposee),
    annuleeA: m.annuleeAProposee,
    parAxion: true,
  };
}

function DecisionIndemnite({
  mission: m,
  saisie,
  apercu,
  retour,
}: {
  mission: MissionAIndemniser;
  saisie: SaisieIndemnite | null;
  apercu: ApercuIndemnite | null;
  retour: string;
}) {
  const champ = `annulee-${m.missionId}`;
  const htVu = apercu === null ? null : apercu.indemnite.due ? apercu.totaux.totalHtCents : 0;
  return (
    <form
      id={`indemnite-${m.missionId}`}
      action={ecrireIndemniteAnnulationFormAction}
      className="space-y-[var(--space-admin-2)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-[var(--space-admin-4)]"
    >
      <input type="hidden" name="retour" value={retour} />
      <input type="hidden" name="missionId" value={m.missionId} />
      {saisie !== null && htVu !== null && (
        <>
          {/* Ce que l'administrateur voit : l'écriture refuse s'il a changé depuis. */}
          <input type="hidden" name="vuAnnuleeA" value={saisie.brut} />
          <input type="hidden" name="vuParAxion" value={saisie.parAxion ? "oui" : "non"} />
          <input type="hidden" name="montantVuHtCents" value={htVu} />
        </>
      )}
      <p className="text-[length:var(--text-admin-sm)] font-semibold">
        {m.intitule} · {m.numero} · {m.formateur}
      </p>
      {apercu !== null && saisie !== null && (
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {`Aperçu pour une annulation le ${saisie.brut.replace("T", " à ")}${saisie.parAxion ? "" : ", hors du fait d'Axion"} : `}
          {apercu.indemnite.due
            ? `${apercu.demiJourneesAnnulees} demi-journée(s) annulée(s), ${montantEnTexte(apercu.totaux.totalHtCents)} € HT + ${montantEnTexte(apercu.totaux.tvaCents)} € de TVA = ${montantEnTexte(apercu.totaux.totalTtcCents)} € TTC, à régler avant le ${new Date(`${apercu.indemnite.echeance}T12:00:00Z`).toLocaleDateString("fr-FR")}.`
            : "aucune indemnité due (annulation à plus de 72 heures, pas du fait d'Axion, ou aucune demi-journée annulée)."}
        </p>
      )}
      <label htmlFor={champ} className="admin-label">
        Annulée par Axion le (heure de Paris)
      </label>
      <input
        id={champ}
        type="datetime-local"
        name="annuleeA"
        required
        defaultValue={saisie?.brut}
        className="admin-input"
      />
      <label className="flex items-center gap-[var(--space-admin-2)]">
        <input
          type="checkbox"
          name="parAxion"
          value="oui"
          defaultChecked={saisie?.parAxion ?? true}
        />
        L&apos;annulation vient d&apos;Axion (un désistement du formateur n&apos;ouvre aucun droit)
      </label>
      <button
        type="submit"
        name="etape"
        value="apercu"
        formNoValidate
        className="admin-button-secondary min-h-[40px]"
      >
        Voir l&apos;aperçu à cet instant
      </button>
      <label className="flex items-center gap-[var(--space-admin-2)]">
        <input type="checkbox" name="confirmer" value="oui" required />
        Je décide d&apos;écrire l&apos;indemnité de l&apos;aperçu ci-dessus (50 % des demi-journées
        annulées, hors forfait)
      </label>
      <button type="submit" className="admin-button min-h-[40px]">
        Écrire l&apos;indemnité d&apos;annulation
      </button>
    </form>
  );
}
