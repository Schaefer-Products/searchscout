import { TestBed } from '@angular/core/testing';

import { DataforseoService } from './dataforseo.service';

describe('DataforseoService', () => {
  let service: DataforseoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DataforseoService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
