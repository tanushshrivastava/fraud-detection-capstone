package com.fraud.lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;

/**
 * Lambda handler for updating account settings.
 * 
 * Allows users to update their phone number and fraud alert threshold.
 * Accepts both PUT (full update) and PATCH (partial update) methods.
 */
public class UpdateAccountSettingsHandler extends FraudLambdaHandler {
    /**
     * Handles account settings update requests.
     * 
     * @param event API Gateway request with accountId and updated settings
     * @param context Lambda execution context
     * @param baseResponse Pre-configured response with CORS headers
     * @return Response with updated account settings
     */
    @Override
    protected APIGatewayProxyResponseEvent doHandle(
            APIGatewayProxyRequestEvent event,
            Context context,
            APIGatewayProxyResponseEvent baseResponse) throws Exception {
        String method = getNormalizedMethod(event);
        // Accept both PUT and PATCH for flexibility
        if (!"PUT".equals(method) && !"PATCH".equals(method)) {
            return setResponse(baseResponse, 405, "{\"error\":\"Method not allowed\"}");
        }
        return handleUpdateAccountSettings(event, context, baseResponse);
    }
}
