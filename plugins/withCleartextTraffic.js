const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Vauldy LAN servers commonly use plain HTTP on port 8200. -->
    <base-config cleartextTrafficPermitted="true" />
</network-security-config>
`;

/**
 * Ensure release/debug Android builds allow HTTP (cleartext) to local Vauldy servers.
 * app.json `android.usesCleartextTraffic` alone is not reliably applied by Expo prebuild;
 * expo-build-properties + this plugin make the setting explicit in the native project.
 */
function withCleartextTraffic(config) {
  config = withDangerousMod(config, [
    "android",
    async (cfg) => {
      const xmlDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "xml",
      );
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, "network_security_config.xml"), NETWORK_SECURITY_CONFIG, "utf8");
      return cfg;
    },
  ]);

  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    app.$["android:usesCleartextTraffic"] = "true";
    app.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    AndroidConfig.Manifest.ensureToolsAvailable(manifest);
    return cfg;
  });

  return config;
}

module.exports = withCleartextTraffic;
