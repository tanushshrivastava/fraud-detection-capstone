package com.fraud.cdk;

import software.amazon.awscdk.App;
import software.amazon.awscdk.Environment;
import software.amazon.awscdk.StackProps;

public class AppMain {
    public static void main(String[] args) {
        App app = new App();

        String account = System.getenv("CDK_DEFAULT_ACCOUNT");
        String region = System.getenv("CDK_DEFAULT_REGION");

        StackProps.Builder propsBuilder = StackProps.builder();
        if (account != null && region != null) {
            propsBuilder.env(Environment.builder()
                .account(account)
                .region(region)
                .build());
        }
        StackProps stackProps = propsBuilder.build();

        new BackendStack(app, "FraudBackendStack", stackProps);
        new FraudFrontendStack(app, "FraudFrontendStack", stackProps);

        app.synth();
    }
}
