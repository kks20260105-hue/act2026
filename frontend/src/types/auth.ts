export interface User {
  id:         string;
  email:      string;
  nickname?:  string;
  roles?:     string[];
}

export interface LoginRequest {
  email:    string;
  password: string;
}

export interface LoginResponse {
  user:         User;
  accessToken:  string;
}
