package com.fraud.cdk;

import java.util.List;
import java.util.Objects;

import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.apigateway.Cors;
import software.amazon.awscdk.services.apigateway.CorsOptions;
import software.amazon.awscdk.services.apigateway.LambdaRestApi;
import software.amazon.awscdk.services.lambda.Function;
import software.constructs.Construct;

public class FraudApiStack extends Stack {
    private final LambdaRestApi api;

    public FraudApiStack(final Construct scope, final String id, final BackendEnvironment env, final Function handler) {
        this(scope, id, null, env, handler);
    }

    public FraudApiStack(final Construct scope, final String id, final StackProps props, final BackendEnvironment env, final Function handler) {
        super(scope, id, props);
        Objects.requireNonNull(handler, "handler is required");

        String restApiName = env.stackSuffix().isBlank()
            ? "FraudDetectionApi"
            : String.format("FraudDetectionApi-%s", env.stackSuffix());

        this.api = LambdaRestApi.Builder.create(this, "FraudApi")
            .restApiName(restApiName)
            .handler(handler)
            .proxy(true)
            .defaultCorsPreflightOptions(CorsOptions.builder()
                .allowOrigins(Cors.ALL_ORIGINS)
                .allowMethods(Cors.ALL_METHODS)
                .allowHeaders(List.of("*"))
                .build())
            .build();

        CfnOutput.Builder.create(this, "ApiEndpoint")
            .value(api.getUrl())
            .description("Invoke URL for the fraud detection API.")
            .build();
        CfnOutput.Builder.create(this, "ApiGatewayId")
            .value(api.getRestApiId())
            .description("API Gateway REST API id (useful for frontend configuration).")
            .build();
    }

    public LambdaRestApi getApi() {
        return api;
    }
}
