import { useState, useEffect } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import AsyncStorage from '@react-native-async-storage/async-storage';
import AccountAccessPanel from "@/components/AccountAccessPanel";
import NotificationSettingsPanel from "@/components/NotificationSettingsPanel";
import TransactionSubmissionPanel from "@/components/TransactionSubmissionPanel";
import RecentActivityPanel from "@/components/RecentActivityPanel";
import StatusBanner from "@/components/StatusBanner";
import {
  createAccount,
  loginAccount,
  updateAccountSettings,
  submitTransaction,
  fetchRecentTransactions
} from "@/services/api";
import { palette, spacing } from "@/styles/theme";

const DashboardScreen = ({ onAccountChange }) => {
  const theme = useTheme();
  const initialBannerState = {
    message: "Create an account or sign in to manage fraud settings.",
    tone: "info",
    lastScore: undefined
  };
  const [account, setAccount] = useState(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    if (account && onAccountChange) {
      onAccountChange(account);
    }
  }, [account, onAccountChange]);

  const loadSession = async () => {
    try {
      const savedAccount = await AsyncStorage.getItem('fraudDetectionAccount');
      if (savedAccount) {
        setAccount(JSON.parse(savedAccount));
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setIsLoadingSession(false);
    }
  };

  const saveSession = async (accountData) => {
    try {
      await AsyncStorage.setItem('fraudDetectionAccount', JSON.stringify(accountData));
    } catch (error) {
      console.error('Failed to save session:', error);
    }
  };

  const clearSession = async () => {
    try {
      await AsyncStorage.removeItem('fraudDetectionAccount');
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  };
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [lastTransactionResult, setLastTransactionResult] = useState(null);
  const [bannerState, setBannerState] = useState(initialBannerState);
  const [isRefreshingTransactions, setIsRefreshingTransactions] =
    useState(false);

  const syncThreshold = (newThreshold) => {
    if (typeof newThreshold !== "number") {
      return;
    }
    setAccount((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        fraudThreshold: newThreshold
      };
    });
  };

  const handleAccountCreated = async (payload) => {
    const response = await createAccount(payload);
    const nextAccount = {
      accountId: response.accountId,
      username: payload.username,
      email: payload.email,
      address: payload.address,
      phoneNumber: response.phoneNumber ?? payload.phoneNumber ?? "",
      fraudThreshold: response.fraudThreshold,
      firstName: response.firstName ?? payload.first_name,
      lastName: response.lastName ?? payload.last_name,
      ccNum: payload.cc_num,
      dateOfBirth: payload.date_of_birth
    };
    setAccount(nextAccount);
    saveSession(nextAccount);
    if (onAccountChange) onAccountChange(nextAccount);
    setRecentTransactions([]);
    setLastTransactionResult(null);
    setBannerState({
      message: `Account ${response.accountId} created successfully. Keep the ID for records and use your username to sign in.`,
      tone: "success",
      lastScore: undefined
    });
  };

  const handleAccountLogin = async (payload) => {
    const response = await loginAccount(payload);
    const nextAccount = {
      accountId: response.accountId,
      username: response.username,
      email: response.email,
      phoneNumber: response.phoneNumber,
      fraudThreshold: response.fraudThreshold,
      firstName: response.firstName,
      lastName: response.lastName,
      ccNum: response.ccNum,
      dateOfBirth: response.dateOfBirth
    };
    const transactions = response.recentTransactions ?? [];
    setAccount(nextAccount);
    saveSession(nextAccount);
    if (onAccountChange) onAccountChange(nextAccount);
    setRecentTransactions(transactions);
    setLastTransactionResult(null);
    setBannerState({
      message: `Welcome back${response.username ? `, ${response.username}` : ""}. Threshold synced to ${response.fraudThreshold}.`,
      tone: "info",
      lastScore:
        transactions?.[0]?.fraudScore ?? transactions?.[0]?.score ?? undefined
    });
  };

  const handleSettingsUpdate = async (payload) => {
    const response = await updateAccountSettings(payload);
    setAccount((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        phoneNumber: response.phoneNumber,
        fraudThreshold: response.fraudThreshold
      };
    });
    setBannerState({
      message: `Threshold updated to ${response.fraudThreshold}. Notifications will go to ${
        response.phoneNumber || "the configured email"
      }.`,
      tone: "success",
      lastScore: bannerState.lastScore
    });
  };

  const handleTransactionSubmit = async (transactionFields) => {
    const requestPayload = {
      accountId: account.accountId,
      transaction: transactionFields
    };
    const response = await submitTransaction(requestPayload);
    syncThreshold(response.fraudThreshold);
    setLastTransactionResult(response);
    setBannerState({
      message:
        response.fraudScore >= response.fraudThreshold
          ? "Fraud score exceeded the configured threshold — flag for manual review."
          : "Fraud score is below the threshold. Transaction looks safe.",
      tone: response.fraudScore >= response.fraudThreshold ? "warning" : "success",
      lastScore: response.fraudScore
    });

    if (response.transactionSummary) {
      setRecentTransactions((prev) => {
        const existing = Array.isArray(prev) ? prev : [];
        const merged = [response.transactionSummary, ...existing];
        return merged.slice(0, 20);
      });
    } else {
      refreshTransactions(10);
    }

    return response;
  };

  const refreshTransactions = async (limit = 10) => {
    if (!account?.accountId) return;
    setIsRefreshingTransactions(true);
    try {
      const response = await fetchRecentTransactions(account.accountId, limit);
      const items = Array.isArray(response)
        ? response
        : response?.transactions ?? response?.items ?? [];
      if (typeof response?.fraudThreshold === "number") {
        syncThreshold(response.fraudThreshold);
      }
      setRecentTransactions(items);
    } catch (error) {
      setBannerState((prev) => ({
        ...prev,
        message: error.message || "Unable to refresh transactions.",
        tone: "error"
      }));
    } finally {
      setIsRefreshingTransactions(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setAccount(null);
    if (onAccountChange) onAccountChange(null);
    setRecentTransactions([]);
    setLastTransactionResult(null);
    setBannerState({ ...initialBannerState });
    setIsRefreshingTransactions(false);
  };

  if (isLoadingSession) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors?.background ?? palette.background }]}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors?.background ?? palette.background }]}
    >
      {account ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text variant="headlineSmall" style={styles.title}>
                Fraud Intelligence Dashboard
              </Text>
              <Text variant="bodyMedium" style={styles.subtitle}>
                Manage accounts, tune alerting thresholds, and evaluate transactions
                in real time.
              </Text>
            </View>
            <Button mode="outlined" onPress={handleLogout} style={styles.logoutButton}>
              Sign Out
            </Button>
          </View>

          <StatusBanner
            threshold={account?.fraudThreshold}
            lastScore={bannerState.lastScore}
            tone={bannerState.tone}
            message={bannerState.message}
          />

          <NotificationSettingsPanel
            account={account}
            onUpdateSettings={handleSettingsUpdate}
          />

          <TransactionSubmissionPanel
            account={account}
            onSubmitTransaction={handleTransactionSubmit}
            lastResult={lastTransactionResult}
          />

          <RecentActivityPanel
            account={account}
            transactions={recentTransactions}
            onRefresh={refreshTransactions}
            isLoading={isRefreshingTransactions}
          />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.authScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.authHeader}>
            <Text variant="headlineSmall" style={styles.authTitle}>
              Welcome to the Fraud Intelligence Dashboard
            </Text>
            <Text variant="bodyMedium" style={styles.authSubtitle}>
              Sign in with your username or create a new account to get started.
            </Text>
          </View>
          <AccountAccessPanel
            onCreateAccount={handleAccountCreated}
            onLoginAccount={handleAccountLogin}
            isCompact
            title="Access Your Account"
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  scrollContent: {
    padding: spacing(2),
    rowGap: spacing(1)
  },
  header: {
    marginBottom: spacing(2),
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  headerText: {
    flex: 1,
    marginRight: spacing(2)
  },
  title: {
    fontWeight: "700",
    color: palette.textPrimary
  },
  subtitle: {
    color: palette.textSecondary,
    marginTop: spacing(0.5)
  },
  logoutButton: {
    alignSelf: "flex-start"
  },
  authScroll: {
    flexGrow: 1,
    padding: spacing(2),
    justifyContent: "center"
  },
  authHeader: {
    marginBottom: spacing(3),
    rowGap: spacing(1)
  },
  authTitle: {
    fontWeight: "700",
    textAlign: "center",
    color: palette.textPrimary
  },
  authSubtitle: {
    textAlign: "center",
    color: palette.textSecondary
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  }
});

export default DashboardScreen;
