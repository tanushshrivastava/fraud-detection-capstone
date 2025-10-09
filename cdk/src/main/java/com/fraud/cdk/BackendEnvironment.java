package com.fraud.cdk;

import java.util.HashMap;
import java.util.Map;

/**
 * Captures naming and placeholder utilities shared across backend stacks.
 */
final class BackendEnvironment {
    private static final int MAX_SAGEMAKER_NAME_LENGTH = 63;

    private final String stackName;
    private final String stackSuffix;
    private final String stackSuffixLower;
    private final String resourceBase;
    private final String accountId;
    private final String region;
    private final Map<String, String> placeholders;

    BackendEnvironment(String stackName, String stackSuffix, String accountId, String region) {
        this.stackName = stackName;
        this.stackSuffix = stackSuffix == null ? "" : stackSuffix;
        this.stackSuffixLower = this.stackSuffix.isBlank() ? "" : this.stackSuffix.toLowerCase();
        this.resourceBase = sanitizeResourceComponent(stackName);
        this.accountId = accountId;
        this.region = region;
        this.placeholders = Map.copyOf(buildPlaceholders());
    }

    String stackName() {
        return stackName;
    }

    String stackSuffix() {
        return stackSuffix;
    }

    String resourceBase() {
        return resourceBase;
    }

    String accountId() {
        return accountId;
    }

    String region() {
        return region;
    }

    Map<String, String> placeholders() {
        return placeholders;
    }

    String sagemakerName(String suffix) {
        // Enforce SageMaker name restrictions: <=63 chars, alphanumeric start, no trailing hyphen.
        String candidate = resourceBase + "-" + suffix;
        if (candidate.length() > MAX_SAGEMAKER_NAME_LENGTH) {
            candidate = candidate.substring(0, MAX_SAGEMAKER_NAME_LENGTH);
        }
        candidate = candidate.replaceAll("-+$", "");
        if (candidate.isEmpty()) {
            candidate = suffix.length() > MAX_SAGEMAKER_NAME_LENGTH
                ? suffix.substring(0, MAX_SAGEMAKER_NAME_LENGTH)
                : suffix;
        }
        if (!candidate.matches("^[a-zA-Z0-9].*")) {
            candidate = "a" + candidate;
            if (candidate.length() > MAX_SAGEMAKER_NAME_LENGTH) {
                candidate = candidate.substring(0, MAX_SAGEMAKER_NAME_LENGTH);
            }
        }
        return candidate;
    }

    static String sanitizeResourceComponent(String value) {
        // Lowercase and strip unsupported characters so resource names remain predictable.
        String sanitized = value.toLowerCase()
            .replaceAll("[^a-z0-9-]", "-")
            .replaceAll("-{2,}", "-")
            .replaceAll("^-+", "")
            .replaceAll("-+$", "");
        if (sanitized.isEmpty()) {
            return "fraudbackend";
        }
        return sanitized;
    }

    private Map<String, String> buildPlaceholders() {
        // Precompute string tokens that stacks can interpolate when deriving resource names.
        Map<String, String> values = new HashMap<>();
        values.put("STACK_NAME", stackName);
        values.put("STACK_SUFFIX", stackSuffix);
        values.put("RESOURCE_BASE", resourceBase);

        values.put("STACK_SUFFIX_LOWER", stackSuffixLower);

        String stackSuffixSegment = stackSuffix.isBlank() ? "" : "-" + stackSuffix;
        String stackSuffixLowerSegment = stackSuffixLower.isBlank() ? "" : "-" + stackSuffixLower;
        values.put("STACK_SUFFIX_SEGMENT", stackSuffixSegment);
        values.put("STACK_SUFFIX_LOWER_SEGMENT", stackSuffixLowerSegment);

        if (accountId != null && !accountId.isBlank()) {
            values.put("ACCOUNT_ID", accountId);
        }
        if (region != null && !region.isBlank()) {
            values.put("AWS_REGION", region);
        }
        return values;
    }
}
