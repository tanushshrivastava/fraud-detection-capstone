package com.fraud.cdk;

import software.amazon.awscdk.App;
import software.amazon.awscdk.Environment;
import software.amazon.awscdk.StackProps;

/**
 * CDK entry point that stitches the individual stacks together into a deployable app.
 */
public class AppMain {
    public static void main(String[] args) {
        App app = new App();

        // Resolve the AWS account/region with explicit overrides winning over CDK defaults.
        String account = EnvConfig.get("AWS_ACCOUNT_ID")
            .orElse(System.getenv("CDK_DEFAULT_ACCOUNT"));
        String region = EnvConfig.get("AWS_REGION")
            .orElse(System.getenv("CDK_DEFAULT_REGION"));

        StackProps.Builder propsBuilder = StackProps.builder();
        if (account != null && region != null) {
            propsBuilder.env(Environment.builder()
                .account(account)
                .region(region)
                .build());
        }
        StackProps stackProps = propsBuilder.build();

        String suffix = EnvConfig.getStackSuffix().orElse(null);

        BackendEnvironment backendEnv = new BackendEnvironment(
            appendSuffix("FraudBackendStack", suffix),
            suffix,
            account,
            region
        );

        FraudEndpointStack endpointStack = new FraudEndpointStack(
            app,
            appendSuffix("FraudEndpointStack", suffix),
            stackProps,
            backendEnv
        );

        FraudDataStack dataStack = new FraudDataStack(
            app,
            appendSuffix("FraudDataStack", suffix),
            stackProps,
            backendEnv
        );

        FraudLambdaStack lambdaStack = new FraudLambdaStack(
            app,
            appendSuffix("FraudLambdaStack", suffix),
            stackProps,
            new FraudLambdaStack.FraudLambdaStackProps(
                endpointStack.getEndpointName(),
                dataStack.getTransactionsTable(),
                dataStack.getAccountsTable()
            )
        );

        FraudApiStack apiStack = new FraudApiStack(
            app,
            appendSuffix("FraudApiStack", suffix),
            stackProps,
            backendEnv,
            lambdaStack.getCreateAccountFunction(),
            lambdaStack.getLoginFunction(),
            lambdaStack.getUpdateAccountSettingsFunction(),
            lambdaStack.getGetRecentTransactionsFunction(),
            lambdaStack.getSubmitTransactionFunction(),
            lambdaStack.getTwilioWebhookFunction()
        );

        // Express dependencies so CDK deploys stacks in the correct order.
        lambdaStack.addDependency(endpointStack);
        lambdaStack.addDependency(dataStack);
        apiStack.addDependency(lambdaStack);
        // Frontend stacks do not depend on the backend resources.
        new FraudFrontendStack(app, appendSuffix("FraudFrontendStack", suffix), stackProps);
        new FraudWebFrontendStack(app, appendSuffix("FraudWebFrontendStack", suffix), stackProps);

        app.synth();
    }

    /**
     * Append a stack suffix when present to keep resource names consistent.
     */
    private static String appendSuffix(String baseName, String suffix) {
        if (suffix == null) {
            return baseName;
        }
        return baseName + "-" + suffix;
    }
}
