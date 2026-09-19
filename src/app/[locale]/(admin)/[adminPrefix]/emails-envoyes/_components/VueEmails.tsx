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
  STATUTS_EMAILS,
  LIBELLES_STATUT_EMAIL,
  libelleStatutLigne,
  type ChargementEmails,
  type EchecsRenvoyables,
  type FiltresEmails,
  type IssueRenvoi,
  type LigneEmail,
} from "@/features/admin-emails/query";
import { depuisCombienDeTemps } from "@/server/email/serie-echecs";
import {
  renvoyerEchecsEnLotFormulaire,
  renvoyerEmailActionFormulaire,
} from "@/features/admin-emails/actions";

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

/** Le motif à montrer : erreur d'envoi, ou motif de rebond rendu par le relais. */
const detailDe = (r: LigneEmail): string | null =>
  r.error ? r.error.slice(0, 90) : r.bounceReason ? r.bounceReason.slice(0, 90) : null;

/**
 * Cibles tactiles — lot 3 (2026-09-02). Les puces de filtre héritent d'une
 * hauteur de 30 px du système d'administration ; on en empile jusqu'à 21 sur
 * cet écran, consulté au téléphone en urgence. 44 px minimum, sans toucher au
 * jeton global : c'est cet écran qui a le problème, pas la console entière.
 */
const PUCE = "min-h-11 inline-flex items-center";

/**
 * Ce qui est resté à quai, dit en français, et le geste pour le réparer.
 *
 * 🔴 2026-09-17 — L'ÉCRAN SAVAIT TOUT ET NE DISAIT RIEN. Pendant les 43 heures
 * de panne (15/09 13 h 17 → 17/09 08 h 40), cette page affichait un compteur
 * « Échecs » parmi cinq tuiles, et un bouton « Renvoyer » par ligne. Dix-huit
 * personnes attendaient un accusé de réception de candidature ; il fallait
 * compter les lignes du tableau pour l'apprendre, et cliquer dix-huit fois pour
 * y remédier.
 *
 * Le bandeau dit donc les trois choses qu'on veut savoir sans compter :
 * **ce qui s'est passé**, **combien de personnes**, **depuis quand**.
 */
function BandeauEchecs({
  echecs,
  adminPrefix,
  hrefFiltre,
}: {
  echecs: EchecsRenvoyables;
  adminPrefix: string;
  hrefFiltre: string;
}): React.ReactElement | null {
  if (echecs.total === 0 && echecs.sansJob === 0) return null;

  const personnes =
    echecs.destinatairesDistincts === 1
      ? "1 personne"
      : `${nb(echecs.destinatairesDistincts)} personnes`;
  const depuis = echecs.depuis ? depuisCombienDeTemps(new Date(echecs.depuis), new Date()) : null;

  return (
    // ⚠️ La marge vit sur un conteneur NEUTRE, jamais sur l'élément
    // `.admin-alert` : `admin.css` est hors couche et y déclare `margin: 0`,
    // ce qui rend inerte tout utilitaire de marge posé à côté d'une classe
    // `.admin-*` (cf. `admin.css`, § « 277 règles hors couche »).
    <div className="mt-[var(--space-admin-4)]">
      {/* 🔴 ROUGE seulement si la panne est EN COURS — correction de relecture.
          La version précédente mettait du rouge sur le stock d'échecs des trente
          derniers jours, y compris ceux dont le job est purgé et qu'on ne peut
          donc PAS faire redescendre. Un bandeau rouge permanent apprend à ne
          plus lire les bandeaux rouges ; le rattrapage d'un stock ancien est un
          avertissement, pas une urgence. */}
      <section
        className={`admin-alert ${echecs.panneEnCours ? "admin-alert-error" : "admin-alert-warning"}`}
      >
        <div>
          <p>
            <strong>
              {echecs.panneEnCours
                ? "Les envois échouent en série — la chaîne est en panne EN CE MOMENT. "
                : ""}
              {nb(echecs.total + echecs.sansJob)} e-mail(s) ne sont jamais arrivés à destination.
            </strong>{" "}
            {personnes} {echecs.destinatairesDistincts === 1 ? "attend" : "attendent"} encore leur
            message
            {depuis ? `, le plus ancien depuis ${depuis}` : ""}.
          </p>
          {echecs.motif ? (
            <div className="mt-1">
              <span className="admin-meta-small">
                Dernier motif rendu par le relais : « {echecs.motif} ».
              </span>
            </div>
          ) : null}
          {echecs.sansJob > 0 ? (
            <div className="mt-1">
              <span className="admin-meta-small">
                ⚠️ {nb(echecs.sansJob)} d&apos;entre eux ne sont pas rejouables depuis cet écran (le
                job a quitté la file) : les ré-émettre depuis leur écran d&apos;origine.
              </span>
            </div>
          ) : null}
          {echecs.tronque ? (
            <div className="mt-1">
              <span className="admin-meta-small">
                Lecture plafonnée : les chiffres ci-dessus sont des minorants.
              </span>
            </div>
          ) : null}

          {echecs.total > 0 ? (
            <form
              action={renvoyerEchecsEnLotFormulaire.bind(null, adminPrefix)}
              className="mt-[var(--space-admin-3)] flex flex-col gap-[var(--space-admin-2)]"
            >
              {/* Le nombre que l'utilisateur A SOUS LES YEUX. L'action n'en
                  renvoie jamais plus : ce qui arriverait après l'affichage
                  n'a pas été consenti. */}
              <input type="hidden" name="attendus" value={echecs.total} />
              {/* 🔑 La BORNE HAUTE : l'instant de cette lecture. L'action ne
                  reprend que des échecs antérieurs, donc exactement ceux qu'on
                  a sous les yeux. `attendus` bornait le nombre, pas l'identité —
                  trois échecs tombés entre l'affichage et le clic passaient
                  devant (tri `failedAt desc`) et partaient à leur place. */}
              <input type="hidden" name="jusqua" value={new Date(echecs.luA).toISOString()} />
              <label className="flex items-start gap-[var(--space-admin-2)]">
                {/* `required` : validation native du navigateur, zéro
                    JavaScript — et l'action REFUSE de toute façon côté serveur
                    si la case n'est pas cochée. */}
                <input type="checkbox" name="confirmation" value="oui" required className="mt-1" />
                <span>
                  Je confirme renvoyer <strong>{nb(echecs.total)} e-mail(s)</strong> à{" "}
                  <strong>{personnes}</strong>. Ces messages partiront réellement.
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
                <button type="submit" className={`admin-button ${PUCE}`}>
                  Renvoyer les envois en échec
                </button>
                <Link href={hrefFiltre} className={`admin-button-ghost ${PUCE}`}>
                  Voir le détail avant de renvoyer
                </Link>
              </div>
            </form>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/** Ce que le dernier geste a produit — dit à l'écran, pas dans un journal. */
function IssueDuRenvoi({ issue }: { issue: IssueRenvoi }): React.ReactElement | null {
  if (!issue) return null;
  if (issue.kind === "erreur") {
    return (
      <div className="mt-[var(--space-admin-4)]">
        <p className="admin-alert admin-alert-error">
          <span>
            <strong>Le renvoi n&apos;a pas eu lieu.</strong> {issue.motif}
          </span>
        </p>
      </div>
    );
  }
  return (
    <div className="mt-[var(--space-admin-4)]">
      <p className="admin-alert admin-alert-success">
        <span>
          <strong>
            {nb(issue.renvoyes)} e-mail(s) remis en file vers {nb(issue.destinataires)}{" "}
            destinataire(s).
          </strong>{" "}
          Ils repasseront « Envoyé » dans les minutes qui viennent — actualisez pour suivre.
          {issue.retenus > 0
            ? ` ${nb(issue.retenus)} n'ont VOLONTAIREMENT pas été renvoyés : le destinataire est désabonné, opposé aux sollicitations, ou son adresse a définitivement rebondi.`
            : ""}
          {issue.irrecuperables - issue.retenus > 0
            ? ` ${nb(issue.irrecuperables - issue.retenus)} n'ont pas pu être repris : leur ligne porte le motif.`
            : ""}
        </span>
      </p>
    </div>
  );
}

export function VueEmails({
  donnees,
  echecs,
  issueRenvoi,
  filtres,
  adminPrefix,
  nbGabaritsDeclares,
}: {
  donnees: ChargementEmails;
  /** Ce qui est resté à quai, INDÉPENDAMMENT des filtres de l'écran. */
  echecs: EchecsRenvoyables;
  /** Résultat du dernier geste de renvoi, relu depuis l'URL. */
  issueRenvoi: IssueRenvoi;
  filtres: FiltresEmails;
  adminPrefix: string;
  /** Taille du registre des gabarits, DÉRIVÉE par la page — jamais un chiffre écrit ici (lot 3). */
  nbGabaritsDeclares: number;
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
    if (f.sessionId) p.set("session", f.sessionId);
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
          {/* Lot 3 : sous `lg`, la colonne Détail est masquée — or le motif
              d'un échec ou d'un rebond est l'information la plus actionnable
              de la ligne, et c'est au téléphone qu'on la lit en urgence. On
              le répète ici, uniquement sur les petits écrans. */}
          {detailDe(r) ? (
            <>
              <br />
              <span className="admin-meta-small lg:hidden">{detailDe(r)}</span>
            </>
          ) : null}
        </>
      ),
      width: "44%",
    },
    {
      key: "statut",
      header: "Statut",
      align: "right",
      cell: (r) => (
        <>
          <span
            className={
              r.status === "failed" || (r.status === "bounced" && r.bounceType === "hard")
                ? "admin-severity-critical"
                : r.status === "bounced"
                  ? "admin-severity-warning"
                  : undefined
            }
          >
            {libelleStatutLigne(r)}
            {r.attempts > 1 ? ` (${r.attempts} essais)` : ""}
          </span>
          {/* Lot 3 : REJOUER un échec depuis l'écran. Le journal ne stocke pas
              le contenu, mais BullMQ garde le job (removeOnFail : 5 000) : on
              lui demande de le reprendre, avec le même gabarit et les mêmes
              variables. Avant, une ligne « Échec » était terminale — quarante
              envois à ré-émettre à la main un lundi matin, déclencheur par
              déclencheur. */}
          {r.status === "failed" && r.jobId ? (
            <form
              action={renvoyerEmailActionFormulaire.bind(null, adminPrefix, r.id)}
              className="mt-1"
            >
              <button type="submit" className={`admin-button-ghost ${PUCE}`}>
                Renvoyer
              </button>
            </form>
          ) : null}
        </>
      ),
    },
    {
      key: "detail",
      header: "Détail",
      cell: (r) =>
        detailDe(r) ? (
          // L'erreur ou le motif de rebond est la seule information vraiment
          // actionnable d'une ligne : on la montre, tronquée, plutôt que de la
          // cacher derrière un clic.
          <span className="admin-meta-small">{detailDe(r)}</span>
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
                  className={`${
                    f.jours === filtres.jours
                      ? "admin-button admin-button-sm"
                      : "admin-button-ghost"
                  } ${PUCE}`}
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
              REMIS. Depuis le 2026-08-20 le webhook de rebonds ramène l'écart
              ici (statut « Rebond ») ; le tableau de bord du relais reste le
              second canal pour le vérifier.
            */}
            <a
              href="https://zeptomail.zoho.eu/"
              target="_blank"
              rel="noopener noreferrer"
              className={`admin-button-ghost ${PUCE}`}
              title="Compteurs envoyés / livrés / rebonds, côté relais"
            >
              ZeptoMail ↗
            </a>
          </div>
        }
      />

      {/* 🔴 2026-09-07 — LES COMPTEURS NE SUIVAIENT PAS LE FILTRE.
          On lisait « Envoyés 197 » au-dessus d'une liste de trois lignes
          filtrées sur une stagiaire, et rien ne disait que les deux nombres ne
          répondaient pas à la même question. Sur un écran qu'on montre à un
          auditeur, c'est pire qu'un chiffre faux : un chiffre VRAI posé sur la
          mauvaise question, que personne ne songe à vérifier.
          Ils se restreignent désormais au périmètre — et le disent. */}
      {filtres.destinataire !== null || filtres.sessionId !== null ? (
        <p className="mt-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          Les compteurs ci-dessous portent sur le <strong>périmètre filtré</strong>, pas sur
          l&apos;ensemble du journal.
        </p>
      ) : null}

      {/* 🔴 AVANT les compteurs, et pas après. Ce qui n'est pas parti prime sur
          ce qui est parti : c'est la seule information de cet écran qui
          appelle un geste, et c'est celle que la panne du 15/09 a laissée
          invisible pendant 43 heures. */}
      <IssueDuRenvoi issue={issueRenvoi} />
      <BandeauEchecs
        echecs={echecs}
        adminPrefix={adminPrefix}
        hrefFiltre={lien({ statut: "failed", page: 1 })}
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
        {/* 🔴 2026-09-09 — UN ENVOI ANNULÉ RESTAIT « EN ATTENTE » POUR TOUJOURS.
            `annulerRelancesLeadApporteur()` retire le job quand le dossier
            complet arrive — c'est voulu. Mais elle ne refermait pas la ligne du
            journal : plus aucun job ne pouvait la clore, et son échéance passée
            elle se présentait comme un envoi bloqué. Deux lignes dans cet état
            en production, mesurées ce jour-là.
            Ton neutre, et pas d'alerte : une annulation est un fonctionnement
            normal, pas un incident. Elle doit être VISIBLE, pas criarde. */}
        <AdminStatCard
          label="Annulés"
          value={nb(donnees.parStatut.annules)}
          meta="Retirés de la file avant échéance"
          {...(donnees.parStatut.annules > 0
            ? { href: lien({ statut: "cancelled", page: 1 }) }
            : {})}
        />
        {/* 🔴 2026-08-24 — LE REBOND N'ÉTAIT AFFICHÉ NULLE PART.
            Le webhook ZeptoMail écrit `bounced` depuis le 2026-08-20, mais la
            console ne le comptait ni ne le filtrait : le message est parti,
            le serveur destinataire l'a refusé, et l'écran censé le montrer
            n'en disait rien. C'est le SEUL statut qui exige un geste humain —
            corriger l'adresse — d'où le ton d'alerte et le lien de filtre. */}
        <AdminStatCard
          label="Rebonds"
          value={nb(donnees.parStatut.rebonds)}
          meta={
            donnees.parStatut.rebonds > 0
              ? `dont ${nb(donnees.parStatut.rebondsDurs)} définitif(s) — adresse à corriger ; le reste est temporaire (boîte pleine, serveur absent)`
              : "Refusés par le serveur destinataire"
          }
          tone={donnees.parStatut.rebondsDurs > 0 ? "destructive" : "default"}
          {...(donnees.parStatut.rebonds > 0 ? { href: lien({ statut: "bounced", page: 1 }) } : {})}
        />
        <AdminStatCard
          label="Gabarits utilisés"
          value={nb(donnees.gabarits.length)}
          meta={`sur ${nb(nbGabaritsDeclares)} déclarés`}
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

      {/* 🔴 2026-09-07 — LE FILTRE EXISTAIT, MAIS SEULEMENT DANS L'URL.
          `destinataire` était lu par la page depuis le premier jour et n'avait
          aucun champ à l'écran : il fallait fabriquer l'URL à la main. Un
          auditeur assis à côté ne le devine pas, et personne ne s'en souvient
          six mois plus tard. Une fonction qu'on ne peut pas trouver n'existe
          pas. */}
      <form
        method="get"
        action={base}
        className="mt-[var(--space-admin-5)] flex flex-wrap items-end gap-[var(--space-admin-3)]"
      >
        {/* Les filtres en cours voyagent avec la recherche, sinon chercher une
            adresse remettrait la fenêtre et la session à zéro. */}
        <input type="hidden" name="fenetre" value={String(filtres.jours)} />
        {filtres.statut ? <input type="hidden" name="statut" value={filtres.statut} /> : null}
        {filtres.gabarit ? <input type="hidden" name="gabarit" value={filtres.gabarit} /> : null}
        {filtres.sessionId ? (
          <input type="hidden" name="session" value={filtres.sessionId} />
        ) : null}
        <label className="flex flex-col gap-[var(--space-admin-1)]">
          <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Destinataire
          </span>
          <input
            type="search"
            name="destinataire"
            defaultValue={filtres.destinataire ?? ""}
            placeholder="prenom.nom@exemple.fr"
            className="admin-input"
            style={{ minWidth: "18rem" }}
          />
        </label>
        <button type="submit" className="admin-button admin-button-sm">
          Filtrer
        </button>
        {filtres.destinataire ? (
          <Link href={lien({ destinataire: null, page: 1 })} className="admin-link">
            Effacer le destinataire
          </Link>
        ) : null}
      </form>

      {/* La session filtrée est NOMMÉE, jamais laissée en UUID : un auditeur doit
          lire « la formation du 5 septembre chez SCI Invest Sun », pas un
          identifiant technique dont il ne peut rien vérifier. */}
      {donnees.session !== null ? (
        <p className="admin-alert admin-alert-info mt-[var(--space-admin-3)]">
          <span>
            Journal restreint à la session <strong>{donnees.session.numero}</strong> —{" "}
            {donnees.session.titre}
            {donnees.session.client === null ? "" : ` · ${donnees.session.client}`} · du{" "}
            {donnees.session.dateDebut.toLocaleDateString("fr-FR")}.{" "}
            <Link href={lien({ sessionId: null, page: 1 })} className="admin-link">
              Retirer ce filtre
            </Link>
          </span>
        </p>
      ) : filtres.sessionId !== null ? (
        <p className="admin-alert admin-alert-warning mt-[var(--space-admin-3)]">
          <span>
            Aucune session ne porte cet identifiant. Le journal est donc vide —{" "}
            <strong>et non « aucun envoi »</strong> :{" "}
            <Link href={lien({ sessionId: null, page: 1 })} className="admin-link">
              retirer ce filtre
            </Link>{" "}
            pour voir le journal complet.
          </span>
        </p>
      ) : null}

      <section className="mt-[var(--space-admin-5)]">
        <nav aria-label="Statut" className="flex flex-wrap gap-[var(--space-admin-2)]">
          <Link
            href={lien({ statut: null, page: 1 })}
            className={`${
              filtres.statut === null ? "admin-button admin-button-sm" : "admin-button-ghost"
            } ${PUCE}`}
            aria-current={filtres.statut === null ? "page" : undefined}
          >
            Tous
          </Link>
          {/* Lot 3 : les puces sont DÉRIVÉES de l'énum. La liste écrite à la
              main oubliait « Rebond » : le lien de la tuile filtrait bien, mais
              aucune puce ne s'allumait, et l'admin ne savait plus où il était. */}
          {STATUTS_EMAILS.map((s) => (
            <Link
              key={s}
              href={lien({ statut: s, page: 1 })}
              className={`${
                filtres.statut === s ? "admin-button admin-button-sm" : "admin-button-ghost"
              } ${PUCE}`}
              aria-current={filtres.statut === s ? "page" : undefined}
            >
              {LIBELLES_STATUT_EMAIL[s]}
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
              className={`${
                filtres.gabarit === null ? "admin-button admin-button-sm" : "admin-button-ghost"
              } ${PUCE}`}
              aria-current={filtres.gabarit === null ? "page" : undefined}
            >
              Tous les gabarits
            </Link>
            {donnees.gabarits.slice(0, 12).map((g) => (
              <Link
                key={g.nom}
                href={lien({ gabarit: g.nom, page: 1 })}
                className={`${
                  filtres.gabarit === g.nom ? "admin-button admin-button-sm" : "admin-button-ghost"
                } ${PUCE}`}
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
