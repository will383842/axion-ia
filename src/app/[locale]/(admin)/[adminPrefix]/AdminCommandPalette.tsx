"use client";
// use-client: cmdk palette + raccourcis Cmd+K / Ctrl+K (Sprint F).
//
// Palette de commandes admin : navigation rapide + actions globales.
// Affichée en overlay modal, fermée par Esc / clic backdrop.
//
// Trigger : `Cmd+K` (Mac) / `Ctrl+K` (Windows/Linux).
//
// V1 — items :
//   - Pages principales (Dashboard, Réservations, Devis, Factures, Paiements,
//     Échéanciers, Calendrier, Heatmap, Reschedule, Options, Cadrage,
//     Submissions)
//   - Pages contenu (Blog, Case-studies, FAQ, Help, Témoignages, Catégories,
//     Newsletter, Connaissances)
//   - Système (Users, 2FA, Activity logs, Settings, Infra, Alerts, Analytics)
//
// V1.5+ : search dynamique submissions/bookings/factures via Server Action.

import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface CommandItem {
  label: string;
  hint?: string;
  href: string;
  icon: string;
  group: string;
}

function buildItems(base: string): CommandItem[] {
  return [
    // ── main ──
    { label: "Tableau de bord", icon: "📊", href: `${base}`, group: "Main" },
    { label: "Réservations", icon: "📋", href: `${base}/reservations`, group: "Main" },
    { label: "Devis", icon: "📄", href: `${base}/devis`, group: "Main" },
    { label: "Factures", icon: "🧾", href: `${base}/factures`, group: "Main" },
    { label: "Paiements", icon: "💶", href: `${base}/paiements`, group: "Main" },
    { label: "Échéanciers", icon: "📅", href: `${base}/echeanciers`, group: "Main" },
    { label: "Options 48h", icon: "⏳", href: `${base}/options`, group: "Main" },
    { label: "Submissions", icon: "📥", href: `${base}/submissions`, group: "Main" },
    // ── calendrier ──
    { label: "Calendrier", icon: "🗓️", href: `${base}/calendrier`, group: "Calendrier" },
    { label: "Heatmap géo", icon: "🗺️", href: `${base}/calendrier/heatmap`, group: "Calendrier" },
    {
      label: "Reschedule drag-drop (D60)",
      icon: "🔄",
      href: `${base}/calendrier/reschedule`,
      group: "Calendrier",
    },
    // ── filtres rapides réservations ──
    {
      label: "Réservations — Prêts à valider (D49)",
      icon: "✓",
      href: `${base}/reservations?status=awaiting_admin_validation`,
      group: "Filtres",
      hint: "awaiting_admin_validation",
    },
    {
      label: "Réservations — En attente client",
      icon: "⏳",
      href: `${base}/reservations?status=contract_payment_sent`,
      group: "Filtres",
    },
    {
      label: "Réservations — Confirmées",
      icon: "🟢",
      href: `${base}/reservations?status=confirmed`,
      group: "Filtres",
    },
    {
      label: "Réservations — En pause",
      icon: "⏸",
      href: `${base}/reservations?status=paused`,
      group: "Filtres",
    },
    {
      label: "Factures — En retard",
      icon: "⚠️",
      href: `${base}/factures?status=overdue`,
      group: "Filtres",
    },
    {
      label: "Devis — Envoyés (en attente)",
      icon: "📤",
      href: `${base}/devis?status=sent`,
      group: "Filtres",
    },
    // ── contenu ──
    { label: "Connaissances", icon: "📚", href: `${base}/connaissances`, group: "Contenu" },
    { label: "Blog", icon: "📝", href: `${base}/blog`, group: "Contenu" },
    { label: "Catégories", icon: "🏷️", href: `${base}/categories`, group: "Contenu" },
    { label: "Cas concrets", icon: "🏆", href: `${base}/case-studies`, group: "Contenu" },
    { label: "Témoignages", icon: "💬", href: `${base}/testimonials`, group: "Contenu" },
    { label: "FAQ", icon: "❓", href: `${base}/faq`, group: "Contenu" },
    { label: "Centre d'aide", icon: "❔", href: `${base}/help`, group: "Contenu" },
    { label: "Newsletter", icon: "📧", href: `${base}/newsletter`, group: "Contenu" },
    // ── content-gen (Sprint 1-12 + audit final P0-4 fix) ──
    {
      label: "Content Gen — Tableau de bord",
      icon: "🧠",
      href: `${base}/content-gen`,
      group: "Content Gen",
    },
    {
      label: "Content Gen — Campagnes couverture",
      icon: "🎯",
      href: `${base}/content-gen/coverage`,
      group: "Content Gen",
    },
    {
      label: "Content Gen — Cockpit géographique",
      icon: "🗺️",
      href: `${base}/content-gen/geo`,
      group: "Content Gen",
    },
    {
      label: "Content Gen — Jobs (queue inspector)",
      icon: "⚙️",
      href: `${base}/content-gen/jobs`,
      group: "Content Gen",
    },
    {
      label: "Content Gen — Review queue",
      icon: "✅",
      href: `${base}/content-gen/review-queue`,
      group: "Content Gen",
    },
    {
      label: "Content Gen — Publications kanban",
      icon: "🗂️",
      href: `${base}/content-gen/publications-status`,
      group: "Content Gen",
    },
    {
      label: "Content Gen — Templates",
      icon: "📐",
      href: `${base}/content-gen/templates`,
      group: "Content Gen",
    },
    {
      label: "Content Gen — Profil Manon",
      icon: "✍️",
      href: `${base}/content-gen/author/manon`,
      group: "Content Gen",
    },
    {
      label: "Content Gen — Sources RSS",
      icon: "📰",
      href: `${base}/content-gen/rss`,
      group: "Content Gen",
    },
    {
      label: "Content Gen — Réglages (12 sections)",
      icon: "⚙️",
      href: `${base}/content-gen/settings`,
      group: "Content Gen",
    },
    {
      label: "Content Gen — Kill switch 🔴",
      icon: "🛑",
      href: `${base}/content-gen/settings/kill-switch`,
      group: "Content Gen",
      hint: "URGENCE",
    },
    {
      label: "Content Gen — Coûts (30j)",
      icon: "💰",
      href: `${base}/content-gen/costs`,
      group: "Content Gen",
    },
    {
      label: "Content Gen — Similarity monitor",
      icon: "🔍",
      href: `${base}/content-gen/similarity-monitor`,
      group: "Content Gen",
    },
    {
      label: "Content Gen — Quality dashboard (V2)",
      icon: "📈",
      href: `${base}/content-gen/quality`,
      group: "Content Gen",
    },
    {
      label: "Content Gen — Keyword tracking (V2)",
      icon: "🔑",
      href: `${base}/content-gen/keyword-tracking`,
      group: "Content Gen",
    },
    {
      label: "Content Gen — Onboarding 5 étapes",
      icon: "🚀",
      href: `${base}/content-gen/onboarding`,
      group: "Content Gen",
    },
    // ── image-bank (Sprint 1-7 V1) ──
    {
      label: "Image bank — Overview",
      icon: "🖼️",
      href: `${base}/image-bank`,
      group: "Image bank",
    },
    {
      label: "Image bank — Library",
      icon: "📚",
      href: `${base}/image-bank/library`,
      group: "Image bank",
    },
    {
      label: "Image bank — Upload",
      icon: "⬆️",
      href: `${base}/image-bank/upload`,
      group: "Image bank",
    },
    {
      label: "Image bank — Bulk import CSV",
      icon: "📥",
      href: `${base}/image-bank/bulk-import`,
      group: "Image bank",
    },
    {
      label: "Image bank — Quality queue",
      icon: "✅",
      href: `${base}/image-bank/quality`,
      group: "Image bank",
    },
    {
      label: "Image bank — Analytics",
      icon: "📈",
      href: `${base}/image-bank/analytics`,
      group: "Image bank",
    },
    {
      label: "Image bank — Categories",
      icon: "🗂️",
      href: `${base}/image-bank/categories`,
      group: "Image bank",
    },
    {
      label: "Image bank — Tags",
      icon: "🏷️",
      href: `${base}/image-bank/tags`,
      group: "Image bank",
    },
    {
      label: "Image bank — Settings",
      icon: "⚙️",
      href: `${base}/image-bank/settings`,
      group: "Image bank",
    },
    // ── ops ──
    { label: "Analytics & SEO", icon: "📊", href: `${base}/analytics`, group: "Ops" },
    { label: "Infra & outils", icon: "🔧", href: `${base}/infra`, group: "Ops" },
    { label: "Alertes ops", icon: "🚨", href: `${base}/alerts`, group: "Ops" },
    // ── système ──
    { label: "Utilisateurs", icon: "👥", href: `${base}/users`, group: "Système" },
    { label: "Activity logs", icon: "📜", href: `${base}/activity-logs`, group: "Système" },
    { label: "Paramètres", icon: "⚙️", href: `${base}/settings`, group: "Système" },
    { label: "2FA — sécurité", icon: "🔐", href: `${base}/2fa/setup`, group: "Système" },
  ];
}

export function AdminCommandPalette({ adminPrefix }: { adminPrefix: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const base = `/fr/${adminPrefix}`;
  const items = buildItems(base);

  // Raccourci global Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Group items par section pour cmdk groups
  const grouped = items.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group]!.push(item);
    return acc;
  }, {});

  function select(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        className="admin-cmdk-trigger"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir la palette de commandes (Ctrl+K)"
        title="Ctrl+K / Cmd+K"
      >
        <span aria-hidden="true">⌘K</span>
      </button>
      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Palette de commandes admin"
        className="admin-cmdk-dialog"
      >
        <Command.Input
          placeholder="Tapez pour filtrer — Cmd+K pour fermer…"
          className="admin-cmdk-input"
        />
        <Command.List className="admin-cmdk-list">
          <Command.Empty className="admin-cmdk-empty">Aucun résultat.</Command.Empty>
          {Object.entries(grouped).map(([group, groupItems]) => (
            <Command.Group key={group} heading={group} className="admin-cmdk-group">
              {groupItems.map((item) => (
                <Command.Item
                  key={item.href}
                  value={`${item.group} ${item.label} ${item.hint ?? ""}`}
                  onSelect={() => select(item.href)}
                  className="admin-cmdk-item"
                >
                  <span aria-hidden="true" className="admin-cmdk-icon">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {item.hint && (
                    <span className="admin-cmdk-hint" aria-hidden="true">
                      {item.hint}
                    </span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command.Dialog>
    </>
  );
}
