export interface MessageResult<T> {
  message: string;
  data: T;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiSuccessResponse<T> {
  success: true;
  statusCode: number;
  code: string;
  message: string;
  data: T;
  path: string;
  method: string;
  timestamp: string;
}

export interface PaginatedApiResponse<T> extends ApiSuccessResponse<T[]> {
  meta: PaginationMeta;
}
