import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const newVersion = process.argv[2];
if (!newVersion || !/^\d+\.\d+\.\d+$/.test(newVersion)) {
    console.error("Usage: node scripts/bump-version.mjs <version>");
    console.error("Example: node scripts/bump-version.mjs 0.2.0");
    process.exit(1);
}

const files = [
    { path: "package.json", regex: /"version":\s*"[^"]+"/, replacement: `"version": "${newVersion}"` },
    { path: "src-tauri/tauri.conf.json", regex: /"version":\s*"[^"]+"/, replacement: `"version": "${newVersion}"` },
    { path: "src-tauri/Cargo.toml", regex: /version\s*=\s*"[^"]+"/, replacement: `version = "${newVersion}"` },
];

for (const { path: rel, regex, replacement } of files) {
    const filePath = resolve(root, rel);
    const content = readFileSync(filePath, "utf-8");
    const updated = content.replace(regex, replacement);
    if (content === updated) {
        console.warn(`WARN: no version found in ${rel}`);
    } else {
        writeFileSync(filePath, updated);
        console.log(`OK: ${rel} -> ${newVersion}`);
    }
}

console.log("\nSyncing Cargo.lock...");
execSync("cargo update -p trayclip", { cwd: resolve(root, "src-tauri"), stdio: "inherit" });

console.log(`\nDone. Version bumped to ${newVersion}`);
console.log(`Next: git add -A && git commit -m "release: v${newVersion}" && git tag v${newVersion} && git push origin main --tags`);
