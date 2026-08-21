import type { SeriesRow, ChapterRow } from '../lib/progress';

export type RootStackParamList = {
  Tabs: undefined;
  Series: { seriesId: string } | undefined;
  Player: {
    seriesId: string;
    seriesTitle: string;
    coverUrl: string;
    startIndex?: number;
    startChar?: number;
  };
  Bookmarks: undefined;
  Stats: undefined;
  Settings: undefined;
  Login: undefined;
};

export type TabsParamList = {
  Home: undefined;
  Search: { q?: string; genre?: string; tag?: string } | undefined;
  Favorites: undefined;
  History: undefined;
  Profile: undefined;
};

export type PlayerNavParams = {
  seriesId: string;
  seriesTitle: string;
  coverUrl: string;
  startIndex?: number;
  startChar?: number;
};

export type SeriesWithChapters = {
  series: SeriesRow;
  chapters: ChapterRow[];
};
