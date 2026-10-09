// Réseau d'apporteurs (démarrage manuel, 2026-10-05) — les COMMISSIONS.
// Virements à faire (autofactures émises dès l'encaissement : « Virement fait »), puis la liste
// par statut, avec « Qualifier » pour une formation. Export annuel des versements (DAS2).

import Link from "next/link";

import { AdminBadge, AdminCard, AdminPageHeader, AdminStatCard } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { AdminFilterTabs } from "@/components/admin/ui/AdminFilterTabs";
import {
  QualifierForm,
  VerserForm,
} from "@/components/admin/apporteurs/commissions/FormulairesCommission";
import {
  ajusterCommissionAction,
  constaterNonCommissionneAction,
  marquerHorsGrilleAction,
  annulerRealisationAction,
  classerActiviteAction,
  leverSuspensionAction,
  marquerRealiseeAction,
  suspendreCommissionAction,
} from "@/features/apporteurs-reseau/actions-commissions";
import {
  etatHorsGrille,
  LIBELLE_HORS_GRILLE,
  libelleAQualifier,
  PALIER_HORS_GRILLE,
} from "@/features/apporteurs-reseau/hors-grille";
import {
  COMMISSIONS_PAR_PAGE,
  compterCommissions,
  lireCommissions,
} from "@/features/apporteurs-reseau/commissions";
import {
  lireVirementsAFaire,
  PREFIXE_MOTIF_SOLDE_NEGATIF,
} from "@/features/apporteurs-reseau/facturation";
import { dateFr, etatEcheances } from "@/features/apporteurs-reseau/autofacture-donnees";
import {
  euros,
  FORFAIT_CONFERENCE_CENTS,
  PALIER_CONFERENCE,
  PALIERS_FORMATION,
} from "@/features/apporteurs-reseau/regles";
import { peutEngager } from "@/server/auth/habilitations";
import { gardePage } from "@/server/auth/garde-page";
import type { StatutCommissionApporteur } from "../../../../../../../prisma/generated/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

const ONGLETS: ReadonlyArray<{ cle: StatutCommissionApporteur; libelle: string }> = [
  { cle: "a_qualifier", libelle: "À qualifier" },
  { cle: "due", libelle: "Dues (facturées)" },
  { cle: "en_attente_vigilance", libelle: "Attente vigilance" },
  { cle: "versee", libelle: "Versées" },
  { cle: "reprise", libelle: "Reprises" },
  { cle: "annulee", libelle: "Annulées" },
  { cle: "retenue", libelle: "Retenues (manquement)" },
];

const ACTIVITE: Record<string, string> = {
  formation: "Formation",
  un_a_un: "1-to-1",
  audit: "Audit",
  implementation: "Intégration",
  site_web: "Site web",
  conference: "Conférence",
};

/**
 * Objectif de virement (2 jours ouvrés, sans pénalité : ORANGE s'il est dépassé, jamais rouge) et
 * échéance ferme de 30 jours (ROUGE seulement une fois dépassée).
 */
function Echeances({ emission, maintenant }: { emission: Date; maintenant: Date }) {
  const e = etatEcheances(emission, maintenant);
  return (
    <p className="text-[length:var(--text-admin-sm)]">
      <span style={e.objectifDepasse ? { color: "var(--color-admin-warning)" } : undefined}>
        Objectif de virement : avant le {dateFr(e.objectif)}
        {e.objectifDepasse ? " (dépassé)" : ""}
      </span>
      {" · "}
      <span
        style={e.echeanceDepassee ? { color: "var(--color-admin-destructive)" } : undefined}
        className={e.echeanceDepassee ? "font-semibold" : undefined}
      >
        échéance : {dateFr(e.echeance)}
        {e.echeanceDepassee ? " (dépassée)" : ""}
      </span>
    </p>
  );
}

function LienPdf({ numero, base }: { numero: string; base: string }) {
  return (
    <a
      href={`${base}/autofacture?numero=${encodeURIComponent(numero)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="underline"
    >
      {numero} (PDF)
    </a>
  );
}

const PALIERS = [
  ...PALIERS_FORMATION.map((p) => ({
    id: p.id,
    libelle: p.libelle,
    detail: `${euros(p.forfaitCents)} si ${euros(p.prixCents)} HT`,
  })),
  {
    id: PALIER_CONFERENCE,
    libelle: "Conférence (500 € fixes)",
    detail: `${euros(FORFAIT_CONFERENCE_CENTS)} par commande`,
  },
];

export default async function CommissionsApporteursPage({ params, searchParams }: PageProps) {
  const { adminPrefix } = await params;
  const acces = await gardePage("consultation", `/fr/${adminPrefix}/login`);
  if (!acces.autorise) return <AccesRefuse motif={acces.motif} retourHref={`/fr/${adminPrefix}`} />;
  const peutPayer = peutEngager(acces.role, "facturer");
  const sp = await searchParams;
  const base = `/fr/${adminPrefix}/apporteurs/commissions`;
  const maintenant = new Date();
  const comptes = await compterCommissions();
  const ongletDefaut = comptes.a_qualifier > 0 ? "a_qualifier" : "due";
  const onglet = ONGLETS.find((o) => o.cle === sp.statut)?.cle ?? ongletDefaut;
  const pages = Math.max(1, Math.ceil(comptes[onglet] / COMMISSIONS_PAR_PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1));
  const [lignes, virements] = await Promise.all([
    lireCommissions(onglet, page),
    lireVirementsAFaire(),
  ]);
  const annee = maintenant.getUTCFullYear();

  return (
    <div className="flex flex-col gap-[var(--space-admin-5)]">
      <AdminPageHeader
        title="Commissions apporteurs"
        description="Nées des factures soldées des entreprises protégées."
        actions={
          <div className="flex flex-wrap gap-[var(--space-admin-2)]">
            {[annee - 1, annee].map((a) => (
              <a key={a} href={`${base}/export?annee=${a}`} className="admin-button-secondary">
                ⬇️ Versements {a} (DAS2)
              </a>
            ))}
          </div>
        }
      />
      {sp.retour ? (
        <p role="status" className="text-[color:var(--color-admin-success)]">
          {sp.retour.slice(0, 300)}
        </p>
      ) : null}
      {sp.erreur ? (
        <p role="alert" className="text-[color:var(--color-admin-danger)]">
          {sp.erreur.slice(0, 300)}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-[var(--space-admin-3)] md:grid-cols-4">
        <AdminStatCard
          label="À qualifier"
          value={comptes.a_qualifier}
          href={`${base}?statut=a_qualifier`}
        />
        <AdminStatCard label="Dues" value={comptes.due} href={`${base}?statut=due`} />
        <AdminStatCard
          label="Attente vigilance"
          value={comptes.en_attente_vigilance}
          href={`${base}?statut=en_attente_vigilance`}
        />
        <AdminStatCard label="Versées" value={comptes.versee} href={`${base}?statut=versee`} />
      </div>

      <AdminCard as="section">
        <h2 className="mb-[var(--space-admin-3)] font-semibold">💶 Virements à faire</h2>
        {virements.length === 0 ? (
          <p className="text-[color:var(--color-admin-fg-muted)]">
            Aucun virement en attente : chaque commission est facturée dès que le client a payé.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-[color:var(--color-admin-border)]">
            {virements.map((v) => (
              <li
                key={v.numero}
                className="flex flex-wrap items-center justify-between gap-[var(--space-admin-3)] py-[var(--space-admin-3)]"
              >
                <div>
                  <Link
                    href={`/fr/${adminPrefix}/apporteurs/${v.apporteurId}`}
                    className="font-medium"
                  >
                    {v.apporteur}
                  </Link>
                  <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                    {euros(v.totalCents)} · {v.lignes} ligne(s) ·{" "}
                    <LienPdf numero={v.numero} base={base} />
                  </p>
                  <Echeances emission={v.emissionAt} maintenant={maintenant} />
                </div>
                {peutPayer ? (
                  <VerserForm
                    apporteurId={v.apporteurId}
                    numero={v.numero}
                    montant={euros(v.totalCents)}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </AdminCard>

      <AdminFilterTabs
        current={onglet}
        options={ONGLETS.map((o) => ({
          value: o.cle,
          label: o.libelle,
          href: `${base}?statut=${o.cle}`,
          count: comptes[o.cle],
        }))}
      />

      {lignes.length === 0 ? (
        <p className="text-[color:var(--color-admin-fg-muted)]">Rien ici.</p>
      ) : (
        <div className="grid gap-[var(--space-admin-3)] lg:grid-cols-2">
          {lignes.map((c) => (
            <AdminCard key={c.id} as="article" variant="compact">
              <div className="flex flex-col gap-[var(--space-admin-2)]">
                <div className="flex flex-wrap items-start justify-between gap-[var(--space-admin-2)]">
                  <div>
                    <p className="font-semibold">
                      {c.montantCents !== null ? euros(c.montantCents) : "—"}{" "}
                      <span className="font-normal text-[color:var(--color-admin-fg-muted)]">
                        · {c.apporteur}
                      </span>
                    </p>
                    <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                      {c.entreprise ?? "?"} · {ACTIVITE[c.activite] ?? c.activite} · facture{" "}
                      {c.factureNumero ?? "?"} ({euros(c.factureHtCents)} HT)
                    </p>
                  </div>
                  <div className="flex gap-[var(--space-admin-1)]">
                    {c.parrainage ? <AdminBadge tone="info">Parrainage</AdminBadge> : null}
                    {c.autofactureNumero ? (
                      <AdminBadge tone="outline">{c.autofactureNumero}</AdminBadge>
                    ) : null}
                  </div>
                </div>
                {c.statut === "due" && c.autofactureNumero ? (
                  <>
                    <p className="text-[length:var(--text-admin-sm)]">
                      Facturée : <LienPdf numero={c.autofactureNumero} base={base} />
                    </p>
                    <Echeances emission={c.emissionAt} maintenant={maintenant} />
                  </>
                ) : null}
                {c.statut === "reprise" && c.avoirNumero ? (
                  <p className="text-[length:var(--text-admin-sm)]">
                    Avoir : <LienPdf numero={c.avoirNumero} base={base} />
                  </p>
                ) : null}
                {c.statut === "due" && !c.autofactureNumero && c.autofactureAttenteMotif ? (
                  <p
                    className="text-[length:var(--text-admin-sm)]"
                    style={{ color: "var(--color-admin-warning)" }}
                  >
                    {c.autofactureAttenteMotif.startsWith(PREFIXE_MOTIF_SOLDE_NEGATIF)
                      ? `Autofacture en attente — ${c.autofactureAttenteMotif} (art. 12.4) : elle partira quand les commissions dues le couvriront`
                      : `Autofacture en attente : il manque ${c.autofactureAttenteMotif}`}
                    {c.autofactureAttenteDepuis
                      ? ` (depuis le ${dateFr(c.autofactureAttenteDepuis)})`
                      : ""}
                    . Complétez la{" "}
                    <a
                      href={`/fr/${adminPrefix}/apporteurs/${c.apporteurId}`}
                      className="underline"
                    >
                      fiche de l&apos;apporteur
                    </a>{" "}
                    : elle partira d&apos;elle-même dans l&apos;heure.
                  </p>
                ) : null}
                {/* Essai réel du 09/10 : « part dans l'heure » s'affichait à côté de « En attente de
                    réalisation : ni facturée ni versée ». Rien ne part avant la réalisation, ni
                    pendant une contestation : la phrase ne vaut qu'après. */}
                {c.statut === "due" &&
                !c.autofactureNumero &&
                !c.autofactureAttenteMotif &&
                c.prestationRealiseeAt &&
                !c.litigeDepuis ? (
                  <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                    Autofacture à émettre : elle part automatiquement dans l&apos;heure (si elle ne
                    part pas, vérifiez l&apos;identité et le régime de TVA de l&apos;apporteur).
                  </p>
                ) : null}
                {c.statut === "due" ||
                c.statut === "a_qualifier" ||
                c.statut === "en_attente_vigilance" ? (
                  c.prestationRealiseeAt ? (
                    <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
                      <p className="text-[length:var(--text-admin-sm)]">
                        Prestation réalisée le {dateFr(c.prestationRealiseeAt)}
                        {c.prestationRealiseePar === "session-realisee"
                          ? " (session de formation terminée)"
                          : ""}
                        .
                      </p>
                      {peutPayer && !c.autofactureNumero ? (
                        <form action={annulerRealisationAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className="admin-button-secondary">
                            Annuler
                          </button>
                        </form>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-end gap-[var(--space-admin-2)]">
                      <p
                        className="text-[length:var(--text-admin-sm)] font-semibold"
                        style={{ color: "var(--color-admin-warning)" }}
                      >
                        En attente de réalisation : ni facturée ni versée
                        {c.prestationRealiseePar === "annulee-console"
                          ? " (réalisation annulée à la main : plus de passage automatique)"
                          : ""}
                        .
                      </p>
                      {peutPayer ? (
                        <form
                          action={marquerRealiseeAction}
                          className="flex flex-wrap items-end gap-[var(--space-admin-2)]"
                        >
                          <input type="hidden" name="id" value={c.id} />
                          <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
                            Réalisée le
                            <input
                              type="date"
                              name="realiseeLe"
                              required
                              className="admin-input"
                              defaultValue={maintenant.toISOString().slice(0, 10)}
                            />
                          </label>
                          <button type="submit" className="admin-button">
                            Marquer la prestation réalisée
                          </button>
                        </form>
                      ) : null}
                    </div>
                  )
                ) : null}
                {c.litigeDepuis ? (
                  <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
                    <p
                      className="text-[length:var(--text-admin-sm)]"
                      style={{ color: "var(--color-admin-warning)" }}
                    >
                      Suspendue depuis le {dateFr(c.litigeDepuis)} : contestation écrite du client
                      {c.litigeMotif ? ` (${c.litigeMotif})` : ""}. Ni facturée ni versée.
                    </p>
                    {peutPayer ? (
                      <form action={leverSuspensionAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <button type="submit" className="admin-button-secondary">
                          Lever la suspension
                        </button>
                      </form>
                    ) : null}
                  </div>
                ) : peutPayer &&
                  (c.statut === "due" ||
                    c.statut === "a_qualifier" ||
                    c.statut === "en_attente_vigilance") ? (
                  <details className="text-[length:var(--text-admin-sm)]">
                    <summary className="cursor-pointer">
                      Le client conteste par écrit : suspendre
                    </summary>
                    <form
                      action={suspendreCommissionAction}
                      className="mt-[var(--space-admin-2)] flex flex-wrap items-end gap-[var(--space-admin-2)]"
                    >
                      <input type="hidden" name="id" value={c.id} />
                      <input
                        name="motif"
                        className="admin-input"
                        required
                        maxLength={300}
                        aria-label="Contestation du client"
                        placeholder="Date et objet de la contestation écrite"
                      />
                      <button type="submit" className="admin-button-secondary">
                        Suspendre la commission
                      </button>
                    </form>
                  </details>
                ) : null}
                {peutPayer &&
                !c.autofactureNumero &&
                !c.parrainage &&
                (c.statut === "due" ||
                  c.statut === "a_qualifier" ||
                  c.statut === "en_attente_vigilance") ? (
                  <details className="text-[length:var(--text-admin-sm)]">
                    <summary className="cursor-pointer">Réduire ou annuler</summary>
                    <form
                      action={ajusterCommissionAction}
                      className="mt-[var(--space-admin-2)] flex flex-col gap-[var(--space-admin-2)]"
                    >
                      <input type="hidden" name="id" value={c.id} />
                      <label className="flex items-center gap-[var(--space-admin-2)]">
                        <input type="radio" name="mode" value="reduire" defaultChecked />
                        Prix HT net conservé
                        <input
                          name="prix"
                          inputMode="decimal"
                          placeholder="1500"
                          className="admin-input"
                          aria-label="Prix HT net conservé en euros"
                        />
                        € (la commission est recalculée par la règle du contrat)
                      </label>
                      <label className="flex items-center gap-[var(--space-admin-2)]">
                        <input type="radio" name="mode" value="annuler" />
                        Annuler la commission (commande annulée, prestation non réalisée, démentie)
                      </label>
                      <input
                        name="motif"
                        required
                        maxLength={300}
                        className="admin-input"
                        aria-label="Motif"
                        placeholder="Motif (prix conservé, annulation, démenti…)"
                      />
                      <label className="flex items-center gap-[var(--space-admin-2)]">
                        <input type="checkbox" name="confirmer" value="oui" required />
                        Je confirme : tracé au journal, la ligne reste conservée.
                      </label>
                      <div>
                        <button type="submit" className="admin-button-secondary">
                          Enregistrer
                        </button>
                      </div>
                    </form>
                  </details>
                ) : null}
                {c.palier ? (
                  <p className="text-[length:var(--text-admin-sm)]">
                    {c.palier === PALIER_CONFERENCE
                      ? "Conférence"
                      : (PALIERS_FORMATION.find((p) => p.id === c.palier)?.libelle ??
                        (c.palier === PALIER_HORS_GRILLE ? LIBELLE_HORS_GRILLE : c.palier))}
                  </p>
                ) : null}
                {c.statut === "a_qualifier" && !c.parrainage
                  ? (() => {
                      const e = etatHorsGrille(c.encaisseeAt, maintenant);
                      return (
                        <p
                          className="text-[length:var(--text-admin-sm)] font-semibold"
                          style={{
                            color: e.depassee
                              ? "var(--color-admin-destructive)"
                              : "var(--color-admin-warning)",
                          }}
                        >
                          {libelleAQualifier(c)} :{" "}
                          {e.depassee
                            ? `délai de 60 jours après l'encaissement dépassé depuis le ${dateFr(e.echeance)} — à défaut de décision, elle est due au taux de la grille publiée à la date de la vente, une fois la prestation réalisée et payée (A1.7, art. 4.2).`
                            : `à régler avant le ${dateFr(e.echeance)} (60 jours après l'encaissement, A1.7).`}
                        </p>
                      );
                    })()
                  : null}
                {c.statut === "a_qualifier" &&
                !c.parrainage &&
                c.activite === "formation" &&
                peutPayer ? (
                  c.palier === PALIER_HORS_GRILLE ? (
                    <details className="text-[length:var(--text-admin-sm)]">
                      <summary className="cursor-pointer">Produit non commissionné (A1.7)</summary>
                      <form
                        action={constaterNonCommissionneAction}
                        className="mt-[var(--space-admin-2)] flex flex-col gap-[var(--space-admin-2)]"
                      >
                        <input type="hidden" name="id" value={c.id} />
                        <input
                          name="motif"
                          required
                          minLength={10}
                          maxLength={500}
                          className="admin-input"
                          aria-label="Motif"
                          placeholder="Motif (communiqué à l'apporteur)"
                        />
                        <label className="flex items-center gap-[var(--space-admin-2)]">
                          <input type="checkbox" name="confirmer" value="oui" required />
                          Je confirme : l&apos;apporteur reçoit la décision et son motif.
                        </label>
                        <div>
                          <button type="submit" className="admin-button-secondary">
                            Constater non commissionné
                          </button>
                        </div>
                      </form>
                    </details>
                  ) : (
                    <form action={marquerHorsGrilleAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="admin-button-secondary">
                        Produit hors grille (A1.7)
                      </button>
                    </form>
                  )
                ) : null}
                {c.statut === "a_qualifier" &&
                !c.parrainage &&
                c.activite === "formation" &&
                peutPayer ? (
                  <QualifierForm id={c.id} paliers={PALIERS} />
                ) : null}
                {c.statut === "a_qualifier" && c.parrainage ? (
                  <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                    Calculée quand la commission du filleul sera qualifiée.
                  </p>
                ) : null}
                {c.statut === "a_qualifier" &&
                !c.parrainage &&
                c.activite !== "formation" &&
                peutPayer ? (
                  <form
                    action={classerActiviteAction}
                    className="flex flex-wrap items-end gap-[var(--space-admin-2)]"
                  >
                    <input type="hidden" name="id" value={c.id} />
                    <label className="flex flex-col gap-1 text-[length:var(--text-admin-sm)]">
                      Activité de la facture (inconnue)
                      <select name="activite" className="admin-input" defaultValue="">
                        <option value="" disabled>
                          Choisir…
                        </option>
                        <option value="formation">Formation (puis palier)</option>
                        <option value="un_a_un">1-to-1 (30 %)</option>
                        <option value="audit">Audit (30 %)</option>
                        <option value="implementation">Intégration (15 %)</option>
                        <option value="conference">Conférence (500 € fixes)</option>
                        <option value="site_web">Site web (aucune commission)</option>
                      </select>
                    </label>
                    <button type="submit" className="admin-button-secondary">
                      Classer
                    </button>
                  </form>
                ) : null}
              </div>
            </AdminCard>
          ))}
        </div>
      )}
      {pages > 1 ? (
        <nav aria-label="Pages" className="flex items-center gap-[var(--space-admin-3)]">
          {page > 1 ? (
            <Link
              href={`${base}?statut=${onglet}&page=${page - 1}`}
              className="admin-button-secondary"
            >
              Précédent
            </Link>
          ) : null}
          <span className="text-[color:var(--color-admin-fg-muted)]">
            Page {page} sur {pages}
          </span>
          {page < pages ? (
            <Link
              href={`${base}?statut=${onglet}&page=${page + 1}`}
              className="admin-button-secondary"
            >
              Suivant
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
