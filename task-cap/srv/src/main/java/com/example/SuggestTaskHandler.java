package com.example;

import com.sap.cds.services.handler.EventHandler;
import com.sap.cds.services.handler.annotations.On;
import com.sap.cds.services.handler.annotations.ServiceName;
import cds.gen.taskservice.SuggestTaskContext;
import cds.gen.taskservice.TaskService_;

import dev.langchain4j.model.anthropic.AnthropicChatModel;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.service.AiServices;
import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.UserMessage;
import dev.langchain4j.service.V;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@ServiceName(TaskService_.CDS_NAME)
public class SuggestTaskHandler implements EventHandler {

    @Value("${hyperspace.proxy-url}")
    private String proxyUrl;

    @Value("${hyperspace.api-key}")
    private String apiKey;

    @Value("${hyperspace.model}")
    private String model;

    private TaskSuggester suggester;

    // ── LangChain4j structured output ────────────────────────────────────────

    record TaskSuggestion(String title, String description) {}

    interface TaskSuggester {
        @SystemMessage("""
                You generate creative, quirky tasks for an AI hackathon task board.
                Always respond with a title (max 8 words, no emoji) and a description
                that is a fun ASCII art scene (max 10 lines) using box-drawing chars,
                symbols and emoji — keep each line under 22 characters.
                """)
        @UserMessage("""
                Generate a single task suggestion.
                Extra context (may be empty): {{userPrompt}}
                """)
        TaskSuggestion suggest(@V("userPrompt") String userPrompt);
    }

    @PostConstruct
    void init() {
        // LangChain4j Anthropic uses Retrofit @POST("messages") — base URL must end with /v1/
        // Proxy path: http://localhost:6655/anthropic/v1/messages
        String baseUrl = proxyUrl.replace("/messages", "/");

        ChatLanguageModel llm = AnthropicChatModel.builder()
                .baseUrl(baseUrl)
                .apiKey(apiKey)
                .modelName(model)
                .maxTokens(300)
                .build();

        suggester = AiServices.create(TaskSuggester.class, llm);
    }

    @On(event = SuggestTaskContext.CDS_NAME)
    public void onSuggestTask(SuggestTaskContext ctx) {
        String userPrompt = ctx.getPrompt() != null ? ctx.getPrompt() : "";

        TaskSuggestion suggestion = suggester.suggest(userPrompt);

        SuggestTaskContext.ReturnType result = SuggestTaskContext.ReturnType.create();
        result.setTitle(suggestion.title());
        result.setDescription(suggestion.description());
        ctx.setResult(result);
        ctx.setCompleted();
    }
}
