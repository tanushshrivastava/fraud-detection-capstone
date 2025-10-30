import "react-native-gesture-handler";
import { useMemo } from "react";
import { MD3LightTheme, Provider as PaperProvider } from "react-native-paper";
import { StatusBar } from "expo-status-bar";
import DashboardScreen from "@/screens/DashboardScreen";
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

  return (
    <PaperProvider theme={theme}>
      <StatusBar style="dark" />
      <DashboardScreen />
    </PaperProvider>
  );
}
