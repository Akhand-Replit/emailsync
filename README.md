# EmailSync v3.0 - AI Integrated Mobile-Ready Client

**EmailSync** is an advanced, privacy-focused email client application re-engineered for the modern web. This version (v3) introduces powerful **AI capabilities** powered by Google Gemini, improved **mobile responsiveness**, and a robust **Deep Audit** system for batch email analysis.

![EmailSync Dashboard](https://via.placeholder.com/1200x600?text=EmailSync+Dashboard+Preview)

## 🚀 Key Features

### 🧠 AI Intelligence (New)
Powered by **Google Gemini** (Flash Models), EmailSync understands your inbox:
- **Deep Audit**: Batch analyze your emails to automatically categorize them into *Governmental*, *Marketing*, *Spam*, *Administrational*, or *Other*.
- **Smart Tags**: Visual badges allow you to identify urgent governmental or administrational emails at a glance.
- **Inbox Digest**: (Coming Soon) Get an instant summary of your unread emails without opening them.

### 📱 Mobile First (Improved)
- **Responsive Design**: Fully optimized for mobile devices with a dedicated sidebar drawer and touch-friendly controls.
- **PWA Support**: Install as a native app on iOS and Android.
- **Fluid UI**: Built with Shadcn UI for a seamless, app-like experience.

### 📧 Core Functionality
- **Multi-Account Support**: Connect unlimited IMAP/SMTP accounts (Gmail, Outlook, Yahoo, Custom).
- **Secure Architecture**: Your credentials are encrypted locally. 
- **Real-Time Sync**: Background synchronization with visual progress indicators.
- **PDF Export**: Convert any email thread into a beautifully formatted PDF.
- **Dark Mode**: Native support for light and dark themes.

---

## 🛠️ Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **AI Engine**: [Google Gemini API](https://ai.google.dev/) (@google/genai)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components**: [Shadcn UI](https://ui.shadcn.com/) / Radix UI
- **State Management**: Zustand
- **Backend / Auth**: Firebase (Authentication & FireStore)
- **Email Protocols**: `imapflow` & `mailparser`

---

## 📖 Getting Started

Follow these instructions to set up the project locally.

### Prerequisites

- **Node.js 20+** installed.
- **Firebase Project**: You need a Firebase project for authentication.
- **Gemini API Key**: Get one from [Google AI Studio](https://aistudio.google.com/).

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/emailsync-v3.git
    cd emailsync-v3
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Environment Setup:**

    Create a `.env.local` file in the root directory and configure your Firebase credentials:

    ```env
    # Firebase Client Config (Required)
    NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
    
    # Internal Encryption (Optional but Recommended for Production)
    ENCRYPTION_KEY=your_random_32_char_string
    ```

4.  **Run the development server:**

    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) in your browser.

### ⚙️ Configuration

Once the app is running:
1.  **Sign Up/Login**: Create an account using the Firebase Auth flow.
2.  **Add Email Account**: Go to "Manage Accounts" and enter your IMAP/SMTP details.
3.  **Enable AI Features**:
    - Go to **Settings**.
    - Enter your **Gemini API Key**.
    - Save configuration.

---

## 🔍 Deep Audit & AI Usage

The **Deep Audit** feature allows you to clean up and organize your inbox efficiently.

1.  Select an account from the sidebar.
2.  Click the **Deep Audit** button in the header.
3.  Choose your scope:
    - **Fetched Emails**: Analyzes only the emails currently loaded in current view (Fast).
    - **Sync & Audit All**: Performs a deep sync of your entire inbox and analyzes everything (Slower, more comprehensive).
4.  **Review**: Emails will be tagged. *Note: AI can make mistakes, always double-check critical emails (Governmental/Financial).*

---

## 📂 Project Structure

```
/app
  /api              # Next.js API Routes (Server-side IMAP/AI logic)
  /auth             # Authentication pages
  /dashboard        # Main application views
/components
  /ui               # Reusable Shadcn UI components
  /email-view       # Email reading pane & logic
  /app-sidebar      # Navigation & Account switching
/lib
  ai-service.ts     # Gemini AI integration logic
  encryption.ts     # Credential security helpers
  imap-service.ts   # Email fetching logic
```

---

## 🤝 Contribution

Contributions are welcome! Please feel free to submit a Pull Request.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

<div align="center">
  <p>Developed with ❤️ by Mohammad Rafq Shuvo <a href="https://github.com/shuvo-2525">@shuvo-2525</a></p>
  <p>
    <a href="https://nextjs.org">Next.js</a> • 
    <a href="https://firebase.google.com">Firebase</a> • 
    <a href="https://ai.google.dev">Gemini</a>
  </p>
</div>