/**
 * POST /api/auth/register
 * 
 * Register new user account
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
    const requiredFields = [
      'email',
      'password',
      'firstName',
      'lastName',
      'dateOfBirth',
      'gender',
      'location',
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          errorResponse(
            ErrorCodes.MISSING_FIELD,
            `Missing required field: ${field}`
          ),
          { status: HttpStatus.BAD_REQUEST }
        );
      }
    }

    // Validate location structure
    if (
      !body.location.city ||
      !body.location.state ||
      !body.location.country ||
      typeof body.location.latitude !== 'number' ||
      typeof body.location.longitude !== 'number'
    ) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Invalid location format'
        ),
        { status: HttpStatus.BAD_REQUEST }
      );
    }

    // Convert dateOfBirth to Date object
    const dateOfBirth = new Date(body.dateOfBirth);
    if (isNaN(dateOfBirth.getTime())) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.VALIDATION_ERROR,
          'Invalid date of birth format'
        ),
        { status: HttpStatus.BAD_REQUEST }
      );
    }

    // Register user
    const authService = new AuthService();
    const result = await authService.register({
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      dateOfBirth,
      gender: body.gender,
      location: body.location,
    });

    return NextResponse.json(
      successResponse(result),
      { status: HttpStatus.CREATED }
    );
  } catch (error: any) {
    // Handle specific errors
    if (error.message === 'Email already registered') {
      return NextResponse.json(
        errorResponse(ErrorCodes.ALREADY_EXISTS, error.message),
        { status: HttpStatus.CONFLICT }
      );
    }

    if (
      error.message.includes('Invalid') ||
      error.message.includes('Must be')
    ) {
      return NextResponse.json(
        errorResponse(ErrorCodes.VALIDATION_ERROR, error.message),
        { status: HttpStatus.BAD_REQUEST }
      );
    }

    // Internal server error
    console.error('Registration error:', error);
    return NextResponse.json(
      errorResponse(
        ErrorCodes.INTERNAL_ERROR,
        'An error occurred during registration'
      ),
      { status: HttpStatus.INTERNAL_SERVER_ERROR }
    );
  }
}
