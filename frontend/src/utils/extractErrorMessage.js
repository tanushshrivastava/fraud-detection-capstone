// Normalize various Axios error shapes into a human-readable string.
const extractErrorMessage = (error) => {
  const data = error?.response?.data;

  if (typeof data === "string") {
    return data;
  }

  if (data && typeof data === "object") {
    if (typeof data.message === "string") {
      return data.message;
    }
    if (typeof data.error === "string") {
      return data.error;
    }
    try {
      return JSON.stringify(data, null, 2);
    } catch (jsonError) {
      // ignore JSON stringify failures and fall back to generic handling
    }
  }

  if (typeof error?.message === "string") {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Request failed unexpectedly.";
};

export default extractErrorMessage;
