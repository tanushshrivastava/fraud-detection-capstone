package com.fraud.cdk;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.dynamodb.Table;
import software.amazon.awscdk.services.iam.ManagedPolicy;
import software.amazon.awscdk.services.iam.Role;
import software.amazon.awscdk.services.iam.ServicePrincipal;
import software.amazon.awscdk.services.lambda.Code;
import software.amazon.awscdk.services.lambda.Function;
import software.amazon.awscdk.services.lambda.Runtime;
import software.constructs.Construct;

/**
 * Defines the Lambda function that brokers API Gateway requests to SageMaker.
 */
public class FraudLambdaStack extends Stack {
    private final Function fraudLambda;

    public FraudLambdaStack(final Construct scope, final String id, final FraudLambdaStackProps lambdaProps) {
        this(scope, id, null, lambdaProps);
    }

    public FraudLambdaStack(final Construct scope, final String id, final StackProps props, final FraudLambdaStackProps lambdaProps) {
        super(scope, id, props);
        Objects.requireNonNull(lambdaProps, "lambdaProps is required");
        String endpointName = Objects.requireNonNull(lambdaProps.endpointName(), "endpointName is required");

        Role lambdaRole = Role.Builder.create(this, "FraudLambdaRole")
            .assumedBy(new ServicePrincipal("lambda.amazonaws.com"))
            .managedPolicies(List.of(
                ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
                ManagedPolicy.fromAwsManagedPolicyName("AmazonSageMakerFullAccess")
            ))
            .build();

        Code lambdaCode = Code.fromAsset("../backend/build/libs/fraud-backend.jar");

        Map<String, String> environment = new HashMap<>();
        // The Lambda function needs to know which endpoint/Table resources to talk to.
        environment.put("SAGEMAKER_ENDPOINT_NAME", endpointName);

        Table transactionsTable = lambdaProps.transactionsTable();
        if (transactionsTable != null) {
            environment.put("TRANSACTION_TABLE_NAME", transactionsTable.getTableName());
        }

        this.fraudLambda = Function.Builder.create(this, "FraudLambda")
            .runtime(Runtime.JAVA_17)
            .handler("com.fraud.lambda.FraudLambdaHandler::handleRequest")
            .code(lambdaCode)
            .role(lambdaRole)
            .environment(environment)
            .memorySize(512)
            .timeout(Duration.seconds(30))
            .build();

        if (transactionsTable != null) {
            // Allow Lambda to persist request/response records when a table is supplied.
            transactionsTable.grantReadWriteData(fraudLambda);
        }

        CfnOutput.Builder.create(this, "FraudLambdaFunctionName")
            .value(fraudLambda.getFunctionName())
            .description("Lambda function that proxies requests to the SageMaker endpoint.")
            .build();
    }

    /** @return The Lambda function that the API and other stacks depend on. */
    public Function getFraudLambda() {
        return fraudLambda;
    }

    /**
     * Carrier for the resources the Lambda stack needs from its dependencies.
     */
    public record FraudLambdaStackProps(String endpointName, Table transactionsTable) { }
}
