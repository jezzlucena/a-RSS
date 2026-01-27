import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderOpen,
  FolderClosed,
  ChevronRight,
  MoreHorizontal,
  Edit,
  Trash2,
  Plus,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Button } from '@/components/ui';
import { useCategories, useDeleteCategory } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';
import type { Category, CategoryWithChildren } from '@arss/types';

interface CategoryItemProps {
  category: CategoryWithChildren;
  level: number;
  onEdit: (category: Category) => void;
}

function CategoryItem({ category, level, onEdit }: CategoryItemProps) {
  const { t } = useTranslation('navigation');
  const [isExpanded, setIsExpanded] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const deleteCategory = useDeleteCategory();

  const hasChildren = category.children && category.children.length > 0;
  const isSelected = location.pathname === `/category/${category.id}`;

  const handleDelete = async () => {
    if (confirm(t('categoryMenu.confirmDelete', { name: category.name }))) {
      await deleteCategory.mutateAsync(category.id);
    }
  };

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-all',
          'hover:bg-white/50 dark:hover:bg-gray-800/50',
          isSelected && 'bg-accent-500/10 text-accent-600 dark:text-accent-400'
        )}
        style={{ paddingLeft: `${8 + level * 16}px` }}
      >
        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            <ChevronRight
              className={cn(
                'w-4 h-4 transition-transform',
                isExpanded && 'rotate-90'
              )}
            />
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Icon & Name */}
        <button
          onClick={() => navigate(`/category/${category.id}`)}
          className="flex-1 flex items-center gap-2 min-w-0"
        >
          {isExpanded && hasChildren ? (
            <FolderOpen className="w-4 h-4" style={{ color: category.color }} />
          ) : (
            <FolderClosed className="w-4 h-4" style={{ color: category.color }} />
          )}
          <span className="text-sm font-medium truncate">{category.name}</span>
        </button>

        {/* Actions */}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[160px] glass rounded-lg p-1 shadow-lg animate-fade-in z-50"
              sideOffset={5}
            >
              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none hover:bg-gray-100 dark:hover:bg-gray-800"
                onSelect={() => onEdit(category)}
              >
                <Edit className="w-4 h-4" />
                {t('categoryMenu.edit')}
              </DropdownMenu.Item>

              <DropdownMenu.Separator className="h-px bg-gray-200 dark:bg-gray-700 my-1" />

              <DropdownMenu.Item
                className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer outline-none text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                onSelect={handleDelete}
              >
                <Trash2 className="w-4 h-4" />
                {t('categoryMenu.delete')}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Children */}
      <AnimatePresence>
        {isExpanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {category.children.map((child) => (
              <CategoryItem
                key={child.id}
                category={child}
                level={level + 1}
                onEdit={onEdit}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface CategoryTreeProps {
  onAddCategory: () => void;
  onEditCategory: (category: Category) => void;
}

export function CategoryTree({ onAddCategory, onEditCategory }: CategoryTreeProps) {
  const { t } = useTranslation('navigation');

  const { data: categories = [] } = useCategories();

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center justify-between px-3 mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          {t('sidebar.categories')}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6"
          onClick={onAddCategory}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Category List */}
      {categories.length === 0 ? (
        <p className="px-3 text-sm text-gray-400">{t('sidebar.noCategories')}</p>
      ) : (
        categories.map((category) => (
          <CategoryItem
            key={category.id}
            category={category as CategoryWithChildren}
            level={0}
            onEdit={onEditCategory}
          />
        ))
      )}
    </div>
  );
}
