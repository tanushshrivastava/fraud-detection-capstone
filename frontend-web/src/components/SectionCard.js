import { StyleSheet, View } from "react-native";
import { Card, Text } from "react-native-paper";
import { spacing, palette } from "@/styles/theme";

const SectionCard = ({ title, subtitle, children, actions, style }) => {
  return (
    <Card style={[styles.card, style]}>
      <Card.Content>
        <View style={styles.header}>
          <View>
            <Text variant="titleMedium" style={styles.title}>
              {title}
            </Text>
            {subtitle ? (
              <Text variant="bodySmall" style={styles.subtitle}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
        <View style={styles.body}>{children}</View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing(2),
    borderRadius: spacing(1),
    backgroundColor: palette.surface
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing(1.5)
  },
  title: {
    color: palette.textPrimary,
    fontWeight: "600"
  },
  subtitle: {
    marginTop: spacing(0.5),
    color: palette.textSecondary
  },
  actions: {
    flexDirection: "row",
    columnGap: spacing(1)
  },
  body: {
    rowGap: spacing(1.5)
  }
});

export default SectionCard;
