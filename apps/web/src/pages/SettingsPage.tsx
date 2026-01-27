import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Sun,
  Moon,
  Monitor,
  Palette,
  LayoutGrid,
  Rows2,
  Newspaper,
  PanelLeft,
  PanelTop,
  Maximize2,
  Layers,
  Type,
  Check,
  ArrowLeft,
  Rows4,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Github,
  Heart,
  Rss,
  ExternalLink,
  Globe,
} from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useUIStore } from '@/stores/uiStore';
import { useUpdatePreferences } from '@/hooks';
import { presetColors, isValidHex, getContrastColor } from '@/lib/colors';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';

type Theme = 'light' | 'dark' | 'system';
type Layout = 'compact' | 'list' | 'cards' | 'magazine';
type ArticleView = 'split-horizontal' | 'split-vertical' | 'overlay' | 'full';
type FontSize = 'small' | 'medium' | 'large';

interface SettingsSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-6"
    >
      <h2 className="text-lg font-semibold mb-1">{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
      )}
      {children}
    </motion.div>
  );
}

interface OptionButtonProps {
  icon: React.ReactNode;
  label: string;
  isSelected: boolean;
  onClick: () => void;
}

function OptionButton({ icon, label, isSelected, onClick }: OptionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all',
        isSelected
          ? 'border-accent-500 bg-accent-500/10 text-accent-600 dark:text-accent-400'
          : 'border-border/50 hover:border-border hover:bg-muted/50'
      )}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
      {isSelected && (
        <div className="absolute top-2 right-2">
          <Check className="w-4 h-4" />
        </div>
      )}
    </button>
  );
}

export function SettingsPage() {
  const { t } = useTranslation('settings');
  const navigate = useNavigate();
  const {
    theme,
    setTheme,
    layout,
    setLayout,
    articleView,
    setArticleView,
    accentColor,
    setAccentColor,
    fontSize,
    setFontSize,
  } = useUIStore();

  const updatePreferences = useUpdatePreferences();
  const [customColor, setCustomColor] = useState(accentColor);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { currentPassword: string; newPassword: string }) => {
      const response = await api.post('/auth/change-password', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success(t('security.passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error: any) => {
      const message = error.response?.data?.error || t('security.passwordChangeFailed');
      toast.error(message);
    },
  });

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t('security.fillAllFields'));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t('security.passwordMinLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('security.passwordsNoMatch'));
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    updatePreferences.mutate({ theme: newTheme });
  };

  const handleLayoutChange = (newLayout: Layout) => {
    setLayout(newLayout);
    updatePreferences.mutate({ layout: newLayout });
  };

  const handleArticleViewChange = (newView: ArticleView) => {
    setArticleView(newView);
    updatePreferences.mutate({ articleView: newView });
  };

  const handleAccentColorChange = (color: string) => {
    setAccentColor(color);
    setCustomColor(color);
    updatePreferences.mutate({ accentColor: color });
  };

  const handleFontSizeChange = (size: FontSize) => {
    setFontSize(size);
    updatePreferences.mutate({ fontSize: size });
  };

  const handleCustomColorInput = (value: string) => {
    setCustomColor(value);
    if (isValidHex(value)) {
      handleAccentColorChange(value);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('backToArticles')}
        </Button>
        <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('subtitle')}
        </p>
      </motion.div>

      {/* Theme Section */}
      <SettingsSection
        title={t('appearance.title')}
        description={t('appearance.description')}
      >
        <div className="grid grid-cols-3 gap-4">
          <OptionButton
            icon={<Sun className="w-6 h-6" />}
            label={t('appearance.light')}
            isSelected={theme === 'light'}
            onClick={() => handleThemeChange('light')}
          />
          <OptionButton
            icon={<Moon className="w-6 h-6" />}
            label={t('appearance.dark')}
            isSelected={theme === 'dark'}
            onClick={() => handleThemeChange('dark')}
          />
          <OptionButton
            icon={<Monitor className="w-6 h-6" />}
            label={t('appearance.system')}
            isSelected={theme === 'system'}
            onClick={() => handleThemeChange('system')}
          />
        </div>
      </SettingsSection>

      {/* Accent Color Section */}
      <SettingsSection
        title={t('accentColor.title')}
        description={t('accentColor.description')}
      >
        <div className="space-y-4">
          {/* Preset Colors */}
          <div className="flex flex-wrap gap-3">
            {presetColors.map((color) => (
              <button
                key={color.hex}
                onClick={() => handleAccentColorChange(color.hex)}
                className={cn(
                  'w-10 h-10 rounded-full transition-all duration-200',
                  'ring-offset-2 ring-offset-background',
                  accentColor === color.hex
                    ? 'ring-2 ring-foreground scale-110'
                    : 'hover:scale-105'
                )}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              >
                {accentColor === color.hex && (
                  <Check
                    className="w-5 h-5 mx-auto"
                    style={{ color: getContrastColor(color.hex) }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Custom Color Input */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t('accentColor.custom')}:</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={customColor}
                onChange={(e) => handleCustomColorInput(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0"
              />
              <input
                type="text"
                value={customColor}
                onChange={(e) => handleCustomColorInput(e.target.value)}
                placeholder="#3b82f6"
                className={cn(
                  'w-28 px-3 py-2 text-sm rounded-md uppercase',
                  'bg-muted/50 border border-border/50',
                  'focus:outline-none focus:ring-2 focus:ring-primary/50'
                )}
              />
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Language Section */}
      <SettingsSection
        title={t('language.title')}
        description={t('language.description')}
      >
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-muted-foreground" />
          <LanguageSwitcher variant="full" />
        </div>
      </SettingsSection>

      {/* Layout Section */}
      <SettingsSection
        title={t('feedLayout.title')}
        description={t('feedLayout.description')}
      >
        <div className="grid grid-cols-4 gap-4">
          <OptionButton
            icon={<Rows4 className="w-6 h-6" />}
            label={t('feedLayout.compact')}
            isSelected={layout === 'compact'}
            onClick={() => handleLayoutChange('compact')}
          />
          <OptionButton
            icon={<Rows2 className="w-6 h-6" />}
            label={t('feedLayout.list')}
            isSelected={layout === 'list'}
            onClick={() => handleLayoutChange('list')}
          />
          <OptionButton
            icon={<LayoutGrid className="w-6 h-6" />}
            label={t('feedLayout.cards')}
            isSelected={layout === 'cards'}
            onClick={() => handleLayoutChange('cards')}
          />
          <OptionButton
            icon={<Newspaper className="w-6 h-6" />}
            label={t('feedLayout.magazine')}
            isSelected={layout === 'magazine'}
            onClick={() => handleLayoutChange('magazine')}
          />
        </div>
      </SettingsSection>

      {/* Article View Section */}
      <SettingsSection
        title={t('articleView.title')}
        description={t('articleView.description')}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <OptionButton
            icon={<PanelTop className="w-6 h-6" />}
            label={t('articleView.horizontalSplit')}
            isSelected={articleView === 'split-horizontal'}
            onClick={() => handleArticleViewChange('split-horizontal')}
          />
          <OptionButton
            icon={<PanelLeft className="w-6 h-6" />}
            label={t('articleView.verticalSplit')}
            isSelected={articleView === 'split-vertical'}
            onClick={() => handleArticleViewChange('split-vertical')}
          />
          <OptionButton
            icon={<Layers className="w-6 h-6" />}
            label={t('articleView.overlay')}
            isSelected={articleView === 'overlay'}
            onClick={() => handleArticleViewChange('overlay')}
          />
          <OptionButton
            icon={<Maximize2 className="w-6 h-6" />}
            label={t('articleView.full')}
            isSelected={articleView === 'full'}
            onClick={() => handleArticleViewChange('full')}
          />
        </div>
      </SettingsSection>

      {/* Font Size Section */}
      <SettingsSection
        title={t('reading.title')}
        description={t('reading.description')}
      >
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-3">
              <Type className="w-4 h-4" />
              {t('reading.fontSize')}
            </label>
            <div className="grid grid-cols-3 gap-4">
              <button
                onClick={() => handleFontSizeChange('small')}
                className={cn(
                  'py-3 px-4 rounded-lg border-2 transition-all',
                  fontSize === 'small'
                    ? 'border-accent-500 bg-accent-500/10'
                    : 'border-border/50 hover:border-border'
                )}
              >
                <span className="text-xs">Aa</span>
                <span className="block text-sm mt-1">{t('reading.small')}</span>
              </button>
              <button
                onClick={() => handleFontSizeChange('medium')}
                className={cn(
                  'py-3 px-4 rounded-lg border-2 transition-all',
                  fontSize === 'medium'
                    ? 'border-accent-500 bg-accent-500/10'
                    : 'border-border/50 hover:border-border'
                )}
              >
                <span className="text-base">Aa</span>
                <span className="block text-sm mt-1">{t('reading.medium')}</span>
              </button>
              <button
                onClick={() => handleFontSizeChange('large')}
                className={cn(
                  'py-3 px-4 rounded-lg border-2 transition-all',
                  fontSize === 'large'
                    ? 'border-accent-500 bg-accent-500/10'
                    : 'border-border/50 hover:border-border'
                )}
              >
                <span className="text-lg">Aa</span>
                <span className="block text-sm mt-1">{t('reading.large')}</span>
              </button>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* Change Password Section */}
      <SettingsSection
        title={t('security.title')}
        description={t('security.description')}
      >
        <div className="space-y-4 max-w-md">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Lock className="w-4 h-4" />
              {t('security.currentPassword')}
            </label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('security.currentPasswordPlaceholder')}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Lock className="w-4 h-4" />
              {t('security.newPassword')}
            </label>
            <div className="relative">
              <Input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('security.newPasswordPlaceholder')}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium mb-2">
              <Lock className="w-4 h-4" />
              {t('security.confirmNewPassword')}
            </label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('security.confirmPasswordPlaceholder')}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
            className="w-full sm:w-auto"
          >
            {changePasswordMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('security.changingPassword')}
              </>
            ) : (
              t('security.changePasswordButton')
            )}
          </Button>
        </div>
      </SettingsSection>

      {/* Tech Stack Section */}
      <SettingsSection
        title={t('techStack.title')}
        description={t('techStack.description')}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {/* React */}
          <a
            href="https://react.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#61DAFB">
              <path d="M14.23 12.004a2.236 2.236 0 0 1-2.235 2.236 2.236 2.236 0 0 1-2.236-2.236 2.236 2.236 0 0 1 2.235-2.236 2.236 2.236 0 0 1 2.236 2.236zm2.648-10.69c-1.346 0-3.107.96-4.888 2.622-1.78-1.653-3.542-2.602-4.887-2.602-.41 0-.783.093-1.106.278-1.375.793-1.683 3.264-.973 6.365C1.98 8.917 0 10.42 0 12.004c0 1.59 1.99 3.097 5.043 4.03-.704 3.113-.39 5.588.988 6.38.32.187.69.275 1.102.275 1.345 0 3.107-.96 4.888-2.624 1.78 1.654 3.542 2.603 4.887 2.603.41 0 .783-.09 1.106-.275 1.374-.792 1.683-3.263.973-6.365C22.02 15.096 24 13.59 24 12.004c0-1.59-1.99-3.097-5.043-4.032.704-3.11.39-5.587-.988-6.38-.318-.184-.688-.277-1.092-.278zm-.005 1.09v.006c.225 0 .406.044.558.127.666.382.955 1.835.73 3.704-.054.46-.142.945-.25 1.44-.96-.236-2.006-.417-3.107-.534-.66-.905-1.345-1.727-2.035-2.447 1.592-1.48 3.087-2.292 4.105-2.295zm-9.77.02c1.012 0 2.514.808 4.11 2.28-.686.72-1.37 1.537-2.02 2.442-1.107.117-2.154.298-3.113.538-.112-.49-.195-.964-.254-1.42-.23-1.868.054-3.32.714-3.707.19-.09.4-.127.563-.132zm4.882 3.05c.455.468.91.992 1.36 1.564-.44-.02-.89-.034-1.345-.034-.46 0-.915.01-1.36.034.44-.572.895-1.096 1.345-1.565zM12 8.1c.74 0 1.477.034 2.202.093.406.582.802 1.203 1.183 1.86.372.64.71 1.29 1.018 1.946-.308.655-.646 1.31-1.013 1.95-.38.66-.773 1.288-1.18 1.87-.728.063-1.466.098-2.21.098-.74 0-1.477-.035-2.202-.093-.406-.582-.802-1.204-1.183-1.86-.372-.64-.71-1.29-1.018-1.946.303-.657.646-1.313 1.013-1.954.38-.66.773-1.286 1.18-1.868.728-.064 1.466-.098 2.21-.098zm-3.635.254c-.24.377-.48.763-.704 1.16-.225.39-.435.782-.635 1.174-.265-.656-.49-1.31-.676-1.947.64-.15 1.315-.283 2.015-.386zm7.26 0c.695.103 1.365.23 2.006.387-.18.632-.405 1.282-.66 1.933-.2-.39-.41-.783-.64-1.174-.225-.392-.465-.774-.705-1.146zm3.063.675c.484.15.944.317 1.375.498 1.732.74 2.852 1.708 2.852 2.476-.005.768-1.125 1.74-2.857 2.475-.42.18-.88.342-1.355.493-.28-.958-.646-1.956-1.1-2.98.45-1.017.81-2.01 1.085-2.964zm-13.395.004c.278.96.645 1.957 1.1 2.98-.45 1.017-.812 2.01-1.086 2.964-.484-.15-.944-.318-1.37-.5-1.732-.737-2.852-1.706-2.852-2.474 0-.768 1.12-1.742 2.852-2.476.42-.18.88-.342 1.356-.494zm11.678 4.28c.265.657.49 1.312.676 1.948-.64.157-1.316.29-2.016.39.24-.375.48-.762.705-1.158.225-.39.435-.788.636-1.18zm-9.945.02c.2.392.41.783.64 1.175.23.39.465.772.705 1.143-.695-.102-1.365-.23-2.006-.386.18-.63.406-1.282.66-1.933zM17.92 16.32c.112.493.2.968.254 1.423.23 1.868-.054 3.32-.714 3.708-.147.09-.338.128-.563.128-1.012 0-2.514-.807-4.11-2.28.686-.72 1.37-1.536 2.02-2.44 1.107-.118 2.154-.3 3.113-.54zm-11.83.01c.96.234 2.006.415 3.107.532.66.905 1.345 1.727 2.035 2.446-1.595 1.483-3.092 2.295-4.11 2.295-.22-.005-.406-.05-.553-.132-.666-.38-.955-1.834-.73-3.703.054-.46.142-.944.25-1.438zm4.56.64c.44.02.89.034 1.345.034.46 0 .915-.01 1.36-.034-.44.572-.895 1.095-1.345 1.565-.455-.47-.91-.993-1.36-1.565z"/>
            </svg>
            <span className="text-sm font-medium">React</span>
          </a>

          {/* TypeScript */}
          <a
            href="https://www.typescriptlang.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#3178C6">
              <path d="M1.125 0C.502 0 0 .502 0 1.125v21.75C0 23.498.502 24 1.125 24h21.75c.623 0 1.125-.502 1.125-1.125V1.125C24 .502 23.498 0 22.875 0zm17.363 9.75c.612 0 1.154.037 1.627.111a6.38 6.38 0 0 1 1.306.34v2.458a3.95 3.95 0 0 0-.643-.361 5.093 5.093 0 0 0-.717-.26 5.453 5.453 0 0 0-1.426-.2c-.3 0-.573.028-.819.086a2.1 2.1 0 0 0-.623.242c-.17.104-.3.229-.393.374a.888.888 0 0 0-.14.49c0 .196.053.373.156.529.104.156.252.304.443.444s.423.276.696.41c.273.135.582.274.926.416.47.197.892.407 1.266.628.374.222.695.473.963.753.268.279.472.598.614.957.142.359.214.776.214 1.253 0 .657-.125 1.21-.373 1.656a3.033 3.033 0 0 1-1.012 1.085 4.38 4.38 0 0 1-1.487.596c-.566.12-1.163.18-1.79.18a9.916 9.916 0 0 1-1.84-.164 5.544 5.544 0 0 1-1.512-.493v-2.63a5.033 5.033 0 0 0 3.237 1.2c.333 0 .624-.03.872-.09.249-.06.456-.144.623-.25.166-.108.29-.234.373-.38a1.023 1.023 0 0 0-.074-1.089 2.12 2.12 0 0 0-.537-.5 5.597 5.597 0 0 0-.807-.444 27.72 27.72 0 0 0-1.007-.436c-.918-.383-1.602-.852-2.053-1.405-.45-.553-.676-1.222-.676-2.005 0-.614.123-1.141.369-1.582.246-.441.58-.804 1.004-1.089a4.494 4.494 0 0 1 1.47-.629 7.536 7.536 0 0 1 1.77-.201zm-15.113.188h9.563v2.166H9.506v9.646H6.789v-9.646H3.375z"/>
            </svg>
            <span className="text-sm font-medium">TypeScript</span>
          </a>

          {/* Tailwind CSS */}
          <a
            href="https://tailwindcss.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#06B6D4">
              <path d="M12.001,4.8c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624 C13.666,10.618,15.027,12,18.001,12c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624 C16.337,6.182,14.976,4.8,12.001,4.8z M6.001,12c-3.2,0-5.2,1.6-6,4.8c1.2-1.6,2.6-2.2,4.2-1.8c0.913,0.228,1.565,0.89,2.288,1.624 c1.177,1.194,2.538,2.576,5.512,2.576c3.2,0,5.2-1.6,6-4.8c-1.2,1.6-2.6,2.2-4.2,1.8c-0.913-0.228-1.565-0.89-2.288-1.624 C10.337,13.382,8.976,12,6.001,12z"/>
            </svg>
            <span className="text-sm font-medium">Tailwind</span>
          </a>

          {/* Vite */}
          <a
            href="https://vitejs.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#646CFF" d="m8.286 10.578.512-8.657a.306.306 0 0 1 .247-.282L17.377.006a.306.306 0 0 1 .353.385l-1.558 5.403a.306.306 0 0 0 .352.385l2.388-.46a.306.306 0 0 1 .332.438l-6.79 13.55-.123.19a.294.294 0 0 1-.252.14c-.177 0-.35-.152-.305-.369l1.095-5.301a.306.306 0 0 0-.388-.355l-1.433.435a.306.306 0 0 1-.389-.354l.69-3.375a.306.306 0 0 0-.37-.36l-2.32.536a.306.306 0 0 1-.374-.316zm14.976-7.926L17.284 3.74l-.544 1.887 2.077-.4a.8.8 0 0 1 .84.369.8.8 0 0 1 .034.783L12.9 19.93l-.013.025-.015.023-.122.19a.801.801 0 0 1-.672.37.826.826 0 0 1-.634-.302.8.8 0 0 1-.16-.67l1.029-4.981-1.12.34a.81.81 0 0 1-.86-.262.802.802 0 0 1-.165-.67l.63-3.08-2.027.468a.808.808 0 0 1-.768-.233.81.81 0 0 1-.217-.6l.389-6.57-7.44-1.33a.612.612 0 0 0-.64.906L11.58 23.691a.612.612 0 0 0 1.066-.004l11.26-20.135a.612.612 0 0 0-.644-.9z"/>
            </svg>
            <span className="text-sm font-medium">Vite</span>
          </a>

          {/* Node.js */}
          <a
            href="https://nodejs.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#339933">
              <path d="M11.998,24c-0.321,0-0.641-0.084-0.922-0.247l-2.936-1.737c-0.438-0.245-0.224-0.332-0.08-0.383 c0.585-0.203,0.703-0.25,1.328-0.604c0.065-0.037,0.151-0.023,0.218,0.017l2.256,1.339c0.082,0.045,0.197,0.045,0.272,0l8.795-5.076 c0.082-0.047,0.134-0.141,0.134-0.238V6.921c0-0.099-0.053-0.192-0.137-0.242l-8.791-5.072c-0.081-0.047-0.189-0.047-0.271,0 L3.075,6.68C2.99,6.729,2.936,6.825,2.936,6.921v10.15c0,0.097,0.054,0.189,0.139,0.235l2.409,1.392 c1.307,0.654,2.108-0.116,2.108-0.89V7.787c0-0.142,0.114-0.253,0.256-0.253h1.115c0.139,0,0.255,0.112,0.255,0.253v10.021 c0,1.745-0.95,2.745-2.604,2.745c-0.508,0-0.909,0-2.026-0.551L2.28,18.675c-0.57-0.329-0.922-0.945-0.922-1.604V6.921 c0-0.659,0.353-1.275,0.922-1.603l8.795-5.082c0.557-0.315,1.296-0.315,1.848,0l8.794,5.082c0.57,0.329,0.924,0.944,0.924,1.603 v10.15c0,0.659-0.354,1.273-0.924,1.604l-8.794,5.078C12.643,23.916,12.324,24,11.998,24z M19.099,13.993 c0-1.9-1.284-2.406-3.987-2.763c-2.731-0.361-3.009-0.548-3.009-1.187c0-0.528,0.235-1.233,2.258-1.233 c1.807,0,2.473,0.389,2.747,1.607c0.024,0.115,0.129,0.199,0.247,0.199h1.141c0.071,0,0.138-0.031,0.186-0.081 c0.048-0.054,0.074-0.123,0.067-0.196c-0.177-2.098-1.571-3.076-4.388-3.076c-2.508,0-4.004,1.058-4.004,2.833 c0,1.925,1.488,2.457,3.895,2.695c2.88,0.282,3.103,0.703,3.103,1.269c0,0.983-0.789,1.402-2.642,1.402 c-2.327,0-2.839-0.584-3.011-1.742c-0.02-0.124-0.126-0.215-0.253-0.215h-1.137c-0.141,0-0.254,0.112-0.254,0.253 c0,1.482,0.806,3.248,4.655,3.248C17.501,17.007,19.099,15.91,19.099,13.993z"/>
            </svg>
            <span className="text-sm font-medium">Node.js</span>
          </a>

          {/* Express */}
          <a
            href="https://expressjs.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 18.588a1.529 1.529 0 0 1-1.895-.72l-3.45-4.771-.5-.667-4.003 5.444a1.466 1.466 0 0 1-1.802.708l5.158-6.92-4.798-6.251a1.595 1.595 0 0 1 1.9.666l3.576 4.83 3.596-4.81a1.435 1.435 0 0 1 1.788-.668L21.708 7.9l-2.522 3.283a.666.666 0 0 0 0 .994l4.804 6.412zM.002 11.576l.42-2.075c1.154-4.103 5.858-5.81 9.094-3.27 1.895 1.489 2.368 3.597 2.275 5.973H1.116C.943 16.447 4.005 19.009 7.92 17.7a4.078 4.078 0 0 0 2.582-2.876c.207-.666.548-.78 1.174-.588a5.417 5.417 0 0 1-2.589 3.957 6.272 6.272 0 0 1-7.306-.933 6.575 6.575 0 0 1-1.64-3.858c0-.235-.08-.455-.134-.666A88.33 88.33 0 0 1 0 11.577zm1.127-.286h9.654c-.06-3.076-2.001-5.258-4.59-5.278-2.882-.04-4.944 2.094-5.071 5.264z"/>
            </svg>
            <span className="text-sm font-medium">Express</span>
          </a>

          {/* PostgreSQL */}
          <a
            href="https://www.postgresql.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#4169E1">
              <path d="M23.5594 14.7228a.5269.5269 0 0 0-.0563-.1191c-.139-.2632-.4768-.3418-1.0074-.2321-1.6533.3411-2.2935.1312-2.5256-.0191 1.342-2.0482 2.445-4.522 3.0411-6.8297.2714-1.0507.7982-3.5237.1222-4.7316a1.5641 1.5641 0 0 0-.1509-.235C21.6931.9086 19.8007.0248 17.5099.0005c-1.4947-.0158-2.7705.3461-3.1161.4648a9.5862 9.5862 0 0 0-.5765-.0227c-1.717-.0451-3.1245.5521-4.1865 1.7818-.6702.7751-1.0874 1.6569-1.4609 2.4358-.1827.3804-.3518.7337-.5178.9953-.4971.7822-.9771 1.5043-1.4457 2.2099-.4211.6346-.8338 1.2574-1.2365 1.8925-.4198.6634-.7875 1.1379-1.1524 1.4796-.2187.2044-.4025.3453-.5453.3453h-.0046c-.585-.0123-.8991-.6598-1.0034-1.0418-.1308-.4788-.1659-1.0899.148-1.5564.0976-.1449.2071-.2229.3353-.2384.1551-.0192.3178.0476.4155.1172.096.0685.2004.1702.2345.3623.0271.1526.0119.3379-.0813.5765a.473.473 0 0 0 .0935.5186.4708.4708 0 0 0 .3413.1456.4811.4811 0 0 0 .1766-.0336c.2924-.1141.5122-.3614.6236-.7026.1574-.4811.1427-1.053-.0415-1.5815-.1805-.5188-.4922-.9352-.8767-1.1719-.4281-.2645-.9117-.3346-1.3601-.197-.5305.1624-.9684.541-1.235 1.0681-.3873.766-.4108 1.7015-.0631 2.5052.4255 1.0389 1.2765 1.7673 2.2188 1.8994.1233.0171.2479.0258.3725.0258.4936 0 .9731-.1751 1.4129-.5188.5765-.4501 1.0981-1.0974 1.6299-1.9278.4062-.6337.8188-1.2566 1.24-1.8913.4702-.7088.9518-1.4326 1.451-2.2177.1951-.3068.3905-.7199.6059-1.1693.3457-.7215.7384-1.5392 1.3168-2.208.8106-.9378 1.8969-1.4186 3.2285-1.4285h.0564c.5303.0044.9362.0587 1.2589.1248-.5479.2796-1.0074.6208-1.3825.9372-.3418.2888-.8344.8016-1.1209 1.1723-.434.5624-.8007 1.1983-.981 1.8085-.0577.1957-.0842.3476-.0832.4777.0015.1734.0541.3097.1565.4056.1401.1312.347.1743.4882.1795.4534.0165.9864-.2482 1.3848-.6862.8643-.9504 1.5845-2.3676 1.9224-3.7823 1.8764-.2574 3.4473.3705 4.1472.9558.4752.3973.8009.9378.9294 1.5398.0801.3754.1417 1.0055-.0067 1.8687-.1126.6543-.3158 1.3504-.5765 2.063l-.0058.0157c-.1246.3387-.5765.6185-.9813.7746-.1867.0722-.3716.118-.5765.118-.2016 0-.4036-.0463-.5985-.1227-.5765-.2258-.8984-.7426-.9669-.9988-.0543-.2042-.0206-.3987.0923-.5313.1198-.1403.3064-.2119.509-.1953.3622.0284.5765.3511.6066.7552.0237.3187.1618.6197.3904.8491.2293.2306.5765.4065.9748.4065.1174 0 .2419-.0138.3731-.0443.5765-.1283.9951-.4399 1.2819-.9563.2874-.5169.3904-1.1428.2898-1.7634-.1064-.6565-.4117-1.249-.8568-1.6637-.9414-.8768-2.4589-1.3149-4.5144-.9983.3043-1.2027.3785-2.2958.2172-3.2412-.0904-.5309-.2568-.9859-.4987-1.3615-.8308-1.2913-2.4096-1.9238-4.3826-1.9238-.8482 0-1.6927.1368-2.5039.406a6.1081 6.1081 0 0 0-.3311.1134c-.4222-.2275-.9618-.6377-1.257-1.0063-.3178-.3971-.6454-.7961-.9701-1.1936-.0529-.0646-.1091-.1297-.1698-.1981-.7125-.8014-1.5261-1.3182-2.4098-1.5348-.4877-.1195-1.0139-.1796-1.5636-.1796-1.2735 0-2.5765.3464-3.766.9996-.8585.4721-1.6285.9994-2.2888 1.5682-.3453.2968-.5765.5461-.7422.7434-.1682-.0329-.5765-.0867-1.0866-.0867-.6016 0-1.3238.0741-1.9253.3476-.6577.2993-1.1524.8018-1.3881 1.4131-.3098.8026-.2005 1.778.3023 2.6843.4303.7753 1.0896 1.3848 1.8568 1.7167a.4693.4693 0 0 0 .1911.0409c.1592 0 .3068-.0821.391-.2188.1302-.2109.065-.4885-.1458-.6188-.1009-.0623-.196-.131-.2871-.2037.3972-.1155.7944-.1746 1.1872-.1764.4823-.0018.9414.0859 1.3643.2608-.0461.6219-.0032 1.2517.1285 1.8649.1879.877.5387 1.7039 1.0456 2.4615.2142.32.4592.6164.7299.8833.0538.0532.1134.1025.1745.1493-.0312.1127-.0548.2283-.0676.3477-.0258.2397-.016.5021.0292.7756.074.4478.2456.9126.5034 1.3573.2471.4269.5765.8343.9712 1.2002.3931.3645.8554.6866 1.3661.9505.5106.2639 1.0669.4695 1.6436.6075.5765.1379 1.1706.2081 1.76.2081.5432 0 1.0717-.0606 1.5711-.1805.3604-.0865.7003-.2027 1.0168-.3458.1566.0733.3253.1389.5016.1957.4982.1604 1.0453.2439 1.5807.2414.0188-.0001.0375-.0002.0562-.0007.5765-.0123 1.1392-.0981 1.6692-.2548.3611-.1069.7015-.2458 1.0125-.4128.0908.2169.2216.4223.3932.6063.3398.3646.8076.6426 1.3559.8054.4139.1227.8628.1844 1.3356.1837.0262-.0001.0524-.0003.0787-.0008.5765-.0139 1.1459-.1227 1.6924-.3234.5468-.2008 1.0607-.4883 1.5255-.8549.465-.3666.8732-.8091 1.2138-1.3173.3406-.5082.6088-1.0768.7971-1.6904.1884-.6137.2931-1.2655.3112-1.9351.0181-.6696-.0505-1.3495-.2042-2.02a5.8636 5.8636 0 0 0-.1642-.5458c.3611.0233.7418.0353 1.1391.0353.6836 0 1.4139-.0464 2.0906-.1408.5103-.0711 1.0314-.1764 1.4609-.3326.2147-.0781.4196-.1743.575-.2956.0777-.0606.1417-.1283.1898-.2034.0481-.075.0803-.1575.0912-.2439a.4989.4989 0 0 0-.0055-.1621 1.4043 1.4043 0 0 0-.0394-.1665c-.2156-.6975-.9268-1.048-2.1142-1.0433-.7174.0029-1.5577.1217-2.4011.3411a.4752.4752 0 0 0-.2219.1373c-.1282-.5765-.311-1.1421-.5482-1.6854a.4735.4735 0 0 0-.1893-.216c.3668-.6042.6657-1.2335.8757-1.8718.2453-.7451.3678-1.5112.364-2.2786-.0038-.7674-.1338-1.5196-.3871-2.2372-.2534-.7177-.6212-1.394-1.0965-2.0108-.4752-.6167-1.0576-1.1683-1.7327-1.6346-1.0254-.7087-2.2124-1.1716-3.4844-1.3579-1.2721-.1863-2.5765-.0912-3.8235.2787-1.247.3699-2.3962.9994-3.3688 1.8461-.4814.419-.9086.885-1.275 1.3872-.0538.0737-.1065.148-.158.2233-.0462-.0148-.0928-.0293-.1397-.0434-1.0148-.304-2.0916-.4287-3.1673-.3672-.7073.0406-1.4088.1632-2.082.3639a.4718.4718 0 0 0-.2062.1357 9.0789 9.0789 0 0 0-.7529-.3066c-.7551-.2703-1.5635-.4133-2.3828-.4215a5.8188 5.8188 0 0 0-.4273.0063c-1.4957.0753-2.9014.6148-4.0597 1.5591-.7173.5852-1.3271 1.2931-1.8134 2.103-.4863.8099-.8512 1.7128-1.0837 2.6775-.2325.9647-.3323 1.9772-.2965 3.0049.0358 1.0278.2063 2.0516.5065 3.0336.3003.982.7268 1.9134 1.2692 2.7568.5423.8433 1.1966 1.5928 1.9467 2.2086.7501.6159 1.5918 1.0899 2.5024 1.3914.6829.2263 1.4001.3425 2.1316.3461a6.5395 6.5395 0 0 0 2.4177-.4549c.2588-.1036.5083-.2268.7461-.3676.1149.3118.2518.6167.4102.9119.4767.8878 1.1283 1.6782 1.9156 2.322a.4712.4712 0 0 0 .5937-.0548c.0925-.0923.1372-.2231.1178-.3524-.0193-.1293-.0967-.2408-.2094-.3009-.9088-.4855-1.6613-1.2036-2.1773-2.0782-.2619-.4438-.459-.9148-.5885-1.4012.2688.0673.5451.1108.8262.1298.4192.0283.8545-.004 1.2922-.0962.4376-.0922.8757-.2429 1.3011-.4472a6.8076 6.8076 0 0 0 1.2077-.7448c.3856-.2921.7421-.6306 1.0586-1.0111.3165-.3805.5918-.8002.8179-1.2512.2261-.4511.4009-.9315.5189-1.4295.118-.498.1778-1.0102.1779-1.524.0001-.5137-.0596-1.0248-.1783-1.5202-.1187-.4953-.295-.9712-.5256-1.4168a.4642.4642 0 0 0-.0558-.0914 9.9085 9.9085 0 0 0 .6506-1.2461c.1649.0606.3406.1222.527.1837.4626.1525.9851.3014 1.5615.4309a.4608.4608 0 0 0 .1091.0131 22.3695 22.3695 0 0 0 1.5476.2732c.494.0693.9938.1131 1.4833.1303.4894.0172.9659.008 1.4128-.0276.4469-.0357.8625-.0968 1.2323-.1841.3697-.0872.6925-.1988.9529-.3347.2603-.1359.4565-.2947.5731-.4764a.4782.4782 0 0 0-.0114-.5485z"/>
            </svg>
            <span className="text-sm font-medium">PostgreSQL</span>
          </a>

          {/* Drizzle ORM */}
          <a
            href="https://orm.drizzle.team"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#C5F74F">
              <path d="M5.353 11.823a1.036 1.036 0 0 1-.395-1.422 1.063 1.063 0 0 1 1.44-.39l9.593 5.472c.497.283.666.915.378 1.422a1.063 1.063 0 0 1-1.44.39zm0-5.472a1.036 1.036 0 0 1-.395-1.422 1.063 1.063 0 0 1 1.44-.39l9.593 5.472c.497.283.666.915.378 1.422a1.063 1.063 0 0 1-1.44.39zm2.703 10.944a1.036 1.036 0 0 1-.396-1.422 1.063 1.063 0 0 1 1.44-.39l9.593 5.472c.497.283.667.915.378 1.422a1.063 1.063 0 0 1-1.44.39zm0-5.471a1.036 1.036 0 0 1-.396-1.422 1.063 1.063 0 0 1 1.44-.39l9.593 5.47c.497.284.667.916.378 1.423a1.063 1.063 0 0 1-1.44.39z"/>
            </svg>
            <span className="text-sm font-medium">Drizzle</span>
          </a>

          {/* Redis */}
          <a
            href="https://redis.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#DC382D">
              <path d="M10.5 2.661l.54.997-1.797.644 2.409.218.748 1.246.467-1.121 2.077-.208-1.61-.613.426-1.017-1.578.596zm6.905 2.077L13.76 6.182l3.292 1.298-.353 1.058 1.58-.657 1.12.64-.057-1.418 1.525-.639L17.94 6.01l.466-1.272zm-9.091 4.263l2.977 10.186 1.329-2.164 2.661 2.965.129-.067L11.5 9.001H7.314zm9.661 3.326l-.04.024-.09.054.09-.024.04-.054zM.555 14.832l2.197 1.032 1.005-1.452-1.167-.625zM4.672 8.53l3.544 2.266-.376 1.177L4.276 9.76zm12.618 8.833l-1.457.67-.494 1.6 2.625-.783-.674-1.487zM8.3 20.186l-.146.091.146.036v-.127zM9.23 9.17l-4.146 2.094 4.728 2.096 4.146-2.094L9.23 9.17z"/>
            </svg>
            <span className="text-sm font-medium">Redis</span>
          </a>

          {/* TanStack Query */}
          <a
            href="https://tanstack.com/query"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#FF4154">
              <path d="M12 0C5.362 0 0 5.362 0 12s5.362 12 12 12 12-5.362 12-12S18.638 0 12 0zM6.5 17.5l2-2c1.1 1.1 2.9 1.1 4 0l2 2c-2.2 2.2-5.8 2.2-8 0zM12 14c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm5.5 3.5l-2-2c1.1-1.1 1.1-2.9 0-4l2-2c2.2 2.2 2.2 5.8 0 8zm-11-8l2 2c-1.1 1.1-1.1 2.9 0 4l-2 2c-2.2-2.2-2.2-5.8 0-8zM17.5 6.5l-2 2c-1.1-1.1-2.9-1.1-4 0l-2-2c2.2-2.2 5.8-2.2 8 0z"/>
            </svg>
            <span className="text-sm font-medium">TanStack</span>
          </a>

          {/* Framer Motion */}
          <a
            href="https://www.framer.com/motion"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#0055FF">
              <path d="M4 0h16v8h-8zM4 8h8l8 8H4zM4 16h8v8z"/>
            </svg>
            <span className="text-sm font-medium">Framer</span>
          </a>

          {/* Zustand */}
          <a
            href="https://zustand-demo.pmnd.rs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <span className="text-lg">🐻</span>
            <span className="text-sm font-medium">Zustand</span>
          </a>
        </div>
      </SettingsSection>

      {/* About Section */}
      <SettingsSection
        title={t('about.title')}
        description={t('about.subtitle')}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent-500/10 flex items-center justify-center flex-shrink-0">
              <Rss className="w-6 h-6 text-accent-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                {t('about.description')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <a
              href="https://github.com/jezzlucena/arss"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
                'bg-muted/50 hover:bg-muted transition-colors',
                'text-sm font-medium'
              )}
            >
              <Github className="w-4 h-4" />
              {t('about.viewOnGithub')}
              <ExternalLink className="w-3 h-3 text-muted-foreground" />
            </a>
            <a
              href="https://github.com/sponsors/jezzlucena"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
                'bg-pink-500/10 hover:bg-pink-500/20 transition-colors',
                'text-sm font-medium text-pink-600 dark:text-pink-400'
              )}
            >
              <Heart className="w-4 h-4" />
              {t('about.sponsor')}
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
