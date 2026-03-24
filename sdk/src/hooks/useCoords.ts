import { useEffect, useState } from 'react';
import { getCoordinateFormat, type CoordinateFormat } from '../bridge/coords';

/**
 * Hook that returns the user's preferred coordinate display format.
 */
export function useCoordinateFormat(): CoordinateFormat {
  const [format, setFormat] = useState<CoordinateFormat>('dd');

  useEffect(() => {
    setFormat(getCoordinateFormat());
  }, []);

  return format;
}
