#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..", "..");
const envFilePath = path.join(rootDir, ".env");

const loadEnvFile = (filePath) => {
  const values = {};

  if (!fs.existsSync(filePath)) {
    return values;
  }

  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.substring(0, separatorIndex).trim();
    if (!key) {
      return;
    }

    let value = trimmed.substring(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  });

  return values;
};

const runReactScript = (script, args) => {
  const validScripts = new Set(["start", "build", "test", "eject"]);
  if (!validScripts.has(script)) {
    console.error(`Unknown script "${script}".`);
    process.exit(1);
  }

  const resolved = require.resolve(`react-scripts/scripts/${script}`);
  process.argv = ["node", resolved, ...args];
  require(resolved);
};

const [, , script, ...rest] = process.argv;

const rawValues = loadEnvFile(envFilePath);
const tokenPattern = /\{([A-Za-z0-9_]+)\}/g;
const envHasValue = (key) =>
  Object.prototype.hasOwnProperty.call(process.env, key) &&
  process.env[key] !== undefined &&
  process.env[key] !== "";

const resolveValue = (key, resolving = new Set()) => {
  if (!(key in rawValues)) {
    return process.env[key];
  }
  if (resolving.has(key)) {
    return rawValues[key];
  }

  const raw = rawValues[key];
  if ((raw === undefined || raw === "") && envHasValue(key)) {
    return process.env[key];
  }

  resolving.add(key);
  const resolved = raw.replace(tokenPattern, (match, token) => {
    const upperToken = token.toUpperCase();
    const replacement = resolveValue(upperToken, resolving);
    return replacement !== undefined ? replacement : match;
  });
  resolving.delete(key);

  if ((resolved === undefined || resolved === "") && envHasValue(key)) {
    rawValues[key] = process.env[key];
    return process.env[key];
  }

  rawValues[key] = resolved;
  return resolved;
};

Object.keys(rawValues).forEach((key) => {
  const resolved = resolveValue(key);
  if (resolved !== undefined) {
    process.env[key] = resolved;
  }
});

runReactScript(script, rest);
