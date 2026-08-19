const { expo: baseExpo } = require("./app.json");
const { version } = require("./package.json");

function getAndroidVersionCode(semver) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(semver);
  if (!match) {
    throw new Error(
      `package.json version must be a three-part SemVer without prerelease/build metadata (received: ${JSON.stringify(semver)})`,
    );
  }

  const [, majorText, minorText, patchText] = match;
  const major = Number(majorText);
  const minor = Number(minorText);
  const patch = Number(patchText);
  if (minor > 999 || patch > 999) {
    throw new Error("package.json version minor and patch components must be between 0 and 999");
  }

  const versionCode = major * 1_000_000 + minor * 1_000 + patch;
  if (!Number.isSafeInteger(versionCode) || versionCode <= 0 || versionCode > 2_100_000_000) {
    throw new Error(`package.json version produces an invalid Android versionCode: ${versionCode}`);
  }

  return versionCode;
}

module.exports = {
  expo: {
    ...baseExpo,
    version,
    android: {
      ...baseExpo.android,
      versionCode: getAndroidVersionCode(version),
    },
  },
};