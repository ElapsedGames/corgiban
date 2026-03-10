import { useEffect, useState } from 'react';

type MediaQueryListLike = Pick<
  MediaQueryList,
  'matches' | 'addEventListener' | 'removeEventListener'
> & {
  addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

type MatchMediaLike = (query: string) => MediaQueryListLike;

function getMatchMedia(): MatchMediaLike | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }

  return window.matchMedia.bind(window) as MatchMediaLike;
}

export function readMediaQueryMatch(
  query: string,
  matchMedia: MatchMediaLike | null = getMatchMedia(),
): boolean {
  if (!matchMedia) {
    return false;
  }

  return matchMedia(query).matches;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => readMediaQueryMatch(query));

  useEffect(() => {
    const matchMedia = getMatchMedia();
    if (!matchMedia) {
      setMatches(false);
      return;
    }

    const mediaQueryList = matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    setMatches(mediaQueryList.matches);

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handleChange);
      return () => {
        mediaQueryList.removeEventListener('change', handleChange);
      };
    }

    mediaQueryList.addListener?.(handleChange);
    return () => {
      mediaQueryList.removeListener?.(handleChange);
    };
  }, [query]);

  return matches;
}
