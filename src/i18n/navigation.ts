import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Use these wrappers EVERYWHERE instead of next/link / next/navigation
// imports — they keep the active locale automatic.
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
