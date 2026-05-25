"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { loginWithGitHub } from "@/app/actions/authActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Github, Loader2 } from "lucide-react";
import { StackedLogo } from "@/components/StackedLogo";
import { useToast } from "@/hooks/use-toast";

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export default function Auth() {
  const { user, loading, signIn, signUp } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGitHubLoading, setIsGitHubLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [router, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (user) return null;

  const handleGitHubSignIn = async () => {
    setIsGitHubLoading(true);
    try {
      const url = await loginWithGitHub();
      if (url) window.location.assign(url);
    } catch (error: unknown) {
      toast({ title: "GitHub sign-in failed", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setIsGitHubLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await signIn(loginEmail, loginPassword);
      toast({ title: "Welcome back!" });
    } catch (error: unknown) {
      toast({ title: "Login failed", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword.length < 6) {
      toast({ title: "Password too short", description: "Minimum 6 characters", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await signUp(signupEmail, signupPassword, signupName);
      toast({ title: "Account created!", description: "Check your email to confirm your account." });
    } catch (error: unknown) {
      toast({ title: "Signup failed", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[420px] border border-border rounded-md p-8 space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-start gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <StackedLogo size={16} />
            <span className="text-[14px] font-bold text-foreground tracking-[0.08em] uppercase">Postfork</span>
          </Link>
          <p className="text-[13px] text-muted-foreground">Sign in to manage campaigns, leads, and sender health</p>
        </div>

        {/* GitHub */}
        <Button
          variant="outline"
          className="w-full h-9 gap-2 text-[13px]"
          onClick={handleGitHubSignIn}
          disabled={isGitHubLoading}
        >
          {isGitHubLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Github className="h-3.5 w-3.5" />
          )}
          Continue with GitHub
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-[11px] uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Email auth */}
        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2 h-9 p-0.5">
            <TabsTrigger value="login" className="text-[12px]">Sign in</TabsTrigger>
            <TabsTrigger value="signup" className="text-[12px]">Sign up</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-4">
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[12px]">Email</Label>
                <Input type="email" placeholder="you@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required className="h-8 text-[13px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[12px]">Password</Label>
                <Input type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required className="h-8 text-[13px]" />
              </div>
              <Button type="submit" className="w-full h-8 text-[13px]" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Sign In
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-4">
            <form onSubmit={handleSignup} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[12px]">Full Name</Label>
                <Input type="text" placeholder="Jane Doe" value={signupName} onChange={(e) => setSignupName(e.target.value)} required className="h-8 text-[13px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[12px]">Email</Label>
                <Input type="email" placeholder="you@example.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required className="h-8 text-[13px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[12px]">Password</Label>
                <Input type="password" placeholder="Min 6 characters" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required minLength={6} className="h-8 text-[13px]" />
              </div>
              <Button type="submit" className="w-full h-8 text-[13px]" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Create Account
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="text-left text-[11px] text-muted-foreground pt-2">
          © {new Date().getFullYear()} Postfork
        </p>
      </div>
    </div>
  );
}
