import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Project } from '../models/models';

@Injectable({
    providedIn: 'root'
})
export class ProjectContextService {
    private activeProjectSubject = new BehaviorSubject<Project | null>(null);
    activeProject$ = this.activeProjectSubject.asObservable();

    setActiveProject(project: Project | null) {
        this.activeProjectSubject.next(project);
    }

    getActiveProject(): Project | null {
        return this.activeProjectSubject.value;
    }

    getActiveProjectId(): number | null {
        const project = this.activeProjectSubject.value;
        return project ? project.id : null;
    }
}
