# Codor 🚀

**Codor** is an elite, local-first DevOps AI Infrastructure Agent designed to manage local host environments and remote servers securely. Built as a native desktop application using **Tauri, Rust, React, and TypeScript**, Codor operates directly from your local machine, keeping your credentials, keys, and source code under your complete control.

---

## 🔑 Core Pillars

### 1. Local-First Security Architecture
Unlike web-hosted platforms, Codor saves all conversation histories, settings, command safety configurations, and API keys inside a **secure local SQLite database** on your machine. No data or credentials ever touch third-party cloud database servers.

### 2. Context-Isolated Vault Credentials
Connect to your remote servers securely. The **Vault** maps your servers, SSH identities, and GCP/AWS tokens. The LLM only sees the descriptive metadata of a credential (e.g., *"[ID: staging-srv] Webito Staging Server"*). When executing a command, the secure Tauri Rust backend retrieves the credentials locally to run the SSH tunnel. **The LLM never sees your actual secrets.**

### 3. DevOps Specialization Skills Manager
Inject specialized expertise into Codor's intelligence system. Enable or disable default skills or add custom rules for **Docker, GCP, Kubernetes, Terraform**, and database environments. Enabled skills are injected dynamically into the LLM system prompt.

### 4. Active Safety Command Filters
Codor protects your environments from dangerous commands. It intercepts terminal calls against a local list of blocked patterns (such as `rm -rf /`, `dd if=`, filesystem formatting `mkfs`, or fork bombs).

### 5. Automated Local Backups
Codor acts defensively. Before executing commands that modify system settings or delete directories, Codor uses the native `create_backup` tool to compress and archive targets inside `~/.codor_backups/` and logs them in your **Backup History** dashboard.

### 6. Real-Time Token Circle Progress Bar & Limits
Codor tracks context token usage in real-time. An SVG circular progress ring updates live. If the context window fills up, Codor prevents further API calls and prompts you to **Compact History**, which safely compresses your conversation thread to save context tokens.

---

## 🛠️ Tech Stack

* **Frontend**: React, TypeScript, Tailwind CSS, Lucide icons, Vite.
* **Backend**: Tauri (Rust), native OS shell interface, SSH agent integrations.
* **Storage**: Tauri Plugin SQL with SQLite.

---

## 📥 Download & Install

You can download pre-built installers for macOS and Windows from the [Releases](https://github.com/codor-dev/codor/releases) page.

> [!WARNING]
> **Unsigned Application Notice**
> Because Codor is an open-source tool and is not signed with paid Apple or Microsoft developer certificates, your OS will display a security warning when opening the app:
> - **macOS**: If you see a *"damaged/unidentified developer"* prompt, right-click (or Control-click) the application icon in your Applications folder and select **Open**, then confirm. Alternatively, run: `xattr -cr /Applications/Codor.app`.
> - **Windows**: If Windows SmartScreen blocks execution, click **More info** on the prompt, then click **Run anyway**.

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

