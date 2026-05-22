// use-client: useState pour le vote helpful/not-helpful (stateless, local UX uniquement).
"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface WasHelpfulProps {
  isFr: boolean;
  className?: string;
}

export function WasHelpful({ isFr, className }: WasHelpfulProps) {
  const [voted, setVoted] = useState<"yes" | "no" | null>(null);

  if (voted) {
    return (
      <p className={cn("text-fg-muted text-sm", className)}>
        {isFr ? "Merci pour votre retour !" : "Thanks for your feedback!"}
      </p>
    );
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="text-fg-soft text-sm">
        {isFr ? "Cette réponse vous a-t-elle aidé ?" : "Was this answer helpful?"}
      </span>
      <button
        type="button"
        onClick={() => setVoted("yes")}
        className="text-fg-soft hover:text-terracotta inline-flex items-center gap-1.5 text-sm transition"
        aria-label={isFr ? "Oui, c'était utile" : "Yes, this was helpful"}
      >
        <ThumbsUp className="h-4 w-4" aria-hidden="true" />
        {isFr ? "Oui" : "Yes"}
      </button>
      <button
        type="button"
        onClick={() => setVoted("no")}
        className="text-fg-soft hover:text-terracotta inline-flex items-center gap-1.5 text-sm transition"
        aria-label={isFr ? "Non, pas vraiment" : "No, not really"}
      >
        <ThumbsDown className="h-4 w-4" aria-hidden="true" />
        {isFr ? "Non" : "No"}
      </button>
    </div>
  );
}
