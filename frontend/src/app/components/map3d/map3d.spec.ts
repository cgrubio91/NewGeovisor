import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Map3d } from './map3d';

describe('Map3d', () => {
  let component: Map3d;
  let fixture: ComponentFixture<Map3d>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Map3d]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Map3d);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
