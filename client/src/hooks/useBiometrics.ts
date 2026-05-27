import { useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

const API_BASE = 'http://localhost:3000/auth';

interface UseBiometricsResult {
  isAuthenticating: boolean;
  error: string | null;
  register: (username: string) => Promise<boolean>;
  authenticate: (username: string) => Promise<boolean>;
}

export function useBiometrics(): UseBiometricsResult {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = 10000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  };

  const register = async (username: string): Promise<boolean> => {
    setIsAuthenticating(true);
    setError(null);
    try {
      // 1. Get options from server
      const res = await fetchWithTimeout(`${API_BASE}/register/generate-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      if (!res.ok) throw new Error('Failed to fetch registration options');
      const options = await res.json();

      // 2. Trigger biometric read (WebAuthn)
      let credential;
      try {
        credential = await startRegistration({ optionsJSON: options });
      } catch (err: any) {
         if (err.name === 'NotAllowedError') {
             throw new Error('Biometrics not allowed or canceled');
         }
         throw err;
      }

      // 3. Verify on server
      const verificationRes = await fetchWithTimeout(`${API_BASE}/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, response: credential })
      });

      if (!verificationRes.ok) throw new Error('Failed to verify registration');
      const verification = await verificationRes.json();

      return verification.verified;

    } catch (err: any) {
      setError(err.message || 'An unknown error occurred during registration');
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const authenticate = async (username: string): Promise<boolean> => {
    setIsAuthenticating(true);
    setError(null);
    try {
       // 1. Get options from server
       const res = await fetchWithTimeout(`${API_BASE}/login/generate-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      if (!res.ok) throw new Error('Failed to fetch authentication options');
      const options = await res.json();

      // 2. Trigger biometric read
      let assertion;
      try {
        assertion = await startAuthentication({ optionsJSON: options });
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
             throw new Error('Biometrics not allowed or canceled');
         }
         throw err;
      }

      // 3. Verify on server
      const verificationRes = await fetchWithTimeout(`${API_BASE}/login/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, response: assertion })
      });

      if (!verificationRes.ok) throw new Error('Failed to verify authentication');
      const verification = await verificationRes.json();

      return verification.verified;
    } catch (err: any) {
      setError(err.message || 'An unknown error occurred during authentication');
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  };

  return { isAuthenticating, error, register, authenticate };
}
