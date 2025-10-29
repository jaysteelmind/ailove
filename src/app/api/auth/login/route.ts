/**
 * POST /api/auth/login
 * 
 * Authenticate user and generate tokens
 * 
 * Performance Target: <200ms
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

    // Validate required fields
    if (!body.email || !body.password) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.MISSING_FIELD,
          'Email and password are required'
        ),
        { status: HttpStatus.BAD_REQUEST }
      );
    }

    // Login user
    const authService = new AuthService();
    const result = await authService.login({
      email: body.email,
      password: body.password,
    });

    return NextResponse.json(
      successResponse(result),
      { status: HttpStatus.OK }
    );
  } catch (error: any) {
    // Handle authentication errors
    if (error.message === 'Invalid email or password') {
      return NextResponse.json(
        errorResponse(ErrorCodes.INVALID_CREDENTIALS, error.message),
        { status: HttpStatus.UNAUTHORIZED }
      );
    }

    // Internal server error
    console.error('Login error:', error);
    return NextResponse.json(
      errorResponse(
        ErrorCodes.INTERNAL_ERROR,
        'An error occurred during login'
      ),
      { status: HttpStatus.INTERNAL_SERVER_ERROR }
    );
  }
}
