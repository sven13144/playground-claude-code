# SAP CAP Java + React AI Hackathon App — Full Walkthrough

A complete tutorial for building a full-stack task management app with an SAP CAP Java OData backend, React frontend, and LangChain4j AI-powered task suggestion — built as a demo for an AI Hackathon.

---

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [SAP CAP Java Backend](#sap-cap-java-backend)
   - [Prerequisites](#prerequisites)
   - [Root POM](#root-pom)
   - [Package JSON](#package-json)
   - [CDS Data Model](#cds-data-model)
   - [Seed Data](#seed-data)
   - [CDS Service Definition](#cds-service-definition)
   - [H2 Schema SQL](#h2-schema-sql)
   - [Application YAML](#application-yaml)
   - [Application Entry Point](#application-entry-point)
   - [Building and Running](#building-and-running)
   - [API Endpoints](#api-endpoints)
4. [LangChain4j AI Integration](#langchain4j-ai-integration)
   - [Why LangChain4j](#why-langchain4j)
   - [Maven Dependencies](#maven-dependencies)
   - [SAP Maven Mirror Fix](#sap-maven-mirror-fix)
   - [Handler Implementation](#handler-implementation)
   - [Base URL Pattern](#base-url-pattern)
5. [Hyperspace AI Local Proxy](#hyperspace-ai-local-proxy)
   - [Setup](#setup)
   - [Key Facts](#key-facts)
6. [React Frontend](#react-frontend)
   - [Stack](#stack)
   - [Vite Proxy Configuration](#vite-proxy-configuration)
   - [Running the UI](#running-the-ui)
7. [GitHub Setup](#github-setup)
8. [Claude Skills Created](#claude-skills-created)
9. [Gotchas and Lessons Learned](#gotchas-and-lessons-learned)

---

## Overview

This walkthrough documents how to build a full-stack task management application consisting of:

- **Backend**: SAP CAP Java project — OData V4 API, H2 in-memory database, CDS data model, LangChain4j AI integration
- **Frontend**: React + Vite — hackathon-themed UI with framer-motion animations, full CRUD, and AI-powered task suggestion
- **AI**: LangChain4j with Anthropic Claude via the Hyperspace AI local proxy

The app lets you manage tasks (create, complete, delete) and ask an AI to suggest a task title and description based on a free-text prompt.

---

## Project Structure

```
claude-code-playground/
├── task-cap/                         # SAP CAP Java backend
│   ├── pom.xml                       # Root aggregator POM
│   ├── package.json                  # @sap/cds-dk ^7 devDependency
│   ├── settings.xml                  # Maven settings (bypass SAP mirror for LangChain4j)
│   ├── db/
│   │   ├── data-model.cds            # Task entity (cuid + managed aspects)
│   │   └── data/
│   │       └── com.example.Tasks.csv # 5 seed tasks
│   └── srv/
│       ├── pom.xml                   # Module POM with all dependencies
│       ├── task-service.cds          # OData service definition at /api
│       └── src/main/
│           ├── java/com/example/
│           │   ├── Application.java
│           │   └── SuggestTaskHandler.java
│           └── resources/
│               ├── application.yaml
│               └── schema.sql
└── task-ui/                          # React + Vite frontend
    ├── vite.config.js
    ├── package.json
    └── src/
        └── App.jsx
```

---

## SAP CAP Java Backend

### Prerequisites

- Java 21+
- Maven 3.9+
- Node.js 18+ (via nvm recommended)
- `@sap/cds-dk` (installed via `npm install` in the CAP project root)

> **Note:** If using nvm, node binaries will not be in Maven's PATH. Either run `npm install` manually before the Maven build, or pass `-Dcds.npm.skip=true` to Maven and pre-install manually. See [Building and Running](#building-and-running).

### Root POM

The root `pom.xml` is an aggregator (packaging `pom`) that declares the `srv` module and the `cds-maven-plugin` for CDS compilation.

Key plugin configuration in the root POM:

```xml
<plugin>
    <groupId>com.sap.cds</groupId>
    <artifactId>cds-maven-plugin</artifactId>
    <version>2.6.0</version>
    <executions>
        <execution>
            <id>cds.install-node</id>
            <goals><goal>install-node</goal></goals>
        </execution>
        <execution>
            <id>cds.npm</id>
            <goals><goal>npm</goal></goals>
            <configuration>
                <arguments>install</arguments>
            </configuration>
        </execution>
        <execution>
            <id>cds.build</id>
            <goals><goal>cds</goal></goals>
        </execution>
        <execution>
            <id>cds.generate</id>
            <goals><goal>generate</goal></goals>
            <configuration>
                <basePackage>com.example</basePackage>
                <codeOutputDirectory>
                    ${project.basedir}/srv/src/main/java
                </codeOutputDirectory>
            </configuration>
        </execution>
    </executions>
</plugin>
```

Also declare the Maven Central repository explicitly in the root POM so it is available even when the SAP Artifactory mirror is in use:

```xml
<repositories>
    <repository>
        <id>central</id>
        <url>https://repo.maven.apache.org/maven2</url>
    </repository>
</repositories>
```

### Package JSON

The `package.json` at the CAP project root declares `@sap/cds-dk` as a dev dependency. **Version matters:**

```json
{
  "name": "task-cap",
  "version": "1.0.0",
  "devDependencies": {
    "@sap/cds-dk": "^7"
  }
}
```

> **Note:** Use `^7`, NOT `^8`. CAP Java 2.6.0 requires `cds-compiler` version 4, which is shipped with `cds-dk ^7`. Version `^8` ships `cds-compiler` 5, which is incompatible and will cause cryptic build failures.

### CDS Data Model

`db/data-model.cds`:

```cds
namespace com.example;
using { cuid, managed } from '@sap/cds/common';

entity Tasks : cuid, managed {
    title       : String(255) not null;
    description : String(1000);
    completed   : Boolean default false not null;
}
```

- `cuid` adds a UUID `ID` primary key
- `managed` adds `createdAt`, `createdBy`, `modifiedAt`, `modifiedBy` fields automatically

### Seed Data

`db/data/com.example.Tasks.csv` — the filename **must** match the fully-qualified entity name:

```csv
ID,title,description,completed
"a1b2c3d4-0001-0000-0000-000000000001","Build CAP Java backend","Set up OData V4 service with H2 in-memory DB",false
"a1b2c3d4-0002-0000-0000-000000000002","Integrate LangChain4j","Add AI-powered task suggestion via Anthropic Claude",false
"a1b2c3d4-0003-0000-0000-000000000003","Create React UI","Build a fancy hackathon UI with framer-motion",false
"a1b2c3d4-0004-0000-0000-000000000004","Configure Vite proxy","Proxy /odata calls to backend to avoid CORS issues",false
"a1b2c3d4-0005-0000-0000-000000000005","Deploy demo","Push to GitHub and run the demo live",false
```

### CDS Service Definition

`srv/task-service.cds`:

```cds
using { com.example as example } from '../db/data-model';

service TaskService @(path: '/api') {
    entity Tasks as projection on example.Tasks;
    action suggestTask(prompt : String) returns {
        title       : String;
        description : String;
    };
}
```

> **Note:** Use `using { com.example as example } from '../db/data-model'` with an explicit alias. The shorthand `using com.example from` does NOT work in this context and causes a CDS compilation error.

The `suggestTask` action is an unbound OData action that accepts a free-text `prompt` and returns a suggested `title` and `description`.

### H2 Schema SQL

`srv/src/main/resources/schema.sql` — CAP Java does NOT auto-deploy the schema to H2 unless the datasource is detected as an `EmbeddedDatabase`. Since Spring Boot + CAP sometimes misses this detection, provide a manual `schema.sql`.

> **Critical:** H2 stores unquoted identifiers as UPPERCASE. The CAP-generated queries use unquoted names, so your DDL must match UPPERCASE exactly.

```sql
DROP VIEW IF EXISTS TASKSERVICE_TASKS;
DROP TABLE IF EXISTS COM_EXAMPLE_TASKS;

CREATE TABLE COM_EXAMPLE_TASKS (
  ID            NVARCHAR(36)    NOT NULL,
  CREATEDAT     TIMESTAMP(7),
  CREATEDBY     NVARCHAR(255),
  MODIFIEDAT    TIMESTAMP(7),
  MODIFIEDBY    NVARCHAR(255),
  TITLE         NVARCHAR(255)   NOT NULL,
  DESCRIPTION   NVARCHAR(1000),
  COMPLETED     BOOLEAN         NOT NULL DEFAULT FALSE,
  PRIMARY KEY(ID)
);

CREATE VIEW TASKSERVICE_TASKS AS
  SELECT T0.ID, T0.CREATEDAT, T0.CREATEDBY,
         T0.MODIFIEDAT, T0.MODIFIEDBY,
         T0.TITLE, T0.DESCRIPTION, T0.COMPLETED
  FROM COM_EXAMPLE_TASKS AS T0;
```

### Application YAML

`srv/src/main/resources/application.yaml`:

```yaml
spring:
  datasource:
    url: jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1
    driver-class-name: org.h2.Driver
  sql:
    init:
      mode: always          # Forces schema.sql execution on startup
  h2:
    console:
      enabled: true         # Available at /h2-console

cds:
  data-source:
    auto-config:
      enabled: false        # Disable CAP auto-config; we control the schema

ai:
  proxy-url: ${AI_PROXY_URL:http://localhost:6655/anthropic/v1/messages}
  api-key: ${AI_API_KEY:}
  model: ${AI_MODEL:claude-3-5-sonnet-20241022}

server:
  port: 8080
```

> **Note:** `spring.sql.init.mode: always` is required. Without it, Spring Boot will not run `schema.sql` against H2 unless it detects an embedded datasource — which CAP's datasource setup can prevent.

### Application Entry Point

`srv/src/main/java/com/example/Application.java`:

```java
package com.example;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
```

### Building and Running

```bash
# One-time: install Node deps (required before Maven build)
export PATH="$HOME/.nvm/versions/node/v22.11.0/bin:$PATH"
cd task-cap
npm install

# Build (skip npm step since we ran it manually)
mvn clean install -Dcds.npm.skip=true

# Run
cd srv
java -jar target/task-cap-srv.jar
```

To pass AI configuration at runtime:

```bash
java -jar target/task-cap-srv.jar \
  --ai.proxy-url=http://localhost:6655/anthropic/v1/messages \
  --ai.api-key=YOUR_KEY_HERE
```

### API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | `http://localhost:8080/odata/v4/api/Tasks` | List all tasks |
| GET | `http://localhost:8080/odata/v4/api/Tasks?$filter=completed eq false` | List pending tasks |
| POST | `http://localhost:8080/odata/v4/api/Tasks` | Create a task |
| PATCH | `http://localhost:8080/odata/v4/api/Tasks('{id}')` | Update a task |
| DELETE | `http://localhost:8080/odata/v4/api/Tasks('{id}')` | Delete a task |
| POST | `http://localhost:8080/odata/v4/api/suggestTask` | AI task suggestion |
| GET | `http://localhost:8080/odata/v4/api/$metadata` | OData metadata |
| GET | `http://localhost:8080/h2-console` | H2 database console |

Example `suggestTask` request body:

```json
{ "prompt": "something related to machine learning" }
```

---

## LangChain4j AI Integration

### Why LangChain4j

The initial implementation used a raw `HttpClient` to call the Anthropic API and parsed the JSON response manually with string operations. LangChain4j replaces all of that with:

- **Structured output**: The AI response maps directly to a Java record — no JSON parsing code
- **Prompt templates**: `@SystemMessage` and `@UserMessage` annotations on an interface
- **Cleaner abstractions**: No manual HTTP client management or response deserialization

### Maven Dependencies

Add to `srv/pom.xml`. **Pin versions explicitly** — do not rely on a BOM, as the SAP Artifactory mirror can interfere with BOM resolution.

```xml
<dependency>
    <groupId>dev.langchain4j</groupId>
    <artifactId>langchain4j</artifactId>
    <version>0.36.2</version>
</dependency>
<dependency>
    <groupId>dev.langchain4j</groupId>
    <artifactId>langchain4j-anthropic</artifactId>
    <version>0.36.2</version>
</dependency>
```

Also ensure the standard Spring Boot starters are present — they are NOT pulled in transitively by the CAP framework starter:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jdbc</artifactId>
</dependency>
```

### SAP Maven Mirror Fix

On SAP corporate networks, `~/.m2/settings.xml` typically contains a mirror with `<mirrorOf>*</mirrorOf>` pointing to `int.repositories.cloud.sap`. This can block resolution of LangChain4j artifacts.

**Fix**: Add a `settings.xml` to the project root that excludes the LangChain4j group from the corporate mirror:

```xml
<settings>
  <mirrors>
    <mirror>
      <id>sap-artifactory</id>
      <mirrorOf>*,!dev.langchain4j</mirrorOf>
      <url>https://int.repositories.cloud.sap/artifactory/build-releases</url>
    </mirror>
  </mirrors>
</settings>
```

Pass it to Maven: `mvn clean install -s settings.xml -Dcds.npm.skip=true`

> **Note:** On SAP networks the Artifactory instance does proxy Maven Central, so LangChain4j may resolve fine without the exclusion. If you see `Could not resolve artifact dev.langchain4j:...` errors, add the exclusion as shown above.

### Handler Implementation

`srv/src/main/java/com/example/SuggestTaskHandler.java`:

```java
package com.example;

import com.sap.cds.services.handler.EventHandler;
import com.sap.cds.services.handler.annotations.On;
import com.sap.cds.services.handler.annotations.ServiceName;
import dev.langchain4j.model.anthropic.AnthropicChatModel;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.service.AiServices;
import dev.langchain4j.service.SystemMessage;
import dev.langchain4j.service.UserMessage;
import dev.langchain4j.service.V;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import cds.gen.taskservice.SuggestTaskContext;
import cds.gen.taskservice.TaskService_;

@Component
@ServiceName(TaskService_.CDS_NAME)
public class SuggestTaskHandler implements EventHandler {

    @Value("${ai.proxy-url}")
    private String proxyUrl;

    @Value("${ai.api-key}")
    private String apiKey;

    @Value("${ai.model}")
    private String model;

    private TaskSuggester suggester;

    record TaskSuggestion(String title, String description) {}

    interface TaskSuggester {
        @SystemMessage("You are a creative productivity assistant. Generate a concise, actionable task.")
        @UserMessage("Generate a task suggestion. User context: {{userPrompt}}. " +
                     "Return a JSON object with 'title' (max 60 chars) and 'description' (max 200 chars).")
        TaskSuggestion suggest(@V("userPrompt") String userPrompt);
    }

    @PostConstruct
    void init() {
        // LangChain4j Anthropic client appends "/messages" to the base URL.
        // If the proxy URL already ends with "/messages", strip it to get the base.
        String baseUrl = proxyUrl.endsWith("/messages")
                ? proxyUrl.replace("/messages", "/")
                : (proxyUrl.endsWith("/") ? proxyUrl : proxyUrl + "/");

        ChatLanguageModel llm = AnthropicChatModel.builder()
                .baseUrl(baseUrl)
                .apiKey(apiKey)
                .modelName(model)
                .maxTokens(300)
                .build();

        suggester = AiServices.create(TaskSuggester.class, llm);
    }

    @On(event = "suggestTask")
    public void onSuggestTask(SuggestTaskContext ctx) {
        String prompt = ctx.getPrompt() != null ? ctx.getPrompt() : "a general productivity task";
        TaskSuggestion suggestion = suggester.suggest(prompt);

        var result = cds.gen.taskservice.SuggestTaskContext.Result.create();
        result.setTitle(suggestion.title());
        result.setDescription(suggestion.description());
        ctx.setResult(result);
        ctx.setCompleted();
    }
}
```

### Base URL Pattern

The LangChain4j Anthropic client internally uses Retrofit with `@POST("messages")`, which appends `/messages` to the base URL you provide.

| What you have | What to pass as `baseUrl` |
|---|---|
| `http://localhost:6655/anthropic/v1/messages` | `http://localhost:6655/anthropic/v1/` |
| `http://localhost:6655/anthropic/v1/` | `http://localhost:6655/anthropic/v1/` |

The handler code above handles both cases automatically.

> **Note:** When using the raw `HttpClient` (pre-LangChain4j approach), you must force HTTP/1.1 explicitly. Some corporate proxies reject HTTP/2 connections. Use `HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).build()`. LangChain4j handles this internally via OkHttp, so this is no longer a concern when using LangChain4j.

> **Note:** Mustache template conditionals (`{{#if varName}}`) are NOT supported in LangChain4j `@UserMessage`. Use plain `{{varName}}` and supply a default string in your Java code instead.

---

## Hyperspace AI Local Proxy

The Hyperspace AI proxy (`hai`) is an SAP-internal tool that proxies Anthropic API calls, handling corporate authentication transparently.

### Setup

```bash
# Install (requires SAP GitHub access)
brew tap hAIperspace/hai https://github.tools.sap/hAIperspace/hai-homebrew
brew install hai

# Start the proxy
hai proxy start
```

### Key Facts

| Property | Value |
|---|---|
| Proxy base URL | `http://localhost:6655` |
| Anthropic messages path | `/anthropic/v1/messages` |
| API key format | UUID (obtain via `hai` CLI or SAP AI Launchpad) |
| HTTP version | Must use HTTP/1.1 (proxy rejects HTTP/2) |

> **Note:** The correct path is `/anthropic/v1/messages`, NOT `/v1/messages`. Using the wrong path returns a 404 or empty response.

> **Note on CORS:** Browsers cannot call the `hai` proxy directly due to CORS restrictions. Always route AI calls through the backend, or configure a Vite proxy that forwards to the backend. Do not attempt to call `http://localhost:6655` directly from React.

---

## React Frontend

### Stack

- **Vite 5** + **React 18** — fast development server with HMR
- **framer-motion** — spring animations for task cards, stats row, and modal
- **lucide-react** — icon set
- Inline style objects (CSS-in-JS) — no separate stylesheet needed for hackathon speed

#### Theme

Dark hackathon aesthetic: violet / cyan / magenta / green glow palette with an animated background grid and blob glows, task cards with hover lift effects, and a glowing stats bar.

#### Features

- Stats row showing total / pending / done counts with spring animations
- Filter buttons: ALL / PENDING / DONE
- Task cards with one-click complete toggle and delete
- New Task modal with:
  - Title and Description input fields
  - AI Prompt Hint text field
  - SUGGEST button — calls `POST /odata/v4/api/suggestTask` → populates title + description automatically
  - Spinner animation while the AI call is in-flight
- Toast notifications for success/error feedback

### Vite Proxy Configuration

`task-ui/vite.config.js` — proxies all `/odata` requests to the CAP Java backend, avoiding CORS issues during development:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/odata': 'http://localhost:8080',
    },
  },
})
```

With this in place, the React app calls `/odata/v4/api/Tasks` (relative URL), and Vite forwards it to `http://localhost:8080/odata/v4/api/Tasks` — no CORS headers needed on the backend.

### Running the UI

```bash
cd task-ui
npm install
npm run dev
# → http://localhost:5173
```

The backend must be running on port 8080 before starting the UI.

---

## GitHub Setup

```bash
# Generate a new SSH key for GitHub
ssh-keygen -t ed25519 -C "your-email@example.com"

# Copy the public key and add it at https://github.com/settings/ssh/new
cat ~/.ssh/id_ed25519.pub

# Add remote and push
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

---

## Claude Skills Created

Two reusable Claude Code skills were created and stored in `~/.claude/plugins/`:

### `sap-cap-java`

Location: `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/sap-cap-java/`

Covers:
- Full CAP Java project scaffold guide (POM structure, CDS model, service, schema.sql)
- LangChain4j integration pattern
- All known gotchas (cds-dk version, H2 uppercase DDL, npm PATH, etc.)
- Build commands and endpoint reference

### `hyperspace-ai-proxy` (hai)

Covers:
- Hyperspace proxy installation and startup
- Correct endpoint path (`/anthropic/v1/messages`)
- HTTP/1.1 requirement
- CORS limitation and Vite proxy workaround
- LangChain4j base URL derivation pattern

To use a skill in a Claude Code session:

```
/sap-cap-java
```

---

## Gotchas and Lessons Learned

A consolidated reference of every non-obvious issue encountered during this build.

### CDS / Build

| # | Issue | Fix |
|---|---|---|
| 1 | `@sap/cds-dk ^8` fails with CAP Java 2.6.0 | Use `^7` — CAP Java 2.6.0 requires cds-compiler 4 |
| 2 | `using com.example from` fails | Use `using { com.example as example } from` — alias required |
| 3 | Maven can't find `npm` | nvm binaries not in Maven PATH; run `npm install` manually and build with `-Dcds.npm.skip=true` |
| 4 | `cds-maven-plugin` npm goal | Use `<arguments>install</arguments>`, not `<argument>install</argument>` |
| 5 | `cds-maven-plugin` generate goal | Use `<codeOutputDirectory>` for the generated Java output path |

### H2 Database

| # | Issue | Fix |
|---|---|---|
| 6 | Schema not created on startup | CAP Java does not auto-deploy to H2; provide `schema.sql` and set `spring.sql.init.mode: always` |
| 7 | `Table "COM_EXAMPLE_TASKS" not found` | H2 stores unquoted identifiers as UPPERCASE; DDL must use UPPERCASE names |
| 8 | CAP queries fail against H2 | Create a VIEW named `TASKSERVICE_TASKS` matching what the generated CDS queries expect |

### Spring Boot / Dependencies

| # | Issue | Fix |
|---|---|---|
| 9 | `spring-boot-starter-web` missing | Not pulled transitively by `cds-framework-spring-boot`; add explicitly |
| 10 | `spring-boot-starter-jdbc` missing | Same — add explicitly |

### LangChain4j / AI

| # | Issue | Fix |
|---|---|---|
| 11 | LangChain4j not resolving via SAP Artifactory | Add `settings.xml` with `<mirrorOf>*,!dev.langchain4j</mirrorOf>` exclusion |
| 12 | Proxy returns 404 on AI calls | Base URL must NOT include `/messages`; LangChain4j appends it automatically |
| 13 | Proxy rejects HTTP/2 (raw HttpClient approach) | Use `HttpClient.newBuilder().version(Version.HTTP_1_1).build()` |
| 14 | `{{#if varName}}` in `@UserMessage` ignored | LangChain4j does not support Mustache conditionals; use plain `{{varName}}` |
| 15 | CDS action handler not called | Must use `ctx.setResult(result)` AND `ctx.setCompleted()` — both required |

### CORS / Networking

| # | Issue | Fix |
|---|---|---|
| 16 | Browser cannot call `hai` proxy directly | CORS blocked; route calls through backend handler or Vite proxy |
| 17 | Wrong `hai` proxy path | Use `/anthropic/v1/messages`, NOT `/v1/messages` |
