import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { decryptPassword } from "@/lib/encryption";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        const { account, uid } = await request.json();

        if (!account || !uid) {
            return NextResponse.json({ error: "Missing data" }, { status: 400 });
        }

        const realPassword = decryptPassword(account.encryptedPassword);

        const client = new ImapFlow({
            host: account.host,
            port: account.port,
            secure: account.port === 993,
            auth: {
                user: account.email,
                pass: realPassword,
            },
            logger: false,
        });

        let emlContent = "";

        try {
            await client.connect();
            await client.getMailboxLock("INBOX");

            const messageId = String(uid);

            // Download the raw message source
            const downloadResult = await client.download(messageId, undefined, { uid: true });

            if (!downloadResult) {
                throw new Error("Failed to download message");
            }

            // Convert stream to string
            // Note: For very large emails, we might want to stream this directly to the response,
            // but for client-side PDF generation, we need the text.
            const chunks = [];
            for await (const chunk of downloadResult.content) {
                chunks.push(chunk);
            }
            emlContent = Buffer.concat(chunks).toString('utf-8');

        } catch (err: any) {
            console.error("EML Download Error:", err);
            return NextResponse.json({ error: err.message || "Failed to download EML" }, { status: 500 });
        } finally {
            await client.logout();
        }

        return new NextResponse(emlContent, {
            headers: {
                "Content-Type": "text/plain",
            }
        });

    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
