export const Category = {
  HACKER_NEWS: "Hacker News",
  DEV_COMMUNITY: "Dev & product feeds",
  OPEN_SOURCE: "Trending on GitHub",
  RESEARCH: "arXiv (CS)",
} as const;

export type Category = (typeof Category)[keyof typeof Category];

export interface Story {
  title: string;
  url: string;
  category: Category;
  source: string;
}
