package com.example.agent;

import org.bsc.langgraph4j.CompiledGraph;
import org.bsc.langgraph4j.RunnableConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Random;

@Component
public class CompleterAgentScheduler {

    private static final Logger log = LoggerFactory.getLogger(CompleterAgentScheduler.class);
    private static final Random RANDOM = new Random();

    private final CompiledGraph<CompleterAgentState> graph;
    private final TaskScheduler taskScheduler;

    public CompleterAgentScheduler(CompiledGraph<CompleterAgentState> graph,
                                   TaskScheduler taskScheduler) {
        this.graph = graph;
        this.taskScheduler = taskScheduler;
    }

    @PostConstruct
    public void start() {
        scheduleNext();
    }

    private void scheduleNext() {
        long delayMs = 5_000 + (long) (RANDOM.nextInt(10_001)); // 5000–15000 ms
        taskScheduler.schedule(() -> {
            try {
                graph.invoke(Map.of(), RunnableConfig.builder().build());
            } catch (Exception e) {
                log.error("Completer agent run failed", e);
            } finally {
                scheduleNext();
            }
        }, Instant.now().plus(Duration.ofMillis(delayMs)));
    }
}
