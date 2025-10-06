package com.fraud.cdk;

import java.util.List;

import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.cloudfront.BehaviorOptions;
import software.amazon.awscdk.services.cloudfront.Distribution;
import software.amazon.awscdk.services.cloudfront.OriginAccessIdentity;
import software.amazon.awscdk.services.cloudfront.origins.S3Origin;
import software.amazon.awscdk.services.cloudfront.origins.S3OriginProps;
import software.amazon.awscdk.services.s3.BlockPublicAccess;
import software.amazon.awscdk.services.s3.Bucket;
import software.amazon.awscdk.services.s3.deployment.BucketDeployment;
import software.amazon.awscdk.services.s3.deployment.BucketDeploymentProps;
import software.amazon.awscdk.services.s3.deployment.Source;
import software.constructs.Construct;

public class FraudFrontendStack extends Stack {
    public FraudFrontendStack(final Construct scope, final String id) {
        this(scope, id, null);
    }

    public FraudFrontendStack(final Construct scope, final String id, final StackProps props) {
        super(scope, id, props);

        // Use a private bucket; CloudFront + OAI serve the SPA so S3 website hosting stays disabled.
        Bucket siteBucket = Bucket.Builder.create(this, "FraudFrontendBucket")
            .blockPublicAccess(BlockPublicAccess.BLOCK_ALL)
            .build();

        OriginAccessIdentity originAccessIdentity = new OriginAccessIdentity(this, "FrontendOAI");
        siteBucket.grantRead(originAccessIdentity.getGrantPrincipal());

        Distribution distribution = Distribution.Builder.create(this, "FraudDistribution")
    .defaultRootObject("index.html")
    .defaultBehavior(BehaviorOptions.builder()
        .origin(new S3Origin(siteBucket, S3OriginProps.builder()
            .originAccessIdentity(originAccessIdentity)
            .build()))
        .build())
    .errorResponses(List.of(
        software.amazon.awscdk.services.cloudfront.ErrorResponse.builder()
            .httpStatus(403)
            .responseHttpStatus(200)
            .responsePagePath("/index.html")
            .build(),
        software.amazon.awscdk.services.cloudfront.ErrorResponse.builder()
            .httpStatus(404)
            .responseHttpStatus(200)
            .responsePagePath("/index.html")
            .build()
    ))
    .build();

        new BucketDeployment(this, "DeployReactApp",
            BucketDeploymentProps.builder()
                .sources(List.of(Source.asset("../frontend/build")))
                .destinationBucket(siteBucket)
                .distribution(distribution)
                .distributionPaths(List.of("/*"))
                .build());

        CfnOutput.Builder.create(this, "FrontendBucketName")
            .value(siteBucket.getBucketName())
            .description("S3 bucket that backs the CloudFront distribution (not publicly accessible).")
            .build();

        CfnOutput.Builder.create(this, "CloudFrontDomain")
            .value(distribution.getDomainName())
            .description("CloudFront URL for the React frontend.")
            .build();
    }
}
