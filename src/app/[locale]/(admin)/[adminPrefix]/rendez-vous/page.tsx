// Onglet « Rendez-vous » — les appels à venir, prêts à lancer (2026-09-27).
//
// Demande de Will : « un onglet des rendez-vous à venir, avec qui, l'heure et
// le lien Meet, qui disparaît une demi-heure après le rendez-vous ». Épinglé
// sous « Agenda » dans la barre latérale, comme lui : c'est un écran qu'on
// ouvre avant d'agir, pas une rubrique qu'on visite.
//
// Ce qui le distingue des deux voisins :
//   · « Appels réservés » répond à « qui a réservé ? » — toutes les
//     réservations, passées comprises, jour par jour ;
//   · « Agenda » répond à « où suis-je libre ? » — une frise horaire ;
//   · ici : « qui j'appelle, quand, et comment je le rejoins ? ». Une carte par
//     rendez-vous, lisible sur téléphone, le bouton de visio en premier.
//
// Composant serveur, `force-dynamic` : le bouton passe en évidence au rendu
// (10 min avant l'heure), sans JavaScript client.

import Link from "next/link";
import { Phone } from "lucide-react";

import {
  AdminPageHeader,
  AdminFilterTabs,
  AdminEmptyState,
  AdminBadge,
} from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { VueEmailSuivi } from "@/components/admin/visio/VueEmailSuivi";
import { RejoindreVisioBouton } from "@/components/admin/contacts/RejoindreVisioBouton";
import { enregistrementPropose } from "@/components/admin/contacts/enregistrement-propose";
// Ne lit que deux variables d'environnement, jamais le dossier client : nommé
// hors du préfixe « lire… » (garde `la-lecture-est-gardee-comme-l-ecriture`).
import { lireDrapeauEnregistrement as drapeauEnregistrement } from "@/server/visio/drapeau";
import { SuiviRendezVousForm } from "@/components/admin/contacts/SuiviRendezVousForm";
import { IssueEchangeApporteurForm } from "@/components/admin/contacts/IssueEchangeApporteurForm";
import {
  LIBELLE_ISSUE_APPORTEUR,
  issueDepuisSuivi,
  type DecisionApporteur,
} from "@/features/admin-rendezvous/issue-apporteur";
import { gardeLectureAppels } from "@/features/admin-calendly/acces";
import {
  JOURS_PASSES,
  listRendezVousAVenir,
  listRendezVousPasses,
} from "@/features/admin-rendezvous/queries";
import type { PublicRdv, RdvAVenir, RdvPasse } from "@/features/admin-rendezvous/types";
import { enJours, libelleDuPoint } from "@/features/admin-rendezvous/point";
import { MINUTES_APRES_FIN } from "@/features/admin-rendezvous/visio";
import {
  bilanDuMois,
  listRendezVousAFaireLePoint,
  type RdvAFaireLePoint,
} from "@/features/admin-rendezvous/suivi-queries";
import {
  JOURS_A_FAIRE_LE_POINT,
  LIBELLE_ISSUE,
  LIBELLE_SUITE,
  mailtoRelanceAbsent,
  prenomDe,
} from "@/features/admin-rendezvous/suivi";
import { SITE_URL } from "@/lib/site-url";
import {
  LIBELLE_TYPE_RDV,
  TYPES_FILTRABLES,
  lireFiltreType,
  ongletAutreVisible,
} from "@/features/admin-rendezvous/type-rdv";
import { PastilleTypeRdv } from "@/components/admin/contacts/PastilleTypeRdv";
import { LIBELLE_CANAL } from "@/server/calendly/canal";
import { dayKeyInParis, dayKeyOfGridDate, timeInParis } from "@/lib/calendar-grid";
import { formatDateFrShort } from "@/lib/format-date-fr";
// Chantier visio (PR 4) — le dossier client sur les cartes : « Après l'appel »,
// « Préparer », « Confirmer le client proposé ». Rendus seulement pour les
// rôles du dossier (décision A2).
import { peutVoirLesEchanges } from "@/features/dossier-client/acces";
import { rangerRencontreAction } from "@/features/dossier-client/actions-rencontres";
import {
  lireDossiersDesRendezVous,
  lireNombreAClasser,
  type DossierDuRendezVous,
} from "@/features/dossier-client/queries-rencontres";
import { LiensApresLAppel } from "@/components/admin/dossier-client/LiensApresLAppel";
import { estTypeDuDossier } from "@/server/visio/liste-blanche-types";
import { AClasserVue } from "@/components/admin/dossier-client/AClasserVue";
import { EtatDuCircuitVue } from "@/components/admin/dossier-client/EtatDuCircuitVue";
// Ne lit que l'URL (le sceau d'un message de retour), jamais le dossier client :
// nommé hors du préfixe « lire… », que la garde « rôle avant lecture » compte
// comme une lecture du dossier (`la-lecture-est-gardee-comme-l-ecriture`).
import { lireMessageDeRetour as messageScelle } from "@/features/dossier-client/message-de-retour";

export const dynamic = "force-dynamic";

// « a-classer » et « circuit » (chantier visio, PR 4) : des ONGLETS, pas des
// pages de plus (cliquet de poids de la console, ADR 0058) ; montrés aux seuls
// rôles du dossier client (A2).
type Vue = "avenir" | "point" | "passes" | "a-classer" | "circuit";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

/**
 * Le filtre de type (2026-10-04, lot L3) en paramètres d'URL : `type=` pour un
 * type, `public=` pour les deux anciens alias (clients, apporteurs).
 */
function poserFiltre(qs: URLSearchParams, f: PublicRdv | undefined): void {
  if (!f) return;
  qs.set(f === "clients" || f === "apporteurs" ? "public" : "type", f);
}

/** « Aujourd'hui », « Demain », sinon la date — le libellé d'un groupe de cartes. */
function libelleJour(dayKey: string, aujourdhui: string): string {
  if (dayKey === aujourdhui) return "Aujourd'hui";
  const [y = 1970, m = 1, d = 1] = aujourdhui.split("-").map(Number);
  const demain = dayKeyOfGridDate(new Date(Date.UTC(y, m - 1, d + 1)));
  if (dayKey === demain) return "Demain";
  return formatDateFrShort(dayKey);
}

/** « Retenu », « Absent »… — l'issue d'un échange apporteur, en un mot. */
function libelleIssue(
  issue: "eu_lieu" | "absent" | "reporte",
  decision: DecisionApporteur | null,
): string {
  const i = issueDepuisSuivi(issue, decision);
  return i ? LIBELLE_ISSUE_APPORTEUR[i] : LIBELLE_ISSUE[issue];
}

/**
 * L'état affiché à côté de l'heure (2026-09-28). Avant : « ● en cours » dès le
 * début, et jusqu'à 30 minutes APRÈS la fin — Will lisait « en cours » sur un
 * appel terminé, sans savoir s'il se passait quelque chose ensuite.
 */
function EtatCarte({ r, apporteur }: { r: RdvAVenir; apporteur: boolean }) {
  const classe = "ml-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium";
  if (r.etat === "en_cours") {
    return <span className={`${classe} text-[color:var(--color-admin-danger)]`}>● En cours</span>;
  }
  if (r.etat !== "termine") return null;
  if (r.suivi) {
    const issue = apporteur
      ? libelleIssue(r.suivi.issue, r.suivi.decision ?? null)
      : libelleDuPoint(r.suivi);
    return (
      <span className={`${classe} text-[color:var(--color-admin-success-fg)]`}>
        Point fait ✓ — {issue}
      </span>
    );
  }
  return (
    <span className={`${classe} text-[color:var(--color-admin-warning-fg)]`}>
      Terminé — faites le point
    </span>
  );
}

/** Le dossier client d'une carte, quand le rôle le permet (A2). */
interface DossierCarte {
  readonly dossier: DossierDuRendezVous | null;
  readonly base: string;
}

/**
 * « Préparer », « compte rendu non validé », « Confirmer le client proposé »
 * (chantier visio, PR 4, V5-C4) — sur la carte d'un rendez-vous CLIENT.
 */
function DossierSurLaCarte({ d }: { d: DossierCarte }) {
  const x = d.dossier;
  if (x === null) return null;
  return (
    <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
      {x.clientId !== null ? (
        <Link href={`${d.base}/qualiopi/clients/${x.clientId}/preparer`} className="admin-link">
          Préparer ›
        </Link>
      ) : null}
      {x.compteRenduNonValide ? (
        // UX-01 : le badge mène au compte rendu à valider.
        <Link href={`${d.base}/rendez-vous/rencontres/${x.rencontreId}`} className="admin-link">
          <AdminBadge tone="warning">compte rendu non validé</AdminBadge>
        </Link>
      ) : null}
      {x.rattachementStatut === "propose" && x.clientPropose !== null ? (
        <form action={rangerRencontreAction}>
          <input type="hidden" name="rencontreId" value={x.rencontreId} />
          <input type="hidden" name="clientId" value={x.clientPropose.id} />
          <button type="submit" className="admin-button-ghost">
            Confirmer le client proposé : {x.clientPropose.raisonSociale}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function CarteRdv({
  r,
  maintenant,
  dossier,
}: {
  r: RdvAVenir;
  maintenant: Date;
  dossier: DossierCarte | null;
}) {
  const debut = r.startTime as Date;
  // Type classé (colonne, sinon nom ; double verrou apporteur), lot L3.
  const apporteur = r.typeRendezVous === "apporteur";
  // UX-02 : un client dont le dossier est visible fait le point dans « Après
  // l'appel » ; le formulaire court ne garde qu'Absent et Reporté.
  const pointAuDossier = dossier !== null && !apporteur && estTypeDuDossier(r.title);
  // Le brouillon de relance, pour « Absent » — même texte que dans « À faire
  // le point », vers la page de réservation d'appel.
  const mailto = r.contactEmail
    ? mailtoRelanceAbsent({
        email: r.contactEmail,
        prenom: prenomDe(r.contactName),
        quand: `${formatDateFrShort(r.dayKey)} à ${timeInParis(debut)}`,
        lienNouveauCreneau: `${SITE_URL}/fr/appel`,
      })
    : null;
  return (
    <li className="admin-card flex flex-col gap-[var(--space-admin-3)]">
      <div className="flex flex-wrap items-start justify-between gap-[var(--space-admin-3)]">
        <div className="min-w-0">
          <p className="text-[length:var(--text-admin-lg)] font-semibold tabular-nums">
            {timeInParis(debut)}
            {r.endTime ? ` – ${timeInParis(r.endTime)}` : ""}
            <EtatCarte r={r} apporteur={apporteur} />
          </p>
          <p className="font-semibold">
            {r.contactName ?? "Invité à compléter"}
            {r.entreprise ? (
              <span className="font-normal text-[color:var(--color-admin-fg-muted)]">
                {" "}
                · {r.entreprise}
              </span>
            ) : null}
          </p>
          <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            <PastilleTypeRdv type={r.typeRendezVous} besoin={r.besoinChoisi} /> ·{" "}
            {LIBELLE_CANAL[r.format]} · {r.title}
          </p>
        </div>

        {/* L'action d'abord : rejoindre la visio, ou appeler. */}
        <div className="flex flex-wrap items-center gap-[var(--space-admin-2)]">
          {r.lienVisio ? (
            <RejoindreVisioBouton
              href={r.lienVisio}
              debut={r.startTime}
              fin={r.endTime}
              maintenant={maintenant}
              enregistrer={
                r.source === "calendly"
                  ? enregistrementPropose({
                      titre: r.title,
                      identifiant: dossier?.dossier?.rencontreId ?? r.sourceRecordId,
                      drapeau: drapeauEnregistrement().effectif,
                      linkedJobApplicationId: r.linkedJobApplicationId,
                    })
                  : null
              }
            />
          ) : r.format === "telephone" && r.contactPhone ? (
            <a href={`tel:${r.contactPhone.replace(/\s+/g, "")}`} className="admin-button">
              <Phone size={16} aria-hidden="true" className="shrink-0" />
              Appeler {r.contactPhone}
            </a>
          ) : null}
        </div>
      </div>

      <dl className="admin-dl">
        {r.contactEmail ? (
          <>
            <dt className="admin-dt">E-mail</dt>
            <dd className="admin-dd">
              <a href={`mailto:${r.contactEmail}`} className="admin-link">
                {r.contactEmail}
              </a>
            </dd>
          </>
        ) : null}
        {/* Sur place : l'ADRESSE, et ni bouton de visio ni « Appeler » — un lieu
            `physical` Calendly est une adresse (salon GOFAB, 2026-10-04). */}
        {r.format === "sur_place" && r.location?.trim() ? (
          <>
            <dt className="admin-dt">Adresse</dt>
            <dd className="admin-dd">{r.location.trim()}</dd>
          </>
        ) : null}
        {r.contactPhone && r.format !== "telephone" ? (
          <>
            <dt className="admin-dt">Téléphone</dt>
            <dd className="admin-dd">
              <a href={`tel:${r.contactPhone.replace(/\s+/g, "")}`} className="admin-link">
                {r.contactPhone}
              </a>
            </dd>
          </>
        ) : null}
        {r.autresInvites.length > 0 ? (
          <>
            <dt className="admin-dt">
              {r.autresInvites.length > 1 ? "Autres invités" : "Autre invité"}
            </dt>
            <dd className="admin-dd">{r.autresInvites.join(", ")}</dd>
          </>
        ) : null}
      </dl>

      {/* Hors de la grille : les questions Calendly sont longues (« Quel est
          votre besoin (formation, 1 to 1, audit…) ? ») et écraseraient la
          colonne des réponses sur téléphone. */}
      {r.besoin.map((b) => (
        <div key={b.question}>
          <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            {b.question}
          </p>
          <p>{b.reponse}</p>
        </div>
      ))}

      {/* 🔑 LE POINT SE FAIT ICI, dès que l'appel a commencé (demande de Will,
          2026-09-27 : « pas intuitif » dans un écran à part). La visio s'ouvre
          dans un NOUVEL onglet : en raccrochant, on revient sur cette carte, et
          les trois boutons attendent sous le bouton de visio. L'onglet « À faire
          le point » ne sert plus que de filet, pour ce qui a été oublié. */}
      {r.enCours ? (
        <section
          aria-label="Le point après l'appel"
          className="border-t border-[color:var(--color-admin-border)] pt-[var(--space-admin-3)]"
        >
          <p className="mb-[var(--space-admin-2)] font-medium">
            {r.suivi
              ? apporteur
                ? `Issue : ${libelleIssue(r.suivi.issue, r.suivi.decision ?? null)} — modifiable ci-dessous`
                : `Point fait : ${LIBELLE_ISSUE[r.suivi.issue]}${r.suivi.suite ? ` · ${LIBELLE_SUITE[r.suivi.suite]}` : ""} — ${
                    // m-3 : le formulaire court ne garde qu'Absent et Reporté.
                    pointAuDossier && r.suivi.issue === "eu_lieu"
                      ? "modifiable dans « Après l'appel »"
                      : "modifiable ci-dessous"
                  }`
              : apporteur
                ? "L'échange est terminé ? Donnez son issue :"
                : pointAuDossier
                  ? "L'appel est terminé ? Faites le point dans « Après l'appel » :"
                  : "L'appel est terminé ? Faites le point :"}
          </p>
          {/* 2026-09-28 — un échange APPORTEUR a ses propres boutons (retenu,
              à revoir, non retenu…) et ses e-mails, avec aperçu avant envoi. */}
          {apporteur ? (
            <IssueEchangeApporteurForm
              calendlyEventId={r.sourceRecordId}
              initial={
                r.suivi
                  ? {
                      issue: issueDepuisSuivi(r.suivi.issue, r.suivi.decision ?? null),
                      noteSur20: r.suivi.noteSur20 ?? null,
                      justification: r.suivi.note,
                      rappelLe: r.suivi.decision === "a_revoir" ? r.suivi.suiteLe : null,
                    }
                  : null
              }
            />
          ) : pointAuDossier ? (
            <>
              <LiensApresLAppel calendlyEventId={r.sourceRecordId} />
              <p className="mt-[var(--space-admin-3)] mb-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                Absent, reporté, ou sans suite ?
              </p>
              <SuiviRendezVousForm
                calendlyEventId={r.sourceRecordId}
                initial={r.suivi}
                mailtoRelance={mailto}
              />
            </>
          ) : (
            <SuiviRendezVousForm
              calendlyEventId={r.sourceRecordId}
              initial={r.suivi}
              mailtoRelance={mailto}
            />
          )}
        </section>
      ) : null}

      {dossier !== null && !apporteur ? <DossierSurLaCarte d={dossier} /> : null}

      <p>
        <Link href={r.detailHref} className="admin-link">
          Ouvrir la fiche ›
        </Link>
      </p>
    </li>
  );
}

/**
 * Un rendez-vous passé, en attente de son point. Le formulaire est sur la
 * carte : faire le point ne doit pas demander d'ouvrir la fiche.
 */
function CartePoint({ r, dossierVisible }: { r: RdvAFaireLePoint; dossierVisible: boolean }) {
  const quand = `${formatDateFrShort(r.dayKey)} à ${timeInParis(r.debut)}`;
  // La page publique de réservation d'appel, et PAS le lien de report Calendly
  // de l'invité : ce dernier vise un rendez-vous déjà passé, que Calendly peut
  // refuser de déplacer — l'absent recevrait un lien mort.
  const lienNouveauCreneau = `${SITE_URL}/fr/appel`;
  const mailto = r.contactEmail
    ? mailtoRelanceAbsent({
        email: r.contactEmail,
        prenom: prenomDe(r.contactName),
        quand,
        lienNouveauCreneau,
      })
    : null;
  return (
    <li
      className="admin-card flex flex-col gap-[var(--space-admin-3)]"
      // Style en ligne, pas un utilitaire : `.admin-card` pose sa bordure hors
      // couche, un `border-[…]` Tailwind à côté serait inerte.
      style={r.retardJours !== null ? { borderColor: "var(--color-admin-danger)" } : undefined}
    >
      <div>
        {r.retardJours !== null ? (
          <p className="mb-[var(--space-admin-1)]">
            <AdminBadge tone="destructive" dot>
              En retard depuis {enJours(r.retardJours)}
            </AdminBadge>
          </p>
        ) : null}
        <p className="font-semibold">
          {r.contactName ?? "Invité à compléter"}
          {r.entreprise ? (
            <span className="font-normal text-[color:var(--color-admin-fg-muted)]">
              {" "}
              · {r.entreprise}
            </span>
          ) : null}
        </p>
        <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
          {quand} · <PastilleTypeRdv type={r.typeRendezVous} /> · {r.titre}
        </p>
      </div>
      {r.typeRendezVous === "apporteur" ? (
        <IssueEchangeApporteurForm calendlyEventId={r.id} />
      ) : (
        <>
          {/* Chantier visio (PR 4) : le point complet — rangement, projet,
              note, suite — se fait dans « Après l'appel ». Le formulaire
              court ci-dessous reste pour « Absent » et « Reporté ». */}
          {/* P-4 (décision de Williams du 30/09) : seuls les types de la liste
              blanche du dossier mènent à « Après l'appel » (jamais un salon). */}
          {/* UX-02 : « Après l'appel » en avant ; le formulaire court ne garde
              qu'Absent et Reporté, sinon deux façons de faire le point. */}
          {dossierVisible && estTypeDuDossier(r.titre) ? (
            <>
              <LiensApresLAppel calendlyEventId={r.id} />
              <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
                Absent, reporté, ou sans suite ?
              </p>
              <SuiviRendezVousForm calendlyEventId={r.id} mailtoRelance={mailto} />
            </>
          ) : (
            <SuiviRendezVousForm calendlyEventId={r.id} mailtoRelance={mailto} />
          )}
        </>
      )}
    </li>
  );
}

function Chiffre({ valeur, libelle }: { valeur: number; libelle: string }) {
  return (
    <div className="admin-card">
      <p className="text-[length:var(--text-admin-2xl)] font-semibold tabular-nums">{valeur}</p>
      <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        {libelle}
      </p>
    </div>
  );
}

export default async function RendezVousPage({
  params,
  searchParams,
}: PageProps): Promise<React.ReactElement> {
  const { locale, adminPrefix } = await params;
  // Chantier visio (PR 7) — l'e-mail de suivi d'un rendez-vous. Sa propre
  // garde (décision A2 : Will et les administrateurs) est la PREMIÈRE
  // instruction de la vue, avant toute lecture.
  const demande = await searchParams;
  if (demande["emailSuivi"]) {
    return (
      <VueEmailSuivi
        locale={locale}
        adminPrefix={adminPrefix}
        rencontreId={demande["emailSuivi"]}
        message={messageScelle(demande, "message") ?? undefined}
        erreur={messageScelle(demande, "erreur") ?? undefined}
      />
    );
  }
  // Même garde que « Appels réservés » : ces cartes portent les coordonnées
  // des prospects et le lien de leur réunion. La garde avant la base.
  const acces = await gardeLectureAppels(`/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  // 🔴 Le rôle est consulté AVANT toute lecture du dossier client (A2).
  const voitDossier = peutVoirLesEchanges(acces.role);
  const sp = await searchParams;
  const publicRdv = lireFiltreType(sp["type"], sp["public"]);
  const vueDemandee = sp["vue"];
  const vue: Vue =
    vueDemandee === "point" || vueDemandee === "passes"
      ? vueDemandee
      : voitDossier && (vueDemandee === "a-classer" || vueDemandee === "circuit")
        ? vueDemandee
        : "avenir";
  const base = `/fr/${adminPrefix}/rendez-vous`;
  const maintenant = new Date();
  const aujourdhui = dayKeyInParis(maintenant);
  const optionsPublic = publicRdv ? { public: publicRdv } : {};
  // Les deux listes sont lues quelle que soit la vue : l'onglet « À faire le
  // point » porte son compteur, qui doit se voir depuis « À venir ».
  const [rdv, aFaire] = await Promise.all([
    listRendezVousAVenir({ maintenant, ...optionsPublic }),
    listRendezVousAFaireLePoint({ maintenant, ...optionsPublic }),
  ]);
  const enRetard = aFaire.filter((r) => r.retardJours !== null).length;
  const dossiers: Map<string, DossierDuRendezVous> = voitDossier
    ? await lireDossiersDesRendezVous(rdv.map((r) => r.sourceRecordId))
    : new Map();
  const nombreAClasser = voitDossier ? await lireNombreAClasser() : 0;
  const consoleBase = `/fr/${adminPrefix}`;
  const lien = (v: Vue, p: PublicRdv | undefined): string => {
    const qs = new URLSearchParams();
    if (v !== "avenir") qs.set("vue", v);
    poserFiltre(qs, p);
    const t = qs.toString();
    return t ? `${base}?${t}` : base;
  };

  const parJour = new Map<string, RdvAVenir[]>();
  for (const r of rdv) {
    const arr = parJour.get(r.dayKey);
    if (arr) arr.push(r);
    else parJour.set(r.dayKey, [r]);
  }

  return (
    <>
      <AdminPageHeader
        title="Rendez-vous"
        description={`Vos prochains appels : avec qui, à quelle heure, et le bouton pour lancer la visio. Un rendez-vous quitte cette liste ${MINUTES_APRES_FIN} minutes après sa fin, puis se retrouve dans « Passés ».`}
        actions={
          <Link href={`/${locale}/${adminPrefix}/rendez-vous/enregistreur`}>Enregistreur</Link>
        }
      />

      {/* Demande de Will (2026-09-28) : « une fois la visio terminée, je ne
          sais pas s'il se passe quelque chose ». Réponse : rien, tant que le
          point n'est pas fait — et c'est voulu. */}
      {/* La marge sur un conteneur : `.admin-help` pose `margin: 0` hors couche. */}
      <div className="mb-[var(--space-admin-4)]">
        <p className="admin-help">
          Après chaque échange, indiquez comment il s&apos;est passé : c&apos;est ce bouton qui
          envoie, si vous le choisissez, l&apos;e-mail adapté. Rien ne part automatiquement.
        </p>
      </div>

      <div className="mb-[var(--space-admin-4)] flex flex-wrap gap-[var(--space-admin-4)]">
        <AdminFilterTabs
          label="Vue"
          current={vue}
          options={[
            { value: "avenir", label: `À venir (${rdv.length})`, href: lien("avenir", publicRdv) },
            {
              value: "point",
              label:
                enRetard > 0
                  ? `À faire le point (${aFaire.length} · ${enRetard} en retard)`
                  : `À faire le point (${aFaire.length})`,
              href: lien("point", publicRdv),
            },
            { value: "passes", label: "Passés", href: lien("passes", publicRdv) },
            ...(voitDossier
              ? [
                  {
                    value: "a-classer",
                    label: `À classer (${nombreAClasser})`,
                    href: `${base}?vue=a-classer`,
                  },
                  { value: "circuit", label: "État du circuit", href: `${base}?vue=circuit` },
                ]
              : []),
          ]}
        />
        <AdminFilterTabs
          label="Type"
          current={publicRdv === "apporteurs" ? "apporteur" : (publicRdv ?? "tous")}
          options={[
            { value: "tous", label: "Tous", href: lien(vue, undefined) },
            ...TYPES_FILTRABLES.map((t) => ({
              value: t,
              label: LIBELLE_TYPE_RDV[t],
              href: lien(vue, t),
            })),
            // « Autre » : dès qu'un rendez-vous « autre » est listé (à venir ou
            // à faire le point), ou s'il est le filtre actif (lot L5b).
            // L'ancien « Clients » n'a d'onglet que s'il est actif.
            ...(ongletAutreVisible(publicRdv, [
              ...rdv.map((r) => r.typeRendezVous),
              ...aFaire.map((r) => r.typeRendezVous),
            ])
              ? [{ value: "autre", label: LIBELLE_TYPE_RDV.autre, href: lien(vue, "autre") }]
              : []),
            ...(publicRdv === "clients"
              ? [{ value: "clients", label: "Clients", href: lien(vue, "clients") }]
              : []),
          ]}
        />
      </div>

      {vue === "a-classer" ? (
        <AClasserVue
          rdvBase={base}
          historique={sp["filtre"] === "historique"}
          erreur={messageScelle(sp, "erreur")}
        />
      ) : vue === "circuit" ? (
        <EtatDuCircuitVue rdvBase={base} />
      ) : vue === "point" ? (
        <VuePoint
          aFaire={aFaire}
          maintenant={maintenant}
          dossierVisible={voitDossier}
          erreur={messageScelle(sp, "erreur")}
        />
      ) : vue === "passes" ? (
        <VuePasses maintenant={maintenant} {...optionsPublic} />
      ) : rdv.length === 0 ? (
        <AdminEmptyState
          title="Aucun rendez-vous à venir"
          description="Une réservation prise sur Calendly apparaîtra ici quelques minutes plus tard."
        />
      ) : (
        [...parJour.entries()].map(([dayKey, cartes]) => (
          <section
            key={dayKey}
            className="mb-[var(--space-admin-6)]"
            aria-labelledby={`j-${dayKey}`}
          >
            <h2 id={`j-${dayKey}`} className="admin-h2">
              {libelleJour(dayKey, aujourdhui)} · {cartes.length} rendez-vous
            </h2>
            <ul className="mt-[var(--space-admin-3)] flex flex-col gap-[var(--space-admin-3)]">
              {cartes.map((r) => (
                <CarteRdv
                  key={r.key}
                  r={r}
                  maintenant={maintenant}
                  dossier={
                    voitDossier
                      ? { dossier: dossiers.get(r.sourceRecordId) ?? null, base: consoleBase }
                      : null
                  }
                />
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

/**
 * « À faire le point » : le bilan du mois, puis un formulaire par rendez-vous
 * passé. Le but est de ramener le compteur à zéro chaque jour.
 */
async function VuePoint({
  aFaire,
  maintenant,
  dossierVisible,
  erreur,
}: {
  aFaire: RdvAFaireLePoint[];
  maintenant: Date;
  dossierVisible: boolean;
  /** Refus scellé d'« Après l'appel » (`actions-rencontres.ts`, N1). */
  erreur: string | null;
}): Promise<React.ReactElement> {
  const bilan = await bilanDuMois(maintenant);
  return (
    <>
      {erreur !== null ? (
        <p
          role="alert"
          className="mb-[var(--space-admin-4)] rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-danger)] px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]"
        >
          {erreur}
        </p>
      ) : null}
      <section aria-labelledby="bilan-mois" className="mb-[var(--space-admin-6)]">
        <h2 id="bilan-mois" className="admin-h2">
          Ce mois-ci
        </h2>
        <div className="mt-[var(--space-admin-3)] grid grid-cols-2 gap-[var(--space-admin-3)] sm:grid-cols-4">
          <Chiffre valeur={bilan.euLieu} libelle="ont eu lieu" />
          <Chiffre valeur={bilan.absents} libelle="absents" />
          <Chiffre valeur={bilan.reportes} libelle="reportés" />
          <Chiffre valeur={bilan.devis} libelle="devis à envoyer" />
        </div>
      </section>

      {aFaire.length === 0 ? (
        <AdminEmptyState
          title="Tout est à jour"
          description={`Aucun rendez-vous des ${JOURS_A_FAIRE_LE_POINT} derniers jours n'attend son point.`}
        />
      ) : (
        <ul className="flex flex-col gap-[var(--space-admin-3)]">
          {aFaire.map((r) => (
            <CartePoint key={r.id} r={r} dossierVisible={dossierVisible} />
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * « Passés » (2026-09-28) : les rendez-vous terminés des 90 derniers jours, du
 * plus récent au plus ancien, et ce que le point a dit. Des lignes plutôt que
 * des cartes : on y cherche un rendez-vous, on n'y agit pas — l'action se fait
 * sur la fiche, ou dans « À faire le point ».
 */
async function VuePasses({
  maintenant,
  public: publicRdv,
}: {
  maintenant: Date;
  public?: PublicRdv;
}): Promise<React.ReactElement> {
  const passes = await listRendezVousPasses({
    maintenant,
    ...(publicRdv ? { public: publicRdv } : {}),
  });
  if (passes.length === 0) {
    return (
      <AdminEmptyState
        title="Aucun rendez-vous passé"
        description={`Aucun rendez-vous terminé ces ${JOURS_PASSES} derniers jours.`}
      />
    );
  }
  const sansPoint = passes.filter((r) => !r.suivi).length;
  return (
    <>
      <p className="mb-[var(--space-admin-3)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        {passes.length} rendez-vous terminé{passes.length > 1 ? "s" : ""} ces {JOURS_PASSES}{" "}
        derniers jours
        {sansPoint > 0 ? ` · ${sansPoint} sans point` : " · tous ont leur point"}
      </p>
      <ul className="flex flex-col gap-[var(--space-admin-2)]">
        {passes.map((r) => (
          <LignePasse key={r.key} r={r} />
        ))}
      </ul>
    </>
  );
}

function LignePasse({ r }: { r: RdvPasse }) {
  const debut = r.startTime as Date;
  return (
    <li>
      <Link
        href={r.detailHref}
        className="flex flex-wrap items-start justify-between gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] bg-[color:var(--color-admin-paper)] p-3 hover:bg-[color:var(--color-admin-surface-hover)]"
      >
        <span className="min-w-0">
          <span className="block font-semibold">
            {r.contactName ?? "Invité à compléter"}
            {r.entreprise ? (
              <span className="font-normal text-[color:var(--color-admin-fg-muted)]">
                {" "}
                · {r.entreprise}
              </span>
            ) : null}
          </span>
          <span className="block text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
            {formatDateFrShort(r.dayKey)} à {timeInParis(debut)} ·{" "}
            <PastilleTypeRdv type={r.typeRendezVous} besoin={r.besoinChoisi} /> · {r.title}
          </span>
          {r.suivi?.note ? (
            <span className="mt-[var(--space-admin-1)] block text-[length:var(--text-admin-sm)] italic">
              « {r.suivi.note} »
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-[var(--space-admin-2)]">
          {r.suivi ? (
            <AdminBadge tone={r.suivi.issue === "eu_lieu" ? "success" : "neutral"}>
              {libelleDuPoint(r.suivi)}
              {r.suivi.noteSur20 !== null && r.suivi.noteSur20 !== undefined
                ? ` · ${r.suivi.noteSur20}/20`
                : ""}
            </AdminBadge>
          ) : (
            <AdminBadge tone="warning" dot>
              Sans point
            </AdminBadge>
          )}
          <span aria-hidden="true" className="text-[color:var(--color-admin-fg-muted)]">
            ›
          </span>
        </span>
      </Link>
    </li>
  );
}
