import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService, DashboardStats } from '../../services/dashboard.service';
import { finalize } from 'rxjs/operators';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './dashboard.html',
    styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit {
    stats: DashboardStats | null = null;
    isLoading = true;

    private dashboardService = inject(DashboardService);
    private cdr = inject(ChangeDetectorRef);

    ngOnInit() {
        this.loadStats();
    }

    loadStats() {
        this.isLoading = true;
        this.dashboardService.getStats()
            .pipe(finalize(() => {
                this.isLoading = false;
                this.cdr.detectChanges();
            }))
            .subscribe({
                next: (data) => {
                    this.stats = data;
                    this.cdr.detectChanges();
                },
                error: (err) => console.error('Error loading dashboard stats', err)
            });
    }
}
