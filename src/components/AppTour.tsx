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
      target: '.tour-nav-dashboard',
      content: 'View a summary of your workload, upcoming deadlines, and recent activity here.',
      placement: 'right',
    },
    {
      target: '.tour-nav-projects',
      content: 'Manage all your projects here. You can group tasks into projects and track overall completion.',
      placement: 'right',
    },
    {
      target: '.tour-nav-planning',
      content: 'Plan your project milestones and timelines using the Gantt-like view.',
      placement: 'right',
    },
    {
      target: '.tour-nav-task-board',
      content: 'Organize tasks interactively. Drag and drop to move them across progress columns.',
      placement: 'right',
    },
    {
      target: '.tour-nav-task-graph',
      content: 'See task dependencies and flow visually using a node-based graph.',
      placement: 'right',
    },
    {
      target: '.tour-nav-calendar',
      content: 'Visualize all tasks and events on a monthly calendar, perfect for keeping track of deadlines.',
      placement: 'right',
    },
    {
      target: '.tour-nav-documents',
      content: 'Create, edit, and organize project documentation seamlessly.',
      placement: 'right',
    },
    {
      target: '.tour-nav-teams',
      content: 'Manage and collaborate with different teams in your organization.',
      placement: 'right',
    },
    {
      target: '.tour-user-dropdown',
      content: 'Update your profile here. Let\'s get started!',
      placement: 'right',
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
