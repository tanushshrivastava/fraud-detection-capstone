import axios from "axios";
import Constants from "expo-constants";

const getExtra = () => {
  const expoConfig = Constants.expoConfig ?? Constants.manifest;
  return expoConfig?.extra ?? {};
};

const { apiUrl } = getExtra();

if (!apiUrl) {
  console.warn(
    "[api] Missing REACT_APP_API_URL environment variable. Check your .env configuration."
  );
}

const client = axios.create({
  baseURL: apiUrl,
  headers: {
    "Content-Type": "application/json"
  },
  timeout: 15000
});

const buildError = (error) => {
  if (error.response) {
    const { status, data } = error.response;
    const message =
      data?.message ||
      data?.error ||
      `Request failed with status ${status}. Please try again.`;
    return new Error(message);
  }

  if (error.request) {
    return new Error("No response received from the server. Check connectivity.");
  }

  return new Error(error.message || "Unexpected error occurred.");
};

export const createAccount = async (payload) => {
  try {
    const response = await client.post("/accounts", payload);
    return response.data;
  } catch (error) {
    throw buildError(error);
  }
};

export const loginAccount = async (payload) => {
  try {
    const response = await client.post("/login", payload);
    return response.data;
  } catch (error) {
    throw buildError(error);
  }
};

export const updateAccountSettings = async (payload) => {
  try {
    const response = await client.put("/accounts/settings", payload);
    return response.data;
  } catch (error) {
    throw buildError(error);
  }
};

export const submitTransaction = async (payload) => {
  try {
    const response = await client.post("/transactions", payload);
    return response.data;
  } catch (error) {
    throw buildError(error);
  }
};

export const fetchRecentTransactions = async (accountId, limit = 10) => {
  try {
    const response = await client.get(
      `/accounts/${encodeURIComponent(accountId)}/transactions`,
      {
        params: {
          limit
        }
      }
    );
    return response.data;
  } catch (error) {
    throw buildError(error);
  }
};
