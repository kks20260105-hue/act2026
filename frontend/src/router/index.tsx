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
const Menu01_ManagePage   = lazy(() => import('../pages/admin/Menu01_ManagePage'));
const MenuUploadPage   = lazy(() => import('../pages/admin/MenuUploadPage'));
const Menu02_RoleManagePage   = lazy(() => import('../pages/admin/Menu02_RoleManagePage'));
const Menu03_MenuRolePage     = lazy(() => import('../pages/admin/Menu03_MenuRolePage'));
const Menu04_MenuRolePage     = lazy(() => import('../pages/admin/Menu04_UserRolePage'));
const AiPermissionChat      = lazy(() => import('../pages/openai/Aipermissionchat'));

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
          { path: '/admin/menus',      element: <Suspense fallback={<Loading />}><Menu01_ManagePage /></Suspense> },
          { path: '/admin/menu-upload', element: <Suspense fallback={<Loading />}><MenuUploadPage /></Suspense> },
          { path: '/admin/roles',      element: <Suspense fallback={<Loading />}><Menu02_RoleManagePage /></Suspense> },
          { path: '/admin/menu-roles', element: <Suspense fallback={<Loading />}><Menu03_MenuRolePage /></Suspense> },
          { path: '/admin/user-roles', element: <Suspense fallback={<Loading />}><Menu04_MenuRolePage /></Suspense> },
          { path: '/admin/manageqa',  element: <Suspense fallback={<Loading />}><AiPermissionChat /></Suspense> },
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
