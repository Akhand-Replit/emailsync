
import DOMPurify from "dompurify";
// We import html2pdf dynamically in the component usually, but here we'll assume it's available or imported
// Since html2pdf.js is a UMD module that attaches to window, we might need to handle it carefully.
// However, the npm package exports it. 
import html2pdf from "html2pdf.js";

// --- EML Parsing Logic (Adapted from User's Code) ---

interface ParsedEmail {
    subject: string;
    from: string;
    to: string;
    date: string;
    html: string | null;
    text: string | null;
}

export function parseEML(raw: string): ParsedEmail {
    // 1. Separate Headers from Body
    const headerEndIndex = raw.indexOf('\r\n\r\n');
    const splitIndex = headerEndIndex !== -1 ? headerEndIndex : raw.indexOf('\n\n');

    let rawHeaders = '';
    let rawBody = '';

    if (splitIndex !== -1) {
        rawHeaders = raw.substring(0, splitIndex);
        rawBody = raw.substring(splitIndex).trim();
    } else {
        rawHeaders = raw;
    }

    // 2. Parse Headers
    const headers: Record<string, string> = {};
    const headerLines = rawHeaders.replace(/\r\n/g, '\n').split('\n');
    let currentKey = '';

    headerLines.forEach(line => {
        if (/^\s/.test(line) && currentKey) {
            headers[currentKey] += ' ' + line.trim();
        } else {
            const match = line.match(/^([\w-]+):\s*(.*)$/);
            if (match) {
                currentKey = match[1].toLowerCase();
                headers[currentKey] = match[2];
            }
        }
    });

    // 3. Extract Metadata
    const subject = decodeHeader(headers['subject']);
    const from = decodeHeader(headers['from']);
    const to = decodeHeader(headers['to']);
    const date = headers['date'] || '';
    const contentType = headers['content-type'] || 'text/plain';

    // 4. Parse Body
    let bodyContent = { text: '', html: '' };

    if (contentType.includes('multipart')) {
        const boundaryMatch = contentType.match(/boundary="?([^"]+)"?/);
        if (boundaryMatch) {
            const boundary = boundaryMatch[1];
            // Fix: The split logic needs to start after the first boundary occurrence
            // Simpler approach: split by --boundary
            const parts = rawBody.split('--' + boundary);

            parts.forEach(part => {
                if (part.includes('Content-Type:')) {
                    if (part.includes('text/html')) {
                        bodyContent.html = extractPartBody(part);
                    } else if (part.includes('text/plain') && !bodyContent.text) {
                        bodyContent.text = extractPartBody(part);
                    }
                }
            });
        }
    } else {
        if (contentType.includes('text/html')) {
            bodyContent.html = decodeBody(rawBody, headers['content-transfer-encoding']);
        } else {
            bodyContent.text = decodeBody(rawBody, headers['content-transfer-encoding']);
        }
    }

    // Fallback if no HTML found but Text exists
    if (!bodyContent.html && bodyContent.text) {
        bodyContent.html = `<pre style="white-space: pre-wrap; font-family: sans-serif;">${bodyContent.text}</pre>`;
    }

    return {
        subject,
        from,
        to,
        date,
        html: bodyContent.html || null,
        text: bodyContent.text || null
    };
}

function extractPartBody(part: string) {
    const splitMatch = part.match(/(\r\n\r\n|\n\n)/);
    if (!splitMatch) return '';

    const bodyStart = splitMatch.index! + splitMatch[0].length;
    let body = part.substring(bodyStart);

    const encodingMatch = part.match(/Content-Transfer-Encoding:\s*([a-zA-Z0-9-]+)/i);
    const encoding = encodingMatch ? encodingMatch[1] : '';

    body = body.replace(/--$/, '').trim();
    return decodeBody(body, encoding);
}

function decodeHeader(str: string) {
    if (!str) return '';
    return str.replace(/=\?([a-zA-Z0-9-]+)\?([BQ])\?([^\?]+)\?=/g, (match, charset, encoding, text) => {
        if (encoding.toUpperCase() === 'B') {
            try {
                // Node/Browser compatible decoding
                return atob(text);
            } catch (e) { return text; }
        } else if (encoding.toUpperCase() === 'Q') {
            return decodeQuotedPrintable(text.replace(/_/g, ' '));
        }
        return text;
    });
}

function decodeBody(str: string, encoding: string) {
    if (!encoding) return str;
    encoding = encoding.toLowerCase();

    if (encoding === 'base64') {
        try {
            return decodeURIComponent(escape(atob(str.replace(/\s/g, ''))));
        } catch (e) {
            // Fallback
            try { return atob(str.replace(/\s/g, '')); } catch { return str; }
        }
    } else if (encoding === 'quoted-printable') {
        return decodeQuotedPrintable(str);
    }
    return str;
}

function decodeQuotedPrintable(str: string) {
    let result = str.replace(/=\r?\n/g, '');
    result = result.replace(/=([0-9A-F]{2})/gi, (match, hex) => {
        return String.fromCharCode(parseInt(hex, 16));
    });
    return result;
}

// --- PDF Generation ---

export async function generatePDF(parsed: ParsedEmail) {
    // Create a temporary container for rendering
    const element = document.createElement('div');
    element.style.width = '210mm'; // A4 width
    element.style.padding = '20mm';
    element.style.backgroundColor = 'white';

    let safeHTML = DOMPurify.sanitize(parsed.html || parsed.text || '<p>No content</p>');

    // FIX: html2canvas crashes on 'lab()' colors (often found in modern email CSS).
    // We replace them with a safe fallback (transparent or generic color) to prevent the crash.
    // This uses a regex to find lab(...) patterns and replace them.
    safeHTML = safeHTML.replace(/lab\s*\([^)]+\)/gi, 'rgba(0,0,0,0)');
    safeHTML = safeHTML.replace(/lch\s*\([^)]+\)/gi, 'rgba(0,0,0,0)'); // lch is also often unsupported

    element.innerHTML = `
      <div style="font-family: sans-serif; color: #333;">
          <div style="border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px;">
              <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 15px;">${parsed.subject || '(No Subject)'}</h1>
              <div style="font-size: 14px; line-height: 1.6;">
                  <div><strong>From:</strong> ${parsed.from}</div>
                  <div><strong>To:</strong> ${parsed.to}</div>
                  <div><strong>Date:</strong> ${parsed.date}</div>
              </div>
          </div>
          <div class="email-body">
              ${safeHTML}
          </div>
          <div style="margin-top: 40px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 10px;">
              Converted by EmailSync on ${new Date().toLocaleDateString()}
          </div>
      </div>
  `;

    const opt = {
        margin: 0,
        filename: `${(parsed.subject || 'email').substring(0, 30)}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
    };

    try {
        await html2pdf().set(opt).from(element).save();
    } catch (err) {
        console.error("PDF Generation Error", err);
        throw err;
    }
}
