import { BackHandler, Platform } from "react-native";

/** Leave the app after the user confirms exit on Android TV. */
export function exitApp() {
  if (Platform.OS === "android") {
    BackHandler.exitApp();
    return;
  }
  // tvOS / iOS: no supported programmatic quit; dialog is still shown for parity.
}
