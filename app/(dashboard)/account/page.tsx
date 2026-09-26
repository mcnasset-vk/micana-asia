import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { getCurrentProfile } from "@/lib/data";
import { BUSINESS_LINE_LABELS, ROLE_LABELS } from "@/lib/types";

import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function AccountPage() {
  const profile = await getCurrentProfile();

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Your account"
        description="Sign-in details for this dashboard. Changing your password here changes it everywhere — it is the same account you use on any device."
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Change password"
            hint="Applies immediately. Other devices stay signed in until their session expires."
          />
          <div className="p-5">
            <ChangePasswordForm />
          </div>
        </Card>

        <Card>
          <CardHeader title="Signed in as" />
          <dl className="divide-y divide-line">
            <Row label="Name" value={profile?.fullName ?? "—"} />
            <Row label="Email" value={profile?.email ?? "—"} />
            <Row
              label="Role"
              value={
                profile?.role
                  ? ROLE_LABELS[profile.role]
                  : "Pending"
              }
            />
            <Row
              label="Access"
              value={
                profile?.role === "super_admin"
                  ? "Every division"
                  : profile?.businessLine
                    ? BUSINESS_LINE_LABELS[profile.businessLine]
                    : profile?.role === "mdna" || profile?.role === "mec"
                      ? `${ROLE_LABELS[profile.role]} — whole division`
                      : "No access assigned yet"
              }
            />
          </dl>
          <footer className="border-t border-line px-5 py-3">
            <p className="text-[0.6875rem] leading-relaxed text-ink-subtle">
              Roles are set by the super admin in the database. They cannot be
              changed from this screen, and nothing here can widen your own
              access.
            </p>
          </footer>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-5 py-3">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
