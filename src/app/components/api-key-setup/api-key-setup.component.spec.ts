import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ApiKeySetupComponent } from './api-key-setup.component';

describe('ApiKeySetupComponent', () => {
  let component: ApiKeySetupComponent;
  let fixture: ComponentFixture<ApiKeySetupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApiKeySetupComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ApiKeySetupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
