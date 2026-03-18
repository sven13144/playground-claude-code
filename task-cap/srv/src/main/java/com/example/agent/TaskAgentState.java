package com.example.agent;

import org.bsc.langgraph4j.state.AgentState;
import org.bsc.langgraph4j.state.Channel;
import org.bsc.langgraph4j.state.Channels;

import java.util.Map;

public class TaskAgentState extends AgentState {

    public static final Map<String, Channel<?>> SCHEMA = Map.of(
        "draft_title", Channels.base(() -> ""),
        "draft_desc",  Channels.base(() -> ""),
        "final_title", Channels.base(() -> ""),
        "final_desc",  Channels.base(() -> "")
    );

    public TaskAgentState(Map<String, Object> data) {
        super(data);
    }
}
