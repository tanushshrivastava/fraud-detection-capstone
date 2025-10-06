package com.fraud.lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import software.amazon.awssdk.core.SdkBytes;
import software.amazon.awssdk.services.sagemakerruntime.SageMakerRuntimeClient;
import software.amazon.awssdk.services.sagemakerruntime.model.InvokeEndpointRequest;
import software.amazon.awssdk.services.sagemakerruntime.model.InvokeEndpointResponse;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public class FraudLambdaHandler implements RequestHandler<APIGatewayProxyRequestEvent, APIGatewayProxyResponseEvent> {

    @Override
    public APIGatewayProxyResponseEvent handleRequest(APIGatewayProxyRequestEvent event, Context context) {
        String endpointName = "fraud-detector-endpoint"; // Change to your endpoint
        APIGatewayProxyResponseEvent responseEvent = new APIGatewayProxyResponseEvent();
        try (SageMakerRuntimeClient runtime = SageMakerRuntimeClient.create()) {
            String payload = event != null ? event.getBody() : null;
            if (payload == null || payload.isEmpty()) {
                payload = "{}";
            }

            context.getLogger().log("Payload received: " + payload);

            InvokeEndpointResponse response = runtime.invokeEndpoint(
                    InvokeEndpointRequest.builder()
                            .endpointName(endpointName)
                            .contentType("application/json")
                            .body(SdkBytes.fromString(payload, StandardCharsets.UTF_8))
                            .build()
            );

            String result = response.body().asUtf8String();
            context.getLogger().log("Prediction result: " + result);

            Map<String, String> successHeaders = buildCorsHeaders();
            responseEvent.setStatusCode(200);
            responseEvent.setHeaders(successHeaders);
            responseEvent.setBody("{\"prediction\": " + result + "}");
            return responseEvent;
        } catch (Exception e) {
            context.getLogger().log("Error: " + e.getMessage());
            Map<String, String> errorHeaders = buildCorsHeaders();
            responseEvent.setStatusCode(500);
            responseEvent.setHeaders(errorHeaders);
            responseEvent.setBody("{\"error\": \"" + e.getMessage() + "\"}");
            return responseEvent;
        }
    }

    private Map<String, String> buildCorsHeaders() {
        Map<String, String> headers = new HashMap<>();
        headers.put("Content-Type", "application/json");
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Access-Control-Allow-Headers", "*");
        headers.put("Access-Control-Allow-Methods", "OPTIONS,POST");
        return headers;
    }
}
