package com.fraud.cdk;

import software.amazon.awscdk.CfnOutput;
import software.amazon.awscdk.RemovalPolicy;
import software.amazon.awscdk.Stack;
import software.amazon.awscdk.StackProps;
import software.amazon.awscdk.services.dynamodb.Attribute;
import software.amazon.awscdk.services.dynamodb.AttributeType;
import software.amazon.awscdk.services.dynamodb.BillingMode;
import software.amazon.awscdk.services.dynamodb.Table;
import software.constructs.Construct;

public class FraudDataStack extends Stack {
    private final BackendEnvironment env;
    private final Table transactionsTable;

    public FraudDataStack(final Construct scope, final String id, final BackendEnvironment env) {
        this(scope, id, null, env);
    }

    public FraudDataStack(final Construct scope, final String id, final StackProps props, final BackendEnvironment env) {
        super(scope, id, props);
        this.env = env;

        String tableName = buildTableName();

        this.transactionsTable = Table.Builder.create(this, "FraudPredictionsTable")
            .tableName(tableName)
            .partitionKey(Attribute.builder()
                .name("id")
                .type(AttributeType.STRING)
                .build())
            .billingMode(BillingMode.PAY_PER_REQUEST)
            .removalPolicy(RemovalPolicy.DESTROY)
            .build();

        CfnOutput.Builder.create(this, "TransactionsTableName")
            .value(transactionsTable.getTableName())
            .description("DynamoDB table that can store fraud prediction requests and responses.")
            .build();
    }

    public Table getTransactionsTable() {
        return transactionsTable;
    }

    private String buildTableName() {
        String base = env.resourceBase();
        String candidate = base + "-transactions";
        if (candidate.length() > 255) {
            candidate = candidate.substring(0, 255);
        }
        return candidate;
    }
}
