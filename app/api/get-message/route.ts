import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
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
      // Hostinger Optimization: Increase timeouts to 30s
      clientTimeout: 30000,
      greetingTimeout: 30000,
    });

    let emailData = null;

    try {
      await client.connect();
      await client.getMailboxLock("INBOX");

      try {
        const messageId = String(uid);

        // Retry mechanism for fetching email (3 attempts)
        let parsed = null;
        let attempts = 0;

        while (attempts < 3 && !parsed) {
          try {
            attempts++;

            // STREAMING STRATEGY: 
            // Use download() to get a stream, then pipe to simpleParser.
            // This avoids buffering the whole file in memory.
            const downloadResult = await client.download(messageId, undefined, { uid: true });

            if (!downloadResult || !downloadResult.content) {
              throw new Error("Failed to download message stream");
            }

            parsed = await simpleParser(downloadResult.content);

          } catch (fetchErr) {
            console.warn(`Fetch attempt ${attempts} failed:`, fetchErr);
            if (attempts >= 3) throw fetchErr;
            // Wait 1s before retry
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        if (!parsed) {
          throw new Error("Email not found on server or could not be parsed");
        }

        emailData = {
          subject: parsed.subject,
          from: parsed.from?.text,
          date: parsed.date,
          html: parsed.html || "",
          text: parsed.textAsHtml || parsed.text || "",
        };

        // Mark as read if found
        try {
          await client.messageFlagsAdd(messageId, ["\\Seen"], { uid: true });
        } catch (flagErr) {
          console.warn("Could not mark as seen:", flagErr);
        }

      } finally {
        // Lock is released on logout
      }
    } catch (err: any) {
      console.error("Fetch Body Error:", err);
      let errorMessage = err.message || "Failed to fetch email";

      if (errorMessage.includes("Command failed")) {
        errorMessage = "Server error: Could not retrieve message content.";
      }

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    } finally {
      await client.logout();
    }

    return NextResponse.json({ email: emailData });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}