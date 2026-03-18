package com.example.agent;

import org.bsc.langgraph4j.state.AgentState;
import org.bsc.langgraph4j.state.Channel;
import org.bsc.langgraph4j.state.Channels;

import java.util.Map;

public class CompleterAgentState extends AgentState {

    public static final Map<String, Channel<?>> SCHEMA = Map.of(
        "task_id",    Channels.base(() -> ""),
        "task_title", Channels.base(() -> "")
    );

    public CompleterAgentState(Map<String, Object> data) {
        super(data);
    }
}
