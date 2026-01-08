"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, orderBy, deleteDoc, doc } from "firebase/firestore";
import { toast } from "sonner";

// Types
export interface MailAccount {
    id: string;
    label: string;
    email: string;
    unreadCount?: number;
    provider: string;
    host: string;
    port: number;
    encryptedPassword: any;
}

export interface EmailMessage {
    uid: string;
    subject: string;
    from: string;
    date: string;
    flags: string[];
    account_id: string;
}

interface EmailContextType {
    // Data
    accounts: MailAccount[];
    emails: EmailMessage[];
    isFetching: boolean;

    // State
    page: number;
    setPage: (page: number) => void;
    selectedAccountId: string | null;
    setSelectedAccountId: (id: string | null) => void;
    viewMode: "dashboard" | "mailbox";
    setViewMode: (mode: "dashboard" | "mailbox") => void;
    syncTotal: number;
    syncProgress: number;
    showSyncProgress: boolean;
    syncStatus: string;
    currentSyncAccount: string | null;
    fetchedCount: number;

    // Actions
    fetchAllMail: (pageIndex?: number, force?: boolean) => Promise<void>;
    handleToggleReadStatus: (e: React.MouseEvent | null, email: EmailMessage) => Promise<void>;
    deleteAccount: (accountId: string) => Promise<void>;
    refreshAccounts: () => void;
}

const EmailContext = createContext<EmailContextType | undefined>(undefined);

export function EmailProvider({ children }: { children: ReactNode }) {
    const { user, loading } = useAuth();

    // Data State
    const [accounts, setAccounts] = useState<MailAccount[]>([]);
    const [emails, setEmails] = useState<EmailMessage[]>([]);
    const [isFetching, setIsFetching] = useState(false);
    const [page, setPage] = useState(0);

    // UI State
    const [viewMode, setViewMode] = useState<"dashboard" | "mailbox">("dashboard");
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

    // Sync Progress State
    const [showSyncProgress, setShowSyncProgress] = useState(false);
    const [syncProgress, setSyncProgress] = useState(0);
    const [syncStatus, setSyncStatus] = useState("");
    const [syncTotal, setSyncTotal] = useState(0);
    const [currentSyncAccount, setCurrentSyncAccount] = useState<string | null>(null);
    const [fetchedCount, setFetchedCount] = useState(0);

    // 1. Listen for Accounts
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

    // 2. Load from cache on mount
    useEffect(() => {
        if (!user) return;
        const key = `emailsync_cached_emails_${user.uid}`;
        const cached = sessionStorage.getItem(key);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // ENSURE SORT ORDER
                    parsed.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    setEmails(parsed);
                }
            } catch (e) {
                console.error("Failed to parse email cache", e);
            }
        }
    }, [user]);

    // 3. Save to cache on change
    useEffect(() => {
        if (!user || emails.length === 0) return;
        const key = `emailsync_cached_emails_${user.uid}`;
        const MAX_CACHE_SIZE = 500;

        try {
            const unread = emails.filter(e => !e.flags.includes('\\Seen'));
            const read = emails.filter(e => e.flags.includes('\\Seen'));

            read.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

            const toSave = [...unread, ...read].slice(0, MAX_CACHE_SIZE);
            sessionStorage.setItem(key, JSON.stringify(toSave));
        } catch (error) {
            console.error("Cache save failed", error);
        }
    }, [emails, user]);

    // 4. Fetch Mail Function
    const fetchAllMail = useCallback(async (pageIndex: number | any = 0, force: boolean = false) => {
        const targetPage = typeof pageIndex === 'number' ? pageIndex : 0;

        if (accounts.length === 0) return;

        const accountsToFetch = selectedAccountId
            ? accounts.filter(a => a.id === selectedAccountId)
            : accounts;

        if (accountsToFetch.length === 0) return;

        // SMART CHECK
        const currentViewEmails = emails.filter(e =>
            selectedAccountId ? e.account_id === selectedAccountId : true
        );

        const neededCount = (targetPage + 1) * 50;
        const hasEnoughData = currentViewEmails.length >= neededCount;
        const isTotalReached = syncTotal > 0 && currentViewEmails.length >= syncTotal;

        if (!force && (hasEnoughData || isTotalReached)) {
            setPage(targetPage);
            console.log("Smart Load: Data exists in cache, skipping fetch.");
            return;
        }

        setIsFetching(true);
        setPage(targetPage);

        // Initialize Progress UI
        setShowSyncProgress(true);
        setSyncProgress(0);
        setFetchedCount(0);
        setCurrentSyncAccount(null);
        setSyncStatus(`Syncing Page ${targetPage + 1}...`);

        const allFetchedEmails: EmailMessage[] = [];
        let completedCount = 0;
        const totalAccounts = accountsToFetch.length;
        let maxTotal = 0;

        for (const account of accountsToFetch) {
            setCurrentSyncAccount(account.email);
            try {
                const res = await fetch("/api/check-mail", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ account, page: targetPage }),
                });

                const data = await res.json();
                if (data.total && data.total > maxTotal) maxTotal = data.total;

                if (data.emails && Array.isArray(data.emails)) {
                    allFetchedEmails.push(...data.emails);
                    setFetchedCount(prev => prev + data.emails.length);
                }
            } catch (error) {
                console.error(`Failed to fetch for ${account.email}`, error);
            } finally {
                completedCount++;
                const percent = Math.round((completedCount / totalAccounts) * 100);
                setSyncProgress(percent);
            }
        }

        setSyncTotal(maxTotal);

        setTimeout(() => {
            setShowSyncProgress(false);
        }, 500);

        // Merge logic
        setEmails(prev => {
            const unique = new Map<string, EmailMessage>();
            prev.forEach(e => unique.set(e.uid + e.account_id, e));
            allFetchedEmails.forEach(e => unique.set(e.uid + e.account_id, e));
            const merged = Array.from(unique.values());
            merged.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            return merged;
        });

        setIsFetching(false);
    }, [accounts, selectedAccountId, emails, syncTotal]);

    // 5. Toggle Read/Unread
    const handleToggleReadStatus = async (e: React.MouseEvent | null, email: EmailMessage) => {
        if (e) e.stopPropagation();
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
        }
    };

    // 6. Delete Account
    const deleteAccount = async (accountId: string) => {
        if (!user) return;
        try {
            await deleteDoc(doc(db, "users", user.uid, "mail_accounts", accountId));
            toast.success("Account removed");

            // Cleanup emails
            setEmails(prev => prev.filter(e => e.account_id !== accountId));

            if (selectedAccountId === accountId) {
                setSelectedAccountId(null);
                setViewMode("dashboard");
            }
        } catch (error) {
            console.error("Delete error", error);
            toast.error("Failed to delete account");
            throw error;
        }
    };

    const refreshAccounts = () => {
        // This is handled by onSnapshot, but we can expose a manual trigger if needed
        // or use this space to trigger a full re-sync
    };

    // Reset page when switching accounts
    useEffect(() => {
        setPage(0);
        setSyncTotal(0);
        // Auto-sync logic (only if not initial load to avoid double fetch loop, 
        // but here we just defer it or use the 'force' flag if user clicked)
    }, [selectedAccountId]);

    return (
        <EmailContext.Provider value={{
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
            refreshAccounts
        }}>
            {children}
        </EmailContext.Provider>
    );
}

export function useEmail() {
    const context = useContext(EmailContext);
    if (context === undefined) {
        throw new Error("useEmail must be used within an EmailProvider");
    }
    return context;
}
