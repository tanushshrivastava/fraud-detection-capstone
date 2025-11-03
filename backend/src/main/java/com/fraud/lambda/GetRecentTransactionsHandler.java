package com.fraud.lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;

public class GetRecentTransactionsHandler extends FraudLambdaHandler {
    @Override
    protected APIGatewayProxyResponseEvent doHandle(
            APIGatewayProxyRequestEvent event,
            Context context,
            APIGatewayProxyResponseEvent baseResponse) throws Exception {
        if (!"GET".equals(getNormalizedMethod(event))) {
            return setResponse(baseResponse, 405, "{\"error\":\"Method not allowed\"}");
        }
        String accountId = resolveAccountId(event);
        if (accountId == null || accountId.isBlank()) {
            return setResponse(baseResponse, 404, "{\"error\":\"Account not specified\"}");
        }
        return handleGetRecentTransactions(accountId, event, context, baseResponse);
    }
}
