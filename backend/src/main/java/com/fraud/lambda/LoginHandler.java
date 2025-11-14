package com.fraud.lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;

/**
 * Lambda handler for user authentication.
 * 
 * Accepts username/accountId and password, verifies credentials by comparing
 * hashed passwords, and returns account details with recent transactions on success.
 */
public class LoginHandler extends FraudLambdaHandler {
    /**
     * Handles login requests.
     * 
     * @param event API Gateway request with username/accountId and password
     * @param context Lambda execution context
     * @param baseResponse Pre-configured response with CORS headers
     * @return Response with account details and recent transactions
     */
    @Override
    protected APIGatewayProxyResponseEvent doHandle(
            APIGatewayProxyRequestEvent event,
            Context context,
            APIGatewayProxyResponseEvent baseResponse) throws Exception {
        // Only accept POST requests
        if (!"POST".equals(getNormalizedMethod(event))) {
            return setResponse(baseResponse, 405, "{\"error\":\"Method not allowed\"}");
        }
        return handleLogin(event, context, baseResponse);
    }
}
