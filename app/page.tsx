"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useEmail } from "@/components/email-provider"; // NEW
import { AddAccountModal } from "@/components/add-account-modal";
import { EmailView } from "@/components/email-view";
import { DashboardStats } from "@/components/dashboard-stats";
import { PWAInstallButton } from "@/components/pwa-install-button";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { RefreshCw, LogOut, Mail, Inbox, MailOpen, Trash2, LayoutDashboard, CheckCircle2, Settings } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
    deleteAccount
  } = useEmail();

  // Local UI State (Keep these local as they are view-specific)
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  const [viewEmail, setViewEmail] = useState<EmailMessage | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  // Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

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

  const handleDeleteAccount = async () => {
    if (!accountToDelete) return;
    try {
      await deleteAccount(accountToDelete);
    } finally {
      setAccountToDelete(null);
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
    <div className="flex h-[100dvh] w-full flex-col md:flex-row overflow-hidden bg-background">

      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-zinc-50 border-r p-4 flex flex-col h-full shrink-0">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <h2 className="font-bold text-lg tracking-tight flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Mail className="text-white h-4 w-4" />
            </div>
            EmailSync
          </h2>
          <AddAccountModal existingAccounts={accounts} />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-2">
          {/* Overview Tab */}
          <button
            onClick={handleGoToOverview}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm transition-colors font-medium mb-4 ${viewMode === "dashboard"
              ? "bg-primary/10 text-primary"
              : "hover:bg-zinc-200/50 text-zinc-700"
              }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Overview</span>
          </button>

          <div className="text-xs font-semibold text-muted-foreground px-3 mb-2 uppercase tracking-wider">
            Inboxes
          </div>

          <button
            onClick={() => handleGoToInbox(null)}
            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm transition-colors ${viewMode === "mailbox" && selectedAccountId === null
              ? "bg-primary/10 text-primary font-medium"
              : "hover:bg-zinc-200/50 text-zinc-700"
              }`}
          >
            <Inbox className="h-4 w-4" />
            <span>All Inboxes</span>
          </button>

          {accounts.map((account) => (
            <div
              key={account.id}
              className={`group flex items-center w-full rounded-md transition-colors ${viewMode === "mailbox" && selectedAccountId === account.id
                ? "bg-primary/10 text-primary font-medium"
                : "hover:bg-zinc-200/50 text-zinc-700"
                }`}
            >
              <button
                onClick={() => handleGoToInbox(account.id)}
                className="flex-1 flex items-center space-x-3 px-3 py-2 text-sm min-w-0"
              >
                {/* Provider Icon Placeholder or Generic Mail */}
                <Mail className="h-4 w-4 shrink-0 opacity-70" />
                <div className="flex-1 text-left truncate">
                  <p className="truncate">{account.label}</p>
                </div>
              </button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-600 mr-1"
                onClick={() => setAccountToDelete(account.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="pt-4 border-t mt-auto shrink-0">
          <div className="text-xs text-muted-foreground truncate font-mono bg-zinc-200/50 p-1 rounded mb-2 text-center">
            {user?.email}
          </div>
          <PWAInstallButton />
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-zinc-900 mb-1"
            onClick={() => router.push("/accounts")}
          >
            <Settings className="h-4 w-4 mr-2" />
            Manage Accounts
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => logout()}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 bg-white h-full">
        {/* Header */}
        <header className="h-16 border-b flex items-center justify-between px-6 shrink-0 bg-white/80 backdrop-blur-sm sticky top-0 z-10 gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <h1 className="text-xl font-bold text-zinc-800 shrink-0">
              {viewMode === "dashboard"
                ? "Dashboard"
                : selectedAccountId
                  ? accounts.find(a => a.id === selectedAccountId)?.label
                  : "Unified Inbox"}
            </h1>

            {/* Search Input */}
            {viewMode === "mailbox" && (
              <div className="relative max-w-md w-full ml-4 hidden md:block">
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

          <div className="flex items-center gap-2">
            {viewMode === "mailbox" && (
              <Button
                variant={showUnreadOnly ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setShowUnreadOnly(!showUnreadOnly)}
                className={showUnreadOnly ? "bg-zinc-200" : ""}
                title="Toggle Unread Only"
              >
                <Mail className={`h-4 w-4 mr-2 ${showUnreadOnly ? "fill-current" : ""}`} />
                <span className="hidden sm:inline">Unread</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAllMail(0, true)}
              disabled={isFetching || accounts.length === 0}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Syncing...' : 'Sync'}
            </Button>
          </div>
        </header>

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
                          className={`flex items-start p-4 hover:bg-zinc-50 cursor-pointer group transition-colors relative border-b last:border-0 ${!isRead ? 'bg-blue-50/40' : ''}`}
                        >
                          {/* Status Indicator Bar */}
                          {!isRead && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                          )}

                          <div className="flex-1 min-w-0 pl-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className={`text-sm truncate pr-2 ${!isRead ? 'text-blue-950 font-bold' : 'text-zinc-700 font-medium'}`}>
                                  {email.from.replace(/"/g, '').split('<')[0]}
                                </p>
                                {!isRead && (
                                  <span className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500"></span>
                                )}
                              </div>

                              <div className="flex items-center gap-3">
                                <span className={`text-xs whitespace-nowrap ${!isRead ? 'text-blue-600 font-medium' : 'text-zinc-400'}`}>
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
                                  className={`h-8 w-8 -mr-2 transition-colors ${isRead
                                    ? "text-zinc-300 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100"
                                    : "text-blue-400 hover:text-blue-600 hover:bg-blue-100"
                                    }`}
                                  title={isRead ? "Mark as unread" : "Mark as read"}
                                  onClick={(e) => handleToggleReadStatus(e, email)}
                                >
                                  {isRead ? (
                                    <Mail className="h-4 w-4" />
                                  ) : (
                                    <MailOpen className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>

                            <h4 className={`text-sm truncate leading-snug mb-0.5 group-hover:text-primary transition-colors ${!isRead ? 'text-zinc-900 font-semibold' : 'text-zinc-600'}`}>
                              {email.subject || "(No Subject)"}
                            </h4>
                            <p className="text-xs text-muted-foreground truncate opacity-80">
                              {/* Preview snippet could go here if available */}
                              {email.account_id && accounts.find(a => a.id === email.account_id)?.label}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination & Load More Controls */}
                  {!loading && emails.length > 0 && (
                    <div className="mt-auto"> {/* mt-auto pushes to bottom if parent is flex col */}
                      <>
                        {/* 1. Full Pagination: If we know the total and are viewing a specific account */}
                        {selectedAccountId && syncTotal > 0 ? (
                          <div className="py-6 bg-white border-t border-zinc-200">
                            <Pagination>
                              <PaginationContent>
                                <PaginationItem>
                                  <PaginationPrevious
                                    onClick={() => handlePageChange(page - 1)}
                                    className={page === 0 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                  />
                                </PaginationItem>

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

                                <PaginationItem>
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
                            <div className="text-center text-xs text-muted-foreground mt-2">
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
          <DialogFooter className="mt-4 sm:justify-between gap-2">
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

      <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the account from your dashboard. You can add it back anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}