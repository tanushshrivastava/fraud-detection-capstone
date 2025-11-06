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

/**
 * Deploys the public-facing web frontend (frontend-web) to S3 + CloudFront.
 * This is the no-authentication version for public transaction testing.
 */
public class FraudWebFrontendStack extends Stack {
    public FraudWebFrontendStack(final Construct scope, final String id) {
        this(scope, id, null);
    }

    public FraudWebFrontendStack(final Construct scope, final String id, final StackProps props) {
        super(scope, id, props);

        // Create private S3 bucket for the web frontend
        Bucket webBucket = Bucket.Builder.create(this, "FraudWebFrontendBucket")
            .blockPublicAccess(BlockPublicAccess.BLOCK_ALL)
            .build();

        // CloudFront origin access identity allows the distribution to read from the private bucket
        OriginAccessIdentity webOAI = new OriginAccessIdentity(this, "WebFrontendOAI");
        webBucket.grantRead(webOAI.getGrantPrincipal());

        // CloudFront distribution for the web frontend
        Distribution webDistribution = Distribution.Builder.create(this, "FraudWebDistribution")
            .defaultRootObject("index.html")
            .defaultBehavior(BehaviorOptions.builder()
                .origin(new S3Origin(webBucket, S3OriginProps.builder()
                    .originAccessIdentity(webOAI)
                    .build()))
                .build())
            // Handle SPA routing - redirect 404/403 to index.html for client-side routing
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

        // Deploy the built React app to S3 and invalidate CloudFront cache
        new BucketDeployment(this, "DeployWebReactApp",
            BucketDeploymentProps.builder()
                .sources(List.of(Source.asset("../frontend-web/build")))
                .destinationBucket(webBucket)
                .distribution(webDistribution)
                .distributionPaths(List.of("/*"))
                .build());

        // Output the CloudFront URL for easy access
        CfnOutput.Builder.create(this, "WebFrontendURL")
            .value("https://" + webDistribution.getDomainName())
            .description("Public web frontend URL (no authentication required)")
            .build();

        CfnOutput.Builder.create(this, "WebFrontendBucketName")
            .value(webBucket.getBucketName())
            .description("S3 bucket backing the web frontend CloudFront distribution")
            .build();
    }
}
