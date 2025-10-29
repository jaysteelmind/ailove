/**
 * POST /api/auth/refresh
 * 
 * Refresh access token using refresh token
 * 
 * Performance Target: <50ms
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/services/AuthService';
import {
  successResponse,
  errorResponse,
  ErrorCodes,
  HttpStatus,
} from '@/lib/utils/api-response';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate refresh token
    if (!body.refreshToken) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.MISSING_FIELD,
          'Refresh token is required'
        ),
        { status: HttpStatus.BAD_REQUEST }
      );
    }

    // Refresh tokens
    const authService = new AuthService();
    const tokens = await authService.refresh(body.refreshToken);

    return NextResponse.json(
      successResponse({ tokens }),
      { status: HttpStatus.OK }
    );
  } catch (error: any) {
    // Handle token errors
    if (
      error.message.includes('Invalid') ||
      error.message.includes('expired')
    ) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_TOKEN, error.message),
        { status: HttpStatus.UNAUTHORIZED }
      );
    }

    // Internal server error
    console.error('Refresh token error:', error);
    return NextResponse.json(
      errorResponse(
        ErrorCodes.INTERNAL_ERROR,
        'An error occurred while refreshing token'
      ),
      { status: HttpStatus.INTERNAL_SERVER_ERROR }
    );
  }
}
