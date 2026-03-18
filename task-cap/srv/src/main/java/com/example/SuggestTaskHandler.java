package com.example;

import com.sap.cds.services.handler.EventHandler;
import com.sap.cds.services.handler.annotations.On;
import com.sap.cds.services.handler.annotations.ServiceName;
import cds.gen.taskservice.SuggestTaskContext;
import cds.gen.taskservice.TaskService_;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpClient.Version;

@Component
@ServiceName(TaskService_.CDS_NAME)
public class SuggestTaskHandler implements EventHandler {

    private static final Logger log = LoggerFactory.getLogger(SuggestTaskHandler.class);

    @Value("${hyperspace.proxy-url}")
    private String proxyUrl;

    @Value("${hyperspace.api-key}")
    private String apiKey;

    @Value("${hyperspace.model}")
    private String model;

    @On(event = SuggestTaskContext.CDS_NAME)
    public void onSuggestTask(SuggestTaskContext ctx) {
        String prompt = "Generate a single creative, quirky task for an AI hackathon task board. "
                + "Return ONLY valid JSON with exactly these two fields: "
                + "{\\\"title\\\": \\\"short punchy task title (max 8 words, no emoji)\\\", "
                + "\\\"description\\\": \\\"a fun ASCII art scene (max 10 lines, under 200 chars) that visually represents the task. Use box-drawing chars, symbols, emoji. Keep lines under 22 chars.\\\"} "
                + "No explanation, no markdown fences, just the JSON object.";

        String requestBody = String.format(
                "{\"model\":\"%s\",\"max_tokens\":300,\"messages\":[{\"role\":\"user\",\"content\":\"%s\"}]}",
                model, prompt);

        try {
            HttpClient client = HttpClient.newBuilder()
                    .version(Version.HTTP_1_1)
                    .build();
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(proxyUrl))
                    .header("Content-Type", "application/json")
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .build();

            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.error("Hyperspace proxy error {}: {}", response.statusCode(), response.body());
                ctx.setCompleted();
                return;
            }

            String text = extractText(response.body());
            text = text.replaceAll("(?s)^```(?:json)?\\s*", "").replaceAll("\\s*```$", "").trim();

            String title = extractJsonString(text, "title");
            String description = extractJsonString(text, "description");

            SuggestTaskContext.ReturnType result = SuggestTaskContext.ReturnType.create();
            result.setTitle(title);
            result.setDescription(description);
            log.info("suggestTask result: title={}, desc={}", title, description);
            ctx.setResult(result);
            ctx.setCompleted();

        } catch (Exception e) {
            log.error("suggestTask failed", e);
            ctx.setCompleted();
        }
    }

    private String extractText(String json) {
        int idx = json.indexOf("\"text\"");
        if (idx < 0) return "{}";
        int start = json.indexOf("\"", idx + 7) + 1;
        int end = findStringEnd(json, start);
        return json.substring(start, end)
                .replace("\\n", "\n")
                .replace("\\\"", "\"")
                .replace("\\\\", "\\");
    }

    private String extractJsonString(String json, String key) {
        int idx = json.indexOf("\"" + key + "\"");
        if (idx < 0) return "";
        int colon = json.indexOf(":", idx);
        int start = json.indexOf("\"", colon) + 1;
        int end = findStringEnd(json, start);
        return json.substring(start, end)
                .replace("\\n", "\n")
                .replace("\\\"", "\"");
    }

    private int findStringEnd(String s, int start) {
        for (int i = start; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\\') { i++; continue; }
            if (c == '"') return i;
        }
        return s.length();
    }
}
