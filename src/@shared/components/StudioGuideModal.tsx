/**
 * ============================================================
 * @module shared/components
 * @file StudioGuideModal.tsx
 * ============================================================
 * @description 스튜디오 사용 가이드 모달
 * ============================================================
 */

import { useState } from 'react';
import {
  XMarkIcon,
  PencilIcon,
  GlobeAltIcon,
  UserGroupIcon,
  WandSparklesIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  BookOpenIcon,
  InformationCircleIcon,
  EyeIcon,
  ChatBubbleThoughtIcon,
  ChevronDownIcon,
  LightBulbIcon,
  ExclamationTriangleIcon,
} from './Icons';

interface AccordionItemProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function AccordionItem({ title, icon, children }: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-gray-700">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center text-left p-4 hover:bg-gray-700/50"
      >
        <div className="flex items-center gap-3">
          <span className="text-indigo-400">{icon}</span>
          <span className="font-semibold text-white">{title}</span>
        </div>
        <ChevronDownIcon
          className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="p-4 pt-0 prose prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-strong:text-gray-200 text-gray-300">
          {children}
        </div>
      </div>
    </div>
  );
}

function TipBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 p-4 bg-teal-900/50 rounded-lg border border-teal-700">
      <div className="flex items-start gap-3">
        <LightBulbIcon className="w-5 h-5 text-teal-400 shrink-0 mt-1" />
        <div>
          <h5 className="font-bold text-teal-300">꿀팁</h5>
          <div className="text-sm text-teal-200">{children}</div>
        </div>
      </div>
    </div>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 p-4 bg-yellow-900/50 rounded-lg border border-yellow-700">
      <div className="flex items-start gap-3">
        <ExclamationTriangleIcon className="w-5 h-5 text-yellow-400 shrink-0 mt-1" />
        <div>
          <h5 className="font-bold text-yellow-300">중요</h5>
          <div className="text-sm text-yellow-200">{children}</div>
        </div>
      </div>
    </div>
  );
}

const guideSections = [
  {
    id: 'intro',
    title: '시작하기',
    icon: <BookOpenIcon className="w-5 h-5" />,
    content: () => (
      <>
        <h3 className="text-2xl font-bold text-indigo-400 mb-4">진폭 스튜디오에 오신 것을 환영합니다!</h3>
        <p>이곳은 당신의 창의적인 아이디어를 진폭과 함께 장편 소설로 발전시키는 공간입니다. AI는 단순한 글쓰기 도구를 넘어, 당신의 설정과 문체를 학습하는 동료 작가가 되어줍니다. 왼쪽 목차를 따라 스튜디오의 모든 기능을 활용하여 당신만의 대서사를 완성해보세요.</p>
      </>
    ),
  },
  {
    id: 'workflow',
    title: '추천 작업 흐름',
    icon: <ClipboardDocumentListIcon className="w-5 h-5" />,
    content: () => (
      <>
        <h3 className="text-2xl font-bold text-indigo-400 mb-4">추천 작업 흐름</h3>
        <p>소설 집필은 마라톤과 같습니다. 아래 추천 흐름을 따라 스튜디오의 기능들을 단계별로 활용해보세요.</p>
        <div className="mt-4 border-t border-gray-700">
          <AccordionItem title="1. 아이디어 구체화" icon={<LightBulbIcon className="w-5 h-5" />}>
            <p>'새 소설' 버튼으로 소설의 핵심 아이디어(제목, 장르, 분위기, 줄거리)를 입력합니다. 이 정보는 AI가 소설의 큰 그림을 이해하는 기초가 됩니다.</p>
          </AccordionItem>
          <AccordionItem title="2. 초기 챕터 집필" icon={<PencilIcon className="w-5 h-5" />}>
            <p>'집필 화면 & 제어 패널'을 사용해 첫 챕터들을 써내려갑니다. 막히는 부분은 '실시간 협업' 채팅으로 AI와 대화하며 아이디어를 구체화하세요.</p>
          </AccordionItem>
          <AccordionItem title="3. 설정 구체화 (3~5챕터 진행 후)" icon={<UserGroupIcon className="w-5 h-5" />}>
            <p>상단 탭에서 '등장인물'과 '세계관'을 정리합니다. <strong>'본문에서 분석'</strong> 기능을 사용하면 AI가 자동으로 등장인물을 찾아주거나, 흩어진 세계관 설정을 추출해줍니다. 이 정보는 이후 집필의 일관성을 유지하는 데 매우 중요합니다.</p>
          </AccordionItem>
          <AccordionItem title="4. 중반부 전개" icon={<GlobeAltIcon className="w-5 h-5" />}>
            <p>소설이 길어지면 '세계관' 탭에서 <strong>'기록보관자 AI'</strong>를 활성화하여 설정 충돌을 방지하고, '캐시 센터'에서 <strong>'문맥 요약 시스템'</strong>을 켜서 AI가 이전 내용을 기억하도록 돕습니다. '에피소드 기획실'을 사용하면 체계적인 플롯 구성이 가능합니다.</p>
          </AccordionItem>
          <AccordionItem title="5. 후반부 및 퇴고" icon={<WandSparklesIcon className="w-5 h-5" />}>
            <p>소설의 스타일이 확립되면 '소설 설정' 탭의 <strong>'작가 진화'</strong> 기능으로 이 소설만의 맞춤형 AI 작가를 생성하여 후반부 집필의 일관성을 극대화할 수 있습니다. '분석' 탭에서 소설의 구조를 시각적으로 확인하고, <strong>'리라이팅'</strong> 기능으로 문장을 다듬으며 완성도를 높입니다.</p>
          </AccordionItem>
        </div>
      </>
    ),
  },
  {
    id: 'editor-panel',
    title: '집필 화면 & 제어 패널',
    icon: <PencilIcon className="w-5 h-5" />,
    content: () => (
      <>
        <h3 className="text-2xl font-bold text-indigo-400 mb-4">집필 화면 & 제어 패널</h3>
        <p>이곳이 당신의 주 작업 공간입니다. 왼쪽에는 챕터 본문이, 오른쪽에는 AI를 지휘하는 제어 패널이 있습니다.</p>
        <div className="mt-4 border-t border-gray-700">
          <AccordionItem title="소설 본문창 기능" icon={<BookOpenIcon className="w-5 h-5" />}>
            <p>작성된 모든 챕터가 표시됩니다. 각 챕터 제목 옆의 아이콘으로 다음 작업을 할 수 있습니다:</p>
            <ul>
              <li><strong>작가와 작업:</strong> AI 작가는 현재 회차를 먼저 읽고 왜 바꾸려는지 대화한 뒤 서로 다른 두 방향을 제안합니다. 한 방향을 선택할 때만 현재 회차를 수정하며, 필요하면 이전 회차와 설정을 찾아봅니다. 수정 이유와 전후 원고는 작업 기록에 보관되고 복원하거나 JSON·TXT로 따로 내보낼 수 있습니다.</li>
              <li><strong>직접 수정:</strong> AI가 쓴 내용을 포함하여 모든 텍스트를 자유롭게 수정할 수 있습니다. 당신이 최종 편집자입니다.</li>
              <li><strong>텍스트 선택 후 리라이팅:</strong> 본문의 특정 문장이나 단락을 마우스로 드래그하여 선택하면, 제어 패널의 '리라이팅' 버튼이 활성화됩니다. 이를 통해 AI에게 다양한 스타일로 문장을 다시 써달라고 요청할 수 있습니다.</li>
            </ul>
          </AccordionItem>
          <AccordionItem title="AI 작가 제어 패널" icon={<WandSparklesIcon className="w-5 h-5" />}>
            <p>AI의 글쓰기 방식을 정교하게 제어하는 조종석입니다.</p>
            <ul>
              <li><strong>실시간 협업:</strong> AI 작가와 빠르게 아이디어를 주고받는 채팅 공간입니다. 여기서 나온 AI의 좋은 제안은 '이 아이디어 채택' 버튼을 눌러 <strong>'확정된 지시사항'</strong>으로 만들 수 있습니다.</li>
              <li><strong>에피소드 기획:</strong> 여러 챕터에 걸친 하나의 큰 이야기 묶음(에피소드)을 설계합니다. 챕터별 목표, 핵심 사건, 전개 속도, 클리프행어까지 계획하면 AI는 이 설계도에 따라 글을 씁니다.</li>
              <li><strong>집필 집중 모드:</strong> 다음 한 화만 적용할 목표 또는 여러 화에 걸쳐 유지할 전개 방향과 도달점을 정합니다. 상세 사건 설계는 기존 에피소드 기획에서 따로 관리합니다.</li>
              <li><strong>확정된 지시사항:</strong> 여기에 등록된 내용은 AI가 다음 글을 쓸 때 <strong>반드시 따라야 하는 규칙</strong>이 됩니다.</li>
              <li><strong>지시 입력창:</strong> '지시하며 이어쓰기' 버튼을 누를 때 AI에게 전달할 구체적인 명령입니다.</li>
              <li><strong>기능 버튼:</strong> 리라이팅, 다음 챕터 예고, 자연스럽게/지시하며 이어쓰기 등 핵심 AI 기능을 실행합니다.</li>
            </ul>
          </AccordionItem>
        </div>
      </>
    ),
  },
  {
    id: 'directing-room',
    title: '총괄 디렉팅 룸',
    icon: <ChatBubbleThoughtIcon className="w-5 h-5" />,
    content: () => (
      <>
        <h3 className="text-2xl font-bold text-indigo-400 mb-4">총괄 디렉팅 룸</h3>
        <p>이곳은 소설의 큰 그림을 논의하는 전략 회의실입니다. 각 챕터의 세부 내용이 아닌, 소설 전체의 방향성에 대해 AI '총괄 디렉터'와 대화합니다.</p>
        <div className="mt-4 border-t border-gray-700">
          <AccordionItem title="무엇을 할 수 있나요?" icon={<InformationCircleIcon className="w-5 h-5" />}>
            <p>앞으로의 플롯 전개, 캐릭터의 성장 방향, 복선 회수, 설정 충돌 해결 등 소설의 전체적인 구조에 대해 질문하고 조언을 얻을 수 있습니다.</p>
          </AccordionItem>
          <AccordionItem title="'확정 지시사항'으로 채택하기" icon={<WandSparklesIcon className="w-5 h-5" />}>
            <p>디렉터가 제안한 뛰어난 아이디어나 플롯은 '이 아이디어를 채택' 버튼을 눌러 모든 집필 과정에 영향을 미치는 강력한 규칙인 '확정된 지시사항'으로 만들 수 있습니다.</p>
          </AccordionItem>
        </div>
      </>
    ),
  },
  {
    id: 'reading-room',
    title: '독자 모드로 보기',
    icon: <EyeIcon className="w-5 h-5" />,
    content: () => (
      <>
        <h3 className="text-2xl font-bold text-indigo-400 mb-4">독자 모드로 보기</h3>
        <p>집필 화면에서 벗어나, 오직 이야기에만 몰입할 수 있는 독자 전용 공간입니다. 전자책처럼 편안하게 자신의 작품을 감상하며 전체적인 흐름을 점검할 수 있습니다.</p>
        <div className="mt-4 border-t border-gray-700">
          <AccordionItem title="몰입형 인터페이스" icon={<BookOpenIcon className="w-5 h-5" />}>
            <p>모든 편집 기능이 사라지고 오직 소설 내용만 표시되어 독자의 시선으로 작품을 검토할 수 있습니다.</p>
          </AccordionItem>
          <AccordionItem title="작가의 회고 요청" icon={<ChatBubbleThoughtIcon className="w-5 h-5" />}>
            <p>특정 챕터를 다 읽은 후 '작가의 회고 요청' 버튼을 누르면, AI 작가가 해당 지점까지의 스토리에 대한 자신의 창작 의도, 숨겨진 의미, 캐릭터에 대한 감상 등을 담은 '작품 해설'을 생성해줍니다. 이를 통해 새로운 영감을 얻거나 이야기의 깊이를 더할 수 있습니다.</p>
          </AccordionItem>
        </div>
      </>
    ),
  },
  {
    id: 'author-management',
    title: 'AI 작가 관리',
    icon: <UserGroupIcon className="w-5 h-5" />,
    content: () => (
      <>
        <h3 className="text-2xl font-bold text-indigo-400 mb-4">AI 작가 관리</h3>
        <p>AI 작가는 단순한 봇이 아닌, 고유한 전문 분야와 문체를 가진 당신의 글쓰기 파트너입니다. 메인 화면의 'AI 작가 관리' 페이지에서 이들을 관리하고 새로운 작가를 영입할 수 있습니다.</p>
        <div className="mt-4 border-t border-gray-700">
          <AccordionItem title="다양한 작가 영입 방법" icon={<UserGroupIcon className="w-5 h-5" />}>
            <ul>
              <li><strong>새 작가 추가:</strong> 당신이 직접 이름, 전문 분야, 문체, 핵심 지시사항 등을 정의하여 완전히 새로운 작가를 만듭니다.</li>
              <li><strong>텍스트로 작가 생성:</strong> 기존에 써둔 소설이나 좋아하는 작가의 글(.txt)을 업로드하면, AI가 문체를 분석하여 비슷한 스타일의 작가를 생성합니다.</li>
              <li><strong>AI 작가 추천받기:</strong> 원하는 장르나 키워드를 입력하면 AI가 독창적인 컨셉의 작가를 추천해줍니다.</li>
              <li><strong>작가 융합:</strong> 2명 이상의 작가를 선택하여 그들의 장점을 결합한 새로운 작가를 탄생시킵니다. '가중치'를 조절하여 특정 작가의 스타일을 더 강하게 반영할 수도 있습니다.</li>
            </ul>
          </AccordionItem>
        </div>
      </>
    ),
  },
  {
    id: 'manuscript-lab',
    title: '외부 소설 이어쓰기',
    icon: <WandSparklesIcon className="w-5 h-5" />,
    content: () => (
      <>
        <h3 className="text-2xl font-bold text-indigo-400 mb-4">외부 소설 이어쓰기</h3>
        <p>스튜디오 밖에서 쓰던 소설이나, 다른 곳에서 가져온 텍스트를 AI와 함께 이어서 쓰고 싶을 때 사용하는 기능입니다. 메인 화면의 '외부 소설 이어쓰기' 버튼을 클릭하면 '원고 분석실'로 이동합니다.</p>
        <div className="mt-4 border-t border-gray-700">
          <AccordionItem title="원고 분석실 작동 방식" icon={<ClipboardDocumentListIcon className="w-5 h-5" />}>
            <ol className="list-decimal list-inside space-y-2">
              <li><strong>원고 업로드:</strong> 가지고 있는 소설 텍스트 파일(.txt)을 업로드합니다. 여러 파일이라면 순서를 드래그하여 맞출 수 있습니다.</li>
              <li><strong>AI 자동 분석:</strong> '원고 분석하기'를 누르면 AI가 전체 내용을 읽고 소설의 제목, 줄거리, 등장인물, 그리고 챕터까지 자동으로 구조화하여 정리합니다.</li>
              <li><strong>전용 작가 생성:</strong> 동시에 AI가 원고의 문체를 분석하여, 그 소설만을 위한 맞춤형 AI 작가를 자동으로 생성해 배정합니다. (물론 기존 작가를 선택할 수도 있습니다.)</li>
            </ol>
          </AccordionItem>
        </div>
      </>
    ),
  },
  {
    id: 'character-analysis',
    title: '등장인물 분석',
    icon: <UserGroupIcon className="w-5 h-5" />,
    content: () => (
      <>
        <h3 className="text-2xl font-bold text-indigo-400 mb-4">등장인물 분석</h3>
        <p>'등장인물' 탭의 '본문에서 분석' 버튼을 통해 사용합니다. AI가 소설 전체를 스캔하여 두 가지 중요한 정보를 찾아냅니다.</p>
        <div className="mt-4 border-t border-gray-700">
          <AccordionItem title="새로운 인물 발견" icon={<UserGroupIcon className="w-5 h-5" />}>
            <p>본문에 등장하지만 아직 '등장인물' 탭에 등록되지 않은 인물들의 이름과 한 줄 요약을 자동으로 추출합니다. 버튼 클릭 한 번으로 간편하게 새 인물을 추가할 수 있습니다.</p>
          </AccordionItem>
          <AccordionItem title="기존 인물 성장 기록 제안" icon={<PencilIcon className="w-5 h-5" />}>
            <p>이미 등록된 인물에게 발생한 중요한 성격 변화나 사건을 감지하여, 해당 인물의 '성장 및 변화 기록'에 추가할 내용을 제안합니다. 이를 통해 캐릭터의 입체성을 쉽게 관리할 수 있습니다.</p>
          </AccordionItem>
        </div>
        <TipBox>
          <p>소설이 <strong>3~5챕터</strong> 정도 진행되어 주요 인물들의 성격과 관계가 어느 정도 드러나기 시작했을 때 사용하면 가장 효과적입니다.</p>
        </TipBox>
      </>
    ),
  },
  {
    id: 'worldview-analysis',
    title: '세계관 분석',
    icon: <GlobeAltIcon className="w-5 h-5" />,
    content: () => (
      <>
        <h3 className="text-2xl font-bold text-indigo-400 mb-4">세계관 분석</h3>
        <p>'세계관' 탭의 '본문에서 분석' 버튼을 통해 사용합니다. AI가 '세계관 고고학자'가 되어 소설 본문이라는 유적지에서 설정의 파편들을 발굴하고 체계적으로 정리합니다.</p>
        <div className="mt-4 border-t border-gray-700">
          <AccordionItem title="설정 자동 추출" icon={<ClipboardDocumentListIcon className="w-5 h-5" />}>
            <p>소설 속에 흩어져 있는 세계관 정보(고유명사, 지역, 마법 규칙, 역사적 사건 등)를 7가지 카테고리로 분류하여 추출합니다.</p>
          </AccordionItem>
          <AccordionItem title="파일로 저장" icon={<DocumentTextIcon className="w-5 h-5" />}>
            <p>분석 결과는 '세계관 라이브러리'에 TXT 파일로 즉시 저장하여, AI가 이후 집필에서 참고할 수 있는 공식 설정 자료로 활용할 수 있습니다.</p>
          </AccordionItem>
        </div>
      </>
    ),
  },
  {
    id: 'lorekeeper-cache',
    title: '기록보관자 & 캐시',
    icon: <DocumentTextIcon className="w-5 h-5" />,
    content: () => (
      <>
        <h3 className="text-2xl font-bold text-indigo-400 mb-4">기록보관자 & 캐시 센터</h3>
        <p>장편 소설의 일관성을 유지하고 API 비용을 최적화하는 가장 강력한 기능입니다.</p>
        <div className="mt-4 border-t border-gray-700">
          <AccordionItem title="기록보관자 (Lorekeeper) AI" icon={<WandSparklesIcon className="w-5 h-5" />}>
            <p>('세계관' 탭에서 활성화) 이 기능을 켜면, 글을 쓰는 AI 작가와 별개로, 오직 설정에 대해서만 답하는 '기록보관자' AI가 배정됩니다. 작가 AI는 설정이 궁금할 때마다 기록보관자에게 질문하여 정확한 정보만 얻으므로, <strong>설정 오류를 획기적으로 줄이고 API 비용을 크게 절약</strong>합니다.</p>
            <TipBox>이 기능은 장편 소설의 일관성을 위해 사용을 강력히 추천합니다.</TipBox>
          </AccordionItem>
          <AccordionItem title="캐시 센터" icon={<ClipboardDocumentListIcon className="w-5 h-5" />}>
            <p>AI의 기억 저장소입니다. '캐시 센터' 탭에서 내용을 직접 확인하고 수정할 수 있습니다.</p>
            <ul>
              <li><strong>문맥 요약 캐시:</strong> AI가 오래된 챕터의 내용을 잊지 않도록 핵심 사건들을 요약하여 저장합니다. 요약된 내용은 직접 편집하여 AI의 기억을 교정할 수 있습니다.</li>
              <li><strong>세계관 응답 캐시:</strong> '기록보관자'가 답변한 내용은 자동으로 캐시되어, 동일한 질문에 대해서는 API를 다시 호출하지 않고 즉시 답변하여 비용을 절약합니다. 답변 내용이 마음에 들지 않으면 직접 수정할 수 있습니다.</li>
            </ul>
          </AccordionItem>
        </div>
      </>
    ),
  },
  {
    id: 'author-evolution',
    title: '작가 진화',
    icon: <WandSparklesIcon className="w-5 h-5" />,
    content: () => (
      <>
        <h3 className="text-2xl font-bold text-indigo-400 mb-4">작가 진화 (스타일 분석)</h3>
        <p>'소설 설정' 탭의 '현재 스타일로 새 작가 만들기' 버튼으로 사용합니다. 현재까지 작성된 소설의 문체, 톤, 서사 구조를 AI가 학습하여, 이 소설만을 위한 전용 AI 작가를 새로 생성합니다.</p>
        <div className="mt-4 border-t border-gray-700">
          <AccordionItem title="왜 필요한가요?" icon={<InformationCircleIcon className="w-5 h-5" />}>
            <p>장편 소설의 후반부로 갈수록 초반의 톤을 잃기 쉽습니다. 진화된 작가를 사용하면 소설 전체의 스타일 일관성을 유지하는 데 매우 효과적입니다.</p>
          </AccordionItem>
          <AccordionItem title="새로운 자산이 됩니다" icon={<UserGroupIcon className="w-5 h-5" />}>
            <p>이렇게 생성된 작가는 'AI 작가 관리'에 저장되어, 다른 소설을 쓸 때도 고유한 스타일을 가진 작가로 활용할 수 있습니다.</p>
          </AccordionItem>
        </div>
      </>
    ),
  },
  {
    id: 'faq',
    title: 'FAQ',
    icon: <InformationCircleIcon className="w-5 h-5" />,
    content: () => (
      <>
        <h3 className="text-2xl font-bold text-indigo-400 mb-4">자주 묻는 질문 (FAQ)</h3>
        <div className="mt-4 border-t border-gray-700">
          <AccordionItem title="Q: AI를 사용하면 비용이 드나요?" icon={<InformationCircleIcon className="w-5 h-5" />}>
            <p>A: 네, 이 앱의 AI 기능은 Google Gemini API를 사용하며, 연결된 Google Cloud 계정에 비용이 청구될 수 있습니다.</p>
            <WarningBox>
              비용 관리를 위해 Google Cloud 콘솔에서 예산을 설정하는 것을 권장합니다. '기록보관자'나 '캐시 센터' 같은 최적화 기능을 적극적으로 사용하면 비용을 절약할 수 있습니다.
            </WarningBox>
          </AccordionItem>
          <AccordionItem title="Q: '기록보관자'와 그냥 세계관 파일 제공의 차이점은 무엇인가요?" icon={<InformationCircleIcon className="w-5 h-5" />}>
            <p>A: 그냥 파일을 제공하면 AI 작가가 매번 모든 내용을 읽어야 해서 비용이 많이 들고, 때로는 내용을 잘못 해석하거나 상상해서 지어낼 수 있습니다. '기록보관자'를 켜면, 작가 AI는 창작에만 집중하고, 설정에 대한 사실 확인은 오직 기록보관자에게만 묻게 됩니다. 기록보관자는 설정 파일에 없는 내용은 절대 대답하지 않으므로, 훨씬 더 정확하고 경제적입니다.</p>
          </AccordionItem>
        </div>
      </>
    ),
  },
];

interface StudioGuideModalProps {
  onClose: () => void;
}

export function StudioGuideModal({ onClose }: StudioGuideModalProps) {
  const [activeSectionId, setActiveSectionId] = useState(guideSections[0].id);
  const activeSection = guideSections.find((s) => s.id === activeSectionId);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
          <h2 className="text-xl font-bold text-white">AI 소설가 스튜디오 안내서</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          <nav className="w-full md:w-64 bg-gray-800 border-b md:border-b-0 md:border-r border-gray-700 p-4 shrink-0 overflow-y-auto">
            <ul className="space-y-1">
              {guideSections.map((section) => (
                <li key={section.id}>
                  <button
                    onClick={() => setActiveSectionId(section.id)}
                    className={`w-full text-left flex items-center gap-3 p-2 rounded-md transition-colors text-sm ${
                      activeSectionId === section.id
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'text-gray-300 hover:text-indigo-400 hover:bg-gray-700'
                    }`}
                  >
                    {section.icon}
                    <span>{section.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex-1 p-6 md:p-8 overflow-y-auto text-gray-300">
            {activeSection && activeSection.content()}
          </div>
        </div>

        <footer className="p-4 border-t border-gray-700 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
          >
            닫기
          </button>
        </footer>
      </div>
    </div>
  );
}
