"use client";
// use-client: formulaire à état local + appel de Server Action. C'est le SEUL
// composant client que ce chantier ajoute — les trois vues de l'agenda restent
// entièrement rendues côté serveur.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  creerRendezVousAction,
  modifierEvenementAction,
} from "@/server/actions/agenda/indisponibilites";
import { AdminButton } from "@/components/admin/ui";

/**
 * Ajouter ou modifier un rendez-vous depuis la console (2026-08-27).
 *
 * CE QU'IL FAIT VRAIMENT, ET CE QU'IL NE FAIT PAS
 * ------------------------------------------------
 * Il écrit dans l'agenda Google. Rien d'autre. C'est suffisant pour fermer le
 * créneau côté réservation en ligne — un événement occupé y suffit, en une
 * dizaine de secondes — et c'est la SEULE voie possible : Calendly n'expose
 * aucune API de création de réservation.
 *
 * ⚠️ AUCUN E-MAIL NE PART. Ni à l'invité, ni à personne. La note saisie ici est
 * INTERNE : elle atterrit dans la description de l'événement Google, donc elle
 * se lit dans la console et sur l'iPhone, mais jamais chez le client. Prévenir
 * quelqu'un reste un geste humain, séparé et délibéré — décision de Will,
 * 2026-08-27.
 *
 * 🔴 LE PIÈGE DU FUSEAU, DÉJÀ PAYÉ UNE FOIS.
 * `new Date("2026-09-08T12:00")` est interprété dans le fuseau du NAVIGATEUR :
 * un admin en déplacement hors de France poserait un rendez-vous décalé de
 * plusieurs heures, l'écran affichant l'heure demandée et l'agenda en contenant
 * une autre. On lit donc l'offset réel de Paris pour CE jour-là, comme le fait
 * déjà `PoserIndisponibiliteForm`.
 */

/** Bornes raisonnables de saisie — au-delà, c'est une erreur de frappe. */
const HEURE_DEFAUT_DEBUT = "09:00";
const HEURE_DEFAUT_FIN = "10:00";

function instantParis(jour: string, heure: string): string {
  const sonde = new Date(`${jour}T12:00:00Z`);
  const nom = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    timeZoneName: "longOffset",
  })
    .formatToParts(sonde)
    .find((p) => p.type === "timeZoneName")?.value;
  // `longOffset` rend « GMT+02:00 ». En repli — moteur trop ancien — on prend
  // +01:00 : se tromper d'une heure vaut mieux qu'une date que le serveur
  // rejettera sans rien dire.
  const offset = nom?.replace("GMT", "") || "+01:00";
  return `${jour}T${heure}:00${offset}`;
}

export interface RendezVousExistant {
  readonly eventId: string;
  readonly titre: string;
  readonly heureDebut: string;
  readonly heureFin: string;
  readonly contact: string;
  readonly telephone: string;
  readonly note: string;
}

export interface RendezVousFormProps {
  /** Jour affiché, « AAAA-MM-JJ ». */
  readonly jour: string;
  /** `false` quand l'agenda Google n'est pas connecté : le formulaire se désarme. */
  readonly actif: boolean;
  /** Présent en modification, absent en création. */
  readonly existant?: RendezVousExistant;
}

const CHAMP =
  "rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-bg)] px-[var(--space-admin-2)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)]";
const LABEL =
  "flex flex-col gap-[var(--space-admin-1)] text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg)]";

export function RendezVousForm({ jour, actif, existant }: RendezVousFormProps): React.ReactElement {
  const router = useRouter();
  const modification = existant !== undefined;
  const [ouvert, setOuvert] = useState(false);
  const [titre, setTitre] = useState(existant?.titre ?? "");
  const [debut, setDebut] = useState(existant?.heureDebut ?? HEURE_DEFAUT_DEBUT);
  const [fin, setFin] = useState(existant?.heureFin ?? HEURE_DEFAUT_FIN);
  const [contact, setContact] = useState(existant?.contact ?? "");
  const [telephone, setTelephone] = useState(existant?.telephone ?? "");
  const [note, setNote] = useState(existant?.note ?? "");
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  function soumettre(): void {
    setMessage(null);
    demarrer(async () => {
      const charge = {
        titre: titre.trim() || "Rendez-vous",
        debutIso: instantParis(jour, debut),
        finIso: instantParis(jour, fin),
        ...(contact.trim() ? { contact: contact.trim() } : {}),
        ...(telephone.trim() ? { telephone: telephone.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
      };

      const res = modification
        ? await modifierEvenementAction({ ...charge, eventId: existant.eventId })
        : await creerRendezVousAction(charge);

      setMessage({ ok: res.ok, texte: res.message });
      if (res.ok) {
        if (!modification) {
          // On vide les champs libres après une création : sans ça, le contact
          // du rendez-vous précédent serait repris au suivant.
          setTitre("");
          setContact("");
          setTelephone("");
          setNote("");
        }
        setOuvert(false);
        router.refresh();
      }
    });
  }

  if (!actif) {
    return (
      <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Connectez l&apos;agenda Google pour pouvoir ajouter un rendez-vous depuis cette page.
      </p>
    );
  }

  if (!ouvert) {
    return (
      <div className="flex flex-col gap-[var(--space-admin-2)]">
        <AdminButton
          type="button"
          variant={modification ? "secondary" : "primary"}
          onClick={() => setOuvert(true)}
        >
          {modification ? "Modifier" : "Ajouter un rendez-vous"}
        </AdminButton>
        {message && (
          <p
            role="status"
            className={`text-[length:var(--text-admin-sm)] ${message.ok ? "text-[color:var(--color-admin-fg)]" : "text-[color:var(--color-admin-danger)]"}`}
          >
            {message.texte}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border-strong)] bg-[color:var(--color-admin-bg-subtle)] p-[var(--space-admin-3)]">
      <h3 className="text-[length:var(--text-admin-md)] font-medium">
        {modification ? "Modifier ce rendez-vous" : "Nouveau rendez-vous"}
      </h3>

      <label className={LABEL}>
        Objet
        <input
          type="text"
          value={titre}
          maxLength={120}
          placeholder="Rendez-vous"
          onChange={(e) => setTitre(e.target.value)}
          className={CHAMP}
        />
      </label>

      <div className="flex flex-wrap gap-[var(--space-admin-3)]">
        <label className={LABEL}>
          De
          <input
            type="time"
            value={debut}
            step={900}
            onChange={(e) => setDebut(e.target.value)}
            className={CHAMP}
          />
        </label>
        <label className={LABEL}>
          à
          <input
            type="time"
            value={fin}
            step={900}
            onChange={(e) => setFin(e.target.value)}
            className={CHAMP}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-[var(--space-admin-3)]">
        <label className={LABEL}>
          Personne <span className="text-[color:var(--color-admin-fg-muted)]">(facultatif)</span>
          <input
            type="text"
            value={contact}
            maxLength={120}
            onChange={(e) => setContact(e.target.value)}
            className={CHAMP}
          />
        </label>
        <label className={LABEL}>
          Téléphone <span className="text-[color:var(--color-admin-fg-muted)]">(facultatif)</span>
          <input
            type="tel"
            value={telephone}
            maxLength={40}
            onChange={(e) => setTelephone(e.target.value)}
            className={CHAMP}
          />
        </label>
      </div>

      <label className={LABEL}>
        Note interne <span className="text-[color:var(--color-admin-fg-muted)]">(facultatif)</span>
        <textarea
          value={note}
          maxLength={500}
          rows={2}
          onChange={(e) => setNote(e.target.value)}
          className={CHAMP}
        />
        <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Visible dans la console et dans votre agenda Google — donc sur votre iPhone.{" "}
          <strong>Rien n&apos;est envoyé à la personne.</strong>
        </span>
      </label>

      {message && !message.ok && (
        <p
          role="alert"
          className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-danger)]"
        >
          {message.texte}
        </p>
      )}

      <div className="flex flex-wrap gap-[var(--space-admin-2)]">
        <AdminButton type="button" onClick={soumettre} disabled={enCours}>
          {enCours ? "En cours…" : modification ? "Enregistrer" : "Ajouter"}
        </AdminButton>
        <AdminButton type="button" variant="secondary" onClick={() => setOuvert(false)}>
          Annuler
        </AdminButton>
      </div>

      <p className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
        Le créneau se ferme automatiquement à la réservation en ligne, en une dizaine de secondes.
      </p>
    </div>
  );
}
