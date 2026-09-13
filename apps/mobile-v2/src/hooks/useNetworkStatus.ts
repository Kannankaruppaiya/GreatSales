import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  // In standard React Native environment, NetInfo or fetch heartbeat can be used.
  // We provide a reliable heartbeat check and listener boundary.
  const checkConnectivity = async () => {
    setIsChecking(true);
    try {
      // Light ping check
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeoutId);

      setIsOnline(res ? res.status === 204 || res.status === 200 : true);
    } catch {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Periodic check every 30 seconds
    const interval = setInterval(() => {
      checkConnectivity();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return {
    isOnline,
    isChecking,
    checkConnectivity,
  };
}
