const { withMainActivity } = require("expo/config-plugins");

const EXIT_METHOD = `override fun invokeDefaultOnBackPressed() {
      // Android TV: BackHandler.exitApp() must leave the app, not only
      // move the task to the background (phone template default).
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        finishAndRemoveTask()
      } else {
        finishAffinity()
      }
  }`;

function findMethodSpan(src, signature) {
  const start = src.indexOf(signature);
  if (start < 0) return null;

  let replaceFrom = start;
  const docStart = src.lastIndexOf("/**", start);
  if (docStart >= 0) {
    const between = src.slice(docStart, start);
    if (between.includes("Align the back button behavior") || between.includes("Android S")) {
      replaceFrom = docStart;
    }
  }

  const openBrace = src.indexOf("{", start);
  if (openBrace < 0) return null;

  let depth = 0;
  for (let i = openBrace; i < src.length; i++) {
    const ch = src[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return { from: replaceFrom, to: i + 1 };
      }
    }
  }
  return null;
}

/**
 * Make BackHandler.exitApp() actually finish the TV activity instead of
 * Expo's phone-oriented moveTaskToBack() default.
 */
function withTvExitApp(config) {
  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== "kt") {
      throw new Error("withTvExitApp expects Kotlin MainActivity");
    }

    let src = cfg.modResults.contents;
    const signature = "override fun invokeDefaultOnBackPressed()";
    const span = findMethodSpan(src, signature);
    if (!span) {
      throw new Error("withTvExitApp: invokeDefaultOnBackPressed() not found in MainActivity");
    }

    const current = src.slice(span.from, span.to);
    if (current.includes("finishAndRemoveTask()") && !current.includes("moveTaskToBack")) {
      return cfg;
    }

    cfg.modResults.contents = `${src.slice(0, span.from)}${EXIT_METHOD}${src.slice(span.to)}`;
    return cfg;
  });
}

module.exports = withTvExitApp;
