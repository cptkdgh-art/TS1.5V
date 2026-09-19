/**
 * ============================================================
 * @module modules/novel/components
 * @file SeriesWorkflowGuideModal.tsx
 * ============================================================
 * @description 시리즈 기억 메커니즘 및 워크플로우 안내 모달
 * ============================================================
 */

import { XMarkIcon, CheckCircleIcon, ArrowRightIcon } from '@shared/components';

interface SeriesWorkflowGuideModalProps {
  onClose: () => void;
}

export function SeriesWorkflowGuideModal({ onClose }: SeriesWorkflowGuideModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-3xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold mb-2 text-white">
          시리즈 기억 관리 가이드
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          AI가 이전 권의 내용을 기억하고 자연스럽게 이어쓰는 방법
        </p>

        {/* 핵심 개념 */}
        <div className="bg-indigo-900/30 border border-indigo-700 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-indigo-300 mb-2">
            핵심 개념: 계층적 기억 구조
          </h3>
          <div className="text-sm text-gray-300 space-y-2">
            <p>우리 앱은 AI에게 <strong className="text-white">3단계 기억</strong>을 제공합니다:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong className="text-amber-400">단기 기억</strong>: 현재 집필 중인 챕터들 (캐시)</li>
              <li><strong className="text-teal-400">중기 기억</strong>: 현재 권의 문맥 요약</li>
              <li><strong className="text-purple-400">장기 기억</strong>: 시리즈 연대기 (권을 넘어 유지)</li>
            </ul>
          </div>
        </div>

        {/* 워크플로우 스텝 */}
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-semibold text-white">
            권장 워크플로우
          </h3>

          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
              1
            </div>
            <div className="flex-grow">
              <h4 className="font-semibold text-white">1권 집필 완료</h4>
              <p className="text-sm text-gray-400 mt-1">
                1권의 모든 챕터를 완성합니다.
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowRightIcon className="w-5 h-5 text-gray-500 rotate-90" />
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center text-white font-bold">
              2
            </div>
            <div className="flex-grow">
              <h4 className="font-semibold text-white">1권 문맥 요약 생성</h4>
              <p className="text-sm text-gray-400 mt-1">
                집필 화면 → <strong className="text-teal-300">캐시 센터 탭</strong> →
                <strong className="text-teal-300"> "문맥 요약 업데이트"</strong> 버튼 클릭
              </p>
              <div className="mt-2 bg-gray-700/50 rounded p-2 text-xs text-gray-300">
                이 요약이 있어야 시리즈 연대기에 1권 내용이 반영됩니다.
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowRightIcon className="w-5 h-5 text-gray-500 rotate-90" />
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">
              3
            </div>
            <div className="flex-grow">
              <h4 className="font-semibold text-white">시리즈 연대기 업데이트</h4>
              <p className="text-sm text-gray-400 mt-1">
                서재 → 시리즈 카드 → <strong className="text-purple-300">기억 관리</strong> 버튼 →
                <strong className="text-purple-300"> "AI로 연대기 업데이트"</strong>
              </p>
              <div className="mt-2 bg-gray-700/50 rounded p-2 text-xs text-gray-300">
                AI가 모든 권의 요약을 분석하여 시리즈 전체 연대기를 생성합니다.
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowRightIcon className="w-5 h-5 text-gray-500 rotate-90" />
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center text-white font-bold">
              4
            </div>
            <div className="flex-grow">
              <h4 className="font-semibold text-white">다음 권 집필 시작</h4>
              <p className="text-sm text-gray-400 mt-1">
                <strong className="text-amber-300">"다음 권 집필"</strong> 버튼으로 2권을 생성합니다.
              </p>
              <div className="mt-2 bg-gray-700/50 rounded p-2 text-xs text-gray-300">
                AI는 시리즈 연대기를 참고하여 이전 권의 사건, 인물 상태, 복선을 기억합니다.
              </div>
            </div>
          </div>
        </div>

        {/* 체크리스트 */}
        <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">
            다음 권 시작 전 체크리스트
          </h3>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm">
              <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0" />
              <span className="text-gray-300">이전 권의 <strong className="text-white">문맥 요약</strong>이 생성되어 있나요?</span>
            </li>
            <li className="flex items-center gap-2 text-sm">
              <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0" />
              <span className="text-gray-300"><strong className="text-white">시리즈 연대기</strong>가 최신 상태로 업데이트 되어 있나요?</span>
            </li>
            <li className="flex items-center gap-2 text-sm">
              <CheckCircleIcon className="w-5 h-5 text-green-400 flex-shrink-0" />
              <span className="text-gray-300">연대기에 <strong className="text-white">미해결 복선</strong>과 <strong className="text-white">인물 상태</strong>가 정리되어 있나요?</span>
            </li>
          </ul>
        </div>

        {/* 추가 팁 */}
        <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-amber-400 mb-2">
            Pro Tip
          </h3>
          <p className="text-sm text-gray-300">
            연대기는 AI가 자동 생성하지만, <strong className="text-white">직접 수정</strong>할 수도 있습니다.
            AI가 놓친 복선이나 중요한 설정이 있다면 수동으로 추가하세요.
            AI는 연대기에 적힌 내용을 <strong className="text-amber-300">사실</strong>로 받아들입니다.
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
