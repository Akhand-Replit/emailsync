import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, host, port } = body;

    if (!email || !password || !host || !port) {
      return NextResponse.json(
        { error: "Missing connection details" },
        { status: 400 }
      );
    }

    const client = new ImapFlow({
      host: host,
      port: parseInt(port),
      secure: parseInt(port) === 993,
      auth: {
        user: email,
        pass: password,
      },
      logger: false,
      // Hostinger Optimization
      clientTimeout: 30000,
      greetingTimeout: 30000,
    });

    // Wait for connection or error
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.close();
        reject(new Error("Connection timed out"));
      }, 10000);

      client.connect().then(() => {
        clearTimeout(timeout);
        client.logout();
        resolve();
      }).catch((err: any) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Connection Check Error:", error.message);

    let errorMessage = error.message || "Failed to connect to mail server";

    // Improve error message for common IMAP authentication failures
    if (errorMessage.includes("Command failed") || errorMessage.includes("authentication failed")) {
      errorMessage = "Invalid email or password. Please check your credentials.";
    } else if (errorMessage.includes("ENOTFOUND")) {
      errorMessage = "Could not reach mail server. Check host/port.";
    } else if (errorMessage.includes("Timed out")) {
      errorMessage = "Connection timed out. Check server settings.";
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    );
  }
}