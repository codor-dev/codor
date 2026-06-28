import { Store } from "@tauri-apps/plugin-store";

let globalStore: Store | null = null;

export async function getSecureStore(): Promise<Store> {
  if (!globalStore) {
    globalStore = await Store.load("secure_vault.bin");
  }
  return globalStore;
}
