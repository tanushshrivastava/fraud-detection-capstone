import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, HelperText, TextInput, Text } from "react-native-paper";
import SectionCard from "@/components/SectionCard";
import { spacing, palette } from "@/styles/theme";

const NotificationSettingsPanel = ({ account, onUpdateSettings }) => {
  const [form, setForm] = useState({
    accountId: "",
    phoneNumber: "",
    fraudThreshold: ""
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (account?.accountId) {
      setForm({
        accountId: account.accountId ?? "",
        phoneNumber: account.phoneNumber ?? "",
        fraudThreshold:
          account.fraudThreshold !== undefined && account.fraudThreshold !== null
            ? String(account.fraudThreshold)
            : ""
      });
    }
  }, [account]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onUpdateSettings({
        accountId: form.accountId,
        phoneNumber: form.phoneNumber || undefined,
        fraudThreshold: Number(form.fraudThreshold)
      });
    } catch (err) {
      setError(err.message || "Unable to update settings.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!account?.accountId) {
    return (
      <SectionCard
        title="Notification Settings"
        subtitle="Sign in to manage your fraud threshold and SMS settings."
      >
        <Text style={styles.signInHelper} variant="bodyMedium">
          Complete the sign-in flow to load notification preferences.
        </Text>
      </SectionCard>
    );
  }

  const disableSubmit =
    isSubmitting ||
    !form.accountId ||
    form.fraudThreshold === "" ||
    Number.isNaN(Number(form.fraudThreshold));

  return (
    <SectionCard
      title="Notification Settings"
      subtitle="Control the SMS number and fraud threshold that trigger alerts."
    >
      <View style={styles.container}>
        <TextInput
          label="Account ID"
          value={form.accountId}
          mode="outlined"
          disabled
        />
        <TextInput
          label="Fraud Threshold"
          value={String(form.fraudThreshold)}
          mode="outlined"
          keyboardType="numeric"
          onChangeText={(text) => handleChange("fraudThreshold", text)}
        />
        <TextInput
          label="SMS Phone Number"
          value={form.phoneNumber}
          mode="outlined"
          keyboardType="phone-pad"
          onChangeText={(text) => handleChange("phoneNumber", text)}
          placeholder="+15551234567"
        />
        {error ? (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        ) : null}
        <Button
          mode="contained-tonal"
          disabled={disableSubmit}
          loading={isSubmitting}
          onPress={handleSubmit}
        >
          Save Settings
        </Button>
      </View>
    </SectionCard>
  );
};

const styles = StyleSheet.create({
  container: {
    rowGap: spacing(1.5)
  },
  signInHelper: {
    color: palette.textSecondary
  }
});

export default NotificationSettingsPanel;
