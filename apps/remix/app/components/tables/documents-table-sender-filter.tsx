import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { useLocation, useNavigate, useSearchParams } from 'react-router';

import { useIsMounted } from '@hanzo/esign-lib/client-only/hooks/use-is-mounted';
import type { TGetTeamMembersResponse } from '@hanzo/esign-trpc/server/team-router/get-team-members.types';
import { useZapQuery } from '@hanzo/esign-trpc/zap/react';
import { MultiSelectCombobox } from '@hanzo/esign-ui/primitives/multi-select-combobox';

type DocumentsTableSenderFilterProps = {
  teamId: number;
};

export const DocumentsTableSenderFilter = ({ teamId }: DocumentsTableSenderFilterProps) => {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isMounted = useIsMounted();

  const senderIds = (searchParams?.get('senderIds') ?? '')
    .split(',')
    .filter((value) => value !== '');

  const { data, isLoading } = useZapQuery<TGetTeamMembersResponse>('team.member.getMany', {
    teamId,
  });

  const comboBoxOptions = (data ?? []).map((member) => ({
    label: member.name ?? member.email,
    value: member.userId.toString(),
  }));

  const onChange = (newSenderIds: string[]) => {
    if (!pathname) {
      return;
    }

    const params = new URLSearchParams(searchParams?.toString());

    params.set('senderIds', newSenderIds.join(','));

    if (newSenderIds.length === 0) {
      params.delete('senderIds');
    }

    void navigate(`${pathname}?${params.toString()}`, { preventScrollReset: true });
  };

  return (
    <MultiSelectCombobox
      emptySelectionPlaceholder={
        <p className="text-muted-foreground font-normal">
          <Trans>
            <span className="text-muted-foreground/70">Sender:</span> All
          </Trans>
        </p>
      }
      enableClearAllButton={true}
      inputPlaceholder={msg`Search`}
      loading={!isMounted || isLoading}
      options={comboBoxOptions}
      selectedValues={senderIds}
      onChange={onChange}
    />
  );
};
