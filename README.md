# Codor 🚀

Codor is a local-first DevOps agent that manages your servers without your secrets ever leaving your machine.

---

## ## Why I Built This 💡

Codor was born out of necessity. During a critical production server failure with no DevOps engineer available, I had to grant a prototype local AI agent access to my systems. It parsed log files, diagnosed the issues, and orchestrated subserver repairs successfully. The system has run stably ever since. I realized this tool needed to exist—but it had to be designed so that sensitive access credentials and SSH keys would never be sent to a third-party cloud database. Codor was built to bring secure, offline, local-first intelligence to systems operations.

---

## How Secrets Stay Safe 🔒

Unlike typical cloud-based AI assistants that require full access to your environment variables and keys, Codor uses a **Context-Isolated Vault Architecture**:
* **Metadata Masking**: The Large Language Model (LLM) only sees the descriptive metadata of a credential (e.g., *"[ID: staging-srv] Staging Server"*). It never sees your actual passwords, SSH keys, or API tokens.
* **Rust-Secure Execution**: When a command needs to be executed, the secure Tauri Rust backend retrieves the credential locally from your SQLite database, establishes the SSH connection, runs the command, and returns the output to the LLM. 
* **Zero Cloud Leakage**: Your credentials and configuration are saved in a local SQLite database on your machine. No data or secrets ever touch third-party cloud database servers.

---

## 🔑 Core Pillars

1. **Local-First Architecture**: Your conversation history, settings, and credentials are saved in a secure local SQLite database.
2. **DevOps Specialization Skills**: Inject custom guidelines and context for Docker, GCP, Kubernetes, and database operations dynamically into the prompt.
3. **Active Safety Command Filters**: Intercepts dangerous commands (like `rm -rf`, `mkfs`, fork bombs) directly in the secure Rust backend before execution.
4. **Automated Cross-Platform Backups**: Automatically compresses target files/folders into gzip archives before modifications using native Rust libraries.
5. **Real-Time Token Tracking**: Displays token usage inside a live SVG progress ring, reminding you to compact history when context gets full.

---

## 🧠 Supported LLMs

Codor connects to your preferred language models. You can enter your API keys inside the **Settings** tab.
* **OpenRouter**: Provides access to DeepSeek (e.g., `deepseek-chat`), Claude 3.5 Sonnet, GPT-4o, and other top-tier models.

---

## 🏁 Quickstart

Once you launch the app, follow this workflow to get started:

1. **Add a Server to the Vault**:
   Go to the **Vault** tab, click **Add Credential**, and define a label (e.g., `production-db`) and the connection details (e.g., `admin@192.168.1.50` or a secure token).
2. **Set up Command Filters**:
   Go to **Settings -> Safety** and verify your blocked patterns.
3. **Connect and Ask**:
   Open a **New Chat**, and ask the agent:
   > *"Check the disk space on server production-db"*
   The agent will identify the server ID, invoke the secure SSH handler, and print the output.

---

## 📥 Downloads & Security Trust

You can download pre-built installers for macOS and Windows from the [Releases](https://github.com/codor-dev/codor/releases) page.

### 🛡️ Why Trust Codor?
* **Local-First & Audit-Ready**: Because Codor is open-source and operates 100% locally, you can inspect the code, audit the network traffic, and verify that no credentials ever leave your machine.
* **Run from Source**: If you prefer not to use our pre-built installers, you can easily build the binary from source in less than two minutes (see [Local Development](#-local-development) below).
* **Unsigned Installer Bypass**: Because we do not use paid corporate developer certificates, your OS will display a standard warning when running the installer:
  - **macOS**: Right-click Codor in your Applications folder and select **Open**, or run: `xattr -cr /Applications/Codor.app`.
  - **Windows**: Click **More info** on the SmartScreen prompt, then click **Run anyway**.

---

## 🚀 Local Development

To run Codor locally on your system, ensure you have **Node.js** (LTS) and the **Rust** toolchain installed.

1. **Clone & Install Dependencies**:
   ```bash
   git clone https://github.com/codor-dev/codor.git
   cd codor
   npm install
   ```

2. **Run in Dev Mode**:
   ```bash
   npm run tauri dev
   ```

3. **Build Locally**:
   ```bash
   npm run tauri build
   ```

---

## 🛠️ Tech Stack

* **Frontend**: React, TypeScript, Tailwind CSS, Lucide icons, Vite.
* **Backend**: Tauri (Rust), native OS shell interface, SSH agent integrations.
* **Storage**: Tauri Plugin SQL with SQLite.

---

## 🗺️ Future Roadmap

- [ ] **Cloud API Integrations**: Direct credential parsing for AWS CLI, Google Cloud SDK (`gcloud`), and Azure CLI.
- [ ] **Multi-Agent DevOps Orchestrator**: Run multiple agent workers concurrently to monitor server stats and resolve performance issues.
- [ ] **Interactive Visual Terminals**: Side-by-side active shell console widgets rendering stdout/stderr streams.
- [ ] **Self-Healing Log Analyser**: Automated parsing of server audit logs with automatic incident resolution.

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Please read [CONTRIBUTING.md](file:///Users/anette/Desktop/workspace/codor/CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

---

## 📄 License

Codor is distributed under the terms of the **GNU General Public License v3.0 (GPL-3.0)**. See the [LICENSE](file:///Users/anette/Desktop/workspace/codor/LICENSE) file for details.
