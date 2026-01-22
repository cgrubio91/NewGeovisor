import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapComponent } from './components/map/map.component';
import { LayerControlComponent } from './components/layer-control/layer-control.component';
import { UploadComponent } from './components/upload/upload.component';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [CommonModule, MapComponent, LayerControlComponent, UploadComponent],
    template: `
    <main>
      <app-map></app-map>
      <app-layer-control></app-layer-control>
      <app-upload></app-upload>
    </main>
  `,
    styles: [`
    main { position: relative; width: 100vw; height: 100vh; overflow: hidden; }
  `]
})
export class AppComponent {
    title = 'GIS Geovisor';
}
