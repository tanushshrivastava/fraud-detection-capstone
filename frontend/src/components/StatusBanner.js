import { StyleSheet, View } from "react-native";
import { Chip, Text } from "react-native-paper";
import { palette, spacing } from "@/styles/theme";

const COLORS_BY_TONE = {
  info: palette.primary,
  success: palette.success,
  warning: palette.warning,
  error: palette.error
};

const StatusBanner = ({ threshold, lastScore, tone = "info", message }) => {
  return (
    <View style={[styles.container, { borderColor: COLORS_BY_TONE[tone] || palette.primary }]}>
      <View style={styles.header}>
        <Text variant="titleMedium" style={styles.title}>
          Account Fraud Threshold
        </Text>
        <Chip textStyle={styles.chipText} style={[styles.chip, { backgroundColor: (COLORS_BY_TONE[tone] ?? palette.primary) + "15" }]}>
          Threshold: {threshold ?? "N/A"}
        </Chip>
      </View>
      {message ? (
        <Text variant="bodyMedium" style={styles.message}>
          {message}
        </Text>
      ) : null}
      {typeof lastScore === "number" ? (
        <Text variant="bodySmall" style={styles.score}>
          Latest fraud score: {lastScore}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: spacing(1),
    padding: spacing(2),
    backgroundColor: palette.surface,
    marginBottom: spacing(2)
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  title: {
    fontWeight: "600",
    color: palette.textPrimary
  },
  chip: {
    alignSelf: "flex-start"
  },
  chipText: {
    fontWeight: "600",
    color: palette.textPrimary
  },
  message: {
    color: palette.textSecondary,
    marginTop: spacing(1)
  },
  score: {
    color: palette.textSecondary,
    fontStyle: "italic",
    marginTop: spacing(0.5)
  }
});

export default StatusBanner;
