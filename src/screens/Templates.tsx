"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";
import {
  createTemplate, fetchTemplates, updateTemplate, deleteTemplate,
  uploadAndRegisterAttachment, deleteAttachmentRecord, fetchUserAttachments,
} from "@/app/actions/admin-actions";
import { useToast } from "@/hooks/use-toast";
import {
  FileText, Loader2, Plus, Edit, Trash2, Paperclip,
  UploadCloud, X, FileCheck2, HardDrive, Library,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type Template  = Tables<"email_templates">;
type LibraryPdf = Tables<"template_attachments">;

type AttachmentState = {
  id?: string;        // library record id (if picked from library)
  name: string;
  path: string;
  size: number;
  mimeType: string;
  url: string;
} | null;

const MAX_STORAGE = 100 * 1024 * 1024; // 100 MB

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(v: string | null | undefined) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ─── Storage bar ─────────────────────────────────────────────────────────────
function StorageBar({ usedBytes }: { usedBytes: number }) {
  const pct = Math.min((usedBytes / MAX_STORAGE) * 100, 100);
  const color = pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-primary";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <HardDrive className="h-3 w-3" />
          Storage used
        </span>
        <span>
          <span className={pct >= 90 ? "text-destructive font-semibold" : "font-medium text-foreground"}>
            {formatBytes(usedBytes)}
          </span>
          {" / 100 MB"}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Drop Zone ───────────────────────────────────────────────────────────────
function DropZone({
  uploading,
  progress,
  onFile,
}: {
  uploading: boolean;
  progress: number;
  onFile: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) onFile(f);
    },
    [onFile],
  );

  if (uploading) {
    return (
      <div className="rounded-lg border border-border bg-secondary/20 px-4 py-6 text-center">
        <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-primary" />
        <p className="text-[12px] text-muted-foreground mb-2">Uploading… {progress}%</p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => ref.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && ref.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragEnter={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={[
        "cursor-pointer select-none rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
        over ? "border-primary bg-primary/5" : "border-border bg-secondary/10 hover:border-primary/40 hover:bg-secondary/20",
      ].join(" ")}
    >
      <UploadCloud className={`mx-auto mb-2 h-7 w-7 transition-colors ${over ? "text-primary" : "text-muted-foreground"}`} />
      <p className="text-[13px] font-medium">
        Drop a PDF here or{" "}
        <span className="text-primary underline-offset-2 hover:underline">browse</span>
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">PDF only · max 10 MB per file</p>
      <input ref={ref} type="file" accept="application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
    </div>
  );
}

// ─── PDF Library Card ────────────────────────────────────────────────────────
function PdfCard({
  pdf,
  selected,
  onSelect,
  onDelete,
}: {
  pdf: LibraryPdf;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className={[
        "group relative flex flex-col gap-2 rounded-lg border p-3 text-left transition-all cursor-pointer",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-card hover:border-primary/40 hover:bg-secondary/20",
      ].join(" ")}
      onClick={() => { if (!confirmDelete) onSelect(); }}
    >
      {/* PDF icon + name */}
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <FileCheck2 className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium leading-tight" title={pdf.name}>
            {pdf.name}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {formatBytes(pdf.size)} · {formatDate(pdf.created_at)}
          </p>
        </div>
      </div>

      {/* Confirm delete inline */}
      {confirmDelete ? (
        <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
          <p className="text-[11px] text-destructive flex-1">Delete this file?</p>
          <Button
            size="sm"
            variant="destructive"
            className="h-6 px-2 text-[11px]"
            onClick={() => { onDelete(); setConfirmDelete(false); }}
          >
            Delete
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() => setConfirmDelete(false)}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-1.5 top-1.5 h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity"
          onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
          title="Delete from library"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}

      {selected && (
        <div className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ─── PDF Picker Dialog ───────────────────────────────────────────────────────
function PdfPickerDialog({
  open,
  onOpenChange,
  userId,
  currentAttachment,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  currentAttachment: AttachmentState;
  onSelect: (att: AttachmentState) => void;
}) {
  const { toast } = useToast();
  const [library, setLibrary] = useState<LibraryPdf[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tab, setTab] = useState("library");

  const storageUsed = library.reduce((s, p) => s + (p.size ?? 0), 0);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchUserAttachments<LibraryPdf>(userId);
      setLibrary(data);
    } catch (e) {
      toast({ title: "Failed to load library", variant: "destructive", description: e instanceof Error ? e.message : undefined });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      void load();
      // Default to library if there are files, else upload
      setTab("library");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setProgress(10);
    let cur = 10;
    const interval = setInterval(() => {
      if (cur < 80) { cur += 12; setProgress(cur); }
    }, 300);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("userId", userId);
      const result = await uploadAndRegisterAttachment(fd) as LibraryPdf;
      clearInterval(interval);
      setProgress(100);
      setLibrary((prev) => [result, ...prev]);
      // Auto-select the newly uploaded file
      onSelect({
        id: result.id,
        name: result.name,
        path: result.path,
        size: result.size,
        mimeType: result.mime_type,
        url: result.url ?? "",
      });
      toast({ title: "PDF uploaded and selected" });
      onOpenChange(false);
    } catch (e) {
      clearInterval(interval);
      toast({ title: "Upload failed", variant: "destructive", description: e instanceof Error ? e.message : undefined });
    }
    setUploading(false);
    setTimeout(() => setProgress(0), 600);
  };

  const handleDelete = async (pdf: LibraryPdf) => {
    setDeleting(pdf.id);
    try {
      await deleteAttachmentRecord(userId, pdf.id, pdf.path);
      setLibrary((prev) => prev.filter((p) => p.id !== pdf.id));
      // If the currently selected attachment was this one, clear it
      if (currentAttachment?.path === pdf.path) onSelect(null);
      toast({ title: "PDF deleted from library" });
    } catch (e) {
      toast({ title: "Delete failed", variant: "destructive", description: e instanceof Error ? e.message : undefined });
    }
    setDeleting(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-4 w-4 text-primary" />
            PDF Attachments
          </DialogTitle>
          <DialogDescription>
            Pick a previously uploaded PDF or upload a new one.
          </DialogDescription>
          <div className="mt-3">
            <StorageBar usedBytes={storageUsed} />
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="mx-6 mt-4 mb-0 shrink-0 w-fit">
            <TabsTrigger value="library" className="text-[12px] gap-1.5">
              <Library className="h-3.5 w-3.5" />
              My library
              {library.length > 0 && (
                <span className="rounded-full bg-primary/15 px-1.5 py-0 text-[10px] font-semibold text-primary">
                  {library.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="upload" className="text-[12px] gap-1.5">
              <UploadCloud className="h-3.5 w-3.5" />
              Upload new
            </TabsTrigger>
          </TabsList>

          {/* Library tab */}
          <TabsContent value="library" className="flex-1 overflow-y-auto px-6 py-4 mt-0">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading library…
              </div>
            ) : library.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary/40">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-[13px] font-medium">No PDFs uploaded yet</p>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Switch to &quot;Upload new&quot; to add your first file.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 h-8 text-[12px] gap-1.5"
                  onClick={() => setTab("upload")}
                >
                  <UploadCloud className="h-3.5 w-3.5" /> Upload a PDF
                </Button>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {library.map((pdf) => (
                  <PdfCard
                    key={pdf.id}
                    pdf={pdf}
                    selected={currentAttachment?.path === pdf.path}
                    onSelect={() => {
                      onSelect({
                        id: pdf.id,
                        name: pdf.name,
                        path: pdf.path,
                        size: pdf.size,
                        mimeType: pdf.mime_type,
                        url: pdf.url ?? "",
                      });
                      onOpenChange(false);
                    }}
                    onDelete={() => {
                      if (!deleting) void handleDelete(pdf);
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Upload tab */}
          <TabsContent value="upload" className="px-6 py-4 mt-0">
            <DropZone uploading={uploading} progress={progress} onFile={handleUpload} />
            <p className="mt-3 text-[11px] text-muted-foreground text-center">
              Uploaded PDFs are saved to your library and can be reused across templates.
            </p>
          </TabsContent>
        </Tabs>

        <div className="px-6 py-4 border-t border-border shrink-0 flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="text-[13px]">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Attached file card (inline in form) ─────────────────────────────────────
function AttachedFileCard({
  attachment,
  onRemove,
  onChangePdf,
}: {
  attachment: AttachmentState;
  onRemove: () => void;
  onChangePdf: () => void;
}) {
  if (!attachment) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <FileCheck2 className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{attachment.name}</p>
        <p className="text-[11px] text-muted-foreground">{formatBytes(attachment.size)}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onChangePdf}
        className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground shrink-0"
      >
        Change
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        title="Remove attachment"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Templates({
  initialTemplates,
  initialTemplatesCount,
}: {
  initialTemplates: Template[];
  initialTemplatesCount: number;
}) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [totalCount, setTotalCount] = useState<number>(initialTemplatesCount);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const limit = 10;
  const totalPages = Math.ceil(totalCount / limit);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // Create form
  const [createForm, setCreateForm] = useState({ name: "", subject: "", bodyText: "" });
  const [createAttachment, setCreateAttachment] = useState<AttachmentState>(null);

  // Edit form
  const [editForm, setEditForm] = useState({ name: "", subject: "", bodyText: "" });
  const [editAttachment, setEditAttachment] = useState<AttachmentState>(null);

  // PDF picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"create" | "edit">("create");

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<Template | null>(null);

  const openPicker = (target: "create" | "edit") => {
    setPickerTarget(target);
    setPickerOpen(true);
  };

  const handleAttachmentSelect = (att: AttachmentState) => {
    if (pickerTarget === "create") setCreateAttachment(att);
    else setEditAttachment(att);
    setPickerOpen(false);
  };

  // Load templates
  const loadTemplates = async (pageNumber: number = currentPage) => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTemplates<Template>(user.id, pageNumber, limit);
      setTemplates(res?.data ?? []);
      setTotalCount(res?.count ?? 0);
      setCurrentPage(pageNumber);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load templates");
    }
    setLoading(false);
  };

  // localStorage draft (text fields only)
  useEffect(() => {
    const saved = localStorage.getItem("dumpmail_new_template_draft");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p && typeof p === "object") {
          setTimeout(() => setCreateForm({ name: p.name || "", subject: p.subject || "", bodyText: p.bodyText || "" }), 0);
        }
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (createForm.name || createForm.subject || createForm.bodyText)
      localStorage.setItem("dumpmail_new_template_draft", JSON.stringify(createForm));
    else localStorage.removeItem("dumpmail_new_template_draft");
  }, [createForm]);

  // Create
  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await createTemplate<Template>(user.id, {
        name: createForm.name,
        subject: createForm.subject,
        bodyText: createForm.bodyText,
        attachmentName: createAttachment?.name ?? null,
        attachmentPath: createAttachment?.path ?? null,
        attachmentSize: createAttachment?.size ?? null,
        attachmentMimeType: createAttachment?.mimeType ?? null,
        attachmentUrl: createAttachment?.url ?? null,
      });
      setCreateForm({ name: "", subject: "", bodyText: "" });
      setCreateAttachment(null);
      localStorage.removeItem("dumpmail_new_template_draft");
      setView("list");
      toast({ title: "Template added" });
      await loadTemplates(1);
    } catch (e) {
      toast({ title: "Failed to add template", variant: "destructive", description: e instanceof Error ? e.message : undefined });
    }
    setSaving(false);
  };

  // Start edit
  const handleStartEdit = (t: Template) => {
    setEditingTemplate(t);
    setEditForm({ name: t.name, subject: t.subject, bodyText: t.body_text || "" });
    setEditAttachment(
      t.attachment_path
        ? { name: t.attachment_name ?? "", path: t.attachment_path, size: t.attachment_size ?? 0, mimeType: t.attachment_mime_type ?? "application/pdf", url: t.attachment_url ?? "" }
        : null,
    );
    setView("edit");
  };

  // Update
  const handleUpdate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !editingTemplate) return;
    setSaving(true);
    try {
      await updateTemplate<Template>(user.id, editingTemplate.id, {
        name: editForm.name,
        subject: editForm.subject,
        bodyText: editForm.bodyText,
        attachmentName: editAttachment?.name ?? null,
        attachmentPath: editAttachment?.path ?? null,
        attachmentSize: editAttachment?.size ?? null,
        attachmentMimeType: editAttachment?.mimeType ?? null,
        attachmentUrl: editAttachment?.url ?? null,
      });
      setView("list");
      toast({ title: "Template updated" });
      await loadTemplates();
    } catch (e) {
      toast({ title: "Update failed", variant: "destructive", description: e instanceof Error ? e.message : undefined });
    }
    setSaving(false);
  };

  // Delete template
  const handleDeleteConfirm = async () => {
    if (!user || !templateToDelete) return;
    setSaving(true);
    try {
      await deleteTemplate(user.id, templateToDelete.id);
      toast({ title: "Template deleted" });
      setTemplateToDelete(null);
      setDeleteDialogOpen(false);
      setView("list");
      await loadTemplates();
    } catch (e) {
      toast({ title: "Deletion failed", variant: "destructive", description: e instanceof Error ? e.message : "Template may be in use by a campaign." });
    }
    setSaving(false);
  };

  // Shared attachment field
  const renderAttachmentField = (
    attachment: AttachmentState,
    setAttachment: (v: AttachmentState) => void,
    target: "create" | "edit",
  ) => (
    <div className="space-y-1.5">
      <Label className="text-[12px] font-medium text-muted-foreground flex items-center gap-1.5">
        <Paperclip className="h-3.5 w-3.5" />
        PDF attachment
        <span className="font-normal text-muted-foreground/60">(optional)</span>
      </Label>
      {attachment ? (
        <AttachedFileCard
          attachment={attachment}
          onRemove={() => setAttachment(null)}
          onChangePdf={() => openPicker(target)}
        />
      ) : (
        <button
          type="button"
          onClick={() => openPicker(target)}
          className="flex w-full items-center gap-3 rounded-lg border-2 border-dashed border-border bg-secondary/10 px-4 py-4 text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-secondary/20 hover:text-foreground"
        >
          <UploadCloud className="h-4 w-4 shrink-0" />
          <span>Attach a PDF — upload new or pick from your library</span>
        </button>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="max-w-[100rem] mx-auto p-6 md:p-8 space-y-6">

        {/* Breadcrumb */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              {view === "list" ? (
                <BreadcrumbPage className="text-[13px] font-medium text-foreground">Templates</BreadcrumbPage>
              ) : (
                <BreadcrumbLink className="text-[13px] font-medium cursor-pointer" onClick={() => setView("list")}>
                  Templates
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {view === "create" && (
              <><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage className="text-[13px] font-medium text-foreground">New template</BreadcrumbPage></BreadcrumbItem></>
            )}
            {view === "edit" && (
              <><BreadcrumbSeparator /><BreadcrumbItem><BreadcrumbPage className="text-[13px] font-medium text-foreground max-w-[220px] truncate">{editingTemplate ? `Edit · ${editingTemplate.name}` : "Edit template"}</BreadcrumbPage></BreadcrumbItem></>
            )}
          </BreadcrumbList>
        </Breadcrumb>

        {/* ── LIST ── */}
        {view === "list" && (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Email templates</h1>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Reusable outreach templates for campaign sequences.
                </p>
              </div>
              <Button onClick={() => setView("create")} className="h-9 gap-2 text-[13px]">
                <Plus className="h-3.5 w-3.5" /> Add template
              </Button>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 text-[13px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                <span className="font-semibold text-foreground">{templates.length}</span>
                {" "}template{templates.length !== 1 ? "s" : ""}
              </span>
              {templates.filter((t) => t.attachment_path).length > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" />
                    <span className="font-semibold text-foreground">
                      {templates.filter((t) => t.attachment_path).length}
                    </span>{" "}with attachment
                  </span>
                </>
              )}
            </div>

            {/* Table */}
            <section className="rounded-md border border-border bg-card overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-[14px] font-semibold">Template library</h2>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading templates…
                </div>
              ) : error ? (
                <div className="px-4 py-12 text-center text-sm text-destructive">{error}</div>
              ) : templates.length ? (
                <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Attachment</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[80px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground">{t.subject}</TableCell>
                        <TableCell>
                          {t.attachment_name ? (
                            <a
                              href={t.attachment_url ?? "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-[11px] font-medium hover:bg-secondary/80 transition-colors max-w-[160px]"
                              title={t.attachment_name}
                            >
                              <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className="truncate">{t.attachment_name}</span>
                            </a>
                          ) : (
                            <span className="text-[12px] text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(t.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleStartEdit(t)} className="h-8 w-8 hover:bg-secondary" title="Edit">
                              <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => { setTemplateToDelete(t); setDeleteDialogOpen(true); }} className="h-8 w-8 hover:bg-destructive/10" title="Delete">
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/10 flex-wrap gap-4">
                    <div className="text-[13px] text-muted-foreground">
                      Showing <span className="font-medium text-foreground">{Math.min((currentPage - 1) * limit + 1, totalCount)}</span> to{" "}
                      <span className="font-medium text-foreground">{Math.min(currentPage * limit, totalCount)}</span> of{" "}
                      <span className="font-medium text-foreground">{totalCount}</span> templates
                    </div>
                    <Pagination className="w-auto mx-0">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => currentPage > 1 && loadTemplates(currentPage - 1)}
                            className={cn("cursor-pointer", currentPage === 1 && "pointer-events-none opacity-50")}
                          />
                        </PaginationItem>
                        {(() => {
                          const pages: (number | string)[] = [];
                          for (let i = 1; i <= totalPages; i++) {
                            if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
                              pages.push(i);
                            } else if (pages[pages.length - 1] !== "ellipsis") {
                              pages.push("ellipsis");
                            }
                          }
                          return pages.map((pageNum, idx) => {
                            if (pageNum === "ellipsis") {
                              return (
                                <PaginationItem key={`ellipsis-${idx}`}>
                                  <PaginationEllipsis />
                                </PaginationItem>
                              );
                            }
                            return (
                              <PaginationItem key={pageNum}>
                                <PaginationLink
                                  isActive={currentPage === pageNum}
                                  onClick={() => loadTemplates(pageNum as number)}
                                  className="cursor-pointer"
                                >
                                  {pageNum}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          });
                        })()}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => currentPage < totalPages && loadTemplates(currentPage + 1)}
                            className={cn("cursor-pointer", currentPage === totalPages && "pointer-events-none opacity-50")}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
                </>
              ) : (
                <div className="px-4 py-16 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-secondary/40">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-[13px] text-muted-foreground">No templates yet. Create your first outreach draft.</p>
                </div>
              )}
            </section>
          </>
        )}

        {/* ── CREATE ── */}
        {view === "create" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">New template</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Create a reusable email template. Attach a PDF from your library or upload a new one.
              </p>
            </div>
            <form onSubmit={handleCreate} className="grid gap-5 rounded-md border border-border bg-card p-6 shadow-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-muted-foreground">Name</Label>
                  <Input required placeholder="e.g. Cold Outreach Intro" className="h-9 text-[13px]" value={createForm.name} onChange={(e) => setCreateForm((v) => ({ ...v, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-muted-foreground">Subject</Label>
                  <Input required placeholder="e.g. Quick question about your product" className="h-9 text-[13px]" value={createForm.subject} onChange={(e) => setCreateForm((v) => ({ ...v, subject: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] font-medium text-muted-foreground">Body text</Label>
                <Textarea required placeholder="Hi {{name}}, I noticed your project…" className="min-h-[180px] text-[13px] font-sans resize-y" value={createForm.bodyText} onChange={(e) => setCreateForm((v) => ({ ...v, bodyText: e.target.value }))} />
              </div>
              {renderAttachmentField(createAttachment, setCreateAttachment, "create")}
              <div className="flex items-center justify-end gap-3 pt-1">
                <Button type="button" variant="ghost" onClick={() => setView("list")} className="h-9 text-[13px]">Cancel</Button>
                <Button type="submit" disabled={saving} className="h-9 text-[13px] gap-2">
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Add template
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* ── EDIT ── */}
        {view === "edit" && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Edit template</h1>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Modify template details or replace the PDF attachment.
              </p>
            </div>
            <form onSubmit={handleUpdate} className="grid gap-5 rounded-md border border-border bg-card p-6 shadow-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-muted-foreground">Name</Label>
                  <Input required className="h-9 text-[13px]" value={editForm.name} onChange={(e) => setEditForm((v) => ({ ...v, name: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[12px] font-medium text-muted-foreground">Subject</Label>
                  <Input required className="h-9 text-[13px]" value={editForm.subject} onChange={(e) => setEditForm((v) => ({ ...v, subject: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] font-medium text-muted-foreground">Body text</Label>
                <Textarea required className="min-h-[180px] text-[13px] font-sans resize-y" value={editForm.bodyText} onChange={(e) => setEditForm((v) => ({ ...v, bodyText: e.target.value }))} />
              </div>
              {renderAttachmentField(editAttachment, setEditAttachment, "edit")}
              <div className="flex items-center justify-between pt-1">
                <Button type="button" variant="destructive" onClick={() => { if (editingTemplate) { setTemplateToDelete(editingTemplate); setDeleteDialogOpen(true); } }} className="h-9 text-[13px] gap-2">
                  <Trash2 className="h-3.5 w-3.5" /> Delete template
                </Button>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="ghost" onClick={() => setView("list")} className="h-9 text-[13px]">Cancel</Button>
                  <Button type="submit" disabled={saving} className="h-9 text-[13px] gap-2">
                    {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Save changes
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* PDF Picker Dialog */}
      {user && (
        <PdfPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          userId={user.id}
          currentAttachment={pickerTarget === "create" ? createAttachment : editAttachment}
          onSelect={handleAttachmentSelect}
        />
      )}

      {/* Delete template confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;
              <span className="font-semibold text-foreground">{templateToDelete?.name}</span>
              &quot;. The PDF attachment will remain in your library. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleDeleteConfirm(); }}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Delete template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
