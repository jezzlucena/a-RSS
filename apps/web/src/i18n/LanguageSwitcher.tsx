import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { supportedLanguages } from './index';

interface LanguageSwitcherProps {
  variant?: 'button' | 'full';
  className?: string;
}

export function LanguageSwitcher({ variant = 'button', className }: LanguageSwitcherProps) {
  const { i18n } = useTranslation();

  const currentLanguage = supportedLanguages.find(
    (lang) => lang.code === i18n.language
  ) || supportedLanguages[0];

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
  };

  if (variant === 'full') {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        {supportedLanguages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2',
              i18n.language === lang.code
                ? 'bg-accent-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
            )}
          >
            <span className="text-base">{lang.flag}</span>
            <span>{lang.name}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="icon" className={className}>
          <Globe className="w-5 h-5" />
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[180px] glass rounded-lg p-1 shadow-lg animate-fade-in z-50"
          sideOffset={5}
          align="end"
        >
          {supportedLanguages.map((lang) => (
            <DropdownMenu.Item
              key={lang.code}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm rounded-md cursor-pointer outline-none',
                i18n.language === lang.code
                  ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
              onSelect={() => handleLanguageChange(lang.code)}
            >
              <span className="text-base">{lang.flag}</span>
              <span>{lang.name}</span>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
