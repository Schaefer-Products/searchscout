export class PaginatedList<T> {
  items: T[] = [];
  displayed: T[] = [];

  constructor(readonly chunk: number) {}

  reset(items: T[]): void {
    this.items = items;
    this.displayed = items.slice(0, this.chunk);
  }

  loadMore(): void {
    this.displayed = this.items.slice(0, this.displayed.length + this.chunk);
  }

  get hasMore(): boolean {
    return this.displayed.length < this.items.length;
  }

  get remaining(): number {
    return this.items.length - this.displayed.length;
  }
}
