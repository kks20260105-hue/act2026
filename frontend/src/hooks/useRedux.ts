import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/redux/store';

/** Redux dispatch 훅 */
export const useAppDispatch = () => useDispatch<AppDispatch>();

/** Redux selector 훅 (타입 안전) */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
