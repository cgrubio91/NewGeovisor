import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService, DashboardStats } from '../../services/dashboard.service';
import { AuthService } from '../../services/auth.service';
import { finalize } from 'rxjs/operators';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './dashboard.html',
    styleUrl: './dashboard.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
    stats: DashboardStats | null = null;
    isLoading = true;
    processingLayers: any[] = [];
    private pollInterval: any;

    private dashboardService = inject(DashboardService);
    private authService = inject(AuthService);
    private cdr = inject(ChangeDetectorRef);

    get isAdmin(): boolean {
        const role = this.authService.currentUser()?.role?.toLowerCase();
        return role === 'administrador';
    }

    ngOnInit() {
        this.loadStats();
        this.startPolling();
    }

    ngOnDestroy() {
        if (this.pollInterval) clearInterval(this.pollInterval);
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

    startPolling() {
        this.mockPoll(); // First immediate call
        this.pollInterval = setInterval(() => {
            this.mockPoll();
        }, 3000);
    }

    mockPoll() {
        this.dashboardService.getProcessingStatus().subscribe({
            next: (data) => {
                console.log('Processing Layers Update:', data);
                this.processingLayers = data || [];
                this.cdr.detectChanges();
            },
            error: (err) => console.error('Error polling processing status:', err)
        });
    }
}
