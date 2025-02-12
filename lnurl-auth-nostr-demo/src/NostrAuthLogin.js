// NostrAuthLogin.js
import React, { useState, useEffect } from 'react';
// import NostrAuthClient from './NostrAuthClient';
import NostrNIP05Verification from './Nostr/Nip05';

const NostrAuthLogin = () => {
  const [authStatus, setAuthStatus] = useState('ready');
  const [error, setError] = useState('');
  const [userPubkey, setUserPubkey] = useState(null);
  const [showNIP05, setShowNIP05] = useState(false);
  const [metadata, setMetadata] = useState(null);


  const handleConnect = async () => {
    try {
      if (!window.nostr) {
        throw new Error('nos2x extension not found');
      }

      setAuthStatus('connecting');
      
      // Create login event
      const event = {
        kind: 22242,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: 'Logging in with Nostr'
      };

      // Sign with nos2x
      const signedEvent = await window.nostr.signEvent(event);
      
      // Verify with server
      const response = await fetch('http://localhost:3000/api/auth/nostr/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ signedEvent })
      });

      if (response.ok) {
        const data = await response.json();
        setUserPubkey(data.pubkey);
        setAuthStatus('verified');
        setMetadata(data.metadata);
        setShowNIP05(true);
      } else {
        throw new Error('Failed to verify signature');
      }
      
    } catch (err) {
      setError(err.message);
      setAuthStatus('error');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-4">
      <h2 className="text-2xl font-bold">Nostr Login</h2>
      
      {error && (
        <div className="text-red-500 bg-red-50 p-3 rounded">
          {error}
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-md">
        {authStatus === 'ready' && (
          <button
            onClick={handleConnect}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
          >
            Connect with Nostr
          </button>
        )}

        {authStatus === 'connecting' && (
          <div className="text-gray-700">
            Please approve in nos2x...
          </div>
        )}

        {authStatus === 'verified' && (
          <div className="space-y-4">
            <div className="text-green-600">
              <div className="font-semibold mb-2">✓ Successfully authenticated!</div>
              <div className="text-sm text-gray-700">
                Nostr pubkey: {userPubkey}
              </div>
            </div>

          {metadata && (
            <div className="mt-4">
              <NostrNIP05Verification metadata={metadata} />
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
};

export { NostrAuthLogin };