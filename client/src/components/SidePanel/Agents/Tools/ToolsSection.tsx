import { useState, useMemo, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import { PermissionTypes, Permissions } from 'librechat-data-provider';
import type { AgentForm } from '~/common';
import type { AgentItem } from './items/types';
import ToolRow from './ToolRow';
import ToolInfoDialog from './ToolInfoDialog';
import ToolsMarketplaceDialog from './ToolsMarketplaceDialog';
import { useAnimatedList } from './useAnimatedList';

const itemKey = (item: AgentItem) => `${item.kind}:${item.id}`;
const LIST_EXIT_MS = 200;
import { buildCatalog } from './items/catalog';
import { deriveSelectedItems } from './items/selectors';
import { computeToggleAction } from './items/mutations';
import { useAgentPanelContext } from '~/Providers';
import { useListSkillsQuery } from '~/data-provider';
import { useLocalize, useHasAccess } from '~/hooks';

interface Props {
  agentId: string;
}

export default function ToolsSection({ agentId }: Props) {
  const localize = useLocalize();
  const [open, setOpen] = useState(false);
  const [infoItem, setInfoItem] = useState<AgentItem | null>(null);
  const { control, getValues, setValue } = useFormContext<AgentForm>();
  const { agentsConfig, regularTools, mcpServersMap, actions } = useAgentPanelContext();

  const hasMcpAccess = useHasAccess({
    permissionType: PermissionTypes.MCP_SERVERS,
    permission: Permissions.USE,
  });
  const hasSkillsAccess = useHasAccess({
    permissionType: PermissionTypes.SKILLS,
    permission: Permissions.USE,
  });
  const { data: skillsData } = useListSkillsQuery({ limit: 100 }, { enabled: hasSkillsAccess });

  const tools = (useWatch({ control, name: 'tools' }) ?? []) as string[];
  const skills = (useWatch({ control, name: 'skills' }) ?? []) as string[];
  const executeCode = (useWatch({ control, name: 'execute_code' }) ?? false) as boolean;
  const webSearch = (useWatch({ control, name: 'web_search' }) ?? false) as boolean;
  const fileSearch = (useWatch({ control, name: 'file_search' }) ?? false) as boolean;
  const artifacts = (useWatch({ control, name: 'artifacts' }) ?? '') as string;
  const agent = useWatch({ control, name: 'agent' });

  const contextFiles = (agent?.context_files ?? []) as Array<[string, unknown]>;
  const knowledgeFiles = (agent?.knowledge_files ?? []) as Array<[string, unknown]>;
  const codeFiles = (agent?.code_files ?? []) as Array<[string, unknown]>;

  const agentActions = useMemo(
    () => (actions ?? []).filter((a) => a.agent_id === agentId),
    [actions, agentId],
  );

  const catalog = useMemo(
    () =>
      buildCatalog({
        agentsConfig: { capabilities: agentsConfig?.capabilities ?? [] },
        regularTools: regularTools ?? [],
        mcpServersMap: mcpServersMap ?? new Map(),
        skills: skillsData?.skills ?? [],
        actions: agentActions,
        permissions: { mcp: hasMcpAccess, skills: hasSkillsAccess },
      }),
    [
      agentsConfig,
      regularTools,
      mcpServersMap,
      skillsData,
      agentActions,
      hasMcpAccess,
      hasSkillsAccess,
    ],
  );

  const selected = useMemo(
    () =>
      deriveSelectedItems(
        {
          execute_code: executeCode,
          web_search: webSearch,
          file_search: fileSearch,
          artifacts,
          tools,
          skills,
          context_files: contextFiles,
          knowledge_files: knowledgeFiles,
          code_files: codeFiles,
        },
        catalog,
        agentActions,
      ),
    [
      executeCode,
      webSearch,
      fileSearch,
      artifacts,
      tools,
      skills,
      contextFiles,
      knowledgeFiles,
      codeFiles,
      catalog,
      agentActions,
    ],
  );

  const handleQuickRemove = useCallback(
    (item: AgentItem) => {
      const patch = computeToggleAction(item, { selected: true });
      switch (patch.type) {
        case 'builtin':
          setValue(patch.field as keyof AgentForm, patch.value as never, { shouldDirty: true });
          break;
        case 'tool-remove': {
          const current = (getValues('tools') ?? []) as string[];
          setValue(
            'tools',
            current.filter((t) => t !== patch.id),
            { shouldDirty: true },
          );
          break;
        }
        case 'skill-remove': {
          const current = (getValues('skills') ?? []) as string[];
          setValue(
            'skills',
            current.filter((s) => s !== patch.id),
            { shouldDirty: true },
          );
          break;
        }
        default:
          setOpen(true);
      }
    },
    [getValues, setValue],
  );

  const animatedEntries = useAnimatedList(selected, itemKey, LIST_EXIT_MS);
  const isEmpty = animatedEntries.length === 0;

  return (
    <div className="mb-3 flex flex-col">
      <div className="mb-1 flex items-center justify-between">
        <label className="block text-[11px] font-medium uppercase tracking-wide text-text-secondary">
          {localize('com_ui_tools_section_title')}
          {selected.length > 0 && (
            <span className="ml-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-surface-tertiary px-1.5 text-[10px] font-medium normal-case tracking-normal text-text-secondary">
              {selected.length}
            </span>
          )}
        </label>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          {localize('com_ui_add')}
        </button>
      </div>
      {isEmpty ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-border-light px-2 py-4 text-text-secondary transition-colors hover:border-border-medium hover:bg-surface-secondary hover:text-text-secondary"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs">{localize('com_ui_tools_empty')}</span>
          <span className="text-[11px] text-text-secondary">
            {localize('com_ui_tools_empty_hint')}
          </span>
        </button>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {animatedEntries.map((entry) => (
            <li key={entry.key}>
              <ToolRow
                item={entry.item}
                onClick={() => setOpen(true)}
                onInfo={setInfoItem}
                onRemove={handleQuickRemove}
                dataState={entry.phase}
              />
            </li>
          ))}
        </ul>
      )}
      {open && <ToolsMarketplaceDialog open={open} onOpenChange={setOpen} agentId={agentId} />}
      <ToolInfoDialog item={infoItem} onClose={() => setInfoItem(null)} />
    </div>
  );
}
