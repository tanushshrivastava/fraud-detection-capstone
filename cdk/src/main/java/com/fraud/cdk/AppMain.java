package com.fraud.cdk;

import software.amazon.awscdk.App;
import software.amazon.awscdk.Environment;
import software.amazon.awscdk.StackProps;

public class AppMain {
    public static void main(String[] args) {
        App app = new App();

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
                dataStack.getTransactionsTable()
            )
        );

        FraudApiStack apiStack = new FraudApiStack(
            app,
            appendSuffix("FraudApiStack", suffix),
            stackProps,
            backendEnv,
            lambdaStack.getFraudLambda()
        );

        lambdaStack.addDependency(endpointStack);
        lambdaStack.addDependency(dataStack);
        apiStack.addDependency(lambdaStack);
        new FraudFrontendStack(app, appendSuffix("FraudFrontendStack", suffix), stackProps);

        app.synth();
    }

    private static String appendSuffix(String baseName, String suffix) {
        if (suffix == null) {
            return baseName;
        }
        return baseName + "-" + suffix;
    }
}
