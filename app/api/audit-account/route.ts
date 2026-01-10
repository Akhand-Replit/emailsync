
import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { decryptPassword } from "@/lib/encryption";
import { GeminiService } from "@/lib/ai-service";
import { decryptApiKey } from "@/app/actions"; // We need to decrypt the key here if it's passed encrypted, or assume client passes raw?
// Actually, it's safer if client passes the encrypted key from store (which is inside the user object usually? No, settings store has it decrypted).
// settings-store has `apiKey` (decrypted) in state. So client will pass the RAW apiKey for this session use. 
// OR, we can fetch it from DB if we trust the userId.
// But simpler: Client passes `apiKey` (string).

export const runtime = "nodejs";
export const maxDuration = 60; // Allow 60 seconds for this function (Vercel hobby limit usually 10s, PRO 60s, checking locally it's fine)

export async function POST(request: Request) {
    let client: any;
    let totalMessages = 0;

    try {
        const body = await request.json();
        const { account, apiKey, messages } = body;

        if (!apiKey) {
            return NextResponse.json(
                { error: "Missing AI API Key" },
                { status: 400 }
            );
        }

        let emailsToAnalyze: any[] = [];

        // MODE A: Client provided specific messages (FAST, No IMAP)
        if (messages && Array.isArray(messages) && messages.length > 0) {
            console.log(`Auditing ${messages.length} provided messages directly.`);
            emailsToAnalyze = messages;
        }
        // MODE B: Fetch from IMAP (Fallback / Server-side fetch)
        else {
            if (!account || !account.encryptedPassword) {
                return NextResponse.json(
                    { error: "Missing account configuration for IMAP fetch" },
                    { status: 400 }
                );
            }

            const realPassword = decryptPassword(account.encryptedPassword);

            // 1. Connect to IMAP
            client = new ImapFlow({
                host: account.host,
                port: account.port,
                secure: account.port === 993,
                auth: {
                    user: account.email,
                    pass: realPassword,
                },
                logger: false,
            });

            // Timeout for connection
            const connectionTimeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Connection timed out")), 15000)
            );

            try {
                await Promise.race([client.connect(), connectionTimeout]);
                const mailbox = await client.getMailboxLock("INBOX");

                try {
                    // Fetch last 100 emails for Audit
                    totalMessages = client.mailbox.exists || 0;
                    const fetchLimit = 100;
                    const startSeq = Math.max(1, totalMessages - fetchLimit + 1);
                    const range = `${startSeq}:*`;

                    console.log(`Auditing ${account.email}, fetching range ${range}`);

                    for await (const message of client.fetch(range, {
                        envelope: true,
                        uid: true,
                    })) {
                        emailsToAnalyze.push({
                            id: message.uid,
                            subject: message.envelope.subject || "(No Subject)",
                            sender: message.envelope.from[0]?.address || "Unknown",
                        });
                    }

                } finally {
                    if (mailbox) mailbox.release();
                }
            } catch (err: any) {
                console.error("IMAP Error:", err);
                return NextResponse.json({ error: "IMAP Connection Failed: " + err.message }, { status: 500 });
            } finally {
                if (client) await client.logout();
            }
        }

        // 2. AI Analysis
        console.log(`Analyzing ${emailsToAnalyze.length} emails...`);
        const service = new GeminiService(apiKey);

        const tags = await service.batchCategorize(emailsToAnalyze);

        // 3. Return Tags
        return NextResponse.json({ tags, count: emailsToAnalyze.length });

    } catch (error: any) {
        console.error("Audit API Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error" },
            { status: 500 }
        );
    }
}
