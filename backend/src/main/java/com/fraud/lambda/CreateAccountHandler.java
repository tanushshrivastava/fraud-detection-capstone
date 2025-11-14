package com.fraud.lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;

/**
 * Lambda handler for creating new user accounts.
 * 
 * Accepts user registration data including personal information, credit card details,
 * and address. Auto-populates city population from zip code API and geocodes the address.
 * Stores hashed password and returns the new accountId.
 */
public class CreateAccountHandler extends FraudLambdaHandler {
    /**
     * Handles account creation requests.
     * 
     * @param event API Gateway request with user registration data
     * @param context Lambda execution context
     * @param baseResponse Pre-configured response with CORS headers
     * @return Response containing new accountId and populated fields
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
        return handleCreateAccount(event, context, baseResponse);
    }
}
