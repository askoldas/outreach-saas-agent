import { renderFrozenExportCsv } from "@/lib/exports/csv";
import { getExportRecord } from "@/server/outreach/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) return new Response("Authentication required", { status: 401 });
  const { id } = await params;
  const record = await getExportRecord(currentWorkspace.id, id);
  if (!record) return new Response("Export not found", { status: 404 });

  return new Response(`\uFEFF${renderFrozenExportCsv(record)}`, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${safeFileName(record.fileName)}"`,
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function safeFileName(value: string) {
  const safe = value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^-+/, "");
  return safe.toLowerCase().endsWith(".csv") ? safe : `${safe || "export"}.csv`;
}
