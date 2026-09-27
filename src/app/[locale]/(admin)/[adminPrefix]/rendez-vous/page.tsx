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

import { AdminPageHeader, AdminFilterTabs, AdminEmptyState } from "@/components/admin/ui";
import { AccesRefuse } from "@/components/admin/ui/AccesRefuse";
import { RejoindreVisioBouton } from "@/components/admin/contacts/RejoindreVisioBouton";
import { SuiviRendezVousForm } from "@/components/admin/contacts/SuiviRendezVousForm";
import { gardeLectureAppels } from "@/features/admin-calendly/acces";
import { listRendezVousAVenir } from "@/features/admin-rendezvous/queries";
import type { PublicRdv, RdvAVenir } from "@/features/admin-rendezvous/types";
import { MINUTES_APRES_FIN } from "@/features/admin-rendezvous/visio";
import {
  bilanDuMois,
  listRendezVousAFaireLePoint,
  type RdvAFaireLePoint,
} from "@/features/admin-rendezvous/suivi-queries";
import {
  JOURS_A_FAIRE_LE_POINT,
  mailtoRelanceAbsent,
  prenomDe,
} from "@/features/admin-rendezvous/suivi";
import { SITE_URL } from "@/lib/site-url";
import { estAppelApporteur } from "@/server/calendly/appel-apporteur";
import { LIBELLE_CANAL } from "@/server/calendly/canal";
import { dayKeyInParis, dayKeyOfGridDate, timeInParis } from "@/lib/calendar-grid";
import { formatDateFrShort } from "@/lib/format-date-fr";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ locale: string; adminPrefix: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

function lirePublic(v: string | undefined): PublicRdv | undefined {
  return v === "clients" || v === "apporteurs" ? v : undefined;
}

/** « Aujourd'hui », « Demain », sinon la date — le libellé d'un groupe de cartes. */
function libelleJour(dayKey: string, aujourdhui: string): string {
  if (dayKey === aujourdhui) return "Aujourd'hui";
  const [y = 1970, m = 1, d = 1] = aujourdhui.split("-").map(Number);
  const demain = dayKeyOfGridDate(new Date(Date.UTC(y, m - 1, d + 1)));
  if (dayKey === demain) return "Demain";
  return formatDateFrShort(dayKey);
}

function CarteRdv({ r, maintenant }: { r: RdvAVenir; maintenant: Date }) {
  const debut = r.startTime as Date;
  const apporteur = estAppelApporteur(r.title);
  return (
    <li className="admin-card flex flex-col gap-[var(--space-admin-3)]">
      <div className="flex flex-wrap items-start justify-between gap-[var(--space-admin-3)]">
        <div className="min-w-0">
          <p className="text-[length:var(--text-admin-lg)] font-semibold tabular-nums">
            {timeInParis(debut)}
            {r.endTime ? ` – ${timeInParis(r.endTime)}` : ""}
            {r.enCours ? (
              <span className="ml-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] font-medium text-[color:var(--color-admin-danger)]">
                ● en cours
              </span>
            ) : null}
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
            {apporteur ? "Apporteur" : "Client"} · {LIBELLE_CANAL[r.format]} · {r.title}
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
function CartePoint({ r }: { r: RdvAFaireLePoint }) {
  const quand = `${formatDateFrShort(r.dayKey)} à ${timeInParis(r.debut)}`;
  // Le lien personnel de report si Calendly l'a fourni, sinon la page publique
  // de réservation : dans les deux cas, l'absent choisit un nouveau créneau.
  const lienNouveauCreneau = r.rescheduleUrl ?? `${SITE_URL}/fr/appel`;
  const mailto = r.contactEmail
    ? mailtoRelanceAbsent({
        email: r.contactEmail,
        prenom: prenomDe(r.contactName),
        quand,
        lienNouveauCreneau,
      })
    : null;
  return (
    <li className="admin-card flex flex-col gap-[var(--space-admin-3)]">
      <div>
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
          {quand} · {estAppelApporteur(r.titre) ? "Apporteur" : "Client"} · {r.titre}
        </p>
      </div>
      <SuiviRendezVousForm calendlyEventId={r.id} mailtoRelance={mailto} />
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
  // Même garde que « Appels réservés » : ces cartes portent les coordonnées
  // des prospects et le lien de leur réunion. La garde avant la base.
  const acces = await gardeLectureAppels(`/${locale}/${adminPrefix}/login`);
  if (!acces.autorise) {
    return <AccesRefuse motif={acces.motif} retourHref={`/${locale}/${adminPrefix}`} />;
  }

  const sp = await searchParams;
  const publicRdv = lirePublic(sp["public"]);
  const vue = sp["vue"] === "point" ? "point" : "avenir";
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
  const lien = (v: "avenir" | "point", p: PublicRdv | undefined): string => {
    const qs = new URLSearchParams();
    if (v === "point") qs.set("vue", "point");
    if (p) qs.set("public", p);
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
        description={`Vos prochains appels : avec qui, à quelle heure, et le bouton pour lancer la visio. Un rendez-vous quitte cette liste ${MINUTES_APRES_FIN} minutes après sa fin.`}
      />

      <div className="mb-[var(--space-admin-4)] flex flex-wrap gap-[var(--space-admin-4)]">
        <AdminFilterTabs
          label="Vue"
          current={vue}
          options={[
            { value: "avenir", label: `À venir (${rdv.length})`, href: lien("avenir", publicRdv) },
            {
              value: "point",
              label: `À faire le point (${aFaire.length})`,
              href: lien("point", publicRdv),
            },
          ]}
        />
        <AdminFilterTabs
          label="Public"
          current={publicRdv ?? "tous"}
          options={[
            { value: "tous", label: "Tous", href: lien(vue, undefined) },
            { value: "clients", label: "Clients", href: lien(vue, "clients") },
            { value: "apporteurs", label: "Apporteurs", href: lien(vue, "apporteurs") },
          ]}
        />
      </div>

      {vue === "point" ? (
        <VuePoint aFaire={aFaire} maintenant={maintenant} />
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
                <CarteRdv key={r.key} r={r} maintenant={maintenant} />
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
}: {
  aFaire: RdvAFaireLePoint[];
  maintenant: Date;
}): Promise<React.ReactElement> {
  const bilan = await bilanDuMois(maintenant);
  return (
    <>
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
            <CartePoint key={r.id} r={r} />
          ))}
        </ul>
      )}
    </>
  );
}
