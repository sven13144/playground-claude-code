FROM eclipse-temurin:21-jdk AS build

# Install Node.js for CDS build
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# Copy Maven wrapper and pom files first for layer caching
COPY pom.xml .
COPY srv/pom.xml srv/

# Copy source
COPY srv/src srv/src
COPY srv/task-service.cds srv/task-service.cds
COPY db db
COPY package.json package.json
COPY package-lock.json* package-lock.json

# Install CDS tools and build
RUN npm install
RUN cd srv && mvn clean package -f pom.xml -Dcds.npm.skip=true --no-transfer-progress

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/srv/target/task-cap-srv.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
