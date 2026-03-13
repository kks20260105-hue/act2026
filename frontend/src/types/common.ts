export interface ApiResponse<T = unknown> {
  success:  boolean;
  message:  string;
  data:     T;
  code?:    string;
}

export interface PaginatedResponse<T> {
  list:   T[];
  total:  number;
  page:   number;
  limit:  number;
}

export type UseYN = 'Y' | 'N';
