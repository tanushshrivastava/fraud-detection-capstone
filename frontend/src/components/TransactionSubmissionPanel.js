import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Chip, HelperText, Text, TextInput } from "react-native-paper";
import SectionCard from "@/components/SectionCard";
import { spacing, palette } from "@/styles/theme";
import { formatCurrency, riskLabel } from "@/utils/formatters";
import {
  createEmptyTransactionState,
  numericTransactionFields,
  transactionFieldNames,
  transactionPresets
} from "@/utils/transactions";

const buildInitialState = () => createEmptyTransactionState();

const TransactionSubmissionPanel = ({ account, onSubmitTransaction, lastResult }) => {
  const [form, setForm] = useState(() => buildInitialState());
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!account?.accountId) {
      setForm(buildInitialState());
      setSelectedPreset(null);
    }
  }, [account?.accountId]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSelectedPreset(null);
  };

  const handlePresetSelect = (preset) => {
    setSelectedPreset(preset.id);
    setForm({ ...preset.transaction });
  };

  const requiredFields = ['amt', 'category', 'merchant', 'merch_lat', 'merch_long'];
  const hasMissingFields = requiredFields.some(
    (key) => !form[key] || `${form[key]}`.trim() === ""
  );
  const numericFields = ['amt', 'merch_lat', 'merch_long'];
  const hasInvalidNumbers = numericFields.some((field) =>
    Number.isNaN(Number(form[field]))
  );

  const disableSubmit =
    !account?.accountId || isSubmitting || hasMissingFields || hasInvalidNumbers;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = { ...form };
      numericTransactionFields.forEach((field) => {
        payload[field] = Number(payload[field]);
      });
      await onSubmitTransaction(payload);
      setForm(buildInitialState());
      setSelectedPreset(null);
    } catch (err) {
      setError(err.message || "Unable to submit transaction.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!account?.accountId) {
    return (
      <SectionCard
        title="Transaction Submission"
        subtitle="Sign in to evaluate transactions against fraud rules."
      >
        <Text style={styles.signInHelper} variant="bodyMedium">
          Sign in above to unlock transaction submission and risk scoring.
        </Text>
      </SectionCard>
    );
  }

  const fraudScore = lastResult?.fraudScore;
  const threshold = lastResult?.fraudThreshold ?? account?.fraudThreshold;
  const exceeded =
    typeof fraudScore === "number" &&
    typeof threshold === "number" &&
    fraudScore >= threshold;

  return (
    <SectionCard
      title="Transaction Submission"
      subtitle="Use quick presets or customize a transaction to evaluate fraud risk."
    >
      <View style={styles.container}>
        <View style={styles.presetContainer}>
          <Text variant="labelMedium" style={styles.label}>
            Quick Fill Presets
          </Text>
          <View style={styles.presetChips}>
            {transactionPresets.map((preset) => (
              <Chip
                key={preset.id}
                selected={selectedPreset === preset.id}
                onPress={() => handlePresetSelect(preset)}
                style={styles.presetChip}
              >
                {preset.label}
              </Chip>
            ))}
          </View>
        </View>

        <View style={styles.form}>
          <Text variant="labelMedium" style={styles.sectionHeading}>
            Merchant Details
          </Text>
          <TextInput
            label="Amount"
            value={form.amt}
            mode="outlined"
            keyboardType="decimal-pad"
            onChangeText={(text) => handleChange("amt", text)}
          />
          <TextInput
            label="Category"
            value={form.category}
            mode="outlined"
            onChangeText={(text) => handleChange("category", text)}
          />
          <TextInput
            label="Merchant"
            value={form.merchant}
            mode="outlined"
            onChangeText={(text) => handleChange("merchant", text)}
          />
          <TextInput
            label="Merchant Latitude"
            value={form.merch_lat}
            mode="outlined"
            keyboardType="decimal-pad"
            onChangeText={(text) => handleChange("merch_lat", text)}
          />
          <TextInput
            label="Merchant Longitude"
            value={form.merch_long}
            mode="outlined"
            keyboardType="decimal-pad"
            onChangeText={(text) => handleChange("merch_long", text)}
          />
        </View>

        {error ? (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        ) : null}

        <Button
          mode="contained"
          disabled={disableSubmit}
          loading={isSubmitting}
          onPress={handleSubmit}
        >
          Submit Transaction
        </Button>

        {lastResult ? (
          <View
            style={[
              styles.resultContainer,
              { borderColor: exceeded ? palette.error : palette.success }
            ]}
          >
            <Text variant="titleSmall" style={styles.resultTitle}>
              Assessment Result
            </Text>
            <Text variant="bodyMedium" style={styles.resultText}>
              Fraud score {fraudScore} compared to threshold {threshold} —{" "}
              {exceeded ? "Review required" : "Within safe range"}.
            </Text>
            <View style={styles.resultChips}>
              <Chip icon="speedometer" style={styles.resultChip}>
                {riskLabel(fraudScore, threshold)}
              </Chip>
              <Chip
                icon={lastResult.smsSent ? "check-circle" : "close-circle"}
                style={styles.resultChip}
              >
                SMS {lastResult.smsSent ? "sent" : "not sent"}
              </Chip>
              {lastResult.transactionSummary?.amount ? (
                <Chip icon="cash" style={styles.resultChip}>
                  {formatCurrency(lastResult.transactionSummary.amount)}
                </Chip>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </SectionCard>
  );
};

const styles = StyleSheet.create({
  container: {
    rowGap: spacing(1.5)
  },
  presetContainer: {
    rowGap: spacing(1)
  },
  presetChips: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  presetChip: {
    marginRight: spacing(1),
    marginBottom: spacing(1)
  },
  form: {
    rowGap: spacing(1.5)
  },
  label: {
    color: palette.textSecondary
  },
  sectionHeading: {
    color: palette.textSecondary,
    marginTop: spacing(1)
  },
  resultContainer: {
    borderWidth: 1,
    borderRadius: spacing(1),
    padding: spacing(1.5)
  },
  resultTitle: {
    fontWeight: "600",
    color: palette.textPrimary,
    marginBottom: spacing(0.5)
  },
  resultText: {
    color: palette.textSecondary,
    marginBottom: spacing(0.5)
  },
  resultChips: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  resultChip: {
    marginRight: spacing(1),
    marginBottom: spacing(1)
  },
  signInHelper: {
    color: palette.textSecondary
  }
});

export default TransactionSubmissionPanel;
