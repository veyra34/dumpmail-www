import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyAndSaveInstallation } from "@/app/actions/githubActions";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const installationId = searchParams.get("installation_id");

  if (!installationId) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const cookieStore = await cookies();
  const userId = cookieStore.get("dumpmail_user_id")?.value;

  if (!userId) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Verify repository selection and save installation details on the server
  await verifyAndSaveInstallation(userId, installationId);

  // Redirect the user directly to the dashboard
  return NextResponse.redirect(new URL("/dashboard", request.url));
}
