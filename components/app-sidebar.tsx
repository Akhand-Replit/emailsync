"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { PWAInstallButton } from "@/components/pwa-install-button";
import { Search, Mail, LayoutDashboard, Settings, LogOut } from "lucide-react";

interface AppSidebarProps {
    accounts: any[];
    viewMode: "dashboard" | "mailbox";
    selectedAccountId: string | null;
    onNavigateToInbox: (accountId: string) => void;
    onNavigateToOverview: () => void;
    className?: string;
    onCloseMobile?: () => void;
}

export function AppSidebar({
    accounts,
    viewMode,
    selectedAccountId,
    onNavigateToInbox,
    onNavigateToOverview,
    className = "",
    onCloseMobile
}: AppSidebarProps) {
    const { user, logout } = useAuth();
    const router = useRouter();

    const [sidebarSearchQuery, setSidebarSearchQuery] = useState("");
    const [isSidebarSearchOpen, setIsSidebarSearchOpen] = useState(false);

    // Filter Accounts
    const filteredAccounts = accounts.filter(acc =>
        acc.label.toLowerCase().includes(sidebarSearchQuery.toLowerCase()) ||
        acc.email.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
    );

    const handleNavigation = (action: () => void) => {
        action();
        if (onCloseMobile) onCloseMobile();
    };

    return (
        <aside className={`w-full md:w-64 bg-zinc-50 border-r p-4 flex flex-col h-full shrink-0 ${className}`}>
            <div className="flex items-center justify-between mb-6 shrink-0">
                {!isSidebarSearchOpen ? (
                    <>
                        <h2 className="font-bold text-lg tracking-tight flex items-center gap-2">
                            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                                <Mail className="text-white h-4 w-4" />
                            </div>
                            EmailSync
                        </h2>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                setIsSidebarSearchOpen(true);
                            }}
                        >
                            <Search className="h-4 w-4 text-zinc-500" />
                        </Button>
                    </>
                ) : (
                    <div className="flex items-center w-full gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                            <input
                                type="text"
                                autoFocus
                                placeholder="Filter accounts..."
                                value={sidebarSearchQuery}
                                onChange={(e) => setSidebarSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-2 py-1.5 text-sm bg-zinc-100 border-none rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50 text-zinc-900 placeholder:text-zinc-400"
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                        setIsSidebarSearchOpen(false);
                                        setSidebarSearchQuery("");
                                    }
                                }}
                                onBlur={() => {
                                    if (!sidebarSearchQuery) {
                                        setIsSidebarSearchOpen(false);
                                        // Don't clear query immediately on blur to avoid annoyance? 
                                        // Actually original code did this, keeping it consistent.
                                    }
                                }}
                            />
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 hover:bg-zinc-200"
                            onClick={() => {
                                setIsSidebarSearchOpen(false);
                                setSidebarSearchQuery("");
                            }}
                        >
                            <span className="sr-only">Close search</span>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="h-4 w-4 text-zinc-500"
                            >
                                <path d="M18 6 6 18" />
                                <path d="m6 6 12 12" />
                            </svg>
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-2">
                {/* Overview Tab */}
                <button
                    onClick={() => handleNavigation(onNavigateToOverview)}
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

                {filteredAccounts.length === 0 && sidebarSearchQuery && (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                        No accounts found
                    </div>
                )}

                {filteredAccounts.map((account) => (
                    <div
                        key={account.id}
                        className={`group flex items-center w-full rounded-md transition-colors ${viewMode === "mailbox" && selectedAccountId === account.id
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-zinc-200/50 text-zinc-700"
                            }`}
                    >
                        <button
                            onClick={() => handleNavigation(() => onNavigateToInbox(account.id))}
                            className="flex-1 flex items-center space-x-3 px-3 py-2 text-sm min-w-0"
                        >
                            <Mail className="h-4 w-4 shrink-0 opacity-70" />
                            <div className="flex-1 text-left truncate">
                                <p className="truncate">{account.label}</p>
                            </div>
                        </button>
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
    );
}
