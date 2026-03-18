package com.example.taskapi.service;

import com.example.taskapi.entity.Task;

import java.util.List;
import java.util.Optional;

public interface TaskService {

    List<Task> findAll();
    Optional<Task> findById(Long id);
    List<Task> findByCompleted(boolean completed);
    Task create(Task task);
    Task update(Long id, Task task);
    void delete(Long id);
}
