import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Chip, SegmentedButtons, Text } from "react-native-paper";
import SectionCard from "@/components/SectionCard";
import { spacing, palette } from "@/styles/theme";
import { formatCurrency, formatDateTime, riskLabel } from "@/utils/formatters";

const LIMIT_OPTIONS = [
  { value: "5", label: "5" },
  { value: "10", label: "10" },
  { value: "20", label: "20" }
];

const RecentActivityPanel = ({
  account,
  transactions,
  onRefresh,
  isLoading
}) => {
  const [limit, setLimit] = useState("10");
  const hasTransactions = transactions?.length > 0;

  const handleRefresh = () => {
    const numericLimit = Number(limit);
    onRefresh(numericLimit);
  };

  if (!account?.accountId) {
    return (
      <SectionCard
        title="Recent Activity"
        subtitle="Sign in to view the latest transactions and risk decisions."
      >
        <Text style={styles.helperText}>
          Transactions for your account will appear here after you sign in.
        </Text>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="Recent Activity"
      subtitle="Keep an eye on the most recent transactions and review risk scores."
      actions={
        <SegmentedButtons
          value={limit}
          onValueChange={setLimit}
          buttons={LIMIT_OPTIONS}
        />
      }
    >
      <View style={styles.container}>
        <Button
          mode="outlined"
          onPress={handleRefresh}
          loading={isLoading}
          disabled={isLoading}
        >
          Refresh
        </Button>
        {hasTransactions ? (
          <View style={styles.list}>
            {transactions.map((transaction, index) => {
              const score = transaction.fraudScore ?? transaction.score;
              const threshold =
                transaction.fraudThreshold ?? account.fraudThreshold;

              return (
                <View key={`${transaction.transactionId ?? index}`} style={styles.listItem}>
                  <View style={styles.listHeader}>
                    <Text variant="titleSmall" style={styles.listTitle}>
                      {transaction.merchant ?? "Unknown Merchant"}
                    </Text>
                    <Text variant="bodyMedium" style={styles.amount}>
                      {formatCurrency(transaction.amount)}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text variant="bodySmall" style={styles.meta}>
                      {transaction.category ?? "Uncategorized"}
                    </Text>
                    <Text variant="bodySmall" style={styles.meta}>
                      {formatDateTime(transaction.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.locationRow}>
                    <Text variant="bodySmall" style={styles.meta}>
                      {transaction.location ?? "Unknown location"}
                    </Text>
                    <Chip compact style={styles.riskChip}>
                      {riskLabel(score, threshold)}
                    </Chip>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.helperText}>
            No transactions found. Submit a transaction to populate recent
            activity.
          </Text>
        )}
      </View>
    </SectionCard>
  );
};

const styles = StyleSheet.create({
  container: {
    rowGap: spacing(1.5)
  },
  list: {
    rowGap: spacing(1)
  },
  listItem: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: spacing(1),
    padding: spacing(1.5)
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing(0.75)
  },
  listTitle: {
    fontWeight: "600",
    color: palette.textPrimary
  },
  amount: {
    fontWeight: "600",
    color: palette.textPrimary
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing(0.5)
  },
  locationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  meta: {
    color: palette.textSecondary
  },
  riskChip: {
    marginLeft: spacing(1)
  },
  helperText: {
    color: palette.textSecondary
  }
});

export default RecentActivityPanel;
