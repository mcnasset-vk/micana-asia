"use client";

import { TmsModule } from "./TmsModule";

/**
 * The landing page.
 *
 * There is no routing left to do here. This deployment publishes two personas
 * and TmsModule picks between them from the business line, so the landing page
 * is the module and nothing else. The role check that used to stand here —
 * super admin or `tms`, everyone else restricted — moved into TmsModule, which
 * is where the same decision has to be made for a direct link to /tms anyway.
 * One decision in one place beats two that can disagree.
 */
export function HomeView() {
  return <TmsModule />;
}
