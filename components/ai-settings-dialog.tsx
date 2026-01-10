"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettingsStore } from "@/lib/store/settings-store";
import { useAuth } from "@/components/auth-provider";
import { toast } from "sonner";
import { Loader2, Settings2, Key, Globe } from "lucide-react";

export function AISettingsDialog() {
    const [open, setOpen] = useState(false);
    const [inputKey, setInputKey] = useState("");
    const { user } = useAuth();
    const {
        apiKey,
        outputLanguage,
        isLoading,
        saveSettings,
        loadSettings,
        setLanguage: setStoreLanguage
    } = useSettingsStore();

    // Load settings when the dialog opens, if user is present
    useEffect(() => {
        if (open && user && !apiKey) {
            // If no key in store, load it. If key exists, it might be cached.
            loadSettings(user.uid);
        }
    }, [open, user, loadSettings, apiKey]);

    // Sync local input with store state when it changes (e.g. after load)
    useEffect(() => {
        if (apiKey) setInputKey(apiKey);
    }, [apiKey]);

    const handleSave = async () => {
        if (!user) return;
        if (!inputKey.trim()) {
            toast.error("API Key is required");
            return;
        }

        try {
            await saveSettings(user.uid, inputKey, outputLanguage);
            toast.success("AI Settings Saved Successfully");
            setOpen(false);
            // Clear input logic if needed, but keeping it is fine
        } catch (error) {
            toast.error("Failed to save settings. Please try again.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-8 w-8 md:h-9 md:w-auto p-0 md:px-4">
                    <Settings2 className="w-4 h-4" />
                    <span className="hidden md:inline">AI Settings</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>AI Integration Settings</DialogTitle>
                    <DialogDescription>
                        Configure your Gemini API Key to enable AI features.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* API Key Section */}
                    <div className="grid gap-2">
                        <Label htmlFor="api-key" className="flex items-center gap-2">
                            <Key className="w-4 h-4" /> Gemini API Key
                        </Label>
                        <Input
                            id="api-key"
                            value={inputKey}
                            onChange={(e) => setInputKey(e.target.value)}
                            placeholder="sk-..."
                            type="password"
                        />
                        <p className="text-[0.8rem] text-muted-foreground">
                            Your key is encrypted on the server before storage.
                            <br />
                            Get a key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline text-primary">Google AI Studio</a>.
                        </p>
                    </div>

                    {/* Language Section */}
                    <div className="grid gap-2">
                        <Label className="flex items-center gap-2">
                            <Globe className="w-4 h-4" /> Output Language
                        </Label>
                        <Select value={outputLanguage} onValueChange={setStoreLanguage}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select Language" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="English">English</SelectItem>
                                <SelectItem value="Spanish">Spanish</SelectItem>
                                <SelectItem value="French">French</SelectItem>
                                <SelectItem value="German">German</SelectItem>
                                <SelectItem value="Chinese">Chinese</SelectItem>
                                <SelectItem value="Japanese">Japanese</SelectItem>
                                <SelectItem value="Portuguese">Portuguese</SelectItem>
                                <SelectItem value="Bangla">Bangla (বাংলা)</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-[0.8rem] text-muted-foreground">
                            Summaries and categories will be generated in this language.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button onClick={handleSave} disabled={isLoading} className="w-full sm:w-auto">
                        {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Save Configuration
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
