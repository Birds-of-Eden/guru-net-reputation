import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_TASK_DURATION_CONFIG, TaskDurationConfig } from '../../../../config/task-duration.config';

// Runtime configuration stored in memory
let runtimeConfig: TaskDurationConfig = { ...DEFAULT_TASK_DURATION_CONFIG };

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: runtimeConfig
    });
  } catch (error) {
    console.error('Error getting task duration config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get task duration configuration' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate the request body structure
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Update runtime config with new values
    // Deep merge to preserve existing structure
    if (body.blogPosting) {
      runtimeConfig.blogPosting = {
        ...runtimeConfig.blogPosting,
        ...body.blogPosting,
        rules: body.blogPosting.rules || runtimeConfig.blogPosting.rules
      };
    }

    if (body.socialActivity) {
      runtimeConfig.socialActivity = {
        ...runtimeConfig.socialActivity,
        ...body.socialActivity,
        rules: body.socialActivity.rules || runtimeConfig.socialActivity.rules
      };
    }

    return NextResponse.json({
      success: true,
      data: runtimeConfig
    });
  } catch (error) {
    console.error('Error updating task duration config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update task duration configuration' },
      { status: 500 }
    );
  }
}

// Export function to get current runtime config for internal use
export function getRuntimeTaskDurationConfig(): TaskDurationConfig {
  return runtimeConfig;
}
