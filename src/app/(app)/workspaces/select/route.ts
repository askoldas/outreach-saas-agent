import { NextResponse } from "next/server";
import { selectWorkspaceAction } from "@/server/workspaces/actions";

export async function POST(request: Request) {
  const formData = await request.formData();
  await selectWorkspaceAction(formData);

  return NextResponse.redirect(new URL("/dashboard", request.url), { status: 303 });
}
