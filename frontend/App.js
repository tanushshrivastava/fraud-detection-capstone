import "react-native-gesture-handler";
import { useMemo, useState } from "react";
import {
  BottomNavigation,
  MD3LightTheme,
  Provider as PaperProvider
} from "react-native-paper";
import { StatusBar } from "expo-status-bar";
import DashboardScreen from "@/screens/DashboardScreen";
import TeamScreen from "@/screens/TeamScreen";
import MockShopScreen from "@/screens/MockShopScreen";
import { palette } from "@/styles/theme";

export default function App() {
  const theme = useMemo(
    () => ({
      ...MD3LightTheme,
      colors: {
        ...MD3LightTheme.colors,
        primary: palette.primary,
        secondary: palette.secondary,
        background: palette.background,
        surface: palette.surface,
        error: palette.error
      }
    }),
    []
  );

  const [index, setIndex] = useState(0);
  const [sharedAccount, setSharedAccount] = useState(null);
  const [routes] = useState([
    { key: "dashboard", title: "Dashboard", focusedIcon: "view-dashboard" },
    { key: "mockshop", title: "Mock Shop", focusedIcon: "shopping" },
    { key: "team", title: "Team", focusedIcon: "account-group" }
  ]);

  const renderScene = ({ route }) => {
    switch (route.key) {
      case "dashboard":
        return <DashboardScreen onAccountChange={setSharedAccount} />;
      case "mockshop":
        return <MockShopScreen account={sharedAccount} />;
      case "team":
        return <TeamScreen />;
      default:
        return null;
    }
  };

  return (
    <PaperProvider theme={theme}>
      <StatusBar style="dark" />
      <BottomNavigation
        navigationState={{ index, routes }}
        onIndexChange={setIndex}
        renderScene={renderScene}
        shifting={false}
        barStyle={{ backgroundColor: theme.colors.surface }}
      />
    </PaperProvider>
  );
}
