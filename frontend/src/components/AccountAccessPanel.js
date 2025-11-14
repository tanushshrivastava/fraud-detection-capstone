import { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  Button,
  Checkbox,
  HelperText,
  SegmentedButtons,
  Text,
  TextInput
} from "react-native-paper";
import SectionCard from "@/components/SectionCard";
import { spacing } from "@/styles/theme";

const initialRegisterState = {
  username: "",
  email: "",
  address: "",
  password: "",
  phoneNumber: "",
  smsOptIn: false,
  first_name: "",
  last_name: "",
  cc_num: "",
  gender: "",
  date_of_birth: "",
  job: "",
  city: "",
  state: "",
  zip: "",
  street: ""
};

const initialLoginState = {
  username: "",
  password: ""
};

const AccountAccessPanel = ({ onCreateAccount, onLoginAccount, isCompact, title = "Account Access" }) => {
  const [mode, setMode] = useState("login");
  const [registerForm, setRegisterForm] = useState(initialRegisterState);
  const [loginForm, setLoginForm] = useState(initialLoginState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleRegisterChange = (field, value) => {
    setRegisterForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLoginChange = (field, value) => {
    setLoginForm((prev) => ({ ...prev, [field]: value }));
  };

  const disableSubmit =
    isSubmitting ||
    (mode === "login"
      ? !loginForm.username || !loginForm.password
      : !registerForm.username ||
          !registerForm.email ||
          !registerForm.address ||
          !registerForm.password ||
          !registerForm.first_name ||
          !registerForm.last_name ||
          !registerForm.cc_num ||
          !registerForm.gender ||
          !registerForm.date_of_birth ||
          !registerForm.job ||
          !registerForm.city ||
          !registerForm.state ||
          !registerForm.zip ||
          !registerForm.street ||
          !registerForm.smsOptIn);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      if (mode === "register") {
        console.log("Sending registration data:", registerForm);
        await onCreateAccount(registerForm);
        setRegisterForm(initialRegisterState);
        setMode("login");
      } else {
        await onLoginAccount(loginForm);
      }
    } catch (err) {
      setError(err.message || "Unable to process request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRegisterForm = () => (
    <View style={styles.form}>
      <TextInput
        label="Username"
        value={registerForm.username}
        onChangeText={(text) => handleRegisterChange("username", text)}
        mode="outlined"
        autoCapitalize="none"
        autoComplete="username"
      />
      <TextInput
        label="Email"
        value={registerForm.email}
        onChangeText={(text) => handleRegisterChange("email", text)}
        mode="outlined"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <TextInput
        label="Password"
        value={registerForm.password}
        onChangeText={(text) => handleRegisterChange("password", text)}
        mode="outlined"
        secureTextEntry
        autoComplete="password-new"
      />
      <View style={styles.row}>
        <TextInput
          label="First Name"
          value={registerForm.first_name}
          onChangeText={(text) => handleRegisterChange("first_name", text)}
          mode="outlined"
          autoCapitalize="words"
          style={styles.halfWidth}
        />
        <TextInput
          label="Last Name"
          value={registerForm.last_name}
          onChangeText={(text) => handleRegisterChange("last_name", text)}
          mode="outlined"
          autoCapitalize="words"
          style={styles.halfWidth}
        />
      </View>
      <TextInput
        label="Credit Card Number"
        value={registerForm.cc_num}
        onChangeText={(text) => handleRegisterChange("cc_num", text)}
        mode="outlined"
        keyboardType="numeric"
        maxLength={16}
      />
      <View style={styles.row}>
        <TextInput
          label="Gender (M/F)"
          value={registerForm.gender}
          onChangeText={(text) => handleRegisterChange("gender", text.toUpperCase())}
          mode="outlined"
          maxLength={1}
          style={styles.quarterWidth}
        />
        <TextInput
          label="Date of Birth (YYYY-MM-DD)"
          value={registerForm.date_of_birth}
          onChangeText={(text) => handleRegisterChange("date_of_birth", text)}
          mode="outlined"
          placeholder="1990-01-01"
          style={styles.threeQuarterWidth}
        />
      </View>
      <TextInput
        label="Job/Occupation"
        value={registerForm.job}
        onChangeText={(text) => handleRegisterChange("job", text)}
        mode="outlined"
        autoCapitalize="words"
      />
      <TextInput
        label="Street Address"
        value={registerForm.street}
        onChangeText={(text) => handleRegisterChange("street", text)}
        mode="outlined"
        autoCapitalize="words"
      />
      <View style={styles.row}>
        <TextInput
          label="City"
          value={registerForm.city}
          onChangeText={(text) => handleRegisterChange("city", text)}
          mode="outlined"
          autoCapitalize="words"
          style={styles.halfWidth}
        />
        <TextInput
          label="State"
          value={registerForm.state}
          onChangeText={(text) => handleRegisterChange("state", text.toUpperCase())}
          mode="outlined"
          maxLength={2}
          style={styles.quarterWidth}
        />
        <TextInput
          label="ZIP"
          value={registerForm.zip}
          onChangeText={(text) => handleRegisterChange("zip", text)}
          mode="outlined"
          keyboardType="numeric"
          maxLength={5}
          style={styles.quarterWidth}
        />
      </View>
      <TextInput
        label="Mailing Address (Full)"
        value={registerForm.address}
        onChangeText={(text) => handleRegisterChange("address", text)}
        mode="outlined"
        autoCapitalize="words"
      />
      <TextInput
        label="SMS Phone (Optional)"
        value={registerForm.phoneNumber}
        onChangeText={(text) => handleRegisterChange("phoneNumber", text)}
        mode="outlined"
        keyboardType="phone-pad"
      />
      <View style={styles.checkboxRow}>
        <Checkbox
          status={registerForm.smsOptIn ? "checked" : "unchecked"}
          onPress={() => handleRegisterChange("smsOptIn", !registerForm.smsOptIn)}
        />
        <Text variant="bodySmall" style={styles.checkboxLabel}>
          I agree to receive SMS alerts about potential fraud activity.
        </Text>
      </View>
    </View>
  );

  const renderLoginForm = () => (
    <View style={styles.form}>
      <TextInput
        label="Username"
        value={loginForm.username}
        onChangeText={(text) => handleLoginChange("username", text)}
        mode="outlined"
        autoCapitalize="none"
        autoComplete="username"
      />
      <TextInput
        label="Password"
        value={loginForm.password}
        onChangeText={(text) => handleLoginChange("password", text)}
        mode="outlined"
        secureTextEntry
        autoComplete="password"
      />
    </View>
  );

  const toggle = (
    <SegmentedButtons
      value={mode}
      onValueChange={setMode}
      buttons={[
        { value: "login", label: "Sign In" },
        { value: "register", label: "Create Account" }
      ]}
      density={isCompact ? "small" : "regular"}
      style={isCompact ? styles.compactSegmented : undefined}
    />
  );

  const headerActions = isCompact ? null : toggle;

  return (
    <SectionCard
      title={title}
      subtitle="Create a new account or sign into an existing one."
      actions={headerActions}
    >
      <View style={styles.container}>
        {isCompact ? <View style={styles.inlineToggle}>{toggle}</View> : null}
        {mode === "register" ? renderRegisterForm() : renderLoginForm()}
        {error ? (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        ) : null}
        <Button
          mode="contained"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={disableSubmit}
        >
          {mode === "register" ? "Create Account" : "Sign In"}
        </Button>
      </View>
    </SectionCard>
  );
};

const styles = StyleSheet.create({
  container: {
    rowGap: spacing(1.5)
  },
  form: {
    rowGap: spacing(1.5)
  },
  row: {
    flexDirection: "row",
    columnGap: spacing(1)
  },
  halfWidth: {
    flex: 1
  },
  quarterWidth: {
    flex: 0.25
  },
  threeQuarterWidth: {
    flex: 0.75
  },
  compactSegmented: {
    alignSelf: "stretch"
  },
  inlineToggle: {
    alignSelf: "stretch",
    marginBottom: spacing(1)
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: spacing(1)
  },
  checkboxLabel: {
    flex: 1,
    color: "#4B5563"
  }
});

export default AccountAccessPanel;
