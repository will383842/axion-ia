// Hub notifications — channel email (Sprint Notif Infra 2026-05-26).
//
// V1 : placeholder. La majorité des emails transactionnels sont déjà gérés
// directement via `enqueueEmail(template, ...)` ailleurs dans le code. Le hub
// `notify()` ne route PAS d'email par défaut pour les events admin → c'est le
// caller qui appelle `enqueueEmail` en parallèle si besoin.
//
// Existe pour conformité au type union NotificationChannel et pour permettre
// l'extension future (ex : envoyer email Will pour DEPLOY_FAILED en + de
// Telegram). À étoffer Sprint+1 si besoin.

import type { NotificationCategory, NotificationSeverity } from "../types";

export async function sendEmailNotification(
  _category: NotificationCategory,
  _severity: NotificationSeverity,
  _payload: Record<string, unknown>,
): Promise<boolean> {
  // V1 : no-op explicite. Le caller utilise `enqueueEmail` directement
  // pour ses besoins email transactionnels (cf. unified-contact actions).
  return false;
}
