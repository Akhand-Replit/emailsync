"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, orderBy, deleteDoc, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trash2, Mail, Server, Shield, Search, Plus, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
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
import { Badge } from "@/components/ui/badge";

interface MailAccount {
    id: string;
    label: string;
    email: string;
    provider: string;
    host: string;
    port: number;
}

export default function AccountsPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [accounts, setAccounts] = useState<MailAccount[]>([]);
    const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

    // Connection Check State
    const [checkingConnections, setCheckingConnections] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<Record<string, { status: "success" | "error", message?: string }>>({});

    // Protect Route
    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    // Fetch Accounts
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

    const handleDeleteAccount = async () => {
        if (!accountToDelete || !user) return;
        try {
            await deleteDoc(doc(db, "users", user.uid, "mail_accounts", accountToDelete));
            toast.success("Account removed");
        } catch (error) {
            console.error("Delete error", error);
            toast.error("Failed to delete account");
        } finally {
            setAccountToDelete(null);
        }
    };

    const handleCheckConnections = async () => {
        setCheckingConnections(true);
        setConnectionStatus({});

        const newStatus: Record<string, { status: "success" | "error", message?: string }> = {};

        for (const account of accounts) {
            try {
                const res = await fetch("/api/check-connection", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(account),
                });
                const data = await res.json();

                if (res.ok && data.success) {
                    newStatus[account.id] = { status: "success" };
                } else {
                    newStatus[account.id] = { status: "error", message: data.error || "Connection failed" };
                }
            } catch (error) {
                newStatus[account.id] = { status: "error", message: "Network error" };
            }
            // Update progressively
            setConnectionStatus(prev => ({ ...prev, [account.id]: newStatus[account.id] }));
        }

        setCheckingConnections(false);
        toast.info("Connection check complete");
    };

    // Filter Accounts

    // Filter Accounts
    const filteredAccounts = accounts.filter(acc => {
        const q = searchQuery.toLowerCase();
        return (
            acc.label.toLowerCase().includes(q) ||
            acc.email.toLowerCase().includes(q) ||
            acc.provider.toLowerCase().includes(q)
        );
    });

    return (
        <div className="flex min-h-screen w-full flex-col bg-zinc-50/50">
            {/* Header */}
            <header className="h-16 border-b flex items-center justify-between px-6 bg-white sticky top-0 z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push("/")}
                        className="gap-2 text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Dashboard
                    </Button>
                    <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Manage Accounts</h1>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCheckConnections}
                    disabled={checkingConnections || accounts.length === 0}
                    className="gap-2"
                >
                    <RefreshCw className={`h-4 w-4 ${checkingConnections ? "animate-spin" : ""}`} />
                    {checkingConnections ? "Checking..." : "Check Connections"}
                </Button>
            </header>

            <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">

                {/* Search and Stats Section */}
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by name, email, or provider..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-white"
                        />
                    </div>
                    <div className="text-sm text-muted-foreground font-medium">
                        {accounts.length} {accounts.length === 1 ? 'Account' : 'Accounts'} Connected
                    </div>
                </div>

                <div className="bg-white rounded-xl border shadow-sm overflow-hidden min-h-[400px]">
                    {accounts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full p-12 text-center text-muted-foreground">
                            <div className="bg-zinc-100 p-4 rounded-full mb-4">
                                <Mail className="h-8 w-8 text-zinc-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-zinc-900 mb-1">No accounts connected</h3>
                            <p className="max-w-sm mx-auto mb-6">Connect your first email account to start syncing messages.</p>
                            <Button onClick={() => router.push("/")} className="gap-2">
                                <Plus className="h-4 w-4" /> Go to Dashboard
                            </Button>
                        </div>
                    ) : filteredAccounts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                            <Search className="h-10 w-10 text-zinc-200 mb-2" />
                            <p>No accounts match your search.</p>
                            <Button variant="link" onClick={() => setSearchQuery("")}>Clear search</Button>
                        </div>
                    ) : (
                        <div className="divide-y relative">
                            {/* Table Header */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-zinc-50/80 border-b backdrop-blur-sm sticky top-0 z-10 hidden md:grid">
                                <div className="md:col-span-5 pl-2">Account Details</div>
                                <div className="md:col-span-3">Provider</div>
                                <div className="md:col-span-3">Connection</div>
                                <div className="md:col-span-1 text-right pr-2">Action</div>
                            </div>

                            {/* Account Rows */}
                            {filteredAccounts.map((account) => {
                                const status = connectionStatus[account.id];
                                return (
                                    <div key={account.id} className={`grid grid-cols-1 md:grid-cols-12 gap-4 p-4 items-center hover:bg-zinc-50/50 transition-all group border-l-4 ${status?.status === 'error' ? 'border-l-red-500 bg-red-50/10' : status?.status === 'success' ? 'border-l-green-500' : 'border-l-transparent'}`}>

                                        {/* Mobile Label (Visible only on small screens) */}
                                        <div className="md:col-span-12 md:hidden flex items-center justify-between mb-2">
                                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Account</span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                                onClick={() => setAccountToDelete(account.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="md:col-span-5 flex items-center gap-4 min-w-0">
                                            <div className="h-10 w-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 shadow-sm">
                                                <Mail className="h-5 w-5 text-blue-600" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="font-semibold text-zinc-900 truncate leading-tight">{account.label}</div>
                                                <div className="text-sm text-zinc-500 truncate font-mono mt-0.5">{account.email}</div>
                                            </div>
                                        </div>

                                        <div className="md:col-span-3 flex items-center gap-2 mt-2 md:mt-0">
                                            <Badge variant="outline" className="bg-zinc-50 font-normal gap-1.5 px-3 py-1">
                                                <Shield className="h-3 w-3 opacity-60" />
                                                {account.provider}
                                            </Badge>
                                        </div>

                                        <div className="md:col-span-3 text-sm text-zinc-500 flex items-center gap-2 mt-1 md:mt-0 font-mono">
                                            <Server className="h-3.5 w-3.5 opacity-50" />
                                            <span className="truncate">{account.host}:{account.port}</span>
                                        </div>

                                        <div className="md:col-span-1 hidden md:flex justify-end items-center gap-2">
                                            {status && (
                                                <div title={status.message}>
                                                    {status.status === 'success' ? (
                                                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                                                    ) : (
                                                        <AlertCircle className="h-5 w-5 text-red-500" />
                                                    )}
                                                </div>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-zinc-400 group-hover:text-red-600 hover:bg-red-50 transition-colors"
                                                title="Delete Account"
                                                onClick={() => setAccountToDelete(account.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            <AlertDialog open={!!accountToDelete} onOpenChange={(open) => !open && setAccountToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Account?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove <strong>{accounts.find(a => a.id === accountToDelete)?.email}</strong> from EmailSync.
                            You can add it back anytime.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAccount} className="bg-red-600 hover:bg-red-700">
                            Delete Account
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
