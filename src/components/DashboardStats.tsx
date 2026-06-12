import { fetchDashboardStats } from "@/app/actions/admin-actions";
import Link from "next/link";
import { Send, Users, FileText, Mailbox, Activity } from "lucide-react";

const cards = [
  { key: "campaigns" as const, label: "Campaigns", icon: Send, path: "/campaigns" },
  { key: "leads" as const, label: "Leads", icon: Users, path: "/leads" },
  { key: "templates" as const, label: "Templates", icon: FileText, path: "/templates" },
  { key: "senders" as const, label: "Senders", icon: Mailbox, path: "/senders" },
  { key: "events" as const, label: "Events", icon: Activity, path: "/events" },
];

export default async function DashboardStats({ userId }: { userId: string }) {
    const stats = await fetchDashboardStats(userId);

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {cards.map((c) => (
                <Link
                    key={c.key}
                    href={c.path}
                    className="border border-border rounded-md p-4 bg-card hover:border-primary/40 hover:bg-secondary/40 transition-colors"
                >
                    <div className="flex items-center justify-between mb-3">
                        <c.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="text-2xl font-bold tracking-tight">{stats[c.key]}</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">{c.label}</div>
                </Link>
            ))}
        </div>
    );

}
