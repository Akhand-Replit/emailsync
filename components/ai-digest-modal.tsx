"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { GeminiService, DigestResult } from "@/lib/ai-service";
import { useSettingsStore } from "@/lib/store/settings-store";
import { Loader2, ShieldAlert, ShoppingCart, Briefcase, Mail, CheckCircle2 } from "lucide-react";
import { toast } from "sonner"; // Assuming sonner is installed

interface AIDigestModalProps {
    isOpen: boolean;
    onClose: () => void;
    unreadEmails: any[];
}

export function AIDigestModal({ isOpen, onClose, unreadEmails }: AIDigestModalProps) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<DigestResult | null>(null);
    const { apiKey } = useSettingsStore();

    useEffect(() => {
        if (isOpen && unreadEmails.length > 0 && !result) {
            runAnalysis();
        }
    }, [isOpen, unreadEmails]);

    const runAnalysis = async () => {
        if (!apiKey) {
            toast.error("AI Settings not configured.");
            onClose();
            return;
        }

        setLoading(true);
        try {
            const service = new GeminiService(apiKey);
            // Map relevant headers
            const headers = unreadEmails.map(e => ({
                subject: e.subject || "",
                sender: e.from || ""
            }));

            // Limit to latest 50 to avoid massive prompt context
            const limitedHeaders = headers.slice(0, 50);

            const stats = await service.generateDigest(limitedHeaders);
            setResult(stats);
        } catch (error) {
            console.error(error);
            toast.error("Failed to generate digest.");
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const total = result ? (result.marketing + result.governmental + result.administrational + result.spam) : 0;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Inbox AI Digest</DialogTitle>
                    <DialogDescription>
                        Analysis of your {unreadEmails.length} unread messages.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center space-y-4 py-8">
                            <Loader2 className="h-10 w-10 text-primary animate-spin" />
                            <p className="text-sm text-muted-foreground">Analyzing your inbox...</p>
                        </div>
                    ) : result ? (
                        <div className="space-y-6">
                            {/* Summary Sentence */}
                            <div className="p-4 bg-zinc-50 rounded-lg border text-center">
                                <p className="text-lg font-medium text-zinc-900">
                                    You have <span className="text-blue-600">{result.marketing} Marketing</span> emails,{' '}
                                    <span className="text-red-600">{result.governmental} Alerts</span>, and{' '}
                                    <span className="text-amber-600">{result.administrational} Admin</span> updates.
                                </p>
                            </div>

                            {/* Categories Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <CategoryCard
                                    label="Governmental"
                                    count={result.governmental}
                                    total={total}
                                    color="bg-red-100 text-red-700"
                                    icon={ShieldAlert}
                                />
                                <CategoryCard
                                    label="Marketing"
                                    count={result.marketing}
                                    total={total}
                                    color="bg-blue-100 text-blue-700"
                                    icon={ShoppingCart}
                                />
                                <CategoryCard
                                    label="Admin"
                                    count={result.administrational}
                                    total={total}
                                    color="bg-amber-100 text-amber-700"
                                    icon={Briefcase}
                                />
                                <CategoryCard
                                    label="Spam / Other"
                                    count={result.spam}
                                    total={total}
                                    color="bg-zinc-100 text-zinc-700"
                                    icon={Mail}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="text-center text-muted-foreground">No data available.</div>
                    )}
                </div>

                <div className="flex justify-end">
                    <Button onClick={onClose}>
                        {loading ? "Cancel" : "Done"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function CategoryCard({ label, count, total, color, icon: Icon }: any) {
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div className={`p-4 rounded-lg border flex flex-col items-center justify-center gap-2 ${color} bg-opacity-50`}>
            <Icon className="h-6 w-6 opacity-80" />
            <div className="text-2xl font-bold">{count}</div>
            <div className="text-xs font-medium uppercase tracking-wider opacity-70">{label}</div>
            {/* Tiny bar */}
            <div className="w-full h-1 bg-black/5 rounded-full mt-1 overflow-hidden">
                <div className="h-full bg-current opacity-50" style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
}
