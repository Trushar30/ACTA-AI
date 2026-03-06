import React from 'react';
import zoomLogo from '../assets/zoom.png';
import teamsLogo from '../assets/teams.png';
import meetLogo from '../assets/google-meet.png';

export const ZoomLogo = ({ className = "w-8 h-8" }) => (
    <img src={zoomLogo} alt="Zoom" className={className} />
);

export const TeamsLogo = ({ className = "w-8 h-8" }) => (
    <img src={teamsLogo} alt="Microsoft Teams" className={className} />
);

export const MeetLogo = ({ className = "w-8 h-8" }) => (
    <img src={meetLogo} alt="Google Meet" className={className} />
);
