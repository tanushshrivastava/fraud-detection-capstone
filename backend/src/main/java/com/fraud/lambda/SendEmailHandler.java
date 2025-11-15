package com.fraud.lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyRequestEvent;
import com.amazonaws.services.lambda.runtime.events.APIGatewayProxyResponseEvent;
import com.fasterxml.jackson.databind.JsonNode;
import software.amazon.awssdk.services.ses.SesClient;
import software.amazon.awssdk.services.ses.model.Body;
import software.amazon.awssdk.services.ses.model.Content;
import software.amazon.awssdk.services.ses.model.Destination;
import software.amazon.awssdk.services.ses.model.Message;
import software.amazon.awssdk.services.ses.model.SendEmailRequest;
import software.amazon.awssdk.services.ses.model.SendEmailResponse;

/**
 * Lambda handler for sending emails via AWS SES.
 *
 * Purpose: Provides email notification capability for the Mock Shop feature.
 * Current: Sends simple test emails to the capstone team.
 * Future: Will send transaction receipts and fraud alerts with full details.
 *
 * Design Notes:
 * - Uses AWS SES for reliable email delivery
 * - Sender email must be verified in SES (see deployment instructions)
 * - Payload validation ensures required fields are present
 * - Error handling returns clear messages for debugging
 *
 * Expected Request Body:
 * {
 * "to": "recipient@example.com",
 * "subject": "Email subject",
 * "body": "Email body content"
 * }
 */
public class SendEmailHandler extends FraudLambdaHandler {
    private static final String FROM_EMAIL = System.getenv("FROM_EMAIL");
    private static final String DEFAULT_FROM_EMAIL = "newcscapstone@gmail.com";

    private final SesClient sesClient;

    public SendEmailHandler() {
        this.sesClient = SesClient.builder().build();
    }

    // Constructor for testing with dependency injection
    public SendEmailHandler(SesClient sesClient) {
        this.sesClient = sesClient;
    }

    /**
     * Handles email sending requests.
     *
     * @param event        API Gateway request with email details (to, subject,
     *                     body)
     * @param context      Lambda execution context
     * @param baseResponse Pre-configured response with CORS headers
     * @return Response with success message and SES message ID
     */
    @Override
    protected APIGatewayProxyResponseEvent doHandle(
            APIGatewayProxyRequestEvent event,
            Context context,
            APIGatewayProxyResponseEvent baseResponse) throws Exception {

        // Only accept POST requests
        if (!"POST".equals(getNormalizedMethod(event))) {
            return setResponse(baseResponse, 405, "{\"error\":\"Method not allowed\"}");
        }

        context.getLogger().log("SendEmailHandler invoked");
        
        // Parse request body
        JsonNode bodyNode = parseBody(event);
        context.getLogger().log("Request body parsed: " + bodyNode.toString());

        // Extract and validate required fields
        String to = requireText(bodyNode, "to");
        String subject = requireText(bodyNode, "subject");
        String body = requireText(bodyNode, "body");

        // Determine sender email
        String fromEmail = (FROM_EMAIL != null && !FROM_EMAIL.isBlank())
                ? FROM_EMAIL
                : DEFAULT_FROM_EMAIL;

        context.getLogger().log(String.format(
                "Sending email from=%s to=%s subject=%s body=%s",
                fromEmail, to, subject, body));

        try {
            // Build and send email using SES
            SendEmailRequest emailRequest = SendEmailRequest.builder()
                    .source(fromEmail)
                    .destination(Destination.builder()
                            .toAddresses(to)
                            .build())
                    .message(Message.builder()
                            .subject(Content.builder()
                                    .charset("UTF-8")
                                    .data(subject)
                                    .build())
                            .body(Body.builder()
                                    .text(Content.builder()
                                            .charset("UTF-8")
                                            .data(body)
                                            .build())
                                    .build())
                            .build())
                    .build();

            context.getLogger().log("Calling SES sendEmail...");
            SendEmailResponse emailResponse = sesClient.sendEmail(emailRequest);
            String messageId = emailResponse.messageId();

            context.getLogger().log(String.format(
                    "Email sent successfully. MessageId=%s", messageId));

            // Build success response
            String responseBody = String.format(
                    "{\"message\":\"Email sent successfully\",\"messageId\":\"%s\"}",
                    messageId);

            return setResponse(baseResponse, 200, responseBody);

        } catch (Exception e) {
            context.getLogger().log(String.format(
                    "Failed to send email: %s", e.getMessage()));
            e.printStackTrace();
            throw new RuntimeException("Failed to send email: " + e.getMessage(), e);
        }
    }

    @Override
    protected void finalize() throws Throwable {
        if (sesClient != null) {
            sesClient.close();
        }
        super.finalize();
    }
}

