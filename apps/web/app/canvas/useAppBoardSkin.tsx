import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';

import { getBrowserLocalStorage } from '../browserStorage';
import { DEFAULT_BOARD_SKIN_ID, isBoardSkinId, type BoardSkinId } from './boardSkin';

export const BOARD_SKIN_STORAGE_KEY = 'corgiban-board-skin';

const useBrowserLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export type UseAppBoardSkinResult = {
  boardSkinId: BoardSkinId;
  isBoardSkinReady: boolean;
  toggleBoardSkin: () => void;
};

type BoardSkinPreferenceContextValue = {
  boardSkinId: BoardSkinId;
};

const BoardSkinPreferenceContext = createContext<BoardSkinPreferenceContextValue>({
  boardSkinId: DEFAULT_BOARD_SKIN_ID,
});

export function readStoredBoardSkin(storage: StorageLike | null | undefined): BoardSkinId | null {
  if (!storage) {
    return null;
  }

  try {
    const value = storage.getItem(BOARD_SKIN_STORAGE_KEY);
    return isBoardSkinId(value) ? value : null;
  } catch {
    return null;
  }
}

export function persistBoardSkin(
  skinId: BoardSkinId,
  storage: StorageLike | null | undefined,
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(BOARD_SKIN_STORAGE_KEY, skinId);
  } catch {
    // Ignore persistence failures so the UI still responds in restricted environments.
  }
}

export function BoardSkinPreferenceProvider({
  boardSkinId,
  children,
}: {
  boardSkinId: BoardSkinId;
  children: ReactNode;
}) {
  return (
    <BoardSkinPreferenceContext.Provider value={{ boardSkinId }}>
      {children}
    </BoardSkinPreferenceContext.Provider>
  );
}

export function useBoardSkinPreference(): BoardSkinPreferenceContextValue {
  return useContext(BoardSkinPreferenceContext);
}

export function useAppBoardSkin(): UseAppBoardSkinResult {
  const [boardSkinId, setBoardSkinId] = useState<BoardSkinId>(DEFAULT_BOARD_SKIN_ID);
  const [isBoardSkinReady, setIsBoardSkinReady] = useState(false);

  useBrowserLayoutEffect(() => {
    setBoardSkinId(readStoredBoardSkin(getBrowserLocalStorage()) ?? DEFAULT_BOARD_SKIN_ID);
    setIsBoardSkinReady(true);
  }, []);

  const applyBoardSkin = useCallback((nextBoardSkinId: BoardSkinId) => {
    persistBoardSkin(nextBoardSkinId, getBrowserLocalStorage());
    setBoardSkinId(nextBoardSkinId);
    setIsBoardSkinReady(true);
  }, []);

  const toggleBoardSkin = useCallback(() => {
    applyBoardSkin(boardSkinId === 'classic' ? 'legacy' : 'classic');
  }, [applyBoardSkin, boardSkinId]);

  return {
    boardSkinId,
    isBoardSkinReady,
    toggleBoardSkin,
  };
}
