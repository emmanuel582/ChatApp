import React from 'react';
import { useParams } from 'react-router-dom';
import BeginConversation from './BeginConversation';

export default function AdminImpersonation() {
    const { userId } = useParams();
    // We pass key=userId to force re-render if ID changes
    return <BeginConversation key={userId} impersonatedUserId={userId} isGhostMode={true} />;
}
