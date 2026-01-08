import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { decryptPassword } from "@/lib/encryption";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let client: any;
  let totalMessages = 0;

  try {
    const body = await request.json();
    const { account, page = 0 } = body;

    if (!account || !account.encryptedPassword) {
      return NextResponse.json(
        { error: "Missing account configuration" },
        { status: 400 }
      );
    }

    const realPassword = decryptPassword(account.encryptedPassword);

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

    const emails: any[] = [];

    const connectionTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Connection timed out")), 10000)
    );

    try {
      await Promise.race([client.connect(), connectionTimeout]);

      // We must specifically open the inbox
      const mailbox = await client.getMailboxLock("INBOX");

      try {
        totalMessages = client.mailbox.exists || 0;

        // Pagination Logic
        const pageSize = 50;
        // If page 0, end is total. If page 1, end is total - 50.
        // IMAP sequences are 1-based.
        const endSeq = Math.max(1, totalMessages - (page * pageSize));
        const startSeq = Math.max(1, endSeq - pageSize + 1);

        // If start > end (e.g. we fetched everything), return empty
        if (endSeq < 1 || startSeq > endSeq) {
          console.log(`No more messages for ${account.email} (Page ${page})`);
          // return empty emails
        } else {
          const range = `${startSeq}:${endSeq}`;
          console.log(`Fetching page ${page} for ${account.email} (Range: ${range}, Total: ${totalMessages})`);

          // Fetch messages using the calculated range
          for await (const message of client.fetch(range, {
            envelope: true,
            uid: true,
            flags: true
          })) {
            emails.push({
              uid: message.uid,
              subject: message.envelope.subject,
              from: message.envelope.from[0]?.address || "Unknown",
              date: message.envelope.date,
              flags: Array.from(message.flags), // Convert Set to Array for serialization
              account_id: account.id,
            });
          }
        }
      } finally {
        // Make sure to release the lock
        if (mailbox) {
          mailbox.release();
        }
      }
    } catch (err: any) {
      console.error(`IMAP Error for ${account.email}:`, err.message);
      return NextResponse.json({ emails: [], error: err.message });
    } finally {
      if (client) {
        await client.logout();
      }
    }

    // FIX: Handle undefined dates safely for TypeScript
    emails.sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });

    return NextResponse.json({ emails, total: totalMessages });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
// End of file