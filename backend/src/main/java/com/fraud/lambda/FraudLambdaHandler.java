package com.fraud.lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.dynamodb.model.AttributeValue;
import software.amazon.awssdk.services.dynamodb.model.GetItemRequest;
import software.amazon.awssdk.services.dynamodb.model.PutItemRequest;
import software.amazon.awssdk.services.dynamodb.model.ResourceNotFoundException;
import software.amazon.awssdk.services.sagemakerruntime.SageMakerRuntimeClient;
import software.amazon.awssdk.services.sagemakerruntime.model.InvokeEndpointRequest;
import software.amazon.awssdk.services.sagemakerruntime.model.InvokeEndpointResponse;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public class FraudLambdaHandler implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String DEFAULT_ENDPOINT_NAME = "fraud-detector-endpoint";
    private static final String ENDPOINT_NAME = Optional
        .ofNullable(System.getenv("SAGEMAKER_ENDPOINT_NAME"))
        .filter(value -> !value.isBlank())
        .orElse(DEFAULT_ENDPOINT_NAME);
    private static final String ACCOUNTS_TABLE_NAME = System.getenv("ACCOUNTS_TABLE_NAME");
    private static final String TRANSACTIONS_TABLE_NAME = System.getenv("TRANSACTION_TABLE_NAME");

    @Override
    public APIGatewayProxyResponseEvent handleRequest(APIGatewayProxyRequestEvent event, Context context) {
        APIGatewayProxyResponseEvent response = new APIGatewayProxyResponseEvent();
        response.setHeaders(buildCorsHeaders());

        if (event == null) {
            return setResponse(response, 400, "{\"error\":\"Request cannot be null\"}");
        }

        String method = Optional.ofNullable(event.getHttpMethod()).orElse("GET").toUpperCase();
        String path = normalizePath(event);
        context.getLogger().log(String.format("Received request method=%s path=%s", method, path));

        if ("OPTIONS".equals(method)) {
            return setResponse(response, 204, "");
        }

        try {
            if ("POST".equals(method) && "/accounts".equals(path)) {
                return handleCreateAccount(event, context, response);
            } else if ("POST".equals(method) && "/login".equals(path)) {
                return handleLogin(event, context, response);
            } else if ("POST".equals(method) && ("/transactions".equals(path) || "/".equals(path))) {
                return handleTransaction(event, context, response);
            }
            return setResponse(response, 404, "{\"error\":\"Resource not found\"}");
        } catch (BadRequestException e) {
            context.getLogger().log("Bad request: " + e.getMessage());
            return setResponse(response, 400, "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}");
        } catch (UnauthorizedException e) {
            context.getLogger().log("Unauthorized: " + e.getMessage());
            return setResponse(response, 401, "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}");
        } catch (Exception e) {
            context.getLogger().log("Error: " + e.getMessage());
            return setResponse(response, 500, "{\"error\":\"" + escapeJson(e.getMessage()) + "\"}");
        }
    }

    private APIGatewayProxyResponseEvent handleCreateAccount(
        APIGatewayProxyRequestEvent event,
        Context context,
        APIGatewayProxyResponseEvent baseResponse
    ) throws Exception {
        if (ACCOUNTS_TABLE_NAME == null || ACCOUNTS_TABLE_NAME.isBlank()) {
            throw new IllegalStateException("Accounts table not configured");
        }

        JsonNode body = parseBody(event);
        String name = requireText(body, "name");
        String address = requireText(body, "address");
        String needs = requireText(body, "needs");
        String password = requireText(body, "password");

        String accountId = UUID.randomUUID().toString();
        String salt = UUID.randomUUID().toString();
        String passwordHash = hashPassword(password, salt);

        Map<String, AttributeValue> item = new HashMap<>();
        item.put("accountId", AttributeValue.builder().s(accountId).build());
        item.put("name", AttributeValue.builder().s(name).build());
        item.put("address", AttributeValue.builder().s(address).build());
        item.put("needs", AttributeValue.builder().s(needs).build());
        item.put("passwordHash", AttributeValue.builder().s(passwordHash).build());
        item.put("passwordSalt", AttributeValue.builder().s(salt).build());
        item.put("createdAt", AttributeValue.builder().s(Instant.now().toString()).build());

        try (DynamoDbClient dynamoDb = DynamoDbClient.create()) {
            dynamoDb.putItem(PutItemRequest.builder()
                .tableName(ACCOUNTS_TABLE_NAME)
                .item(item)
                .build());
        }

        context.getLogger().log("Created account " + accountId);
        Map<String, String> responseBody = Map.of("accountId", accountId);
        return setResponse(baseResponse, 201, toJson(responseBody));
    }

    private APIGatewayProxyResponseEvent handleLogin(
        APIGatewayProxyRequestEvent event,
        Context context,
        APIGatewayProxyResponseEvent baseResponse
    ) throws Exception {
        if (ACCOUNTS_TABLE_NAME == null || ACCOUNTS_TABLE_NAME.isBlank()) {
            throw new IllegalStateException("Accounts table not configured");
        }

        JsonNode body = parseBody(event);
        String accountId = requireText(body, "accountId");
        String password = requireText(body, "password");

        Map<String, AttributeValue> key = Map.of(
            "accountId", AttributeValue.builder().s(accountId).build()
        );

        Map<String, AttributeValue> item;
        try (DynamoDbClient dynamoDb = DynamoDbClient.create()) {
            item = dynamoDb.getItem(GetItemRequest.builder()
                .tableName(ACCOUNTS_TABLE_NAME)
                .key(key)
                .consistentRead(true)
                .build()).item();
        }

        if (item == null || item.isEmpty()) {
            throw new UnauthorizedException("Account not found");
        }

        String salt = item.getOrDefault("passwordSalt", AttributeValue.builder().s("").build()).s();
        String storedHash = item.getOrDefault("passwordHash", AttributeValue.builder().s("").build()).s();
        if (salt.isBlank() || storedHash.isBlank()) {
            throw new UnauthorizedException("Account credentials not set");
        }

        String candidateHash = hashPassword(password, salt);
        if (!storedHash.equals(candidateHash)) {
            throw new UnauthorizedException("Invalid credentials");
        }

        Map<String, Object> responseBody = new HashMap<>();
        responseBody.put("message", "Login successful");
        responseBody.put("accountId", accountId);
        return setResponse(baseResponse, 200, toJson(responseBody));
    }

    private APIGatewayProxyResponseEvent handleTransaction(
        APIGatewayProxyRequestEvent event,
        Context context,
        APIGatewayProxyResponseEvent baseResponse
    ) throws Exception {
        JsonNode body = parseBody(event);
        String accountId = requireText(body, "accountId");
        JsonNode transactionNode;
        if (body.has("transaction") && !body.get("transaction").isNull()) {
            transactionNode = body.get("transaction");
        } else {
            ObjectNode sanitized = OBJECT_MAPPER.createObjectNode();
            body.fields().forEachRemaining(entry -> {
                if (!"accountId".equals(entry.getKey())) {
                    sanitized.set(entry.getKey(), entry.getValue());
                }
            });
            transactionNode = sanitized;
        }

        ensureAccountExists(accountId);

        String payload = OBJECT_MAPPER.writeValueAsString(transactionNode);
        context.getLogger().log("Payload received for account " + accountId + ": " + payload);

        String result;
        try (SageMakerRuntimeClient runtime = SageMakerRuntimeClient.create()) {
            InvokeEndpointResponse response = runtime.invokeEndpoint(
                InvokeEndpointRequest.builder()
                    .endpointName(ENDPOINT_NAME)
                    .contentType("application/json")
                    .body(SdkBytes.fromString(payload, StandardCharsets.UTF_8))
                    .build()
            );
            result = response.body().asUtf8String();
        }

        context.getLogger().log("Prediction result: " + result);
        persistTransaction(accountId, transactionNode, result, context);

        Map<String, Object> responseBody = new HashMap<>();
        responseBody.put("accountId", accountId);
        responseBody.put("prediction", safeParseJson(result));
        return setResponse(baseResponse, 200, toJson(responseBody));
    }

    private void ensureAccountExists(String accountId) throws Exception {
        if (ACCOUNTS_TABLE_NAME == null || ACCOUNTS_TABLE_NAME.isBlank()) {
            throw new IllegalStateException("Accounts table not configured");
        }
        Map<String, AttributeValue> key = Map.of(
            "accountId", AttributeValue.builder().s(accountId).build()
        );
        try (DynamoDbClient dynamoDb = DynamoDbClient.create()) {
            Map<String, AttributeValue> item = dynamoDb.getItem(GetItemRequest.builder()
                .tableName(ACCOUNTS_TABLE_NAME)
                .key(key)
                .projectionExpression("accountId")
                .consistentRead(true)
                .build()).item();
            if (item == null || item.isEmpty()) {
                throw new UnauthorizedException("Account does not exist");
            }
        } catch (ResourceNotFoundException e) {
            throw new IllegalStateException("Accounts table not found", e);
        }
    }

    private void persistTransaction(String accountId, JsonNode transactionNode, String prediction, Context context) {
        if (TRANSACTIONS_TABLE_NAME == null || TRANSACTIONS_TABLE_NAME.isBlank()) {
            return;
        }

        Map<String, AttributeValue> item = new HashMap<>();
        item.put("id", AttributeValue.builder().s(UUID.randomUUID().toString()).build());
        item.put("accountId", AttributeValue.builder().s(accountId).build());
        item.put("transaction", AttributeValue.builder().s(transactionNode.toString()).build());
        item.put("prediction", AttributeValue.builder().s(prediction).build());
        item.put("createdAt", AttributeValue.builder().s(Instant.now().toString()).build());

        try (DynamoDbClient dynamoDb = DynamoDbClient.create()) {
            dynamoDb.putItem(PutItemRequest.builder()
                .tableName(TRANSACTIONS_TABLE_NAME)
                .item(item)
                .build());
        } catch (Exception e) {
            context.getLogger().log("Failed to persist transaction: " + e.getMessage());
        }
    }

    private JsonNode parseBody(APIGatewayProxyRequestEvent event) throws Exception {
        String body = event.getBody();
        if (body == null || body.isBlank()) {
            throw new BadRequestException("Request body is required");
        }
        try {
            return OBJECT_MAPPER.readTree(body);
        } catch (JsonProcessingException e) {
            throw new BadRequestException("Invalid JSON body");
        }
    }

    private String requireText(JsonNode node, String fieldName) {
        if (node == null || !node.hasNonNull(fieldName)) {
            throw new BadRequestException("Field '" + fieldName + "' is required");
        }
        String text = node.get(fieldName).asText().trim();
        if (text.isBlank()) {
            throw new BadRequestException("Field '" + fieldName + "' cannot be blank");
        }
        return text;
    }

    private String normalizePath(APIGatewayProxyRequestEvent event) {
        String path = Optional.ofNullable(event.getPath()).orElse("/");
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        APIGatewayProxyRequestEvent.ProxyRequestContext requestContext = event.getRequestContext();
        if (requestContext != null) {
            String stage = requestContext.getStage();
            if (stage != null && !stage.isBlank()) {
                String stagePrefix = "/" + stage;
                if (path.equals(stagePrefix)) {
                    return "/";
                }
                if (path.startsWith(stagePrefix + "/")) {
                    return path.substring(stagePrefix.length());
                }
            }
        }
        return path;
    }

    private Map<String, String> buildCorsHeaders() {
        Map<String, String> headers = new HashMap<>();
        headers.put("Content-Type", "application/json");
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Access-Control-Allow-Headers", "*");
        headers.put("Access-Control-Allow-Methods", "OPTIONS,POST");
        return headers;
    }

    private APIGatewayProxyResponseEvent setResponse(APIGatewayProxyResponseEvent response, int statusCode, String body) {
        response.setStatusCode(statusCode);
        response.setBody(body);
        return response;
    }

    private String toJson(Object payload) throws JsonProcessingException {
        if (payload instanceof String) {
            return (String) payload;
        }
        return OBJECT_MAPPER.writeValueAsString(payload);
    }

    private Object safeParseJson(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return OBJECT_MAPPER.readTree(raw);
        } catch (JsonProcessingException e) {
            return raw;
        }
    }

    private String escapeJson(String value) {
        if (value == null) {
            return "";
        }
        return value.replace("\"", "\\\"");
    }

    private String hashPassword(String password, String salt) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update(salt.getBytes(StandardCharsets.UTF_8));
            byte[] hashed = digest.digest(password.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hashed);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("Password hashing failed", e);
        }
    }

    private static class BadRequestException extends RuntimeException {
        BadRequestException(String message) {
            super(message);
        }
    }

    private static class UnauthorizedException extends RuntimeException {
        UnauthorizedException(String message) {
            super(message);
        }
    }
}
