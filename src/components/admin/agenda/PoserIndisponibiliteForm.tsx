"use client";
// use-client: formulaire avec état local (mode de fermeture, retour de l'action)
// + appel de Server Action. C'est le SEUL composant client de l'Agenda : la
// frise horaire est rendue côté serveur, sans un octet de JavaScript.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { poserIndisponibiliteAction } from "@/server/actions/agenda/indisponibilites";
import { AdminButton } from "@/components/admin/ui";

/**
 * Trois façons de fermer une journée, parce que ce sont les trois vraies.
 *
 * 🔴 « APRÈS » EST LE PIÈGE, ET IL EST INVISIBLE. Calendly ferme aussi le
 * créneau ADJACENT à un événement occupé : demander « ferme après 12 h » et
 * poser le blocage à 12:00 supprime le créneau de 11:30, qui finit pourtant
 * pile à midi. Mesuré le 2026-08-26, deux fois, avant de comprendre. Ce
 * formulaire parle donc en langage humain — « le dernier créneau se termine
 * à 12 h » — et laisse l'action serveur décaler le blocage du battement. Will
 * n'a pas à connaître ce détail, ni à le redécouvrir en constatant qu'il lui
 * manque un créneau.
 */
type Mode = "journee" | "apres" | "plage";

const MODES: ReadonlyArray<{ readonly id: Mode; readonly label: string }> = [
  { id: "journee", label: "Toute la journée" },
  { id: "apres", label: "Après une heure" },
  { id: "plage", label: "Une plage précise" },
];

/** Bornes de la plage réservable — au-delà, il n'y a rien à fermer. */
const OUVERTURE = "08:00";
const FERMETURE = "20:00";

export interface PoserIndisponibiliteFormProps {
  /** Jour affiché, « AAAA-MM-JJ ». */
  readonly jour: string;
  /** `false` quand l'agenda Google n'est pas connecté : le formulaire se désarme. */
  readonly actif: boolean;
}

/**
 * Construit un instant ISO à partir du jour affiché et d'une heure de PARIS.
 *
 * 🔴 NE JAMAIS FAIRE `new Date("2026-09-08T12:00")` ICI. Cette forme est
 * interprétée dans le fuseau du NAVIGATEUR : un admin en déplacement hors de
 * France poserait un blocage décalé de plusieurs heures, sans que rien ne le
 * signale — l'écran afficherait l'heure demandée et l'agenda en contiendrait une
 * autre. On lit donc l'offset réel de Paris pour CE jour-là (il change deux fois
 * par an) et on l'écrit dans la chaîne.
 *
 * La sonde est prise à 12:00 UTC : les bascules d'heure ont lieu au petit matin,
 * donc midi tombe toujours du bon côté et l'offset lu est celui de la journée.
 */
function instantParis(jour: string, heure: string): string {
  const sonde = new Date(`${jour}T12:00:00Z`);
  const nom = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    timeZoneName: "longOffset",
  })
    .formatToParts(sonde)
    .find((p) => p.type === "timeZoneName")?.value;
  // `longOffset` rend « GMT+02:00 ». En repli — moteur trop ancien — on prend
  // +01:00, l'heure d'hiver française : se tromper d'une heure vaut mieux que
  // de produire une date invalide que le serveur rejettera sans rien dire.
  const offset = nom?.replace("GMT", "") || "+01:00";
  return `${jour}T${heure}:00${offset}`;
}

export function PoserIndisponibiliteForm({
  jour,
  actif,
}: PoserIndisponibiliteFormProps): React.ReactElement {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [mode, setMode] = useState<Mode>("apres");
  const [heureFin, setHeureFin] = useState("12:00");
  const [debut, setDebut] = useState("12:00");
  const [fin, setFin] = useState("18:00");
  // Titre et note : facultatifs, mais l'action serveur les accepte depuis le
  // premier jour (120 et 500 caracteres). Sans eux, tous les blocages
  // s'appelaient « Indisponible » et rien ne distinguait un dejeuner client
  // d'un conge — dans l'agenda comme dans la console.
  const [titre, setTitre] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  function soumettre(): void {
    setMessage(null);
    demarrer(async () => {
      // Un titre vide retombe sur « Indisponible » : le schema serveur exige au
      // moins un caractere, et un blocage sans nom reste un blocage valide.
      const titrePropre = titre.trim() || "Indisponible";
      const notePropre = note.trim();
      const commun = {
        titre: titrePropre,
        depuisFinDeCreneau: false,
        ...(notePropre ? { note: notePropre } : {}),
      };
      let charge: Record<string, unknown>;

      if (mode === "journee") {
        charge = {
          ...commun,
          debutIso: instantParis(jour, OUVERTURE),
          finIso: instantParis(jour, FERMETURE),
        };
      } else if (mode === "apres") {
        charge = {
          ...commun,
          // `depuisFinDeCreneau` : l'heure saisie est la FIN du dernier créneau
          // à conserver. Le serveur décale le blocage du battement Calendly.
          depuisFinDeCreneau: true,
          debutIso: instantParis(jour, heureFin),
          finIso: instantParis(jour, FERMETURE),
        };
      } else {
        charge = {
          ...commun,
          debutIso: instantParis(jour, debut),
          finIso: instantParis(jour, fin),
        };
      }

      const res = await poserIndisponibiliteAction(charge);
      setMessage({ ok: res.ok, texte: res.message });
      if (res.ok) {
        // On vide les deux champs libres : sans ca, le motif du blocage
        // precedent serait repris tel quel au suivant, et un « dejeuner client »
        // finirait sur un conge sans que personne le remarque.
        setTitre("");
        setNote("");
        setOuvert(false);
        router.refresh();
      }
    });
  }

  if (!actif) {
    return (
      <p className="text-[length:var(--text-admin-sm)] text-[color:var(--color-admin-fg-muted)]">
        Connectez l&apos;agenda Google pour pouvoir poser une indisponibilité depuis cette page.
      </p>
    );
  }

  if (!ouvert) {
    return (
      <div className="flex flex-col gap-[var(--space-admin-2)]">
        <AdminButton type="button" onClick={() => setOuvert(true)}>
          Fermer des créneaux
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
    <div className="flex flex-col gap-[var(--space-admin-3)] rounded-[var(--radius-admin-md)] border border-[color:var(--color-admin-border)] p-[var(--space-admin-3)]">
      <fieldset className="flex flex-col gap-[var(--space-admin-2)]">
        <legend className="text-[length:var(--text-admin-sm)] font-medium">
          Que veux-tu fermer&nbsp;?
        </legend>
        <div className="flex flex-wrap gap-[var(--space-admin-2)]">
          {MODES.map((m) => (
            <label
              key={m.id}
              className={`cursor-pointer rounded-[var(--radius-admin-sm)] border px-[var(--space-admin-3)] py-[var(--space-admin-2)] text-[length:var(--text-admin-sm)] ${
                mode === m.id
                  ? "border-[color:var(--color-admin-accent)] bg-[color:var(--color-admin-info-soft)]"
                  : "border-[color:var(--color-admin-border)]"
              }`}
            >
              <input
                type="radio"
                name="mode-indispo"
                className="sr-only"
                checked={mode === m.id}
                onChange={() => setMode(m.id)}
              />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      {mode === "apres" && (
        <label className="flex flex-col gap-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]">
          Le dernier rendez-vous doit se terminer à
          <input
            type="time"
            value={heureFin}
            step={900}
            onChange={(e) => setHeureFin(e.target.value)}
            className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-2)] py-[var(--space-admin-2)]"
          />
          <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
            Le créneau qui finit à cette heure-là reste réservable ; tout ce qui suit se ferme.
          </span>
        </label>
      )}

      {mode === "plage" && (
        <div className="flex flex-wrap gap-[var(--space-admin-3)]">
          <label className="flex flex-col gap-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]">
            De
            <input
              type="time"
              value={debut}
              step={900}
              onChange={(e) => setDebut(e.target.value)}
              className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-2)] py-[var(--space-admin-2)]"
            />
          </label>
          <label className="flex flex-col gap-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]">
            à
            <input
              type="time"
              value={fin}
              step={900}
              onChange={(e) => setFin(e.target.value)}
              className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-2)] py-[var(--space-admin-2)]"
            />
          </label>
        </div>
      )}

      <label className="flex flex-col gap-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]">
        Motif <span className="text-[color:var(--color-admin-fg-muted)]">(facultatif)</span>
        <input
          type="text"
          value={titre}
          maxLength={120}
          placeholder="Indisponible"
          onChange={(e) => setTitre(e.target.value)}
          className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-2)] py-[var(--space-admin-2)]"
        />
        <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          C&apos;est le titre visible dans Google Agenda et sur votre iPhone. Laisse vide pour
          «&nbsp;Indisponible&nbsp;».
        </span>
      </label>

      <label className="flex flex-col gap-[var(--space-admin-1)] text-[length:var(--text-admin-sm)]">
        Note <span className="text-[color:var(--color-admin-fg-muted)]">(facultatif)</span>
        <textarea
          value={note}
          maxLength={500}
          rows={2}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-[var(--radius-admin-sm)] border border-[color:var(--color-admin-border)] px-[var(--space-admin-2)] py-[var(--space-admin-2)]"
        />
        <span className="text-[length:var(--text-admin-xs)] text-[color:var(--color-admin-fg-muted)]">
          Ajoutee a la description de l&apos;evenement, sous la mention qui permet de le retirer.
          {note.length > 0 ? ` ${String(500 - note.length)} caracteres restants.` : ""}
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
          {enCours ? "En cours…" : "Fermer ces créneaux"}
        </AdminButton>
        <AdminButton type="button" variant="secondary" onClick={() => setOuvert(false)}>
          Annuler
        </AdminButton>
      </div>
    </div>
  );
}
