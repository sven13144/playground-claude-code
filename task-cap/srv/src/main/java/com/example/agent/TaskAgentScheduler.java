package com.example.agent;

import org.bsc.langgraph4j.CompiledGraph;
import org.bsc.langgraph4j.RunnableConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class TaskAgentScheduler {

    private static final Logger log = LoggerFactory.getLogger(TaskAgentScheduler.class);

    private final CompiledGraph<TaskAgentState> graph;

    public TaskAgentScheduler(CompiledGraph<TaskAgentState> graph) {
        this.graph = graph;
    }

    @Scheduled(fixedRateString = "${agent.interval-ms:10000}")
    public void run() {
        try {
            graph.invoke(Map.of(), RunnableConfig.builder().build())
                 .ifPresent(state ->
                     log.info("AI task created: {}", state.value("final_title").orElse("?")));
        } catch (Exception e) {
            log.error("Agent run failed", e);
        }
    }
}
