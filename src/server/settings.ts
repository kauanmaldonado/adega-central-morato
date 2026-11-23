import "server-only";
import type { StoreSettings } from "@/lib/types";
import type { SettingsInput } from "@/lib/validation";
import type { SessionClient } from "@/lib/supabase/server";
import { unwrap } from "./http";
import { SETTINGS_SELECT } from "./mappers";

export async function getSettings(sb: SessionClient): Promise<StoreSettings> {
  return unwrap(await sb.from("store_settings").select(SETTINGS_SELECT).eq("id", 1).single()) as StoreSettings;
}

export async function updateSettings(sb: SessionClient, input: SettingsInput): Promise<StoreSettings> {
  return unwrap(
    await sb.from("store_settings").update(input).eq("id", 1).select(SETTINGS_SELECT).single(),
  ) as StoreSettings;
}
