package com.fraud.cdk;

import java.util.List;
import java.util.Objects;

import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.apigateway.Cors;
import software.amazon.awscdk.services.apigateway.CorsOptions;
import software.amazon.awscdk.services.apigateway.LambdaIntegration;
import software.amazon.awscdk.services.apigateway.RestApi;
import software.amazon.awscdk.services.apigateway.Resource;
import software.amazon.awscdk.services.lambda.Function;
import software.constructs.Construct;

/**
 * Exposes the fraud detection Lambda through an API Gateway with permissive CORS defaults.
 */
public class FraudApiStack extends Stack {
    private final RestApi api;

    public FraudApiStack(
            final Construct scope,
            final String id,
            final BackendEnvironment env,
            final Function createAccountHandler,
            final Function loginHandler,
            final Function updateAccountSettingsHandler,
            final Function getRecentTransactionsHandler,
            final Function submitTransactionHandler,
            final Function twilioWebhookHandler,
            final Function getUserDetailsHandler,
            final Function sendEmailHandler) {
        this(
            scope,
            id,
            null,
            env,
            createAccountHandler,
            loginHandler,
            updateAccountSettingsHandler,
            getRecentTransactionsHandler,
            submitTransactionHandler,
            twilioWebhookHandler,
            getUserDetailsHandler,
            sendEmailHandler);
    }

    public FraudApiStack(
            final Construct scope,
            final String id,
            final StackProps props,
            final BackendEnvironment env,
            final Function createAccountHandler,
            final Function loginHandler,
            final Function updateAccountSettingsHandler,
            final Function getRecentTransactionsHandler,
            final Function submitTransactionHandler,
            final Function twilioWebhookHandler,
            final Function getUserDetailsHandler,
            final Function sendEmailHandler) {
        super(scope, id, props);
        Objects.requireNonNull(createAccountHandler, "createAccountHandler is required");
        Objects.requireNonNull(loginHandler, "loginHandler is required");
        Objects.requireNonNull(updateAccountSettingsHandler, "updateAccountSettingsHandler is required");
        Objects.requireNonNull(getRecentTransactionsHandler, "getRecentTransactionsHandler is required");
        Objects.requireNonNull(submitTransactionHandler, "submitTransactionHandler is required");
        Objects.requireNonNull(twilioWebhookHandler, "twilioWebhookHandler is required");
        Objects.requireNonNull(getUserDetailsHandler, "getUserDetailsHandler is required");
        Objects.requireNonNull(sendEmailHandler, "sendEmailHandler is required");

        String restApiName = env.stackSuffix().isBlank()
            ? "FraudDetectionApi"
            : String.format("FraudDetectionApi-%s", env.stackSuffix());

        this.api = RestApi.Builder.create(this, "FraudApi")
            .restApiName(restApiName)
            .deployOptions(software.amazon.awscdk.services.apigateway.StageOptions.builder()
                .loggingLevel(software.amazon.awscdk.services.apigateway.MethodLoggingLevel.INFO)
                .dataTraceEnabled(true)
                .metricsEnabled(true)
                .build())
            .defaultCorsPreflightOptions(CorsOptions.builder()
                .allowOrigins(Cors.ALL_ORIGINS)
                .allowMethods(Cors.ALL_METHODS)
                .allowHeaders(List.of("*"))
                .build())
            .build();

        Resource accounts = api.getRoot().addResource("accounts");
        accounts.addMethod("POST", new LambdaIntegration(createAccountHandler));

        Resource login = api.getRoot().addResource("login");
        login.addMethod("POST", new LambdaIntegration(loginHandler));

        Resource accountSettings = accounts.addResource("settings");
        accountSettings.addMethod("PUT", new LambdaIntegration(updateAccountSettingsHandler));
        accountSettings.addMethod("PATCH", new LambdaIntegration(updateAccountSettingsHandler));

        Resource accountId = accounts.addResource("{accountId}");
        Resource transactionsForAccount = accountId.addResource("transactions");
        transactionsForAccount.addMethod("GET", new LambdaIntegration(getRecentTransactionsHandler));

        Resource transactions = api.getRoot().addResource("transactions");
        transactions.addMethod("POST", new LambdaIntegration(submitTransactionHandler));

        Resource webhook = api.getRoot().addResource("webhook");
        Resource twilio = webhook.addResource("twilio");
        twilio.addMethod("POST", new LambdaIntegration(twilioWebhookHandler));

        Resource userDetails = api.getRoot().addResource("user-details");
        userDetails.addMethod("POST", new LambdaIntegration(getUserDetailsHandler));

        Resource sendEmail = api.getRoot().addResource("send-email");
        sendEmail.addMethod("POST", new LambdaIntegration(sendEmailHandler));

        CfnOutput.Builder.create(this, "ApiEndpoint")
            .value(api.getUrl())
            .description("Invoke URL for the fraud detection API.")
            .build();
        CfnOutput.Builder.create(this, "ApiGatewayId")
            .value(api.getRestApiId())
            .description("API Gateway REST API id (useful for frontend configuration).")
            .build();
    }

    /** @return The API Gateway resource so other stacks can grant permissions. */
    public RestApi getApi() {
        return api;
    }
}
