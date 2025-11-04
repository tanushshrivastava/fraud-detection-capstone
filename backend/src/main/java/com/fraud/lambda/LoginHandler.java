package com.fraud.lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;

public class LoginHandler extends FraudLambdaHandler {
    @Override
    protected APIGatewayProxyResponseEvent doHandle(
            APIGatewayProxyRequestEvent event,
            Context context,
            APIGatewayProxyResponseEvent baseResponse) throws Exception {
        if (!"POST".equals(getNormalizedMethod(event))) {
            return setResponse(baseResponse, 405, "{\"error\":\"Method not allowed\"}");
        }
        return handleLogin(event, context, baseResponse);
    }
}
