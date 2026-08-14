import { createContext, useContext } from 'react';
import React from 'react';

import type { TeamSession } from '@hanzo/esign-trpc/server/organisation-router/get-organisation-session.types';
import { setZapTeam } from '@hanzo/esign-trpc/zap/client';

type TeamProviderValue = TeamSession;

interface TeamProviderProps {
  children: React.ReactNode;
  team: TeamProviderValue | null;
}

const TeamContext = createContext<TeamProviderValue | null>(null);

export const useCurrentTeam = () => {
  const context = useContext(TeamContext);

  if (!context) {
    throw new Error('useCurrentTeam must be used within a TeamProvider');
  }

  return context;
};

export const useOptionalCurrentTeam = () => {
  return useContext(TeamContext);
};

export const TeamProvider = ({ children, team }: TeamProviderProps) => {
  // Scope RPC to the same team the tree below is about. Set while rendering, so
  // it is in place before any descendant issues its first call.
  setZapTeam(team?.id ?? null);

  return <TeamContext.Provider value={team}>{children}</TeamContext.Provider>;
};
