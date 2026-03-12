import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GeographicRecords } from './geographic-records';

describe('GeographicRecords', () => {
  let component: GeographicRecords;
  let fixture: ComponentFixture<GeographicRecords>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeographicRecords]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GeographicRecords);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
