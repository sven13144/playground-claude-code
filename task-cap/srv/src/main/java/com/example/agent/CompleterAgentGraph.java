package com.example.agent;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.bsc.langgraph4j.CompiledGraph;
import org.bsc.langgraph4j.StateGraph;
import org.bsc.langgraph4j.action.AsyncNodeAction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Random;

import static org.bsc.langgraph4j.StateGraph.END;
import static org.bsc.langgraph4j.StateGraph.START;
import static org.bsc.langgraph4j.action.AsyncNodeAction.node_async;

@Configuration
public class CompleterAgentGraph {

    private static final Logger log = LoggerFactory.getLogger(CompleterAgentGraph.class);

    private static final String ODATA_BASE = "http://localhost:8080/odata/v4/api/Tasks";
    private static final Random RANDOM = new Random();

    @Bean
    public CompiledGraph<CompleterAgentState> completerGraph() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        HttpClient httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .build();

        // Node 1: fetch all incomplete tasks and pick one at random
        AsyncNodeAction<CompleterAgentState> pickNode = node_async(state -> {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(ODATA_BASE + "?$filter=completed%20eq%20false&$select=ID,title"))
                    .GET()
                    .build();
            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() >= 400) {
                log.warn("GET tasks failed: {} — {}", res.statusCode(), res.body());
                return Map.of("task_id", "", "task_title", "");
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> body = mapper.readValue(res.body(), Map.class);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> tasks = (List<Map<String, Object>>) body.getOrDefault("value", List.of());
            if (tasks.isEmpty()) {
                return Map.of("task_id", "", "task_title", "");
            }
            Map<String, Object> picked = tasks.get(RANDOM.nextInt(tasks.size()));
            return Map.of(
                "task_id",    picked.getOrDefault("ID", ""),
                "task_title", picked.getOrDefault("title", "")
            );
        });

        // Node 2: PATCH the chosen task to completed=true
        AsyncNodeAction<CompleterAgentState> completeNode = node_async(state -> {
            String id    = state.value("task_id").map(Object::toString).orElse("");
            String title = state.value("task_title").map(Object::toString).orElse("?");
            if (id.isEmpty()) {
                log.info("Completer: no incomplete tasks found, skipping");
                return Map.of();
            }
            String patchBody = mapper.writeValueAsString(Map.of(
                    "completed",   true,
                    "completedAt", Instant.now().toString()
            ));
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(ODATA_BASE + "(" + id + ")"))
                    .header("Content-Type", "application/json")
                    .method("PATCH", HttpRequest.BodyPublishers.ofString(patchBody))
                    .build();
            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() >= 400) {
                log.warn("PATCH task failed: {} — {}", res.statusCode(), res.body());
            } else {
                log.info("Completer: marked '{}' as done", title);
            }
            return Map.of();
        });

        return new StateGraph<>(CompleterAgentState.SCHEMA, CompleterAgentState::new)
                .addNode("pick",     pickNode)
                .addNode("complete", completeNode)
                .addEdge(START,    "pick")
                .addEdge("pick",   "complete")
                .addEdge("complete", END)
                .compile();
    }
}
