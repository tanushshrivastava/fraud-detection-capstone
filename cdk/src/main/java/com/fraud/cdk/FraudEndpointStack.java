package com.fraud.cdk;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.Token;
import software.amazon.awscdk.services.iam.IRole;
import software.amazon.awscdk.services.iam.ManagedPolicy;
import software.amazon.awscdk.services.iam.Role;
import software.amazon.awscdk.services.iam.FromRoleArnOptions;
import software.amazon.awscdk.services.iam.ServicePrincipal;
import software.amazon.awscdk.services.s3.Bucket;
import software.amazon.awscdk.services.s3.IBucket;
import software.amazon.awscdk.services.sagemaker.CfnEndpoint;
import software.amazon.awscdk.services.sagemaker.CfnEndpointConfig;
import software.amazon.awscdk.services.sagemaker.CfnModel;
import software.constructs.Construct;

public class FraudEndpointStack extends Stack {
    private final BackendEnvironment env;
    private final CfnEndpoint endpoint;
    private final String modelDataUrl;

    public FraudEndpointStack(final Construct scope, final String id, final BackendEnvironment env) {
        this(scope, id, null, env);
    }

    public FraudEndpointStack(final Construct scope, final String id, final StackProps props, final BackendEnvironment env) {
        super(scope, id, props);
        this.env = env;

        Map<String, String> placeholders = env.placeholders();

        Role createdSagemakerRole = null;
        IRole sagemakerRole;
        String roleArn = resolveSagemakerRoleArn(placeholders);
        if (roleArn == null) {
            createdSagemakerRole = createSagemakerRole();
            roleArn = createdSagemakerRole.getRoleArn();
            sagemakerRole = createdSagemakerRole;
        } else {
            sagemakerRole = Role.fromRoleArn(this, "ImportedSageMakerExecutionRole", roleArn,
                FromRoleArnOptions.builder()
                    .mutable(false)
                    .build());
        }

        String bucketName = buildDefaultBucketName();
        if (bucketName == null) {
            throw new IllegalStateException("Unable to determine trained model bucket name. Ensure AWS_ACCOUNT_ID and AWS_REGION are set.");
        }
        IBucket modelBucket = Bucket.fromBucketName(this, "FraudModelBucket", bucketName);

        String objectPrefix = "user-" + env.resourceBase();
        String defaultObjectKey = objectPrefix + "/model.tar.gz";
        String objectKey = EnvConfig.getWithTokens("MODEL_OBJECT_KEY", placeholders)
            .orElse(defaultObjectKey);
        String resolvedModelDataUrl = String.format("s3://%s/%s", bucketName, objectKey);

        String imageUri = EnvConfig.get("SAGEMAKER_IMAGE_URI")
            .orElse("683313688378.dkr.ecr.us-east-1.amazonaws.com/sagemaker-scikit-learn:1.2-1-cpu-py3");
        String modelName = EnvConfig.getWithTokens("SAGEMAKER_MODEL_NAME", placeholders)
            .orElse(env.sagemakerName("model"));
        String endpointConfigName = EnvConfig.getWithTokens("SAGEMAKER_ENDPOINT_CONFIG_NAME", placeholders)
            .orElse(env.sagemakerName("endpoint-config"));
        String endpointName = EnvConfig.getWithTokens("SAGEMAKER_ENDPOINT_NAME", placeholders)
            .orElse(env.sagemakerName("endpoint"));

        CfnModel fraudModel = CfnModel.Builder.create(this, "FraudModel")
            .executionRoleArn(roleArn)
            .primaryContainer(CfnModel.ContainerDefinitionProperty.builder()
                .image(imageUri)
                .modelDataUrl(resolvedModelDataUrl)
                .environment(Map.of(
                    "SAGEMAKER_PROGRAM", "inference.py",
                    "SAGEMAKER_SUBMIT_DIRECTORY", resolvedModelDataUrl
                ))
                .build())
            .modelName(modelName)
            .build();

        modelBucket.grantRead(sagemakerRole);

        CfnEndpointConfig endpointConfig = CfnEndpointConfig.Builder.create(this, "FraudEndpointConfig")
            .productionVariants(List.of(CfnEndpointConfig.ProductionVariantProperty.builder()
                .modelName(fraudModel.getAttrModelName())
                .variantName("AllTraffic")
                .initialInstanceCount(1)
                .instanceType("ml.t2.medium")
                .initialVariantWeight(1.0)
                .build()))
            .endpointConfigName(endpointConfigName)
            .build();

        this.endpoint = CfnEndpoint.Builder.create(this, "FraudEndpoint")
            .endpointName(endpointName)
            .endpointConfigName(endpointConfig.getAttrEndpointConfigName())
            .build();
        this.modelDataUrl = resolvedModelDataUrl;

        CfnOutput.Builder.create(this, "ModelArtifactLocation")
            .value(resolvedModelDataUrl)
            .description("S3 URI containing the SageMaker model artifact.")
            .build();
        CfnOutput.Builder.create(this, "SageMakerEndpointName")
            .value(endpoint.getAttrEndpointName())
            .description("Name of the SageMaker endpoint used by the Lambda function.")
            .build();

        if (createdSagemakerRole != null) {
            CfnOutput.Builder.create(this, "SageMakerExecutionRoleArn")
                .value(createdSagemakerRole.getRoleArn())
                .description("SageMaker execution role created by this stack.")
                .build();
        }
    }

    public String getEndpointName() {
        return endpoint.getAttrEndpointName();
    }

    public String getModelDataUrl() {
        return modelDataUrl;
    }

    private String resolveSagemakerRoleArn(Map<String, String> placeholders) {
        String roleArn = EnvConfig.getWithTokens("SAGEMAKER_EXECUTION_ROLE_ARN", placeholders).orElse(null);
        if (roleArn != null) {
            return roleArn;
        }
        Optional<String> roleName = EnvConfig.getWithTokens("SAGEMAKER_EXECUTION_ROLE_NAME", placeholders);
        String accountId = env.accountId();
        if (roleName.isPresent() && accountId != null && !Token.isUnresolved(accountId)) {
            return String.format("arn:aws:iam::%s:role/%s", accountId, roleName.get());
        }
        return null;
    }

    private Role createSagemakerRole() {
        return Role.Builder.create(this, "FraudSageMakerExecutionRole")
            .assumedBy(new ServicePrincipal("sagemaker.amazonaws.com"))
            .managedPolicies(List.of(
                ManagedPolicy.fromAwsManagedPolicyName("AmazonSageMakerFullAccess"),
                ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess")
            ))
            .build();
    }

    private String buildDefaultBucketName() {
        String account = env.accountId();
        String region = env.region();

        if (account == null || account.isBlank() || Token.isUnresolved(account)) {
            return null;
        }
        if (region == null || region.isBlank() || Token.isUnresolved(region)) {
            return null;
        }

        return String.format("trained-data-%s-%s", account, region).toLowerCase(Locale.ROOT);
    }
}
