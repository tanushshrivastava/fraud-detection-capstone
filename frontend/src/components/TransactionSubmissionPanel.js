import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Chip,
  HelperText,
  Text,
  TextInput
} from "react-native-paper";
import SectionCard from "@/components/SectionCard";
import { spacing, palette } from "@/styles/theme";
import { formatCurrency, riskLabel } from "@/utils/formatters";

const requiredFields = {
  trans_date_trans_time: "",
  cc_num: "",
  merchant: "",
  category: "",
  amt: "",
  trans_num: "",
  unix_time: "",
  first: "",
  last: "",
  gender: "",
  dob: "",
  job: "",
  city: "",
  state: "",
  zip: "",
  street: "",
  city_pop: "",
  lat: "",
  long: "",
  merch_lat: "",
  merch_long: ""
};

const quickPresets = [
  {
    id: "sample-entertainment",
    label: "Entertainment · $62,000.32 (High Risk)",
    transaction: {
      trans_date_trans_time: "2020-06-21 22:37:27",
      cc_num: "6564459919350820",
      merchant: "fraud_Nienow PLC",
      category: "entertainment",
      amt: "62000.32",
      trans_num: "47a9987ae81d99f7832a54b29a77bf4b",
      unix_time: "1371854247",
      first: "Douglas",
      last: "Willis",
      gender: "M",
      dob: "1958-09-10",
      job: "Public relations officer",
      city: "Benton",
      state: "WI",
      zip: "53803",
      street: "619 Jeremy Garden Apt. 681",
      city_pop: "1306",
      lat: "42.5545",
      long: "-90.3508",
      merch_lat: "42.771834000000005",
      merch_long: "-90.158365"
    }
  },
  {
    id: "sample-grocery",
    label: "Groceries · $86.22",
    transaction: {
      trans_date_trans_time: "2020-05-14 15:22:05",
      cc_num: "4895170907217407",
      merchant: "grocery_Fresh Fields Market",
      category: "grocery_pos",
      amt: "86.22",
      trans_num: "5e59d34f0b3a43ff8fb1f2b3a59d231c",
      unix_time: "1368541325",
      first: "Monica",
      last: "Lopez",
      gender: "F",
      dob: "1986-03-21",
      job: "Registered nurse",
      city: "Austin",
      state: "TX",
      zip: "73301",
      street: "1024 Barton Springs Rd",
      city_pop: "978908",
      lat: "30.2638",
      long: "-97.7463",
      merch_lat: "30.2681",
      merch_long: "-97.7407"
    }
  },
  {
    id: "sample-travel",
    label: "Travel · $1,245.50",
    transaction: {
      trans_date_trans_time: "2020-07-01 09:12:44",
      cc_num: "349108182115237",
      merchant: "travel_SkyAir",
      category: "travel",
      amt: "1245.50",
      trans_num: "b5d1b24a9a4b4e1ab8b04a7ba931e4dc",
      unix_time: "1372631564",
      first: "Michael",
      last: "Nguyen",
      gender: "M",
      dob: "1975-11-05",
      job: "Data analyst",
      city: "Seattle",
      state: "WA",
      zip: "98101",
      street: "1500 1st Ave",
      city_pop: "744955",
      lat: "47.608013",
      long: "-122.335167",
      merch_lat: "47.449888",
      merch_long: "-122.311777"
    }
  }
];

const initialState = { ...requiredFields };

const TransactionSubmissionPanel = ({ account, onSubmitTransaction, lastResult }) => {
  const [form, setForm] = useState(initialState);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!account?.accountId) {
      setForm(initialState);
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

  const disableSubmit =
    !account?.accountId ||
    isSubmitting ||
    Object.entries(requiredFields).some(([key]) => !form[key] || `${form[key]}`.trim() === "") ||
    Number.isNaN(Number(form.amt)) ||
    Number.isNaN(Number(form.unix_time)) ||
    Number.isNaN(Number(form.city_pop)) ||
    Number.isNaN(Number(form.lat)) ||
    Number.isNaN(Number(form.long)) ||
    Number.isNaN(Number(form.merch_lat)) ||
    Number.isNaN(Number(form.merch_long));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmitTransaction({
        ...form,
        amt: Number(form.amt),
        unix_time: Number(form.unix_time),
        city_pop: Number(form.city_pop),
        lat: Number(form.lat),
        long: Number(form.long),
        merch_lat: Number(form.merch_lat),
        merch_long: Number(form.merch_long)
      });
      setForm(initialState);
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
            {quickPresets.map((preset) => (
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
            Transaction Details
          </Text>
          <TextInput
            label="Transaction Number"
            value={form.trans_num}
            mode="outlined"
            onChangeText={(text) => handleChange("trans_num", text)}
          />
          <TextInput
            label="Transaction Date (YYYY-MM-DD HH:mm:ss)"
            value={form.trans_date_trans_time}
            mode="outlined"
            onChangeText={(text) => handleChange("trans_date_trans_time", text)}
          />
          <TextInput
            label="Unix Time"
            value={form.unix_time}
            mode="outlined"
            keyboardType="number-pad"
            onChangeText={(text) => handleChange("unix_time", text)}
          />
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
          <Text variant="labelMedium" style={styles.sectionHeading}>
            Cardholder Details
          </Text>
          <TextInput
            label="Card Number"
            value={form.cc_num}
            mode="outlined"
            keyboardType="number-pad"
            onChangeText={(text) => handleChange("cc_num", text)}
          />
          <TextInput
            label="First Name"
            value={form.first}
            mode="outlined"
            onChangeText={(text) => handleChange("first", text)}
          />
          <TextInput
            label="Last Name"
            value={form.last}
            mode="outlined"
            onChangeText={(text) => handleChange("last", text)}
          />
          <TextInput
            label="Gender"
            value={form.gender}
            mode="outlined"
            onChangeText={(text) => handleChange("gender", text)}
          />
          <TextInput
            label="Date of Birth (YYYY-MM-DD)"
            value={form.dob}
            mode="outlined"
            onChangeText={(text) => handleChange("dob", text)}
          />
          <TextInput
            label="Occupation"
            value={form.job}
            mode="outlined"
            onChangeText={(text) => handleChange("job", text)}
          />
          <Text variant="labelMedium" style={styles.sectionHeading}>
            Location Details
          </Text>
          <TextInput
            label="Street"
            value={form.street}
            mode="outlined"
            onChangeText={(text) => handleChange("street", text)}
          />
          <TextInput
            label="City"
            value={form.city}
            mode="outlined"
            onChangeText={(text) => handleChange("city", text)}
          />
          <TextInput
            label="State"
            value={form.state}
            mode="outlined"
            autoCapitalize="characters"
            onChangeText={(text) => handleChange("state", text)}
          />
          <TextInput
            label="ZIP"
            value={form.zip}
            mode="outlined"
            keyboardType="number-pad"
            onChangeText={(text) => handleChange("zip", text)}
          />
          <TextInput
            label="City Population"
            value={form.city_pop}
            mode="outlined"
            keyboardType="number-pad"
            onChangeText={(text) => handleChange("city_pop", text)}
          />
          <TextInput
            label="Cardholder Latitude"
            value={form.lat}
            mode="outlined"
            keyboardType="decimal-pad"
            onChangeText={(text) => handleChange("lat", text)}
          />
          <TextInput
            label="Cardholder Longitude"
            value={form.long}
            mode="outlined"
            keyboardType="decimal-pad"
            onChangeText={(text) => handleChange("long", text)}
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
