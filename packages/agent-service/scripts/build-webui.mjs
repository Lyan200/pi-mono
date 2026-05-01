import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
process.chdir(root);

if (!existsSync("public/dist")) {
  mkdirSync("public/dist", { recursive: true });
}

console.log("Building Tailwind CSS for WebUI...");
execSync("npx @tailwindcss/cli -i public/src/app.css -o public/dist/app.css --minify", {
  stdio: "inherit",
});

console.log("WebUI build complete.");
