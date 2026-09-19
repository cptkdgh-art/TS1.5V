import { describe, expect, it } from 'vitest';
import type { AiAuthor, Novel, Series } from '@core/types';
import { COMMON_PROSE_GUARDRAILS } from '@core/laws';
import {
  buildWriterDynamicInstruction,
  buildWriterStableInstruction,
  buildWriterSystemInstruction,
  DIRECTOR_CLIO_INSTRUCTION,
} from './prompts';
import { createLegacyAuthorIdentityCore } from './authorIdentity';

const author: AiAuthor = {
  id: 'author-1',
  name: '느린빛',
  specialty: '심리 서사',
  writingStyle: '긴 호흡과 절제된 대화',
  coreDirectives: '감정을 설명하지 말고 행동으로 드러낸다.',
  memoryCache: ['침묵을 성급하게 대사로 채우지 않는다.'],
  createdAt: 1,
};

const novel: Novel = {
  id: 'novel-1', title: '테스트', subject: '현대극', mood: '잔잔함', plotSummary: '두 사람이 다시 만난다.',
  chapters: [], history: [], createdAt: 1, aiAuthorId: author.id, characters: [],
  authorMemoryByAuthor: { [author.id]: ['이 작품에서는 건조한 3인칭 관찰자 시점을 유지한다.'] },
};

describe('buildWriterSystemInstruction author priority', () => {
  it('연결된 권 청사진을 작품 설계도 위에 덮지 않고 추가 계획으로 주입한다', () => {
    const series: Series = {
      id: 'series-1', title: '연대기', seriesPlotSummary: '전체 여정', characters: [],
      novelIds: [novel.id], createdAt: 1,
      blueprint: {
        worldview: '모든 문은 기억을 대가로 열린다.', mainConflict: '왕국과 귀환자의 대립',
        characterArcs: '주인공은 복수보다 공동체를 선택한다.', lastUpdated: 1,
        volumes: [{
          id: 'volume-3', volumeNumber: 3, displayLabel: '제3부 귀환', title: '귀환',
          localSetting: '겨울 수도와 폐쇄된 성문', goal: '고향으로 돌아간다',
          mainConflict: '왕위 계승', keyEvents: '성문 전투',
          status: 'drafting', linkedNovelId: novel.id,
        }],
      },
    };
    const mappedNovel = { ...novel, seriesId: series.id, seriesVolumeId: 'volume-3', volumeNumber: 3 };

    const output = buildWriterSystemInstruction(author, mappedNovel, series, { chapterCount: 0 });

    expect(output).toContain('**VOLUME:** 제3부 귀환');
    expect(output).toContain('[연결된 권 청사진: 제3부 귀환]');
    expect(output).toContain('[시리즈 공통 청사진: 전 권 공통]');
    expect(output).toContain('모든 문은 기억을 대가로 열린다.');
    expect(output).toContain('권 전용 설정·변주: 겨울 수도와 폐쇄된 성문');
    expect(output).toContain('권 목표: 고향으로 돌아간다');
    expect(output).toContain('주요 갈등: 왕위 계승');
    expect(output).toContain('핵심 사건: 성문 전투');
    expect(output).toContain('덮어쓰지 않고');
  });

  it('AI 작가 정체성 코어와 각인 기억을 일반 가독성 보조보다 우선한다고 명시한다', () => {
    const output = buildWriterSystemInstruction(author, novel, null, { chapterCount: 0 });

    expect(output).toContain('[최우선 집필 권한: AI 작가]');
    expect(output).toContain(author.writingStyle);
    expect(output).toContain(author.coreDirectives);
    expect(output).toContain(author.memoryCache![0]);
    expect(output).toContain('작가의 내면과 작품관');
    expect(output).toContain('가독성을 실천하는 방식');
    expect(output).not.toContain(novel.authorMemoryByAuthor![author.id][0]);
    expect(output.startsWith('--- [최우선 집필 권한: AI 작가] ---')).toBe(true);
    expect(output.indexOf('[최우선 집필 권한: AI 작가]')).toBeLessThan(output.indexOf('[가독성·속도·호흡]'));
  });

  it('선택한 장르·부장르·주제를 참고 정보로 전달하고 작가 개성을 덮지 않는다', () => {
    const classifiedNovel: Novel = {
      ...novel,
      primaryGenre: '현대판타지',
      subgenres: ['헌터', '직업물'],
      themes: ['성장', '선택과 대가'],
      subject: '퇴사한 헌터가 낡은 여관을 되살린다.',
      mood: '따뜻한, 긴장감 | 사건 장면은 서늘하게',
    };
    const output = buildWriterSystemInstruction(author, classifiedNovel, null, { chapterCount: 0 });

    expect(output).toContain('주 장르: 현대판타지');
    expect(output).toContain('부 장르: 헌터, 직업물');
    expect(output).toContain('주제: 성장, 선택과 대가');
    expect(output).toContain('주제·소재 추가 설명: 퇴사한 헌터가 낡은 여관을 되살린다.');
    expect(output).toContain('분위기: 따뜻한, 긴장감 | 사건 장면은 서늘하게');
    expect(output).toContain('장르 공식을 강제하지 않습니다');
    expect(output.indexOf('[최우선 집필 권한: AI 작가]')).toBeLessThan(output.indexOf('주 장르: 현대판타지'));
  });

  it('작가 목소리를 보존하면서 작품 내부 개연성과 문장 절제를 공통 원칙으로 둔다', () => {
    const output = buildWriterSystemInstruction(author, novel, null, { chapterCount: 0 });

    expect(output).toContain('[개연성과 문장 절제]');
    expect(output).toContain('제1원칙: 모든 사건, 행동, 감정, 공간 이동');
    expect(output).toContain('작품이 세운 설정과 장르적 전제 안에서');
    expect(output).toContain('수식어와 추상명사를 겹쳐 다시 총평하지');
    expect(output).toContain('구체적인 명사와 정확한 동작을 우선');
    expect(output).toContain('작가 문체에 자연스러운 직접적인 감정 표현');
    COMMON_PROSE_GUARDRAILS.forEach((rule) => expect(output).toContain(rule));
    expect(output).not.toContain('감정을 직접 명명하지 않는다');
    expect(output.indexOf('[최우선 집필 권한: AI 작가]')).toBeLessThan(output.indexOf('[개연성과 문장 절제]'));
  });

  it('작품별 작가 기억을 작가 정체성에 주입하지 않는다', () => {
    const workMemory = novel.authorMemoryByAuthor![author.id][0];
    const output = buildWriterSystemInstruction(author, novel, null, { chapterCount: 0 });

    expect(output).not.toContain(workMemory);
  });

  it('작품 설정과 무관한 성인 연령을 일반 집필에 강제하지 않는다', () => {
    const output = buildWriterSystemInstruction(author, novel, null, { chapterCount: 0 });

    expect(output).not.toContain('모든 등장인물은 20세 이상의 성인');
  });

  it('사용자가 저장한 연출 지침을 인물과 세계관보다 먼저 배치한다', () => {
    const directedNovel: Novel = {
      ...novel,
      writingDirectives: [{ role: 'user', parts: [{ text: '이번 작품은 끝까지 제한적 3인칭을 유지한다.' }] }],
      characters: [{ id: 'character-1', name: '윤서', personality: '신중하다.', background: '', appearance: '', log: '' }],
      worldviewFiles: [{ filename: '도시.txt', content: '밤에는 통행이 금지된다.' }],
    };
    const output = buildWriterSystemInstruction(author, directedNovel, null, { chapterCount: 0 });

    expect(output.indexOf('이번 작품은 끝까지 제한적 3인칭을 유지한다.')).toBeLessThan(output.indexOf('윤서'));
    expect(output.indexOf('이번 작품은 끝까지 제한적 3인칭을 유지한다.')).toBeLessThan(output.indexOf('밤에는 통행이 금지된다.'));
  });

  it('기록보관자 모드에서도 기본 세계관을 유지하고 존재하지 않는 도구 호출을 요구하지 않는다', () => {
    const lorekeeperNovel: Novel = {
      ...novel,
      useLorekeeper: true,
      worldviewFiles: [{ filename: '규칙.txt', content: '마법은 반드시 대가를 요구한다.' }],
    };
    const output = buildWriterSystemInstruction(author, lorekeeperNovel, null, {
      chapterCount: 0,
      useLorekeeper: true,
    });

    expect(output).toContain('마법은 반드시 대가를 요구한다.');
    expect(output).not.toContain('ask_lorekeeper');
    expect(output).toContain('기록보관자 브리핑');
  });

  it('기존 작품에 기록보관자 값이 없어도 기본 활성화한다', () => {
    const output = buildWriterSystemInstruction(author, novel, null, { chapterCount: 0 });

    expect(output).toContain('[기록보관자 협업 모드]');
  });

  it('사용자가 기록보관자를 명시적으로 끄면 협업 지시를 제외한다', () => {
    const output = buildWriterSystemInstruction(author, novel, null, {
      chapterCount: 0,
      useLorekeeper: false,
    });

    expect(output).not.toContain('[기록보관자 협업 모드]');
  });

  it('사용자가 고르지 않은 강제 초반 훅과 절단 지침을 넣지 않는다', () => {
    const output = buildWriterSystemInstruction(author, novel, null, { chapterCount: 0 });

    expect(output).not.toContain('절단마공');
    expect(output).not.toContain('다음 화가 궁금해서 미칠 것');
    expect(output).not.toContain('초반 승부처');
  });

  it('명시적으로 선택한 1화 시작 방식만 보조한다', () => {
    const output = buildWriterSystemInstruction(author, novel, null, {
      chapterCount: 0,
      openingStyle: 'buildup',
      startingPoint: 'daily',
    });

    expect(output).toContain('[사용자가 선택한 1화 시작 방식]');
    expect(output).toContain('천천히 분위기를 쌓아라');
  });
});

describe('buildWriterSystemInstruction chapter controls', () => {
  it('회차가 바뀌어도 고정 캐시 문맥은 같고 회차 지시만 달라진다', () => {
    const firstOptions = {
      chapterCount: 0,
      episodePacing: { isEnabled: true, goal: '첫 단서를 발견한다.', speed: 'slow' as const },
      episodeArc: {
        chaptersCount: 0,
        episodeArc: {
          startChapterIndex: 0,
          chapters: [{ goal: '문을 연다.', keyEvents: '열쇠를 찾는다.', pacing: 'slow' as const, cliffhanger: '문 안에서 소리가 난다.' }],
        },
      },
    };
    const secondOptions = {
      chapterCount: 1,
      episodePacing: { isEnabled: true, goal: '추격을 시작한다.', speed: 'fast' as const },
      episodeArc: {
        chaptersCount: 1,
        episodeArc: {
          startChapterIndex: 0,
          chapters: [
            { goal: '문을 연다.', keyEvents: '열쇠를 찾는다.', pacing: 'slow' as const, cliffhanger: '문 안에서 소리가 난다.' },
            { goal: '범인을 쫓는다.', keyEvents: '골목으로 달린다.', pacing: 'fast' as const, cliffhanger: '가면이 벗겨진다.' },
          ],
        },
      },
    };

    const firstStable = buildWriterStableInstruction(author, novel, null, firstOptions);
    const secondStable = buildWriterStableInstruction(author, novel, null, secondOptions);
    const firstDynamic = buildWriterDynamicInstruction(novel, firstOptions);
    const secondDynamic = buildWriterDynamicInstruction(novel, secondOptions);

    expect(firstStable).toBe(secondStable);
    expect(firstStable).not.toContain('첫 단서를 발견한다.');
    expect(firstStable).not.toContain('추격을 시작한다.');
    expect(firstDynamic).toContain('문을 연다.');
    expect(secondDynamic).toContain('범인을 쫓는다.');
    expect(firstDynamic).not.toBe(secondDynamic);
  });

  it('에피소드 설계도가 있어도 사용자가 고른 문장 호흡을 함께 적용한다', () => {
    const output = buildWriterSystemInstruction(author, novel, null, {
      chapterCount: 0,
      episodeArc: {
        chaptersCount: 0,
        episodeArc: {
          startChapterIndex: 0,
          chapters: [{
            goal: '두 사람이 재회한다.',
            keyEvents: '닫힌 역에서 마주친다.',
            pacing: 'fast',
            cliffhanger: '상대가 먼저 이름을 부른다.',
          }],
        },
      },
      episodePacing: { isEnabled: true, goal: '', speed: 'slow' },
    });

    expect(output).toContain('[에피소드 설계도 적용]');
    expect(output).toContain('[사용자 선택 문장 호흡]');
    expect(output).toContain('느린 호흡');
    expect(output).toContain('목표가 비어 있어도');
  });

  it('빠른 문장 호흡을 사건 요약이 아닌 문장과 문단 운용으로 설명한다', () => {
    const output = buildWriterSystemInstruction(author, novel, null, {
      chapterCount: 0,
      episodePacing: { isEnabled: true, goal: '추격 장면을 끝낸다.', speed: 'fast' },
    });

    expect(output).toContain('빠른 호흡');
    expect(output).toContain('짧거나 중간 길이의 문장');
    expect(output).toContain('추격 장면을 끝낸다.');
    expect(output).toContain('[여러 회차 집필 집중]');
  });

  it('목표 달성까지 집중은 여러 화의 방향으로 전달하고 한 화 강제 완결을 막는다', () => {
    const output = buildWriterSystemInstruction(author, novel, null, {
      chapterCount: 4,
      episodePacing: {
        isEnabled: true,
        goal: '재단에 대한 작은 위화감을 확실한 의심으로 키운다.',
        destination: '주인공이 제한 구역을 직접 확인하기로 결심한다.',
        scope: 'until-complete',
        speed: 'normal',
      },
    });

    expect(output).toContain('[여러 회차 집필 집중]');
    expect(output).toContain('재단에 대한 작은 위화감');
    expect(output).toContain('주인공이 제한 구역을 직접 확인');
    expect(output).toContain('이번 한 화에서 억지로 완결하지');
    expect(output).not.toContain('[다음 1화 집필 집중]');
  });

  it('다음 1화만 집중은 현재 회차의 직접 목표로 전달한다', () => {
    const output = buildWriterSystemInstruction(author, novel, null, {
      chapterCount: 4,
      episodePacing: {
        isEnabled: true,
        goal: '추격 끝에 범인을 놓친다.',
        destination: '',
        scope: 'next-chapter',
        speed: 'fast',
      },
    });

    expect(output).toContain('[다음 1화 집필 집중]');
    expect(output).toContain('이번 회차 목표: 추격 끝에 범인을 놓친다.');
    expect(output).not.toContain('[여러 회차 집필 집중]');
  });

  it('반복 방지를 켜면 되풀이 기준과 필요한 회상의 예외를 함께 전달한다', () => {
    const output = buildWriterSystemInstruction(author, novel, null, {
      chapterCount: 2,
      avoidRepetition: true,
    });

    expect(output).toContain('[반복 서사 방지]');
    expect(output).toContain('이미 해결된 장면');
    expect(output).toContain('관계, 정보, 결정, 결과');
    expect(output).toContain('필요한 회상');
  });

  it('회차 목표 글자 수를 조기 종료를 막는 실제 출력 지시로 전달한다', () => {
    const longChapterNovel = {
      ...novel,
      chapterTargetCharacters: 12000,
      maxTokens: 32768,
    } as Novel;
    const output = buildWriterSystemInstruction(author, longChapterNovel, null, {
      chapterCount: 0,
    });

    expect(output).toContain('[이번 회차 출력 분량]');
    expect(output).toContain('12,000자');
    expect(output).not.toContain('API 최대 출력 상한');
    expect(output).toContain('같은 내용을 반복해서 분량을 채우지');
    expect(output).toContain('목표 분량을 넘더라도');
    expect(output).toContain('현재 응답 턴을 중간에 끊지');
  });

  it('자율 한 턴은 숫자 분량 압박 없이 지시한 장면의 자연스러운 끝을 요구한다', () => {
    const output = buildWriterSystemInstruction(author, {
      ...novel,
      targetedGenerationEnabled: false,
      chapterGenerationMode: 'batch3',
      chapterTargetCharacters: 15000,
    } as Novel, null, { chapterCount: 0 });

    expect(output).toContain('[자율 한 턴 집필]');
    expect(output).toContain('한 번의 응답');
    expect(output).toContain('자연스럽게 닫히는 지점');
    expect(output).not.toContain('[이번 회차 출력 분량]');
    expect(output).not.toContain('15,000자');
  });
});

describe('Director Clio structured author proposals', () => {
  it('작가 설계안을 실행 가능한 JSON 데이터로 함께 반환하도록 요구한다', () => {
    const output = DIRECTOR_CLIO_INSTRUCTION({
      authorProposals: [{
        schemaVersion: 2,
        id: 'proposal-1',
        createdAt: 1,
        afterMessageIndex: 1,
        sourceNovelId: novel.id,
        name: '느린빛 변주',
        specialty: '관계 미스터리',
        writingStyle: '절제된 3인칭',
        coreDirectives: '선택의 결과를 남긴다.',
        tags: ['미스터리'],
        identityCore: createLegacyAuthorIdentityCore(author),
      }],
    });

    expect(output).toContain('"authorProposal": null');
    expect(output).toContain('새로운 맞춤 작가의 완성된 프로필');
    expect(output).toContain('"schemaVersion": 2');
    expect(output).toContain('"identityCore"');
    expect(output).toContain('작품에서 얻은 적응이나 기억을 identityCore에 넣지 마세요');
    expect(output).toContain('[느린빛 변주]');
  });
});
