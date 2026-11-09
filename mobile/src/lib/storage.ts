import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

/**
 * Armazenamento de credenciais: Keychain/Keystore no celular (expo-secure-store).
 * No navegador não há armazenamento seguro equivalente; usamos localStorage (apenas para
 * desenvolvimento/demonstração — em produção web prefira cookies httpOnly no backend).
 */
export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      /* armazenamento indisponível (modo privado) */
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      /* ignore */
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
