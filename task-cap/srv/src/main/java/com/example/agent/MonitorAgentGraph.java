package com.example.agent;

import com.example.sse.SseEmitterRegistry;
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
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.bsc.langgraph4j.StateGraph.END;
import static org.bsc.langgraph4j.StateGraph.START;
import static org.bsc.langgraph4j.action.AsyncNodeAction.node_async;

@Configuration
public class MonitorAgentGraph {

    private static final Logger log = LoggerFactory.getLogger(MonitorAgentGraph.class);
    private static final String ODATA_URL = "http://localhost:8080/odata/v4/api/Tasks";

    private final AtomicReference<String> previousSnapshot = new AtomicReference<>(null);

    @Bean
    public CompiledGraph<MonitorAgentState> monitorGraph(SseEmitterRegistry registry) throws Exception {
        HttpClient httpClient = HttpClient.newBuilder()
                .version(HttpClient.Version.HTTP_1_1)
                .build();

        AsyncNodeAction<MonitorAgentState> snapshotNode = node_async(state -> {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(ODATA_URL))
                    .GET()
                    .build();
            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            String body = res.body();
            String prev = previousSnapshot.get();
            boolean changed = !body.equals(prev);
            return Map.of("task_snapshot", body, "changed", changed);
        });

        AsyncNodeAction<MonitorAgentState> notifyNode = node_async(state -> {
            boolean changed = state.value("changed").map(v -> (Boolean) v).orElse(false);
            if (!changed) {
                return Map.of();
            }
            String snapshot = state.value("task_snapshot").map(Object::toString).orElse("");
            previousSnapshot.set(snapshot);
            registry.broadcast("tasks_changed", "{\"type\":\"tasks_changed\"}");
            return Map.of();
        });

        return new StateGraph<>(MonitorAgentState.SCHEMA, MonitorAgentState::new)
                .addNode("snapshot", snapshotNode)
                .addNode("notify",   notifyNode)
                .addEdge(START,      "snapshot")
                .addEdge("snapshot", "notify")
                .addEdge("notify",   END)
                .compile();
    }
}
