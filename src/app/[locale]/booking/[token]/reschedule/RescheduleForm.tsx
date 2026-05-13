"use client";
// use-client: useState + Server Action submit pour reschedule self-service.

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { rescheduleBookingByUserAction } from "@/features/booking/self-service-actions";

interface Props {
  token: string;
  isFr: boolean;
  /** Date min (≥ J-7). */
  minDate: string; // YYYY-MM-DD
}

export function RescheduleForm({ token, isFr, minDate }: Props) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!date) {
      setError(isFr ? "Sélectionnez une date." : "Pick a date.");
      return;
    }
    const newDate = new Date(`${date}T${time}:00.000Z`);
    if (Number.isNaN(newDate.getTime())) {
      setError(isFr ? "Date invalide." : "Invalid date.");
      return;
    }
    startTransition(async () => {
      const res = await rescheduleBookingByUserAction({
        token,
        newDate: newDate.toISOString(),
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(isFr ? `Erreur : ${res.error ?? "inconnue"}` : `Error: ${res.error ?? "unknown"}`);
      }
    });
  }

  if (success) {
    return (
      <Alert variant="success" role="status">
        <AlertDescription>
          {isFr
            ? "Date mise à jour avec succès. Vous recevrez un email de confirmation."
            : "Date updated successfully. You will receive a confirmation email."}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="rs-date">{isFr ? "Nouvelle date" : "New date"}</Label>
        <Input
          id="rs-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          min={minDate}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="rs-time">{isFr ? "Heure (UTC)" : "Time (UTC)"}</Label>
        <Input
          id="rs-time"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          required
        />
      </div>
      {error ? (
        <Alert variant="danger" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" loading={pending} size="lg">
        {pending
          ? isFr
            ? "Reprogrammation…"
            : "Rescheduling…"
          : isFr
            ? "Confirmer la nouvelle date"
            : "Confirm new date"}
      </Button>
    </form>
  );
}
