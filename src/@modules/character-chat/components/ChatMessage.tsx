import type {
  CharacterChatEmotion,
  CharacterChatMessage as CharacterChatMessageData,
  CharacterChatMessageBlock,
} from '@core/types';
import {
  ArrowPathIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  PencilIcon,
  PinIcon,
} from '@shared/components';
import { getEmotionLabel, parseRoleplayResponse } from '@services/character-chat';

export function CharacterAvatar({ name, portrait }: { name: string; portrait?: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#ffd1de] bg-[#fff0f4] text-sm font-bold text-[#c9587c] shadow-sm">
      {portrait ? <img src={portrait} alt="" className="h-full w-full object-cover" /> : name.slice(0, 1)}
    </div>
  );
}

interface CharacterChatMessageProps {
  message: CharacterChatMessageData;
  personaName: string;
  portrait?: string;
  userPersonaName: string;
  isEditing: boolean;
  editingText: string;
  disabled: boolean;
  canRegenerate: boolean;
  onEditingTextChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onPin: () => void;
  onBranch: () => void;
  onRewind: () => void;
  onRegenerate: () => void;
}

export function RoleplayContent({
  content,
  blocks,
}: {
  content: string;
  blocks?: CharacterChatMessageBlock[];
}) {
  const visibleBlocks = blocks?.length ? blocks : parseRoleplayResponse(content).blocks;
  return (
    <div className="space-y-2.5">
      {visibleBlocks.map((block, index) => block.type === 'narration' ? (
        <p key={`${block.type}-${index}`} className="rounded-md border-l-2 border-[#ef8fab] bg-[#fff2f6] px-3 py-2 text-[13px] italic leading-6 text-[#876d77]">
          {block.text}
        </p>
      ) : (
        <p key={`${block.type}-${index}`} className="whitespace-pre-wrap text-[15px] font-medium leading-7 text-[#45353c]">
          {block.text}
        </p>
      ))}
    </div>
  );
}

export function EmotionBadge({ emotion }: { emotion: CharacterChatEmotion }) {
  return (
    <span className="rounded-full border border-white/70 bg-white/[0.85] px-2.5 py-1 text-[11px] font-bold text-[#c55378] shadow-sm backdrop-blur-sm">
      {getEmotionLabel(emotion)}
    </span>
  );
}

export function CharacterChatMessage(props: CharacterChatMessageProps) {
  const { message } = props;
  const isUser = message.role === 'user';
  return (
    <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && <CharacterAvatar name={props.personaName} portrait={props.portrait} />}
      <div className={`group flex max-w-[88%] flex-col sm:max-w-[84%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`mb-1 text-[11px] font-bold ${isUser ? 'text-[#d05b80]' : 'text-[#a76a7d]'}`}>
          {isUser ? props.userPersonaName : props.personaName}
        </div>
        <div className={`${
          isUser
            ? 'rounded-md bg-[#ec668f] px-4 py-3 text-sm leading-7 text-white shadow-sm'
            : 'rounded-md border border-[#f0dce3] bg-white px-4 py-3 text-[#55434b] shadow-sm'
        }`}>
          {props.isEditing ? (
            <div className="min-w-64">
              <textarea
                aria-label="메시지 수정"
                value={props.editingText}
                onChange={(event) => props.onEditingTextChange(event.target.value)}
                rows={3}
                className="w-full resize-y rounded-md border border-[#e3c3ce] bg-white p-2 text-[#44363d] outline-none focus:border-[#ef7fa2]"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={props.onCancelEdit} className="text-xs text-[#a58c96]">취소</button>
                <button type="button" onClick={props.onSaveEdit} className="text-xs font-semibold text-[#3f8b76]">수정 후 이어가기</button>
              </div>
            </div>
          ) : (
            isUser
              ? <p className="whitespace-pre-wrap">{message.content}</p>
              : <RoleplayContent content={message.content} blocks={message.blocks} />
          )}
        </div>
        {!props.isEditing && (
          <div className={`mt-1 flex items-center gap-0.5 ${isUser ? 'justify-end' : ''}`}>
            {message.isPinned && <PinIcon className="mr-1 h-3.5 w-3.5 text-amber-500" />}
            {isUser && (
              <button type="button" onClick={props.onStartEdit} disabled={props.disabled} className="rounded p-1.5 text-[#b9a3ab] hover:bg-[#fff0f4] hover:text-[#9f4563]" title="수정 후 여기서 이어가기">
                <PencilIcon className="h-3.5 w-3.5" />
              </button>
            )}
            {!isUser && props.canRegenerate && (
              <button type="button" onClick={props.onRegenerate} disabled={props.disabled} className="rounded p-1.5 text-[#b9a3ab] hover:bg-[#eaf8f3] hover:text-[#3f8b76]" title="응답 재생성">
                <ArrowPathIcon className="h-3.5 w-3.5" />
              </button>
            )}
            <button type="button" onClick={props.onPin} disabled={props.disabled} className="rounded p-1.5 text-[#b9a3ab] hover:bg-[#fff7d9] hover:text-amber-600" title={message.isPinned ? '고정 해제' : '중요 기억으로 고정'}>
              <PinIcon className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={props.onBranch} disabled={props.disabled} className="rounded p-1.5 text-[#b9a3ab] hover:bg-sky-50 hover:text-sky-600" title="이 지점에서 대화 분기">
              <DocumentDuplicateIcon className="h-3.5 w-3.5" />
            </button>
            <button type="button" onClick={props.onRewind} disabled={props.disabled} className="rounded p-1.5 text-[#b9a3ab] hover:bg-red-50 hover:text-red-500" title="여기까지 되돌리기">
              <ClockIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
