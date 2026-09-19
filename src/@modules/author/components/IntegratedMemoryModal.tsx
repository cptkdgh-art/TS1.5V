/**
 * ============================================================
 * @module modules/author/components
 * @file IntegratedMemoryModal.tsx
 * ============================================================
 * @description 통합 기억 관리 모달
 * ============================================================
 */

import { useState, useMemo } from 'react';
import type { AiAuthor } from '@core/types';
import { Button } from '@shared/components';
import { ClipboardDocumentListIcon, XMarkIcon } from '@shared/components';

interface IntegratedMemoryModalProps {
  authors: AiAuthor[];
  onClose: () => void;
  onUpdateAuthors: (authors: AiAuthor[]) => void;
}

export function IntegratedMemoryModal({
  authors,
  onClose,
  onUpdateAuthors,
}: IntegratedMemoryModalProps) {
  const [workingAuthors, setWorkingAuthors] = useState<AiAuthor[]>(
    JSON.parse(JSON.stringify(authors))
  );
  const [selectedAuthorIds, setSelectedAuthorIds] = useState<string[]>(['all']);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMemory, setActiveMemory] = useState<string | null>(null);

  const allMemories = useMemo(() => {
    const memorySet = new Set<string>();
    workingAuthors.forEach((author) => {
      author.memoryCache?.forEach((mem) => memorySet.add(mem));
    });
    return Array.from(memorySet).sort();
  }, [workingAuthors]);

  const filteredMemories = useMemo(() => {
    return allMemories.filter((memory) => {
      const termMatch = memory.toLowerCase().includes(searchTerm.toLowerCase());
      if (!termMatch) return false;
      if (selectedAuthorIds.includes('all')) return true;

      return workingAuthors.some(
        (author) =>
          selectedAuthorIds.includes(author.id) && author.memoryCache?.includes(memory)
      );
    });
  }, [allMemories, searchTerm, selectedAuthorIds, workingAuthors]);

  const handleToggleMemoryForAuthor = (authorId: string, memory: string) => {
    setWorkingAuthors((prev) =>
      prev.map((author) => {
        if (author.id === authorId) {
          const newCache = new Set(author.memoryCache || []);
          if (newCache.has(memory)) {
            newCache.delete(memory);
          } else {
            newCache.add(memory);
          }
          return { ...author, memoryCache: Array.from(newCache) };
        }
        return author;
      })
    );
  };

  const handleBatchAdd = (memory: string) => {
    setWorkingAuthors((prev) =>
      prev.map((author) => {
        if (selectedAuthorIds.includes('all') || selectedAuthorIds.includes(author.id)) {
          const newCache = new Set(author.memoryCache || []);
          newCache.add(memory);
          return { ...author, memoryCache: Array.from(newCache) };
        }
        return author;
      })
    );
  };

  const handleBatchRemove = (memory: string) => {
    setWorkingAuthors((prev) =>
      prev.map((author) => {
        if (selectedAuthorIds.includes('all') || selectedAuthorIds.includes(author.id)) {
          const newCache = new Set(author.memoryCache || []);
          newCache.delete(memory);
          return { ...author, memoryCache: Array.from(newCache) };
        }
        return author;
      })
    );
  };

  const handleSaveChanges = () => {
    onUpdateAuthors(workingAuthors);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-7xl flex flex-col h-[90vh]">
        <header className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardDocumentListIcon className="w-6 h-6" />
            통합 기억 관리
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="flex flex-1 min-h-0">
          {/* 왼쪽: 작가 필터 */}
          <div className="w-1/4 border-r border-gray-700 flex flex-col">
            <h3 className="p-4 font-semibold text-gray-300">작가 필터</h3>
            <div className="p-4 border-b border-gray-700">
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedAuthorIds.includes('all')}
                  onChange={() =>
                    setSelectedAuthorIds(selectedAuthorIds.includes('all') ? [] : ['all'])
                  }
                  className="form-checkbox h-4 w-4 rounded bg-gray-600 border-gray-500 text-indigo-500"
                />
                <span>전체 작가</span>
              </label>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {authors.map((author) => (
                <label key={author.id} className="flex items-center space-x-2 text-sm">
                  <input
                    type="checkbox"
                    checked={
                      selectedAuthorIds.includes(author.id) &&
                      !selectedAuthorIds.includes('all')
                    }
                    onChange={() => {
                      const newSelection = new Set(
                        selectedAuthorIds.filter((id) => id !== 'all')
                      );
                      if (newSelection.has(author.id)) {
                        newSelection.delete(author.id);
                      } else {
                        newSelection.add(author.id);
                      }
                      setSelectedAuthorIds(Array.from(newSelection));
                    }}
                    className="form-checkbox h-4 w-4 rounded bg-gray-600 border-gray-500 text-indigo-500"
                  />
                  <span>{author.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 중앙: 기억 목록 */}
          <div className="w-1/2 border-r border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="기억 검색..."
                className="w-full bg-gray-700 p-2 rounded-md text-sm"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredMemories.length === 0 ? (
                <p className="text-gray-500 text-center py-8">기억이 없습니다.</p>
              ) : (
                filteredMemories.map((memory) => (
                  <div
                    key={memory}
                    onClick={() => setActiveMemory(memory)}
                    className={`p-3 rounded-md cursor-pointer ${
                      activeMemory === memory
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <p className="text-sm font-semibold">{memory}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {workingAuthors
                        .filter((a) => a.memoryCache?.includes(memory))
                        .map((a) => (
                          <span
                            key={a.id}
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              activeMemory === memory ? 'bg-indigo-400/50' : 'bg-gray-600'
                            }`}
                          >
                            {a.name}
                          </span>
                        ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 오른쪽: 편집 */}
          <div className="w-1/4 flex flex-col">
            <h3 className="p-4 font-semibold text-gray-300">기억 편집</h3>
            <div className="flex-1 overflow-y-auto p-4 border-t border-gray-700">
              {activeMemory ? (
                <div className="space-y-4">
                  <p className="bg-gray-900 p-3 rounded-md text-sm font-semibold">
                    {activeMemory}
                  </p>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-gray-400">
                      이 기억을 가진 작가
                    </h4>
                    {authors.map((author) => (
                      <label
                        key={author.id}
                        className="flex items-center space-x-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={
                            workingAuthors
                              .find((a) => a.id === author.id)
                              ?.memoryCache?.includes(activeMemory) || false
                          }
                          onChange={() =>
                            handleToggleMemoryForAuthor(author.id, activeMemory)
                          }
                          className="form-checkbox h-4 w-4 rounded bg-gray-600 border-gray-500 text-indigo-500"
                        />
                        <span>{author.name}</span>
                      </label>
                    ))}
                  </div>
                  <div className="border-t border-gray-700 pt-4 space-y-2">
                    <h4 className="text-sm font-semibold text-gray-400">일괄 작업</h4>
                    <button
                      onClick={() => handleBatchAdd(activeMemory)}
                      className="w-full text-sm bg-teal-600 hover:bg-teal-700 py-2 rounded-md"
                    >
                      필터된 모든 작가에게 추가
                    </button>
                    <button
                      onClick={() => handleBatchRemove(activeMemory)}
                      className="w-full text-sm bg-red-600 hover:bg-red-700 py-2 rounded-md"
                    >
                      필터된 모든 작가에게서 제거
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 h-full flex items-center justify-center">
                  <p>왼쪽에서 기억을 선택하여 편집하세요.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <footer className="p-4 border-t border-gray-700 shrink-0 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSaveChanges}>
            변경사항 저장
          </Button>
        </footer>
      </div>
    </div>
  );
}
