/**
 * ============================================================
 * @module modules/author/components
 * @file TagFilter.tsx
 * ============================================================
 * @description 태그 필터 컴포넌트
 * ============================================================
 */

import { useState, memo } from 'react';
import { XMarkIcon, ChevronDownIcon } from '@shared/components';
import type { CategorizedTag } from '../hooks';
import type { CategoryId } from '../constants';

interface TagFilterProps {
  categorizedTags: CategorizedTag[];
  selectedTags: string[];
  onTagClick: (tag: string) => void;
  onClearFilters: () => void;
  onReclassifyTag: (tag: string, newCategory: CategoryId) => void;
}

export const TagFilter = memo(function TagFilter({
  categorizedTags,
  selectedTags,
  onTagClick,
  onClearFilters,
  onReclassifyTag,
}: TagFilterProps) {
  const [openCategories, setOpenCategories] = useState<string[]>([]);
  const [draggedTag, setDraggedTag] = useState<string | null>(null);
  const [dragOverCategory, setDragOverCategory] = useState<CategoryId | null>(null);

  const handleCategoryToggle = (categoryName: string) => {
    setOpenCategories((prev) =>
      prev.includes(categoryName)
        ? prev.filter((c) => c !== categoryName)
        : [...prev, categoryName]
    );
  };

  const handleDrop = (targetCategory: CategoryId) => {
    if (draggedTag) {
      onReclassifyTag(draggedTag, targetCategory);
    }
    setDragOverCategory(null);
    setDraggedTag(null);
  };

  return (
    <div className="mb-6 space-y-3">
      {/* 선택된 태그 표시 */}
      <div className="flex items-center flex-wrap gap-2">
        <span className="text-sm font-medium text-gray-400 mr-2">필터:</span>
        <button
          onClick={onClearFilters}
          className={`px-4 py-1.5 text-sm rounded-full transition-colors font-semibold ${
            selectedTags.length === 0
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }`}
        >
          전체
        </button>
        {selectedTags.map((tag) => (
          <button
            key={tag}
            onClick={() => onTagClick(tag)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full bg-indigo-500/50 text-indigo-200 hover:bg-indigo-500/70"
          >
            {tag}
            <XMarkIcon className="w-3 h-3" />
          </button>
        ))}
      </div>

      {/* 카테고리별 태그 */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        {categorizedTags.map((category) => (
          <div key={category.id} className="border-b border-gray-700 last:border-b-0">
            <button
              onClick={() => handleCategoryToggle(category.name)}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverCategory(category.id);
              }}
              onDragLeave={() => setDragOverCategory(null)}
              onDrop={() => handleDrop(category.id)}
              className={`w-full flex justify-between items-center text-left p-4 hover:bg-gray-700/50 transition-colors ${
                dragOverCategory === category.id ? 'bg-indigo-900/50' : ''
              }`}
            >
              <span className="font-semibold text-gray-300">{category.name}</span>
              <ChevronDownIcon
                className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${
                  openCategories.includes(category.name) ? 'rotate-180' : ''
                }`}
              />
            </button>
            {openCategories.includes(category.name) && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverCategory(category.id);
                }}
                onDragLeave={() => setDragOverCategory(null)}
                onDrop={() => handleDrop(category.id)}
                className={`px-4 pb-4 flex flex-wrap gap-2 transition-colors rounded-b-lg min-h-[40px] items-center ${
                  dragOverCategory === category.id ? 'bg-indigo-900/50' : ''
                }`}
              >
                {category.tags.length > 0 ? (
                  category.tags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => onTagClick(tag)}
                      draggable
                      onDragStart={() => setDraggedTag(tag)}
                      onDragEnd={() => setDraggedTag(null)}
                      className={`px-3 py-1 text-xs rounded-full font-semibold transition-colors cursor-grab active:cursor-grabbing ${
                        selectedTags.includes(tag)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                      }`}
                    >
                      {tag}
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-gray-500 italic w-full text-center">
                    태그를 이 곳으로 드래그하여 분류할 수 있습니다.
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
