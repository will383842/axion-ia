"use client";
// use-client: sélecteur d'affectation du formateur à une réservation (Phase 2
// calendrier, Will 2026-06-10). Modifiable à tout moment. Libre parmi les
// formateurs actifs ; filtre visuel facultatif par région.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignTrainerToBookingAction } from "@/features/booking/admin-actions";

export interface TrainerOption {
  id: string;
  label: string;
  region: string | null;
}

interface Props {
  bookingId: string;
  current: string | null;
  trainers: ReadonlyArray<TrainerOption>;
  /** Map region slug → label FR (pour afficher la région à côté du nom). */
  regionLabels: Record<string, string>;
}

export function BookingFormateurSelect({
  bookingId,
  current,
  trainers,
  regionLabels,
}: Props): React.ReactElement {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState<string>(current ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await assignTrainerToBookingAction({
        bookingId,
        trainerId: value === "" ? null : value,
      });
      if (res.ok) {
        setMsg(value === "" ? "Formateur retiré." : "Formateur affecté.");
        router.refresh();
      } else {
        setErr(
          res.error === "trainer_unavailable"
            ? "Formateur introuvable ou inactif."
            : "Échec de l'affectation.",
        );
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <select
        aria-label="Formateur affecté"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={isPending}
        className="admin-input"
      >
        <option value="">— Aucun formateur —</option>
        {trainers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
            {t.region && regionLabels[t.region] ? ` · ${regionLabels[t.region]}` : ""}
          </option>
        ))}
      </select>
      <div>
        <button
          type="button"
          onClick={submit}
          disabled={isPending || value === (current ?? "")}
          className="admin-button"
        >
          {isPending ? "Enregistrement…" : "Enregistrer le formateur"}
        </button>
      </div>
      {msg && (
        <p role="status" className="admin-meta">
          {msg}
        </p>
      )}
      {err && (
        <p role="alert" className="admin-meta" style={{ color: "var(--color-admin-error)" }}>
          {err}
        </p>
      )}
    </div>
  );
}
