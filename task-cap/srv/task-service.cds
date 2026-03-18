using { com.example as example } from '../db/data-model';

service TaskService @(path: '/api') {
    entity Tasks as projection on example.Tasks;

    action suggestTask() returns {
        title       : String;
        description : String;
    };
}
