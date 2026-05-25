"use client";

import Link from "next/link";
import { ArrowRight, Github, Zap, GitFork, Mail, Activity, Lock, Terminal } from "lucide-react";
import { StackedLogo } from "@/components/StackedLogo";
import { Button } from "@/components/ui/button";

const features = [
  { icon: GitFork, title: "Fork & own", body: "We fork the engine into your GitHub. Your repo, your Actions, your control." },
  { icon: Mail, title: "Multi-sender", body: "Rotate SMTP accounts with warmup and health scoring out of the box." },
  { icon: Activity, title: "Full observability", body: "Every send, open, reply, and bounce streamed to your dashboard." },
  { icon: Zap, title: "Sequences", body: "Multi-step cadences with per-campaign timezones and sending windows." },
  { icon: Lock, title: "Your data", body: "All leads, templates, and events live in your database. Not ours." },
  { icon: Terminal, title: "OSS-first", body: "MIT licensed. No vendor lock-in. Hack the workflow to fit your stack." },
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Nav */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <StackedLogo size={16} />
            <span className="font-bold uppercase tracking-[0.08em] text-[14px]">Postfork</span>
          </Link>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="h-3.5 w-3.5" /> GitHub
            </a>
            <Link href="/auth">
              <Button size="sm" className="h-8 text-[13px]">Sign in</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-6 py-20 md:py-28 w-full">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-border bg-secondary text-[11px] uppercase tracking-wider text-muted-foreground mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Open source · MIT
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
              Open-source email automation that runs in <span className="text-primary">your</span> GitHub.
            </h1>
            <p className="text-[15px] md:text-[17px] text-muted-foreground max-w-2xl mb-8 leading-relaxed">
              Sign in with GitHub. We fork the engine into your repo. GitHub Actions drives the cron, your database stores the data. Zero servers, zero lock-in.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/auth">
                <Button size="lg" className="h-11 text-[14px] gap-2">
                  <Github className="h-4 w-4" /> Get started with GitHub
                </Button>
              </Link>
              <a href="#how" >
                <Button size="lg" variant="outline" className="h-11 text-[14px] gap-2 w-full sm:w-auto">
                  How it works <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>

            {/* Quickstart code */}
            <div className="mt-10 rounded-md border border-border bg-card overflow-hidden max-w-2xl">
              <div className="flex items-center justify-between px-3 h-8 border-b border-border bg-secondary">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Quickstart</span>
                <span className="text-[10px] text-muted-foreground">~30 seconds</span>
              </div>
              <pre className="p-4 text-[12.5px] font-mono leading-relaxed text-foreground">
{`# 1. Sign in with GitHub
# 2. We fork postfork/engine → your account
# 3. Add SMTP + leads in the dashboard
# 4. GitHub Actions handles the rest`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="how" className="border-t border-border bg-secondary/30">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <div className="max-w-2xl mb-12">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Why Postfork</p>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Cold outreach without the SaaS tax.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-md overflow-hidden border border-border">
            {features.map((f) => (
              <div key={f.title} className="bg-background p-6">
                <f.icon className="h-4 w-4 text-primary mb-4" />
                <h3 className="text-[14px] font-semibold mb-1.5">{f.title}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">Ship cold email from your own repo.</h2>
          <p className="text-[14px] text-muted-foreground mb-8 max-w-lg mx-auto">
            One sign-in. One fork. Infinite sends.
          </p>
          <Link href="/auth">
            <Button size="lg" className="h-11 text-[14px] gap-2">
              <Github className="h-4 w-4" /> Sign in with GitHub
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>© {new Date().getFullYear()} Postfork</span>
          <span>MIT License</span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
