import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, FolderPlus, Loader2 } from 'lucide-react';
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from '@/components/ui';
import { useCreateCategory, useUpdateCategory, useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';
import type { Category } from '@arss/types';

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
];

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: Category | null; // If provided, we're editing
}

export function CategoryModal({ isOpen, onClose, category }: CategoryModalProps) {
  const { t } = useTranslation('feeds');
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[4]);
  const [parentId, setParentId] = useState<string | null>(null);

  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const isEditing = !!category;
  const mutation = isEditing ? updateCategory : createCategory;

  // Filter out the current category and its descendants from parent options
  const availableParents = categories.filter((c) => {
    if (!category) return true;
    if (c.id === category.id) return false;
    // TODO: Also filter out descendants
    return true;
  });

  useEffect(() => {
    if (category) {
      setName(category.name);
      setColor(category.color);
      setParentId(category.parentId);
    } else {
      setName('');
      setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
      setParentId(null);
    }
  }, [category, isOpen]);

  const handleSave = async () => {
    if (!name.trim()) return;

    if (isEditing && category) {
      await updateCategory.mutateAsync({
        categoryId: category.id,
        name: name.trim(),
        color,
        parentId,
      });
    } else {
      await createCategory.mutateAsync({
        name: name.trim(),
        color,
        parentId: parentId || undefined,
      });
    }

    handleClose();
  };

  const handleClose = () => {
    setName('');
    setColor(PRESET_COLORS[4]);
    setParentId(null);
    createCategory.reset();
    updateCategory.reset();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={handleClose}
          >
            <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  <FolderPlus className="w-5 h-5" />
                  {isEditing ? t('categoryModal.editTitle') : t('categoryModal.newTitle')}
                </CardTitle>
                <Button variant="ghost" size="icon-sm" onClick={handleClose}>
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('categoryModal.name')}</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('categoryModal.namePlaceholder')}
                    autoFocus
                  />
                </div>

                {/* Color Picker */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('categoryModal.color')}</label>
                  <div className="grid grid-cols-8 gap-2">
                    {PRESET_COLORS.map((presetColor) => (
                      <button
                        key={presetColor}
                        onClick={() => setColor(presetColor)}
                        className={cn(
                          'w-8 h-8 rounded-lg transition-all',
                          color === presetColor
                            ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500'
                            : 'hover:scale-110'
                        )}
                        style={{ backgroundColor: presetColor }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm text-gray-500">{t('categoryModal.custom')}:</span>
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer"
                    />
                    <Input
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-24 h-8 text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>

                {/* Parent Category */}
                {availableParents.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('categoryModal.parentCategory')}</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setParentId(null)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-sm transition-all',
                          parentId === null
                            ? 'bg-accent-500 text-white'
                            : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                        )}
                      >
                        {t('categoryModal.noneTopLevel')}
                      </button>
                      {availableParents.map((cat) => (
                        <button
                          key={cat.id}
                          onClick={() => setParentId(cat.id)}
                          className={cn(
                            'px-3 py-1.5 rounded-full text-sm transition-all flex items-center gap-1.5',
                            parentId === cat.id
                              ? 'bg-accent-500 text-white'
                              : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                          )}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('categoryModal.preview')}</label>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-medium">
                      {name || t('categoryModal.namePlaceholder')}
                    </span>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={handleClose}>
                  {t('categoryModal.cancel')}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!name.trim() || mutation.isPending}
                >
                  {mutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isEditing ? (
                    t('categoryModal.saveChanges')
                  ) : (
                    t('categoryModal.createCategory')
                  )}
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
