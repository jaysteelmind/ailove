/**
 * POST /api/auth/logout
 * 
 * Logout user and invalidate refresh token
 * 
 * Performance Target: <50ms
 */

import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/services/AuthService';
import { verifyAccessToken, extractToken } from '@/lib/utils/auth';
import {
  successResponse,
  errorResponse,
  ErrorCodes,
  HttpStatus,
} from '@/lib/utils/api-response';

export async function POST(request: NextRequest) {
  try {
    // Extract and verify access token
    const authHeader = request.headers.get('authorization');
    const token = extractToken(authHeader);

    if (!token) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.UNAUTHORIZED,
          'Authorization token required'
        ),
        { status: HttpStatus.UNAUTHORIZED }
      );
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_TOKEN, 'Invalid access token'),
        { status: HttpStatus.UNAUTHORIZED }
      );
    }

    // Logout user
    const authService = new AuthService();
    await authService.logout(payload.userId);

    return NextResponse.json(
      successResponse({ message: 'Logged out successfully' }),
      { status: HttpStatus.OK }
    );
  } catch (error: any) {
    // Internal server error
    console.error('Logout error:', error);
    return NextResponse.json(
      errorResponse(
        ErrorCodes.INTERNAL_ERROR,
        'An error occurred during logout'
      ),
      { status: HttpStatus.INTERNAL_SERVER_ERROR }
    );
  }
}
