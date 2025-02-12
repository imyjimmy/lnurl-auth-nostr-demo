import React, { useState, useEffect } from 'react';

const LNURLAuthLogin = () => {
  const [k1Challenge, setK1Challenge] = useState('');
  const [authStatus, setAuthStatus] = useState('waiting'); // 'waiting', 'pending', 'verified', 'error'
  const [nodeInfo, setNodeInfo] = useState(null);
  const [error, setError] = useState('');

  const generateChallenge = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/auth/challenge', {
        method: 'POST',
      });
      const data = await response.json();
      setK1Challenge(data.k1);
      setAuthStatus('pending');
      pollAuthStatus(data.k1);
    } catch (err) {
      setError('Failed to generate login challenge');
      setAuthStatus('error');
    }
  };

  const pollAuthStatus = async (k1) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/auth/status?k1=${k1}`);
        const data = await response.json();
        
        if (data.status === 'verified') {
          setAuthStatus('verified');
          setNodeInfo(data.nodeInfo || null);
          return true;
        }
        return false;
      } catch (err) {
        setError('Failed to check auth status');
        setAuthStatus('error');
        return true;
      }
    };

    // Poll every 15 seconds until verified or error
    const pollInterval = setInterval(async () => {
      const shouldStop = await checkStatus();
      if (shouldStop) {
        clearInterval(pollInterval);
      }
    }, 15000);

    // Cleanup interval after 2 minutes
    setTimeout(() => {
      clearInterval(pollInterval);
      if (authStatus === 'pending') {
        setAuthStatus('error');
        setError('Authentication timeout');
      }
    }, 120000);
  };

  useEffect(() => {
    generateChallenge();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-4">
      <h2 className="text-2xl font-bold">Lightning Login</h2>
      
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
            <div className="text-sm text-gray-600">
              Use the test client to authenticate with this challenge
            </div>
          </div>
        )}

        {authStatus === 'verified' && (
          <div className="text-green-600">
            <div className="font-semibold mb-2">✓ Successfully authenticated!</div>
            {nodeInfo && (
              <div className="text-sm text-gray-700">
                Node pubkey: {nodeInfo.pubkey}
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

export default LNURLAuthLogin;