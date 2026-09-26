import { Restricted } from "@/components/layout/Restricted";
import { UserAdminView } from "@/components/views/UserAdminView";
import { getAllProfiles, getCurrentProfile } from "@/lib/data";

/**
 * Checked on the server rather than in a client guard: the profile list must
 * not be fetched at all for someone who may not see it. RLS would filter it
 * to their own row anyway, but not sending it is the stronger position.
 */
export default async function UserAdminPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") return <Restricted />;

  const profiles = await getAllProfiles();
  return <UserAdminView profiles={profiles} />;
}
