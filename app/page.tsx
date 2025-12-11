"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, orderBy, deleteDoc, doc } from "firebase/firestore";
import { AddAccountModal } from "@/components/add-account-modal";
import { EmailView } from "@/components/email-view";
import { DashboardStats } from "@/components/dashboard-stats"; // Import our new component
import { PWAInstallButton } from "@/components/pwa-install-button";

import { Button } from "@/components/ui/button";
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

  // Data State
  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [page, setPage] = useState(0);

  // UI State
  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [hasLoadedInitial, setHasLoadedInitial] = useState(false);

  // Actions State
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
      } else if (!hasLoadedInitial && accounts.length > 0) {
        // Only show modal if we have accounts but haven't loaded mail yet
        setShowLoadModal(true);
      }
    }
  }, [user, loading, router, hasLoadedInitial, accounts.length]);

  // 2. Listen for Accounts
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "mail_accounts"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const accountsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MailAccount[];
      setAccounts(accountsData);
    });

    return () => unsubscribe();
  }, [user]);

  // Load from cache on mount
  useEffect(() => {
    if (!user) return;
    const key = `emailsync_cached_emails_${user.uid}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setEmails(parsed);
          setHasLoadedInitial(true);
        }
      } catch (e) {
        console.error("Failed to parse email cache", e);
      }
    }
  }, [user]);

  // Save to cache on change
  useEffect(() => {
    if (!user || emails.length === 0) return;
    const key = `emailsync_cached_emails_${user.uid}`;
    localStorage.setItem(key, JSON.stringify(emails));
  }, [emails, user]);

  // 3. Fetch Mail Function
  const fetchAllMail = useCallback(async (pageIndex: number | any = 0) => {
    // Handle event objects if passed directly
    const targetPage = typeof pageIndex === 'number' ? pageIndex : 0;

    if (accounts.length === 0) return;

    setIsFetching(true);
    if (targetPage > 0) setPage(targetPage); // Update current page if fetching older

    // Close modal immediately when starting fetch
    setShowLoadModal(false);
    setHasLoadedInitial(true);

    // Use Promise.allSettled to ensure one failure doesn't stop others
    const promises = accounts.map(account =>
      fetch("/api/check-mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, page: targetPage }),
      })
        .then(res => res.json())
        .then(data => data.emails || [])
        .catch(error => {
          console.error(`Failed to fetch for ${account.email}`, error);
          return [];
        })
    );

    const results = await Promise.all(promises);

    // SMART MERGE: Combine new results with existing emails, deduplicate by unique key
    const newEmailsFlat = results.flat() as EmailMessage[];

    setEmails(prev => {
      const unique = new Map<string, EmailMessage>();

      // 1. Add existing cached emails
      prev.forEach(e => unique.set(e.uid + e.account_id, e));

      // 2. Add/Update with new emails (overwriting existing to update flags like 'read')
      newEmailsFlat.forEach(e => unique.set(e.uid + e.account_id, e));

      const merged = Array.from(unique.values());
      merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return merged;
    });

    setIsFetching(false);
    toast.success("Inbox synced");
  }, [accounts]);

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
  // 5. Toggle Read/Unread
  const handleToggleReadStatus = async (e: React.MouseEvent, email: EmailMessage) => {
    e.stopPropagation();
    const isCurrentlyRead = email.flags.includes('\\Seen');

    // Optimistic Update
    setEmails((prev) =>
      prev.map((msg) =>
        msg.uid === email.uid && msg.account_id === email.account_id
          ? {
            ...msg,
            flags: isCurrentlyRead
              ? msg.flags.filter(f => f !== '\\Seen')
              : [...msg.flags, '\\Seen']
          }
          : msg
      )
    );

    try {
      const account = accounts.find(a => a.id === email.account_id);
      if (!account) return;

      const endpoint = isCurrentlyRead ? "/api/mark-unread" : "/api/mark-read";

      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, uid: email.uid }),
      });
      toast.success(isCurrentlyRead ? "Marked as unread" : "Marked as read");
    } catch (error) {
      console.error("Failed to toggle status", error);
      toast.error("Failed to update status");
      // Revert optimistic update? (Simplified: left out for now)
    }
  };

  const handleEmailClick = (email: EmailMessage) => {
    setViewEmail(email);
    setIsViewOpen(true);
    if (!email.flags.includes('\\Seen')) {
      setEmails((prev) =>
        prev.map((msg) =>
          msg.uid === email.uid && msg.account_id === email.account_id
            ? { ...msg, flags: [...msg.flags, '\\Seen'] }
            : msg
        )
      );
    }
  };

  const handleDeleteAccount = async () => {
    if (!accountToDelete || !user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "mail_accounts", accountToDelete));
      toast.success("Account removed");
      if (selectedAccountId === accountToDelete) {
        handleGoToOverview();
      }
      setEmails(prev => prev.filter(e => e.account_id !== accountToDelete));
    } catch (error) {
      console.error("Delete error", error);
      toast.error("Failed to delete account");
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
              onClick={fetchAllMail}
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
                <div className="divide-y divide-zinc-100 bg-white">
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
                                {formatDistanceToNow(new Date(email.date), { addSuffix: true })}
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

                  {/* Load More Button */}
                  <div className="p-4 flex justify-center border-t bg-zinc-50/50">
                    <Button
                      variant="outline"
                      onClick={() => fetchAllMail(page + 1)}
                      disabled={isFetching}
                      className="min-w-[120px]"
                    >
                      {isFetching ? "Loading..." : "Load Older Emails"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Load Mail Modal (Shows on startup) */}
      <Dialog open={showLoadModal} onOpenChange={setShowLoadModal}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Welcome Back</DialogTitle>
            <DialogDescription>
              Would you like to load your latest emails now?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 sm:justify-between gap-2">
            <Button variant="ghost" onClick={() => setShowLoadModal(false)}>
              Skip for now
            </Button>
            <Button onClick={fetchAllMail} className="w-full sm:w-auto gap-2">
              <RefreshCw className="h-4 w-4" /> Load All Mail
            </Button>
          </DialogFooter>
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