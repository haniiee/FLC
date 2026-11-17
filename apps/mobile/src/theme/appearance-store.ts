import * as SecureStore from "expo-secure-store";

const KEY = "flc.appearance";

export type AppearancePreference = "system" | "light" | "dark";

export async function loadAppearancePreference(): Promise<AppearancePreference> {
  try {
    const value = await SecureStore.getItemAsync(KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    // ignore
  }
  return "system";
}

export async function saveAppearancePreference(value: AppearancePreference): Promise<void> {
  await SecureStore.setItemAsync(KEY, value);
}
