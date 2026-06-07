import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Auth from "@/screens/Auth";

export default async function Page() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("dumpmail_user_id")?.value;
  if (userId) {
    redirect("/dashboard");
  }

  return <Auth />;
}