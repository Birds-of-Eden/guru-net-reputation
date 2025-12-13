import { TaskDurationConfig } from '../config/task-duration.config';

export function resolveIdealDurationDynamic(
  taskName: string,
  category: "Blog Posting" | "Social Activity",
  config: TaskDurationConfig
): number {
  const categoryKey = category === "Blog Posting" ? "blogPosting" : "socialActivity";
  const categoryConfig = config[categoryKey];
  
  if (!categoryConfig) {
    return category === "Blog Posting" ? 20 : 10; // fallback defaults
  }

  // Try to match against rules in order
  for (const rule of categoryConfig.rules) {
    const regex = new RegExp(rule.match, 'i'); // case-insensitive match
    if (regex.test(taskName)) {
      return rule.minutes;
    }
  }

  // Return default if no rules matched
  return categoryConfig.default;
}
