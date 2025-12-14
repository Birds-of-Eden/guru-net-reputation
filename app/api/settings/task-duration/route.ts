import { NextRequest, NextResponse } from 'next/server';
import {
  TaskDurationConfig,
} from '../../../../config/task-duration.config';
import {
  getRuntimeTaskDurationConfig,
  updateRuntimeTaskDurationConfig,
} from './config';

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: getRuntimeTaskDurationConfig()
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
    const updated = updateRuntimeTaskDurationConfig((current) => {
      const next: TaskDurationConfig = { ...current };

      if (body.blogPosting) {
        next.blogPosting = {
          ...next.blogPosting,
          ...body.blogPosting,
          rules: body.blogPosting.rules || next.blogPosting.rules
        };
      }

      if (body.socialActivity) {
        next.socialActivity = {
          ...next.socialActivity,
          ...body.socialActivity,
          rules: body.socialActivity.rules || next.socialActivity.rules
        };
      }

      return next;
    });

    return NextResponse.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error('Error updating task duration config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update task duration configuration' },
      { status: 500 }
    );
  }
}
