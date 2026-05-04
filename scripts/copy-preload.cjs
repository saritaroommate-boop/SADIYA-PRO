/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "electron", "preload.cjs");
const targetDir = path.join(root, "dist-electron");
const target = path.join(targetDir, "preload.cjs");

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(source, target);
console.log(`Copied ${source} -> ${target}`);
