import React from 'react';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const NostrNIP05Verification = ({ metadata }) => {
  if (!metadata) return null;

  const profile = JSON.parse(metadata.content);
  
  if (!profile.nip05) {
    return (
      <Alert className="bg-red-50">
        <XCircle className="h-4 w-4 text-red-500" />
        <AlertTitle>No NIP-05 Found</AlertTitle>
        <AlertDescription>
          This account does not have a NIP-05 identifier
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="bg-green-50">
      <div className="flex items-start space-x-4">
        {profile.picture && (
          <img 
            src={profile.picture} 
            alt="Profile" 
            className="w-16 h-16 rounded-full object-cover"
          />
        )}
        <div className="flex-1">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertTitle>NIP-05 Verified</AlertTitle>
          <AlertDescription>
            <div className="mt-2">
              <p>Identifier: {profile.nip05}</p>
              <p className="text-sm text-gray-600">Name: {profile.name}</p>
              {profile.display_name && (
                <p className="text-sm text-gray-600">Display Name: {profile.display_name}</p>
              )}
            </div>
          </AlertDescription>
        </div>
      </div>
    </Alert>
  );
};

export default NostrNIP05Verification;