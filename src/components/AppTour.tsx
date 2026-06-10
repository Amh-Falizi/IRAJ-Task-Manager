import React, { useState, useEffect } from 'react';
import { Joyride, CallBackProps, STATUS, Step } from 'react-joyride';

export default function AppTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('has_seen_tour');
    if (!hasSeenTour) {
      setRun(true);
    }
  }, []);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    
    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem('has_seen_tour', 'true');
    }
  };

  const steps: Step[] = [
    {
      target: '.tour-sidebar',
      content: 'Welcome! This is the main navigation menu where you can access projects, teams, planning, and more.',
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '.tour-dashboard-stats',
      content: 'Here you can view a quick summary of your workload and project health.',
      placement: 'bottom',
    },
    {
      target: '.tour-my-tasks',
      content: 'Your assigned tasks appear here. Click on any task to view details or log hours.',
      placement: 'right',
    },
    {
      target: '.tour-my-notes',
      content: 'Your personal scratchpad! Only you can see these notes.',
      placement: 'left',
    },
    {
      target: '.tour-user-dropdown',
      content: 'Update your profile and view your credentials from here.',
      placement: 'left',
    }
  ];

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      hideCloseButton
      run={run}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={steps}
      styles={{
        options: {
          zIndex: 10000,
          primaryColor: '#3b82f6',
          textColor: '#f8fafc',
          backgroundColor: '#1e293b',
          arrowColor: '#1e293b',
          overlayColor: 'rgba(0, 0, 0, 0.5)',
        },
        buttonClose: {
          display: 'none',
        },
        buttonSkip: {
          color: '#cbd5e1',
        },
        buttonBack: {
          color: '#94a3b8',
        }
      }}
    />
  );
}
