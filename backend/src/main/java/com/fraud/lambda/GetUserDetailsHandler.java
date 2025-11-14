package com.fraud.lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;

/**
 * Lambda handler for retrieving complete user account details.
 * 
 * This is a SECURE endpoint that requires password verification before returning
 * sensitive information including credit card numbers. Used when the mobile app
 * needs to display or update user profile information.
 */
public class GetUserDetailsHandler extends FraudLambdaHandler {
    /**
     * Handles secure user details retrieval.
     * 
     * @param event API Gateway request with accountId and password
     * @param context Lambda execution context
     * @param baseResponse Pre-configured response with CORS headers
     * @return Response with complete user profile including sensitive data
     */
    @Override
    protected APIGatewayProxyResponseEvent doHandle(
            APIGatewayProxyRequestEvent event,
            Context context,
            APIGatewayProxyResponseEvent baseResponse) throws Exception {
        // Only accept POST requests (password in body for security)
        if (!"POST".equals(getNormalizedMethod(event))) {
            return setResponse(baseResponse, 405, "{\"error\":\"Method not allowed\"}");
        }
        return handleGetUserDetails(event, context, baseResponse);
    }
}