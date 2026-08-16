// Corps visuel du journal des e-mails envoyés.
//
// Séparé de la page dès l'écriture : la page fait `auth()` puis lit la base,
// ce qui la rend impossible à afficher sans session. Ce composant ne dépend
// que de ses propriétés, donc son rendu reste vérifiable dans un navigateur, à
// n'importe quelle largeur, sans identifiants.

import Link from "next/link";
import {
  AdminPageHeader,
  AdminStatCard,
  AdminTable,
  AdminEmptyState,
  AdminPagination,
  type AdminTableColumn,
} from "@/components/admin/ui";
import {
  FENETRES_EMAILS,
  type ChargementEmails,
  type FiltresEmails,
  type LigneEmail,
} from "@/features/admin-emails/query";

const nb = (n: number): string => n.toLocaleString("fr-FR");

const quand = (d: Date | null): string =>
  d
    ? new Date(d).toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const LIBELLES_STATUT: Readonly<Record<string, string>> = {
  sent: "Envoyé",
  failed: "Échec",
  pending: "En attente",
};

export function VueEmails({
  donnees,
  filtres,
  adminPrefix,
}: {
  donnees: ChargementEmails;
  filtres: FiltresEmails;
  adminPrefix: string;
}): React.ReactElement {
  const base = `/fr/${adminPrefix}/emails-envoyes`;

  /** Conserve tous les filtres d'un lien à l'autre — sinon chaque clic en perd un. */
  const lien = (modif: Partial<FiltresEmails>): string => {
    const f = { ...filtres, ...modif };
    const p = new URLSearchParams();
    p.set("fenetre", String(f.jours));
    if (f.statut) p.set("statut", f.statut);
    if (f.gabarit) p.set("gabarit", f.gabarit);
    if (f.destinataire) p.set("destinataire", f.destinataire);
    // Tout changement de filtre ramène en page 1 : rester en page 7 d'un jeu
    // qui n'en compte plus que 2 afficherait un tableau vide sans raison
    // visible.
    if (modif.page !== undefined && modif.page > 1) p.set("page", String(modif.page));
    return `${base}?${p.toString()}`;
  };

  const colonnes: ReadonlyArray<AdminTableColumn<LigneEmail>> = [
    {
      key: "quand",
      header: "Date",
      cell: (r) => quand(r.sentAt ?? r.createdAt),
      width: "16%",
    },
    {
      key: "gabarit",
      header: "Gabarit et destinataire",
      // 🔴 Les deux dans la MÊME cellule, et jamais masqués.
      // Version initiale : deux colonnes, le destinataire caché sous 640 px.
      // Vu à l'écran, une ligne en échec n'apprenait alors rien — savoir qu'un
      // envoi a raté sans savoir POUR QUI est inexploitable, et c'est
      // précisément sur mobile qu'on consulte en urgence.
      cell: (r) => (
        <>
          <span>{r.template}</span>
          <br />
          <span className="admin-meta-small break-all">{r.recipient}</span>
        </>
      ),
      width: "44%",
    },
    {
      key: "statut",
      header: "Statut",
      align: "right",
      cell: (r) => (
        <span className={r.status === "failed" ? "admin-severity-critical" : undefined}>
          {LIBELLES_STATUT[r.status] ?? r.status}
          {r.attempts > 1 ? ` (${r.attempts} essais)` : ""}
        </span>
      ),
    },
    {
      key: "detail",
      header: "Détail",
      cell: (r) =>
        r.error ? (
          // L'erreur est la seule information vraiment actionnable d'une ligne
          // en échec : on la montre, tronquée, plutôt que de la cacher derrière
          // un clic.
          <span className="admin-meta-small">{r.error.slice(0, 90)}</span>
        ) : r.entityType ? (
          <span className="admin-meta-small">
            {r.entityType}
            {r.entityId ? ` · ${r.entityId.slice(0, 8)}` : ""}
          </span>
        ) : (
          <span className="admin-meta-small">—</span>
        ),
      hiddenBelow: "lg",
    },
  ];

  return (
    <>
      <AdminPageHeader
        title="E-mails envoyés"
        description="Tout ce qui est réellement parti : gabarit, destinataire, résultat."
        actions={
          <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
            <nav aria-label="Période" className="flex flex-wrap gap-[var(--space-admin-2)]">
              {FENETRES_EMAILS.map((f) => (
                <Link
                  key={f.jours}
                  href={lien({ jours: f.jours, page: 1 })}
                  className={
                    f.jours === filtres.jours
                      ? "admin-button admin-button-sm"
                      : "admin-button-ghost"
                  }
                  aria-current={f.jours === filtres.jours ? "page" : undefined}
                >
                  {f.libelle}
                </Link>
              ))}
            </nav>
            {/*
              Tableau de bord du relais (2026-08-16, demande Will après la
              bascule vers ZeptoMail).

              Sa place est ICI et non dans la navigation : `admin-nav.test.ts`
              verrouille l'invariant « tout href de la nav est une route interne
              préfixée », et cet invariant n'est pas décoratif — la mise en
              surbrillance de l'entrée active compare des chemins.

              Sa place est ici pour une seconde raison, meilleure : les deux
              écrans répondent à la même question — « mes e-mails partent-ils ? »
              — mais depuis les deux bouts de la chaîne. Ce tableau dit ce que
              l'application a TENTÉ ; ZeptoMail dit ce que le relais a réellement
              REMIS, et ce qui a rebondi. L'écart entre les deux EST
              l'information, et tant qu'aucun endpoint de rebond n'existe, la
              comparer à l'œil est le seul moyen de voir un destinataire qui n'a
              rien reçu.
            */}
            <a
              href="https://zeptomail.zoho.eu/"
              target="_blank"
              rel="noopener noreferrer"
              className="admin-button-ghost"
              title="Compteurs envoyés / livrés / rebonds, côté relais"
            >
              ZeptoMail ↗
            </a>
          </div>
        }
      />

      <div className="admin-kpi-grid">
        <AdminStatCard
          label="Envoyés"
          value={nb(donnees.parStatut.envoyes)}
          meta="Remis au serveur d'envoi sans erreur"
          tone={donnees.parStatut.envoyes > 0 ? "success" : "default"}
        />
        <AdminStatCard
          label="Échecs"
          value={nb(donnees.parStatut.echecs)}
          meta="Après épuisement des tentatives"
          tone={donnees.parStatut.echecs > 0 ? "destructive" : "default"}
          {...(donnees.parStatut.echecs > 0 ? { href: lien({ statut: "failed", page: 1 }) } : {})}
        />
        <AdminStatCard
          label="En attente"
          value={nb(donnees.parStatut.enAttente)}
          meta="Encore en file"
        />
        <AdminStatCard
          label="Gabarits utilisés"
          value={nb(donnees.gabarits.length)}
          meta={`sur 66 déclarés`}
        />
      </div>

      {/* 🔴 Dit à l'écran ce que ce journal N'EST PAS. Sans cette phrase, on
          croirait pouvoir relire un e-mail parti — et on découvrirait le
          contraire le jour où on en a besoin. */}
      <p className="admin-alert admin-alert-info">
        <span>
          Ce journal enregistre <strong>qui</strong> a reçu <strong>quoi</strong> et{" "}
          <strong>quand</strong>, pas le contenu du message : ni sujet, ni texte, ni variables. Les
          e-mails soumis à validation avant envoi vivent, eux, dans{" "}
          <Link href={`/fr/${adminPrefix}/qualiopi/emails`} className="admin-link">
            E-mails à valider
          </Link>
          .
        </span>
      </p>

      <section className="mt-[var(--space-admin-5)]">
        <nav aria-label="Statut" className="flex flex-wrap gap-[var(--space-admin-2)]">
          <Link
            href={lien({ statut: null, page: 1 })}
            className={
              filtres.statut === null ? "admin-button admin-button-sm" : "admin-button-ghost"
            }
            aria-current={filtres.statut === null ? "page" : undefined}
          >
            Tous
          </Link>
          {(["sent", "failed", "pending"] as const).map((s) => (
            <Link
              key={s}
              href={lien({ statut: s, page: 1 })}
              className={
                filtres.statut === s ? "admin-button admin-button-sm" : "admin-button-ghost"
              }
              aria-current={filtres.statut === s ? "page" : undefined}
            >
              {LIBELLES_STATUT[s]}
            </Link>
          ))}
        </nav>

        {donnees.gabarits.length > 0 ? (
          <nav
            aria-label="Gabarit"
            className="mt-[var(--space-admin-3)] flex flex-wrap gap-[var(--space-admin-2)]"
          >
            <Link
              href={lien({ gabarit: null, page: 1 })}
              className={
                filtres.gabarit === null ? "admin-button admin-button-sm" : "admin-button-ghost"
              }
              aria-current={filtres.gabarit === null ? "page" : undefined}
            >
              Tous les gabarits
            </Link>
            {donnees.gabarits.slice(0, 12).map((g) => (
              <Link
                key={g.nom}
                href={lien({ gabarit: g.nom, page: 1 })}
                className={
                  filtres.gabarit === g.nom ? "admin-button admin-button-sm" : "admin-button-ghost"
                }
                aria-current={filtres.gabarit === g.nom ? "page" : undefined}
              >
                {g.nom} ({nb(g.envois)})
              </Link>
            ))}
          </nav>
        ) : null}
      </section>

      <section className="mt-[var(--space-admin-5)]">
        {donnees.lignes.length === 0 ? (
          <AdminEmptyState
            title="Aucun e-mail sur cette sélection"
            description="Élargissez la période ou retirez un filtre."
          />
        ) : (
          <>
            <AdminTable
              columns={colonnes}
              rows={donnees.lignes}
              getRowId={(r) => r.id}
              caption={`${nb(donnees.total)} e-mail(s) — page ${donnees.page} sur ${donnees.pages}`}
            />
            {donnees.pages > 1 ? (
              <AdminPagination
                page={donnees.page}
                totalPages={donnees.pages}
                baseHref={base}
                preservedParams={{
                  fenetre: String(filtres.jours),
                  statut: filtres.statut ?? undefined,
                  gabarit: filtres.gabarit ?? undefined,
                  destinataire: filtres.destinataire ?? undefined,
                }}
              />
            ) : null}
          </>
        )}
      </section>
    </>
  );
}
