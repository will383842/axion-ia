/**
 * Admin — Formateurs freelance › Registre des sous-traitants (Qualiopi ind. 27).
 *
 * Non-conformité majeure de l'audit du 16/10 : le registre des sous-traitants était vide
 * alors que l'outil connaît les formateurs indépendants, et la procédure n'avait aucune
 * méthode de contrôle. Cet écran montre :
 *   - la MÉTHODE DE CONTRÔLE appliquée par l'outil (`controles.config.ts`) ;
 *   - le REGISTRE tenu par l'outil : identité légale, NDA, formations habilitées, date
 *     d'entrée, état des pièces, dernier contrôle, prochaine échéance, statut ;
 *   - le RATTRAPAGE des fiches existantes, après aperçu ;
 *   - la TRACE d'un contrôle fait (auteur, date, résultat, motif) ;
 *   - le CONTRÔLE À PREUVES (chaque mission, revue complète annuelle) et ses suites :
 *     suspension pour écart majeur (levée motivée) et plans de correction (J+réglage) ;
 *   - l'export CSV et PDF (date d'export en pied).
 *
 * La ligne de chaque indépendant apparaît aussi au registre général des sous-traitants
 * (`/qualiopi/sous-traitants`), écrite par son service : cet écran ne la double pas.
 *
 * 🔴 LIVRÉ ÉTEINT : `formateurs.registre_sous_traitants` coupé, la page l'annonce et ne
 * lit rien.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { lienTelechargement } from "@/lib/content-disposition";
import { EcranPasEncoreOuvert } from "@/components/admin/qualiopi/EcranPasEncoreOuvert";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { AdminCard } from "@/components/admin/ui/AdminCard";
import { AdminPageHeader } from "@/components/admin/ui/AdminPageHeader";
import { AdminPageShell } from "@/components/admin/ui/AdminPageShell";
import { gardePage } from "@/server/auth/garde-page";
import { peutEngager } from "@/server/auth/habilitations";
import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";
import { INTERRUPTEURS_SIGNATURE } from "@/server/qualiopi/formateurs-independants/interrupteurs";
import {
  CONTROLES_SOUS_TRAITANCE,
  PREUVES_MISSION,
  PREUVES_REVUE_COMPLETE,
  preuvesDuControle,
} from "@/server/qualiopi/formateurs-independants/registre-sous-traitants/controles.config";
import {
  LIBELLES_STATUT_REGISTRE,
  jour,
  libellePiece,
} from "@/server/qualiopi/formateurs-independants/registre-sous-traitants/export";
import {
  PLAFOND_REGISTRE,
  lireMissionsAControler,
  lireRegistre,
} from "@/server/qualiopi/formateurs-independants/registre-sous-traitants/lecture";
import { lireReglagesInd27 } from "@/server/qualiopi/formateurs-independants/registre-sous-traitants/reglages";
import { apercuSynchronisation } from "@/server/qualiopi/formateurs-independants/registre-sous-traitants/synchronisation";
import { parisDateISO } from "@/server/qualiopi/presence/time";

import {
  ControlePreuvesForm,
  CorrigerEcartForm,
  LeverSuspensionForm,
  RattrapageRegistreForm,
  TracerControleForm,
} from "./RegistreGestes";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Formateurs — Registre des sous-traitants | Axion-IA Admin",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ locale: "fr" | "en"; adminPrefix: string }>;
}

const SORTES_APERCU = {
  creer: "Entrée",
  mettre_a_jour: "Mise à jour",
  inchange: "À jour",
} as const;

export default async function RegistreSousTraitantsPage({ params }: PageProps) {
  const { locale, adminPrefix } = await params;
  const acces = await gardePage("consultation", `/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }
  if (!(await interrupteurAllume("registre_sous_traitants"))) {
    return (
      <EcranPasEncoreOuvert
        titre="Registre des sous-traitants"
        interrupteurs={[INTERRUPTEURS_SIGNATURE.registre_sous_traitants.libelle]}
        base={`/${locale}/${adminPrefix}`}
      />
    );
  }

  const maintenant = new Date();
  const [registre, apercu, reglages] = await Promise.all([
    lireRegistre(maintenant),
    apercuSynchronisation(maintenant),
    lireReglagesInd27(),
  ]);
  const missions = await lireMissionsAControler(
    registre.filter((l) => l.statut !== "sorti").map((l) => l.trainerId),
    maintenant,
  );
  const suites = registre.filter((l) => l.suspension !== null || l.corrections.length > 0);
  const aAppliquer = apercu.lignes.filter((l) => l.sorte !== "inchange");
  const peutAgir = peutEngager(acces.role, "habiliter_formateur");
  const base = `/${locale}/${adminPrefix}/qualiopi/formateurs`;
  const exportHref = `${base}/registre-sous-traitants/export`;

  return (
    <AdminPageShell width="wide">
      <AdminPageHeader
        title="Registre des sous-traitants — formateurs indépendants"
        description="Sous-traitance Qualiopi : chaque formateur indépendant au contrat-cadre signé (ou actif) est inscrit par l'outil, et chaque contrôle fait y est tracé. Rien n'est supprimé : une sortie est datée et motivée."
        actions={
          <div className="flex flex-wrap gap-[var(--space-admin-3)]">
            <a href={lienTelechargement(`${exportHref}?format=csv`)} className="admin-button-ghost">
              Exporter (CSV)
            </a>
            <a href={lienTelechargement(`${exportHref}?format=pdf`)} className="admin-button-ghost">
              Exporter (PDF)
            </a>
          </div>
        }
      />

      <p className="admin-meta-small mb-[var(--space-admin-4)]">
        <Link href={base}>← Formateurs</Link> · Ces lignes figurent aussi au{" "}
        <Link href={`/${locale}/${adminPrefix}/qualiopi/sous-traitants`}>
          registre général des sous-traitants
        </Link>
        .
      </p>

      <AdminCard>
        <h2 className="admin-h2">Méthode de contrôle</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Contrôle</th>
              <th scope="col">Quoi</th>
              <th scope="col">Qui</th>
            </tr>
          </thead>
          <tbody>
            {CONTROLES_SOUS_TRAITANCE.map((c) => (
              <tr key={c.code}>
                <td>{c.libelle}</td>
                <td>{c.quoi}</td>
                <td>{c.qui}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className="admin-h3">Preuves attendues à chaque mission</h3>
        <ul>
          {PREUVES_MISSION.map((p) => (
            <li key={p.code}>
              {p.libelle} — absente : écart {p.gravite}
            </li>
          ))}
        </ul>
        <h3 className="admin-h3">Preuves de la revue complète</h3>
        <ul>
          {PREUVES_REVUE_COMPLETE.map((p) => (
            <li key={p.code}>
              {p.libelle} — absente : écart {p.gravite}
            </li>
          ))}
        </ul>
        <p className="admin-meta-small">
          Écart majeur : le sous-traitant est suspendu, ses nouvelles missions sont refusées
          jusqu&apos;à une levée motivée. Écart mineur : plan de correction à{" "}
          {reglages.delaiCorrectionJours} jours, alerte à l&apos;échéance. Revue complète tous les{" "}
          {reglages.revueCompleteMois} mois. Seuils modifiables dans la{" "}
          <Link href={`/${locale}/${adminPrefix}/qualiopi/config`}>configuration Qualiopi</Link>{" "}
          (valeurs à valider par Will).
        </p>
        <p className="admin-meta-small">
          Méthode provisoire, en attendant la procédure de sous-traitance v2.
        </p>
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Registre ({registre.length})</h2>
        {registre.length === PLAFOND_REGISTRE ? (
          <p role="status" className="admin-alert admin-alert-warning">
            Plus de {PLAFOND_REGISTRE} lignes : seules les {PLAFOND_REGISTRE} premières sont lues.
          </p>
        ) : null}
        {registre.length === 0 ? (
          <p>Aucun sous-traitant indépendant au registre. Lancer le rattrapage ci-dessous.</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Raison sociale</th>
                  <th scope="col">SIRET · NDA</th>
                  <th scope="col">Formations habilitées</th>
                  <th scope="col">Entrée</th>
                  <th scope="col">Pièces</th>
                  <th scope="col">Dernier contrôle</th>
                  <th scope="col">Prochaine échéance</th>
                  <th scope="col">Statut</th>
                </tr>
              </thead>
              <tbody>
                {registre.map((l) => {
                  const retards = l.controles.filter((c) => c.enRetard);
                  return (
                    <tr key={l.registreId}>
                      <td>
                        <Link href={`${base}/${l.trainerId}`}>{l.raisonSociale}</Link>
                      </td>
                      <td className="font-mono text-[length:var(--text-admin-xs)]">
                        {l.siret ?? "—"}
                        <br />
                        {l.nda ?? "NDA manquant"}
                      </td>
                      <td className="text-[length:var(--text-admin-xs)]">
                        {l.formationsHabilitees}
                      </td>
                      <td>{jour(l.dateEntree)}</td>
                      <td className="text-[length:var(--text-admin-xs)]">
                        <ul>
                          {l.pieces.map((p) => (
                            <li key={p.code}>
                              {p.libelle} : {libellePiece(p)}
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>{jour(l.dernierControleAt) || "Aucun"}</td>
                      <td>
                        {jour(l.prochaineEcheance) || "—"}
                        {retards.length > 0 ? (
                          <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-warning)]">
                            En retard : {retards.map((c) => c.libelle).join(", ")}
                          </p>
                        ) : null}
                      </td>
                      <td>
                        {LIBELLES_STATUT_REGISTRE[l.statut]} depuis le {jour(l.statutDepuis)}
                        {l.suspension !== null ? (
                          <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-danger)]">
                            Suspendu le {jour(l.suspension.suspenduAt)} — {l.suspension.motif}
                          </p>
                        ) : null}
                        {l.statut === "sorti" ? (
                          <p className="text-[length:var(--text-admin-xs)]">
                            Sortie le {jour(l.dateSortie)} — {l.motifSortie}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      <AdminCard>
        <h2 className="admin-h2">Rattrapage des fiches existantes</h2>
        <p className="admin-meta-small">
          Aperçu de ce que la synchronisation ferait maintenant (elle passe aussi chaque matin).
          Rien n&apos;est écrit avant votre clic ; rejouée, elle ne crée aucun doublon.
        </p>
        {aAppliquer.length === 0 ? (
          <p>Le registre est à jour.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Formateur</th>
                <th scope="col">Action</th>
                <th scope="col">Détail</th>
              </tr>
            </thead>
            <tbody>
              {aAppliquer.map((l) => (
                <tr key={l.trainerId}>
                  <td>
                    <Link href={`${base}/${l.trainerId}`}>{l.libelle}</Link>
                  </td>
                  <td>{SORTES_APERCU[l.sorte]}</td>
                  <td>{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {peutAgir && aAppliquer.length > 0 ? (
          <RattrapageRegistreForm nombre={aAppliquer.length} />
        ) : null}
      </AdminCard>

      {suites.length > 0 ? (
        <AdminCard>
          <h2 className="admin-h2">Suspensions et plans de correction</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Sous-traitant</th>
                <th scope="col">Suspension</th>
                <th scope="col">Plans de correction ouverts</th>
              </tr>
            </thead>
            <tbody>
              {suites.map((l) => (
                <tr key={l.registreId}>
                  <td>{l.raisonSociale}</td>
                  <td>
                    {l.suspension === null ? (
                      "—"
                    ) : (
                      <>
                        <p>
                          Depuis le {jour(l.suspension.suspenduAt)} — {l.suspension.motif}
                        </p>
                        {peutAgir ? <LeverSuspensionForm trainerId={l.trainerId} /> : null}
                      </>
                    )}
                  </td>
                  <td>
                    {l.corrections.length === 0 ? (
                      "—"
                    ) : (
                      <ul>
                        {l.corrections.map((c) => (
                          <li key={c.ecartId}>
                            {c.libelle} — à corriger avant le {jour(c.echeance)}
                            {c.echeance.getTime() <= maintenant.getTime() ? " (échu)" : ""}
                            {peutAgir ? <CorrigerEcartForm ecartId={c.ecartId} /> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminCard>
      ) : null}

      {peutAgir ? (
        <AdminCard>
          <h2 className="admin-h2">Contrôle d&apos;une mission ou revue complète</h2>
          <p className="admin-meta-small">
            Cocher chaque preuve présente : le résultat et les écarts en découlent.
          </p>
          <ControlePreuvesForm
            formateurs={registre
              .filter((l) => l.statut !== "sorti")
              .map((l) => ({ trainerId: l.trainerId, libelle: l.raisonSociale }))}
            missions={missions}
            preuvesMission={PREUVES_MISSION}
            preuvesRevue={PREUVES_REVUE_COMPLETE}
            aujourdhui={parisDateISO(maintenant)}
          />
        </AdminCard>
      ) : null}

      {peutAgir ? (
        <AdminCard>
          <h2 className="admin-h2">Tracer un contrôle fait</h2>
          <TracerControleForm
            formateurs={registre.map((l) => ({ trainerId: l.trainerId, libelle: l.raisonSociale }))}
            controles={CONTROLES_SOUS_TRAITANCE.filter(
              (c) => preuvesDuControle(c.code) === null,
            ).map((c) => ({ code: c.code, libelle: c.libelle }))}
            aujourdhui={parisDateISO(maintenant)}
          />
        </AdminCard>
      ) : null}

      {registre.some((l) => l.traces.length > 0) ? (
        <AdminCard>
          <h2 className="admin-h2">Contrôles tracés</h2>
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Sous-traitant</th>
                <th scope="col">Contrôle</th>
                <th scope="col">Fait le</th>
                <th scope="col">Résultat</th>
                <th scope="col">Motif</th>
              </tr>
            </thead>
            <tbody>
              {registre.flatMap((l) =>
                l.traces.map((t, i) => (
                  <tr key={`${l.registreId}-${i}`}>
                    <td>{l.raisonSociale}</td>
                    <td>
                      {CONTROLES_SOUS_TRAITANCE.find((c) => c.code === t.code)?.libelle ?? t.code}
                    </td>
                    <td>{jour(t.faitAt)}</td>
                    <td>
                      {t.resultat === "conforme"
                        ? "Conforme"
                        : t.resultat === "non_conforme"
                          ? "Non conforme"
                          : "À revoir"}
                    </td>
                    <td>{t.motif ?? "—"}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </AdminCard>
      ) : null}
    </AdminPageShell>
  );
}
