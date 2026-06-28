# Contributing to Codor 🚀

Thank you for your interest in contributing to Codor! We welcome contributions from the community to help make Codor the best local-first DevOps AI agent.

As an open-source project licensed under the **GNU General Public License v3.0 (GPL-3.0)**, any contributions you make will also be licensed under the same terms.

---

## 🛠️ Development Prerequisites

To set up your local development environment, you will need:

1. **Node.js**: LTS version (v18 or higher is recommended) with `npm`.
2. **Rust**: The Rust toolchain (v1.75 or higher). You can install it via [rustup](https://rustup.rs/).
3. **OS-specific dependencies** (mainly for Tauri development):
   - **macOS**: Xcode Command Line Tools (`xcode-select --install`).
   - **Windows**: C++ Build Tools (via Visual Studio Installer).
   - **Linux**: Build essentials and webkit dependencies. Run:
     ```bash
     sudo apt-get update
     sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
     ```

For a detailed setup guide, refer to the [Tauri Prerequisites Guide](https://tauri.app/start/prerequisites/).

---

## 🚀 Setting Up the Project

Follow these steps to run Codor locally:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/codor-dev/codor.git
   cd codor
   ```

2. **Install frontend dependencies**:
   ```bash
   npm install
   ```

3. **Run in development mode**:
   ```bash
   npm run tauri dev
   ```
   This will boot up Vite for the frontend and compile/run the Rust backend. Any changes to the frontend or Rust code will automatically trigger a reload or recompile.

4. **Build the application locally**:
   ```bash
   npm run tauri build
   ```
   The built artifacts (DMG/App for macOS, MSI/EXE for Windows) will be generated inside the `src-tauri/target/release/bundle/` directory.

---

## 📁 Repository Structure

- `src/`: React frontend source code (TypeScript, Tailwind CSS, Lucide icons).
  - `src/components/`: Reusable UI components.
  - `src/hooks/`: Custom React hooks.
  - `src/pages/`: Main application pages (Chat, Vault, Backups, etc.).
- `src-tauri/`: Tauri backend source code (Rust).
  - `src-tauri/src/`: Rust source files and command handlers.
  - `src-tauri/tauri.conf.json`: Tauri configuration (app permissions, window size, build scripts).
  - `src-tauri/Cargo.toml`: Rust dependency manager.

---

## 🤝 Contribution Process

1. **Search for existing issues**: Before starting work, check the issues page. If you are fixing a bug or adding a feature that doesn't have an issue yet, please create one first.
2. **Fork the repository** and create a branch for your work:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b bugfix/your-bugfix-name
   ```
3. **Make your changes**. Please ensure your code adheres to standard formatting:
   - Run `npm run build` to make sure TypeScript compiles successfully.
   - Run `cargo check` in `src-tauri` to verify Rust code compiles.
4. **Commit your changes** with a clear commit message.
5. **Push to your fork** and submit a Pull Request (PR) against the `main` branch.

## 📝 Pull Request Guidelines

- Provide a clear explanation of what the PR changes or fixes.
- Ensure the app successfully builds (`npm run tauri build`).
- Update relevant documentation if you add new features or modify existing behaviors.
- Be responsive to feedback and reviews.

Thanks again for contributing to Codor! 💻
