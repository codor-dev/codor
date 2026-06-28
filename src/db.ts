import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';

let dbInstance: Database | null = null;

// --- Secret storage (OS keychain via Rust) -------------------------------
// Secrets are never persisted in SQLite. They live in the OS keychain and are
// only read back into Rust at execution time. The `openrouter_key` setting and
// every vault credential's secret are stored under their own keychain entry.

export async function setSecret(key: string, value: string): Promise<void> {
  await invoke('vault_set_secret', { key, value });
}

export async function getSecret(key: string): Promise<string> {
  return await invoke<string>('vault_get_secret', { key });
}

export async function deleteSecret(key: string): Promise<void> {
  await invoke('vault_delete_secret', { key });
}

// One-time migration: move any secrets that older versions stored in plaintext
// SQLite into the OS keychain, then blank them out of the database.
async function migratePlaintextSecrets(db: Database): Promise<void> {
  try {
    const creds = await db.select<{ id: string; secret_value: string | null }[]>(
      "SELECT id, secret_value FROM vault_credentials WHERE secret_value IS NOT NULL AND secret_value != ''"
    );
    for (const c of creds) {
      await setSecret(c.id, c.secret_value as string);
      await db.execute("UPDATE vault_credentials SET secret_value = '' WHERE id = $1", [c.id]);
    }

    const keyRows = await db.select<{ value: string }[]>(
      "SELECT value FROM settings WHERE key = 'openrouter_key' AND value IS NOT NULL AND value != ''"
    );
    if (keyRows.length > 0) {
      await setSecret('openrouter_key', keyRows[0].value);
      await db.execute("DELETE FROM settings WHERE key = 'openrouter_key'");
    }
  } catch (e) {
    console.error('Secret migration skipped:', e);
  }
}

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;
  try {
    dbInstance = await Database.load('sqlite:codor_history.db');
    
    await dbInstance.execute(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY, 
        title TEXT, 
        created_at INTEGER
      )
    `);
    
    await dbInstance.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY, 
        chat_id TEXT, 
        role TEXT, 
        content TEXT, 
        tool_calls TEXT, 
        created_at INTEGER
      )
    `);

    await dbInstance.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);

    await dbInstance.execute(`
      CREATE TABLE IF NOT EXISTS vault_credentials (
        id TEXT PRIMARY KEY,
        name TEXT,
        llm_description TEXT,
        secret_value TEXT,
        created_at INTEGER
      )
    `);

    await dbInstance.execute(`
      CREATE TABLE IF NOT EXISTS command_filters (
        id TEXT PRIMARY KEY,
        pattern TEXT UNIQUE,
        description TEXT,
        created_at INTEGER
      )
    `);

    await dbInstance.execute(`
      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        system_prompt TEXT,
        is_enabled INTEGER DEFAULT 1,
        created_at INTEGER
      )
    `);

    await dbInstance.execute(`
      CREATE TABLE IF NOT EXISTS backups (
        id TEXT PRIMARY KEY,
        filepath TEXT,
        original_path TEXT,
        description TEXT,
        created_at INTEGER
      )
    `);

    const countRows = await dbInstance.select<{cnt: number}[]>('SELECT count(*) as cnt FROM command_filters');
    if (countRows.length > 0 && countRows[0].cnt === 0) {
      const defaults = [
        { id: 'f1', pattern: 'rm -rf /', description: 'Blocks recursive root deletion' },
        { id: 'f2', pattern: 'mkfs', description: 'Blocks filesystem drive formatting' },
        { id: 'f3', pattern: 'dd if=', description: 'Blocks direct low-level disk overwrite' },
        { id: 'f4', pattern: ':(){ :|:& };:', description: 'Blocks bash fork bomb' },
      ];
      for (const d of defaults) {
        await dbInstance.execute('INSERT OR IGNORE INTO command_filters (id, pattern, description, created_at) VALUES ($1, $2, $3, $4)', [d.id, d.pattern, d.description, Date.now()]);
      }
    }

    const countSkills = await dbInstance.select<{cnt: number}[]>('SELECT count(*) as cnt FROM skills');
    if (countSkills.length > 0 && countSkills[0].cnt === 0) {
      const defaultSkills = [
        {
          id: 's1',
          name: 'Docker Management',
          description: 'Docker containers operations and multi-stage build guidance',
          system_prompt: 'When working with Docker:\n- Check if a container with the same name exists before starting new runs.\n- Prefer multi-stage builds for compact images.\n- Bind host ports securely and specify restart policies like --restart unless-stopped.'
        },
        {
          id: 's2',
          name: 'Google Cloud Platform (GCP)',
          description: 'Managing gcloud SDK commands, project contexts, and compute resources',
          system_prompt: 'When managing Google Cloud Platform:\n- Use the `gcloud` CLI SDK tools.\n- Always specify the target project using the `--project` flag.\n- Default to cost-effective machine types (like e2-micro or e2-medium) for VM creation.'
        },
        {
          id: 's3',
          name: 'System Health & Performance',
          description: 'Linux/macOS resource monitoring, diagnostics, and profiling stats',
          system_prompt: 'When diagnosing system performance:\n- Check CPU load using `top` or `htop` commands.\n- Verify memory usage with `free -m` or `vm_stat`.\n- Review disk usage using `df -h` and identify heavy logs/directories before restarts.'
        }
      ];
      for (const s of defaultSkills) {
        await dbInstance.execute('INSERT INTO skills (id, name, description, system_prompt, is_enabled, created_at) VALUES ($1, $2, $3, $4, $5, $6)', [s.id, s.name, s.description, s.system_prompt, 1, Date.now()]);
      }
    }

    await migratePlaintextSecrets(dbInstance);

    return dbInstance;
  } catch (e) {
    console.error("CRITICAL SECURITY ERROR: Failed to load secure SQLite database:", e);
    throw new Error(`SECURITY ALERT: Secure Database failed to load. Execution stopped to protect sensitive data. Error: ${e}`);
  }
}

export async function checkDbHealth(): Promise<{ ok: boolean; error?: string }> {
  try {
    const db = await getDb();
    await db.select('SELECT 1');
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.toString() || "Unknown SQLite connection error" };
  }
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: number;
}

export async function createChat(title: string = "New Chat"): Promise<ChatSession> {
  const db = await getDb();
  const id = Date.now().toString();
  await db.execute('INSERT INTO chats (id, title, created_at) VALUES ($1, $2, $3)', [id, title, Date.now()]);
  return { id, title, created_at: Date.now() };
}

export async function getChats(): Promise<ChatSession[]> {
  const db = await getDb();
  return await db.select<ChatSession[]>('SELECT * FROM chats ORDER BY created_at DESC');
}

export async function deleteChat(id: string) {
  const db = await getDb();
  await db.execute('DELETE FROM messages WHERE chat_id = $1', [id]);
  await db.execute('DELETE FROM chats WHERE id = $1', [id]);
}

export async function getMessages(chatId: string): Promise<any[]> {
  const db = await getDb();
  const rows = await db.select<any[]>('SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC', [chatId]);
  return rows.map(r => ({
    id: r.id,
    role: r.role,
    content: r.content,
    toolCalls: r.tool_calls ? JSON.parse(r.tool_calls) : undefined
  }));
}

export async function saveMessage(chatId: string, msg: any) {
  const db = await getDb();
  const toolCallsStr = msg.toolCalls ? JSON.stringify(msg.toolCalls) : null;
  await db.execute(
    'INSERT INTO messages (id, chat_id, role, content, tool_calls, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [msg.id, chatId, msg.role, msg.content || '', toolCallsStr, Date.now()]
  );
}

export async function updateChatTitle(chatId: string, title: string) {
  const db = await getDb();
  await db.execute('UPDATE chats SET title = $1 WHERE id = $2', [title, chatId]);
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{value: string}[]>('SELECT value FROM settings WHERE key = $1', [key]);
  return rows.length > 0 ? rows[0].value : null;
}

export async function setSetting(key: string, value: string) {
  const db = await getDb();
  await db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES ($1, $2)', [key, value]);
}

// The API key is a secret and lives in the OS keychain, not in SQLite.
export async function getApiKey(): Promise<string> {
  return await getSecret('openrouter_key');
}

export async function setApiKey(value: string): Promise<void> {
  await setSecret('openrouter_key', value);
}

export interface VaultCredential {
  id: string;
  name: string;
  llm_description: string;
  // Only present when creating a credential. It is written to the OS keychain
  // and never read back into JS — listings omit it.
  secret_value?: string;
}

export async function getVaultCredentials(): Promise<VaultCredential[]> {
  const db = await getDb();
  return await db.select<VaultCredential[]>('SELECT id, name, llm_description FROM vault_credentials ORDER BY created_at ASC');
}

export async function addVaultCredential(cred: VaultCredential) {
  const db = await getDb();
  // Secret goes to the OS keychain; only metadata is persisted in SQLite.
  await setSecret(cred.id, cred.secret_value ?? '');
  await db.execute(
    'INSERT INTO vault_credentials (id, name, llm_description, secret_value, created_at) VALUES ($1, $2, $3, $4, $5)',
    [cred.id, cred.name, cred.llm_description, '', Date.now()]
  );
}

export async function deleteVaultCredential(id: string) {
  const db = await getDb();
  await db.execute('DELETE FROM vault_credentials WHERE id = $1', [id]);
  await deleteSecret(id);
}

export interface CommandFilter {
  id: string;
  pattern: string;
  description: string;
}

export async function getCommandFilters(): Promise<CommandFilter[]> {
  const db = await getDb();
  return await db.select<CommandFilter[]>('SELECT id, pattern, description FROM command_filters ORDER BY created_at DESC');
}

export async function addCommandFilter(pattern: string, description: string): Promise<CommandFilter> {
  const db = await getDb();
  const id = Date.now().toString();
  await db.execute('INSERT INTO command_filters (id, pattern, description, created_at) VALUES ($1, $2, $3, $4)', [id, pattern, description, Date.now()]);
  return { id, pattern, description };
}

export async function deleteCommandFilter(id: string) {
  const db = await getDb();
  await db.execute('DELETE FROM command_filters WHERE id = $1', [id]);
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  is_enabled: number;
}

export async function getSkills(): Promise<Skill[]> {
  const db = await getDb();
  return await db.select<Skill[]>('SELECT id, name, description, system_prompt, is_enabled FROM skills ORDER BY created_at ASC');
}

export async function addSkill(name: string, description: string, systemPrompt: string): Promise<Skill> {
  const db = await getDb();
  const id = Date.now().toString();
  await db.execute(
    'INSERT INTO skills (id, name, description, system_prompt, is_enabled, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [id, name, description, systemPrompt, 1, Date.now()]
  );
  return { id, name, description, system_prompt: systemPrompt, is_enabled: 1 };
}

export async function deleteSkill(id: string) {
  const db = await getDb();
  await db.execute('DELETE FROM skills WHERE id = $1', [id]);
}

export async function toggleSkill(id: string, isEnabled: boolean) {
  const db = await getDb();
  await db.execute('UPDATE skills SET is_enabled = $1 WHERE id = $2', [isEnabled ? 1 : 0, id]);
}

export interface BackupRecord {
  id: string;
  filepath: string;
  original_path: string;
  description: string;
  created_at: number;
}

export async function getBackups(): Promise<BackupRecord[]> {
  const db = await getDb();
  return await db.select<BackupRecord[]>('SELECT id, filepath, original_path, description, created_at FROM backups ORDER BY created_at DESC');
}

export async function addBackupRecord(filepath: string, originalPath: string, description: string) {
  const db = await getDb();
  const id = Date.now().toString();
  await db.execute(
    'INSERT INTO backups (id, filepath, original_path, description, created_at) VALUES ($1, $2, $3, $4, $5)',
    [id, filepath, originalPath, description, Date.now()]
  );
}

export async function deleteBackupRecord(id: string) {
  const db = await getDb();
  await db.execute('DELETE FROM backups WHERE id = $1', [id]);
}
