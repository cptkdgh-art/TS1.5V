import { describe, expect, it } from 'vitest';
import { constrainRoleplayTurn, formatRoleplayMessage, parseRoleplayResponse } from './roleplay';

describe('parseRoleplayResponse', () => {
  it('감정, 지문, 대사를 순서대로 구조화한다', () => {
    const parsed = parseRoleplayResponse('[표정:당황]\n*그녀가 시선을 피한다.*\n“그런 뜻은 아니었어.”');

    expect(parsed.emotion).toBe('shy');
    expect(parsed.blocks).toEqual([
      { type: 'narration', text: '그녀가 시선을 피한다.' },
      { type: 'dialogue', text: '그런 뜻은 아니었어.' },
    ]);
    expect(parsed.content).toBe('그녀가 시선을 피한다.\n\n그런 뜻은 아니었어.');
  });

  it('한 문단 안의 지문과 대사를 모두 보존한다', () => {
    const parsed = parseRoleplayResponse('*문을 연다.* "기다렸어?" *작게 웃는다.*');

    expect(parsed.blocks.map((block) => block.type)).toEqual(['narration', 'dialogue', 'narration']);
    expect(parsed.blocks.map((block) => block.text)).toEqual(['문을 연다.', '기다렸어?', '작게 웃는다.']);
  });

  it('형식이 없는 응답은 대사로 안전하게 표시한다', () => {
    const parsed = parseRoleplayResponse('응, 네 이야기를 듣고 있어.');

    expect(parsed.emotion).toBe('neutral');
    expect(parsed.blocks).toEqual([{ type: 'dialogue', text: '응, 네 이야기를 듣고 있어.' }]);
  });

  it('스트리밍 중 미완성 표정 태그는 사용자에게 노출하지 않는다', () => {
    expect(parseRoleplayResponse('[표정:다')).toMatchObject({ content: '', blocks: [] });
  });
});

describe('formatRoleplayMessage', () => {
  it('구조화된 메시지를 모델이 구분할 수 있는 기록으로 만든다', () => {
    expect(formatRoleplayMessage({
      id: 'reply',
      role: 'assistant',
      content: '문을 닫는다.\n\n이제 말해.',
      emotion: 'tense',
      blocks: [
        { type: 'narration', text: '문을 닫는다.' },
        { type: 'dialogue', text: '이제 말해.' },
      ],
      createdAt: 1,
    })).toBe('[표정:긴장]\n*문을 닫는다.*\n“이제 말해.”');
  });
});

describe('constrainRoleplayTurn', () => {
  it('한 턴에 대사 하나와 짧은 반응만 남긴다', () => {
    const parsed = constrainRoleplayTurn(parseRoleplayResponse(
      '[표정:다정]\n*고개를 든다.*\n“왔어?”\n*조금 가까이 다가간다.*\n“오늘은 어땠어?”\n*창밖을 본다.*'
    ));

    expect(parsed.blocks).toEqual([
      { type: 'narration', text: '고개를 든다.' },
      { type: 'dialogue', text: '왔어?' },
      { type: 'narration', text: '조금 가까이 다가간다.' },
    ]);
  });

  it('지나치게 긴 응답을 문장 경계에서 제한한다', () => {
    const parsed = constrainRoleplayTurn(parseRoleplayResponse(`“${'긴 대사입니다. '.repeat(80)}”`));

    expect(parsed.content.length).toBeLessThanOrEqual(421);
    expect(parsed.blocks).toHaveLength(1);
  });
});
