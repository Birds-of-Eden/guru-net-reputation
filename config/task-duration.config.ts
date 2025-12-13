export interface TaskDurationRule {
  match: string;
  minutes: number;
}

export interface TaskDurationCategory {
  default: number;
  rules: TaskDurationRule[];
}

export interface TaskDurationConfig {
  blogPosting: TaskDurationCategory;
  socialActivity: TaskDurationCategory;
}

export const DEFAULT_TASK_DURATION_CONFIG: TaskDurationConfig = {
  blogPosting: {
    default: 20,
    rules: [
      { match: "medium", minutes: 10 },
      { match: "strikingly", minutes: 10 },
      { match: "tumblr", minutes: 10 },
      { match: "wordpress", minutes: 10 },
      { match: "blogger", minutes: 10 },
      { match: "jimdo", minutes: 10 },
      { match: "bravenet", minutes: 10 },
      { match: "weebly", minutes: 10 },
      { match: "google sites", minutes: 10 },
      { match: "jotform", minutes: 10 },
      { match: "vocal", minutes: 15 },
      { match: "wix", minutes: 13 },
    ],
  },
  socialActivity: {
    default: 10,
    rules: [
      { match: "behance", minutes: 15 },
      { match: "muckrack", minutes: 5 },
      { match: "issuu", minutes: 15 },
      { match: "about", minutes: 3 },
      { match: "flipboard", minutes: 4 },
      { match: "linktr", minutes: 3 },
      { match: "quora", minutes: 10 },
      { match: "cake", minutes: 10 },
      { match: "scoop", minutes: 6 },
      { match: "gravatar", minutes: 5 },
      { match: "giphy", minutes: 3 },
      { match: "justpaste", minutes: 4 },
      { match: "slideshare", minutes: 12 },
      { match: "slides", minutes: 5 },
      { match: "pinterest", minutes: 7 },
      { match: "500px", minutes: 5 },
      { match: "substack", minutes: 10 },
      { match: "wattpad", minutes: 5 },
      { match: "tumblr", minutes: 5 },
      { match: "wordpress", minutes: 5 },
      { match: "flickr", minutes: 5 },
      { match: "bloglovin", minutes: 5 },
      { match: "soundcloud", minutes: 5 },
      { match: "crunchbase", minutes: 5 },
      { match: "houzz", minutes: 5 },
      { match: "medium", minutes: 5 },
    ],
  },
};
