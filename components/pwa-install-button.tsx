"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";

export function PWAInstallButton() {
    const [promptInstall, setPromptInstall] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setPromptInstall(e);
        };

        window.addEventListener("beforeinstallprompt", handler);

        // Check if already in standalone mode
        if (window.matchMedia("(display-mode: standalone)").matches) {
            setIsInstalled(true);
        }

        return () => window.removeEventListener("beforeinstallprompt", handler);
    }, []);

    const handleInstallClick = () => {
        if (!promptInstall) {
            return;
        }
        promptInstall.prompt();
        promptInstall.userChoice.then((choiceResult: any) => {
            if (choiceResult.outcome === "accepted") {
                toast.success("Installing application...");
            }
            setPromptInstall(null);
        });
    };

    if (!promptInstall || isInstalled) {
        return null;
    }

    return (
        <Button
            variant="outline"
            size="sm"
            className="w-full justify-start text-primary hover:text-primary hover:bg-primary/10 mb-1"
            onClick={handleInstallClick}
        >
            <Download className="h-4 w-4 mr-2" />
            Install App
        </Button>
    );
}
