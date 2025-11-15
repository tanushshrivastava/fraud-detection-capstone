package com.fraud.cdk;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.dynamodb.Table;
import software.amazon.awscdk.services.iam.IManagedPolicy;
import software.amazon.awscdk.services.iam.ManagedPolicy;
import software.amazon.awscdk.services.iam.Role;
import software.amazon.awscdk.services.iam.ServicePrincipal;
import software.amazon.awscdk.services.lambda.Code;
import software.amazon.awscdk.services.lambda.Function;
import software.amazon.awscdk.services.lambda.Runtime;
import software.constructs.Construct;

/**
 * Defines the Lambda functions that power the backend API.
 */
public class FraudLambdaStack extends Stack {
    private final Function createAccountFunction;
    private final Function loginFunction;
    private final Function updateAccountSettingsFunction;
    private final Function getRecentTransactionsFunction;
    private final Function submitTransactionFunction;
    private final Function twilioWebhookFunction;
    private final Function getUserDetailsFunction;
    private final Function sendEmailFunction;

    public FraudLambdaStack(final Construct scope, final String id, final FraudLambdaStackProps lambdaProps) {
        this(scope, id, null, lambdaProps);
    }

    public FraudLambdaStack(final Construct scope, final String id, final StackProps props, final FraudLambdaStackProps lambdaProps) {
        super(scope, id, props);
        Objects.requireNonNull(lambdaProps, "lambdaProps is required");
        Objects.requireNonNull(lambdaProps.endpointName(), "endpointName is required");

        Code lambdaCode = Code.fromAsset("../backend/build/libs/fraud-backend.jar");
        Table transactionsTable = lambdaProps.transactionsTable();
        Table accountsTable = lambdaProps.accountsTable();

        this.createAccountFunction = buildFunction(
            "CreateAccountLambda",
            "com.fraud.lambda.CreateAccountHandler::handleRequest",
            createRole("CreateAccountLambdaRole", false, false),
            buildEnvironment(lambdaProps, false, false, true, false, true, false),
            lambdaCode);
        if (accountsTable != null) {
            accountsTable.grantReadWriteData(createAccountFunction);
        }
        outputFunction("CreateAccountLambdaFunctionName", createAccountFunction,
            "Handles POST /accounts requests.");

        this.loginFunction = buildFunction(
            "LoginLambda",
            "com.fraud.lambda.LoginHandler::handleRequest",
            createRole("LoginLambdaRole", false, false),
            buildEnvironment(lambdaProps, false, true, true, false, false, false),
            lambdaCode);
        if (accountsTable != null) {
            accountsTable.grantReadData(loginFunction);
        }
        if (transactionsTable != null) {
            transactionsTable.grantReadData(loginFunction);
        }
        outputFunction("LoginLambdaFunctionName", loginFunction,
            "Handles POST /login requests.");

        this.updateAccountSettingsFunction = buildFunction(
            "UpdateAccountSettingsLambda",
            "com.fraud.lambda.UpdateAccountSettingsHandler::handleRequest",
            createRole("UpdateAccountSettingsLambdaRole", false, false),
            buildEnvironment(lambdaProps, false, false, true, false, false, false),
            lambdaCode);
        if (accountsTable != null) {
            accountsTable.grantReadWriteData(updateAccountSettingsFunction);
        }
        outputFunction("UpdateAccountSettingsLambdaFunctionName", updateAccountSettingsFunction,
            "Handles PUT/PATCH /accounts/settings requests.");

        this.getRecentTransactionsFunction = buildFunction(
            "GetRecentTransactionsLambda",
            "com.fraud.lambda.GetRecentTransactionsHandler::handleRequest",
            createRole("GetRecentTransactionsLambdaRole", false, false),
            buildEnvironment(lambdaProps, false, true, true, false, false, false),
            lambdaCode);
        if (accountsTable != null) {
            accountsTable.grantReadData(getRecentTransactionsFunction);
        }
        if (transactionsTable != null) {
            transactionsTable.grantReadData(getRecentTransactionsFunction);
        }
        outputFunction("GetRecentTransactionsLambdaFunctionName", getRecentTransactionsFunction,
            "Handles GET /accounts/{accountId}/transactions requests.");

        this.submitTransactionFunction = buildFunction(
            "SubmitTransactionLambda",
            "com.fraud.lambda.SubmitTransactionHandler::handleRequest",
            createRole("SubmitTransactionLambdaRole", true, false),
            buildEnvironment(lambdaProps, true, true, true, true, false, false),
            lambdaCode);
        if (accountsTable != null) {
            accountsTable.grantReadWriteData(submitTransactionFunction);
        }
        if (transactionsTable != null) {
            transactionsTable.grantReadWriteData(submitTransactionFunction);
        }
        outputFunction("SubmitTransactionLambdaFunctionName", submitTransactionFunction,
            "Handles POST /transactions requests.");

        this.twilioWebhookFunction = buildFunction(
            "TwilioWebhookLambda",
            "com.fraud.lambda.TwilioWebhookHandler::handleRequest",
            createRole("TwilioWebhookLambdaRole", false, false),
            buildEnvironment(lambdaProps, false, true, false, true, false, false),
            lambdaCode);
        if (transactionsTable != null) {
            transactionsTable.grantReadWriteData(twilioWebhookFunction);
        }
        outputFunction("TwilioWebhookLambdaFunctionName", twilioWebhookFunction,
            "Handles POST /webhook/twilio requests.");

        this.getUserDetailsFunction = buildFunction(
            "GetUserDetailsLambda",
            "com.fraud.lambda.GetUserDetailsHandler::handleRequest",
            createRole("GetUserDetailsLambdaRole", false, false),
            buildEnvironment(lambdaProps, false, false, true, false, false, false),
            lambdaCode);
        if (accountsTable != null) {
            accountsTable.grantReadData(getUserDetailsFunction);
        }
        outputFunction("GetUserDetailsLambdaFunctionName", getUserDetailsFunction,
            "Handles POST /user-details requests.");

        this.sendEmailFunction = buildFunction(
            "SendEmailLambda",
            "com.fraud.lambda.SendEmailHandler::handleRequest",
            createRole("SendEmailLambdaRole", false, true),
            buildEnvironment(lambdaProps, false, false, false, false, false, true),
            lambdaCode);
        outputFunction("SendEmailLambdaFunctionName", sendEmailFunction,
            "Handles POST /send-email requests.");
    }

    public Function getCreateAccountFunction() {
        return createAccountFunction;
    }

    public Function getLoginFunction() {
        return loginFunction;
    }

    public Function getUpdateAccountSettingsFunction() {
        return updateAccountSettingsFunction;
    }

    public Function getGetRecentTransactionsFunction() {
        return getRecentTransactionsFunction;
    }

    public Function getSubmitTransactionFunction() {
        return submitTransactionFunction;
    }

    public Function getTwilioWebhookFunction() {
        return twilioWebhookFunction;
    }

    public Function getUserDetailsFunction() {
        return getUserDetailsFunction;
    }

    public Function getSendEmailFunction() {
        return sendEmailFunction;
    }

    private Function buildFunction(
            String id,
            String handler,
            Role role,
            Map<String, String> environment,
            Code code) {
        return Function.Builder.create(this, id)
            .runtime(Runtime.JAVA_17)
            .handler(handler)
            .code(code)
            .role(role)
            .environment(environment)
            .memorySize(512)
            .timeout(Duration.seconds(30))
            .build();
    }

    private Role createRole(String id, boolean includeSagemaker, boolean includeSes) {
        List<IManagedPolicy> policies = new ArrayList<>();
        policies.add(ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));
        if (includeSagemaker) {
            policies.add(ManagedPolicy.fromAwsManagedPolicyName("AmazonSageMakerFullAccess"));
        }
        if (includeSes) {
            policies.add(ManagedPolicy.fromAwsManagedPolicyName("AmazonSESFullAccess"));
        }
        return Role.Builder.create(this, id)
            .assumedBy(new ServicePrincipal("lambda.amazonaws.com"))
            .managedPolicies(policies)
            .build();
    }

    private Map<String, String> buildEnvironment(
            FraudLambdaStackProps props,
            boolean includeEndpoint,
            boolean includeTransactionsTable,
            boolean includeAccountsTable,
            boolean includeTwilio,
            boolean includeGoogleMaps,
            boolean includeFromEmail) {
        Map<String, String> environment = new HashMap<>();
        if (includeEndpoint) {
            environment.put("SAGEMAKER_ENDPOINT_NAME", props.endpointName());
        }
        if (includeTransactionsTable && props.transactionsTable() != null) {
            environment.put("TRANSACTION_TABLE_NAME", props.transactionsTable().getTableName());
        }
        if (includeAccountsTable && props.accountsTable() != null) {
            environment.put("ACCOUNTS_TABLE_NAME", props.accountsTable().getTableName());
        }
        if (includeTwilio) {
            EnvConfig.get("TWILIO_ACCOUNT_SID").ifPresent(sid -> environment.put("TWILIO_ACCOUNT_SID", sid));
            EnvConfig.get("TWILIO_AUTH_TOKEN").ifPresent(token -> environment.put("TWILIO_AUTH_TOKEN", token));
            EnvConfig.get("TWILIO_PHONE_NUMBER").ifPresent(phone -> environment.put("TWILIO_PHONE_NUMBER", phone));
        }
        if (includeGoogleMaps) {
            EnvConfig.get("GOOGLE_MAPS_API_KEY").ifPresent(key -> environment.put("GOOGLE_MAPS_API_KEY", key));
            EnvConfig.get("CITY_POPULATION_KEY").ifPresent(key -> environment.put("CITY_POPULATION_KEY", key));
        }
        if (includeFromEmail) {
            EnvConfig.get("FROM_EMAIL").ifPresent(email -> environment.put("FROM_EMAIL", email));
        }
        return environment;
    }

    private void outputFunction(String id, Function function, String description) {
        CfnOutput.Builder.create(this, id)
            .value(function.getFunctionName())
            .description(description)
            .build();
    }

    /**
     * Carrier for the resources the Lambda stack needs from its dependencies.
     */
    public record FraudLambdaStackProps(String endpointName, Table transactionsTable, Table accountsTable) { }
}
