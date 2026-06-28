use tauri::Manager;

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

#[tauri::command]
fn execute_ai_command(
    app: tauri::AppHandle,
    command: &str,
    _server_id: &str,
    secret_value: &str,
) -> Result<String, String> {
    // 1. Enforce Database-defined Security Filters
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let db_path = app_dir.join("codor_history.db");

    if db_path.exists() {
        let conn = rusqlite::Connection::open(&db_path)
            .map_err(|e| format!("Failed to open secure database: {}", e))?;
        
        let mut stmt = conn
            .prepare("SELECT pattern, description FROM command_filters")
            .map_err(|e| format!("Failed to prepare SQL query: {}", e))?;
        
        let filter_rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| format!("Failed to query command filters: {}", e))?;

        for filter_result in filter_rows {
            if let Ok((pattern, description)) = filter_result {
                if command.contains(&pattern) {
                    return Err(format!(
                        "🚫 SECURITY ALERT: Command blocked by active Security Filter '{}' ({}). Execution stopped.",
                        pattern, description
                    ));
                }
            }
        }
    }

    let target = secret_value.trim();

    // 2. If it contains @, execute via native SSH command using system's SSH keys/agent
    if target.contains('@') {
        let parts: Vec<&str> = target.split('@').collect();
        let user = parts[0].trim();
        let host = parts[1].trim();

        let output = std::process::Command::new("ssh")
            .arg("-o")
            .arg("StrictHostKeyChecking=no")
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
    } else {
        // 3. No SSH configuration: Execute command locally on host machine using native shell
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

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![execute_ai_command, execute_backup])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
