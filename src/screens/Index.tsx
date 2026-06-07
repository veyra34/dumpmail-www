import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Landing from "./Landing";

export default async function Index() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("dumpmail_user_id")?.value;
  if (userId) {
    redirect("/dashboard");
  }

  return <Landing />;
}
