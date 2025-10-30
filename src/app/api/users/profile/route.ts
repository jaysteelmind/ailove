/**
 * GET /api/users/profile
 * 
 * Get authenticated user's profile
 * 
 * Performance Target: <100ms
 */

import { NextRequest, NextResponse } from 'next/server';
import { UserRepository } from '@/lib/repositories/UserRepository';
import { authenticate, handleApiError } from '@/lib/utils/middleware';
import {
  successResponse,
  errorResponse,
  ErrorCodes,
  HttpStatus,
} from '@/lib/utils/api-response';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = authenticate(request);
    if (authResult instanceof NextResponse) {
      return authResult; // Return error response
    }

    const { user } = authResult;

    // Get user profile
    const userRepo = new UserRepository();
    const profile = await userRepo.findById(user.userId);

    if (!profile) {
      return NextResponse.json(
        errorResponse(ErrorCodes.NOT_FOUND, 'User not found'),
        { status: HttpStatus.NOT_FOUND }
      );
    }

    // Remove sensitive data
    const { passwordHash, ...safeProfile } = profile;

    return NextResponse.json(
      successResponse(safeProfile),
      { status: HttpStatus.OK }
    );
  } catch (error: any) {
    return handleApiError(error, 'Get profile error');
  }
}

/**
 * PATCH /api/users/profile
 * 
 * Update authenticated user's profile
 * 
 * Performance Target: <150ms
 */
export async function PATCH(request: NextRequest) {
  try {
    // Authenticate user
    const authResult = authenticate(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const body = await request.json();

    // Validate updatable fields
    const allowedFields = [
      'firstName',
      'lastName',
      'gender',
      'location',
    ];

    const updates: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.INVALID_INPUT,
          'No valid fields to update'
        ),
        { status: HttpStatus.BAD_REQUEST }
      );
    }

    // Update user
    const userRepo = new UserRepository();
    const updatedUser = await userRepo.update(user.userId, updates);

    // Remove sensitive data
    const { passwordHash, ...safeProfile } = updatedUser;

    return NextResponse.json(
      successResponse(safeProfile),
      { status: HttpStatus.OK }
    );
  } catch (error: any) {
    return handleApiError(error, 'Update profile error');
  }
}
