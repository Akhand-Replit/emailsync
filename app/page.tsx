"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useEmail } from "@/components/email-provider"; // NEW

import { EmailView } from "@/components/email-view";
import { DashboardStats } from "@/components/dashboard-stats";
import { AppSidebar } from "@/components/app-sidebar";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { RefreshCw, Mail, MailOpen, Sparkles, AlertTriangle, Menu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GeminiService } from "@/lib/ai-service";
import { useSettingsStore } from "@/lib/store/settings-store";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface MailAccount {
  id: string;
  label: string;
  email: string;
  unreadCount: number;
  provider: string;
  host: string;
  port: number;
  encryptedPassword: any;
}

interface EmailMessage {
  uid: string;
  subject: string;
  from: string;
  date: string;
  flags: string[];
  account_id: string;
  category?: string;
}

type ViewMode = "dashboard" | "mailbox";

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  // Use Global Email Context
  const {
    accounts,
    emails,
    isFetching,
    page,
    setPage,
    selectedAccountId,
    setSelectedAccountId,
    viewMode,
    setViewMode,
    syncTotal,
    syncProgress,
    showSyncProgress,
    syncStatus,
    currentSyncAccount,
    fetchedCount,

    fetchAllMail,
    handleToggleReadStatus,
    deleteAccount,
    updateEmailTags,
    auditAccount,
    syncAllMail,
    isAuditing
  } = useEmail();

  // Local UI State (Keep these local as they are view-specific)
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditScope, setAuditScope] = useState<'fetched' | 'all'>('fetched');

  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);


  const [viewEmail, setViewEmail] = useState<EmailMessage | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  // Filter State
  const [searchQuery, setSearchQuery] = useState("");

  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const [analyzingPage, setAnalyzingPage] = useState(false);
  const { apiKey, loadSettings } = useSettingsStore();

  // Load AI Settings on Auth
  useEffect(() => {
    if (user?.uid) {
      loadSettings(user.uid);
    }
  }, [user?.uid, loadSettings]);


  const handleAnalyzePage = async () => {
    if (!apiKey) {
      toast.error("AI Settings not configured.");
      return;
    }

    const emailsToAnalyze = filteredEmails.slice(0, 30);

    if (emailsToAnalyze.length === 0) {
      toast.info("No emails to analyze");
      return;
    }

    setAnalyzingPage(true);
    try {
      const service = new GeminiService(apiKey);
      const payload = emailsToAnalyze.map(e => ({
        id: `${e.uid}_${e.account_id}`,
        subject: e.subject || "",
        sender: e.from || ""
      }));

      const tags = await service.batchCategorize(payload);
      updateEmailTags(tags);
      toast.success("Page Analysis Complete");
    } catch (err) {
      console.error(err);
      toast.error("Batch Analysis Failed");
    } finally {
      setAnalyzingPage(false);
    }
  };

  const handleDeepAudit = () => {
    if (!apiKey) {
      toast.error("AI Settings not configured.");
      return;
    }
    if (!selectedAccountId) return;

    // Open Modal Selection
    setAuditScope('fetched'); // Default
    setShowAuditModal(true);
  };

  const handleConfirmAudit = async () => {
    setShowAuditModal(false);
    if (!selectedAccountId || !apiKey) return;

    if (auditScope === 'fetched') {
      // Audit what we currently have loaded (filtered view)
      await auditAccount(selectedAccountId, apiKey, filteredEmails);
    } else {
      // Audit ALL (Sync first)
      // syncAllMail handles the UI for syncing
      const allEmails = await syncAllMail(selectedAccountId);
      if (allEmails.length > 0) {
        await auditAccount(selectedAccountId, apiKey, allEmails);
      } else {
        toast.error("No emails found to audit.");
      }
    }
  };

  // 1. Protect Route & Trigger Load Modal
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else if (!hasLoadedInitial && accounts.length > 0 && emails.length === 0) {
        // Only show modal if we have accounts but haven't loaded mail yet
        // Check emails.length === 0 so we don't show it if we already have cache
        if (sessionStorage.getItem(`emailsync_cached_emails_${user.uid}`)) {
          setHasLoadedInitial(true);
        } else {
          setShowLoadModal(true);
        }
      }
    }
  }, [user, loading, router, hasLoadedInitial, accounts.length, emails.length]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 0) return;
    fetchAllMail(newPage, false);
  };

  // 4. Navigation Handlers
  const handleGoToOverview = () => {
    setViewMode("dashboard");
    setSelectedAccountId(null);
  };

  const handleGoToInbox = (accountId: string | null) => {
    setViewMode("mailbox");
    setSelectedAccountId(accountId);
  };

  // 5. Mark as Read & View
  const handleEmailClick = (email: EmailMessage) => {
    setViewEmail(email);
    setIsViewOpen(true);
    if (!email.flags.includes('\\Seen')) {
      handleToggleReadStatus(null, email);
    }
  };


  const viewedAccount = viewEmail ? accounts.find(a => a.id === viewEmail.account_id) : null;

  const filteredEmails = emails.filter((email) => {
    // 1. Account Filter
    if (selectedAccountId && email.account_id !== selectedAccountId) return false;

    // 2. Unread Filter
    if (showUnreadOnly && email.flags.includes('\\Seen')) return false;

    // 3. Search Filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const subject = (email.subject || "").toLowerCase();
      const from = (email.from || "").toLowerCase();
      return subject.includes(query) || from.includes(query);
    }

    return true;
  });

  return (
    <div className="flex h-[100dvh] w-full flex-row overflow-hidden bg-background">

      {/* DESKTOP SIDEBAR */}
      <AppSidebar
        className="hidden md:flex"
        accounts={accounts}
        viewMode={viewMode}
        selectedAccountId={selectedAccountId}
        onNavigateToInbox={handleGoToInbox}
        onNavigateToOverview={handleGoToOverview}
      />

      {/* MOBILE MENU SHEET */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-80 [&>button]:hidden">
          <SheetTitle className="hidden">Navigation Menu</SheetTitle>
          <AppSidebar
            className="border-none w-full"
            accounts={accounts}
            viewMode={viewMode}
            selectedAccountId={selectedAccountId}
            onNavigateToInbox={handleGoToInbox}
            onNavigateToOverview={handleGoToOverview}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 bg-white h-full">
        {/* Header */}
        <header className="h-16 border-b flex items-center justify-between px-4 md:px-6 shrink-0 bg-white/80 backdrop-blur-sm sticky top-0 z-10 gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden -ml-2 shrink-0"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <h1 className="text-lg md:text-xl font-bold text-zinc-800 shrink-0 truncate">
              {viewMode === "dashboard"
                ? "Dashboard"
                : selectedAccountId
                  ? accounts.find(a => a.id === selectedAccountId)?.label
                  : "Unified Inbox"}
            </h1>

            {/* Search Input */}
            {viewMode === "mailbox" && (
              <div className="relative max-w-xs md:max-w-md w-full ml-auto md:ml-4 hidden sm:block">
                <input
                  type="text"
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-10 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 md:gap-2">
            {/* Mobile Search Toggle could go here if search is hidden on small screens */}

            {viewMode === "mailbox" && (
              <Button
                variant={showUnreadOnly ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                className={showUnreadOnly ? "bg-zinc-200" : ""}
                title="Toggle Unread Only"
              >
                <Mail className={`h-4 w-4 md:mr-2 ${showUnreadOnly ? "fill-current" : ""}`} />
                <span className="hidden md:inline">Unread</span>
              </Button>
            )}

            {viewMode === "mailbox" && selectedAccountId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeepAudit}
                disabled={isAuditing}
                className="gap-2 text-violet-600 border-violet-200 hover:bg-violet-50 text-xs md:text-sm px-2 md:px-4"
              >
                <Sparkles className={`h-3 w-3 md:h-4 md:w-4 ${isAuditing ? 'animate-spin' : ''}`} />
                {isAuditing ? 'Auditing...' : <span className="hidden sm:inline">Deep Audit</span>}
                <span className="sm:hidden">Audit</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAllMail(0, true)}
              disabled={isFetching || accounts.length === 0}
              className="gap-2 text-xs md:text-sm px-2 md:px-4"
            >
              <RefreshCw className={`h-3 w-3 md:h-4 md:w-4 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </Button>
          </div>
        </header>

        {/* Mobile Search Bar - Visible only on very small screens if I removed it from header, but kept in header hidden sm:block above. 
            Let's add a mobile specific search bar below header if needed, but header might be crowded. 
            Actually, let's keep it simple: Search is hidden on very small screens in header. 
            Maybe add a search icon to toggle it? For now, I'll leave it hidden on < sm to save space. 
            Or show it in the list view?
        */}
        {viewMode === "mailbox" && (
          <div className="sm:hidden p-2 border-b bg-zinc-50/50">
            <input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50 bg-white"
            />
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-zinc-50/50">
          {viewMode === "dashboard" ? (
            // DASHBOARD VIEW
            <DashboardStats
              accounts={accounts}
              emails={emails}
              onNavigateToAccount={(id) => handleGoToInbox(id)}
            />
          ) : (
            // MAILBOX VIEW
            <div className="p-0">
              {accounts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground space-y-4">
                  <div className="p-6 bg-zinc-100 rounded-full"><Mail className="h-10 w-10 text-zinc-300" /></div>
                  <p>Add an account to get started</p>
                </div>
              ) : filteredEmails.length === 0 && !isFetching ? (
                <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
                  <p>No emails found (try syncing)</p>
                </div>
              ) : (
                <div className="flex flex-col min-h-full">
                  <div className="divide-y divide-zinc-100 bg-white flex-1">
                    {filteredEmails.map((email) => {
                      const isRead = email.flags && email.flags.includes('\\Seen');
                      return (
                        <div
                          key={email.uid + email.account_id}
                          onClick={() => handleEmailClick(email)}
                          className={`flex items-start p-3 md:p-4 hover:bg-zinc-50 cursor-pointer group transition-colors relative border-b last:border-0 ${!isRead ? 'bg-blue-50/40' : ''}`}
                        >
                          {/* Status Indicator Bar */}
                          {!isRead && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                          )}

                          <div className="flex-1 min-w-0 pl-2 md:pl-3">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className={`text-xs md:text-sm truncate pr-2 ${!isRead ? 'text-blue-950 font-bold' : 'text-zinc-700 font-medium'}`}>
                                  {email.from.replace(/"/g, '').split('<')[0]}
                                </p>
                                {!isRead && (
                                  <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500"></span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 md:gap-3">
                                <span className={`text-[10px] md:text-xs whitespace-nowrap ${!isRead ? 'text-blue-600 font-medium' : 'text-zinc-400'}`}>
                                  {(() => {
                                    try {
                                      const d = new Date(email.date);
                                      return isNaN(d.getTime()) ? "Unknown date" : formatDistanceToNow(d, { addSuffix: true });
                                    } catch (e) {
                                      return "Unknown date";
                                    }
                                  })()}
                                </span>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-6 w-6 md:h-8 md:w-8 -mr-1 md:-mr-2 transition-colors md:opacity-0 md:group-hover:opacity-100 ${isRead
                                    ? "text-zinc-300 hover:text-blue-600 hover:bg-blue-50"
                                    : "text-blue-400 hover:text-blue-600 hover:bg-blue-100"
                                    }`}
                                  title={isRead ? "Mark as unread" : "Mark as read"}
                                  onClick={(e) => handleToggleReadStatus(e, email)}
                                >
                                  {isRead ? (
                                    <Mail className="h-3 w-3 md:h-4 md:w-4" />
                                  ) : (
                                    <MailOpen className="h-3 w-3 md:h-4 md:w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            <h4 className={`text-sm md:text-sm truncate leading-snug mb-0.5 group-hover:text-primary transition-colors ${!isRead ? 'text-zinc-900 font-semibold' : 'text-zinc-600'}`}>
                              {email.subject || "(No Subject)"}
                            </h4>

                            {email.category && (
                              <div className="mb-1">
                                <Badge variant="outline" className={`
                                  text-[10px] px-1.5 py-0 h-5 font-normal
                                  ${email.category === 'Governmental' ? 'bg-red-600 text-white border-red-700 font-medium' : ''}
                                  ${email.category?.includes('Marketing') ? 'bg-orange-100 text-orange-700 border-orange-200' : ''}
                                  ${email.category?.includes('Spam') ? 'bg-red-100 text-red-700 border-red-200' : ''}
                                  ${email.category === 'Administrational' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : ''}
                                  ${!['Governmental', 'Administrational'].includes(email.category) && !email.category?.includes('Marketing') && !email.category?.includes('Spam') ? 'bg-zinc-100 text-zinc-700 border-zinc-200' : ''}
                                `}>
                                  {email.category}
                                </Badge>
                              </div>
                            )}

                            <p className="text-xs text-muted-foreground truncate opacity-80">
                              {email.account_id && accounts.find(a => a.id === email.account_id)?.label}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination & Load More Controls */}
                  {!loading && emails.length > 0 && (
                    <div className="mt-auto">
                      <>
                        {/* 1. Full Pagination */}
                        {selectedAccountId && syncTotal > 0 ? (
                          <div className="py-6 bg-white border-t border-zinc-200 pixel-antialiased">
                            <Pagination>
                              <PaginationContent>
                                <PaginationItem>
                                  <PaginationPrevious
                                    onClick={() => handlePageChange(page - 1)}
                                    className={page === 0 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                  />
                                </PaginationItem>

                                <div className="hidden sm:flex flex-row items-center gap-1">
                                  {[...Array(Math.min(5, Math.ceil(syncTotal / 50)))].map((_, i) => {
                                    const p = i;
                                    return (
                                      <PaginationItem key={p}>
                                        <PaginationLink
                                          isActive={page === p}
                                          onClick={() => handlePageChange(p)}
                                          className="cursor-pointer"
                                        >
                                          {p + 1}
                                        </PaginationLink>
                                      </PaginationItem>
                                    );
                                  })}
                                </div>
                                <div className="sm:hidden text-xs flex items-center px-2">
                                  Page {page + 1}
                                </div>

                                <PaginationItem className="hidden sm:block">
                                  <PaginationEllipsis />
                                </PaginationItem>

                                <PaginationItem>
                                  <PaginationNext
                                    onClick={() => handlePageChange(page + 1)}
                                    className={(page + 1) * 50 >= syncTotal ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                  />
                                </PaginationItem>
                              </PaginationContent>
                            </Pagination>
                            <div className="text-center text-xs text-muted-foreground mt-2 hidden sm:block">
                              Page {page + 1} of {Math.ceil(syncTotal / 50)} (Total {syncTotal} emails)
                            </div>
                          </div>
                        ) : (
                          /* 2. Fallback: If total unknown or All Inboxes */
                          <div className="p-4 flex justify-center bg-zinc-50 border-t border-zinc-200">
                            <Button variant="outline" onClick={() => fetchAllMail(page + 1)}>
                              {selectedAccountId ? "Load Next Page" : "Load Older Emails"}
                            </Button>
                          </div>
                        )}
                      </>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Load Mail Modal */}
      <Dialog open={showLoadModal} onOpenChange={setShowLoadModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Welcome Back</DialogTitle>
            <DialogDescription>
              Would you like to load your latest emails now?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 sm:justify-between gap-2 flex-col sm:flex-row">
            <Button variant="ghost" onClick={() => {
              setShowLoadModal(false);
              setHasLoadedInitial(true);
            }}>
              Skip for now
            </Button>
            <Button onClick={() => {
              fetchAllMail(0, true);
              setShowLoadModal(false);
              setHasLoadedInitial(true);
            }} className="w-full sm:w-auto gap-2">
              <RefreshCw className="h-4 w-4" /> Load All Mail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sync Progress Modal */}
      <Dialog open={showSyncProgress} onOpenChange={() => { }}>
        <DialogContent className="sm:max-w-[400px]" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-center">Syncing Emails</DialogTitle>
            <DialogDescription className="text-center">
              Please wait while we update your inbox...
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-6">

            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center relative">
                <RefreshCw className="h-6 w-6 text-primary animate-spin" />
              </div>

              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-zinc-900">
                  {currentSyncAccount ? `Checking ${currentSyncAccount}...` : "Starting sync..."}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {syncStatus}
                </p>
              </div>

              <div className="flex items-center gap-2 bg-zinc-100 rounded-full px-4 py-1.5 border border-zinc-200">
                <Mail className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-xs font-medium text-zinc-700">
                  {fetchedCount > 0 ? `${fetchedCount} new emails found` : "Looking for emails..."}
                </span>
              </div>
            </div>

            <div className="space-y-2 px-2">
              <Progress value={syncProgress} className="h-1.5" />
              <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                <span>Progress</span>
                <span>{syncProgress}%</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Other Modals */}
      <EmailView
        email={viewEmail}
        account={viewedAccount}
        isOpen={isViewOpen}
        onClose={() => setIsViewOpen(false)}
      />

      {/* Deep Audit Selection Modal */}
      <Dialog open={showAuditModal} onOpenChange={setShowAuditModal}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-600" />
              Deep Audit Configuration
            </DialogTitle>
            <DialogDescription>
              Select how you want to analyze your emails with AI.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${auditScope === 'fetched' ? 'border-violet-600 bg-violet-50 rings-1 ring-violet-600' : 'hover:bg-zinc-50'}`}
              onClick={() => setAuditScope('fetched')}
            >
              <div className={`mt-0.5 rounded-full w-4 h-4 border flex items-center justify-center shrink-0 ${auditScope === 'fetched' ? 'border-violet-600' : 'border-zinc-400'}`}>
                {auditScope === 'fetched' && <div className="w-2 h-2 rounded-full bg-violet-600" />}
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-zinc-900">Fetched Emails Only</h4>
                <p className="text-xs text-muted-foreground">
                  Audit only the <span className="font-medium text-zinc-900">{filteredEmails.length} emails</span> currently visible in your list. Fast & focused.
                </p>
              </div>
            </div>

            <div
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all ${auditScope === 'all' ? 'border-violet-600 bg-violet-50 rings-1 ring-violet-600' : 'hover:bg-zinc-50'}`}
              onClick={() => setAuditScope('all')}
            >
              <div className={`mt-0.5 rounded-full w-4 h-4 border flex items-center justify-center shrink-0 ${auditScope === 'all' ? 'border-violet-600' : 'border-zinc-400'}`}>
                {auditScope === 'all' && <div className="w-2 h-2 rounded-full bg-violet-600" />}
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-zinc-900">All Emails (Deep Sync)</h4>
                <p className="text-xs text-muted-foreground">
                  Syncs and loads <span className="font-semibold">all pages</span> from this account, then audits everything.
                </p>
              </div>
            </div>

            <div className="rounded-md bg-amber-50 p-3 flex gap-3 items-start border border-amber-100 mt-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 leading-snug">
                <strong>Disclaimer:</strong> AI analysis can sometimes be misleading. Please recheck important categorization manually to ensure accuracy.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between flex-col sm:flex-row">
            <Button variant="ghost" onClick={() => setShowAuditModal(false)}>Cancel</Button>
            <Button onClick={handleConfirmAudit} className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
              <Sparkles className="h-4 w-4" />
              {auditScope === 'fetched' ? 'Audit Fetched' : 'Sync & Audit All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


    </div>
  );
}