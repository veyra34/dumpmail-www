import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Senders from "@/screens/Senders";
import { fetchSenders } from "@/app/actions/admin-actions";
import type { Tables } from "@/integrations/supabase/types";

type Sender = Tables<"sender_accounts">;

export default async function Page() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("dumpmail_user_id")?.value;
  if (!userId) {
    redirect("/");
  }

  const senders = await fetchSenders<Sender>(userId);

  return <Senders initialSenders={senders ?? []} />;
}