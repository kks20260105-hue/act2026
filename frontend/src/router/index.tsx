import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import PrivateRoute   from './PrivateRoute';
import RoleRoute      from './RoleRoute';
import LoadingSpinner from '../components/common/LoadingSpinner';

// Lazy load pages
const LoginPage          = lazy(() => import('../pages/LoginPage'));
const RegisterPage       = lazy(() => import('../pages/RegisterPage'));
const SocialRegisterPage = lazy(() => import('../pages/SocialRegisterPage'));
const OAuthCallbackPage  = lazy(() => import('../pages/OAuthCallbackPage'));
const HomePage           = lazy(() => import('../pages/HomePage'));
const ForbiddenPage    = lazy(() => import('../pages/ForbiddenPage'));
const NotFoundPage     = lazy(() => import('../pages/NotFoundPage'));
const MenuManagePage   = lazy(() => import('../pages/admin/MenuManagePage'));
const MenuUploadPage   = lazy(() => import('../pages/admin/MenuUploadPage'));
const RoleManagePage   = lazy(() => import('../pages/admin/RoleManagePage'));
const MenuRolePage     = lazy(() => import('../pages/admin/MenuRolePage'));
const UserRolePage     = lazy(() => import('../pages/admin/UserRolePage'));

const Loading = () => <LoadingSpinner fullPage />;

const router = createBrowserRouter([
  {
    path:    '/login',
    element: <Suspense fallback={<Loading />}><LoginPage /></Suspense>,
  },
  {
    path:    '/register',
    element: <Suspense fallback={<Loading />}><RegisterPage /></Suspense>,
  },
  {
    path:    '/register/social',
    element: <Suspense fallback={<Loading />}><SocialRegisterPage /></Suspense>,
  },
  {
    path:    '/oauth/callback',
    element: <Suspense fallback={<Loading />}><OAuthCallbackPage /></Suspense>,
  },
  {
    path:    '/forbidden',
    element: <Suspense fallback={<Loading />}><ForbiddenPage /></Suspense>,
  },
  {
    // 로그인 필요 라우트
    element: <PrivateRoute />,
    children: [
      {
        path:    '/',
        element: <Suspense fallback={<Loading />}><HomePage /></Suspense>,
      },
      {
        // ADMIN 이상 전용
        element: <RoleRoute roles={['SUPER_ADMIN', 'ADMIN']} />,
        children: [
          { path: '/admin/menus',      element: <Suspense fallback={<Loading />}><MenuManagePage /></Suspense> },
          { path: '/admin/menu-upload', element: <Suspense fallback={<Loading />}><MenuUploadPage /></Suspense> },
          { path: '/admin/roles',      element: <Suspense fallback={<Loading />}><RoleManagePage /></Suspense> },
          { path: '/admin/menu-roles', element: <Suspense fallback={<Loading />}><MenuRolePage /></Suspense> },
          { path: '/admin/user-roles', element: <Suspense fallback={<Loading />}><UserRolePage /></Suspense> },
        ],
      },
    ],
  },
  {
    path:    '*',
    element: <Suspense fallback={<Loading />}><NotFoundPage /></Suspense>,
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} />;
}
