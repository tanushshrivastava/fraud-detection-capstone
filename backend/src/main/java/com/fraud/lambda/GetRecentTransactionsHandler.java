package com.fraud.lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;

/**
 * Lambda handler for retrieving recent transaction history.
 * 
 * Returns a list of recent transactions for a specific account, including
 * fraud scores, customer responses to SMS alerts, and transaction details.
 * Supports optional limit parameter to control result count.
 */
public class GetRecentTransactionsHandler extends FraudLambdaHandler {
    /**
     * Handles recent transactions retrieval.
     * 
     * @param event API Gateway request with accountId in path
     * @param context Lambda execution context
     * @param baseResponse Pre-configured response with CORS headers
     * @return Response with list of recent transactions
     */
    @Override
    protected APIGatewayProxyResponseEvent doHandle(
            APIGatewayProxyRequestEvent event,
            Context context,
            APIGatewayProxyResponseEvent baseResponse) throws Exception {
        // Only accept GET requests
        if (!"GET".equals(getNormalizedMethod(event))) {
            return setResponse(baseResponse, 405, "{\"error\":\"Method not allowed\"}");
        }
        // Extract accountId from URL path (e.g., /accounts/{accountId}/transactions)
        String accountId = resolveAccountId(event);
        if (accountId == null || accountId.isBlank()) {
            return setResponse(baseResponse, 404, "{\"error\":\"Account not specified\"}");
        }
        return handleGetRecentTransactions(accountId, event, context, baseResponse);
    }
}
