// Coaching 1-to-1 — détail d'une séance (lecture seule admin).

import { notFound } from "next/navigation";
import Link from "next/link";
import { getSessionAdmin } from "@/server/coaching-admin/queries";
import {
  coachingInterventionLabel,
  optimisationTypeLabel,
  sessionStatutLabel,
} from "@/server/formateur/coaching-options";
import { sumHeuresReelles } from "@/server/qualiopi/coaching-afest/heures";
import { AfestPanel } from "@/components/admin/coaching/AfestPanel";
import { RegistreSignaturesAfest } from "@/components/admin/coaching/RegistreSignaturesAfest";
import { listerRegistreSeancesAfest } from "@/server/qualiopi/coaching-afest/signature/registre-seances";

const dateFmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

/** Date → "yyyy-mm-dd" pour un <input type="date"> (null si absente). */
function toDateInput(d: Date | null): string | null {
  if (!d) return null;
  return new Date(d).toISOString().slice(0, 10);
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="border-border bg-cream rounded-lg border p-4">
      <h2 className="text-mocha mb-2 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  return (
    <p className="text-sm">
      <span className="text-fg-muted">{label} : </span>
      {value || "—"}
    </p>
  );
}

export default async function AdminSeanceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; locale: string; adminPrefix: string }>;
  /** Codes de retour de la révocation, transmis par l'URL — jamais un message. */
  searchParams: Promise<{ revocation?: string; raison?: string }>;
}): Promise<React.ReactElement> {
  const { id, locale, adminPrefix } = await params;
  const { revocation, raison } = await searchParams;
  const s = await getSessionAdmin(id);
  if (!s) notFound();
  const seancesHref = `/${locale}/${adminPrefix}/coaching/seances`;
  const cheminCourant = `/${locale}/${adminPrefix}/coaching/seances/${s.id}`;
  const heuresReelles = sumHeuresReelles(s.comptesRendus);
  // 🔴 Les signatures RÉELLES, à côté de la présence DÉCLARÉE qu'affiche le
  // panneau AFEST. N'en montrer qu'une des deux reviendrait à présenter comme
  // preuve ce qui n'est qu'une déclaration de l'organisme.
  const registreSignatures = await listerRegistreSeancesAfest(s.id);

  return (
    <div className="space-y-4">
      <div>
        <Link href={seancesHref} className="text-terracotta text-xs hover:underline">
          ← Séances
        </Link>
        <h1 className="text-mocha mt-1 text-xl font-semibold">
          {coachingInterventionLabel(s.interventionSlug)}
        </h1>
        <p className="text-fg-muted text-sm">
          {dateFmt.format(s.dateSeance)} · {sessionStatutLabel(s.statut)} · Formateur :{" "}
          {s.trainer.prenom} {s.trainer.nom}
        </p>
        <p className="text-fg-muted text-sm">
          Bénéficiaire : {s.beneficiaireNom ?? "—"}
          {s.beneficiaireEntreprise ? ` (${s.beneficiaireEntreprise})` : ""}
        </p>
      </div>

      <AfestPanel
        coachingSessionId={s.id}
        revalidatePath={`/${locale}/${adminPrefix}/coaching/seances/${s.id}`}
        estAfest={s.estAfest}
        heuresReelles={heuresReelles}
        heuresPrevues={s.heuresPrevuesConvention != null ? Number(s.heuresPrevuesConvention) : null}
        tuteurNom={s.tuteurEntrepriseNom}
        tuteurEmail={s.tuteurEntrepriseEmail}
        attestationResultat={s.attestationResultat}
        coachingContractId={s.coachingContractId}
        financement={
          s.coachingContract
            ? {
                financementType: s.coachingContract.financementType,
                montantHtCents: s.coachingContract.montantHtCents,
                subrogation: s.coachingContract.subrogation,
                numeroDossierOpco: s.coachingContract.numeroDossierOpco,
                conventionTripartiteSigneeAt: toDateInput(
                  s.coachingContract.conventionTripartiteSigneeAt,
                ),
                priseEnChargeMontantCents: s.coachingContract.priseEnChargeMontantCents,
                priseEnChargeUnite: s.coachingContract.priseEnChargeUnite,
                edofVerifieAt: toDateInput(s.coachingContract.edofVerifieAt),
                resteAChargeCents: s.coachingContract.resteAChargeCents,
                ftDispositif: s.coachingContract.ftDispositif,
                ftAifPrescriptionDate: toDateInput(s.coachingContract.ftAifPrescriptionDate),
                ftPoeiOffreEmploiNumero: s.coachingContract.ftPoeiOffreEmploiNumero,
              }
            : null
        }
        certification={{
          certificationType: s.certificationType,
          codeRncp: s.codeRncp,
          codeRs: s.codeRs,
          cpfEligible: s.cpfEligible,
        }}
        seances={s.comptesRendus.map((c) => ({
          id: c.id,
          date: dateFmt.format(c.dateSeance),
          presenceSignee: c.presenceSigneeAt != null,
        }))}
        documents={s.documentsGeneres}
      />

      <RegistreSignaturesAfest
        registre={registreSignatures}
        cheminRetour={cheminCourant}
        revocation={revocation}
        raison={raison}
      />

      <Block title="Cartographie de l'activité">
        {s.cartographie ? (
          <div className="space-y-1">
            <Line
              label="Tâches recensées"
              value={String((s.cartographie.taches as unknown[])?.length ?? 0)}
            />
            <Line label="Chronophages" value={s.cartographie.chronophages} />
            <Line label="Irritants" value={s.cartographie.irritants} />
            <Line label="Contraintes" value={s.cartographie.contraintes} />
          </div>
        ) : (
          <p className="text-fg-muted text-sm">Non renseignée.</p>
        )}
      </Block>

      <Block title={`Optimisations (${s.optimisations.length})`}>
        {s.optimisations.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {s.optimisations.map((o) => (
              <li key={o.id} className="flex items-center justify-between">
                <span>
                  {o.titre}{" "}
                  <span className="text-fg-muted text-xs">({optimisationTypeLabel(o.type)})</span>
                </span>
                {o.retenue ? <span className="text-success text-xs">retenue</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-fg-muted text-sm">Aucune.</p>
        )}
      </Block>

      <Block title="Plan d'optimisation">
        {s.plan ? (
          <div className="space-y-1">
            <Line label="Objectifs" value={s.plan.objectifs} />
            <Line
              label="Gain estimé"
              value={s.plan.gainTempsHSemaine != null ? `${s.plan.gainTempsHSemaine} h/sem` : null}
            />
            <Line label="Suivi proposé" value={s.plan.suiviPropose} />
          </div>
        ) : (
          <p className="text-fg-muted text-sm">Non établi.</p>
        )}
      </Block>

      <Block title={`Comptes-rendus (${s.comptesRendus.length})`}>
        {s.comptesRendus.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {s.comptesRendus.map((c) => (
              <li key={c.id}>
                <span className="text-mocha">{dateFmt.format(c.dateSeance)}</span>
                {c.dureeMinutes ? ` · ${c.dureeMinutes} min` : ""}
                {c.planRemis ? " · plan remis" : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-fg-muted text-sm">Aucun.</p>
        )}
      </Block>

      <Block title={`Journal de progression (${s.journaux.length})`}>
        {s.journaux.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {s.journaux.map((j) => (
              <li key={j.id}>
                <span className="text-mocha">{j.periode ?? "Entrée"}</span>
                {j.gainTempsCumuleHSem != null ? ` · ${j.gainTempsCumuleHSem} h/sem` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-fg-muted text-sm">Aucune entrée.</p>
        )}
      </Block>
    </div>
  );
}
