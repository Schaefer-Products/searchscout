import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompetitorSelectionComponent } from './competitor-selection.component';

describe('CompetitorSelectionComponent', () => {
  let component: CompetitorSelectionComponent;
  let fixture: ComponentFixture<CompetitorSelectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompetitorSelectionComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(CompetitorSelectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
