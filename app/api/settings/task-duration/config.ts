import {
  DEFAULT_TASK_DURATION_CONFIG,
  TaskDurationConfig,
} from "../../../../config/task-duration.config";

let runtimeConfig: TaskDurationConfig = { ...DEFAULT_TASK_DURATION_CONFIG };

export function getRuntimeTaskDurationConfig(): TaskDurationConfig {
  return runtimeConfig;
}

export function updateRuntimeTaskDurationConfig(
  updater: (current: TaskDurationConfig) => TaskDurationConfig
): TaskDurationConfig {
  runtimeConfig = updater(runtimeConfig);
  return runtimeConfig;
}

export function resetRuntimeTaskDurationConfig(): TaskDurationConfig {
  runtimeConfig = { ...DEFAULT_TASK_DURATION_CONFIG };
  return runtimeConfig;
}
