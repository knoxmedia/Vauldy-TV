import { Alert } from "react-native";
import { t } from "@/i18n";
import { useAuthStore } from "@/store/auth";

/** Returns true when the signed-in user is allowed to play media. */
export function userCanPlay(): boolean {
  const canPlay = useAuthStore.getState().canPlay;
  // null = legacy session before capability was persisted → allow and wait for next login
  return canPlay !== false;
}

/** Gate playback entry points; shows a forbidden alert when blocked. */
export function ensureCanPlay(): boolean {
  if (userCanPlay()) return true;
  Alert.alert(t("error.forbidden"), t("error.playback_denied"));
  return false;
}
