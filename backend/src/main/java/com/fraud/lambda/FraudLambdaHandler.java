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
import software.amazon.awssdk.services.dynamodb.model.QueryRequest;
import software.amazon.awssdk.services.dynamodb.model.QueryResponse;
import software.amazon.awssdk.services.dynamodb.model.ResourceNotFoundException;
import software.amazon.awssdk.services.dynamodb.model.UpdateItemRequest;
import software.amazon.awssdk.services.sagemakerruntime.SageMakerRuntimeClient;
import software.amazon.awssdk.services.sagemakerruntime.model.InvokeEndpointRequest;
import software.amazon.awssdk.services.sagemakerruntime.model.InvokeEndpointResponse;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

public abstract class FraudLambdaHandler
        implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final String DEFAULT_ENDPOINT_NAME = "fraud-detector-endpoint";
    private static final String ENDPOINT_NAME = Optional
            .ofNullable(System.getenv("SAGEMAKER_ENDPOINT_NAME"))
            .filter(value -> !value.isBlank())
            .orElse(DEFAULT_ENDPOINT_NAME);
    private static final String ACCOUNTS_TABLE_NAME = System.getenv("ACCOUNTS_TABLE_NAME");
    private static final String TRANSACTIONS_TABLE_NAME = System.getenv("TRANSACTION_TABLE_NAME");
    private static final String PHONE_NUMBER_INDEX_NAME = "phoneNumber-createdAt-index";
    private static final String GOOGLE_MAPS_API_KEY = System.getenv("GOOGLE_MAPS_API_KEY");
    private static final String CITY_POPULATION_KEY = System.getenv("CITY_POPULATION_KEY");
    private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();

    @Override
    public final APIGatewayProxyResponseEvent handleRequest(APIGatewayProxyRequestEvent event, Context context) {
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
            return doHandle(event, context, response);
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

    /**
     * Template method implemented by concrete handlers to process the request.
     */
    protected abstract APIGatewayProxyResponseEvent doHandle(
            APIGatewayProxyRequestEvent event,
            Context context,
            APIGatewayProxyResponseEvent baseResponse) throws Exception;

    protected APIGatewayProxyResponseEvent handleCreateAccount(
            APIGatewayProxyRequestEvent event,
            Context context,
            APIGatewayProxyResponseEvent baseResponse) throws Exception {
        if (ACCOUNTS_TABLE_NAME == null || ACCOUNTS_TABLE_NAME.isBlank()) {
            throw new IllegalStateException("Accounts table not configured");
        }

        JsonNode body = parseBody(event);
        String username = requireText(body, "username");
        String email = requireText(body, "email");
        String address = requireText(body, "address");
        String password = requireText(body, "password");
        
        // New required fields
        String firstName = requireText(body, "first_name");
        String lastName = requireText(body, "last_name");
        String ccNum = requireText(body, "cc_num");
        String gender = requireText(body, "gender");
        String dateOfBirth = requireText(body, "date_of_birth");
        String job = requireText(body, "job");
        String city = requireText(body, "city");
        String state = requireText(body, "state");
        String zip = requireText(body, "zip");
        String street = requireText(body, "street");
        
        double fraudThreshold = 0.7;
        if (body.has("fraudThreshold") && body.get("fraudThreshold").isNumber()) {
            fraudThreshold = body.get("fraudThreshold").asDouble();
            if (fraudThreshold < 0 || fraudThreshold > 1) {
                throw new BadRequestException("Fraud threshold must be between 0 and 1");
            }
        }
        String phoneNumber = Optional.ofNullable(optionalText(body, "phoneNumber")).orElse("");

        String accountId = UUID.randomUUID().toString();
        String salt = UUID.randomUUID().toString();
        String passwordHash = hashPassword(password, salt);

        GeocodeResult geocode = geocodeAddress(address, context);
        
        // Get city population using zip code API
        Integer cityPopulation = getCityPopulationByZip(zip, context);

        Map<String, AttributeValue> item = new HashMap<>();
        item.put("accountId", AttributeValue.builder().s(accountId).build());
        item.put("username", AttributeValue.builder().s(username).build());
        item.put("email", AttributeValue.builder().s(email).build());
        item.put("address", AttributeValue.builder().s(address).build());
        item.put("phoneNumber", AttributeValue.builder().s(phoneNumber).build());
        item.put("fraudThreshold", AttributeValue.builder().n(String.valueOf(fraudThreshold)).build());
        
        // Add new fields
        item.put("firstName", AttributeValue.builder().s(firstName).build());
        item.put("lastName", AttributeValue.builder().s(lastName).build());
        item.put("ccNum", AttributeValue.builder().s(ccNum).build());
        item.put("gender", AttributeValue.builder().s(gender).build());
        item.put("dateOfBirth", AttributeValue.builder().s(dateOfBirth).build());
        item.put("job", AttributeValue.builder().s(job).build());
        item.put("city", AttributeValue.builder().s(city).build());
        item.put("state", AttributeValue.builder().s(state).build());
        item.put("zip", AttributeValue.builder().s(zip).build());
        item.put("street", AttributeValue.builder().s(street).build());
        
        if (cityPopulation != null) {
            item.put("cityPopulation", AttributeValue.builder().n(String.valueOf(cityPopulation)).build());
        }
        
        if (geocode != null) {
            item.put("latitude", AttributeValue.builder().n(Double.toString(geocode.latitude())).build());
            item.put("longitude", AttributeValue.builder().n(Double.toString(geocode.longitude())).build());
        }
        item.put("passwordHash", AttributeValue.builder().s(passwordHash).build());
        item.put("passwordSalt", AttributeValue.builder().s(salt).build());
        item.put("smsOptIn", AttributeValue.builder().bool(false).build());
        item.put("createdAt", AttributeValue.builder().s(Instant.now().toString()).build());

        try (DynamoDbClient dynamoDb = DynamoDbClient.create()) {
            dynamoDb.putItem(PutItemRequest.builder()
                    .tableName(ACCOUNTS_TABLE_NAME)
                    .item(item)
                    .build());
        }

        context.getLogger().log("Created account " + accountId);
        Map<String, Object> responseBody = new HashMap<>();
        responseBody.put("accountId", accountId);
        responseBody.put("username", username);
        responseBody.put("email", email);
        responseBody.put("firstName", firstName);
        responseBody.put("lastName", lastName);
        responseBody.put("fraudThreshold", fraudThreshold);
        responseBody.put("phoneNumber", phoneNumber);
        responseBody.put("city", city);
        responseBody.put("state", state);
        if (cityPopulation != null) {
            responseBody.put("cityPopulation", cityPopulation);
        }
        return setResponse(baseResponse, 201, toJson(responseBody));
    }

    protected APIGatewayProxyResponseEvent handleLogin(
            APIGatewayProxyRequestEvent event,
            Context context,
            APIGatewayProxyResponseEvent baseResponse) throws Exception {
        if (ACCOUNTS_TABLE_NAME == null || ACCOUNTS_TABLE_NAME.isBlank()) {
            throw new IllegalStateException("Accounts table not configured");
        }

        JsonNode body = parseBody(event);
        String providedAccountId = optionalText(body, "accountId");
        String providedUsername = optionalText(body, "username");
        String password = requireText(body, "password");

        String accountId = null;
        Map<String, AttributeValue> item = null;

        try (DynamoDbClient dynamoDb = DynamoDbClient.create()) {
            if (providedAccountId != null && !providedAccountId.isBlank()) {
                accountId = providedAccountId;
                Map<String, AttributeValue> key = Map.of(
                        "accountId", AttributeValue.builder().s(accountId).build());
                item = dynamoDb.getItem(GetItemRequest.builder()
                        .tableName(ACCOUNTS_TABLE_NAME)
                        .key(key)
                        .consistentRead(true)
                        .build()).item();
            } else if (providedUsername != null && !providedUsername.isBlank()) {
                QueryResponse response = dynamoDb.query(QueryRequest.builder()
                        .tableName(ACCOUNTS_TABLE_NAME)
                        .indexName("username-index")
                        .keyConditionExpression("username = :username")
                        .expressionAttributeValues(Map.of(
                                ":username", AttributeValue.builder().s(providedUsername).build()))
                        .limit(1)
                        .build());
                if (response.count() > 0 && !response.items().isEmpty()) {
                    item = response.items().get(0);
                    accountId = item.getOrDefault("accountId", AttributeValue.builder().s("").build()).s();
                }
            } else {
                throw new BadRequestException("Either 'username' or 'accountId' is required");
            }
        }

        if (item == null || item.isEmpty()) {
            throw new UnauthorizedException("Account not found");
        }

        if (accountId == null || accountId.isBlank()) {
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

        double fraudThreshold = extractNumeric(item, "fraudThreshold", 0.7);
        String phoneNumber = item.containsKey("phoneNumber") ? item.get("phoneNumber").s() : "";
        String username = item.containsKey("username") ? item.get("username").s() : "";
        String email = item.containsKey("email") ? item.get("email").s() : "";
        String firstName = item.containsKey("firstName") ? item.get("firstName").s() : "";
        String lastName = item.containsKey("lastName") ? item.get("lastName").s() : "";
        String ccNum = item.containsKey("ccNum") ? item.get("ccNum").s() : "";
        String dateOfBirth = item.containsKey("dateOfBirth") ? item.get("dateOfBirth").s() : "";

        List<Map<String, Object>> recentTransactions = fetchRecentTransactions(accountId, 10);

        Map<String, Object> responseBody = new HashMap<>();
        responseBody.put("message", "Login successful");
        responseBody.put("accountId", accountId);
        responseBody.put("fraudThreshold", fraudThreshold);
        responseBody.put("phoneNumber", phoneNumber);
        responseBody.put("username", username);
        responseBody.put("email", email);
        responseBody.put("firstName", firstName);
        responseBody.put("lastName", lastName);
        responseBody.put("ccNum", ccNum);
        responseBody.put("dateOfBirth", dateOfBirth);
        responseBody.put("recentTransactions", recentTransactions);
        return setResponse(baseResponse, 200, toJson(responseBody));
    }

    protected APIGatewayProxyResponseEvent handleUpdateAccountSettings(
            APIGatewayProxyRequestEvent event,
            Context context,
            APIGatewayProxyResponseEvent baseResponse) throws Exception {
        if (ACCOUNTS_TABLE_NAME == null || ACCOUNTS_TABLE_NAME.isBlank()) {
            throw new IllegalStateException("Accounts table not configured");
        }

        JsonNode body = parseBody(event);
        String accountId = requireText(body, "accountId");
        String phoneNumber = optionalText(body, "phoneNumber");
        Double fraudThreshold = null;
        if (body.has("fraudThreshold") && !body.get("fraudThreshold").isNull()) {
            if (!body.get("fraudThreshold").isNumber()) {
                throw new BadRequestException("fraudThreshold must be a number between 0 and 1");
            }
            double candidate = body.get("fraudThreshold").asDouble();
            if (candidate < 0 || candidate > 1) {
                throw new BadRequestException("fraudThreshold must be between 0 and 1");
            }
            fraudThreshold = candidate;
        }

        if (phoneNumber == null && fraudThreshold == null) {
            throw new BadRequestException("No account settings provided for update");
        }

        Map<String, AttributeValue> key = Map.of("accountId", AttributeValue.builder().s(accountId).build());
        Map<String, AttributeValue> expressionValues = new HashMap<>();
        List<String> assignments = new ArrayList<>();

        if (phoneNumber != null) {
            expressionValues.put(":phoneNumber", AttributeValue.builder().s(phoneNumber).build());
            assignments.add("phoneNumber = :phoneNumber");
        }
        if (fraudThreshold != null) {
            expressionValues.put(":fraudThreshold",
                    AttributeValue.builder().n(Double.toString(fraudThreshold)).build());
            assignments.add("fraudThreshold = :fraudThreshold");
        }

        String updateExpression = "SET " + String.join(", ", assignments);

        try (DynamoDbClient dynamoDb = DynamoDbClient.create()) {
            dynamoDb.updateItem(UpdateItemRequest.builder()
                    .tableName(ACCOUNTS_TABLE_NAME)
                    .key(key)
                    .updateExpression(updateExpression)
                    .expressionAttributeValues(expressionValues)
                    .build());
        }

        Map<String, AttributeValue> updatedAccount = getAccount(accountId);
        double updatedThreshold = extractNumeric(updatedAccount, "fraudThreshold", 0.7);
        String updatedPhone = updatedAccount.containsKey("phoneNumber") ? updatedAccount.get("phoneNumber").s() : "";

        Map<String, Object> responseBody = new HashMap<>();
        responseBody.put("accountId", accountId);
        responseBody.put("fraudThreshold", updatedThreshold);
        responseBody.put("phoneNumber", updatedPhone);
        return setResponse(baseResponse, 200, toJson(responseBody));
    }

    protected APIGatewayProxyResponseEvent handleGetRecentTransactions(
            String accountId,
            APIGatewayProxyRequestEvent event,
            Context context,
            APIGatewayProxyResponseEvent baseResponse) throws Exception {
        ensureAccountExists(accountId);
        int limit = 10;
        if (event.getQueryStringParameters() != null && event.getQueryStringParameters().containsKey("limit")) {
            try {
                limit = Math.max(1, Math.min(25, Integer.parseInt(event.getQueryStringParameters().get("limit"))));
            } catch (NumberFormatException e) {
                context.getLogger().log("Invalid limit parameter: " + e.getMessage());
            }
        }

        List<Map<String, Object>> recentTransactions = fetchRecentTransactions(accountId, limit);
        Map<String, Object> responseBody = new HashMap<>();
        responseBody.put("accountId", accountId);
        responseBody.put("items", recentTransactions);
        return setResponse(baseResponse, 200, toJson(responseBody));
    }

    protected APIGatewayProxyResponseEvent handleTransaction(
            APIGatewayProxyRequestEvent event,
            Context context,
            APIGatewayProxyResponseEvent baseResponse) throws Exception {
        JsonNode body = parseBody(event);
        String accountId = requireText(body, "accountId");
        
        // Get account details to populate transaction
        Map<String, AttributeValue> accountData = getAccount(accountId);
        
        // Build complete transaction from account data + provided merchant details
        ObjectNode completeTransaction = OBJECT_MAPPER.createObjectNode();
        
        // Auto-populate from account
        completeTransaction.put("cc_num", accountData.getOrDefault("ccNum", AttributeValue.builder().s("").build()).s());
        completeTransaction.put("first", accountData.getOrDefault("firstName", AttributeValue.builder().s("").build()).s());
        completeTransaction.put("last", accountData.getOrDefault("lastName", AttributeValue.builder().s("").build()).s());
        completeTransaction.put("gender", accountData.getOrDefault("gender", AttributeValue.builder().s("").build()).s());
        completeTransaction.put("dob", accountData.getOrDefault("dateOfBirth", AttributeValue.builder().s("").build()).s());
        completeTransaction.put("job", accountData.getOrDefault("job", AttributeValue.builder().s("").build()).s());
        completeTransaction.put("street", accountData.getOrDefault("street", AttributeValue.builder().s("").build()).s());
        completeTransaction.put("city", accountData.getOrDefault("city", AttributeValue.builder().s("").build()).s());
        completeTransaction.put("state", accountData.getOrDefault("state", AttributeValue.builder().s("").build()).s());
        completeTransaction.put("zip", Integer.parseInt(accountData.getOrDefault("zip", AttributeValue.builder().s("0").build()).s()));
        
        if (accountData.containsKey("cityPopulation")) {
            completeTransaction.put("city_pop", Integer.parseInt(accountData.get("cityPopulation").n()));
        }
        if (accountData.containsKey("latitude")) {
            completeTransaction.put("lat", Double.parseDouble(accountData.get("latitude").n()));
        }
        if (accountData.containsKey("longitude")) {
            completeTransaction.put("long", Double.parseDouble(accountData.get("longitude").n()));
        }
        
        // Auto-generate transaction metadata
        completeTransaction.put("trans_date_trans_time", java.time.LocalDateTime.now().toString().replace("T", " "));
        completeTransaction.put("trans_num", UUID.randomUUID().toString().replace("-", ""));
        completeTransaction.put("unix_time", System.currentTimeMillis() / 1000);
        
        // Add provided merchant details (check both root level and nested transaction object)
        JsonNode merchantData = body.has("transaction") ? body.get("transaction") : body;
        if (merchantData.has("merchant")) completeTransaction.put("merchant", merchantData.get("merchant").asText());
        if (merchantData.has("category")) completeTransaction.put("category", merchantData.get("category").asText());
        if (merchantData.has("amt")) completeTransaction.put("amt", merchantData.get("amt").asDouble());
        if (merchantData.has("merch_lat")) completeTransaction.put("merch_lat", merchantData.get("merch_lat").asDouble());
        if (merchantData.has("merch_long")) completeTransaction.put("merch_long", merchantData.get("merch_long").asDouble());
        
        JsonNode transactionNode = completeTransaction;

        ensureAccountExists(accountId);

        // NEW: Get account details (includes phone number and fraudThreshold)
        Map<String, AttributeValue> account = getAccount(accountId);

        String payload = OBJECT_MAPPER.writeValueAsString(transactionNode);
        context.getLogger().log("Payload received for account " + accountId + ": " + payload);

        String result;
        try (SageMakerRuntimeClient runtime = SageMakerRuntimeClient.create()) {
            InvokeEndpointResponse response = runtime.invokeEndpoint(
                    InvokeEndpointRequest.builder()
                            .endpointName(ENDPOINT_NAME)
                            .contentType("application/json")
                            .body(SdkBytes.fromString(payload, StandardCharsets.UTF_8))
                            .build());
            result = response.body().asUtf8String();
        }

        context.getLogger().log("Prediction result: " + result);
        // persistTransaction(accountId, transactionNode, result, context);

        // NEW: Parse fraud score from result
        double fraudScore = 0.7; // default
        try {
            fraudScore = extractFraudScore(result);
        } catch (Exception e) {
            context.getLogger().log("Failed to extract fraud score: " + e.getMessage());
        }
        PersistedTransaction persisted = persistTransaction(accountId, transactionNode, result, context);
        String transactionId = persisted.id();

        double fraudThreshold = extractNumeric(account, "fraudThreshold", 0.7);

        // NEW: Check if we should send SMS alert
        boolean smsSent = false;
        boolean awaitingCustomerResponse = false;
        String phoneNumberForAlert = null;
        if (TwilioService.isConfigured()) {
            try {
                String phoneNumber = account.containsKey("phoneNumber") ? account.get("phoneNumber").s() : "";
                if (fraudScore >= fraudThreshold && phoneNumber != null && !phoneNumber.isBlank()) {
                    phoneNumberForAlert = phoneNumber;
                    String amount = extractAmount(transactionNode);
                    String location = extractLocation(transactionNode);

                    String messageSid = TwilioService.sendFraudAlert(
                            phoneNumber,
                            transactionId,
                            amount,
                            location);
                    context.getLogger().log(String.format(
                            "Sent fraud alert SMS:\n" +
                                    " - Phone: %s\n" +
                                    " - Transaction ID: %s\n" +
                                    " - Fraud Score: %.4f\n" +
                                    " - Fraud Threshold: %.4f\n" +
                                    " - Amount: %s\n" +
                                    " - Location: %s\n" +
                                    " - Message SID: %s\n",
                            phoneNumber,
                            transactionId,
                            fraudScore,
                            fraudThreshold,
                            amount,
                            location,
                            messageSid));

                    smsSent = true;
                    awaitingCustomerResponse = true;
                    markTransactionAwaitingResponse(transactionId, accountId, phoneNumber, messageSid, context);
                } else {
                    context.getLogger().log(String.format(
                            "Fraud score %.4f below threshold %.4f; no SMS sent for transaction %s",
                            fraudScore,
                            fraudThreshold,
                            transactionId));
                }
            } catch (Exception e) {
                context.getLogger().log("Failed to send SMS alert: " + e.getMessage());
                // Don't fail the transaction if SMS fails
            }
        }

        Map<String, Object> transactionSummary = buildTransactionSummary(
                transactionId,
                persisted.createdAt(),
                transactionNode,
                result,
                fraudScore);
        transactionSummary.put("awaitingResponse", awaitingCustomerResponse);
        transactionSummary.put("customerResponseFlag", 0);
        transactionSummary.put("customerMarkedFraud", false);
        if (smsSent) {
            transactionSummary.put("phoneNumber", phoneNumberForAlert);
        }

        Map<String, Object> responseBody = new HashMap<>();
        responseBody.put("accountId", accountId);
        responseBody.put("transactionId", transactionId);
        responseBody.put("prediction", safeParseJson(result));
        responseBody.put("smsSent", smsSent);
        responseBody.put("awaitingResponse", awaitingCustomerResponse);
        responseBody.put("customerResponseFlag", 0);
        responseBody.put("customerMarkedFraud", false);
        responseBody.put("fraudScore", fraudScore);
        responseBody.put("fraudThreshold", fraudThreshold);
        responseBody.put("transactionSummary", transactionSummary);
        return setResponse(baseResponse, 200, toJson(responseBody));
    }

    private List<Map<String, Object>> fetchRecentTransactions(String accountId, int limit) throws Exception {
        if (TRANSACTIONS_TABLE_NAME == null || TRANSACTIONS_TABLE_NAME.isBlank()) {
            return List.of();
        }

        Map<String, AttributeValue> expressionValues = Map.of(
                ":accountId", AttributeValue.builder().s(accountId).build());

        QueryRequest request = QueryRequest.builder()
                .tableName(TRANSACTIONS_TABLE_NAME)
                .indexName("accountId-createdAt-index")
                .keyConditionExpression("accountId = :accountId")
                .expressionAttributeValues(expressionValues)
                .scanIndexForward(false)
                .limit(limit)
                .build();

        try (DynamoDbClient dynamoDb = DynamoDbClient.create()) {
            QueryResponse response = dynamoDb.query(request);
            List<Map<String, Object>> items = new ArrayList<>();
            if (response.items() == null) {
                return items;
            }
            for (Map<String, AttributeValue> record : response.items()) {
                String transactionId = record.getOrDefault("id", AttributeValue.builder().s("").build()).s();
                String createdAt = record.getOrDefault("createdAt", AttributeValue.builder().s("").build()).s();
                String serializedTransaction = record
                        .getOrDefault("transaction", AttributeValue.builder().s("{}").build()).s();
                String predictionJson = record.getOrDefault("prediction", AttributeValue.builder().s("{}").build()).s();

                JsonNode transactionNode;
                try {
                    transactionNode = OBJECT_MAPPER.readTree(serializedTransaction);
                } catch (Exception parseEx) {
                    transactionNode = OBJECT_MAPPER.createObjectNode();
                }

                double fraudScore = 0.0;
                try {
                    fraudScore = extractFraudScore(predictionJson);
                } catch (Exception ignored) {
                    // Use default fraudScore if parsing fails.
                }

                Map<String, Object> summary = buildTransactionSummary(
                        transactionId,
                        createdAt,
                        transactionNode,
                        predictionJson,
                        fraudScore);

                AttributeValue responseFlagAttr = record.get("customerResponseFlag");
                int responseFlag = 0;
                if (responseFlagAttr != null && responseFlagAttr.n() != null) {
                    try {
                        responseFlag = Integer.parseInt(responseFlagAttr.n());
                    } catch (NumberFormatException ignored) {
                        responseFlag = 0;
                    }
                }
                summary.put("customerResponseFlag", responseFlag);

                AttributeValue awaitingAttr = record.get("awaitingResponse");
                if (awaitingAttr != null) {
                    summary.put("awaitingResponse", awaitingAttr.bool());
                } else {
                    summary.put("awaitingResponse", false);
                }

                AttributeValue respondedAtAttr = record.get("customerRespondedAt");
                if (respondedAtAttr != null && respondedAtAttr.s() != null && !respondedAtAttr.s().isBlank()) {
                    summary.put("customerRespondedAt", respondedAtAttr.s());
                }

                AttributeValue responseTextAttr = record.get("customerResponseText");
                if (responseTextAttr != null && responseTextAttr.s() != null) {
                    summary.put("customerResponseText", responseTextAttr.s());
                }

                AttributeValue phoneDisplayAttr = record.get("phoneNumberDisplay");
                if (phoneDisplayAttr != null && phoneDisplayAttr.s() != null) {
                    summary.put("phoneNumber", phoneDisplayAttr.s());
                } else {
                    AttributeValue phoneAttr = record.get("phoneNumber");
                    if (phoneAttr != null && phoneAttr.s() != null) {
                        summary.put("phoneNumber", phoneAttr.s());
                    }
                }

                AttributeValue markedAttr = record.get("customerMarkedFraud");
                if (markedAttr != null) {
                    summary.put("customerMarkedFraud", markedAttr.bool());
                }

                items.add(summary);
            }
            return items;
        }
    }

    private void ensureAccountExists(String accountId) throws Exception {
        if (ACCOUNTS_TABLE_NAME == null || ACCOUNTS_TABLE_NAME.isBlank()) {
            throw new IllegalStateException("Accounts table not configured");
        }
        Map<String, AttributeValue> key = Map.of(
                "accountId", AttributeValue.builder().s(accountId).build());
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

    // UPDATED: persistTransaction() to return transaction ID
    private PersistedTransaction persistTransaction(String accountId, JsonNode transactionNode, String prediction,
            Context context) {
        if (TRANSACTIONS_TABLE_NAME == null || TRANSACTIONS_TABLE_NAME.isBlank()) {
            return new PersistedTransaction(UUID.randomUUID().toString(), Instant.now().toString());
        }

        String transactionId = UUID.randomUUID().toString();
        String createdAt = Instant.now().toString();
        Map<String, AttributeValue> item = new HashMap<>();
        item.put("id", AttributeValue.builder().s(transactionId).build());
        item.put("accountId", AttributeValue.builder().s(accountId).build());
        item.put("transaction", AttributeValue.builder().s(transactionNode.toString()).build());
        item.put("prediction", AttributeValue.builder().s(prediction).build());
        item.put("createdAt", AttributeValue.builder().s(createdAt).build());
        item.put("customerResponseFlag", AttributeValue.builder().n("0").build());
        item.put("awaitingResponse", AttributeValue.builder().bool(false).build());
        item.put("customerMarkedFraud", AttributeValue.builder().bool(false).build());

        try (DynamoDbClient dynamoDb = DynamoDbClient.create()) {
            dynamoDb.putItem(PutItemRequest.builder()
                    .tableName(TRANSACTIONS_TABLE_NAME)
                    .item(item)
                    .build());
            context.getLogger().log(String.format(
                    "Persisted transaction %s for account %s (initial customerResponseFlag=0)",
                    transactionId,
                    accountId));
        } catch (Exception e) {
            context.getLogger().log("Failed to persist transaction: " + e.getMessage());
        }

        return new PersistedTransaction(transactionId, createdAt);
    }

    private void markTransactionAwaitingResponse(
            String transactionId,
            String accountId,
            String phoneNumber,
            String messageSid,
            Context context) {
        if (TRANSACTIONS_TABLE_NAME == null || TRANSACTIONS_TABLE_NAME.isBlank()) {
            return;
        }
        if (transactionId == null || transactionId.isBlank()) {
            return;
        }
        if (phoneNumber == null || phoneNumber.isBlank()) {
            context.getLogger().log("Phone number missing; skipping awaiting-response mark for transaction " + transactionId);
            return;
        }

        Map<String, AttributeValue> key = Map.of(
                "id", AttributeValue.builder().s(transactionId).build());

        String normalizedPhone = normalizePhoneNumber(phoneNumber);
        if (normalizedPhone == null || normalizedPhone.isBlank()) {
            context.getLogger().log("Unable to normalize phone number '" + phoneNumber
                    + "'; skipping awaiting-response mark for transaction " + transactionId);
            return;
        }

        Map<String, String> names = new HashMap<>();
        names.put("#phone", "phoneNumber");
        names.put("#phoneDisplay", "phoneNumberDisplay");
        names.put("#awaiting", "awaitingResponse");
        names.put("#flag", "customerResponseFlag");
        names.put("#responseText", "customerResponseText");
        names.put("#respondedAt", "customerRespondedAt");

        Map<String, AttributeValue> values = new HashMap<>();
        values.put(":phone", AttributeValue.builder().s(normalizedPhone).build());
        values.put(":phoneDisplay", AttributeValue.builder().s(phoneNumber).build());
        values.put(":awaiting", AttributeValue.builder().bool(true).build());
        values.put(":zero", AttributeValue.builder().n("0").build());

        StringBuilder updateExpression = new StringBuilder(
                "SET #phone = :phone, #phoneDisplay = :phoneDisplay, #awaiting = :awaiting, "
                        + "#flag = if_not_exists(#flag, :zero)");

        if (messageSid != null && !messageSid.isBlank()) {
            names.put("#messageSid", "outboundMessageSid");
            values.put(":messageSid", AttributeValue.builder().s(messageSid).build());
            updateExpression.append(", #messageSid = :messageSid");
        }

        updateExpression.append(" REMOVE #responseText, #respondedAt");

        try (DynamoDbClient dynamoDb = DynamoDbClient.create()) {
            dynamoDb.updateItem(UpdateItemRequest.builder()
                    .tableName(TRANSACTIONS_TABLE_NAME)
                    .key(key)
                    .updateExpression(updateExpression.toString())
                    .expressionAttributeNames(names)
                    .expressionAttributeValues(values)
                    .build());
            context.getLogger().log(String.format(
                    "Marked transaction %s for account %s awaiting customer response (phone=%s, messageSid=%s)",
                    transactionId,
                    accountId,
                    phoneNumber,
                    messageSid));
        } catch (Exception e) {
            context.getLogger().log(String.format(
                    "Failed to mark transaction %s for account %s as awaiting response: %s",
                    transactionId,
                    accountId,
                    e.getMessage()));
        }
    }

    private Optional<Map<String, AttributeValue>> findLatestTransactionForPhone(
            String phoneNumber,
            Context context) {
        if (TRANSACTIONS_TABLE_NAME == null || TRANSACTIONS_TABLE_NAME.isBlank()) {
            context.getLogger().log("TRANSACTION_TABLE_NAME is not configured; cannot query for phone " + phoneNumber);
            return Optional.empty();
        }
        if (phoneNumber == null || phoneNumber.isBlank()) {
            return Optional.empty();
        }

        String normalizedPhone = normalizePhoneNumber(phoneNumber);
        if (normalizedPhone == null || normalizedPhone.isBlank()) {
            context.getLogger().log("Unable to normalize phone number '" + phoneNumber
                    + "' for query; skipping lookup.");
            return Optional.empty();
        }

        Map<String, AttributeValue> expressionValues = Map.of(
                ":phone", AttributeValue.builder().s(normalizedPhone).build());

        QueryRequest request = QueryRequest.builder()
                .tableName(TRANSACTIONS_TABLE_NAME)
                .indexName(PHONE_NUMBER_INDEX_NAME)
                .keyConditionExpression("phoneNumber = :phone")
                .expressionAttributeValues(expressionValues)
                .scanIndexForward(false)
                .limit(1)
                .build();

        context.getLogger().log(String.format(
                "Querying %s (index=%s) for latest transaction with phone %s",
                TRANSACTIONS_TABLE_NAME,
                PHONE_NUMBER_INDEX_NAME,
                normalizedPhone));

        try (DynamoDbClient dynamoDb = DynamoDbClient.create()) {
            QueryResponse response = dynamoDb.query(request);
            if (response.items() != null && !response.items().isEmpty()) {
                context.getLogger().log(String.format(
                        "Found %d transactions for phone %s; returning the most recent",
                        response.items().size(),
                        phoneNumber));
                return Optional.of(response.items().get(0));
            } else {
                context.getLogger().log("No transactions found for phone " + phoneNumber);
            }
        } catch (Exception e) {
            context.getLogger().log("Failed to query latest transaction for phone "
                    + phoneNumber + ": " + e.getMessage());
        }
        return Optional.empty();
    }

    private boolean recordCustomerResponse(
            String fromNumber,
            boolean isFraud,
            String rawMessage,
            Context context) {
        if (TRANSACTIONS_TABLE_NAME == null || TRANSACTIONS_TABLE_NAME.isBlank()) {
            context.getLogger().log("Cannot record customer response because TRANSACTION_TABLE_NAME is not set");
            return false;
        }
        context.getLogger().log("Recording customer response. From=" + fromNumber + ", isFraud=" + isFraud);
        Optional<Map<String, AttributeValue>> latest = findLatestTransactionForPhone(fromNumber, context);
        if (latest.isEmpty()) {
            context.getLogger().log("No pending transaction found for number " + fromNumber);
            return false;
        }

        AttributeValue idAttr = latest.get().get("id");
        if (idAttr == null || idAttr.s() == null || idAttr.s().isBlank()) {
            context.getLogger().log("Latest transaction for " + fromNumber + " is missing an id");
            return false;
        }

        String transactionId = idAttr.s();
        Map<String, AttributeValue> key = Map.of(
                "id", AttributeValue.builder().s(transactionId).build());

        Map<String, String> names = new HashMap<>();
        names.put("#flag", "customerResponseFlag");
        names.put("#awaiting", "awaitingResponse");
        names.put("#responseText", "customerResponseText");
        names.put("#respondedAt", "customerRespondedAt");
        names.put("#customerMarkedFraud", "customerMarkedFraud");

        Map<String, AttributeValue> values = new HashMap<>();
        values.put(":flag", AttributeValue.builder().n(isFraud ? "1" : "0").build());
        values.put(":awaiting", AttributeValue.builder().bool(false).build());
        values.put(":responseText", AttributeValue.builder()
                .s(rawMessage == null ? "" : rawMessage.trim())
                .build());
        values.put(":respondedAt", AttributeValue.builder().s(Instant.now().toString()).build());
        values.put(":fraudValue", AttributeValue.builder().bool(isFraud).build());

        try (DynamoDbClient dynamoDb = DynamoDbClient.create()) {
            dynamoDb.updateItem(UpdateItemRequest.builder()
                    .tableName(TRANSACTIONS_TABLE_NAME)
                    .key(key)
                    .updateExpression(
                            "SET #flag = :flag, #awaiting = :awaiting, #responseText = :responseText, "
                                    + "#respondedAt = :respondedAt, #customerMarkedFraud = :fraudValue")
                    .expressionAttributeNames(names)
                    .expressionAttributeValues(values)
                    .build());
            context.getLogger().log(String.format(
                    "Recorded customer response for transaction %s (from=%s, fraud=%s, flag=%s)",
                    transactionId,
                    fromNumber,
                    isFraud,
                    isFraud ? "1" : "0"));
            return true;
        } catch (Exception e) {
            context.getLogger().log(
                    "Failed to persist customer response for transaction "
                            + transactionId + ": " + e.getMessage());
            return false;
        }
    }

    // NEW METHOD: Twilio Webhook Handler
    // TODO: Revise after getting approved by Twilio
    protected APIGatewayProxyResponseEvent handleTwilioWebhook(
            APIGatewayProxyRequestEvent event,
            Context context,
            APIGatewayProxyResponseEvent baseResponse) throws Exception {
        context.getLogger().log("Received Twilio webhook");

        // Twilio sends form data, not JSON
        String body = event.getBody();
        if (body == null || body.isBlank()) {
            throw new BadRequestException("Request body is required");
        }

        // Parse form data (format: key1=value1&key2=value2)
        Map<String, String> formData = parseFormData(body);
        String messageBody = formData.get("Body");
        String fromNumber = formData.get("From");
        if (fromNumber == null || fromNumber.isBlank()) {
            throw new BadRequestException("Sender phone number missing");
        }

        context.getLogger().log("SMS from " + fromNumber + ": " + messageBody);

        // Parse the user's response
        Boolean isFraud = TwilioService.parseFraudConfirmation(messageBody);

        if (isFraud == null) {
            // Unclear response - send help message
            context.getLogger().log("Unable to interpret response from " + fromNumber + ": " + messageBody);
            return setResponse(baseResponse, 200,
                    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>" +
                            "<Response><Message>Please reply with YES if legitimate or NO if fraudulent.</Message></Response>");
        }

        boolean customerConfirmedFraud = Boolean.TRUE.equals(isFraud);
        boolean recorded = recordCustomerResponse(fromNumber, customerConfirmedFraud, messageBody, context);
        if (!recorded) {
            context.getLogger()
                    .log("Unable to find a pending transaction to update for phone " + fromNumber);
        } else {
            context.getLogger().log("Customer response persisted for phone " + fromNumber);
        }

        // Send confirmation SMS
        try {
            TwilioService.sendConfirmation(fromNumber, customerConfirmedFraud);
        } catch (Exception e) {
            context.getLogger().log("Failed to send confirmation: " + e.getMessage());
        }

        // Respond to Twilio with TwiML (empty response)
        return setResponse(baseResponse, 200,
                "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>");
    }

    // NEW: Helper method for parsing form data
    private Map<String, String> parseFormData(String body) {
        Map<String, String> data = new HashMap<>();
        if (body == null || body.isBlank()) {
            return data;
        }

        String[] pairs = body.split("&");
        for (String pair : pairs) {
            String[] keyValue = pair.split("=", 2);
            if (keyValue.length == 2) {
                try {
                    String key = java.net.URLDecoder.decode(keyValue[0], StandardCharsets.UTF_8);
                    String value = java.net.URLDecoder.decode(keyValue[1], StandardCharsets.UTF_8);
                    data.put(key, value);
                } catch (Exception e) {
                    // Skip malformed pairs
                }
            }
        }
        return data;
    }

    protected JsonNode parseBody(APIGatewayProxyRequestEvent event) throws Exception {
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

    protected String requireText(JsonNode node, String fieldName) {
        if (node == null || !node.hasNonNull(fieldName)) {
            throw new BadRequestException("Field '" + fieldName + "' is required");
        }
        String text = node.get(fieldName).asText();
        if (text == null || text.trim().isBlank()) {
            throw new BadRequestException("Field '" + fieldName + "' cannot be blank");
        }
        return text.trim();
    }

    protected String optionalText(JsonNode node, String fieldName) {
        if (node == null || !node.has(fieldName) || node.get(fieldName).isNull()) {
            return null;
        }
        String text = node.get(fieldName).asText();
        return text != null ? text.trim() : null;
    }

    private String normalizePhoneNumber(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String digitsOnly = raw.chars()
                .filter(Character::isDigit)
                .collect(StringBuilder::new,
                        StringBuilder::appendCodePoint,
                        StringBuilder::append)
                .toString();
        if (digitsOnly.isBlank()) {
            return null;
        }
        if (digitsOnly.length() == 11 && digitsOnly.startsWith("1")) {
            digitsOnly = digitsOnly.substring(1);
        }
        return digitsOnly;
    }

    protected String normalizePath(APIGatewayProxyRequestEvent event) {
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

    protected String extractAccountIdFromTransactionsPath(String path) {
        if (path == null) {
            return null;
        }
        String prefix = "/accounts/";
        String suffix = "/transactions";
        if (!path.startsWith(prefix) || !path.endsWith(suffix)) {
            return null;
        }
        String inner = path.substring(prefix.length(), path.length() - suffix.length());
        if (inner.isBlank()) {
            return null;
        }
        int slashIndex = inner.indexOf('/');
        if (slashIndex >= 0) {
            return null;
        }
        return inner;
    }

    protected String getNormalizedMethod(APIGatewayProxyRequestEvent event) {
        return Optional.ofNullable(event.getHttpMethod()).orElse("").toUpperCase();
    }

    protected String resolveAccountId(APIGatewayProxyRequestEvent event) {
        if (event != null && event.getPathParameters() != null) {
            String accountId = event.getPathParameters().get("accountId");
            if (accountId != null && !accountId.isBlank()) {
                return accountId;
            }
        }
        return extractAccountIdFromTransactionsPath(normalizePath(event));
    }

    private Map<String, String> buildCorsHeaders() {
        Map<String, String> headers = new HashMap<>();
        headers.put("Content-Type", "application/json");
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Access-Control-Allow-Headers", "*");
        headers.put("Access-Control-Allow-Methods", "OPTIONS,POST,PUT,PATCH,GET");
        return headers;
    }

    protected APIGatewayProxyResponseEvent setResponse(APIGatewayProxyResponseEvent response, int statusCode,
            String body) {
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

    private double extractNumeric(Map<String, AttributeValue> item, String fieldName, double defaultValue) {
        if (item == null || !item.containsKey(fieldName)) {
            return defaultValue;
        }
        AttributeValue value = item.get(fieldName);
        if (value.n() != null && !value.n().isBlank()) {
            try {
                return Double.parseDouble(value.n());
            } catch (NumberFormatException ignored) {
                return defaultValue;
            }
        }
        if (value.s() != null && !value.s().isBlank()) {
            try {
                return Double.parseDouble(value.s());
            } catch (NumberFormatException ignored) {
                return defaultValue;
            }
        }
        return defaultValue;
    }

    private Map<String, AttributeValue> getAccount(String accountId) throws Exception {
        if (ACCOUNTS_TABLE_NAME == null || ACCOUNTS_TABLE_NAME.isBlank()) {
            throw new IllegalStateException("Accounts table not configured");
        }
        Map<String, AttributeValue> key = Map.of(
                "accountId", AttributeValue.builder().s(accountId).build());
        try (DynamoDbClient dynamoDb = DynamoDbClient.create()) {
            Map<String, AttributeValue> item = dynamoDb.getItem(GetItemRequest.builder()
                    .tableName(ACCOUNTS_TABLE_NAME)
                    .key(key)
                    .consistentRead(true)
                    .build()).item();
            if (item == null || item.isEmpty()) {
                throw new UnauthorizedException("Account does not exist");
            }
            return item;
        }
    }

    private double extractFraudScore(String predictionResult) throws Exception {
        JsonNode node = OBJECT_MAPPER.readTree(predictionResult);
        if (node.has("fraud_probability")) {
            return node.get("fraud_probability").asDouble();
        } else {
            throw new Exception("fraud_probability not found in prediction result");
        }
    }

    private String extractAmount(JsonNode transaction) {
        if (transaction.has("amt")) {
            return transaction.get("amt").asText();
        }
        return null;
    }

    private String extractLocation(JsonNode transaction) {
        String merchant = transaction.path("merchant").asText(null);
        String city = transaction.path("city").asText(null);
        String state = transaction.path("state").asText(null);

        if (merchant == null || city == null || state == null) {
            return null; // missing info
        }

        // Remove "fraud_" prefix if it exists and uppercase merchant
        if (merchant.startsWith("fraud_")) {
            merchant = merchant.substring("fraud_".length());
        }

        return merchant.toUpperCase() + ", " + city + " " + state.toUpperCase();
    }

    private Map<String, Object> buildTransactionSummary(
            String transactionId,
            String createdAt,
            JsonNode transactionNode,
            String predictionRaw,
            double fraudScore) {
        Map<String, Object> summary = new HashMap<>();
        summary.put("transactionId", transactionId);
        summary.put("createdAt", createdAt);
        summary.put("fraudScore", fraudScore);
        summary.put("merchant", transactionNode.path("merchant").asText(null));
        summary.put("amount", extractAmount(transactionNode));
        summary.put("category", transactionNode.path("category").asText(null));
        summary.put("city", transactionNode.path("city").asText(null));
        summary.put("prediction", safeParseJson(predictionRaw));
        return summary;
    }

    protected APIGatewayProxyResponseEvent handleGetUserDetails(
            APIGatewayProxyRequestEvent event,
            Context context,
            APIGatewayProxyResponseEvent baseResponse) throws Exception {
        if (ACCOUNTS_TABLE_NAME == null || ACCOUNTS_TABLE_NAME.isBlank()) {
            throw new IllegalStateException("Accounts table not configured");
        }

        JsonNode body = parseBody(event);
        String accountId = requireText(body, "accountId");
        String password = requireText(body, "password");

        Map<String, AttributeValue> account = getAccount(accountId);
        
        // Verify password for security
        String salt = account.getOrDefault("passwordSalt", AttributeValue.builder().s("").build()).s();
        String storedHash = account.getOrDefault("passwordHash", AttributeValue.builder().s("").build()).s();
        if (salt.isBlank() || storedHash.isBlank()) {
            throw new UnauthorizedException("Account credentials not set");
        }

        String candidateHash = hashPassword(password, salt);
        if (!storedHash.equals(candidateHash)) {
            throw new UnauthorizedException("Invalid credentials");
        }

        Map<String, Object> responseBody = new HashMap<>();
        responseBody.put("accountId", accountId);
        responseBody.put("username", account.getOrDefault("username", AttributeValue.builder().s("").build()).s());
        responseBody.put("email", account.getOrDefault("email", AttributeValue.builder().s("").build()).s());
        responseBody.put("firstName", account.getOrDefault("firstName", AttributeValue.builder().s("").build()).s());
        responseBody.put("lastName", account.getOrDefault("lastName", AttributeValue.builder().s("").build()).s());
        responseBody.put("ccNum", account.getOrDefault("ccNum", AttributeValue.builder().s("").build()).s());
        responseBody.put("gender", account.getOrDefault("gender", AttributeValue.builder().s("").build()).s());
        responseBody.put("dateOfBirth", account.getOrDefault("dateOfBirth", AttributeValue.builder().s("").build()).s());
        responseBody.put("job", account.getOrDefault("job", AttributeValue.builder().s("").build()).s());
        responseBody.put("city", account.getOrDefault("city", AttributeValue.builder().s("").build()).s());
        responseBody.put("state", account.getOrDefault("state", AttributeValue.builder().s("").build()).s());
        responseBody.put("zip", account.getOrDefault("zip", AttributeValue.builder().s("").build()).s());
        responseBody.put("street", account.getOrDefault("street", AttributeValue.builder().s("").build()).s());
        responseBody.put("address", account.getOrDefault("address", AttributeValue.builder().s("").build()).s());
        responseBody.put("phoneNumber", account.getOrDefault("phoneNumber", AttributeValue.builder().s("").build()).s());
        responseBody.put("fraudThreshold", extractNumeric(account, "fraudThreshold", 0.7));
        
        if (account.containsKey("cityPopulation")) {
            responseBody.put("cityPopulation", Integer.parseInt(account.get("cityPopulation").n()));
        }
        if (account.containsKey("latitude")) {
            responseBody.put("latitude", Double.parseDouble(account.get("latitude").n()));
        }
        if (account.containsKey("longitude")) {
            responseBody.put("longitude", Double.parseDouble(account.get("longitude").n()));
        }
        
        return setResponse(baseResponse, 200, toJson(responseBody));
    }

    private Integer getCityPopulation(String city, String state, Context context) {
        return null; // Will be populated by zip-based lookup
    }

    private Integer getCityPopulationByZip(String zip, Context context) {
        try {
            String uri = String.format("https://global.metadapi.com/zipc/v1/zipcodes/%s", zip);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(uri))
                    .header("Accept", "application/json")
                    .header("Ocp-Apim-Subscription-Key", CITY_POPULATION_KEY)
                    .GET()
                    .build();
            
            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                JsonNode body = OBJECT_MAPPER.readTree(response.body());
                JsonNode data = body.path("data");
                JsonNode stats = data.path("zipCodeStatistics");
                
                if (stats.isArray() && stats.size() > 0) {
                    // Get the most recent year's population (last in array)
                    JsonNode latestStats = stats.get(stats.size() - 1);
                    int population = latestStats.path("totalPopulation").asInt();
                    context.getLogger().log(String.format("Found population %d for zip %s", population, zip));
                    return population;
                }
            }
        } catch (Exception e) {
            context.getLogger().log("Failed to get population for zip " + zip + ": " + e.getMessage());
        }
        return null;
    }



    private GeocodeResult geocodeAddress(String address, Context context) {
        if (GOOGLE_MAPS_API_KEY == null || GOOGLE_MAPS_API_KEY.isBlank()) {
            context.getLogger().log("GOOGLE_MAPS_API_KEY not configured; skipping geocoding.");
            return null;
        }
        try {
            String encodedAddress = URLEncoder.encode(address, StandardCharsets.UTF_8);
            String uri = String.format(
                    "https://maps.googleapis.com/maps/api/geocode/json?address=%s&key=%s",
                    encodedAddress,
                    GOOGLE_MAPS_API_KEY);
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(uri))
                    .GET()
                    .build();
            HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                JsonNode body = OBJECT_MAPPER.readTree(response.body());
                JsonNode results = body.path("results");
                if (results.isArray() && results.size() > 0) {
                    JsonNode location = results.get(0).path("geometry").path("location");
                    if (location.hasNonNull("lat") && location.hasNonNull("lng")) {
                        return new GeocodeResult(location.get("lat").asDouble(), location.get("lng").asDouble());
                    }
                }
                context.getLogger().log("Geocode response missing coordinates for address: " + address);
            } else {
                context.getLogger().log("Geocode request failed with status " + response.statusCode());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            context.getLogger().log("Geocode request interrupted: " + e.getMessage());
        } catch (IOException e) {
            context.getLogger().log("Geocode request failed: " + e.getMessage());
        } catch (Exception e) {
            context.getLogger().log("Unexpected geocode error: " + e.getMessage());
        }
        return null;
    }

    private record GeocodeResult(double latitude, double longitude) {
    }

    private record PersistedTransaction(String id, String createdAt) {
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
