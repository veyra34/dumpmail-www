"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Globe, Eye, Plus, Loader2, ArrowRight, Sparkles, Mail,
  BookMarked, CheckCircle2, Tag, Users,
} from "lucide-react";
import { addGlobalTemplateToLibrary } from "@/app/actions/admin-actions";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import Image from "next/image";

type GlobalTemplate = Tables<"global_email_templates">;

// ─── Category badge colors ────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  "Cold Outreach":    "bg-violet-500/20 text-violet-400 border-violet-500/30",
  "Follow-up":       "bg-sky-500/20 text-sky-400 border-sky-500/30",
  "Introduction":    "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Re-engagement":   "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Partnership":     "bg-pink-500/20 text-pink-400 border-pink-500/30",
  "General":         "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

function getCategoryColor(cat: string | null) {
  return CATEGORY_COLORS[cat ?? ""] ?? "bg-primary/20 text-primary border-primary/30";
}

// ─── Card gradient backgrounds (cycling) ─────────────────────────────────────
const CARD_GRADIENTS = [
  "from-violet-950 via-indigo-900 to-slate-900",
  "from-slate-900 via-blue-950 to-cyan-950",
  "from-rose-950 via-purple-950 to-indigo-950",
  "from-slate-900 via-emerald-950 to-teal-950",
  "from-amber-950 via-orange-950 to-slate-900",
  "from-slate-900 via-fuchsia-950 to-purple-950",
];

// ─── Add count badge ──────────────────────────────────────────────────────────
function AddCountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/60 backdrop-blur-sm">
      <Users className="h-2.5 w-2.5" />
      {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
    </span>
  );
}

// ─── Template Preview Modal ───────────────────────────────────────────────────
function TemplatePreviewModal({
  template,
  open,
  onClose,
  onAdd,
  isAdding,
  alreadyAdded,
  addCount,
}: {
  template: GlobalTemplate | null;
  open: boolean;
  onClose: () => void;
  onAdd: (id: string) => void;
  isAdding: boolean;
  alreadyAdded: Set<string>;
  addCount: number;
}) {
  if (!template) return null;
  const added = alreadyAdded.has(template.id);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden rounded-2xl border-border/50 shadow-2xl">
        {/* Hero banner */}
        <div className="relative h-48 sm:h-64 w-full overflow-hidden">
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
              <div className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: `radial-gradient(circle at 20% 80%, hsl(234 55% 60% / 0.5) 0%, transparent 50%),
                    radial-gradient(circle at 80% 20%, hsl(280 55% 60% / 0.4) 0%, transparent 50%)`,
                }}
              />
              <Mail className="h-16 w-16 text-white/20" />
            </div>
          )}
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          {/* Category badge */}
          <div className="absolute top-4 left-4">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold backdrop-blur-sm ${getCategoryColor(template.category)}`}>
              <Tag className="h-3 w-3" />
              {template.category ?? "General"}
            </span>
          </div>
          {/* Add count badge — bottom right of hero */}
          {addCount > 0 && (
            <div className="absolute bottom-4 right-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 border border-white/20 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-sm">
                <Users className="h-3 w-3" />
                {addCount >= 1000 ? `${(addCount / 1000).toFixed(1)}k` : addCount} added
              </span>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight">{template.name}</h2>
            {template.description && (
              <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">
                {template.description}
              </p>
            )}
          </div>

          {/* Subject line preview */}
          <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              <Mail className="h-3 w-3" /> Subject Line
            </div>
            <p className="text-[14px] font-medium text-foreground">{template.subject}</p>
          </div>

          {/* Body preview */}
          {template.body_text && (
            <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <BookMarked className="h-3 w-3" /> Body Preview
              </div>
              <div className="max-h-48 overflow-y-auto">
                <p className="text-[13px] text-foreground/80 leading-relaxed whitespace-pre-wrap font-mono">
                  {template.body_text}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="outline"
              className="flex-1 h-10 text-[13px]"
              onClick={onClose}
            >
              Close
            </Button>
            <Button
              className="flex-1 h-10 text-[13px] gap-2 relative overflow-hidden group"
              onClick={() => onAdd(template.id)}
              disabled={isAdding || added}
            >
              <span className="absolute inset-0 bg-gradient-to-r from-primary/0 via-white/10 to-primary/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
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

// ─── Single global template card ─────────────────────────────────────────────
function GlobalTemplateCard({
  template,
  index,
  onView,
  onAdd,
  isAdding,
  added,
  addCount,
}: {
  template: GlobalTemplate;
  index: number;
  onView: () => void;
  onAdd: () => void;
  isAdding: boolean;
  added: boolean;
  addCount: number;
}) {
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];

  return (
    <div
      className="group relative flex-shrink-0 w-[260px] rounded-2xl overflow-hidden border border-white/10 shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:border-primary/40 cursor-pointer"
      style={{ minHeight: "200px" }}
    >
      {/* Background */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${gradient}`}
        aria-hidden
      />
      {/* Ambient glow blobs */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        aria-hidden
        style={{
          backgroundImage: `radial-gradient(circle at 30% 70%, hsl(234 55% 60% / 0.25) 0%, transparent 60%),
            radial-gradient(circle at 70% 30%, hsl(280 55% 60% / 0.2) 0%, transparent 60%)`,
        }}
      />
      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        aria-hidden
        style={{
          backgroundImage: `linear-gradient(hsl(0 0% 100%) 1px, transparent 1px),
            linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Preview image if exists */}
      {template.preview_image_url && (
        <div className="absolute inset-0">
          <Image
            src={template.preview_image_url}
            alt={template.name}
            fill
            className="object-cover opacity-30 group-hover:opacity-40 transition-opacity duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full p-4 gap-3" style={{ minHeight: "200px" }}>
        {/* Top: category badge + add count */}
        <div className="flex items-start justify-between">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${getCategoryColor(template.category)}`}>
            <Tag className="h-2.5 w-2.5" />
            {template.category ?? "General"}
          </span>
          <AddCountBadge count={addCount} />
        </div>

        {/* Middle: name + subject */}
        <div className="flex-1 space-y-1.5 mt-1">
          <h3 className="text-[14px] font-bold text-white leading-tight line-clamp-2">
            {template.name}
          </h3>
          <p className="text-[11px] text-white/55 leading-snug line-clamp-2">
            {template.subject}
          </p>
        </div>

        {/* Bottom: action buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={(e) => { e.stopPropagation(); onView(); }}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm px-3 py-1.5 text-[11px] font-medium text-white/90 transition-all hover:bg-white/20 hover:border-white/30 active:scale-95"
            id={`view-global-template-${template.id}`}
          >
            <Eye className="h-3 w-3" />
            View
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (!added) onAdd(); }}
            disabled={isAdding || added}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all active:scale-95 ${
              added
                ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-400 cursor-default"
                : "border border-primary/40 bg-primary/80 backdrop-blur-sm text-white hover:bg-primary hover:border-primary"
            } disabled:opacity-70`}
            id={`add-global-template-${template.id}`}
          >
            {isAdding ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : added ? (
              <><CheckCircle2 className="h-3 w-3" /> Added</>
            ) : (
              <><Plus className="h-3 w-3" /> Add</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main exported section ────────────────────────────────────────────────────
export default function GlobalTemplatesSection({
  globalTemplates,
  userId,
}: {
  globalTemplates: GlobalTemplate[];
  userId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [previewTemplate, setPreviewTemplate] = useState<GlobalTemplate | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Live add-count map — initialised from DB values, updated on successful add
  const [addCounts, setAddCounts] = useState<Record<string, number>>(
    () => Object.fromEntries(globalTemplates.map((t) => [t.id, t.add_count]))
  );

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

  const handleView = (template: GlobalTemplate) => {
    setPreviewTemplate(template);
    setPreviewOpen(true);
  };

  if (globalTemplates.length === 0) return null;

  return (
    <>
      <section className="space-y-4">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/80 to-violet-600/80 shadow-lg shadow-primary/20">
              <Globe className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold flex items-center gap-2">
                Global Template Library
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  <Sparkles className="h-2.5 w-2.5" />
                  Community
                </span>
              </h2>
              <p className="text-[12px] text-muted-foreground">
                Ready-made templates from the community — add any to your library instantly
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
            onClick={() => router.push("/templates/explore")}
            id="view-all-global-templates"
          >
            View all
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Scrollable cards row with faded edge */}
        <div className="relative">
          {/* Right fade overlay */}
          <div
            className="pointer-events-none absolute right-0 top-0 bottom-0 w-32 z-10 rounded-r-xl"
            style={{
              background: "linear-gradient(to right, transparent, hsl(var(--background)) 90%)",
            }}
            aria-hidden
          />

          {/* Horizontal scroll container */}
          <div
            className="flex gap-4 overflow-x-auto pb-3 pr-28 scrollbar-none"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {globalTemplates.slice(0, 8).map((template, idx) => (
              <GlobalTemplateCard
                key={template.id}
                template={template}
                index={idx}
                onView={() => handleView(template)}
                onAdd={() => handleAdd(template.id)}
                isAdding={addingId === template.id && isPending}
                added={addedIds.has(template.id)}
                addCount={addCounts[template.id] ?? template.add_count}
              />
            ))}

            {/* View all card */}
            <div
              className="flex-shrink-0 w-[200px] flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/60 bg-secondary/20 p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-secondary/40 transition-all duration-200 group"
              style={{ minHeight: "200px" }}
              onClick={() => router.push("/templates/explore")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && router.push("/templates/explore")}
              id="explore-all-templates-card"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-foreground">Explore all</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Browse full library</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </div>
        </div>
      </section>

      {/* Preview modal */}
      <TemplatePreviewModal
        template={previewTemplate}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        onAdd={handleAdd}
        isAdding={addingId !== null && isPending}
        alreadyAdded={addedIds}
        addCount={previewTemplate ? (addCounts[previewTemplate.id] ?? previewTemplate.add_count) : 0}
      />
    </>
  );
}
