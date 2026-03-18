package com.example;

import com.sap.cds.services.handler.EventHandler;
import com.sap.cds.services.handler.annotations.On;
import com.sap.cds.services.handler.annotations.ServiceName;
import cds.gen.taskservice.ChatTaskContext;
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
public class ChatTaskHandler implements EventHandler {

    @Value("${hyperspace.proxy-url}")
    private String proxyUrl;

    @Value("${hyperspace.api-key}")
    private String apiKey;

    @Value("${hyperspace.model}")
    private String model;

    private TaskChat chat;

    // ── LangChain4j structured output ────────────────────────────────────────

    record ChatResult(String response, String action, String taskId, String title, String description) {}

    interface TaskChat {
        @SystemMessage("""
                You are a task board assistant. The user will give you a natural-language command
                and a JSON list of current tasks. Decide what to do and respond with a JSON object
                containing exactly these fields:
                  "response"    - a friendly one-sentence confirmation message
                  "action"      - one of: create, complete, reopen, delete, none
                  "taskId"      - the UUID of the task to act on (for complete/reopen/delete), or null
                  "title"       - the title of the new task (for create), or null
                  "description" - the description of the new task (for create), or null
                Always return valid JSON. Match tasks by title (case-insensitive substring match).
                """)
        @UserMessage("""
                taskList: {{taskList}}
                message: {{message}}
                """)
        ChatResult chat(@V("taskList") String taskList, @V("message") String message);
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
                .maxTokens(400)
                .build();

        chat = AiServices.create(TaskChat.class, llm);
    }

    @On(event = ChatTaskContext.CDS_NAME)
    public void onChatTask(ChatTaskContext ctx) {
        String message  = ctx.getMessage()  != null ? ctx.getMessage()  : "";
        String taskList = ctx.getTaskList() != null ? ctx.getTaskList() : "[]";

        ChatResult result = chat.chat(taskList, message);

        ChatTaskContext.ReturnType ret = ChatTaskContext.ReturnType.create();
        ret.setResponse(result.response());
        ret.setAction(result.action());
        ret.setTaskId(result.taskId());
        ret.setTitle(result.title());
        ret.setDescription(result.description());
        ctx.setResult(ret);
        ctx.setCompleted();
    }
}
