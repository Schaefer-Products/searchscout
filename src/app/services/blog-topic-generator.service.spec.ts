import { TestBed } from '@angular/core/testing';

import { BlogTopicGeneratorService } from './blog-topic-generator.service';

describe('BlogTopicGeneratorService', () => {
  let service: BlogTopicGeneratorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BlogTopicGeneratorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
