import React, { useMemo, useState } from "react";
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DashboardScreen from "./screens/DashboardScreen";
import MockShopScreen from "./screens/MockShopScreen";
import TeamScreen from "./screens/TeamScreen";

const Tab = createBottomTabNavigator();

// Root application shell that coordinates the navigation, hero, and page content.

const apiUrlOverride = process.env.REACT_APP_API_URL;
const apiId = process.env.REACT_APP_API_ID;
const apiRegion =
  process.env.REACT_APP_API_REGION || process.env.REACT_APP_AWS_REGION;
const apiStage = process.env.REACT_APP_API_STAGE || "prod";

const API_URL =
  apiUrlOverride ||
  (apiId && apiRegion
    ? `https://${apiId}.execute-api.${apiRegion}.amazonaws.com/${apiStage}`
    : "");

const NAV_ITEMS = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "team", label: "Team" },
];

const heroCopy = {
  home: {
    title: "Fraud Detection Demo",
    subtitle:
      "Credit Card Fraud Detection using Machine Learning on AWS.",},
  about: {
    title: "About the Collaboration",
    subtitle:
      "A Capital One × UW–Madison capstone focused on accelerating AWS innovation.",
  },
  team: {
    title: "Meet the Team",
    subtitle:
      "Builders and mentors powering the fraud detection learning journey.",
  },
};

function App() {
  const [account, setAccount] = useState(null);
  const [lastTransaction, setLastTransaction] = useState(null);

  const handleTransactionComplete = (result) => {
    setLastTransaction(result);
  };

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#3b5998',
          tabBarInactiveTintColor: '#7f8c8d',
          headerShown: false
        }}
      >
        <Tab.Screen
          name="Dashboard"
          options={{
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="view-dashboard" size={size} color={color} />
            )
          }}
        >
          {(props) => (
            <DashboardScreen
              {...props}
              onAccountChange={setAccount}
            />
          )}
        </Tab.Screen>
        <Tab.Screen
          name="Mock Shop"
          options={{
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="store" size={size} color={color} />
            )
          }}
        >
          {(props) => (
            <MockShopScreen
              {...props}
              account={account}
              onTransactionComplete={handleTransactionComplete}
            />
          )}
        </Tab.Screen>
        <Tab.Screen
          name="Team"
          component={TeamScreen}
          options={{
            tabBarIcon: ({ color, size}) => (
              <MaterialCommunityIcons name="account-group" size={size} color={color} />
            )
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default App;
