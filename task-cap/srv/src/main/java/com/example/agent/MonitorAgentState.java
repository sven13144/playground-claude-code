package com.example.agent;

import org.bsc.langgraph4j.state.AgentState;
import org.bsc.langgraph4j.state.Channel;
import org.bsc.langgraph4j.state.Channels;

import java.util.Map;

public class MonitorAgentState extends AgentState {

    public static final Map<String, Channel<?>> SCHEMA = Map.of(
        "task_snapshot", Channels.base(() -> ""),
        "changed",       Channels.base(() -> false)
    );

    public MonitorAgentState(Map<String, Object> data) {
        super(data);
    }
}
