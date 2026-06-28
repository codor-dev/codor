use tauri::Manager;

/// Service namespace used for all OS-keychain entries created by Codor.
const KEYRING_SERVICE: &str = "com.codor.desktop";

fn compress_dir(src_dir: &std::path::Path, dst_tar_gz: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
    use std::fs::File;
    use flate2::write::GzEncoder;
    use flate2::Compression;
    use tar::Builder;

    let tar_gz = File::create(dst_tar_gz)?;
    let enc = GzEncoder::new(tar_gz, Compression::default());
    let mut tar = Builder::new(enc);
    tar.append_dir_all(".", src_dir)?;
    tar.finish()?;
    Ok(())
}

/// Collapse all runs of whitespace into a single space so simple obfuscation
/// like `rm  -rf  /` (extra spaces, tabs, newlines) can't slip past a filter.
fn normalize(input: &str) -> String {
    input.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Run the active database-defined security filters against a command.
///
/// This is **fail-closed**: if the secure database can't be opened or queried,
/// the command is rejected rather than allowed through. The deny-list is a
/// secondary safety net only — the primary protection is explicit user approval
/// in the UI before any command is dispatched here.
fn enforce_filters(app: &tauri::AppHandle, command: &str) -> Result<(), String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("🚫 SECURITY: cannot resolve app data dir: {}", e))?;
    let db_path = app_dir.join("codor_history.db");

    if !db_path.exists() {
        return Err(
            "🚫 SECURITY: secure database not found; refusing to execute (fail-closed).".to_string(),
        );
    }

    let conn = rusqlite::Connection::open(&db_path)
        .map_err(|e| format!("🚫 SECURITY: failed to open secure database: {}", e))?;

    let mut stmt = conn
        .prepare("SELECT pattern, description FROM command_filters")
        .map_err(|e| format!("🚫 SECURITY: failed to prepare filter query: {}", e))?;

    let filter_rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| format!("🚫 SECURITY: failed to query command filters: {}", e))?;

    let normalized_cmd = normalize(command);

    for filter_result in filter_rows {
        let (pattern, description) =
            filter_result.map_err(|e| format!("🚫 SECURITY: failed to read filter row: {}", e))?;
        if normalized_cmd.contains(&normalize(&pattern)) {
            return Err(format!(
                "🚫 SECURITY ALERT: Command blocked by active Security Filter '{}' ({}). Execution stopped.",
                pattern, description
            ));
        }
    }

    Ok(())
}

#[tauri::command]
fn execute_ai_command(
    app: tauri::AppHandle,
    command: &str,
    credential_id: &str,
) -> Result<String, String> {
    // 1. Enforce database-defined security filters (fail-closed).
    enforce_filters(&app, command)?;

    // 2. Resolve the connection target from the OS keychain. The secret never
    //    crosses into the JS/renderer side — it is read here in Rust only.
    let target = if credential_id.is_empty() {
        String::new()
    } else {
        let entry = keyring::Entry::new(KEYRING_SERVICE, credential_id)
            .map_err(|e| format!("Failed to open keychain entry: {}", e))?;
        match entry.get_password() {
            Ok(v) => v.trim().to_string(),
            Err(keyring::Error::NoEntry) => String::new(),
            Err(e) => return Err(format!("Failed to read credential from keychain: {}", e)),
        }
    };

    // 3. SSH execution when the target looks like `user@host`.
    if target.contains('@') {
        let mut parts = target.splitn(2, '@');
        let user = parts.next().unwrap_or("").trim();
        let host = parts.next().unwrap_or("").trim();
        if user.is_empty() || host.is_empty() {
            return Err("Invalid SSH target: expected 'user@host'.".to_string());
        }

        let output = std::process::Command::new("ssh")
            // `accept-new` trusts unknown hosts on first contact but still
            // detects key changes afterwards (protects against later MITM),
            // unlike the previous `no` which disabled checking entirely.
            .arg("-o")
            .arg("StrictHostKeyChecking=accept-new")
            .arg("-o")
            .arg("ConnectTimeout=6")
            .arg(format!("{}@{}", user, host))
            .arg(command)
            .output();

        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                if out.status.success() {
                    Ok(stdout)
                } else {
                    Err(format!("SSH Error (Code {}):\nStdout: {}\nStderr: {}", out.status, stdout, stderr))
                }
            }
            Err(e) => Err(format!("Failed to spawn local ssh process: {}", e)),
        }
    } else if target.eq_ignore_ascii_case("local") || target.eq_ignore_ascii_case("localhost") {
        // 4. Explicit opt-in for local execution. We never silently fall back to
        //    running on the host machine when a credential is missing/wrong.
        let shell = if cfg!(target_os = "windows") { "cmd" } else { "sh" };
        let arg = if cfg!(target_os = "windows") { "/C" } else { "-c" };

        let output = std::process::Command::new(shell)
            .arg(arg)
            .arg(command)
            .output();

        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                if out.status.success() {
                    Ok(stdout)
                } else {
                    Err(format!("Local Execution Error (Code {}):\nStdout: {}\nStderr: {}", out.status, stdout, stderr))
                }
            }
            Err(e) => Err(format!("Failed to execute local host command: {}", e)),
        }
    } else {
        Err(
            "No valid target for this credential. Set the secret to 'user@host' for SSH, or exactly 'local' to run on this machine.".to_string(),
        )
    }
}

#[tauri::command]
fn execute_backup(original_path: &str, _description: &str) -> Result<String, String> {
    use std::fs;
    use std::path::Path;
    use std::time::{SystemTime, UNIX_EPOCH};

    let original = Path::new(original_path);
    if !original.exists() {
        return Err(format!("Source path '{}' does not exist.", original_path));
    }

    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Could not determine home directory".to_string())?;

    let backups_dir = Path::new(&home).join(".codor_backups");
    if !backups_dir.exists() {
        fs::create_dir_all(&backups_dir).map_err(|e| format!("Failed to create backups directory: {}", e))?;
    }

    // Millisecond precision avoids collisions when two backups of the same
    // file happen within the same second.
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("System clock error: {}", e))?
        .as_millis();

    let file_name = original
        .file_name()
        .ok_or_else(|| "Invalid file name".to_string())?
        .to_string_lossy();

    if original.is_dir() {
        let archive_path = backups_dir.join(format!("{}_{}.tar.gz", timestamp, file_name));
        match compress_dir(original, &archive_path) {
            Ok(_) => Ok(archive_path.to_string_lossy().into_owned()),
            Err(e) => Err(format!("Tar compression failed: {}", e)),
        }
    } else {
        let backup_path = backups_dir.join(format!("{}_{}", timestamp, file_name));
        fs::copy(original, &backup_path).map_err(|e| format!("File copy failed: {}", e))?;
        Ok(backup_path.to_string_lossy().into_owned())
    }
}

/// Store a secret (vault credential or API key) in the OS keychain.
#[tauri::command]
fn vault_set_secret(key: &str, value: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, key)
        .map_err(|e| format!("Failed to open keychain entry: {}", e))?;
    entry
        .set_password(value)
        .map_err(|e| format!("Failed to store secret: {}", e))
}

/// Read a secret from the OS keychain. Returns an empty string when absent.
#[tauri::command]
fn vault_get_secret(key: &str) -> Result<String, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, key)
        .map_err(|e| format!("Failed to open keychain entry: {}", e))?;
    match entry.get_password() {
        Ok(v) => Ok(v),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(e) => Err(format!("Failed to read secret: {}", e)),
    }
}

/// Delete a secret from the OS keychain. No-op if it doesn't exist.
#[tauri::command]
fn vault_delete_secret(key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, key)
        .map_err(|e| format!("Failed to open keychain entry: {}", e))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Failed to delete secret: {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            execute_ai_command,
            execute_backup,
            vault_set_secret,
            vault_get_secret,
            vault_delete_secret
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
