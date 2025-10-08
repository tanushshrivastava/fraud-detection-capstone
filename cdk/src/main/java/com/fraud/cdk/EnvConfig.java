package com.fraud.cdk;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Optional;

final class EnvConfig {
    private static final String ENV_FILE_OVERRIDE_KEY = "ENV_FILE_PATH";
    private static final List<String> ENV_FILE_CANDIDATES = List.of(".env");
    private static final Map<String, String> ENV_FILE_VALUES = loadEnvFileValues();

    private EnvConfig() {
    }

    static Optional<String> get(String key) {
        String fromEnv = System.getenv(key);
        if (fromEnv != null) {
            String trimmed = fromEnv.trim();
            if (!trimmed.isEmpty()) {
                return Optional.of(trimmed);
            }
        }
        return Optional.ofNullable(ENV_FILE_VALUES.get(key));
    }

    static Optional<String> getWithTokens(String key, Map<String, String> tokens) {
        return get(key).map(value -> applyTokens(value, tokens));
    }

    static String getRequired(String key) {
        return get(key).orElseThrow(() ->
            new IllegalStateException("Missing required environment value for " + key));
    }

    static Optional<String> getStackSuffix() {
        return get("STACK_SUFFIX")
            .map(EnvConfig::sanitizeStackSuffix)
            .filter(value -> !value.isEmpty());
    }

    static String applyTokens(String value, Map<String, String> tokens) {
        String resolved = value;
        if (tokens == null || tokens.isEmpty()) {
            return resolved;
        }
        for (Entry<String, String> entry : tokens.entrySet()) {
            String placeholder = "{" + entry.getKey() + "}";
            resolved = resolved.replace(placeholder, entry.getValue());
        }
        return resolved;
    }

    private static Map<String, String> loadEnvFileValues() {
        Path envFile = locateEnvFile();
        if (envFile == null) {
            return Collections.emptyMap();
        }

        Map<String, String> values = new HashMap<>();
        try {
            for (String line : Files.readAllLines(envFile, StandardCharsets.UTF_8)) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }
                int separatorIndex = trimmed.indexOf('=');
                if (separatorIndex < 0) {
                    continue;
                }
                String key = trimmed.substring(0, separatorIndex).trim();
                if (key.isEmpty()) {
                    continue;
                }
                String value = trimmed.substring(separatorIndex + 1).trim();
                if (value.startsWith("\"") && value.endsWith("\"") && value.length() >= 2) {
                    value = value.substring(1, value.length() - 1);
                } else if (value.startsWith("'") && value.endsWith("'") && value.length() >= 2) {
                    value = value.substring(1, value.length() - 1);
                }
                if (!value.isEmpty()) {
                    values.put(key, value);
                }
            }
        } catch (IOException e) {
            System.err.printf(
                "Warning: Unable to read %s for environment configuration: %s%n",
                envFile,
                e.getMessage()
            );
        }
        return values;
    }

    private static Path locateEnvFile() {
        String override = System.getenv(ENV_FILE_OVERRIDE_KEY);
        if (override != null && !override.trim().isEmpty()) {
            Path overridePath = Paths.get(override.trim());
            if (Files.exists(overridePath)) {
                return overridePath;
            }
        }

        Path current = Paths.get("").toAbsolutePath();
        while (current != null) {
            for (String candidate : ENV_FILE_CANDIDATES) {
                Path candidatePath = current.resolve(candidate).normalize();
                if (Files.exists(candidatePath)) {
                    return candidatePath;
                }
            }
            Path parent = current.getParent();
            if (parent == null || parent.equals(current)) {
                break;
            }
            current = parent;
        }
        return null;
    }

    private static String sanitizeStackSuffix(String rawSuffix) {
        String trimmed = rawSuffix.trim();
        if (trimmed.isEmpty()) {
            return "";
        }

        String sanitized = trimmed.replaceAll("[^A-Za-z0-9-]", "-");
        sanitized = sanitized.replaceAll("^-+", "").replaceAll("-+$", "");
        return sanitized;
    }
}
