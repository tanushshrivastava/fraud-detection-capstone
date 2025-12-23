import { useState, useRef } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View, Animated, PanResponder } from "react-native";
import { Button, Card, Text, TextInput, IconButton, useTheme } from "react-native-paper";
import { palette, spacing } from "@/styles/theme";
import axios from "axios";
import Constants from "expo-constants";

const getApiUrl = () => {
  const expoConfig = Constants.expoConfig ?? Constants.manifest;
  const extra = expoConfig?.extra ?? {};
  return extra.apiUrl || "";
};


// Preset stores with low/high risk examples
const PRESET_STORES = [
  {
    id: 1,
    name: "Joe Coffee",
    emoji: "☕",
    category: "coffee",
    amount: 8.97,
    lat: 43.07076850000001,
    long: -89.4026391
  },
  {
    id: 2,
    name: "Delta Airlines",
    emoji: "✈️",
    category: "travel",
    amount: 100000000,
    lat: 12,
    long: 45
  }
];

const MockShopScreen = ({ account, onTransactionComplete }) => {
  const theme = useTheme();
  const [currentStoreIndex, setCurrentStoreIndex] = useState(0);
  const [customStores, setCustomStores] = useState([]);
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customStore, setCustomStore] = useState({
    name: "",
    category: "",
    amount: "",
    lat: "",
    long: ""
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState(null);

  // Animation for card swipe
  const pan = useRef(new Animated.ValueXY()).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;

  const allStores = [...PRESET_STORES, ...customStores];
  const currentStore = allStores[currentStoreIndex];

  // Pan responder for drag gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: 0 }], {
        useNativeDriver: false
      }),
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) > 120) {
          // Swipe detected
          handleSwipe(gesture.dx > 0 ? "right" : "left");
        } else {
          // Return to center
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false
          }).start();
        }
      }
    })
  ).current;

  const handleSwipe = async (direction) => {
    // Animate card off screen
    Animated.parallel([
      Animated.timing(pan.x, {
        toValue: direction === "right" ? 500 : -500,
        duration: 300,
        useNativeDriver: false
      }),
      Animated.timing(cardOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false
      })
    ]).start(async () => {
      // Process transaction
      await processTransaction();

      // Reset card position
      pan.setValue({ x: 0, y: 0 });
      cardOpacity.setValue(1);
    });
  };

  const processTransaction = async () => {
    if (!account?.accountId) {
      setMessage({ type: "error", text: "Please sign in first" });
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      const apiUrl = getApiUrl();
      if (!apiUrl) {
        throw new Error("API URL not configured");
      }

      // Send email via AWS SES Lambda
      const lat = currentStore.lat ?? "unknown";
      const long = currentStore.long ?? "unknown";
      const formattedBody = `Transaction of amount $${currentStore.amount.toFixed(2)} at ${currentStore.name} of category ${currentStore.category} at location ${lat}, ${long} was made.`;

      await axios.post(`${apiUrl}/send-email`, {
        to: "newcscapstone@gmail.com",
        subject: `Card Swipe at ${currentStore.name}`,
        body: formattedBody
      });
      
      setMessage({
        type: "success",
        text: `Card swiped at ${currentStore.name}! Email sent.`
      });
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Failed to send email" });
    } finally {
      setIsProcessing(false);
    }
  };

  const navigateStore = (direction) => {
    const newIndex = direction === "next"
      ? (currentStoreIndex + 1) % allStores.length
      : (currentStoreIndex - 1 + allStores.length) % allStores.length;
    setCurrentStoreIndex(newIndex);
    setMessage(null);
  };

  const handleAddCustomStore = () => {
    if (!customStore.name || !customStore.category || !customStore.amount) {
      setMessage({ type: "error", text: "Please fill in all required fields" });
      return;
    }

    const newStore = {
      id: `custom-${Date.now()}`,
      name: customStore.name,
      emoji: "🏪",
      category: customStore.category,
      amount: parseFloat(customStore.amount),
      lat: parseFloat(customStore.lat) || 43.0731,
      long: parseFloat(customStore.long) || -89.4012
    };

    setCustomStores([...customStores, newStore]);
    setCurrentStoreIndex(allStores.length); // Navigate to new store
    setCustomStore({ name: "", category: "", amount: "", lat: "", long: "" });
    setIsAddingCustom(false);
    setMessage({ type: "success", text: "Custom store added!" });
  };

  if (!account?.accountId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors?.background ?? palette.background }]}>
        <View style={styles.emptyState}>
          <Text variant="headlineSmall" style={styles.emptyTitle}>
            Sign In Required
          </Text>
          <Text variant="bodyMedium" style={styles.emptyText}>
            Please sign in to use the mock shopping experience.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors?.background ?? palette.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="headlineSmall" style={styles.title}>
            Credit Card Simulator
          </Text>
          <Text variant="bodySmall" style={styles.subtitle}>
            powered by Capital One
          </Text>
        </View>

        {/* Store Display */}
        <View style={styles.storeContainer}>
          <IconButton
            icon="chevron-left"
            size={32}
            onPress={() => navigateStore("prev")}
            style={styles.navButton}
          />
          <Card style={styles.storeCard}>
            <Card.Content style={styles.storeContent}>
              <Text style={styles.storeEmoji}>{currentStore.emoji}</Text>
              <Text variant="headlineMedium" style={styles.storeName}>
                {currentStore.name}
              </Text>
              <Text variant="bodyMedium" style={styles.storeCategory}>
                {currentStore.category}
              </Text>
            </Card.Content>
          </Card>
          <IconButton
            icon="chevron-right"
            size={32}
            onPress={() => navigateStore("next")}
            style={styles.navButton}
          />
        </View>

        {/* Card Reader */}
        <Card style={styles.readerCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.readerTitle}>
              Card Reader
            </Text>
            <Text variant="bodySmall" style={styles.readerSubtitle}>
              Swipe your card to complete purchase
            </Text>

            <View style={styles.swipeArea}>
              <Text style={styles.swipeText}>Swipe card here</Text>
            </View>

            <Text variant="headlineMedium" style={styles.amount}>
              ${currentStore.amount.toFixed(2)}
            </Text>
            <Text variant="bodySmall" style={styles.transactionInfo}>
              {new Date().toLocaleDateString()} | {currentStore.category.toUpperCase()}
            </Text>

            <View style={styles.buttonRow}>
              <Button
                mode="contained"
                onPress={() => handleSwipe("left")}
                disabled={isProcessing}
                style={styles.swipeButton}
              >
                Swipe Left
              </Button>
              <Button
                mode="contained"
                onPress={() => handleSwipe("right")}
                disabled={isProcessing}
                style={styles.swipeButton}
              >
                Swipe Right
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Credit Card */}
        <Animated.View
          style={[
            styles.cardContainer,
            {
              transform: [{ translateX: pan.x }],
              opacity: cardOpacity
            }
          ]}
          {...panResponder.panHandlers}
        >
          <Card style={styles.creditCard}>
            <Card.Content>
              <View style={styles.cardHeader}>
                <Text variant="titleMedium" style={styles.cardBank}>
                  Capital One
                </Text>
                <IconButton icon="package-variant" size={24} iconColor="#fff" />
              </View>
              <View style={styles.cardChip} />
              <Text variant="titleLarge" style={styles.cardNumber}>
                {account.ccNum ? account.ccNum.replace(/(\d{4})(?=\d)/g, '$1 ') : "•••• •••• •••• ••••"}
              </Text>
              <View style={styles.cardFooter}>
                <View>
                  <Text variant="bodySmall" style={styles.cardLabel}>
                    EXP: {account.dateOfBirth ? account.dateOfBirth.substring(2, 7).replace("-", "/") : "••/••"}
                  </Text>
                  <Text variant="bodySmall" style={styles.cardLabel}>
                    CVV: •••
                  </Text>
                </View>
                <Text variant="titleMedium" style={styles.cardName}>
                  {account.firstName} {account.lastName}
                </Text>
              </View>
            </Card.Content>
          </Card>
        </Animated.View>

        {/* Instructions */}
        <Card style={styles.instructionsCard}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.instructionsTitle}>
              How to use:
            </Text>
            <Text variant="bodySmall" style={styles.instructionText}>
              1. You can <Text style={styles.bold}>drag the credit card</Text> left or right to swipe it
            </Text>
            <Text variant="bodySmall" style={styles.instructionText}>
              2. Or use the "Swipe Left"/"Swipe Right" buttons above
            </Text>
            <Text variant="bodySmall" style={styles.instructionText}>
              3. Use arrow buttons to change stores
            </Text>
          </Card.Content>
        </Card>

        {/* Custom Store Button */}
        <Button
          mode="outlined"
          onPress={() => setIsAddingCustom(!isAddingCustom)}
          style={styles.customButton}
        >
          {isAddingCustom ? "Cancel" : "Add Custom Store"}
        </Button>

        {/* Custom Store Form */}
        {isAddingCustom && (
          <Card style={styles.customForm}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.formTitle}>
                Create Custom Store
              </Text>
              <TextInput
                label="Store Name *"
                value={customStore.name}
                onChangeText={(text) => setCustomStore({ ...customStore, name: text })}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label="Category *"
                value={customStore.category}
                onChangeText={(text) => setCustomStore({ ...customStore, category: text })}
                mode="outlined"
                style={styles.input}
              />
              <TextInput
                label="Amount *"
                value={customStore.amount}
                onChangeText={(text) => setCustomStore({ ...customStore, amount: text })}
                mode="outlined"
                keyboardType="decimal-pad"
                style={styles.input}
              />
              <TextInput
                label="Latitude (optional)"
                value={customStore.lat}
                onChangeText={(text) => setCustomStore({ ...customStore, lat: text })}
                mode="outlined"
                keyboardType="decimal-pad"
                style={styles.input}
              />
              <TextInput
                label="Longitude (optional)"
                value={customStore.long}
                onChangeText={(text) => setCustomStore({ ...customStore, long: text })}
                mode="outlined"
                keyboardType="decimal-pad"
                style={styles.input}
              />
              <Button mode="contained" onPress={handleAddCustomStore} style={styles.addButton}>
                Add Store
              </Button>
            </Card.Content>
          </Card>
        )}

        {/* Message */}
        {message && (
          <Card
            style={[
              styles.messageCard,
              { backgroundColor: message.type === "error" ? palette.error : message.type === "warning" ? "#ff9800" : palette.success }
            ]}
          >
            <Card.Content>
              <Text style={styles.messageText}>{message.text}</Text>
            </Card.Content>
          </Card>
        )}
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
    alignItems: "center",
    marginBottom: spacing(2)
  },
  title: {
    fontWeight: "700",
    color: palette.textPrimary
  },
  subtitle: {
    color: palette.textSecondary
  },
  storeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center"
  },
  navButton: {
    backgroundColor: "#e0e0e0"
  },
  storeCard: {
    flex: 1,
    marginHorizontal: spacing(1),
    backgroundColor: "#fff3cd"
  },
  storeContent: {
    alignItems: "center",
    padding: spacing(3)
  },
  storeEmoji: {
    fontSize: 48,
    marginBottom: spacing(1)
  },
  storeName: {
    fontWeight: "700",
    textAlign: "center"
  },
  storeCategory: {
    color: palette.textSecondary,
    textAlign: "center"
  },
  readerCard: {
    backgroundColor: "#2c3e50"
  },
  readerTitle: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "700"
  },
  readerSubtitle: {
    color: "#bdc3c7",
    textAlign: "center",
    marginBottom: spacing(2)
  },
  swipeArea: {
    backgroundColor: "#34495e",
    borderRadius: spacing(1),
    padding: spacing(4),
    marginVertical: spacing(2),
    alignItems: "center"
  },
  swipeText: {
    color: "#7f8c8d",
    fontSize: 16
  },
  amount: {
    color: "#2ecc71",
    textAlign: "center",
    fontWeight: "700",
    marginVertical: spacing(1)
  },
  transactionInfo: {
    color: "#bdc3c7",
    textAlign: "center",
    marginBottom: spacing(2)
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    columnGap: spacing(1)
  },
  swipeButton: {
    flex: 1
  },
  cardContainer: {
    alignItems: "center"
  },
  creditCard: {
    width: 340,
    height: 214,
    backgroundColor: "#3b5998",
    borderRadius: spacing(2)
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing(2)
  },
  cardBank: {
    color: "#fff",
    fontWeight: "700"
  },
  cardChip: {
    width: 50,
    height: 40,
    backgroundColor: "#d4af37",
    borderRadius: 8,
    marginBottom: spacing(2)
  },
  cardNumber: {
    color: "#fff",
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: spacing(2)
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end"
  },
  cardLabel: {
    color: "#bdc3c7",
    fontSize: 10
  },
  cardName: {
    color: "#fff",
    fontWeight: "700"
  },
  instructionsCard: {
    backgroundColor: "#fff9c4"
  },
  instructionsTitle: {
    fontWeight: "700",
    marginBottom: spacing(1)
  },
  instructionText: {
    marginBottom: spacing(0.5)
  },
  bold: {
    fontWeight: "700"
  },
  customButton: {
    marginTop: spacing(1)
  },
  customForm: {
    backgroundColor: "#f5f5f5"
  },
  formTitle: {
    fontWeight: "700",
    marginBottom: spacing(2)
  },
  input: {
    marginBottom: spacing(1.5)
  },
  addButton: {
    marginTop: spacing(1)
  },
  messageCard: {
    marginTop: spacing(1)
  },
  messageText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "700"
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing(4)
  },
  emptyTitle: {
    fontWeight: "700",
    marginBottom: spacing(1)
  },
  emptyText: {
    color: palette.textSecondary,
    textAlign: "center"
  }
});

export default MockShopScreen;
