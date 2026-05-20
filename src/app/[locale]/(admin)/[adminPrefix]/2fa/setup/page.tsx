// Page setup 2FA (Sprint 15 step 5).
//
// Flow :
// 1. Server Action setup2FAStartAction génère un secret + URI otpauth
// 2. La page affiche le secret en mode manual (V1 sans QR — Will pourra
//    ajouter qrcode lib en M9). User scan dans son authenticator.
// 3. User entre le 1er code TOTP → setup2FAConfirmAction valide + active.

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { setup2FAStartAction } from "@/features/admin-auth/actions";
import { Setup2FAForm } from "./Setup2FAForm";
import { Setup2FAV2 } from "./_v2/Setup2FAV2";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ adminPrefix: string }>;
}

export default async function AdminSetup2FAPage({ params }: PageProps) {
  const { adminPrefix } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/fr/${adminPrefix}/login`);
  }

  const start = await setup2FAStartAction();

  return <Setup2FAV2 start={start} />;
}

