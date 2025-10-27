package com.fraud.lambda;

import com.twilio.Twilio;
import com.twilio.rest.api.v2010.account.Message;
import com.twilio.type.PhoneNumber;

public class TwilioService {
    private static final String TWILIO_ACCOUNT_SID = System.getenv("TWILIO_ACCOUNT_SID");
    private static final String TWILIO_AUTH_TOKEN = System.getenv("TWILIO_AUTH_TOKEN");
    private static final String TWILIO_PHONE_NUMBER = System.getenv("TWILIO_PHONE_NUMBER");

    private static boolean initialized = false;

    // Initialize Twilio client. Safe to call multiple times.
    private static void ensureInitialized() {
        if (!initialized && TWILIO_ACCOUNT_SID != null && TWILIO_AUTH_TOKEN != null) {
            Twilio.init(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
            initialized = true;
        }
    }

    // Check if Twilio is properly configured
    public static boolean isConfigured() {
        return TWILIO_ACCOUNT_SID != null
                && TWILIO_AUTH_TOKEN != null
                && TWILIO_PHONE_NUMBER != null
                && !TWILIO_ACCOUNT_SID.isBlank()
                && !TWILIO_AUTH_TOKEN.isBlank()
                && !TWILIO_PHONE_NUMBER.isBlank();
    }

    /**
     * Send a fraud alert SMS to customer
     * 
     * @param toPhoneNumber     Customer's phone number (e.g., "+15551234567")
     * @param transactionId     Unique transaction identifier
     * @param fraudScore        Fraud prediction score (0.0 to 1.0)
     * @param transactionAmount Transaction amount
     * @param location          Transaction location
     * @return Message SID if successful, null if failed
     */
    public static String sendFraudAlert(String toPhoneNumber, String transactionId,
            String transactionAmount, String location) {
        if (!isConfigured()) {
            throw new IllegalStateException("Twilio is not configured. Check environment variables.");
        }

        ensureInitialized();

        // Build the message
        StringBuilder messageText = new StringBuilder();
        messageText.append("CapOne Fraud Alert:\n\n");
        messageText.append("We detected a possible fraudulent transaction on your account.\n");

        if (transactionAmount != null && !transactionAmount.isBlank()) {
            messageText.append("$").append(transactionAmount).append(" at ");
        }

        if (location != null && !location.isBlank()) {
            messageText.append(location).append(".\n"); // TODO: Add timestamp if available
        }

        messageText.append("Transaction ID: ").append(transactionId);
        messageText.append("Was this you?\n");
        messageText.append("Reply YES if this transaction is valid, or NO if it's fraudulent.\n\n");
        messageText.append("Thank you for helping us protect your account.\n");
        messageText.append("Reply STOP to opt out of these alerts.");

        try {
            Message message = Message.creator(
                    new PhoneNumber(toPhoneNumber),
                    new PhoneNumber(TWILIO_PHONE_NUMBER),
                    messageText.toString()).create();

            return message.getSid();
        } catch (Exception e) {
            throw new RuntimeException("Failed to send SMS: " + e.getMessage(), e);
        }
    }

    /**
     * Parse the incoming SMS response from a customer
     * TODO: Revise after getting approved by Twilio
     * 
     * @param messageBody The text content of the SMS reply
     * @return true if user confirmed fraud, false if legitimate, null if unclear
     */
    public static Boolean parseFraudConfirmation(String messageBody) {
        if (messageBody == null || messageBody.isBlank()) {
            return null;
        }

        String normalized = messageBody.trim().toUpperCase();

        // Check for opt-out keywords (STOP, UNSUBSCRIBE, etc.)
        // Note: Twilio automatically handles STOP, but we log it
        if (normalized.equals("STOP") || normalized.equals("STOPALL") ||
                normalized.equals("UNSUBSCRIBE") || normalized.equals("CANCEL") ||
                normalized.equals("END") || normalized.equals("QUIT")) {
            // User wants to opt out - this will be handled by Twilio automatically
            // Return null so webhook doesn't try to process it as fraud confirmation
            return null;
        }

        // Check for affirmative responses (YES means legitimate)
        if (normalized.equals("YES") || normalized.equals("Y") ||
                normalized.equals("FRAUD") || normalized.equals("TRUE")) {
            return false;
        }

        // Check for negative responses (NO means fraud)
        if (normalized.equals("NO") || normalized.equals("N") ||
                normalized.equals("LEGITIMATE") || normalized.equals("FALSE") ||
                normalized.equals("NOT FRAUD")) {
            return true;
        }

        // Unclear responses
        return null;
    }

    /**
     * Send a confirmation message after processing user's response
     */
    public static String sendConfirmation(String toPhoneNumber, boolean wasFraud) {
        if (!isConfigured()) {
            throw new IllegalStateException("Twilio is not configured.");
        }

        ensureInitialized();

        String messageText = wasFraud
                ? "Thank you. We've marked this transaction as FRAUDULENT and will investigate."
                : "Thank you. We've confirmed this transaction as LEGITIMATE.";

        try {
            Message message = Message.creator(
                    new PhoneNumber(toPhoneNumber),
                    new PhoneNumber(TWILIO_PHONE_NUMBER),
                    messageText).create();

            return message.getSid();
        } catch (Exception e) {
            throw new RuntimeException("Failed to send confirmation SMS: " + e.getMessage(), e);
        }
    }

}
