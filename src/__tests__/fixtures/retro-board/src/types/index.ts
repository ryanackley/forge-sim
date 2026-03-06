export type Category = 'went-well' | 'improve' | 'action-items';

export interface RetroItem {
  id: string;
  text: string;
  category: Category;
  votes: number;
  authorId: string;
  createdAt: number;
}

export interface RetroBoard {
  sprintId: string;
  sprintName: string;
  items: RetroItem[];
  closed: boolean;
  summary?: string;
}

export interface VoteEvent {
  sprintId: string;
  itemId: string;
  voterId: string;
}

export interface NewItemEvent {
  sprintId: string;
  item: RetroItem;
}

export interface SummaryEvent {
  sprintId: string;
}
