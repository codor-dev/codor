use tauri::Manager;

/// Service namespace used for all OS-keychain entries created by Codor.
#[cfg(not(debug_assertions))]
const KEYRING_SERVICE: &str = "com.codor.desktop";

// --- Secret store -------------------------------------------------------------
//
// Release builds keep secrets in the OS keychain (stable code signature → no
// repeated prompts). Debug builds can't use the keychain comfortably: each
// `tauri dev` rebuild produces a different code signature, so macOS re-prompts
// for keychain access every time. To keep development friction-free, debug
// builds fall back to a JSON file inside the app's (OS-protected) data dir. This
// file path is never used in shipped binaries.

#[cfg(debug_assertions)]
fn dev_secret_file(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("dev_secrets.json"))
}

#[cfg(debug_assertions)]
fn dev_secret_map(app: &tauri::AppHandle) -> Result<serde_json::Map<String, serde_json::Value>, String> {
    let path = dev_secret_file(app)?;
    if !path.exists() {
        return Ok(serde_json::Map::new());
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(serde_json::from_str(&raw).unwrap_or_default())
}

#[cfg(debug_assertions)]
fn read_secret(app: &tauri::AppHandle, key: &str) -> Result<Option<String>, String> {
    Ok(dev_secret_map(app)?
        .get(key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string()))
}

#[cfg(debug_assertions)]
fn write_secret(app: &tauri::AppHandle, key: &str, value: &str) -> Result<(), String> {
    let mut map = dev_secret_map(app)?;
    map.insert(key.to_string(), serde_json::Value::String(value.to_string()));
    let path = dev_secret_file(app)?;
    std::fs::write(&path, serde_json::to_string_pretty(&map).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

#[cfg(debug_assertions)]
fn remove_secret(app: &tauri::AppHandle, key: &str) -> Result<(), String> {
    let mut map = dev_secret_map(app)?;
    map.remove(key);
    let path = dev_secret_file(app)?;
    std::fs::write(&path, serde_json::to_string_pretty(&map).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

#[cfg(not(debug_assertions))]
fn read_secret(_app: &tauri::AppHandle, key: &str) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg(not(debug_assertions))]
fn write_secret(_app: &tauri::AppHandle, key: &str, value: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, key).map_err(|e| e.to_string())?;
    entry.set_password(value).map_err(|e| e.to_string())
}

#[cfg(not(debug_assertions))]
fn remove_secret(_app: &tauri::AppHandle, key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, key).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

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

/// Replace every `{{secret:<id>}}` placeholder in a command with the matching
/// secret read from the OS keychain. The secret is injected here, in Rust, only
/// at execution time — it never appears in the model's context or in JS.
///
/// Errors are intentionally generic and never echo the secret value back.
fn substitute_secrets(app: &tauri::AppHandle, command: &str) -> Result<String, String> {
    const OPEN: &str = "{{secret:";
    const CLOSE: &str = "}}";

    let mut result = String::with_capacity(command.len());
    let mut rest = command;

    while let Some(start) = rest.find(OPEN) {
        result.push_str(&rest[..start]);
        let after = &rest[start + OPEN.len()..];
        let end = after
            .find(CLOSE)
            .ok_or_else(|| "Malformed secret placeholder: missing closing '}}'.".to_string())?;
        let id = after[..end].trim();
        if id.is_empty() {
            return Err("Empty secret id in placeholder '{{secret:}}'.".to_string());
        }

        let value = read_secret(app, id)?
            .ok_or_else(|| format!("No vault credential found for id '{}'.", id))?;

        result.push_str(&value);
        rest = &after[end + CLOSE.len()..];
    }

    result.push_str(rest);
    Ok(result)
}

#[tauri::command]
fn execute_ai_command(app: tauri::AppHandle, command: &str) -> Result<String, String> {
    // 1. Enforce database-defined security filters (fail-closed). Filters run on
    //    the template *before* substitution so secrets never reach filter logic.
    enforce_filters(&app, command)?;

    // 2. Inject any vault secrets referenced via `{{secret:<id>}}` placeholders.
    let resolved = substitute_secrets(&app, command)?;

    // 3. Run locally through the system shell. Remote access (SSH), cloud CLIs
    //    (aws/gcloud), etc. are just commands the agent writes — the vault stays
    //    a generic secret store rather than an SSH-only target.
    let shell = if cfg!(target_os = "windows") { "cmd" } else { "sh" };
    let arg = if cfg!(target_os = "windows") { "/C" } else { "-c" };

    let output = std::process::Command::new(shell).arg(arg).arg(&resolved).output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if out.status.success() {
                Ok(stdout)
            } else {
                // Note: we surface stdout/stderr but never the resolved command,
                // so an injected secret can't leak through an error message.
                Err(format!("Execution Error (Code {}):\nStdout: {}\nStderr: {}", out.status, stdout, stderr))
            }
        }
        Err(e) => Err(format!("Failed to execute command: {}", e)),
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

/// Store a secret (vault credential or API key) in the secret store.
#[tauri::command]
fn vault_set_secret(app: tauri::AppHandle, key: &str, value: &str) -> Result<(), String> {
    write_secret(&app, key, value)
}

/// Read a secret from the secret store. Returns an empty string when absent.
#[tauri::command]
fn vault_get_secret(app: tauri::AppHandle, key: &str) -> Result<String, String> {
    Ok(read_secret(&app, key)?.unwrap_or_default())
}

/// Delete a secret from the secret store. No-op if it doesn't exist.
#[tauri::command]
fn vault_delete_secret(app: tauri::AppHandle, key: &str) -> Result<(), String> {
    remove_secret(&app, key)
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
