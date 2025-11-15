import { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { Button, Text, Card, useTheme, ActivityIndicator } from "react-native-paper";
import { sendEmail } from "@/services/api";
import { palette, spacing } from "@/styles/theme";

/**
 * MockShopScreen
 *
 * Purpose: Simulate a shopping experience that triggers fraud detection.
 * Current: Minimal UI with an email sending button for testing.
 * Future: Will expand to include product listings, cart, and transaction generation.
 *
 * Architecture:
 * - This screen is isolated from the Dashboard authentication flow
 * - Email sending goes through backend API (not client-side)
 * - Designed for easy extension with shopping cart state and product data
 */
const MockShopScreen = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info"); // info, success, error

  const handleSendEmail = async () => {
    setLoading(true);
    setMessage("");

    try {
      // Test payload - will be replaced with actual transaction data later
      const testPayload = {
        to: "newcscapstone@gmail.com",
        subject: "Mock Shop Test Transaction",
        body: "This is a test email from the Mock Shop feature. Future emails will contain full transaction details."
      };

      const response = await sendEmail(testPayload);

      setMessage(response.message || "Email sent successfully!");
      setMessageType("success");
    } catch (error) {
      setMessage(error.message || "Failed to send email. Please try again.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors?.background ?? palette.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>
            Mock Shop
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            Simulate credit card transactions to test fraud detection
          </Text>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Email Test
            </Text>
            <Text variant="bodyMedium" style={styles.cardDescription}>
              Click the button below to send a test email to the capstone team.
              This will later be replaced with actual transaction processing.
            </Text>

            {message ? (
              <View style={[
                styles.messageBox,
                {
                  backgroundColor: messageType === "success" ? "#E8F5E9" :
                    messageType === "error" ? "#FFEBEE" :
                      "#E3F2FD"
                }
              ]}>
                <Text style={[
                  styles.messageText,
                  {
                    color: messageType === "success" ? palette.success :
                      messageType === "error" ? palette.error :
                        palette.primary
                  }
                ]}>
                  {message}
                </Text>
              </View>
            ) : null}

            <Button
              mode="contained"
              onPress={handleSendEmail}
              disabled={loading}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              {loading ? <ActivityIndicator color="#fff" /> : "Send Email"}
            </Button>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.cardTitle}>
              Coming Soon
            </Text>
            <Text variant="bodyMedium" style={styles.cardDescription}>
              Future features will include:
            </Text>
            <View style={styles.featureList}>
              <Text variant="bodyMedium" style={styles.featureItem}>
                • Product catalog with prices
              </Text>
              <Text variant="bodyMedium" style={styles.featureItem}>
                • Shopping cart functionality
              </Text>
              <Text variant="bodyMedium" style={styles.featureItem}>
                • Simulated checkout process
              </Text>
              <Text variant="bodyMedium" style={styles.featureItem}>
                • Full transaction metadata generation
              </Text>
              <Text variant="bodyMedium" style={styles.featureItem}>
                • Integration with fraud detection pipeline
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    padding: spacing(2),
    rowGap: spacing(2)
  },
  header: {
    marginBottom: spacing(1)
  },
  title: {
    fontWeight: "700",
    color: palette.textPrimary
  },
  subtitle: {
    color: palette.textSecondary,
    marginTop: spacing(0.5)
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 12
  },
  cardTitle: {
    fontWeight: "600",
    color: palette.textPrimary,
    marginBottom: spacing(1)
  },
  cardDescription: {
    color: palette.textSecondary,
    marginBottom: spacing(2),
    lineHeight: 20
  },
  messageBox: {
    padding: spacing(1.5),
    borderRadius: 8,
    marginBottom: spacing(2)
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20
  },
  button: {
    marginTop: spacing(1)
  },
  buttonContent: {
    paddingVertical: spacing(0.5)
  },
  featureList: {
    marginTop: spacing(1),
    rowGap: spacing(0.5)
  },
  featureItem: {
    color: palette.textSecondary,
    lineHeight: 22
  }
});

export default MockShopScreen;
