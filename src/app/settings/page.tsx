import { redirect } from "next/navigation";
import {
  getCurrentProfile,
  getWorkspaceContext,
  listWorkspaceMembers,
} from "@/server/workspaces/repository";
import {
  clearWorkspaceDataAction,
  updateProfileSettingsAction,
  updateWorkspaceSettingsAction,
} from "@/server/workspaces/actions";
import { getCurrentUser } from "@/server/auth/user";
import { getProviderStatus } from "@/lib/providers/config";
import { statusLabel } from "@/lib/format";
import styles from "@/features/shared/Feature.module.css";
import form from "@/components/ui/FormControls.module.css";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

type SearchParams = {
  error?: string;
  message?: string;
};

const localeOptions = [
  ["en", "English"],
  ["lv", "Latvian"],
  ["de", "German"],
  ["fr", "French"],
] as const;

export default async function SettingsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/sign-in?next=/settings");
  }

  const { currentWorkspace, workspaces } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  const [members, params, profile] = await Promise.all([
    listWorkspaceMembers(currentWorkspace.id),
    searchParams,
    getCurrentProfile(),
  ]);
  const providerStatus = getProviderStatus();

  return (
    <div className={styles.grid}>
      <PageHeader
        title="Settings"
        description={`Manage workspace identity, member visibility, and your profile for ${currentWorkspace.name}.`}
      />

      {params.error ? <p className={form.errorText}>{params.error}</p> : null}
      {params.message ? (
        <Badge tone="success">{statusLabel(params.message)}</Badge>
      ) : null}

      <section className={styles.twoColumn}>
        <Card>
          <CardHeader
            title="Workspace"
            eyebrow={currentWorkspace.slug}
            action={
              <Badge tone={workspaceStatusTone(currentWorkspace.status)}>
                {currentWorkspace.status}
              </Badge>
            }
          />
          <form className={styles.cardBody} action={updateWorkspaceSettingsAction}>
            <div className={styles.stack}>
              <input name="workspaceId" type="hidden" value={currentWorkspace.id} />
              <label className={form.field} htmlFor="workspace-name">
                <span>Name</span>
                <input
                  className={form.input}
                  defaultValue={currentWorkspace.name}
                  id="workspace-name"
                  maxLength={120}
                  name="name"
                  required
                />
              </label>
              <label className={form.field} htmlFor="workspace-website">
                <span>Website</span>
                <input
                  className={form.input}
                  defaultValue={currentWorkspace.websiteUrl ?? ""}
                  id="workspace-website"
                  name="websiteUrl"
                  placeholder="https://example.com"
                  type="url"
                />
              </label>
              <label className={form.field} htmlFor="workspace-locale">
                <span>Default locale</span>
                <select
                  className={form.select}
                  defaultValue={currentWorkspace.defaultLocale}
                  id="workspace-locale"
                  name="defaultLocale"
                >
                  {localeOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="primary">
                Save workspace
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader title="Your profile" eyebrow={profile.id.slice(0, 8)} />
          <form className={styles.cardBody} action={updateProfileSettingsAction}>
            <div className={styles.stack}>
              <label className={form.field} htmlFor="display-name">
                <span>Display name</span>
                <input
                  className={form.input}
                  defaultValue={profile.displayName ?? ""}
                  id="display-name"
                  name="displayName"
                  placeholder="Your name"
                />
              </label>
              <label className={form.field} htmlFor="profile-locale">
                <span>Locale</span>
                <select
                  className={form.select}
                  defaultValue={profile.locale}
                  id="profile-locale"
                  name="locale"
                >
                  {localeOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="primary">
                Save profile
              </Button>
            </div>
          </form>
        </Card>
      </section>

      <Card>
        <CardHeader
          title="Members"
          eyebrow={`${members.length} visible member${members.length === 1 ? "" : "s"}`}
        />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.userId}>
                  <td>
                    <span className={styles.primaryText}>
                      {member.displayName ?? "Unnamed member"}
                    </span>
                    <span className={styles.secondaryText}>
                      {member.email ?? member.userId}
                    </span>
                  </td>
                  <td>{statusLabel(member.role)}</td>
                  <td>
                    <Badge tone={memberStatusTone(member.status)}>
                      {statusLabel(member.status)}
                    </Badge>
                  </td>
                  <td>{new Date(member.createdAt).toLocaleDateString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Workspace access" eyebrow="Current session" />
        <div className={styles.cardBody}>
          <p>
            <strong>Accessible workspaces:</strong> {workspaces.length}
          </p>
          <p>
            <strong>Current workspace id:</strong> {currentWorkspace.id}
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader title="Provider readiness" eyebrow="External services" />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Purpose</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {providerStatus.map((provider) => (
                <tr key={provider.name}>
                  <td>{provider.label}</td>
                  <td>{provider.purpose}</td>
                  <td>
                    <Badge tone={provider.configured ? "success" : "warning"}>
                      {provider.configured ? "Configured" : "Missing key"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Danger zone" eyebrow="Workspace data" />
        <form className={styles.cardBody} action={clearWorkspaceDataAction}>
          <div className={styles.stack}>
            <input name="workspaceId" type="hidden" value={currentWorkspace.id} />
            <label className={form.field} htmlFor="clear-confirmation">
              <span>
                Type CLEAR to remove offers, campaigns, leads, drafts, and activity
              </span>
              <input
                autoComplete="off"
                className={form.input}
                id="clear-confirmation"
                name="confirmation"
                placeholder="CLEAR"
              />
            </label>
            <Button type="submit" variant="danger">
              Clear workspace data
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function workspaceStatusTone(status: "active" | "closed" | "suspended") {
  if (status === "active") return "success";
  if (status === "suspended") return "warning";
  return "danger";
}

function memberStatusTone(status: "active" | "invited" | "removed") {
  if (status === "active") return "success";
  if (status === "invited") return "warning";
  return "danger";
}
