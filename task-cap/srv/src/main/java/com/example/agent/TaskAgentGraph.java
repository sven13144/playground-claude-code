package com.example.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.anthropic.AnthropicChatModel;
import dev.langchain4j.model.chat.ChatLanguageModel;
import org.bsc.langgraph4j.CompiledGraph;
import org.bsc.langgraph4j.StateGraph;
import org.bsc.langgraph4j.action.AsyncNodeAction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;
import java.util.UUID;

import static org.bsc.langgraph4j.StateGraph.END;
import static org.bsc.langgraph4j.StateGraph.START;
import static org.bsc.langgraph4j.action.AsyncNodeAction.node_async;

@Configuration
public class TaskAgentGraph {

    private static final Logger log = LoggerFactory.getLogger(TaskAgentGraph.class);

    @Value("${hyperspace.proxy-url}")
    private String proxyUrl;

    @Value("${hyperspace.api-key}")
    private String apiKey;

    @Value("${hyperspace.model}")
    private String model;

    private static final String ODATA_URL = "http://localhost:8080/odata/v4/api/Tasks";

    @Bean
    public CompiledGraph<TaskAgentState> compiledGraph() throws Exception {
        String baseUrl = proxyUrl.replace("/messages", "/");

        ChatLanguageModel llm = AnthropicChatModel.builder()
                .baseUrl(baseUrl)
                .apiKey(apiKey)
                .modelName(model)
                .maxTokens(300)
                .build();

        ObjectMapper mapper = new ObjectMapper();
        HttpClient httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .build();

        AsyncNodeAction<TaskAgentState> generateNode = node_async(state -> {
            String prompt = """
                    Brainstorm a quirky AI hackathon task.
                    Return ONLY valid JSON with exactly two fields: title and description.
                    Example: {"title":"Fix the robots","description":"Make them less snarky"}
                    """;
            String response = llm.chat(UserMessage.from(prompt)).aiMessage().text();
            @SuppressWarnings("unchecked")
            Map<String, Object> json = mapper.readValue(extractJson(response), Map.class);
            return Map.of(
                "draft_title", json.getOrDefault("title", "AI Task"),
                "draft_desc",  json.getOrDefault("description", "")
            );
        });

        AsyncNodeAction<TaskAgentState> refineNode = node_async(state -> {
            String draftTitle = state.value("draft_title").map(Object::toString).orElse("");
            String draftDesc  = state.value("draft_desc").map(Object::toString).orElse("");
            String prompt = String.format("""
                    Improve this hackathon task. The title MUST start with 'AI '.
                    Current title: %s
                    Current description: %s
                    Return ONLY valid JSON with exactly two fields: title and description.
                    Example: {"title":"AI Fix the robots","description":"Make them less snarky"}
                    """, draftTitle, draftDesc);
            String response = llm.chat(UserMessage.from(prompt)).aiMessage().text();
            @SuppressWarnings("unchecked")
            Map<String, Object> json = mapper.readValue(extractJson(response), Map.class);
            return Map.of(
                "final_title", json.getOrDefault("title", "AI Task"),
                "final_desc",  json.getOrDefault("description", "")
            );
        });

        AsyncNodeAction<TaskAgentState> createNode = node_async(state -> {
            String title = state.value("final_title").map(Object::toString).orElse("AI Task");
            String desc  = state.value("final_desc").map(Object::toString).orElse("");
            String id    = UUID.randomUUID().toString();
            String body  = mapper.writeValueAsString(Map.of(
                "ID",          id,
                "title",       title,
                "description", desc,
                "completed",   false
            ));
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(ODATA_URL))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build();
            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() >= 400) {
                log.warn("OData POST failed: {} — {}", res.statusCode(), res.body());
            }
            return Map.of();
        });

        return new StateGraph<>(TaskAgentState.SCHEMA, TaskAgentState::new)
                .addNode("generate", generateNode)
                .addNode("refine",   refineNode)
                .addNode("create",   createNode)
                .addEdge(START,      "generate")
                .addEdge("generate", "refine")
                .addEdge("refine",   "create")
                .addEdge("create",   END)
                .compile();
    }

    private static String extractJson(String text) {
        int start = text.indexOf('{');
        int end   = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return text.substring(start, end + 1);
        }
        return text.trim();
    }
}
