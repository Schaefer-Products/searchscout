import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { CompetitorSelectionComponent } from './competitor-selection.component';
import { DataforseoService } from '../../services/dataforseo.service';
import { Competitor } from '../../models/competitor.model';

// ─── Fixture helpers ─────────────────────────────────────────────────────────

function makeCompetitor(domain: string, overrides: Partial<Competitor> = {}): Competitor {
  return { domain, keywordOverlap: 100, totalKeywords: 500, isManual: false, ...overrides };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CompetitorSelectionComponent', () => {
  let component: CompetitorSelectionComponent;
  let fixture: ComponentFixture<CompetitorSelectionComponent>;
  let dataforseoSpy: jasmine.SpyObj<DataforseoService>;

  beforeEach(async () => {
    dataforseoSpy = jasmine.createSpyObj('DataforseoService', [
      'discoverCompetitors', 'getCompetitorsCacheMetadata', 'clearCompetitorsCache',
    ]);

    dataforseoSpy.discoverCompetitors.and.returnValue(of([]));
    dataforseoSpy.getCompetitorsCacheMetadata.and.returnValue(null);

    await TestBed.configureTestingModule({
      imports: [CompetitorSelectionComponent],
      providers: [{ provide: DataforseoService, useValue: dataforseoSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(CompetitorSelectionComponent);
    component = fixture.componentInstance;
    // detectChanges() deferred so each group can set inputs before ngOnInit fires
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------------------

  describe('initial state', () => {
    it('should default userDomain to empty string', () => {
      expect(component.userDomain).toBe('');
    });

    it('should default preSelectedCompetitors to empty array', () => {
      expect(component.preSelectedCompetitors).toEqual([]);
    });

    it('should not be discovering', () => {
      expect(component.isDiscovering).toBeFalse();
    });

    it('should not have discovery complete', () => {
      expect(component.discoveryComplete).toBeFalse();
    });

    it('should have no competitors loaded', () => {
      expect(component.allCompetitors).toEqual([]);
    });

    it('should have no error message', () => {
      expect(component.errorMessage).toBe('');
    });

    it('should have no manual domain input', () => {
      expect(component.manualDomain).toBe('');
    });

    it('should have selectedCount of 0', () => {
      expect(component.selectedCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // ngOnInit
  // ---------------------------------------------------------------------------

  describe('ngOnInit()', () => {
    it('should not call discoverCompetitors when preSelectedCompetitors is empty', () => {
      component.userDomain = 'mysite.com';
      component.preSelectedCompetitors = [];
      spyOn(component, 'discoverCompetitors');
      component.ngOnInit();
      expect(component.discoverCompetitors).not.toHaveBeenCalled();
    });

    it('should pre-select provided competitors and trigger discovery', () => {
      const preSelected = [makeCompetitor('pre.com')];
      component.userDomain = 'mysite.com';
      component.preSelectedCompetitors = preSelected;
      dataforseoSpy.discoverCompetitors.and.returnValue(of(preSelected));
      spyOn(component, 'discoverCompetitors').and.callThrough();
      component.ngOnInit();
      expect(component.isSelected('pre.com')).toBeTrue();
      expect(component.discoverCompetitors).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // discoverCompetitors()
  // ---------------------------------------------------------------------------

  describe('discoverCompetitors()', () => {
    it('should set errorMessage and return early when userDomain is empty', () => {
      component.userDomain = '';
      component.discoverCompetitors();
      expect(component.errorMessage).toBe('No domain provided');
      expect(dataforseoSpy.discoverCompetitors).not.toHaveBeenCalled();
    });

    it('should set isDiscovering to true while the observable is pending', () => {
      const pending$ = new Subject<Competitor[]>();
      dataforseoSpy.discoverCompetitors.and.returnValue(pending$.asObservable());
      component.userDomain = 'mysite.com';
      component.discoverCompetitors();
      expect(component.isDiscovering).toBeTrue();
    });

    it('should call the service with userDomain', () => {
      component.userDomain = 'mysite.com';
      component.discoverCompetitors();
      expect(dataforseoSpy.discoverCompetitors).toHaveBeenCalledWith('mysite.com');
    });

    describe('on success', () => {
      const discovered = [
        makeCompetitor('comp-a.com'),
        makeCompetitor('comp-b.com'),
        makeCompetitor('comp-c.com'),
        makeCompetitor('comp-d.com'),
        makeCompetitor('comp-e.com'),
        makeCompetitor('comp-f.com'),
      ];

      beforeEach(() => {
        component.userDomain = 'mysite.com';
        dataforseoSpy.discoverCompetitors.and.returnValue(of(discovered));
      });

      it('should set discoveryComplete to true', () => {
        component.discoverCompetitors();
        expect(component.discoveryComplete).toBeTrue();
      });

      it('should set isDiscovering to false', () => {
        component.discoverCompetitors();
        expect(component.isDiscovering).toBeFalse();
      });

      it('should populate allCompetitors', () => {
        component.discoverCompetitors();
        expect(component.allCompetitors.length).toBe(discovered.length);
      });

      it('should populate displayedCompetitors up to displayLimit', () => {
        component.discoverCompetitors();
        expect(component.displayedCompetitors.length).toBe(Math.min(discovered.length, component.displayLimit));
      });

      it('should auto-select the top 5 when there are no pre-selected competitors', () => {
        component.preSelectedCompetitors = [];
        component.discoverCompetitors();
        expect(component.selectedCount).toBe(5);
        expect(component.isSelected('comp-a.com')).toBeTrue();
        expect(component.isSelected('comp-e.com')).toBeTrue();
        expect(component.isSelected('comp-f.com')).toBeFalse();
      });

      it('should not auto-select when pre-selected competitors exist', () => {
        component.preSelectedCompetitors = [makeCompetitor('comp-a.com')];
        component.selectedCompetitors.add('comp-a.com');
        component.discoverCompetitors();
        // Only the pre-selected one should be selected
        expect(component.isSelected('comp-a.com')).toBeTrue();
        expect(component.isSelected('comp-b.com')).toBeFalse();
      });

      it('should fetch and store cache metadata', () => {
        const meta = { timestamp: Date.now(), ageInDays: 1 };
        dataforseoSpy.getCompetitorsCacheMetadata.and.returnValue(meta);
        component.discoverCompetitors();
        expect(component.cacheMetadata).toEqual(meta);
      });

      it('should set errorMessage when no competitors are found', () => {
        dataforseoSpy.discoverCompetitors.and.returnValue(of([]));
        component.discoverCompetitors();
        expect(component.errorMessage).toBe('No competitors found. Try adding competitors manually.');
      });

      it('should clear errorMessage when competitors are found', () => {
        component.errorMessage = 'Previous error';
        component.discoverCompetitors();
        expect(component.errorMessage).toBe('');
      });

      it('should put pre-selected competitors before newly discovered ones', () => {
        const preComp = makeCompetitor('comp-b.com');
        component.preSelectedCompetitors = [preComp];
        component.selectedCompetitors.add('comp-b.com');
        component.discoverCompetitors();
        expect(component.allCompetitors[0].domain).toBe('comp-b.com');
      });

      it('should include manually pre-selected competitors not in discovery results', () => {
        const manualPre = makeCompetitor('manual-only.com', { isManual: true });
        component.preSelectedCompetitors = [manualPre];
        component.selectedCompetitors.add('manual-only.com');
        dataforseoSpy.discoverCompetitors.and.returnValue(of([makeCompetitor('comp-a.com')]));
        component.discoverCompetitors();
        const domains = component.allCompetitors.map(c => c.domain);
        expect(domains).toContain('manual-only.com');
        expect(domains).toContain('comp-a.com');
      });
    });

    describe('on error', () => {
      beforeEach(() => {
        component.userDomain = 'mysite.com';
      });

      it('should set isDiscovering to false', () => {
        dataforseoSpy.discoverCompetitors.and.returnValue(throwError(() => ({ error: 'API error' })));
        component.discoverCompetitors();
        expect(component.isDiscovering).toBeFalse();
      });

      it('should display error.error when present', () => {
        dataforseoSpy.discoverCompetitors.and.returnValue(throwError(() => ({ error: 'API error' })));
        component.discoverCompetitors();
        expect(component.errorMessage).toBe('API error');
      });

      it('should display generic message when error has no error property', () => {
        dataforseoSpy.discoverCompetitors.and.returnValue(throwError(() => ({})));
        component.discoverCompetitors();
        expect(component.errorMessage).toBe('Failed to discover competitors');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // refreshCompetitors()
  // ---------------------------------------------------------------------------

  describe('refreshCompetitors()', () => {
    beforeEach(() => {
      component.userDomain = 'mysite.com';
      component.allCompetitors = [makeCompetitor('comp-a.com')];
      component.displayedCompetitors = [makeCompetitor('comp-a.com')];
      component.discoveryComplete = true;
      component.cacheMetadata = { timestamp: Date.now(), ageInDays: 2 };
      component.selectedCompetitors.add('comp-a.com');
    });

    it('should do nothing when userDomain is empty', () => {
      component.userDomain = '';
      component.refreshCompetitors();
      expect(dataforseoSpy.clearCompetitorsCache).not.toHaveBeenCalled();
    });

    it('should clear the competitors cache', () => {
      component.refreshCompetitors();
      expect(dataforseoSpy.clearCompetitorsCache).toHaveBeenCalledWith('mysite.com');
    });

    it('should reset cacheMetadata to null', () => {
      component.refreshCompetitors();
      expect(component.cacheMetadata).toBeNull();
    });

    it('should reset discoveryComplete to false', () => {
      spyOn(component, 'discoverCompetitors');
      component.refreshCompetitors();
      expect(component.discoveryComplete).toBeFalse();
    });

    it('should reset allCompetitors and displayedCompetitors to empty arrays', () => {
      spyOn(component, 'discoverCompetitors');
      component.refreshCompetitors();
      expect(component.allCompetitors).toEqual([]);
      expect(component.displayedCompetitors).toEqual([]);
    });

    it('should preserve the current selection', () => {
      component.refreshCompetitors();
      expect(component.isSelected('comp-a.com')).toBeTrue();
    });

    it('should trigger discoverCompetitors', () => {
      spyOn(component, 'discoverCompetitors');
      component.refreshCompetitors();
      expect(component.discoverCompetitors).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // loadMore()
  // ---------------------------------------------------------------------------

  describe('loadMore()', () => {
    it('should extend displayedCompetitors by 20', () => {
      component.allCompetitors = Array.from({ length: 50 }, (_, i) => makeCompetitor(`comp${i}.com`));
      component.displayedCompetitors = component.allCompetitors.slice(0, 20);
      component.loadMore();
      expect(component.displayedCompetitors.length).toBe(40);
    });

    it('should not exceed the total competitors length', () => {
      component.allCompetitors = Array.from({ length: 25 }, (_, i) => makeCompetitor(`comp${i}.com`));
      component.displayedCompetitors = component.allCompetitors.slice(0, 20);
      component.loadMore();
      expect(component.displayedCompetitors.length).toBe(25);
    });
  });

  // ---------------------------------------------------------------------------
  // hasMoreCompetitors / remainingCount
  // ---------------------------------------------------------------------------

  describe('hasMoreCompetitors', () => {
    it('should return true when there are more competitors than displayed', () => {
      component.allCompetitors = Array.from({ length: 30 }, (_, i) => makeCompetitor(`comp${i}.com`));
      component.displayedCompetitors = component.allCompetitors.slice(0, 20);
      expect(component.hasMoreCompetitors).toBeTrue();
    });

    it('should return false when all competitors are displayed', () => {
      const comps = [makeCompetitor('a.com'), makeCompetitor('b.com')];
      component.allCompetitors = comps;
      component.displayedCompetitors = comps;
      expect(component.hasMoreCompetitors).toBeFalse();
    });
  });

  describe('remainingCount', () => {
    it('should return the difference between total and displayed', () => {
      component.allCompetitors = Array.from({ length: 30 }, (_, i) => makeCompetitor(`comp${i}.com`));
      component.displayedCompetitors = component.allCompetitors.slice(0, 20);
      expect(component.remainingCount).toBe(10);
    });
  });

  // ---------------------------------------------------------------------------
  // toggleCompetitor() / isSelected()
  // ---------------------------------------------------------------------------

  describe('toggleCompetitor()', () => {
    it('should add a domain to the selection', () => {
      component.toggleCompetitor('new.com');
      expect(component.isSelected('new.com')).toBeTrue();
    });

    it('should remove a domain that is already selected', () => {
      component.selectedCompetitors.add('existing.com');
      component.toggleCompetitor('existing.com');
      expect(component.isSelected('existing.com')).toBeFalse();
    });
  });

  describe('isSelected()', () => {
    it('should return true for a selected domain', () => {
      component.selectedCompetitors.add('chosen.com');
      expect(component.isSelected('chosen.com')).toBeTrue();
    });

    it('should return false for a domain that is not selected', () => {
      expect(component.isSelected('not-chosen.com')).toBeFalse();
    });
  });

  // ---------------------------------------------------------------------------
  // addManualCompetitor()
  // ---------------------------------------------------------------------------

  describe('addManualCompetitor()', () => {
    it('should set manualError and return early when input is empty', () => {
      component.manualDomain = '';
      component.addManualCompetitor();
      expect(component.manualError).toBe('Please enter a domain');
      expect(component.allCompetitors.length).toBe(0);
    });

    it('should set manualError when domain format is invalid', () => {
      component.manualDomain = 'not a domain!!';
      component.addManualCompetitor();
      expect(component.manualError).toBe('Invalid domain format');
    });

    it('should set manualError when the competitor is already in the list', () => {
      component.allCompetitors = [makeCompetitor('already.com')];
      component.manualDomain = 'already.com';
      component.addManualCompetitor();
      expect(component.manualError).toBe('This competitor is already in the list');
    });

    it('should strip http:// prefix from the domain', () => {
      component.manualDomain = 'http://example.com';
      component.addManualCompetitor();
      expect(component.allCompetitors[0].domain).toBe('example.com');
    });

    it('should strip https:// prefix from the domain', () => {
      component.manualDomain = 'https://example.com';
      component.addManualCompetitor();
      expect(component.allCompetitors[0].domain).toBe('example.com');
    });

    it('should strip www. prefix from the domain', () => {
      component.manualDomain = 'www.example.com';
      component.addManualCompetitor();
      expect(component.allCompetitors[0].domain).toBe('example.com');
    });

    it('should strip trailing path from the domain', () => {
      component.manualDomain = 'example.com/some/path';
      component.addManualCompetitor();
      expect(component.allCompetitors[0].domain).toBe('example.com');
    });

    it('should add a valid domain to allCompetitors and displayedCompetitors', () => {
      component.manualDomain = 'newcompetitor.com';
      component.addManualCompetitor();
      expect(component.allCompetitors.length).toBe(1);
      expect(component.displayedCompetitors.length).toBe(1);
      expect(component.allCompetitors[0].domain).toBe('newcompetitor.com');
    });

    it('should mark the added competitor as manual', () => {
      component.manualDomain = 'newcompetitor.com';
      component.addManualCompetitor();
      expect(component.allCompetitors[0].isManual).toBeTrue();
    });

    it('should auto-select the added competitor', () => {
      component.manualDomain = 'newcompetitor.com';
      component.addManualCompetitor();
      expect(component.isSelected('newcompetitor.com')).toBeTrue();
    });

    it('should clear manualDomain after a successful add', () => {
      component.manualDomain = 'newcompetitor.com';
      component.addManualCompetitor();
      expect(component.manualDomain).toBe('');
    });

    it('should clear manualError before attempting to add', () => {
      component.manualError = 'Previous error';
      component.manualDomain = 'newcompetitor.com';
      component.addManualCompetitor();
      expect(component.manualError).toBe('');
    });
  });

  // ---------------------------------------------------------------------------
  // removeCompetitor()
  // ---------------------------------------------------------------------------

  describe('removeCompetitor()', () => {
    beforeEach(() => {
      component.allCompetitors = [makeCompetitor('keep.com'), makeCompetitor('remove.com')];
      component.displayedCompetitors = [...component.allCompetitors];
      component.selectedCompetitors.add('remove.com');
    });

    it('should remove the competitor from allCompetitors', () => {
      component.removeCompetitor('remove.com');
      expect(component.allCompetitors.map(c => c.domain)).not.toContain('remove.com');
    });

    it('should remove the competitor from displayedCompetitors', () => {
      component.removeCompetitor('remove.com');
      expect(component.displayedCompetitors.map(c => c.domain)).not.toContain('remove.com');
    });

    it('should deselect the removed competitor', () => {
      component.removeCompetitor('remove.com');
      expect(component.isSelected('remove.com')).toBeFalse();
    });

    it('should leave other competitors untouched', () => {
      component.removeCompetitor('remove.com');
      expect(component.allCompetitors[0].domain).toBe('keep.com');
    });
  });

  // ---------------------------------------------------------------------------
  // confirmSelection()
  // ---------------------------------------------------------------------------

  describe('confirmSelection()', () => {
    it('should emit only the selected competitors', () => {
      component.allCompetitors = [makeCompetitor('a.com'), makeCompetitor('b.com'), makeCompetitor('c.com')];
      component.selectedCompetitors.add('a.com');
      component.selectedCompetitors.add('c.com');

      let emitted: Competitor[] | undefined;
      component.competitorsSelected.subscribe(val => (emitted = val));

      component.confirmSelection();

      expect(emitted).toBeDefined();
      expect(emitted!.map(c => c.domain)).toEqual(['a.com', 'c.com']);
    });

    it('should emit an empty array when nothing is selected', () => {
      component.allCompetitors = [makeCompetitor('a.com')];

      let emitted: Competitor[] | undefined;
      component.competitorsSelected.subscribe(val => (emitted = val));

      component.confirmSelection();

      expect(emitted).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // selectedCount / totalCompetitorsCount
  // ---------------------------------------------------------------------------

  describe('selectedCount', () => {
    it('should reflect the number of selected competitors', () => {
      component.selectedCompetitors.add('a.com');
      component.selectedCompetitors.add('b.com');
      expect(component.selectedCount).toBe(2);
    });
  });

  describe('totalCompetitorsCount', () => {
    it('should reflect the length of allCompetitors', () => {
      component.allCompetitors = [makeCompetitor('a.com'), makeCompetitor('b.com')];
      expect(component.totalCompetitorsCount).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Template / DOM
  // ---------------------------------------------------------------------------

  describe('template', () => {
    // Prevent ngOnInit from triggering discovery side-effects
    beforeEach(() => {
      spyOn(component, 'discoverCompetitors');
    });

    it('should render the section heading', () => {
      fixture.detectChanges();
      const h3 = fixture.nativeElement.querySelector('h3') as HTMLElement;
      expect(h3.textContent).toContain('Find Your Competitors');
    });

    it('should show the discover button before discovery is complete', () => {
      component.discoveryComplete = false;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.btn-discover')).not.toBeNull();
    });

    it('should hide the discover button after discovery is complete', () => {
      component.discoveryComplete = true;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.btn-discover')).toBeNull();
    });

    it('should disable the discover button while discovering', () => {
      component.isDiscovering = true;
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.btn-discover') as HTMLButtonElement;
      expect(btn.disabled).toBeTrue();
    });

    it('should call discoverCompetitors when the discover button is clicked', () => {
      component.discoveryComplete = false;
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.btn-discover') as HTMLButtonElement).click();
      expect(component.discoverCompetitors).toHaveBeenCalled();
    });

    it('should show error message when errorMessage is set and not discovering', () => {
      component.errorMessage = 'Something went wrong';
      component.isDiscovering = false;
      fixture.detectChanges();
      const el = fixture.nativeElement.querySelector('.error-message') as HTMLElement;
      expect(el).not.toBeNull();
      expect(el.textContent).toContain('Something went wrong');
    });

    it('should hide error message while discovering', () => {
      component.errorMessage = 'Something went wrong';
      component.isDiscovering = true;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.error-message')).toBeNull();
    });

    it('should show cache header after discovery', () => {
      component.discoveryComplete = true;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.cache-header')).not.toBeNull();
    });

    it('should show "Fresh data" badge when cacheMetadata is null', () => {
      component.discoveryComplete = true;
      component.cacheMetadata = null;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.cache-info.fresh')).not.toBeNull();
    });

    it('should show cache age when cacheMetadata is set', () => {
      component.discoveryComplete = true;
      component.cacheMetadata = { timestamp: Date.now(), ageInDays: 4 };
      fixture.detectChanges();
      const el = fixture.nativeElement.querySelector('.cache-info:not(.fresh)') as HTMLElement;
      expect(el.textContent).toContain('4');
    });

    it('should call refreshCompetitors when refresh button is clicked', () => {
      component.discoveryComplete = true;
      spyOn(component, 'refreshCompetitors');
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.btn-refresh') as HTMLButtonElement).click();
      expect(component.refreshCompetitors).toHaveBeenCalled();
    });

    it('should render a card for each displayed competitor', () => {
      component.discoveryComplete = true;
      component.allCompetitors = [makeCompetitor('a.com'), makeCompetitor('b.com')];
      component.displayedCompetitors = [...component.allCompetitors];
      fixture.detectChanges();
      const cards = fixture.nativeElement.querySelectorAll('.competitor-card');
      expect(cards.length).toBe(2);
    });

    it('should mark selected competitor cards with the "selected" CSS class', () => {
      component.discoveryComplete = true;
      component.allCompetitors = [makeCompetitor('a.com')];
      component.displayedCompetitors = [...component.allCompetitors];
      component.selectedCompetitors.add('a.com');
      fixture.detectChanges();
      const card = fixture.nativeElement.querySelector('.competitor-card') as HTMLElement;
      expect(card.classList).toContain('selected');
    });

    it('should call toggleCompetitor when a competitor card is clicked', () => {
      component.discoveryComplete = true;
      component.allCompetitors = [makeCompetitor('a.com')];
      component.displayedCompetitors = [...component.allCompetitors];
      spyOn(component, 'toggleCompetitor');
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.competitor-card') as HTMLElement).click();
      expect(component.toggleCompetitor).toHaveBeenCalledWith('a.com');
    });

    it('should show the manual entry form after discovery', () => {
      component.discoveryComplete = true;
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.manual-entry-section')).not.toBeNull();
    });

    it('should show manualError when it is set', () => {
      component.discoveryComplete = true;
      component.manualError = 'Invalid domain format';
      fixture.detectChanges();
      const el = fixture.nativeElement.querySelector('.manual-error') as HTMLElement;
      expect(el).not.toBeNull();
      expect(el.textContent).toContain('Invalid domain format');
    });

    it('should call addManualCompetitor when the manual form is submitted', () => {
      component.discoveryComplete = true;
      spyOn(component, 'addManualCompetitor');
      fixture.detectChanges();
      const form = fixture.nativeElement.querySelector('.manual-form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit'));
      expect(component.addManualCompetitor).toHaveBeenCalled();
    });

    it('should disable the confirm button when nothing is selected', () => {
      component.discoveryComplete = true;
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.btn-confirm') as HTMLButtonElement;
      expect(btn.disabled).toBeTrue();
    });

    it('should enable the confirm button when at least one competitor is selected', () => {
      component.discoveryComplete = true;
      component.selectedCompetitors.add('a.com');
      fixture.detectChanges();
      const btn = fixture.nativeElement.querySelector('.btn-confirm') as HTMLButtonElement;
      expect(btn.disabled).toBeFalse();
    });

    it('should call confirmSelection when the confirm button is clicked', () => {
      component.discoveryComplete = true;
      component.selectedCompetitors.add('a.com');
      spyOn(component, 'confirmSelection');
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.btn-confirm') as HTMLButtonElement).click();
      expect(component.confirmSelection).toHaveBeenCalled();
    });

    it('should show the load-more button when hasMoreCompetitors is true', () => {
      component.discoveryComplete = true;
      component.allCompetitors = Array.from({ length: 30 }, (_, i) => makeCompetitor(`c${i}.com`));
      component.displayedCompetitors = component.allCompetitors.slice(0, 20);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.btn-load-more')).not.toBeNull();
    });

    it('should call loadMore when the load-more button is clicked', () => {
      component.discoveryComplete = true;
      component.allCompetitors = Array.from({ length: 30 }, (_, i) => makeCompetitor(`c${i}.com`));
      component.displayedCompetitors = component.allCompetitors.slice(0, 20);
      spyOn(component, 'loadMore');
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.btn-load-more') as HTMLButtonElement).click();
      expect(component.loadMore).toHaveBeenCalled();
    });

    it('should show the remove button only for manual competitors', () => {
      component.discoveryComplete = true;
      component.allCompetitors = [
        makeCompetitor('auto.com', { isManual: false }),
        makeCompetitor('manual.com', { isManual: true }),
      ];
      component.displayedCompetitors = [...component.allCompetitors];
      fixture.detectChanges();
      const removeBtns = fixture.nativeElement.querySelectorAll('.btn-remove');
      expect(removeBtns.length).toBe(1);
    });

    it('should call removeCompetitor when the remove button is clicked', () => {
      component.discoveryComplete = true;
      component.allCompetitors = [makeCompetitor('manual.com', { isManual: true })];
      component.displayedCompetitors = [...component.allCompetitors];
      spyOn(component, 'removeCompetitor');
      fixture.detectChanges();
      (fixture.nativeElement.querySelector('.btn-remove') as HTMLButtonElement).click();
      expect(component.removeCompetitor).toHaveBeenCalledWith('manual.com');
    });
  });
});
