/**
 * API Middleware Utilities
 * 
 * Authentication and authorization middleware for protected routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, extractToken, type JWTPayload } from './auth';
import { errorResponse, ErrorCodes, HttpStatus } from './api-response';

export interface AuthenticatedRequest extends NextRequest {
  user?: JWTPayload;
}

/**
 * Authenticate request and extract user from JWT
 * 
 * @param request Next.js request object
 * @returns User payload or error response
 */
export function authenticate(
  request: NextRequest
): { user: JWTPayload } | NextResponse {
  // Extract token from Authorization header
  const authHeader = request.headers.get('authorization');
  const token = extractToken(authHeader);

  if (!token) {
    return NextResponse.json(
      errorResponse(ErrorCodes.UNAUTHORIZED, 'Authorization token required'),
      { status: HttpStatus.UNAUTHORIZED }
    );
  }

  // Verify token
  const payload = verifyAccessToken(token);
  if (!payload) {
    return NextResponse.json(
      errorResponse(ErrorCodes.INVALID_TOKEN, 'Invalid or expired token'),
      { status: HttpStatus.UNAUTHORIZED }
    );
  }

  return { user: payload };
}

/**
 * Validate request body against required fields
 * 
 * @param body Request body
 * @param requiredFields Array of required field names
 * @returns Error response if validation fails, null if valid
 */
export function validateRequiredFields(
  body: any,
  requiredFields: string[]
): NextResponse | null {
  for (const field of requiredFields) {
    if (body[field] === undefined || body[field] === null) {
      return NextResponse.json(
        errorResponse(
          ErrorCodes.MISSING_FIELD,
          `Missing required field: ${field}`
        ),
        { status: HttpStatus.BAD_REQUEST }
      );
    }
  }
  return null;
}

/**
 * Validate pagination parameters
 * 
 * @param searchParams URL search parameters
 * @returns Validated page and limit, or error response
 */
export function validatePagination(
  searchParams: URLSearchParams
): { page: number; limit: number } | NextResponse {
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  if (page < 1) {
    return NextResponse.json(
      errorResponse(ErrorCodes.INVALID_INPUT, 'Page must be >= 1'),
      { status: HttpStatus.BAD_REQUEST }
    );
  }

  if (limit < 1 || limit > 100) {
    return NextResponse.json(
      errorResponse(ErrorCodes.INVALID_INPUT, 'Limit must be between 1 and 100'),
      { status: HttpStatus.BAD_REQUEST }
    );
  }

  return { page, limit };
}

/**
 * Handle API errors consistently
 * 
 * @param error Error object
 * @param context Error context for logging
 * @returns Standardized error response
 */
export function handleApiError(error: any, context: string): NextResponse {
  console.error(`${context}:`, error);

  // Handle known error types
  if (error.message?.includes('not found') || error.message?.includes('Not found')) {
    return NextResponse.json(
      errorResponse(ErrorCodes.NOT_FOUND, error.message),
      { status: HttpStatus.NOT_FOUND }
    );
  }

  if (error.message?.includes('Invalid') || error.message?.includes('validation')) {
    return NextResponse.json(
      errorResponse(ErrorCodes.VALIDATION_ERROR, error.message),
      { status: HttpStatus.BAD_REQUEST }
    );
  }

  if (error.message?.includes('Unauthorized') || error.message?.includes('permission')) {
    return NextResponse.json(
      errorResponse(ErrorCodes.UNAUTHORIZED, error.message),
      { status: HttpStatus.FORBIDDEN }
    );
  }

  // Default internal server error
  return NextResponse.json(
    errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'An internal error occurred'
    ),
    { status: HttpStatus.INTERNAL_SERVER_ERROR }
  );
}
