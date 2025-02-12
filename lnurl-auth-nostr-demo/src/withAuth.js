// withAuth.js
import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const generateLnurlQRContent = (k1) => {
  // LNURL-auth standard format
  const domain = 'localhost:3000';
  const tag = 'login';
  const url = `lnurl1://${domain}/api/auth/lnurl/callback?tag=${tag}&k1=${k1}`;
  return url;
};

const generateNostrQRContent = (k1) => {
  // Nostr standard format
  return `nostr:${k1}`;
};

const withAuth = (authType) => {
  return function AuthComponent() {
    const [k1Challenge, setK1Challenge] = useState('');
    const [authStatus, setAuthStatus] = useState('waiting');
    const [nodeInfo, setNodeInfo] = useState(null);
    const [error, setError] = useState('');

    const generateChallenge = async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/auth/${authType}/challenge`, {
          method: 'POST',
        });
        const data = await response.json();
        setK1Challenge(data.k1);
        setAuthStatus('pending');
        pollAuthStatus(data.k1);
      } catch (err) {
        setError(`Failed to generate ${authType} login challenge`);
        setAuthStatus('error');
      }
    };

    const pollAuthStatus = async (k1) => {
      const checkStatus = async () => {
        try {
          console.log(`Checking status for ${authType}:`, k1);
          const response = await fetch(`http://localhost:3000/api/auth/${authType}/status?k1=${k1}`);
          const data = await response.json();
          console.log('Status response:', data);
          
          if (data.status === 'verified') {
            setAuthStatus('verified');
            setNodeInfo(data.nodeInfo || null);
            return true;
          }
          return false;
        } catch (err) {
          console.error('Status check error:', err);
          return false; // Don't stop polling on error
        }
      };

      // Initial check
      await checkStatus();

      const pollInterval = setInterval(async () => {
        const shouldStop = await checkStatus();
        if (shouldStop) {
          clearInterval(pollInterval);
        }
      }, 15000);

      // Set timeout to clear interval
      const timeoutId = setTimeout(() => {
        clearInterval(pollInterval);
        setAuthStatus('error');
        setError('Authentication timeout');
      }, 120000);

      // Cleanup function
      return () => {
        clearInterval(pollInterval);
        clearTimeout(timeoutId);
      };
    };

    useEffect(() => {
      generateChallenge();
    }, []);

    const authTypeDisplayName = authType === 'lnurl' ? 'Lightning' : 'Nostr';

    return (
      <div className="flex flex-col items-center justify-center space-y-4 p-4">
        <h2 className="text-2xl font-bold">{authTypeDisplayName} Login</h2>
        
        {error && (
          <div className="text-red-500 bg-red-50 p-3 rounded">
            {error}
          </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow-md">
          {authStatus === 'waiting' && (
            <div className="text-gray-600">
              Generating login challenge...
            </div>
          )}

          {authStatus === 'pending' && (
            <div>
              <div className="mb-4 text-gray-700">
                Challenge: {k1Challenge}
              </div>
              <div className="mb-4">
                <QRCodeSVG
                  value={authType === 'lnurl' 
                    ? generateLnurlQRContent(k1Challenge)
                    : generateNostrQRContent(k1Challenge)}
                  size={256}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <div className="text-sm text-gray-600">
                Use the {authTypeDisplayName.toLowerCase()} client to authenticate with this challenge
              </div>
            </div>
          )}

          {authStatus === 'verified' && (
            <div className="text-green-600">
              <div className="font-semibold mb-2">✓ Successfully authenticated!</div>
              {nodeInfo && (
                <div className="text-sm text-gray-700">
                  {authType === 'lnurl' ? 'Node pubkey' : 'Nostr pubkey'}: {nodeInfo.pubkey}
                </div>
              )}
            </div>
          )}

          {authStatus === 'error' && (
            <button 
              onClick={generateChallenge}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  };
};

// Export auth components using HOC
export const LNURLAuthLogin = withAuth('lnurl');
export const NostrAuthLogin = withAuth('nostr');