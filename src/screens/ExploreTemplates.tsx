"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Globe, Eye, Plus, Loader2, ArrowLeft, Sparkles, Mail,
  BookMarked, CheckCircle2, Tag, Search, X, Users,
} from "lucide-react";
import { addGlobalTemplateToLibrary } from "@/app/actions/admin-actions";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import Image from "next/image";

type GlobalTemplate = Tables<"global_email_templates">;

const CARD_GRADIENTS = [
  "from-violet-950 via-indigo-900 to-slate-900",
  "from-slate-900 via-blue-950 to-cyan-950",
  "from-rose-950 via-purple-950 to-indigo-950",
  "from-slate-900 via-emerald-950 to-teal-950",
  "from-amber-950 via-orange-950 to-slate-900",
  "from-slate-900 via-fuchsia-950 to-purple-950",
  "from-cyan-950 via-teal-950 to-slate-900",
  "from-indigo-950 via-violet-950 to-purple-950",
];

const CATEGORY_COLORS: Record<string, string> = {
  "Cold Outreach":  "bg-violet-500/20 text-violet-400 border-violet-500/30",
  "Follow-up":      "bg-sky-500/20 text-sky-400 border-sky-500/30",
  "Introduction":   "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Re-engagement":  "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Partnership":    "bg-pink-500/20 text-pink-400 border-pink-500/30",
  "General":        "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

function getCategoryColor(cat: string | null) {
  return CATEGORY_COLORS[cat ?? ""] ?? "bg-primary/20 text-primary border-primary/30";
}

// ─── Preview Modal ────────────────────────────────────────────────────────────
function TemplatePreviewModal({
  template,
  open,
  onClose,
  onAdd,
  isAdding,
  added,
  addCount,
}: {
  template: GlobalTemplate | null;
  open: boolean;
  onClose: () => void;
  onAdd: (id: string) => void;
  isAdding: boolean;
  added: boolean;
  addCount: number;
}) {
  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-2xl border-border/50 shadow-2xl">
        {/* Hero */}
        <div className="relative h-52 sm:h-72 w-full overflow-hidden">
          {template.preview_image_url ? (
            <Image
              src={template.preview_image_url}
              alt={template.name}
              fill
              className="object-cover"
            />
          ) : (
            <div
              className={`absolute inset-0 bg-gradient-to-br ${CARD_GRADIENTS[0]} flex items-center justify-center`}
            >
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: `radial-gradient(circle at 20% 80%, hsl(234 55% 60% / 0.4) 0%, transparent 50%),
                    radial-gradient(circle at 80% 20%, hsl(280 55% 60% / 0.35) 0%, transparent 50%)`,
                }}
              />
              <div
                className="absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage: `linear-gradient(hsl(0 0% 100%) 1px, transparent 1px),
                    linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)`,
                  backgroundSize: "28px 28px",
                }}
              />
              <Mail className="h-20 w-20 text-white/15" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm ${getCategoryColor(template.category)}`}>
              <Tag className="h-3 w-3" />
              {template.category ?? "General"}
            </span>
            <h2 className="mt-2 text-2xl font-bold text-white drop-shadow-lg leading-tight">
              {template.name}
            </h2>
          </div>
          {/* Add count badge */}
          {addCount > 0 && (
            <div className="absolute top-4 right-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 border border-white/20 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-sm">
                <Users className="h-3 w-3" />
                {addCount >= 1000 ? `${(addCount / 1000).toFixed(1)}k` : addCount} added
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {template.description && (
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              {template.description}
            </p>
          )}

          {/* Subject */}
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <Mail className="h-3 w-3" /> Subject Line
            </div>
            <p className="text-[14px] font-semibold text-foreground">{template.subject}</p>
          </div>

          {/* Body */}
          {template.body_text && (
            <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <BookMarked className="h-3 w-3" /> Email Body
              </div>
              <div className="max-h-56 overflow-y-auto">
                <p className="text-[13px] text-foreground/80 leading-relaxed whitespace-pre-wrap font-mono">
                  {template.body_text}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <Button variant="outline" className="flex-1 h-10 text-[13px]" onClick={onClose}>
              Close
            </Button>
            <Button
              className="flex-1 h-10 text-[13px] gap-2 relative overflow-hidden group"
              onClick={() => onAdd(template.id)}
              disabled={isAdding || added}
              id={`modal-add-template-${template.id}`}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              {isAdding ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Adding…</>
              ) : added ? (
                <><CheckCircle2 className="h-4 w-4" /> Added to Library</>
              ) : (
                <><Plus className="h-4 w-4" /> Add to My Library</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Explore page client component ───────────────────────────────────────────
export default function ExploreTemplatesClient({
  templates,
  userId,
}: {
  templates: GlobalTemplate[];
  userId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [previewTemplate, setPreviewTemplate] = useState<GlobalTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Live add-count map — seeded from DB, updated from RPC return value
  const [addCounts, setAddCounts] = useState<Record<string, number>>(
    () => Object.fromEntries(templates.map((t) => [t.id, t.add_count]))
  );

  const categories = Array.from(
    new Set(templates.map((t) => t.category ?? "General"))
  );

  const filtered = templates.filter((t) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      t.name.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      (t.description ?? "").toLowerCase().includes(q);
    const matchesCategory = !activeCategory || (t.category ?? "General") === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAdd = (templateId: string) => {
    setAddingId(templateId);
    startTransition(async () => {
      try {
        const { newAddCount } = await addGlobalTemplateToLibrary(userId, templateId);
        setAddedIds((prev) => new Set([...prev, templateId]));
        setAddCounts((prev) => ({ ...prev, [templateId]: newAddCount }));
        toast({ title: "Template added to your library!" });
      } catch (e) {
        toast({
          title: "Failed to add template",
          variant: "destructive",
          description: e instanceof Error ? e.message : undefined,
        });
      } finally {
        setAddingId(null);
      }
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero header */}
      <div
        className="relative overflow-hidden border-b border-border/50"
        style={{
          background: "linear-gradient(135deg, hsl(234 55% 60% / 0.08) 0%, hsl(280 55% 60% / 0.06) 50%, hsl(var(--background)) 100%)",
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle, hsl(0 0% 100%) 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
          aria-hidden
        />
        <div className="max-w-7xl mx-auto px-6 py-12">
          <Button
            variant="ghost"
            size="sm"
            className="mb-6 h-8 gap-1.5 text-[12px] text-muted-foreground hover:text-foreground -ml-1"
            onClick={() => router.push("/templates")}
            id="back-to-templates"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Templates
          </Button>

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-violet-600 shadow-xl shadow-primary/30">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                Global Template Library
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[12px] font-semibold text-primary">
                  <Sparkles className="h-3 w-3" />
                  {templates.length} templates
                </span>
              </h1>
              <p className="mt-2 text-[14px] text-muted-foreground max-w-xl">
                Browse community-published email templates. Find the perfect one and add it to your personal library with one click.
              </p>
            </div>
          </div>

          {/* Search + filter */}
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="explore-search"
                placeholder="Search templates…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 text-[13px]"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setActiveCategory(null)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-medium border transition-colors ${
                  !activeCategory
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/40"
                }`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium border transition-colors ${
                    activeCategory === cat
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Template grid */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-secondary/30 mb-4">
              <Globe className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-[15px] font-medium">No templates found</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Try adjusting your search or filter.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-5"
              onClick={() => { setSearch(""); setActiveCategory(null); }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((template, idx) => {
              const gradient = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
              const added = addedIds.has(template.id);
              const isAdding = addingId === template.id && isPending;

              return (
                <div
                  key={template.id}
                  className="group relative rounded-2xl overflow-hidden border border-white/10 shadow-md transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:border-primary/40"
                  style={{ minHeight: "220px" }}
                >
                  {/* Background */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      backgroundImage: `radial-gradient(circle at 30% 70%, hsl(234 55% 60% / 0.2) 0%, transparent 60%)`,
                    }}
                  />
                  <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                      backgroundImage: `linear-gradient(hsl(0 0% 100%) 1px, transparent 1px),
                        linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)`,
                      backgroundSize: "24px 24px",
                    }}
                  />

                  {/* Preview image */}
                  {template.preview_image_url && (
                    <div className="absolute inset-0">
                      <Image
                        src={template.preview_image_url}
                        alt={template.name}
                        fill
                        className="object-cover opacity-25 group-hover:opacity-35 transition-opacity duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="relative z-10 flex flex-col h-full p-5 gap-3" style={{ minHeight: "220px" }}>
                    {/* Top */}
                    <div className="flex items-start justify-between">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${getCategoryColor(template.category)}`}>
                        <Tag className="h-2.5 w-2.5" />
                        {template.category ?? "General"}
                      </span>
                      {(addCounts[template.id] ?? 0) > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/60 backdrop-blur-sm">
                          <Users className="h-2.5 w-2.5" />
                          {(addCounts[template.id] ?? 0) >= 1000
                            ? `${((addCounts[template.id] ?? 0) / 1000).toFixed(1)}k`
                            : addCounts[template.id] ?? 0}
                        </span>
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
                          <Mail className="h-3.5 w-3.5 text-white/70" />
                        </div>
                      )}
                    </div>

                    {/* Middle */}
                    <div className="flex-1 space-y-1.5 mt-1">
                      <h3 className="text-[15px] font-bold text-white leading-tight line-clamp-2">
                        {template.name}
                      </h3>
                      <p className="text-[11px] text-white/55 leading-snug line-clamp-2">
                        {template.subject}
                      </p>
                      {template.description && (
                        <p className="text-[11px] text-white/40 leading-snug line-clamp-2 mt-1">
                          {template.description}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => { setPreviewTemplate(template); setPreviewOpen(true); }}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm px-3 py-2 text-[12px] font-medium text-white/90 transition-all hover:bg-white/20 hover:border-white/30 active:scale-95"
                        id={`explore-view-${template.id}`}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                      <button
                        onClick={() => !added && handleAdd(template.id)}
                        disabled={isAdding || added}
                        className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium transition-all active:scale-95 ${
                          added
                            ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-400 cursor-default"
                            : "border border-primary/50 bg-primary/80 backdrop-blur-sm text-white hover:bg-primary"
                        } disabled:opacity-70`}
                        id={`explore-add-${template.id}`}
                      >
                        {isAdding ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : added ? (
                          <><CheckCircle2 className="h-3.5 w-3.5" /> Added</>
                        ) : (
                          <><Plus className="h-3.5 w-3.5" /> Add</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview modal */}
      <TemplatePreviewModal
        template={previewTemplate}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onAdd={handleAdd}
        isAdding={addingId !== null && isPending}
        added={previewTemplate ? addedIds.has(previewTemplate.id) : false}
        addCount={previewTemplate ? (addCounts[previewTemplate.id] ?? previewTemplate.add_count) : 0}
      />
    </div>
  );
}
