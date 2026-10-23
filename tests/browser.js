// A headless Chrome for page tests, through the project's own DevTools client (scripts/ocr/cdp.mjs,
// no dependency). Finds Chrome from $CHROME or the usual install paths. Off a CI runner, a machine
// without Chrome skips the browser test and says so; on CI (CI=true) a missing Chrome fails it.
import { existsSync } from "node:fs";
import { launch, goto, evaluate } from "../scripts/ocr/cdp.mjs";

const PATHS = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
export const CHROME = PATHS.find((p) => p && existsSync(p)) || null;
export const browserSkip = CHROME ? false : process.env.CI ? false : "no Chrome on this machine; set CHROME to run the browser test";

export async function openChrome() {
  if (!CHROME) throw new Error("no Chrome found; set CHROME to its path");
  const port = 9400 + (process.pid % 500);
  return launch(port, { chrome: CHROME, args: process.platform === "linux" ? ["--no-sandbox"] : [] });
}
export { goto, evaluate };
