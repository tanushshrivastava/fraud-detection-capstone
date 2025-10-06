package com.fraud.cdk;

import java.util.List;
import java.util.Map;

import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.Duration;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.apigateway.Cors;
import software.amazon.awscdk.services.apigateway.CorsOptions;
import software.amazon.awscdk.services.apigateway.LambdaRestApi;
import software.amazon.awscdk.services.iam.ManagedPolicy;
import software.amazon.awscdk.services.iam.Role;
import software.amazon.awscdk.services.iam.ServicePrincipal;
import software.amazon.awscdk.services.lambda.Code;
import software.amazon.awscdk.services.lambda.Function;
import software.amazon.awscdk.services.lambda.Runtime;
import software.amazon.awscdk.services.sagemaker.CfnEndpoint;
import software.amazon.awscdk.services.sagemaker.CfnEndpointConfig;
import software.amazon.awscdk.services.sagemaker.CfnModel;
import software.constructs.Construct;

public class BackendStack extends Stack {
    public BackendStack(final Construct scope, final String id) {
        this(scope, id, null);
    }

    public BackendStack(final Construct scope, final String id, final StackProps props) {
        super(scope, id, props);

        Role lambdaRole = Role.Builder.create(this, "FraudLambdaRole")
            .assumedBy(new ServicePrincipal("lambda.amazonaws.com"))
            .managedPolicies(List.of(
                ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
                ManagedPolicy.fromAwsManagedPolicyName("AmazonSageMakerFullAccess")
            ))
            .build();

        String roleArn = "arn:aws:iam::238679626155:role/AmazonSageMaker-ExecutionRole";
        String modelDataUrl = "s3://my-fraud-model-bucket/model/model.tar.gz";

        CfnModel fraudModel = CfnModel.Builder.create(this, "FraudModel")
            .executionRoleArn(roleArn)
            .primaryContainer(CfnModel.ContainerDefinitionProperty.builder()
                .image("683313688378.dkr.ecr.us-east-1.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3")
                .modelDataUrl(modelDataUrl)
                .environment(Map.of(
                    "SAGEMAKER_PROGRAM", "inference.py",
                    "SAGEMAKER_SUBMIT_DIRECTORY", modelDataUrl
                ))
                .build())
            .modelName("fraud-detection-model")
            .build();

        CfnEndpointConfig endpointConfig = CfnEndpointConfig.Builder.create(this, "FraudEndpointConfig")
            .productionVariants(List.of(CfnEndpointConfig.ProductionVariantProperty.builder()
                .modelName(fraudModel.getAttrModelName())
                .variantName("AllTraffic")
                .initialInstanceCount(1)
                .instanceType("ml.t2.medium")
                .initialVariantWeight(1.0)
                .build()))
            .endpointConfigName("fraud-endpoint-config")
            .build();

        CfnEndpoint.Builder.create(this, "FraudEndpoint")
            .endpointName("fraud-detector-endpoint")
            .endpointConfigName(endpointConfig.getAttrEndpointConfigName())
            .build();

        Code lambdaCode = Code.fromAsset("../backend/build/libs/fraud-backend.jar");

        Function fraudLambda = Function.Builder.create(this, "FraudLambda")
            .runtime(Runtime.JAVA_17)
            .handler("com.fraud.lambda.FraudLambdaHandler::handleRequest")
            .code(lambdaCode)
            .role(lambdaRole)
            .memorySize(512)
            .timeout(Duration.seconds(30))
            .build();

        LambdaRestApi api = LambdaRestApi.Builder.create(this, "FraudApi")
            .handler(fraudLambda)
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
    }
}
