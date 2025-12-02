import { config } from "dotenv";

config({ path: "../.env" });

export default () => ({
  name: "FraudDashboard",
  slug: "fraud-dashboard",
  version: "1.0.0",
  orientation: "default",
  userInterfaceStyle: "light",
  updates: {
    fallbackToCacheTimeout: 0
  },
  platforms: ["ios", "android", "web"],
  ios: {
    supportsTablet: true
  },
  android: {
    package: "com.fraud.dashboard"
  },
  web: {
    bundler: "metro",
    favicon: "./assets/favico.png"
  },
  extra: {
    apiUrl: process.env.REACT_APP_API_URL,
    apiId: process.env.REACT_APP_API_ID,
    apiRegion: process.env.REACT_APP_API_REGION,
    apiStage: process.env.REACT_APP_API_STAGE
  }
});
