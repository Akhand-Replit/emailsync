"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Loader2, X, Reply, Trash2, ExternalLink, AlertCircle, FileDown, Sparkles, Maximize2, Minimize2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GeminiService, AIAnalysisResult } from "@/lib/ai-service";
import { useSettingsStore } from "@/lib/store/settings-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface EmailViewProps {
  email: any | null;
  account: any | null;
  isOpen: boolean;
  onClose: () => void;
}

// Helper to get webmail URL based on provider
const getWebmailLink = (provider: string, host: string) => {
  switch (provider) {
    case "titan":
      return "https://webmail.titan.email/";
    case "one":
      return "https://mail.one.com/";
    case "gmail":
      return "https://mail.google.com/";
    case "outlook":
      return "https://outlook.live.com/";
    default:
      // Fallback for custom hosts, try to guess or just use the host
      return `https://${host}`;
  }
};

export function EmailView({ email, account, isOpen, onClose }: EmailViewProps) {
  const [loading, setLoading] = useState(false);
  const [fullBody, setFullBody] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // View Mode: 'sheet' | 'dialog'
  const [viewMode, setViewMode] = useState<'sheet' | 'dialog'>('sheet');

  // AI State
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const { apiKey, outputLanguage } = useSettingsStore();

  useEffect(() => {
    setAiResult(null); // Reset AI result
    setViewMode('sheet'); // Default to sidebar
    const fetchBody = async () => {
      if (!email || !account || !isOpen) return;

      setLoading(true);
      setError(null);
      setFullBody("");

      try {
        const res = await fetch("/api/get-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account: account,
            uid: email.uid
          }),
        });

        const data = await res.json();

        if (data.error) throw new Error(data.error);

        // Dynamic import to ensure it only runs on client
        const DOMPurify = (await import("dompurify")).default;

        const cleanHtml = DOMPurify.sanitize(data.email.html || data.email.text || "<div>No content</div>", {
          USE_PROFILES: { html: true },
          ADD_TAGS: ["style"],
          ADD_ATTR: ["target"],
        });

        setFullBody(cleanHtml);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load message body.");
      } finally {
        setLoading(false);
      }
    };

    fetchBody();
  }, [email, account, isOpen]);

  if (!email) return null;

  // Determine webmail link
  const webmailUrl = account ? getWebmailLink(account.provider, account.host) : "#";

  // --- Download EML Logic ---
  const handleDownload = async (format: 'pdf' | 'eml') => {
    try {
      toast.info(`Preparing ${format.toUpperCase()} download...`);
      const res = await fetch("/api/download-eml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, uid: email.uid }),
      });

      if (!res.ok) throw new Error("Failed to download email data");

      const emlText = await res.text();

      if (format === 'eml') {
        const blob = new Blob([emlText], { type: "message/rfc822" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(email.subject || "email").substring(0, 30)}.eml`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success("EML downloaded");
      } else {
        const { parseEML, generatePDF } = await import("@/lib/eml-utils");
        const parsed = parseEML(emlText);
        await generatePDF(parsed);
        toast.success("PDF downloaded");
      }

    } catch (err) {
      console.error("Download Error", err);
      toast.error("Failed to download email");
    }
  };

  const handleAnalyze = async () => {
    if (!apiKey) {
      toast.error("AI not configured. Go to Manage Accounts > AI Settings.");
      return;
    }
    if (!fullBody) {
      toast.error("Email content is loading...");
      return;
    }

    setAnalyzing(true);
    try {
      const service = new GeminiService(apiKey);
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = fullBody || "";
      const textBody = tempDiv.textContent || tempDiv.innerText || "";

      const result = await service.analyzeSingleEmail(
        email.subject || "",
        textBody.substring(0, 10000),
        outputLanguage
      );
      setAiResult(result);
    } catch (err) {
      console.error("Analysis error", err);
      toast.error("AI Analysis Failed. Check quota or key.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Shared Header Actions
  const renderHeaderActions = () => (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setViewMode(prev => prev === 'sheet' ? 'dialog' : 'sheet')}
        title={viewMode === 'sheet' ? "Expand to Modal" : "Collapse to Sidebar"}
      >
        {viewMode === 'sheet' ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleAnalyze}
        disabled={analyzing || loading || !!error}
        className="gap-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50 px-2 sm:px-4"
        title="AI Analyze"
      >
        {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        <span className="hidden sm:inline">{aiResult ? "Re-Analyze" : "AI Analyze"}</span>
      </Button>
      <Button variant="ghost" size="icon" disabled>
        <Reply className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={() => handleDownload('pdf')} title="Download as PDF">
        <FileDown className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" disabled>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );

  // Shared Inner Content
  const renderInnerContent = () => (
    <div className="flex-1 min-h-0 relative h-full">
      {loading ? (
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <div className="flex gap-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="space-y-3 pt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      ) : error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center h-full">
          <div className="p-4 bg-red-50 rounded-full mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 mb-2">Unable to Render Email</h3>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            This email contains complex data or server errors that cannot be displayed here.
          </p>
          <div className="flex flex-col gap-2 w-full max-w-[240px]">
            <Button onClick={() => handleDownload('pdf')} className="w-full flex items-center gap-2">
              <FileDown className="h-4 w-4" /> Download as PDF
            </Button>
            <Button variant="outline" asChild className="w-full">
              <a href={webmailUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 justify-center">
                Open Webmail <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
          <div className="mt-8 p-2 bg-zinc-100 rounded text-[10px] text-zinc-400 font-mono max-w-sm break-all">
            Error: {error}
          </div>
        </div>
      ) : (
        <ScrollArea className="h-full w-full">
          <div className="p-4 md:p-6">
            {aiResult && (
              <Card className="mb-6 bg-indigo-50/50 border-indigo-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                <CardContent className="pt-4 pb-4">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-indigo-900 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-indigo-500" />
                      AI Summary
                    </h4>
                    <Badge variant={
                      aiResult.category === 'Governmental' ? 'destructive' :
                        aiResult.category?.includes('Marketing') ? 'secondary' :
                          aiResult.category?.includes('Spam') ? 'destructive' :
                            'outline'
                    } className="capitalize transform scale-90 sm:scale-100 origin-right">
                      {aiResult.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-indigo-950 mb-3 leading-relaxed break-words whitespace-pre-wrap">
                    {aiResult.summary}
                  </p>
                  {aiResult.actionRequired && aiResult.actionRequired !== "null" && (
                    <div className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1.5 rounded border border-amber-100 flex items-start gap-1.5 break-words">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>Action Required: {aiResult.actionRequired}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            <div
              className="email-content text-sm leading-relaxed text-zinc-800 overflow-x-auto max-w-full"
              dangerouslySetInnerHTML={{ __html: fullBody }}
            />
          </div>
        </ScrollArea>
      )}
    </div>
  );

  // Render Sheet (Sidebar)
  if (viewMode === 'sheet') {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:max-w-xl md:max-w-2xl p-0 gap-0 sm:duration-300 flex flex-col bg-white">
          <SheetHeader className="p-6 pb-4 border-b text-left shrink-0">
            <div className="flex items-start justify-between mb-4">
              <div className="space-y-1">
                <SheetTitle className="font-semibold text-lg leading-tight">
                  {email.subject || "(No Subject)"}
                </SheetTitle>
                <SheetDescription className="text-sm text-muted-foreground">
                  {email.from}
                </SheetDescription>
              </div>
              {renderHeaderActions()}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {(() => {
                  try {
                    const d = new Date(email.date);
                    return isNaN(d.getTime()) ? "Unknown date" : format(d, "PPpp");
                  } catch (e) { return ""; }
                })()}
              </span>
              <span className="bg-zinc-100 px-2 py-1 rounded text-zinc-500">
                {account?.label || "Inbox"}
              </span>
            </div>
          </SheetHeader>
          {renderInnerContent()}
        </SheetContent>
      </Sheet>
    );
  }

  // Render Dialog (Modal)
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] md:max-w-5xl h-[85vh] p-0 gap-0 flex flex-col bg-white sm:rounded-xl overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b text-left shrink-0 space-y-0">
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-1">
              <DialogTitle className="font-semibold text-xl leading-tight">
                {email.subject || "(No Subject)"}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {email.from}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 pr-8">
              {/* pr-8 to avoid overlap with default DialogClose if present, though we might rely on our own Close via styling or let default be */}
              {renderHeaderActions()}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {(() => {
                try {
                  const d = new Date(email.date);
                  return isNaN(d.getTime()) ? "Unknown date" : format(d, "PPpp");
                } catch (e) { return ""; }
              })()}
            </span>
            <span className="bg-zinc-100 px-2 py-1 rounded text-zinc-500">
              {account?.label || "Inbox"}
            </span>
          </div>
        </DialogHeader>
        {renderInnerContent()}
      </DialogContent>
    </Dialog>
  );
}
