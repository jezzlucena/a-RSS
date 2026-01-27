import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, Rss, Loader2, Check } from 'lucide-react';
import { Button, Input, Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui';
import { useAddFeed, useDiscoverFeed } from '@/hooks/useFeeds';
import { useCategories } from '@/hooks/useCategories';
import { cn } from '@/lib/utils';

interface AddFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddFeedModal({ isOpen, onClose }: AddFeedModalProps) {
  const { t } = useTranslation('feeds');
  const [url, setUrl] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>();
  const [step, setStep] = useState<'input' | 'preview' | 'success'>('input');

  const { data: categories = [] } = useCategories();
  const discoverFeed = useDiscoverFeed();
  const addFeed = useAddFeed();

  const handleDiscover = async () => {
    if (!url.trim()) return;

    try {
      await discoverFeed.mutateAsync(url);
      setStep('preview');
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleSubscribe = async () => {
    try {
      await addFeed.mutateAsync({ url, categoryId: selectedCategoryId });
      setStep('success');
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleClose = () => {
    setUrl('');
    setSelectedCategoryId(undefined);
    setStep('input');
    discoverFeed.reset();
    addFeed.reset();
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
                <CardTitle className="text-xl">{t('addModal.title')}</CardTitle>
                <Button variant="ghost" size="icon-sm" onClick={handleClose}>
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>

              <CardContent className="space-y-4">
                {step === 'input' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t('addModal.feedUrl')}</label>
                      <div className="flex gap-2">
                        <Input
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          placeholder="https://example.com/feed.xml"
                          onKeyDown={(e) => e.key === 'Enter' && handleDiscover()}
                        />
                        <Button
                          onClick={handleDiscover}
                          disabled={!url.trim() || discoverFeed.isPending}
                        >
                          {discoverFeed.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            t('addModal.check')
                          )}
                        </Button>
                      </div>
                      {discoverFeed.isError && (
                        <p className="text-sm text-red-500">
                          {discoverFeed.error instanceof Error
                            ? discoverFeed.error.message
                            : t('addModal.discoverFailed')}
                        </p>
                      )}
                    </div>

                    <p className="text-sm text-gray-500">
                      {t('addModal.hint')}
                    </p>
                  </>
                )}

                {step === 'preview' && discoverFeed.data && (
                  <>
                    <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-accent-500/10 flex items-center justify-center">
                          <Rss className="w-5 h-5 text-accent-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{discoverFeed.data.title}</h3>
                          <p className="text-sm text-gray-500 truncate">
                            {discoverFeed.data.url}
                          </p>
                        </div>
                      </div>
                      {discoverFeed.data.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                          {discoverFeed.data.description}
                        </p>
                      )}
                    </div>

                    {categories.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t('addModal.categoryOptional')}</label>
                        <div className="flex flex-wrap gap-2">
                          {categories.map((cat) => (
                            <button
                              key={cat.id}
                              onClick={() =>
                                setSelectedCategoryId(
                                  selectedCategoryId === cat.id ? undefined : cat.id
                                )
                              }
                              className={cn(
                                'px-3 py-1.5 rounded-full text-sm transition-all',
                                selectedCategoryId === cat.id
                                  ? 'bg-accent-500 text-white'
                                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                              )}
                            >
                              {cat.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {step === 'success' && (
                  <div className="py-8 text-center">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center"
                    >
                      <Check className="w-8 h-8 text-green-500" />
                    </motion.div>
                    <h3 className="text-lg font-medium">{t('addModal.success')}</h3>
                    <p className="text-sm text-gray-500">
                      {t('addModal.successMessage')}
                    </p>
                  </div>
                )}
              </CardContent>

              {step === 'preview' && (
                <CardFooter className="flex gap-2 justify-end">
                  <Button variant="ghost" onClick={() => setStep('input')}>
                    {t('addModal.back')}
                  </Button>
                  <Button onClick={handleSubscribe} disabled={addFeed.isPending}>
                    {addFeed.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      t('addModal.subscribe')
                    )}
                  </Button>
                </CardFooter>
              )}
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
