package com.fraud.lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;

/**
 * Lambda handler for receiving SMS responses from Twilio.
 * 
 * This webhook receives incoming SMS messages from customers responding to fraud alerts.
 * Parses YES/NO responses, updates the transaction record with customer feedback,
 * and sends a confirmation message back to the customer.
 * 
 * Twilio sends form-encoded data, not JSON.
 */
public class TwilioWebhookHandler extends FraudLambdaHandler {
    /**
     * Handles incoming Twilio webhook requests.
     * 
     * @param event API Gateway request with form-encoded SMS data from Twilio
     * @param context Lambda execution context
     * @param baseResponse Pre-configured response with CORS headers
     * @return TwiML response for Twilio
     */
    @Override
    protected APIGatewayProxyResponseEvent doHandle(
            APIGatewayProxyRequestEvent event,
            Context context,
            APIGatewayProxyResponseEvent baseResponse) throws Exception {
        // Only accept POST requests from Twilio
        if (!"POST".equals(getNormalizedMethod(event))) {
            return setResponse(baseResponse, 405, "{\"error\":\"Method not allowed\"}");
        }
        return handleTwilioWebhook(event, context, baseResponse);
    }
}
