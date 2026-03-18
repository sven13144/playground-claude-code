package com.example.agent;

import org.bsc.langgraph4j.CompiledGraph;
import org.bsc.langgraph4j.RunnableConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class MonitorAgentScheduler {

    private static final Logger log = LoggerFactory.getLogger(MonitorAgentScheduler.class);

    private final CompiledGraph<MonitorAgentState> graph;

    public MonitorAgentScheduler(CompiledGraph<MonitorAgentState> graph) {
        this.graph = graph;
    }

    @Scheduled(fixedRateString = "${monitor.interval-ms:2000}")
    public void run() {
        try {
            graph.invoke(Map.of(), RunnableConfig.builder().build());
        } catch (Exception e) {
            log.error("Monitor run failed", e);
        }
    }
}
