package com.example.taskapi;

import com.example.taskapi.entity.Task;
import com.example.taskapi.repository.TaskRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    private final TaskRepository taskRepository;

    public DataInitializer(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    @Override
    public void run(String... args) {
        taskRepository.save(new Task("Buy groceries", "Milk, eggs, bread, and coffee"));
        taskRepository.save(new Task("Read Spring Boot docs", "Focus on chapters about Data JPA and REST"));
        taskRepository.save(new Task("Write unit tests", "Cover service and controller layers"));

        Task done = new Task("Set up project", "Initialize Spring Boot app with Maven");
        done.setCompleted(true);
        taskRepository.save(done);

        Task done2 = new Task("Configure H2 database", "Enable H2 console and set datasource properties");
        done2.setCompleted(true);
        taskRepository.save(done2);
    }
}
