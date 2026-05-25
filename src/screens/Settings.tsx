"use client";

import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Github, Copy, Check, ExternalLink } from "lucide-react";
import { updateProfile } from "@/app/actions/admin-actions";

export default function Settings() {
  const { user, profile, refreshProfile } = useAuth();
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const displayedName = name ?? profile?.name ?? "";

  const [copiedUserId, setCopiedUserId] = useState(false);

  const handleSave = async () => {
    if (!user?.email) return;
    setSaving(true);
    try {
      await updateProfile(user.id, { name: displayedName, email: user.email });
      toast({ title: "Saved" });
      refreshProfile();
    } catch (requestError) {
      toast({
        title: "Failed to save",
        description: requestError instanceof Error ? requestError.message : "Unable to save profile",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const copyUserId = async () => {
    if (!user?.id) return;
    await navigator.clipboard.writeText(user.id);
    setCopiedUserId(true);
    window.setTimeout(() => setCopiedUserId(false), 1500);
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-6 md:p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Manage your profile and GitHub connection.</p>
        </div>

        {/* Profile */}
        <section className="rounded-md border border-border bg-card p-6 mb-6">
          <h2 className="text-[14px] font-semibold mb-1">Profile</h2>
          <p className="text-[12px] text-muted-foreground mb-5">Used in your dashboard and email signatures.</p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[12px]">Name</Label>
              <Input className="h-9 text-[13px]" value={displayedName} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px]">Email</Label>
              <Input className="h-9 text-[13px]" value={user?.email ?? ""} disabled />
            </div>
            <Button onClick={handleSave} disabled={saving} className="h-9 text-[13px]">
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save changes
            </Button>
          </div>
        </section>

        {/* GitHub */}
        <section className="rounded-md border border-border bg-card p-6">
          <h2 className="text-[14px] font-semibold mb-1 flex items-center gap-2">
            <Github className="h-4 w-4" /> GitHub connection
          </h2>
          <p className="text-[12px] text-muted-foreground mb-5">
            Connect GitHub to fork the Postfork engine into your account and then add the repository secrets to Actions.
          </p>
          <Alert className="mb-5 border-border bg-secondary/20">
            <Github className="h-4 w-4" />
            <AlertTitle>Fork and configure</AlertTitle>
            <AlertDescription>
              <div className="mt-2 space-y-4 text-[12px] text-muted-foreground">
                <div className="rounded-md border border-border bg-background p-3">
                  <div className="text-[11px] uppercase tracking-wider">Repository</div>
                  <div className="mt-1 break-all font-mono text-[12px] text-foreground">git@github.com:Anas-github-acc/Dumpmail.git</div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-border bg-background p-3">
                    <div className="text-[11px] uppercase tracking-wider">USER_ID</div>
                    <div className="mt-1 break-all font-mono text-[12px] text-foreground">{user?.id || "Waiting for sign-in"}</div>
                    <Button variant="outline" size="sm" className="mt-3 h-8 text-[12px]" onClick={copyUserId} disabled={!user?.id}>
                      {copiedUserId ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedUserId ? "Copied" : "Copy user ID"}
                    </Button>
                  </div>

                  <div className="rounded-md border border-border bg-background p-3">
                    <div className="text-[11px] uppercase tracking-wider">Secrets</div>
                    <div className="mt-1 space-y-1 font-mono text-[12px] text-foreground">
                      <div>SUPABASE_URL</div>
                      <div>SUPABASE_SERVICE_KEY</div>
                    </div>
                    <Button variant="outline" size="sm" className="mt-3 h-8 text-[12px]" asChild>
                      <a href="https://github.com/settings/secrets/actions" target="_blank" rel="noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Open Actions secrets
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          <Button disabled variant="outline" className="h-9 text-[13px] gap-2">
            <Github className="h-3.5 w-3.5" /> GitHub fork setup
          </Button>
        </section>
      </div>
    </AppLayout>
  );
}
