"use client";
// use-client: useState pour managing submit state + Server Action response.
//
// Form minimaliste de confirmation d'annulation self-service.

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cancelBookingByUserAction } from "@/features/booking/self-service-actions";

interface Props {
  token: string;
  isFr: boolean;
  refundPercentage: number;
}

export function CancelForm({ token, isFr, refundPercentage }: Props) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await cancelBookingByUserAction({
        token,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
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
            ? `Annulation confirmée. ${refundPercentage > 0 ? `Un remboursement de ${refundPercentage} % sera traité sous 5-10 jours ouvrés.` : "L'acompte reste conservé selon les CGV."} Vous recevrez un email de confirmation.`
            : `Cancellation confirmed. ${refundPercentage > 0 ? `A refund of ${refundPercentage}% will be processed within 5-10 business days.` : "The deposit is retained per the Terms."} You will receive a confirmation email.`}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="grid gap-2">
        <Label htmlFor="cancel-reason">
          {isFr ? "Motif d'annulation (optionnel)" : "Cancellation reason (optional)"}
        </Label>
        <Textarea
          id="cancel-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
        />
      </div>
      {error ? (
        <Alert variant="danger" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" loading={pending} size="lg" variant="destructive">
        {pending
          ? isFr
            ? "Annulation en cours…"
            : "Cancelling…"
          : isFr
            ? "Confirmer l'annulation"
            : "Confirm cancellation"}
      </Button>
    </form>
  );
}
