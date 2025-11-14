package com.fraud.lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;

/**
 * Lambda handler for submitting transactions for fraud detection.
 * 
 * This handler receives transaction data (merchant details only), auto-populates
 * personal information from the user's account, sends the complete transaction
 * to the SageMaker fraud detection model, and returns the fraud score.
 * 
 * If the fraud score exceeds the user's threshold, an SMS alert is sent via Twilio.
 */
public class SubmitTransactionHandler extends FraudLambdaHandler {
    /**
     * Handles incoming API Gateway requests for transaction submission.
     * 
     * @param event API Gateway request containing accountId and merchant details
     * @param context Lambda execution context for logging
     * @param baseResponse Pre-configured response object with CORS headers
     * @return API Gateway response with fraud score and SMS status
     * @throws Exception if transaction processing fails
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
        // Delegate to the main transaction handler in FraudLambdaHandler
        return handleTransaction(event, context, baseResponse);
    }
}
