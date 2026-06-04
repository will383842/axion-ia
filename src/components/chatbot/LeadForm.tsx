"use client";
// use-client: formulaire de capture de lead (état local + fetch POST + consentement).

import * as React from "react";
import { useTranslations } from "next-intl";
import { trackFunnel } from "@/lib/tracking";

type Status = "idle" | "sending" | "ok" | "error";

export function LeadForm({
  sessionUuid,
  onClose,
}: {
  sessionUuid: string | undefined;
  onClose: () => void;
}): React.ReactElement {
  const t = useTranslations("chatbot");
  const [status, setStatus] = React.useState<Status>("idle");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setStatus("sending");
    try {
      const res = await fetch("/api/chatbot/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: fd.get("nom"),
          email: fd.get("email"),
          telephone: (fd.get("telephone") as string) || undefined,
          besoin: fd.get("besoin"),
          consentement: fd.get("consentement") === "on",
          ...(sessionUuid ? { sessionUuid } : {}),
        }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (res.ok && data.ok) {
        setStatus("ok");
        trackFunnel("Chat Lead");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm">{t("leadSuccess")}</p>
        <button
          type="button"
          onClick={onClose}
          className="border-border hover:bg-bg-soft self-start rounded-md border px-3 py-1.5 text-sm"
        >
          {t("leadClose")}
        </button>
      </div>
    );
  }

  const fieldCls =
    "rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-terracotta focus:outline-none";

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <p className="text-fg-soft text-sm font-medium">{t("leadTitle")}</p>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t("leadName")}</span>
        <input name="nom" type="text" required maxLength={255} className={fieldCls} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t("leadEmail")}</span>
        <input name="email" type="email" required className={fieldCls} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t("leadPhone")}</span>
        <input name="telephone" type="tel" maxLength={30} className={fieldCls} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span>{t("leadNeed")}</span>
        <textarea name="besoin" rows={3} required maxLength={2000} className={fieldCls} />
      </label>

      <label className="flex items-start gap-2 text-xs">
        <input name="consentement" type="checkbox" required className="mt-0.5" />
        <span>{t("leadConsent")}</span>
      </label>

      {status === "error" ? <p className="text-terracotta-deep text-xs">{t("leadError")}</p> : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={status === "sending"}
          className="bg-terracotta-deep hover:bg-terracotta rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {status === "sending" ? t("leadSending") : t("leadSubmit")}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="border-border hover:bg-bg-soft rounded-md border px-3 py-1.5 text-sm"
        >
          {t("leadCancel")}
        </button>
      </div>
    </form>
  );
}
