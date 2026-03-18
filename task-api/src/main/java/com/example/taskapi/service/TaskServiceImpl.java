package com.example.taskapi.service;

import com.example.taskapi.entity.Task;
import com.example.taskapi.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;

@Service
@Transactional
public class TaskServiceImpl implements TaskService {

    private final TaskRepository taskRepository;

    public TaskServiceImpl(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Task> findAll() {
        return taskRepository.findAll();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Task> findById(Long id) {
        return taskRepository.findById(id);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Task> findByCompleted(boolean completed) {
        return taskRepository.findByCompleted(completed);
    }

    @Override
    public Task create(Task task) {
        return taskRepository.save(task);
    }

    @Override
    public Task update(Long id, Task incoming) {
        Task existing = taskRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Task not found: " + id));
        existing.setTitle(incoming.getTitle());
        existing.setDescription(incoming.getDescription());
        existing.setCompleted(incoming.isCompleted());
        return taskRepository.save(existing);
    }

    @Override
    public void delete(Long id) {
        if (!taskRepository.existsById(id)) {
            throw new NoSuchElementException("Task not found: " + id);
        }
        taskRepository.deleteById(id);
    }
}
